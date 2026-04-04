"""
screener.py - スクリーニング条件判定・スコアリング
"""

from dataclasses import dataclass, field
from typing import Optional

import pandas as pd
import numpy as np


# ──────────────────────────────────────────────
# 結果データクラス
# ──────────────────────────────────────────────

@dataclass
class ScreenResult:
    code: str
    name: str
    score: int = 0

    # Layer1 移動平均
    gc_within_3d: bool = False    # 25MA/75MA GC が3営業日以内
    price_above_ma: bool = False  # 株価が25MA・75MA両方を上回り

    # Layer2 ADX/DMI
    adx_above_20: bool = False    # ADX >= 20
    adx_rising: bool = False      # ADX 上向き
    di_cross_5d: bool = False     # +DI > -DI かつ GCから5日以内

    # Layer3 MACD
    macd_gc_5d: bool = False      # MACD GC から5日以内
    macd_gc_near_zero: bool = False  # GC がマイナス〜ゼロ付近

    # Layer4 RSI
    rsi_in_range: bool = False    # RSI 45〜65

    # Layer5 出来高
    volume_surge: bool = False    # 直近3日平均 / 20日平均 >= 1.5

    # 参考値
    current_price: Optional[float] = None
    rsi_value: Optional[float] = None
    adx_value: Optional[float] = None
    macd_value: Optional[float] = None

    @property
    def signal(self) -> str:
        if self.score >= 7:
            return "🔴 強買いシグナル"
        elif self.score >= 5:
            return "🟡 要注目"
        else:
            return "⚪ 見送り"


# ──────────────────────────────────────────────
# ユーティリティ
# ──────────────────────────────────────────────

def _find_cross(series_a: pd.Series, series_b: pd.Series, window: int) -> int:
    """
    series_a が series_b を下から上抜け（ゴールデンクロス）した直近のインデックス位置
    を返す。直近 window 本内に存在しなければ -1 を返す。
    インデックス位置は末尾を 0 として遡る日数。
    """
    n = len(series_a)
    for i in range(1, min(window + 1, n)):
        idx = n - 1 - i
        if idx < 1:
            break
        prev_above = series_a.iloc[idx - 1] >= series_b.iloc[idx - 1]
        curr_above = series_a.iloc[idx] > series_b.iloc[idx]
        if curr_above and not prev_above:
            return i  # i 日前にクロス
    return -1


# ──────────────────────────────────────────────
# メインスクリーニング
# ──────────────────────────────────────────────

def screen_single(code: str, name: str, df: pd.DataFrame) -> Optional[ScreenResult]:
    """
    1銘柄をスクリーニングして ScreenResult を返す。
    データ不足など評価不能の場合は None を返す。
    """
    required_cols = ["Close", "High", "Low", "Volume",
                     "MA25", "MA75", "RSI",
                     "MACD", "MACD_Signal",
                     "ADX", "DI_Plus", "DI_Minus"]

    if df.empty or len(df) < 20:
        return None
    for col in required_cols:
        if col not in df.columns or df[col].isna().all():
            return None

    # 最終行（最新）
    last = df.iloc[-1]
    result = ScreenResult(code=code, name=name)
    result.current_price = last["Close"]
    result.rsi_value = last["RSI"]
    result.adx_value = last["ADX"]
    result.macd_value = last["MACD"]

    # ──────────────────────────────────────────
    # Layer1 移動平均（2点）
    # ──────────────────────────────────────────

    # 25MA / 75MA GC が3営業日以内
    gc_days = _find_cross(df["MA25"], df["MA75"], window=4)  # 直近3日以内 = 1〜3日前
    if 1 <= gc_days <= 3:
        result.gc_within_3d = True

    # 株価が25MA・75MA 両方を上回り
    if pd.notna(last["MA25"]) and pd.notna(last["MA75"]):
        if last["Close"] > last["MA25"] and last["Close"] > last["MA75"]:
            result.price_above_ma = True

    result.score += (1 if result.gc_within_3d else 0) + (1 if result.price_above_ma else 0)

    # ──────────────────────────────────────────
    # Layer2 ADX/DMI（3点）
    # ──────────────────────────────────────────

    if pd.notna(last["ADX"]):
        # ADX >= 20
        if last["ADX"] >= 20:
            result.adx_above_20 = True

        # ADX 上向き（直近2本比較）
        if len(df) >= 2:
            prev_adx = df["ADX"].iloc[-2]
            if pd.notna(prev_adx) and last["ADX"] > prev_adx:
                result.adx_rising = True

    # +DI が -DI を上回り、かつ直近クロスから5日以内
    if pd.notna(last["DI_Plus"]) and pd.notna(last["DI_Minus"]):
        if last["DI_Plus"] > last["DI_Minus"]:
            cross_day = _find_cross(df["DI_Plus"], df["DI_Minus"], window=6)
            if 1 <= cross_day <= 5:
                result.di_cross_5d = True

    result.score += (
        (1 if result.adx_above_20 else 0)
        + (1 if result.adx_rising else 0)
        + (1 if result.di_cross_5d else 0)
    )

    # ──────────────────────────────────────────
    # Layer3 MACD（2点）
    # ──────────────────────────────────────────

    macd_gc_day = _find_cross(df["MACD"], df["MACD_Signal"], window=6)

    # MACD GC から5日以内
    if 1 <= macd_gc_day <= 5:
        result.macd_gc_5d = True

    # GC がマイナス〜ゼロ付近（GC 発生日の MACD 値が -0.5% 〜 +0.1% の価格比率）
    if result.macd_gc_5d:
        gc_idx = len(df) - 1 - macd_gc_day
        if 0 <= gc_idx < len(df):
            macd_at_gc = df["MACD"].iloc[gc_idx]
            close_at_gc = df["Close"].iloc[gc_idx]
            if pd.notna(macd_at_gc) and pd.notna(close_at_gc) and close_at_gc > 0:
                ratio = macd_at_gc / close_at_gc * 100  # %
                if -0.5 <= ratio <= 0.1:
                    result.macd_gc_near_zero = True

    result.score += (1 if result.macd_gc_5d else 0) + (1 if result.macd_gc_near_zero else 0)

    # ──────────────────────────────────────────
    # Layer4 RSI（1点）
    # ──────────────────────────────────────────

    rsi_series = df["RSI"].dropna()
    if len(rsi_series) >= 2:
        rsi_now = rsi_series.iloc[-1]
        # RSI 45〜65 かつ 直近5日以内に 50 を下から上抜け
        if 45 <= rsi_now <= 65:
            # 50 クロスチェック
            window_rsi = rsi_series.iloc[-6:]  # 最大6本
            for i in range(len(window_rsi) - 1, 0, -1):
                if window_rsi.iloc[i] >= 50 > window_rsi.iloc[i - 1]:
                    result.rsi_in_range = True
                    break

    result.score += 1 if result.rsi_in_range else 0

    # ──────────────────────────────────────────
    # Layer5 出来高（2点）
    # ──────────────────────────────────────────

    vol_col = "AdjustmentVolume" if "AdjustmentVolume" in df.columns else "Volume"
    vol_series = df[vol_col].dropna()
    if len(vol_series) >= 20:
        vol_3d = vol_series.iloc[-3:].mean()
        vol_20d = vol_series.iloc[-20:].mean()
        if vol_20d > 0 and vol_3d / vol_20d >= 1.5:
            result.volume_surge = True

    result.score += 2 if result.volume_surge else 0

    return result


def screen_all(
    listed_df: pd.DataFrame,
    prices_dict: dict,
    min_score: int = 0,
) -> list[ScreenResult]:
    """
    全銘柄をスクリーニングしてスコア降順で返す。

    Args:
        listed_df: 銘柄一覧 DataFrame（Code, CompanyName 列必須）
        prices_dict: {code: 価格DataFrame（indicators 計算済み）}
        min_score: この点数未満は除外

    Returns:
        ScreenResult のリスト（スコア降順）
    """
    name_map: dict[str, str] = {}
    if "Code" in listed_df.columns and "CompanyName" in listed_df.columns:
        name_map = dict(zip(listed_df["Code"].astype(str), listed_df["CompanyName"]))

    results = []
    for code, df in prices_dict.items():
        name = name_map.get(str(code), code)
        r = screen_single(str(code), name, df)
        if r is not None and r.score >= min_score:
            results.append(r)

    results.sort(key=lambda x: x.score, reverse=True)
    return results
