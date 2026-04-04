"""
バリュースコアリングエンジン
各プリセットに対応したスコアを0〜100点で算出する
"""
from pathlib import Path
from typing import Optional
import yaml

CONFIG_PATH = Path(__file__).parent.parent / "config" / "screening_rules.yaml"


def _load_weights(preset: str) -> dict:
    cfg = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
    return cfg[preset]["value_score_weights"]


def _normalize(value: float, min_val: float, max_val: float) -> float:
    """値を0〜1に正規化する"""
    if max_val == min_val:
        return 0.5
    return max(0.0, min(1.0, (value - min_val) / (max_val - min_val)))


def _score_per(per: Optional[float], preset: str) -> float:
    """PERスコア（低いほど高スコア、ただし範囲外は減点）"""
    if per is None:
        return 0.0
    if preset == "ai_growth":
        # 成長株はPERが高くても許容（100以下なら満点に近く）
        return _normalize(100 - min(per, 100), 0, 100)
    else:
        # バリュー重視（PER 5〜30の範囲で高スコア）
        if per < 5 or per > 50:
            return 0.0
        return _normalize(30 - min(per, 30), 0, 25)


def _score_pbr(pbr: Optional[float]) -> float:
    """PBRスコア（低いほど高スコア）"""
    if pbr is None:
        return 0.0
    if pbr < 0.1:  # 異常値
        return 0.0
    return _normalize(5 - min(pbr, 5), 0, 5)


def _score_dividend_yield(div_yield: Optional[float]) -> float:
    """配当利回りスコア（高いほど高スコア、ただし15%超は除外済み）"""
    if div_yield is None:
        return 0.0
    return _normalize(min(div_yield, 0.10), 0, 0.10)


def _score_roe(roe: Optional[float]) -> float:
    """ROEスコア（高いほど高スコア）"""
    if roe is None:
        return 0.0
    return _normalize(min(roe, 0.30), 0, 0.30)


def _score_revenue_growth(growth: Optional[float]) -> float:
    """売上成長率スコア（高いほど高スコア）"""
    if growth is None:
        return 0.0
    return _normalize(min(growth, 0.50), 0, 0.50)


def _score_gross_margin(margin: Optional[float]) -> float:
    """粗利率スコア（高いほど高スコア）"""
    if margin is None:
        return 0.0
    return _normalize(min(margin, 0.90), 0, 0.90)


def calc_value_score(info: dict, preset: str = "dip_buying") -> dict:
    """
    バリュースコアを算出する
    Returns: {"total": float, "breakdown": dict}
    """
    weights = _load_weights(preset)

    per = info.get("trailingPE")
    pbr = info.get("priceToBook")
    div_yield = info.get("dividendYield")
    roe = info.get("returnOnEquity")
    rev_growth = info.get("revenueGrowth")
    gross_margin = info.get("grossMargins")

    breakdown = {}
    total = 0.0

    if "per" in weights:
        score = _score_per(per, preset) * weights["per"]
        breakdown["per"] = {"raw": per, "score": round(score, 1), "weight": weights["per"]}
        total += score

    if "pbr" in weights:
        score = _score_pbr(pbr) * weights["pbr"]
        breakdown["pbr"] = {"raw": pbr, "score": round(score, 1), "weight": weights["pbr"]}
        total += score

    if "dividend_yield" in weights:
        score = _score_dividend_yield(div_yield) * weights["dividend_yield"]
        breakdown["dividend_yield"] = {"raw": div_yield, "score": round(score, 1), "weight": weights["dividend_yield"]}
        total += score

    if "roe" in weights:
        score = _score_roe(roe) * weights["roe"]
        breakdown["roe"] = {"raw": roe, "score": round(score, 1), "weight": weights["roe"]}
        total += score

    if "revenue_growth" in weights:
        score = _score_revenue_growth(rev_growth) * weights["revenue_growth"]
        breakdown["revenue_growth"] = {"raw": rev_growth, "score": round(score, 1), "weight": weights["revenue_growth"]}
        total += score

    if "gross_margin" in weights:
        score = _score_gross_margin(gross_margin) * weights["gross_margin"]
        breakdown["gross_margin"] = {"raw": gross_margin, "score": round(score, 1), "weight": weights["gross_margin"]}
        total += score

    return {
        "total": round(total, 1),
        "breakdown": breakdown,
    }


def score_and_rank(candidates: list[dict], preset: str) -> list[dict]:
    """
    スクリーニング結果にスコアを付与してランキングする
    """
    from .data_fetcher import get_stock_info

    scored = []
    for item in candidates:
        ticker = item["ticker"]
        info = get_stock_info(ticker)
        score_result = calc_value_score(info, preset=preset)
        scored.append({
            **item,
            "value_score": score_result["total"],
            "score_breakdown": score_result["breakdown"],
        })

    return sorted(scored, key=lambda x: x["value_score"], reverse=True)
