"""
ポートフォリオ・ウォッチリストのヘルスチェック
"""
import csv
import json
from datetime import datetime
from pathlib import Path

from .data_fetcher import get_stock_info, get_history
from .paths import (
    PORTFOLIO_CSV, WATCHLIST_JSON,
    PORTFOLIO_CSV_WRITE, WATCHLIST_JSON_WRITE,
)


def load_portfolio() -> list[dict]:
    """portfolio.csvを読み込む"""
    if not PORTFOLIO_CSV.exists():
        return []
    with PORTFOLIO_CSV.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def save_portfolio(records: list[dict]) -> None:
    """portfolio.csvに書き込む"""
    if not records:
        return
    fields = ["ticker", "name", "market", "buy_date", "buy_price", "shares", "current_price", "sector", "notes"]
    PORTFOLIO_CSV_WRITE.parent.mkdir(parents=True, exist_ok=True)
    with PORTFOLIO_CSV_WRITE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(records)


def load_watchlist() -> list[dict]:
    """watchlist.jsonを読み込む"""
    if not WATCHLIST_JSON.exists():
        return []
    data = json.loads(WATCHLIST_JSON.read_text(encoding="utf-8"))
    return data.get("watchlist", [])


def save_watchlist(items: list[dict]) -> None:
    """watchlist.jsonに書き込む"""
    WATCHLIST_JSON_WRITE.parent.mkdir(parents=True, exist_ok=True)
    WATCHLIST_JSON_WRITE.write_text(
        json.dumps({"watchlist": items}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def add_to_portfolio(ticker: str, buy_price: float, shares: float, notes: str = "") -> dict:
    """保有銘柄を追加する"""
    info = get_stock_info(ticker)
    records = load_portfolio()
    new_record = {
        "ticker": ticker,
        "name": info.get("shortName", ticker),
        "market": "JP" if ticker.endswith(".T") else "US",
        "buy_date": datetime.now().strftime("%Y-%m-%d"),
        "buy_price": buy_price,
        "shares": shares,
        "current_price": info.get("currentPrice") or info.get("regularMarketPrice", ""),
        "sector": info.get("sector", ""),
        "notes": notes,
    }
    records.append(new_record)
    save_portfolio(records)
    return new_record


def add_to_watchlist(ticker: str, reason: str = "", target_price: float = None) -> dict:
    """ウォッチリストに追加する"""
    info = get_stock_info(ticker)
    items = load_watchlist()

    # 重複チェック
    for item in items:
        if item["ticker"] == ticker:
            return {"message": f"{ticker} はすでにウォッチリストにあります", "item": item}

    new_item = {
        "ticker": ticker,
        "name": info.get("shortName", ticker),
        "market": "JP" if ticker.endswith(".T") else "US",
        "added_date": datetime.now().strftime("%Y-%m-%d"),
        "reason": reason,
        "target_price": target_price,
        "notes": "",
    }
    items.append(new_item)
    save_watchlist(items)
    return new_item


def check_portfolio_health() -> dict:
    """ポートフォリオのヘルスチェック"""
    records = load_portfolio()
    if not records:
        return {"message": "保有銘柄がありません", "holdings": []}

    holdings = []
    total_cost = 0.0
    total_value = 0.0

    for rec in records:
        ticker = rec["ticker"]
        buy_price = float(rec.get("buy_price") or 0)
        shares = float(rec.get("shares") or 0)
        cost = buy_price * shares

        info = get_stock_info(ticker)
        current_price = float(info.get("currentPrice") or info.get("regularMarketPrice") or buy_price)
        value = current_price * shares
        pnl = value - cost
        pnl_pct = (pnl / cost * 100) if cost > 0 else 0.0

        # 52週高値との比較
        week52_high = info.get("fiftyTwoWeekHigh")
        from_52w_high = None
        if week52_high:
            from_52w_high = round((current_price / week52_high - 1) * 100, 1)

        holdings.append({
            "ticker": ticker,
            "name": rec.get("name", ticker),
            "buy_price": buy_price,
            "current_price": current_price,
            "shares": shares,
            "cost": round(cost, 0),
            "value": round(value, 0),
            "pnl": round(pnl, 0),
            "pnl_pct": round(pnl_pct, 1),
            "from_52w_high_pct": from_52w_high,
            "sector": info.get("sector", rec.get("sector", "")),
        })

        total_cost += cost
        total_value += value

    total_pnl = total_value - total_cost
    total_pnl_pct = (total_pnl / total_cost * 100) if total_cost > 0 else 0.0

    return {
        "holdings": holdings,
        "summary": {
            "total_cost": round(total_cost, 0),
            "total_value": round(total_value, 0),
            "total_pnl": round(total_pnl, 0),
            "total_pnl_pct": round(total_pnl_pct, 1),
            "count": len(holdings),
        },
    }


def check_watchlist_health() -> dict:
    """ウォッチリストのヘルスチェック"""
    items = load_watchlist()
    if not items:
        return {"message": "ウォッチリストが空です", "watchlist": []}

    enriched = []
    for item in items:
        ticker = item["ticker"]
        info = get_stock_info(ticker)
        current_price = info.get("currentPrice") or info.get("regularMarketPrice")
        week52_high = info.get("fiftyTwoWeekHigh")

        from_52w_high = None
        if current_price and week52_high:
            from_52w_high = round((current_price / week52_high - 1) * 100, 1)

        target_price = item.get("target_price")
        gap_to_target = None
        if current_price and target_price:
            gap_to_target = round((float(target_price) / current_price - 1) * 100, 1)

        enriched.append({
            **item,
            "current_price": current_price,
            "from_52w_high_pct": from_52w_high,
            "gap_to_target_pct": gap_to_target,
        })

    return {"watchlist": enriched, "count": len(enriched)}


def generate_stock_report(ticker: str) -> dict:
    """個別銘柄の詳細レポートを生成"""
    info = get_stock_info(ticker)
    history = get_history(ticker, period="1y")

    if "error" in info:
        return {"error": f"{ticker} の情報取得に失敗しました: {info['error']}"}

    closes = [float(r.get("Close", 0) or 0) for r in history if r.get("Close")]

    ma50 = round(sum(closes[-50:]) / 50, 2) if len(closes) >= 50 else None
    ma200 = round(sum(closes[-200:]) / 200, 2) if len(closes) >= 200 else None

    # RSI（14日）
    rsi = None
    if len(closes) >= 15:
        gains, losses = [], []
        for i in range(1, 15):
            diff = closes[-15 + i] - closes[-15 + i - 1]
            if diff > 0:
                gains.append(diff)
                losses.append(0)
            else:
                gains.append(0)
                losses.append(abs(diff))
        avg_gain = sum(gains) / 14
        avg_loss = sum(losses) / 14
        if avg_loss > 0:
            rs = avg_gain / avg_loss
            rsi = round(100 - (100 / (1 + rs)), 1)
        else:
            rsi = 100.0

    analyst_count = int(info.get("numberOfAnalystOpinions") or 0)
    target_mean = info.get("targetMeanPrice")
    target_spread = None
    if target_mean and analyst_count < 3:
        # アナリスト数が少ない場合はスプレッドを拡張（±20%）
        target_spread = "wide (少数アナリスト)"
    elif target_mean:
        target_spread = "normal"

    return {
        "ticker": ticker,
        "name": info.get("shortName", ticker),
        "sector": info.get("sector", ""),
        "industry": info.get("industry", ""),
        "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
        "currency": info.get("currency", "USD"),
        "market_cap": info.get("marketCap"),
        "technicals": {
            "ma50": ma50,
            "ma200": ma200,
            "rsi_14": rsi,
            "week52_high": info.get("fiftyTwoWeekHigh"),
            "week52_low": info.get("fiftyTwoWeekLow"),
        },
        "fundamentals": {
            "per": info.get("trailingPE"),
            "forward_per": info.get("forwardPE"),
            "pbr": info.get("priceToBook"),
            "roe": info.get("returnOnEquity"),
            "dividend_yield": info.get("dividendYield"),
            "revenue_growth": info.get("revenueGrowth"),
            "gross_margins": info.get("grossMargins"),
            "operating_margins": info.get("operatingMargins"),
        },
        "analyst": {
            "count": analyst_count,
            "target_mean": target_mean,
            "target_high": info.get("targetHighPrice"),
            "target_low": info.get("targetLowPrice"),
            "recommendation": info.get("recommendationKey"),
            "spread_note": target_spread,
        },
        "description": (info.get("longBusinessSummary") or "")[:300],
    }
