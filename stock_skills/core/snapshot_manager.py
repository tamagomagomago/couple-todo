"""
ポートフォリオスナップショット管理

- 現在のポートフォリオ状態をJSONで保存
- 週次での自動比較
- 過去スナップショットとの差分表示
"""
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from .paths import SNAPSHOTS_DIR


def _snapshot_path(label: str) -> Path:
    return SNAPSHOTS_DIR / f"{label}.json"


def save_snapshot(label: Optional[str] = None) -> dict:
    """
    現在のポートフォリオをスナップショットとして保存する

    Args:
        label: スナップショット名（省略時は日時で自動命名）

    Returns:
        保存したスナップショットデータ
    """
    from .health_check import check_portfolio_health

    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    now = datetime.now()
    label = label or now.strftime("snap_%Y%m%d_%H%M%S")
    health = check_portfolio_health()

    snapshot = {
        "label": label,
        "created_at": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "summary": health.get("summary", {}),
        "holdings": health.get("holdings", []),
    }

    path = _snapshot_path(label)
    path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return snapshot


def list_snapshots(limit: int = 10) -> list[dict]:
    """保存済みスナップショットの一覧を返す（新しい順）"""
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(SNAPSHOTS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)

    result = []
    for f in files[:limit]:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            result.append({
                "label": data.get("label", f.stem),
                "date": data.get("date", ""),
                "time": data.get("time", ""),
                "total_value": data.get("summary", {}).get("total_value"),
                "total_pnl": data.get("summary", {}).get("total_pnl"),
                "total_pnl_pct": data.get("summary", {}).get("total_pnl_pct"),
                "count": data.get("summary", {}).get("count", 0),
                "file": str(f),
            })
        except Exception:
            continue

    return result


def load_snapshot(label: str) -> Optional[dict]:
    """スナップショットを読み込む"""
    path = _snapshot_path(label)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def get_latest_snapshot() -> Optional[dict]:
    """最新のスナップショットを返す"""
    snaps = list_snapshots(limit=1)
    if not snaps:
        return None
    return load_snapshot(snaps[0]["label"])


def get_weekly_snapshot() -> Optional[dict]:
    """直近1週間以内で最も古いスナップショットを返す（週次比較用）"""
    snaps = list_snapshots(limit=50)
    one_week_ago = datetime.now() - timedelta(days=7)

    # 7日以内のスナップショットの中で最も古いもの
    weekly = None
    for snap in reversed(snaps):
        try:
            dt = datetime.strptime(snap["date"], "%Y-%m-%d")
            if dt >= one_week_ago:
                weekly = snap
        except Exception:
            continue

    if weekly is None:
        # 7日以内になければ最古のものを返す
        return load_snapshot(snaps[-1]["label"]) if snaps else None

    return load_snapshot(weekly["label"])


def compare_snapshots(snap_old: dict, snap_new: dict) -> dict:
    """
    2つのスナップショットを比較して差分を返す

    Returns:
        {
            "period": str,
            "summary_diff": {...},
            "holdings_diff": [...],
            "added": [...],
            "removed": [...],
        }
    """
    old_date = snap_old.get("date", "")
    new_date = snap_new.get("date", "")

    old_sum = snap_old.get("summary", {})
    new_sum = snap_new.get("summary", {})

    # サマリー差分
    summary_diff = {}
    for key in ["total_value", "total_cost", "total_pnl", "total_pnl_pct"]:
        old_val = old_sum.get(key)
        new_val = new_sum.get(key)
        if old_val is not None and new_val is not None:
            summary_diff[key] = {
                "old": old_val,
                "new": new_val,
                "delta": round(new_val - old_val, 1),
                "delta_pct": round((new_val - old_val) / abs(old_val) * 100, 1) if old_val != 0 else None,
            }

    # 保有銘柄差分
    old_holdings = {h["ticker"]: h for h in snap_old.get("holdings", [])}
    new_holdings = {h["ticker"]: h for h in snap_new.get("holdings", [])}

    added = [new_holdings[t] for t in new_holdings if t not in old_holdings]
    removed = [old_holdings[t] for t in old_holdings if t not in new_holdings]

    holdings_diff = []
    for ticker in set(list(old_holdings.keys()) + list(new_holdings.keys())):
        if ticker not in old_holdings or ticker not in new_holdings:
            continue
        old_h = old_holdings[ticker]
        new_h = new_holdings[ticker]
        old_price = old_h.get("current_price", 0)
        new_price = new_h.get("current_price", 0)
        if old_price and new_price:
            price_change = round((new_price - old_price) / old_price * 100, 1)
        else:
            price_change = None

        old_pnl = old_h.get("pnl", 0)
        new_pnl = new_h.get("pnl", 0)

        holdings_diff.append({
            "ticker": ticker,
            "name": new_h.get("name", ticker),
            "old_price": old_price,
            "new_price": new_price,
            "price_change_pct": price_change,
            "old_pnl": old_pnl,
            "new_pnl": new_pnl,
            "pnl_delta": round(new_pnl - old_pnl, 0) if old_pnl is not None and new_pnl is not None else None,
        })

    return {
        "period": f"{old_date} → {new_date}",
        "summary_diff": summary_diff,
        "holdings_diff": sorted(holdings_diff, key=lambda x: abs(x.get("price_change_pct") or 0), reverse=True),
        "added": added,
        "removed": removed,
    }


def format_snapshot_comparison(comparison: dict) -> str:
    """スナップショット比較結果を表示用文字列に変換"""
    lines = [
        f"\n{'='*60}",
        f"📸 ポートフォリオ週次比較: {comparison['period']}",
        f"{'='*60}",
    ]

    sd = comparison.get("summary_diff", {})
    if sd:
        tv = sd.get("total_value", {})
        if tv:
            sym = "▲" if tv.get("delta", 0) >= 0 else "▼"
            lines.append(f"\n評価額: {tv['old']:,.0f} → {tv['new']:,.0f}  ({sym}{abs(tv['delta']):,.0f})")
        tp = sd.get("total_pnl_pct", {})
        if tp:
            delta = tp.get("delta", 0)
            sym = "▲" if delta >= 0 else "▼"
            lines.append(f"損益率: {tp['old']:+.1f}% → {tp['new']:+.1f}%  ({sym}{abs(delta):.1f}pt)")

    hd = comparison.get("holdings_diff", [])
    if hd:
        lines.append(f"\n【個別銘柄変化】")
        for h in hd:
            chg = h.get("price_change_pct")
            if chg is not None:
                sym = "▲" if chg >= 0 else "▼"
                lines.append(f"  {h['ticker']} {h['name']}: {sym}{abs(chg):.1f}%")

    added = comparison.get("added", [])
    if added:
        lines.append(f"\n【新規追加】")
        for h in added:
            lines.append(f"  + {h['ticker']} {h.get('name', '')}")

    removed = comparison.get("removed", [])
    if removed:
        lines.append(f"\n【売却・除外】")
        for h in removed:
            lines.append(f"  - {h['ticker']} {h.get('name', '')}")

    return "\n".join(lines)
