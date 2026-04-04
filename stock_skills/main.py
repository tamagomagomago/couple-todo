"""
投資分析システム メインエントリポイント（Phase 2）
自然言語でスクリーニング・レポート・ポートフォリオ管理を実行できる

使い方:
  python3 main.py "新高値ブレイクの銘柄を探して"
  python3 main.py "押し目買いチャンスは？"
  python3 main.py "AI関連で割安なやつある？"
  python3 main.py "7203のレポートを見せて"
  python3 main.py "NVDAのレポートを見せて"
  python3 main.py "ポートフォリオの調子は？"
  python3 main.py "ウォッチリストを確認して"
  python3 main.py "ポートフォリオのスナップショットを保存"
  python3 main.py "週次比較を見せて"
  python3 main.py "レッスンを追加 NVDA RSI70超で高値掴み 次はRSI60以下を待つ"
  python3 main.py "レッスン一覧"
"""
import re
import sys
import json
from pathlib import Path

# パスを通す
sys.path.insert(0, str(Path(__file__).parent))

from core.screener import run_preset
from core.scorer import score_and_rank
from core.health_check import (
    check_portfolio_health,
    check_watchlist_health,
    generate_stock_report,
    add_to_portfolio,
    add_to_watchlist,
    load_watchlist,
)
from core.context_manager import (
    get_recommended_action,
    format_context_header,
    save_analysis,
    increment_screening_hit,
    load_past_analysis,
    calc_diff,
    get_data_freshness,
    FRESHNESS_NEW,
)
from core.lesson_manager import (
    add_lesson,
    get_lessons_for_ticker,
    format_lesson_warnings,
    list_all_lessons,
    check_warnings,
)
from core.snapshot_manager import (
    save_snapshot,
    list_snapshots,
    load_snapshot,
    get_latest_snapshot,
    get_weekly_snapshot,
    compare_snapshots,
    format_snapshot_comparison,
)


# --- サンプル銘柄リスト ---
SAMPLE_JP_TICKERS = [
    "7203.T",   # トヨタ自動車
    "6758.T",   # ソニーグループ
    "9984.T",   # ソフトバンクグループ
    "6861.T",   # キーエンス
    "8035.T",   # 東京エレクトロン
    "4063.T",   # 信越化学工業
    "6098.T",   # リクルートHD
    "2413.T",   # エムスリー
    "4543.T",   # テルモ
    "7974.T",   # 任天堂
]

SAMPLE_US_TICKERS = [
    "NVDA",     # NVIDIA
    "MSFT",     # Microsoft
    "AAPL",     # Apple
    "GOOGL",    # Alphabet
    "META",     # Meta
    "AMZN",     # Amazon
    "AMD",      # AMD
    "TSLA",     # Tesla
    "AVGO",     # Broadcom
    "SMCI",     # Super Micro Computer
]


# -------------------------------------------------------
# インテント検出
# -------------------------------------------------------

def _detect_intent(query: str) -> str:
    """自然言語クエリからインテントを検出する"""
    q = query.lower()

    # スナップショット関連
    if any(k in q for k in ["スナップショット", "snapshot"]):
        if any(k in q for k in ["週次", "比較", "compare", "週"]):
            return "snapshot_compare"
        return "snapshot_save"

    # 週次比較
    if any(k in q for k in ["週次比較", "週次", "weekly"]):
        return "snapshot_compare"

    # レッスン管理
    if any(k in q for k in ["レッスン", "lesson", "失敗", "学び"]):
        if any(k in q for k in ["追加", "記録", "add"]):
            return "lesson_add"
        if any(k in q for k in ["一覧", "list", "見せて", "確認"]):
            return "lesson_list"
        return "lesson_list"

    # ポートフォリオ関連
    if any(k in q for k in ["ポートフォリオ", "保有", "portfolio", "調子"]):
        return "portfolio_health"

    # ウォッチリスト関連
    if any(k in q for k in ["ウォッチ", "watchlist", "監視"]):
        return "watchlist_health"

    # 個別レポート
    if any(k in q for k in ["レポート", "report", "分析", "見せて", "教えて"]):
        # 4桁数字（日本株コード）を優先的に探す
        jp_ticker = re.search(r'(\d{4})', query)
        if jp_ticker:
            return f"report:{jp_ticker.group(1)}.T"
        # アルファベットのティッカー（日本語文字が隣接する場合も対応）
        us_ticker = re.search(r'([A-Z]{2,5})', query.upper())
        if us_ticker:
            return f"report:{us_ticker.group(1)}"

    # 新高値ブレイク
    if any(k in q for k in ["新高値", "ブレイク", "break", "high"]):
        return "new_high_breakout"

    # 押し目買い
    if any(k in q for k in ["押し目", "dip", "買いチャンス", "値下がり"]):
        return "dip_buying"

    # AI関連
    if any(k in q for k in ["ai", "人工知能", "半導体", "クラウド", "成長株", "tech", "growth"]):
        return "ai_growth"

    return "unknown"


def _get_tickers_for_screening() -> list[str]:
    """スクリーニング対象銘柄を取得（ウォッチリスト + サンプル）"""
    watchlist = load_watchlist()
    wl_tickers = [item["ticker"] for item in watchlist]
    all_tickers = list(dict.fromkeys(wl_tickers + SAMPLE_JP_TICKERS + SAMPLE_US_TICKERS))
    return all_tickers


# -------------------------------------------------------
# 表示ヘルパー
# -------------------------------------------------------

def _fmt_price(price, currency="USD") -> str:
    if price is None:
        return "N/A"
    if currency == "JPY":
        return f"¥{price:,.0f}"
    return f"${price:,.2f}"


def _fmt_pct(val) -> str:
    if val is None:
        return "N/A"
    return f"{val:+.1f}%"


# -------------------------------------------------------
# スクリーニング表示
# -------------------------------------------------------

def print_screening_results(results: list[dict], preset: str) -> None:
    """スクリーニング結果を表示する（レッスン警告付き）"""
    preset_names = {
        "new_high_breakout": "新高値ブレイク",
        "dip_buying": "押し目買い",
        "ai_growth": "AI関連成長株",
    }
    print(f"\n{'='*60}")
    print(f"📊 スクリーニング結果: {preset_names.get(preset, preset)}")
    print(f"{'='*60}")

    if not results:
        print("該当銘柄なし")
        return

    for i, r in enumerate(results, 1):
        ticker = r["ticker"]
        currency = r.get("currency", "USD")

        # スクリーニングヒット回数をインクリメント
        hit_count = increment_screening_hit(ticker, preset)
        hot_flag = " 🔥" if hit_count >= 3 else ""

        print(f"\n{i}. {ticker} - {r['name']}{hot_flag}")
        if hit_count >= 3:
            print(f"   ※スクリーニング通算{hit_count}回ヒット（注目銘柄）")

        print(f"   現在値: {_fmt_price(r.get('current_price'), currency)}")

        if preset == "new_high_breakout":
            print(f"   52週高値比: {_fmt_pct((r.get('price_to_52w_ratio', 1) - 1) * 100)}")
            print(f"   出来高倍率: {r.get('volume_ratio', 'N/A')}x")
        elif preset == "dip_buying":
            print(f"   RSI: {r.get('rsi', 'N/A')}")
            print(f"   PER: {r.get('per', 'N/A')}")
            print(f"   200日MA: {_fmt_price(r.get('ma200'), currency)}")
            div = r.get('dividend_yield')
            if div:
                print(f"   配当利回り: {div*100:.1f}%")
        elif preset == "ai_growth":
            print(f"   売上成長率: {r.get('revenue_growth', 'N/A')}%")
            print(f"   粗利率: {r.get('gross_margin', 'N/A')}%")
            print(f"   PER: {r.get('per', 'N/A')}")

        if "value_score" in r:
            print(f"   スコア: {r['value_score']}/100")
        print(f"   セクター: {r.get('sector', 'N/A')}")

        # 過去レッスン警告
        # 新高値ブレイクの場合はrsi_overbought・new_highシグナルをチェック
        signals = {"new_high_breakout": ["new_high"], "dip_buying": ["rsi_oversold"]}.get(preset, [])
        warning = format_lesson_warnings(ticker, signals if signals else None)
        if warning:
            print(warning)


# -------------------------------------------------------
# ポートフォリオ表示
# -------------------------------------------------------

def print_portfolio_health(result: dict, show_snapshot_hint: bool = True) -> None:
    """ポートフォリオヘルスチェック結果を表示"""
    print(f"\n{'='*60}")
    print("💼 ポートフォリオ状況")
    print(f"{'='*60}")

    if "message" in result and not result.get("holdings"):
        print(result["message"])
        return

    for h in result["holdings"]:
        ticker = h["ticker"]
        pnl_sym = "▲" if h["pnl"] >= 0 else "▼"
        print(f"\n{ticker} - {h['name']}")
        print(f"  取得価格: {h['buy_price']:,.1f}  現在値: {h['current_price']:,.1f}")
        print(f"  損益: {pnl_sym}{abs(h['pnl']):,.0f} ({h['pnl_pct']:+.1f}%)")
        if h.get("from_52w_high_pct") is not None:
            print(f"  52週高値比: {h['from_52w_high_pct']:+.1f}%")

        # コンテキスト情報（テーゼ90日超の場合だけ表示）
        ctx = get_recommended_action(ticker)
        if ctx["relationship"] == "thesis_outdated":
            print(f"  ⏰ 取得から90日超 → 投資テーゼの見直しを推奨")

        # 過去レッスン警告
        warning = format_lesson_warnings(ticker)
        if warning:
            print(warning)

    s = result.get("summary", {})
    if s:
        pnl_sym = "▲" if s["total_pnl"] >= 0 else "▼"
        print(f"\n{'─'*40}")
        print(f"合計: {s['count']}銘柄  評価額: {s['total_value']:,.0f}")
        print(f"損益合計: {pnl_sym}{abs(s['total_pnl']):,.0f} ({s['total_pnl_pct']:+.1f}%)")

    if show_snapshot_hint:
        print(f"\n💡 「ポートフォリオのスナップショットを保存」で現時点を記録できます")


# -------------------------------------------------------
# ウォッチリスト表示
# -------------------------------------------------------

def print_watchlist_health(result: dict) -> None:
    """ウォッチリストヘルスチェック結果を表示"""
    print(f"\n{'='*60}")
    print("👀 ウォッチリスト状況")
    print(f"{'='*60}")

    if "message" in result:
        print(result["message"])
        return

    for item in result.get("watchlist", []):
        ticker = item["ticker"]
        print(f"\n{ticker} - {item['name']}")
        print(f"  追加日: {item.get('added_date', 'N/A')}  理由: {item.get('reason', '')}")
        if item.get("current_price"):
            print(f"  現在値: {item['current_price']:,.2f}")
        if item.get("from_52w_high_pct") is not None:
            print(f"  52週高値比: {item['from_52w_high_pct']:+.1f}%")
        if item.get("gap_to_target_pct") is not None:
            print(f"  目標価格まで: {item['gap_to_target_pct']:+.1f}%")

        # 過去レッスン警告
        warning = format_lesson_warnings(ticker)
        if warning:
            print(warning)


# -------------------------------------------------------
# 個別レポート表示
# -------------------------------------------------------

def print_stock_report(result: dict, ticker: str = "") -> None:
    """個別レポートを表示（コンテキストヘッダー + 差分 + 警告付き）"""
    if "error" in result:
        print(f"\nエラー: {result['error']}")
        return

    t_code = result.get("ticker", ticker)

    # ── Phase 2: コンテキストヘッダー ──
    print(format_context_header(t_code))

    # 過去データとの差分
    past = load_past_analysis(t_code)
    if past and past.get("current_price"):
        diff = calc_diff(past, result)
        if diff:
            price_diff = diff.get("current_price", {})
            if price_diff:
                chg = price_diff.get("change_pct", 0)
                sym = "▲" if chg >= 0 else "▼"
                print(f"\n📈 前回比: 株価 {sym}{abs(chg):.1f}%  "
                      f"({price_diff['old']:.2f} → {price_diff['new']:.2f})")

    # ── 通常レポート本体 ──
    currency = result.get("currency", "USD")
    print(f"\n{'='*60}")
    print(f"📋 {result['ticker']} - {result['name']}")
    print(f"{'='*60}")
    print(f"セクター: {result.get('sector')} / {result.get('industry')}")
    print(f"現在値: {_fmt_price(result.get('current_price'), currency)}")

    t = result.get("technicals", {})
    print(f"\n【テクニカル】")
    print(f"  52週高値: {_fmt_price(t.get('week52_high'), currency)}")
    print(f"  52週安値: {_fmt_price(t.get('week52_low'), currency)}")
    print(f"  MA50: {_fmt_price(t.get('ma50'), currency)}")
    print(f"  MA200: {_fmt_price(t.get('ma200'), currency)}")
    print(f"  RSI(14): {t.get('rsi_14', 'N/A')}")

    f = result.get("fundamentals", {})
    print(f"\n【ファンダメンタルズ】")
    print(f"  PER(実績): {f.get('per', 'N/A')}")
    print(f"  PER(予想): {f.get('forward_per', 'N/A')}")
    print(f"  PBR: {f.get('pbr', 'N/A')}")
    roe_val = f.get('roe')
    print(f"  ROE: {_fmt_pct(roe_val * 100) if roe_val else 'N/A'}")
    div = f.get("dividend_yield")
    print(f"  配当利回り: {f'{div*100:.1f}%' if div else 'N/A'}")
    rev_g = f.get("revenue_growth")
    print(f"  売上成長率: {f'{rev_g*100:.1f}%' if rev_g else 'N/A'}")
    gm = f.get("gross_margins")
    print(f"  粗利率: {f'{gm*100:.1f}%' if gm else 'N/A'}")

    a = result.get("analyst", {})
    print(f"\n【アナリスト】")
    print(f"  推奨: {a.get('recommendation', 'N/A')}  人数: {a.get('count', 0)}")
    print(f"  目標株価(平均): {_fmt_price(a.get('target_mean'), currency)}")
    print(f"  目標株価(高): {_fmt_price(a.get('target_high'), currency)}")
    print(f"  目標株価(低): {_fmt_price(a.get('target_low'), currency)}")
    if a.get("spread_note"):
        print(f"  ⚠ スプレッド: {a['spread_note']}")

    desc = result.get("description", "")
    if desc:
        print(f"\n【概要】\n{desc}...")

    # ── Phase 2: 過去レッスン警告 ──
    warning = format_lesson_warnings(t_code)
    if warning:
        print(warning)

    # ── Phase 2: 分析結果を保存 ──
    save_analysis(t_code, {
        "current_price": result.get("current_price"),
        "technicals": result.get("technicals", {}),
        "fundamentals": result.get("fundamentals", {}),
    })


# -------------------------------------------------------
# スナップショット
# -------------------------------------------------------

def handle_snapshot_save() -> None:
    """スナップショットを保存する"""
    snap = save_snapshot()
    s = snap.get("summary", {})
    print(f"\n✅ スナップショットを保存しました: {snap['label']}")
    print(f"   日時: {snap['date']} {snap['time']}")
    if s:
        pnl_sym = "▲" if (s.get("total_pnl") or 0) >= 0 else "▼"
        print(f"   銘柄数: {s.get('count', 0)}")
        val = s.get("total_value")
        if val:
            print(f"   評価額: {val:,.0f}")
        pnl = s.get("total_pnl")
        if pnl is not None:
            print(f"   損益: {pnl_sym}{abs(pnl):,.0f} ({s.get('total_pnl_pct', 0):+.1f}%)")


def handle_snapshot_compare() -> None:
    """週次比較を表示する"""
    snaps = list_snapshots(limit=20)
    if len(snaps) < 2:
        print("\n比較するスナップショットが不足しています（2件以上必要）")
        print("先に「ポートフォリオのスナップショットを保存」を実行してください")
        return

    # 最新と7日前（または最古）のスナップショットを比較
    snap_new = load_snapshot(snaps[0]["label"])
    weekly = get_weekly_snapshot()
    snap_old = weekly if weekly and weekly.get("label") != snap_new.get("label") else load_snapshot(snaps[-1]["label"])

    if not snap_old or not snap_new:
        print("\nスナップショットの読み込みに失敗しました")
        return

    comparison = compare_snapshots(snap_old, snap_new)
    print(format_snapshot_comparison(comparison))

    # スナップショット一覧も表示
    print(f"\n📋 保存済みスナップショット ({len(snaps)}件):")
    for s in snaps[:5]:
        val = s.get("total_value")
        pnl_pct = s.get("total_pnl_pct")
        val_str = f"  評価額: {val:,.0f}" if val else ""
        pnl_str = f"  損益: {pnl_pct:+.1f}%" if pnl_pct is not None else ""
        print(f"  [{s['date']} {s['time']}] {s['label']}{val_str}{pnl_str}")


# -------------------------------------------------------
# レッスン管理
# -------------------------------------------------------

def handle_lesson_add(query: str) -> None:
    """レッスンをテキストから追加する"""
    # "レッスンを追加 <ticker> <trigger> <lesson> [next_action]" の形式を解析
    parts = query.split()

    # コマンドワードを除去
    skip_words = {"レッスン", "lesson", "を", "追加", "記録", "add"}
    cleaned = [p for p in parts if p.lower() not in skip_words]

    if len(cleaned) < 3:
        print("\n⚠ レッスン追加の形式:")
        print("  python3 main.py \"レッスンを追加 [銘柄] [トリガー] [学んだこと] [次回対応（省略可）]\"")
        print("\n例:")
        print("  python3 main.py \"レッスンを追加 7974 RSI70超で高値掴み 次はRSI60以下を待つ\"")
        return

    ticker = cleaned[0]
    trigger = cleaned[1]
    lesson = cleaned[2]
    next_action = " ".join(cleaned[3:]) if len(cleaned) > 3 else ""

    record = add_lesson(ticker=ticker, trigger=trigger, lesson=lesson, next_action=next_action)
    print(f"\n✅ レッスンを記録しました")
    print(f"   銘柄: {record['ticker']}  日付: {record['date']}")
    print(f"   トリガー: {record['trigger']}")
    print(f"   学び: {record['lesson']}")
    if record.get("next_action"):
        print(f"   次回対応: {record['next_action']}")


def handle_lesson_list() -> None:
    """レッスン一覧を表示する"""
    lessons = list_all_lessons(limit=20)
    print(f"\n{'='*60}")
    print(f"📚 過去レッスン一覧 ({len(lessons)}件)")
    print(f"{'='*60}")

    if not lessons:
        print("記録がありません")
        print("例: python3 main.py \"レッスンを追加 NVDA RSI70超で高値掴み 次はRSI60以下を待つ\"")
        return

    for l in lessons:
        sev_sym = "🔴" if "損切り" in l.get("trigger", "") or "高値掴み" in l.get("trigger", "") else "🟡"
        print(f"\n{sev_sym} #{l.get('id')} [{l['date']}] {l['ticker_raw']}")
        print(f"   トリガー: {l['trigger']}")
        print(f"   学び: {l['lesson']}")
        if l.get("next_action"):
            print(f"   次回対応: {l['next_action']}")


# -------------------------------------------------------
# メイン実行
# -------------------------------------------------------

def run(query: str, tickers: list[str] = None) -> None:
    """自然言語クエリを解析して処理を実行する"""
    intent = _detect_intent(query)

    # ── スナップショット ──
    if intent == "snapshot_save":
        handle_snapshot_save()

    elif intent == "snapshot_compare":
        handle_snapshot_compare()

    # ── レッスン管理 ──
    elif intent == "lesson_add":
        handle_lesson_add(query)

    elif intent == "lesson_list":
        handle_lesson_list()

    # ── ポートフォリオ ──
    elif intent == "portfolio_health":
        result = check_portfolio_health()
        print_portfolio_health(result)

    # ── ウォッチリスト ──
    elif intent == "watchlist_health":
        result = check_watchlist_health()
        print_watchlist_health(result)

    # ── 個別レポート ──
    elif intent.startswith("report:"):
        ticker = intent.split(":", 1)[1]

        # フェッチモード判定
        ctx = get_recommended_action(ticker)
        fetch_mode = ctx["fetch_mode"]

        if fetch_mode == "skip":
            # キャッシュ利用（生データから表示）
            past = load_past_analysis(ticker)
            if past:
                print(f"\n🟢 キャッシュデータを使用（24時間以内）")
                # それでも新鮮なレポートとして生成
                use_cache = True
            else:
                use_cache = False
        else:
            use_cache = (fetch_mode == "diff")  # diffの場合はキャッシュ優先

        result = generate_stock_report(ticker)
        print_stock_report(result, ticker=ticker)

    # ── スクリーニング ──
    elif intent in ("new_high_breakout", "dip_buying", "ai_growth"):
        target_tickers = tickers or _get_tickers_for_screening()
        print(f"🔍 {len(target_tickers)}銘柄をスクリーニング中...")
        results = run_preset(intent, target_tickers)

        # スコアリング
        if intent in ("dip_buying", "ai_growth") and results:
            results = score_and_rank(results, intent)

        print_screening_results(results, intent)
        print(f"\n合計 {len(results)} 銘柄がヒットしました")

    else:
        print("コマンドを認識できませんでした。")
        print()
        print("📊 スクリーニング:")
        print("  新高値ブレイクの銘柄を探して")
        print("  押し目買いチャンスは？")
        print("  AI関連で割安なやつある？")
        print()
        print("📋 レポート:")
        print("  7203のレポートを見せて")
        print("  NVDAのレポートを見せて")
        print()
        print("💼 ポートフォリオ・ウォッチリスト:")
        print("  ポートフォリオの調子は？")
        print("  ウォッチリストを確認して")
        print()
        print("📸 スナップショット:")
        print("  ポートフォリオのスナップショットを保存")
        print("  週次比較を見せて")
        print()
        print("📚 レッスン管理:")
        print("  レッスン一覧")
        print("  レッスンを追加 NVDA RSI70超で高値掴み 次はRSI60以下を待つ")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    query = " ".join(sys.argv[1:])
    run(query)
