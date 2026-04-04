"""
パス解決ユーティリティ

Vercel のサーバーレス環境では /var/task/ が読み取り専用のため、
書き込みが必要なディレクトリは /tmp にフォールバックする。
ローカル開発時は data/ ディレクトリをそのまま使用する。
"""
import os
from pathlib import Path

# プロジェクトルート（stock_skills/）
PROJECT_ROOT = Path(__file__).parent.parent

# Vercel 環境かどうか
IS_VERCEL = os.environ.get("VERCEL") == "1"

# 読み取り専用データ（portfolio.csv, watchlist.json, trade_lessons.json）
# Vercel でも git commit 済みファイルは読める
DATA_DIR_READONLY = PROJECT_ROOT / "data"

# 書き込みデータ（cache, analysis, snapshots）
# Vercel では /tmp に書く（セッション内のみ有効・再起動で消える）
if IS_VERCEL:
    DATA_DIR_WRITABLE = Path("/tmp/stock_skills")
else:
    DATA_DIR_WRITABLE = PROJECT_ROOT / "data"

CACHE_DIR    = DATA_DIR_WRITABLE / "cache"
ANALYSIS_DIR = DATA_DIR_WRITABLE / "analysis"
SNAPSHOTS_DIR = DATA_DIR_WRITABLE / "snapshots"

PORTFOLIO_CSV  = DATA_DIR_READONLY / "portfolio.csv"
WATCHLIST_JSON = DATA_DIR_READONLY / "watchlist.json"
LESSONS_JSON   = DATA_DIR_READONLY / "trade_lessons.json"

# 書き込み先（ローカルは同じ場所、Vercel は /tmp）
PORTFOLIO_CSV_WRITE  = DATA_DIR_WRITABLE / "portfolio.csv"   if IS_VERCEL else PORTFOLIO_CSV
WATCHLIST_JSON_WRITE = DATA_DIR_WRITABLE / "watchlist.json"  if IS_VERCEL else WATCHLIST_JSON
LESSONS_JSON_WRITE   = DATA_DIR_WRITABLE / "trade_lessons.json" if IS_VERCEL else LESSONS_JSON
