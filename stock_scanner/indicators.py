"""
indicators.py - RSI / MACD / ADX / 移動平均 計算
"""

import numpy as np
import pandas as pd


# ──────────────────────────────────────────────
# 移動平均
# ──────────────────────────────────────────────

def sma(series: pd.Series, period: int) -> pd.Series:
    """単純移動平均"""
    return series.rolling(window=period, min_periods=period).mean()


def ema(series: pd.Series, period: int) -> pd.Series:
    """指数移動平均"""
    return series.ewm(span=period, adjust=False).mean()


def calc_ma(df: pd.DataFrame, col: str = "Close") -> pd.DataFrame:
    """
    25日 / 75日 SMA を追加して返す。

    Returns:
        df に MA25, MA75 列を追加した DataFrame
    """
    df = df.copy()
    df["MA25"] = sma(df[col], 25)
    df["MA75"] = sma(df[col], 75)
    return df


# ──────────────────────────────────────────────
# RSI
# ──────────────────────────────────────────────

def calc_rsi(df: pd.DataFrame, period: int = 14, col: str = "Close") -> pd.DataFrame:
    """
    RSI(14) を計算して列 RSI を追加。
    Wilder 平均（ewm span=period*2-1）を使用。
    """
    df = df.copy()
    delta = df[col].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()

    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["RSI"] = 100 - (100 / (1 + rs))
    return df


# ──────────────────────────────────────────────
# MACD
# ──────────────────────────────────────────────

def calc_macd(
    df: pd.DataFrame,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
    col: str = "Close",
) -> pd.DataFrame:
    """
    MACD(12,26,9) を計算して列 MACD, MACD_Signal, MACD_Hist を追加。
    """
    df = df.copy()
    ema_fast = ema(df[col], fast)
    ema_slow = ema(df[col], slow)
    df["MACD"] = ema_fast - ema_slow
    df["MACD_Signal"] = ema(df["MACD"], signal)
    df["MACD_Hist"] = df["MACD"] - df["MACD_Signal"]
    return df


# ──────────────────────────────────────────────
# ADX / DMI
# ──────────────────────────────────────────────

def calc_adx(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """
    ADX(14)、+DI、-DI を計算して列 ADX, DI_Plus, DI_Minus を追加。

    必要列: High, Low, Close
    """
    df = df.copy()
    high = df["High"]
    low = df["Low"]
    close = df["Close"]

    # True Range
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    # Directional Movement
    up_move = high.diff()
    down_move = -low.diff()

    dm_plus = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    dm_minus = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

    dm_plus = pd.Series(dm_plus, index=df.index)
    dm_minus = pd.Series(dm_minus, index=df.index)

    # Wilder Smoothing
    atr = tr.ewm(alpha=1 / period, adjust=False).mean()
    sdm_plus = dm_plus.ewm(alpha=1 / period, adjust=False).mean()
    sdm_minus = dm_minus.ewm(alpha=1 / period, adjust=False).mean()

    df["DI_Plus"] = 100 * sdm_plus / atr.replace(0, np.nan)
    df["DI_Minus"] = 100 * sdm_minus / atr.replace(0, np.nan)

    # DX → ADX
    dx = 100 * (df["DI_Plus"] - df["DI_Minus"]).abs() / (
        df["DI_Plus"] + df["DI_Minus"]
    ).replace(0, np.nan)
    df["ADX"] = dx.ewm(alpha=1 / period, adjust=False).mean()

    return df


# ──────────────────────────────────────────────
# 全インジケータをまとめて計算
# ──────────────────────────────────────────────

def calc_all(df: pd.DataFrame) -> pd.DataFrame:
    """MA / RSI / MACD / ADX を一括計算して返す。"""
    if df.empty or len(df) < 80:
        return df
    df = calc_ma(df)
    df = calc_rsi(df)
    df = calc_macd(df)
    df = calc_adx(df)
    return df
