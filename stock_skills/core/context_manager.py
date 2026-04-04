"""
自動コンテキスト注入モジュール

- 過去分析データの鮮度判定（新しい/最近/古い/なし）
- 銘柄との関係性判定（保有中/ウォッチリスト/スクリーニング多数ヒット/初見）
- 推奨アクション決定
- 分析結果のスナップショット保存・読み込み
"""
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from .paths import ANALYSIS_DIR
SCREENING_HISTORY_FILE = ANALYSIS_DIR / "screening_history.json"

FRESHNESS_NEW    = "new"      # 24時間以内
FRESHNESS_RECENT = "recent"   # 7日以内
FRESHNESS_OLD    = "old"      # 7日超
FRESHNESS_NONE   = "none"     # 記録なし

RELATION_HOLDING   = "holding"           # 保有中
RELATION_THESIS    = "thesis_outdated"   # テーゼ記録から90日超
RELATION_WATCHLIST = "watchlist"         # ウォッチリスト登録済
RELATION_HOT       = "screening_hot"     # スクリーニング3回以上出現
RELATION_NEW       = "new"               # 初見


def _analysis_path(ticker: str) -> Path:
    safe = ticker.replace(".", "_").replace("/", "_")
    return ANALYSIS_DIR / f"{safe}.json"


# -------------------------------------------------------
# 鮮度判定
# -------------------------------------------------------

def get_data_freshness(ticker: str) -> str:
    """過去分析データの鮮度を判定する"""
    path = _analysis_path(ticker)
    if not path.exists():
        return FRESHNESS_NONE

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        last_updated_str = data.get("last_updated")
        if not last_updated_str:
            return FRESHNESS_NONE
        last_updated = datetime.fromisoformat(last_updated_str)
    except Exception:
        return FRESHNESS_NONE

    age = datetime.now() - last_updated
    if age <= timedelta(hours=24):
        return FRESHNESS_NEW
    elif age <= timedelta(days=7):
        return FRESHNESS_RECENT
    else:
        return FRESHNESS_OLD


def load_past_analysis(ticker: str) -> Optional[dict]:
    """過去の分析結果を読み込む"""
    path = _analysis_path(ticker)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def save_analysis(ticker: str, data: dict) -> None:
    """分析結果を保存する（鮮度管理用）"""
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    path = _analysis_path(ticker)

    # 既存データと差分マージ（スクリーニングヒット回数などを保持）
    existing = load_past_analysis(ticker) or {}
    screening_count = existing.get("screening_hit_count", 0)

    merged = {
        **existing,
        **data,
        "ticker": ticker,
        "last_updated": datetime.now().isoformat(),
        "screening_hit_count": screening_count,
    }
    path.write_text(json.dumps(merged, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def increment_screening_hit(ticker: str, preset: str) -> int:
    """スクリーニングヒット回数をインクリメントし、通算回数を返す"""
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    path = _analysis_path(ticker)
    data = load_past_analysis(ticker) or {}

    count = data.get("screening_hit_count", 0) + 1
    history = data.get("screening_hit_history", [])
    history.append({
        "date": datetime.now().strftime("%Y-%m-%d"),
        "preset": preset,
    })
    # 履歴は最新20件まで保持
    history = history[-20:]

    data.update({
        "ticker": ticker,
        "last_updated": data.get("last_updated", datetime.now().isoformat()),
        "screening_hit_count": count,
        "screening_hit_history": history,
    })
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return count


# -------------------------------------------------------
# 関係性判定
# -------------------------------------------------------

def get_ticker_relationship(ticker: str) -> str:
    """銘柄との関係性を判定する"""
    from .health_check import load_portfolio, load_watchlist

    # 1. 保有中チェック
    portfolio = load_portfolio()
    for rec in portfolio:
        if rec.get("ticker") == ticker:
            # テーゼ記録日から90日超かチェック
            buy_date_str = rec.get("buy_date", "")
            if buy_date_str:
                try:
                    buy_date = datetime.strptime(buy_date_str, "%Y-%m-%d")
                    if (datetime.now() - buy_date).days > 90:
                        return RELATION_THESIS
                except ValueError:
                    pass
            return RELATION_HOLDING

    # 2. ウォッチリストチェック
    watchlist = load_watchlist()
    for item in watchlist:
        if item.get("ticker") == ticker:
            return RELATION_WATCHLIST

    # 3. スクリーニング頻出チェック
    past = load_past_analysis(ticker)
    if past and past.get("screening_hit_count", 0) >= 3:
        return RELATION_HOT

    return RELATION_NEW


# -------------------------------------------------------
# 推奨アクション決定
# -------------------------------------------------------

def get_recommended_action(ticker: str) -> dict:
    """
    鮮度と関係性を組み合わせて推奨アクションを決定する

    Returns:
        {
            "action": str,
            "freshness": str,
            "relationship": str,
            "message": str,
            "fetch_mode": "skip" | "diff" | "full",
        }
    """
    freshness = get_data_freshness(ticker)
    relationship = get_ticker_relationship(ticker)

    # フェッチモード決定
    if freshness == FRESHNESS_NEW:
        fetch_mode = "skip"
    elif freshness == FRESHNESS_RECENT:
        fetch_mode = "diff"
    else:  # old or none
        fetch_mode = "full"

    # 推奨アクションと説明文
    action_map = {
        RELATION_HOLDING: {
            "action": "health_check",
            "message": "保有中銘柄 → ヘルスチェックを優先実行します",
        },
        RELATION_THESIS: {
            "action": "health_check_with_review",
            "message": "取得から90日超 → ヘルスチェック + 投資テーゼの振り返りを行います",
        },
        RELATION_WATCHLIST: {
            "action": "diff_report",
            "message": "ウォッチリスト登録済 → 前回との差分レポートを生成します",
        },
        RELATION_HOT: {
            "action": "attention_report",
            "message": "スクリーニングに3回以上出現 → 注目フラグ付きレポートを生成します",
        },
        RELATION_NEW: {
            "action": "full_report",
            "message": "初見銘柄 → 通常レポートを生成します",
        },
    }

    info = action_map.get(relationship, action_map[RELATION_NEW])

    return {
        "action": info["action"],
        "freshness": freshness,
        "relationship": relationship,
        "message": info["message"],
        "fetch_mode": fetch_mode,
    }


# -------------------------------------------------------
# 差分計算
# -------------------------------------------------------

def calc_diff(past: dict, current: dict) -> dict:
    """
    過去データと現在データの差分を計算する
    数値フィールドの変化率を返す
    """
    diff = {}
    numeric_keys = [
        "current_price", "per", "pbr", "rsi_14", "ma50", "ma200",
        "revenue_growth", "gross_margins", "market_cap",
        "week52_high", "week52_low",
    ]

    def _flatten(d: dict, prefix: str = "") -> dict:
        result = {}
        for k, v in d.items():
            key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                result.update(_flatten(v, key))
            else:
                result[key] = v
        return result

    flat_past = _flatten(past)
    flat_current = _flatten(current)

    for key in set(list(flat_past.keys()) + list(flat_current.keys())):
        if not any(nk in key for nk in numeric_keys):
            continue
        old_val = flat_past.get(key)
        new_val = flat_current.get(key)
        if old_val is None or new_val is None:
            continue
        try:
            old_f = float(old_val)
            new_f = float(new_val)
            if old_f != 0:
                change_pct = (new_f - old_f) / abs(old_f) * 100
                diff[key] = {
                    "old": old_f,
                    "new": new_f,
                    "change_pct": round(change_pct, 1),
                }
        except (TypeError, ValueError):
            continue

    return diff


def format_context_header(ticker: str) -> str:
    """
    スキル冒頭に表示するコンテキストヘッダーを生成する
    """
    ctx = get_recommended_action(ticker)
    past = load_past_analysis(ticker)

    lines = [
        f"╔{'═'*58}╗",
        f"║ 📌 コンテキスト: {ticker:<40}║",
        f"╠{'═'*58}╣",
        f"║ 関係性: {_relation_label(ctx['relationship']):<49}║",
        f"║ データ鮮度: {_freshness_label(ctx['freshness']):<47}║",
        f"║ {ctx['message']:<57}║",
    ]

    if past:
        hit_count = past.get("screening_hit_count", 0)
        if hit_count > 0:
            lines.append(f"║ スクリーニングヒット: {hit_count}回{'':>44}║")
        last_updated = past.get("last_updated", "")
        if last_updated:
            try:
                dt = datetime.fromisoformat(last_updated)
                lines.append(f"║ 前回分析: {dt.strftime('%Y-%m-%d %H:%M'):<47}║")
            except ValueError:
                pass

    lines.append(f"╚{'═'*58}╝")
    return "\n".join(lines)


def _relation_label(rel: str) -> str:
    return {
        RELATION_HOLDING:   "💼 保有中",
        RELATION_THESIS:    "⏰ 保有中（取得90日超）",
        RELATION_WATCHLIST: "👀 ウォッチリスト登録済",
        RELATION_HOT:       "🔥 スクリーニング頻出",
        RELATION_NEW:       "🆕 初見",
    }.get(rel, rel)


def _freshness_label(freshness: str) -> str:
    return {
        FRESHNESS_NEW:    "🟢 最新（24時間以内）→ キャッシュ利用",
        FRESHNESS_RECENT: "🟡 最近（7日以内）→ 差分更新",
        FRESHNESS_OLD:    "🔴 古い（7日超）→ フル再取得",
        FRESHNESS_NONE:   "⚪ データなし → ゼロから分析",
    }.get(freshness, freshness)
