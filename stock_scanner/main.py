"""
main.py - 日本株 上昇トレンド開始スキャナー + 保有銘柄モニター + セクター強弱
"""

import argparse
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path

# ──────────────────────────────────────────────
# 自モジュール
# ──────────────────────────────────────────────
from data_fetch import JQuantsClient, fetch_universe
from indicators import calc_all
from screener import screen_all
from notify import print_screen_summary
from holdings import load_holdings, apply_prices, print_holdings_report
from sector_monitor import (
    calc_sector_returns,
    get_holding_sector_ranks,
    print_sector_report,
)


# ──────────────────────────────────────────────
# ロギング設定
# ──────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

SEPARATOR = "=" * 60


# ──────────────────────────────────────────────
# ウォッチリスト表示
# ──────────────────────────────────────────────

def print_watchlist(watchlist_path: Path, screen_results_map: dict) -> None:
    """watchlist.csv を読み込んでスクリーニング結果と突き合わせて表示"""
    import pandas as pd

    if not watchlist_path.exists():
        logger.warning(f"watchlist.csv が見つかりません: {watchlist_path}")
        return

    df = pd.read_csv(watchlist_path, dtype=str)
    df.columns = [c.strip() for c in df.columns]

    themes = df.get("テーマ", df.get("theme", pd.Series(dtype=str)))
    theme_groups = df.groupby(themes) if themes is not None and "テーマ" in df.columns else None

    print(f"\n{SEPARATOR}")
    print("  👀 監視銘柄リスト")
    print(SEPARATOR)

    for _, row in df.iterrows():
        code = str(row["銘柄コード"]).strip()
        name = str(row.get("銘柄名", code)).strip()
        theme = str(row.get("テーマ", "")).strip()
        reason = str(row.get("選定理由", "")).strip()

        sr = screen_results_map.get(code)
        score_str = f"スコア{sr.score}点 {sr.signal}" if sr else "データなし"

        print(f"  {code}  {name}  [{theme}]  {score_str}")
        if reason:
            print(f"       💡 {reason}")

    print(f"\n{SEPARATOR}\n")


# ──────────────────────────────────────────────
# メイン処理
# ──────────────────────────────────────────────

def main(args: argparse.Namespace) -> None:
    today = datetime.today().strftime("%Y-%m-%d")
    logger.info(f"スキャン開始: {today}")
    print(f"\n{'#' * 60}")
    print(f"  🇯🇵 日本株 上昇トレンドスキャナー  {today}")
    print(f"{'#' * 60}")

    # ──────────────────────────────────────────
    # 1. データ取得
    # ──────────────────────────────────────────
    client = JQuantsClient()

    lookback = args.lookback
    listed_df, prices_raw = fetch_universe(
        client,
        lookback_days=lookback,
        reference_date=args.date or today,
    )

    # ──────────────────────────────────────────
    # 2. インジケータ計算
    # ──────────────────────────────────────────
    logger.info("インジケータ計算中...")
    prices_dict: dict = {}
    for code, df in prices_raw.items():
        calc_df = calc_all(df)
        if not calc_df.empty:
            prices_dict[code] = calc_df
    logger.info(f"インジケータ計算完了: {len(prices_dict)} 銘柄")

    # ──────────────────────────────────────────
    # 3. 保有銘柄モニター
    # ──────────────────────────────────────────
    holdings_path = Path(__file__).parent / "holdings.csv"
    holdings = load_holdings(holdings_path)
    if holdings:
        holdings = apply_prices(holdings, prices_dict)
        print_holdings_report(holdings)
    else:
        print("  （holdings.csv に保有銘柄が登録されていません）\n")

    # ──────────────────────────────────────────
    # 4. セクター強弱モニター
    # ──────────────────────────────────────────
    sector_ranks = calc_sector_returns(listed_df, prices_dict)
    holding_codes = [h.code for h in holdings]
    holding_sector_map = get_holding_sector_ranks(holding_codes, listed_df, sector_ranks)
    holding_names = {h.code: h.name for h in holdings}
    print_sector_report(sector_ranks, holding_sector_map, holding_names)

    # ──────────────────────────────────────────
    # 5. ウォッチリスト表示
    # ──────────────────────────────────────────
    watchlist_path = Path(__file__).parent / "watchlist.csv"
    # スクリーニング結果を code → ScreenResult のマップに変換
    screen_results_map: dict = {}

    # ウォッチリストのコードのみ先行スクリーニング（全件前に概況把握用）
    import pandas as pd
    if watchlist_path.exists():
        wl_df = pd.read_csv(watchlist_path, dtype=str)
        wl_df.columns = [c.strip() for c in wl_df.columns]
        wl_codes = wl_df["銘柄コード"].str.strip().tolist() if "銘柄コード" in wl_df.columns else []

        from screener import screen_single
        for code in wl_codes:
            df = prices_dict.get(code)
            if df is not None:
                name = wl_df.loc[wl_df["銘柄コード"].str.strip() == code, "銘柄名"]
                name_str = name.iloc[0] if not name.empty else code
                r = screen_single(code, name_str, df)
                if r:
                    screen_results_map[code] = r

    print_watchlist(watchlist_path, screen_results_map)

    # ──────────────────────────────────────────
    # 6. 全銘柄スクリーニング（オプションで制限可）
    # ──────────────────────────────────────────
    if not args.no_screen:
        min_score = args.min_score
        logger.info(f"スクリーニング実行中（最小スコア: {min_score}）...")
        results = screen_all(listed_df, prices_dict, min_score=min_score)
        print_screen_summary(results)
    else:
        print("  （全銘柄スクリーニングはスキップ: --no-screen）\n")


# ──────────────────────────────────────────────
# CLI エントリポイント
# ──────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="日本株 上昇トレンド開始スキャナー"
    )
    parser.add_argument(
        "--date",
        type=str,
        default=None,
        help="基準日 (YYYY-MM-DD)。省略時は今日",
    )
    parser.add_argument(
        "--lookback",
        type=int,
        default=150,
        help="価格データ取得日数（デフォルト: 150日）",
    )
    parser.add_argument(
        "--min-score",
        type=int,
        default=4,
        dest="min_score",
        help="スクリーニング最小スコア（デフォルト: 4）",
    )
    parser.add_argument(
        "--no-screen",
        action="store_true",
        help="全銘柄スクリーニングをスキップ（保有銘柄・セクター確認のみ）",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        main(args)
    except KeyboardInterrupt:
        print("\n中断しました")
        sys.exit(0)
    except Exception as e:
        logger.error(f"エラー: {e}", exc_info=True)
        sys.exit(1)
