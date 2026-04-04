"""
holdings.py - 保有銘柄モニター機能

holdings.csv フォーマット:
  銘柄コード,銘柄名,保有数量,取得単価
"""

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

HOLDINGS_CSV = Path(__file__).parent / "holdings.csv"
SEPARATOR = "=" * 60


# ──────────────────────────────────────────────
# データクラス
# ──────────────────────────────────────────────

@dataclass
class HoldingStatus:
    code: str
    name: str
    quantity: int
    cost_price: float

    current_price: Optional[float] = None
    ma75: Optional[float] = None
    below_ma75_days: int = 0

    @property
    def cost_total(self) -> float:
        return self.cost_price * self.quantity

    @property
    def current_total(self) -> Optional[float]:
        if self.current_price is None:
            return None
        return self.current_price * self.quantity

    @property
    def pnl(self) -> Optional[float]:
        if self.current_total is None:
            return None
        return self.current_total - self.cost_total

    @property
    def pnl_pct(self) -> Optional[float]:
        if self.pnl is None or self.cost_total == 0:
            return None
        return self.pnl / self.cost_total * 100

    @property
    def ma_position(self) -> str:
        """75日MA との位置関係"""
        if self.current_price is None or self.ma75 is None:
            return "不明"
        return "【上】" if self.current_price >= self.ma75 else "【下】"

    @property
    def is_alert(self) -> bool:
        """3日連続 MA 割れアラート"""
        return self.below_ma75_days >= 3


# ──────────────────────────────────────────────
# CSV 読み込み
# ──────────────────────────────────────────────

def load_holdings(path: Path = HOLDINGS_CSV) -> list[HoldingStatus]:
    """holdings.csv を読み込んで HoldingStatus のリストを返す"""
    if not path.exists():
        logger.warning(f"holdings.csv が見つかりません: {path}")
        return []

    df = pd.read_csv(path, dtype=str)
    # 列名正規化（前後スペース除去）
    df.columns = [c.strip() for c in df.columns]

    required = {"銘柄コード", "保有数量", "取得単価"}
    if not required.issubset(set(df.columns)):
        raise ValueError(f"holdings.csv に必要な列がありません。必要列: {required}")

    holdings = []
    for _, row in df.iterrows():
        code = str(row["銘柄コード"]).strip()
        name = str(row.get("銘柄名", code)).strip()
        try:
            qty = int(float(str(row["保有数量"]).replace(",", "")))
            cost = float(str(row["取得単価"]).replace(",", ""))
        except ValueError:
            logger.warning(f"保有数量/取得単価のパース失敗: {row.to_dict()}")
            continue
        holdings.append(HoldingStatus(code=code, name=name, quantity=qty, cost_price=cost))

    return holdings


# ──────────────────────────────────────────────
# 価格・インジケータ適用
# ──────────────────────────────────────────────

def _count_below_ma75(df: pd.DataFrame) -> int:
    """直近何日連続で 75日MA を下回っているか数える"""
    if "MA75" not in df.columns or df.empty:
        return 0

    count = 0
    for i in range(len(df) - 1, -1, -1):
        row = df.iloc[i]
        if pd.isna(row["Close"]) or pd.isna(row["MA75"]):
            break
        if row["Close"] < row["MA75"]:
            count += 1
        else:
            break
    return count


def apply_prices(
    holdings: list[HoldingStatus],
    prices_dict: dict,
) -> list[HoldingStatus]:
    """
    prices_dict（指標計算済み）から各保有銘柄に現在値・MA75・MA割れ日数を設定。

    Args:
        holdings: load_holdings() の結果
        prices_dict: {code: DataFrame with MA75 column}

    Returns:
        更新済み HoldingStatus リスト
    """
    for h in holdings:
        df = prices_dict.get(h.code)
        if df is None or df.empty:
            logger.warning(f"{h.code}: 価格データなし")
            continue

        last = df.iloc[-1]
        h.current_price = last["Close"] if pd.notna(last["Close"]) else None

        if "MA75" in df.columns:
            h.ma75 = last["MA75"] if pd.notna(last["MA75"]) else None

        h.below_ma75_days = _count_below_ma75(df)

    return holdings


# ──────────────────────────────────────────────
# 出力
# ──────────────────────────────────────────────

def print_holdings_report(holdings: list[HoldingStatus]) -> None:
    """保有銘柄アラートを出力"""
    print(f"\n{SEPARATOR}")
    print("  📦 保有銘柄アラート")
    print(SEPARATOR)

    if not holdings:
        print("  保有銘柄なし（holdings.csv を確認してください）")
        return

    total_cost = 0.0
    total_current = 0.0

    for h in holdings:
        price_str = f"{h.current_price:,.0f}円" if h.current_price is not None else "取得不可"
        cost_str  = f"{h.cost_price:,.2f}円"

        pnl_str = ""
        if h.pnl is not None:
            sign = "+" if h.pnl >= 0 else ""
            emoji = "📈" if h.pnl >= 0 else "📉"
            pnl_str = f" | {emoji} 評価損益 {sign}{h.pnl:,.0f}円 ({sign}{h.pnl_pct:.1f}%)"

        ma75_str = f"{h.ma75:,.0f}円" if h.ma75 is not None else "N/A"

        print(f"\n  {h.code}  {h.name}")
        print(f"  現在 {price_str} | 取得 {cost_str}{pnl_str}")
        print(f"  75日MA: {ma75_str} | 現在値はMAの{h.ma_position} | MA割れ{h.below_ma75_days}日目")

        if h.is_alert:
            print(f"  🚨 3日連続MA割れ：損切り検討ラインです")

        if h.current_total is not None:
            total_cost += h.cost_total
            total_current += h.current_total

    # ポートフォリオ合計
    if total_cost > 0:
        total_pnl = total_current - total_cost
        total_pnl_pct = total_pnl / total_cost * 100
        sign = "+" if total_pnl >= 0 else ""
        print(f"\n  {'─' * 40}")
        print(f"  📊 ポートフォリオ合計")
        print(f"  評価額: {total_current:,.0f}円 | 取得額: {total_cost:,.0f}円")
        print(f"  損益合計: {sign}{total_pnl:,.0f}円 ({sign}{total_pnl_pct:.1f}%)")

    print(f"\n{SEPARATOR}\n")
