"""
sector_monitor.py - 東証33業種 セクター強弱モニター

J-Quants listed/info の Sector33Code / Sector33CodeName を使用。
"""

import logging
from dataclasses import dataclass

import pandas as pd

logger = logging.getLogger(__name__)

SEPARATOR = "=" * 60
TOP_N = 3   # 上位/下位表示件数
LOOKBACK_DAYS = 5  # 騰落率算出期間（営業日）


# ──────────────────────────────────────────────
# データクラス
# ──────────────────────────────────────────────

@dataclass
class SectorRank:
    rank: int
    sector_code: str
    sector_name: str
    change_pct: float   # 5日騰落率 (%)
    stock_count: int    # 構成銘柄数


# ──────────────────────────────────────────────
# セクター騰落率計算
# ──────────────────────────────────────────────

def calc_sector_returns(
    listed_df: pd.DataFrame,
    prices_dict: dict,
    lookback: int = LOOKBACK_DAYS,
) -> list[SectorRank]:
    """
    33業種ごとの騰落率を計算してランキングリストを返す（降順）。

    Args:
        listed_df: get_listed_info() の結果（Sector33Code, Sector33CodeName 列が必要）
        prices_dict: {code: 価格DataFrame}
        lookback: 何営業日前との比較か

    Returns:
        SectorRank のリスト（騰落率降順）
    """
    if "Sector33Code" not in listed_df.columns or "Sector33CodeName" not in listed_df.columns:
        logger.warning("listed_df に Sector33Code / Sector33CodeName 列がありません")
        return []

    # code → (sector_code, sector_name) のマップ
    sector_map: dict[str, tuple[str, str]] = {}
    for _, row in listed_df.iterrows():
        code = str(row["Code"]).strip()
        sc   = str(row["Sector33Code"]).strip()
        sn   = str(row["Sector33CodeName"]).strip()
        sector_map[code] = (sc, sn)

    # セクターごとに各銘柄の騰落率を集計
    sector_returns: dict[str, list[float]] = {}
    sector_names: dict[str, str] = {}

    for code, df in prices_dict.items():
        pair = sector_map.get(str(code))
        if pair is None:
            continue
        sc, sn = pair
        sector_names[sc] = sn

        if df.empty or len(df) < lookback + 1:
            continue

        close_col = "AdjustmentClose" if "AdjustmentClose" in df.columns else "Close"
        closes = df[close_col].dropna()
        if len(closes) < lookback + 1:
            continue

        price_now  = closes.iloc[-1]
        price_prev = closes.iloc[-(lookback + 1)]
        if price_prev == 0:
            continue

        ret = (price_now - price_prev) / price_prev * 100
        sector_returns.setdefault(sc, []).append(ret)

    # セクターごとの平均騰落率でランキング
    ranked = []
    for rank_i, (sc, rets) in enumerate(
        sorted(sector_returns.items(), key=lambda x: sum(x[1]) / len(x[1]), reverse=True),
        start=1,
    ):
        avg_ret = sum(rets) / len(rets)
        ranked.append(
            SectorRank(
                rank=rank_i,
                sector_code=sc,
                sector_name=sector_names.get(sc, sc),
                change_pct=avg_ret,
                stock_count=len(rets),
            )
        )

    return ranked


# ──────────────────────────────────────────────
# 保有銘柄のセクター順位取得
# ──────────────────────────────────────────────

def get_holding_sector_ranks(
    holding_codes: list[str],
    listed_df: pd.DataFrame,
    sector_ranks: list[SectorRank],
) -> dict[str, SectorRank | None]:
    """
    保有銘柄コードごとに属するセクターの SectorRank を返す。

    Returns:
        {code: SectorRank or None}
    """
    code_to_sector: dict[str, str] = {}
    if "Sector33Code" in listed_df.columns:
        for _, row in listed_df.iterrows():
            code_to_sector[str(row["Code"]).strip()] = str(row["Sector33Code"]).strip()

    rank_map: dict[str, SectorRank] = {r.sector_code: r for r in sector_ranks}

    result: dict[str, SectorRank | None] = {}
    for code in holding_codes:
        sc = code_to_sector.get(code)
        result[code] = rank_map.get(sc) if sc else None

    return result


# ──────────────────────────────────────────────
# 出力
# ──────────────────────────────────────────────

def print_sector_report(
    sector_ranks: list[SectorRank],
    holding_sector_map: dict[str, SectorRank | None] | None = None,
    holding_names: dict[str, str] | None = None,
    top_n: int = TOP_N,
) -> None:
    """セクター強弱レポートを出力"""
    total = len(sector_ranks)
    if total == 0:
        print("  セクターデータなし")
        return

    print(f"\n{SEPARATOR}")
    print(f"  📈 今週強いセクター TOP{top_n}")
    print(SEPARATOR)
    for r in sector_ranks[:top_n]:
        sign = "+" if r.change_pct >= 0 else ""
        print(f"  {r.rank}位: {r.sector_name}  {sign}{r.change_pct:.1f}%  ({r.stock_count}銘柄)")

    print(f"\n{SEPARATOR}")
    print(f"  📉 今週弱いセクター BOTTOM{top_n}")
    print(SEPARATOR)
    for r in sector_ranks[-top_n:][::-1]:
        sign = "+" if r.change_pct >= 0 else ""
        print(f"  {r.rank}位/{total}位: {r.sector_name}  {sign}{r.change_pct:.1f}%  ({r.stock_count}銘柄)")

    # 保有銘柄のセクター順位
    if holding_sector_map:
        print(f"\n{SEPARATOR}")
        print("  🏦 保有銘柄 セクター順位")
        print(SEPARATOR)
        for code, sr in holding_sector_map.items():
            name = (holding_names or {}).get(code, code)
            if sr is None:
                print(f"  {code} {name}: セクター情報なし")
            else:
                sign = "+" if sr.change_pct >= 0 else ""
                print(
                    f"  {code} {name}: {sr.sector_name}"
                    f"  {sr.rank}位/{total}位  {sign}{sr.change_pct:.1f}%"
                )

    print(f"\n{SEPARATOR}\n")
