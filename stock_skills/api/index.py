"""
Vercel サーバーレス関数エントリポイント
このファイルを Vercel が自動検出して /api/* のリクエストを処理する

ローカル開発は start.sh または:
  uvicorn api.index:app --reload --host 0.0.0.0 --port 8000
"""
import sys
from pathlib import Path

# プロジェクトルートをパスに追加（core/ data/ config/ が見えるようにする）
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.server import app  # noqa: F401 – Vercel は module-level の 'app' を使用する

__all__ = ["app"]
