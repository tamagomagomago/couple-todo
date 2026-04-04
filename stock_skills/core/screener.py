"""
スクリーニングエンジン
3つのプリセットを実装：
1. 新高値ブレイク（メイン戦略）
2. 押し目買い（サブ戦略）
3. AI関連成長株（テーマ投資）
"""
from pathlib import Path
from typing import Optional
import yaml

from .data_fetcher import get_stock_info, get_history, is_etf

CONFIG_PATH = Path(__file__).parent.parent / "config" / "screening_rules.yaml"


def _load_config() -> dict:
    return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))


def _calc_rsi(closes: list[float], period: int = 14) -> Optional[float]:
    if len(closes) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, period + 1):
        diff = closes[i] - closes[i - 1]
        if diff > 0:
            gains.append(diff)
            losses.append(0)
        else:
            gains.append(0)
            losses.append(abs(diff))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _extract_closes(history: list[dict]) -> list[float]:
    return [float(r.get("Close", 0) or 0) for r in history if r.get("Close")]


def _extract_volumes(history: list[dict]) -> list[float]:
    return [float(r.get("Volume", 0) or 0) for r in history if r.get("Volume") is not None]


# -------------------------------------------------------
# プリセット1: 新高値ブレイク
# -------------------------------------------------------

def screen_new_high_breakout(tickers: list[str]) -> list[dict]:
    """
    52週高値の95%以上 + 出来高1.5倍以上 + 時価総額条件を満たす銘柄を返す
    """
    cfg = _load_config()["new_high_breakout"]
    price_ratio = cfg["price_to_52w_high_ratio"]
    vol_ratio = cfg["volume_ratio_threshold"]
    min_cap_jp = cfg["min_market_cap_jp"]
    min_cap_us = cfg["min_market_cap_us"]

    results = []
    for ticker in tickers:
        if is_etf(ticker):
            continue

        info = get_stock_info(ticker)
        if "error" in info:
            continue

        current_price = info.get("currentPrice") or info.get("regularMarketPrice")
        week52_high = info.get("fiftyTwoWeekHigh")
        market_cap = info.get("marketCap")

        if not all([current_price, week52_high, market_cap]):
            continue

        # 時価総額チェック
        currency = info.get("currency", "USD")
        if currency == "JPY":
            if market_cap < min_cap_jp:
                continue
        else:
            if market_cap < min_cap_us:
                continue

        # 52週高値比チェック
        if current_price / week52_high < price_ratio:
            continue

        # 出来高チェック
        history = get_history(ticker, period="3mo")
        volumes = _extract_volumes(history)
        if len(volumes) < 21:
            continue
        avg_vol_20 = sum(volumes[-21:-1]) / 20
        last_vol = volumes[-1]
        if avg_vol_20 == 0 or last_vol / avg_vol_20 < vol_ratio:
            continue

        results.append({
            "ticker": ticker,
            "name": info.get("shortName", ticker),
            "current_price": current_price,
            "week52_high": week52_high,
            "price_to_52w_ratio": round(current_price / week52_high, 4),
            "volume_ratio": round(last_vol / avg_vol_20, 2),
            "market_cap": market_cap,
            "currency": currency,
            "sector": info.get("sector", ""),
            "preset": "new_high_breakout",
        })

    return results


# -------------------------------------------------------
# プリセット2: 押し目買い
# -------------------------------------------------------

def screen_dip_buying(tickers: list[str]) -> list[dict]:
    """
    RSI 30〜45 + 200日MA上 + PER/配当条件を満たす銘柄を返す
    """
    cfg = _load_config()["dip_buying"]
    rsi_min = cfg["rsi_min"]
    rsi_max = cfg["rsi_max"]
    per_min = cfg["per_min"]
    per_max = cfg["per_max"]
    min_div_jp = cfg["min_dividend_yield_jp"]

    results = []
    for ticker in tickers:
        if is_etf(ticker):
            continue

        info = get_stock_info(ticker)
        if "error" in info:
            continue

        current_price = info.get("currentPrice") or info.get("regularMarketPrice")
        per = info.get("trailingPE")
        div_yield = info.get("dividendYield")
        currency = info.get("currency", "USD")

        if not current_price:
            continue

        # PERチェック
        if per is None or not (per_min <= per <= per_max):
            continue

        # 日本株の場合は配当利回りチェック
        if currency == "JPY":
            if div_yield is None or div_yield < min_div_jp:
                continue

        # 価格履歴を取得
        history = get_history(ticker, period="1y")
        closes = _extract_closes(history)

        if len(closes) < 200:
            continue

        # 200日MA
        ma200 = sum(closes[-200:]) / 200
        if current_price <= ma200:
            continue

        # RSI（直近14日）
        rsi = _calc_rsi(closes[-15:])
        if rsi is None or not (rsi_min <= rsi <= rsi_max):
            continue

        results.append({
            "ticker": ticker,
            "name": info.get("shortName", ticker),
            "current_price": current_price,
            "ma200": round(ma200, 2),
            "rsi": round(rsi, 1),
            "per": round(per, 1),
            "dividend_yield": div_yield,
            "currency": currency,
            "sector": info.get("sector", ""),
            "preset": "dip_buying",
        })

    return results


# -------------------------------------------------------
# プリセット3: AI関連成長株
# -------------------------------------------------------

def screen_ai_growth(tickers: list[str]) -> list[dict]:
    """
    AI・半導体・クラウドセクター + 売上成長率15%以上 + 粗利率50%以上
    """
    cfg = _load_config()["ai_growth"]
    target_sectors = [s.lower() for s in cfg["target_sectors"]]
    target_keywords = [k.lower() for k in cfg["target_keywords"]]
    min_rev_growth = cfg["min_revenue_growth"]
    min_gross_margin = cfg["min_gross_margin"]

    results = []
    for ticker in tickers:
        if is_etf(ticker):
            continue

        info = get_stock_info(ticker)
        if "error" in info:
            continue

        sector = (info.get("sector") or "").lower()
        industry = (info.get("industry") or "").lower()
        description = (info.get("longBusinessSummary") or "").lower()

        # セクター・キーワードチェック
        sector_match = any(s in sector or s in industry for s in target_sectors)
        keyword_match = any(k in description for k in target_keywords)
        if not (sector_match or keyword_match):
            continue

        # 売上成長率チェック
        rev_growth = info.get("revenueGrowth")
        if rev_growth is None or rev_growth < min_rev_growth:
            continue

        # 粗利率チェック
        gross_margins = info.get("grossMargins")
        if gross_margins is None or gross_margins < min_gross_margin:
            continue

        current_price = info.get("currentPrice") or info.get("regularMarketPrice")

        results.append({
            "ticker": ticker,
            "name": info.get("shortName", ticker),
            "current_price": current_price,
            "revenue_growth": round(rev_growth * 100, 1),
            "gross_margin": round(gross_margins * 100, 1),
            "per": info.get("trailingPE"),
            "market_cap": info.get("marketCap"),
            "sector": info.get("sector", ""),
            "industry": info.get("industry", ""),
            "currency": info.get("currency", "USD"),
            "preset": "ai_growth",
        })

    return results


# -------------------------------------------------------
# ファサード関数
# -------------------------------------------------------

def run_preset(preset_name: str, tickers: list[str]) -> list[dict]:
    """プリセット名でスクリーニングを実行する"""
    presets = {
        "new_high_breakout": screen_new_high_breakout,
        "dip_buying": screen_dip_buying,
        "ai_growth": screen_ai_growth,
    }
    fn = presets.get(preset_name)
    if fn is None:
        raise ValueError(f"Unknown preset: {preset_name}. Choose from {list(presets)}")
    return fn(tickers)
