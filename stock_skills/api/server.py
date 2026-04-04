"""
FastAPI バックエンドサーバー
React フロントエンドへ投資分析機能をREST APIとして提供する

起動方法:
  cd stock_skills
  uvicorn api.server:app --reload --port 8000
"""
import sys
from pathlib import Path

# stock_skills/ をパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from core.screener import run_preset
from core.scorer import score_and_rank
from core.health_check import (
    check_portfolio_health,
    check_watchlist_health,
    generate_stock_report,
    add_to_portfolio,
    add_to_watchlist,
    load_watchlist,
    load_portfolio,
)
from core.context_manager import (
    get_recommended_action,
    save_analysis,
    increment_screening_hit,
    load_past_analysis,
    calc_diff,
)
from core.lesson_manager import (
    add_lesson,
    list_all_lessons,
    get_lessons_for_ticker,
    check_warnings,
    delete_lesson,
)
from core.snapshot_manager import (
    save_snapshot,
    list_snapshots,
    load_snapshot,
    get_weekly_snapshot,
    compare_snapshots,
)

app = FastAPI(title="投資分析システム API", version="2.0")

# CORS設定（React開発サーバーからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- サンプル銘柄リスト ---
SAMPLE_TICKERS = [
    "7203.T", "6758.T", "9984.T", "6861.T", "8035.T",
    "4063.T", "6098.T", "2413.T", "4543.T", "7974.T",
    "NVDA", "MSFT", "AAPL", "GOOGL", "META",
    "AMZN", "AMD", "TSLA", "AVGO", "SMCI",
]

# ============================================================
# リクエストモデル
# ============================================================

class PortfolioAddRequest(BaseModel):
    ticker: str
    buy_price: float
    shares: float
    notes: Optional[str] = ""

class WatchlistAddRequest(BaseModel):
    ticker: str
    reason: Optional[str] = ""
    target_price: Optional[float] = None

class LessonAddRequest(BaseModel):
    ticker: str
    trigger: str
    lesson: str
    next_action: Optional[str] = ""
    date: Optional[str] = None

# ============================================================
# ヘルスチェック
# ============================================================

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0"}

# ============================================================
# ポートフォリオ
# ============================================================

@app.get("/api/portfolio")
def get_portfolio():
    """ポートフォリオ一覧＋サマリーを返す"""
    return check_portfolio_health()

@app.post("/api/portfolio")
def post_portfolio(req: PortfolioAddRequest):
    """保有銘柄を追加する"""
    try:
        record = add_to_portfolio(
            ticker=req.ticker,
            buy_price=req.buy_price,
            shares=req.shares,
            notes=req.notes or "",
        )
        return {"success": True, "record": record}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================
# ウォッチリスト
# ============================================================

@app.get("/api/watchlist")
def get_watchlist():
    """ウォッチリストの状態を返す"""
    return check_watchlist_health()

@app.post("/api/watchlist")
def post_watchlist(req: WatchlistAddRequest):
    """ウォッチリストに追加する"""
    try:
        item = add_to_watchlist(
            ticker=req.ticker,
            reason=req.reason or "",
            target_price=req.target_price,
        )
        return {"success": True, "item": item}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================
# 個別レポート
# ============================================================

@app.get("/api/report/{ticker}")
def get_report(ticker: str):
    """個別銘柄の詳細レポートを返す（コンテキスト付き）"""
    report = generate_stock_report(ticker)
    if "error" in report:
        raise HTTPException(status_code=404, detail=report["error"])

    ctx = get_recommended_action(ticker)
    past = load_past_analysis(ticker)

    # 差分計算
    diff = {}
    if past and past.get("current_price"):
        diff = calc_diff(past, report)

    # 過去レッスン警告
    warnings = check_warnings(ticker)

    # 分析結果を保存
    save_analysis(ticker, {
        "current_price": report.get("current_price"),
        "technicals": report.get("technicals", {}),
        "fundamentals": report.get("fundamentals", {}),
    })

    return {
        **report,
        "context": ctx,
        "diff": diff,
        "lessons": warnings,
    }

# ============================================================
# スクリーニング
# ============================================================

@app.get("/api/screen/{preset}")
def get_screening(preset: str, tickers: Optional[str] = None):
    """
    スクリーニングを実行する
    preset: new_high_breakout | dip_buying | ai_growth
    tickers: カンマ区切りのティッカーリスト（省略時はデフォルト＋ウォッチリスト）
    """
    if preset not in ("new_high_breakout", "dip_buying", "ai_growth"):
        raise HTTPException(status_code=400, detail=f"Unknown preset: {preset}")

    # 対象銘柄リスト
    if tickers:
        target = [t.strip() for t in tickers.split(",")]
    else:
        wl = load_watchlist()
        wl_tickers = [item["ticker"] for item in wl]
        target = list(dict.fromkeys(wl_tickers + SAMPLE_TICKERS))

    results = run_preset(preset, target)

    # スコアリング
    if preset in ("dip_buying", "ai_growth") and results:
        results = score_and_rank(results, preset)

    # スクリーニングヒット回数を更新
    for r in results:
        hit_count = increment_screening_hit(r["ticker"], preset)
        r["screening_hit_count"] = hit_count
        r["is_hot"] = hit_count >= 3

    return {
        "preset": preset,
        "count": len(results),
        "results": results,
    }

# ============================================================
# レッスン
# ============================================================

@app.get("/api/lessons")
def get_lessons(ticker: Optional[str] = None):
    """レッスン一覧を返す（ticker指定で絞り込み）"""
    if ticker:
        lessons = get_lessons_for_ticker(ticker)
    else:
        lessons = list_all_lessons(limit=50)
    return {"lessons": lessons, "count": len(lessons)}

@app.post("/api/lessons")
def post_lesson(req: LessonAddRequest):
    """レッスンを追加する"""
    try:
        record = add_lesson(
            ticker=req.ticker,
            trigger=req.trigger,
            lesson=req.lesson,
            next_action=req.next_action or "",
            date=req.date,
        )
        return {"success": True, "record": record}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/lessons/{lesson_id}")
def del_lesson(lesson_id: int):
    """レッスンを削除する"""
    ok = delete_lesson(lesson_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return {"success": True}

# ============================================================
# スナップショット
# ============================================================

@app.get("/api/snapshots")
def get_snapshots():
    """スナップショット一覧を返す"""
    snaps = list_snapshots(limit=20)
    return {"snapshots": snaps, "count": len(snaps)}

@app.post("/api/snapshots")
def post_snapshot(label: Optional[str] = None):
    """現在のポートフォリオをスナップショット保存する"""
    snap = save_snapshot(label=label)
    return {"success": True, "snapshot": snap}

@app.get("/api/snapshots/compare")
def get_snapshot_compare():
    """最新 vs 7日前のスナップショットを比較する"""
    snaps = list_snapshots(limit=20)
    if len(snaps) < 2:
        return {"error": "比較するスナップショットが不足しています（2件以上必要）", "comparison": None}

    snap_new = load_snapshot(snaps[0]["label"])
    weekly = get_weekly_snapshot()
    snap_old = (
        weekly
        if weekly and weekly.get("label") != snap_new.get("label")
        else load_snapshot(snaps[-1]["label"])
    )

    if not snap_old or not snap_new:
        return {"error": "スナップショットの読み込みに失敗しました", "comparison": None}

    comparison = compare_snapshots(snap_old, snap_new)
    return {
        "comparison": comparison,
        "snap_old": {"label": snap_old.get("label"), "date": snap_old.get("date")},
        "snap_new": {"label": snap_new.get("label"), "date": snap_new.get("date")},
    }
