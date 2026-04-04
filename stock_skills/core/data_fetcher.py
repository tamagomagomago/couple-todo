"""
yfinanceラッパー
- 24時間TTLキャッシュ
- 異常値フィルタリング
- APIレート制限対策（1秒ディレイ）
"""
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import yfinance as yf

from .paths import CACHE_DIR
CACHE_TTL_HOURS = 24
API_DELAY = 1  # seconds


def _cache_path(ticker: str, data_type: str) -> Path:
    safe = ticker.replace(".", "_").replace("/", "_")
    return CACHE_DIR / f"{safe}_{data_type}.json"


def _is_cache_valid(path: Path) -> bool:
    if not path.exists():
        return False
    mtime = datetime.fromtimestamp(path.stat().st_mtime)
    return datetime.now() - mtime < timedelta(hours=CACHE_TTL_HOURS)


def _load_cache(path: Path) -> Optional[dict]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _save_cache(path: Path, data: dict) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, default=str), encoding="utf-8")


def get_stock_info(ticker: str, use_cache: bool = True) -> dict:
    """銘柄の基本情報を取得（キャッシュ付き）"""
    cache_path = _cache_path(ticker, "info")
    if use_cache and _is_cache_valid(cache_path):
        cached = _load_cache(cache_path)
        if cached:
            return cached

    time.sleep(API_DELAY)
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
    except Exception as e:
        return {"error": str(e), "ticker": ticker}

    # 異常値フィルタリング
    info = _filter_anomalies(info)

    _save_cache(cache_path, info)
    return info


def get_history(ticker: str, period: str = "1y", use_cache: bool = True) -> list[dict]:
    """価格履歴を取得（キャッシュ付き）"""
    cache_key = f"history_{period}"
    cache_path = _cache_path(ticker, cache_key)
    if use_cache and _is_cache_valid(cache_path):
        cached = _load_cache(cache_path)
        if cached is not None:
            return cached

    time.sleep(API_DELAY)
    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period)
        if df.empty:
            return []
        records = df.reset_index().to_dict(orient="records")
    except Exception:
        return []

    _save_cache(cache_path, records)
    return records


def is_etf(ticker: str) -> bool:
    """ETFかどうかを判定（bool()で正しく判定）"""
    try:
        t = yf.Ticker(ticker)
        # ETFは quoteType が "ETF" になる
        info = t.info or {}
        return info.get("quoteType", "").upper() == "ETF"
    except Exception:
        return False


def _filter_anomalies(info: dict) -> dict:
    """異常値を除外・無効化する"""
    # 配当利回り15%超は除外
    div_yield = info.get("dividendYield")
    if div_yield is not None and div_yield > 0.15:
        info["dividendYield"] = None

    # PBRが0.1未満は除外
    pbr = info.get("priceToBook")
    if pbr is not None and pbr < 0.1:
        info["priceToBook"] = None

    return info


def get_analyst_count(ticker: str) -> int:
    """アナリスト推奨数を返す（情報がない場合は0）"""
    info = get_stock_info(ticker)
    return int(info.get("numberOfAnalystOpinions") or 0)


def batch_get_info(tickers: list[str], use_cache: bool = True) -> dict[str, dict]:
    """複数銘柄の情報を一括取得"""
    results = {}
    for ticker in tickers:
        results[ticker] = get_stock_info(ticker, use_cache=use_cache)
    return results
