#!/bin/bash
# ============================================================
# 投資分析システム 起動スクリプト
# 使い方: ./start.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ---------- 色付きログ ----------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERR]${NC}  $1"; }

# ---------- 依存チェック ----------
check_deps() {
  local missing=()
  command -v python3  >/dev/null 2>&1 || missing+=("python3")
  command -v uvicorn  >/dev/null 2>&1 || missing+=("uvicorn  → pip3 install uvicorn fastapi yfinance pyyaml")
  command -v ngrok    >/dev/null 2>&1 || missing+=("ngrok    → brew install ngrok")

  if [ ${#missing[@]} -gt 0 ]; then
    error "以下がインストールされていません:"
    for m in "${missing[@]}"; do echo "  • $m"; done
    exit 1
  fi
}

# ---------- プロセス管理 ----------
UVICORN_PID=""
NGROK_PID=""

cleanup() {
  echo ""
  info "シャットダウン中..."
  [ -n "$UVICORN_PID" ] && kill "$UVICORN_PID" 2>/dev/null && info "バックエンド停止"
  [ -n "$NGROK_PID"   ] && kill "$NGROK_PID"   2>/dev/null && info "ngrok 停止"
  exit 0
}
trap cleanup INT TERM

# ---------- uvicorn 起動 ----------
start_backend() {
  info "バックエンド (FastAPI) を起動中..."
  python3 -m uvicorn api.server:app --host 0.0.0.0 --port 8000 \
    > /tmp/stock_backend.log 2>&1 &
  UVICORN_PID=$!

  # 起動待ち（最大15秒）
  for i in $(seq 1 15); do
    sleep 1
    if curl -s http://localhost:8000/api/health >/dev/null 2>&1; then
      success "バックエンド起動完了 (PID: $UVICORN_PID)"
      return 0
    fi
  done
  error "バックエンドの起動に失敗しました"
  error "ログ確認: cat /tmp/stock_backend.log"
  exit 1
}

# ---------- ngrok 起動 ----------
NGROK_URL=""

start_ngrok() {
  info "ngrok を起動中..."

  # 既存の ngrok があれば終了
  pkill -f "ngrok http" 2>/dev/null || true
  sleep 1

  # 固定ドメインが .env に設定されていれば使う
  if [ -f ".env" ]; then
    source .env
  fi

  if [ -n "$NGROK_DOMAIN" ]; then
    info "固定ドメインを使用: $NGROK_DOMAIN"
    ngrok http --domain="$NGROK_DOMAIN" 8000 > /tmp/stock_ngrok.log 2>&1 &
  else
    ngrok http 8000 > /tmp/stock_ngrok.log 2>&1 &
  fi
  NGROK_PID=$!

  # ngrok API が立ち上がるまで待つ（最大20秒）
  for i in $(seq 1 20); do
    sleep 1
    NGROK_URL=$(python3 -c "
import urllib.request, json, sys
try:
    res = urllib.request.urlopen('http://localhost:4040/api/tunnels', timeout=2)
    data = json.loads(res.read())
    for t in data.get('tunnels', []):
        if t.get('proto') == 'https':
            print(t['public_url'])
            sys.exit(0)
except:
    pass
" 2>/dev/null)

    if [ -n "$NGROK_URL" ]; then
      success "ngrok 起動完了"
      return 0
    fi
  done

  error "ngrok の起動に失敗しました"
  warn "ngrok にログインしていますか？"
  warn "  ngrok config add-authtoken <あなたのトークン>"
  warn "  トークン取得: https://dashboard.ngrok.com/get-started/your-authtoken"
  exit 1
}

# ---------- メイン ----------
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   📈 投資分析システム 起動スクリプト      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

check_deps
start_backend
start_ngrok

API_BASE="${NGROK_URL}/api"

# ---------- 接続情報を表示 ----------
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                    🚀 起動完了！                            ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
printf "${BOLD}║${NC}  ローカル API:   ${GREEN}http://localhost:8000/api/health${NC}\n"
printf "${BOLD}║${NC}  ngrok URL:     ${GREEN}${NGROK_URL}${NC}\n"
echo -e "${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  📱 スマホからの接続手順:"
echo -e "${BOLD}║${NC}    1. ${CYAN}https://web-mu-roan-57.vercel.app${NC} を開く"
echo -e "${BOLD}║${NC}    2. 右下の ⚙️ をタップ"
echo -e "${BOLD}║${NC}    3. 以下のURLを貼り付けて「接続」:"
printf "${BOLD}║${NC}       ${YELLOW}${API_BASE}${NC}\n"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# macOS: クリップボードにコピー
if command -v pbcopy >/dev/null 2>&1; then
  echo -n "$API_BASE" | pbcopy
  success "「${API_BASE}」をクリップボードにコピー済み ✂️"
  echo ""
fi

info "バックエンドログ: tail -f /tmp/stock_backend.log"
info "ngrok ダッシュボード: http://localhost:4040"
echo ""
warn "Ctrl+C で全プロセスを停止します"
echo ""

# ---------- 監視ループ（落ちたら再起動） ----------
while true; do
  if ! kill -0 "$UVICORN_PID" 2>/dev/null; then
    warn "バックエンドが落ちました。再起動します..."
    start_backend
  fi

  if ! kill -0 "$NGROK_PID" 2>/dev/null; then
    warn "ngrok が落ちました。再起動します..."
    start_ngrok
    API_BASE="${NGROK_URL}/api"
    echo ""
    warn "⚠ ngrok URLが変わりました。設定画面で更新してください:"
    printf "  ${YELLOW}${API_BASE}${NC}\n"
    if command -v pbcopy >/dev/null 2>&1; then
      echo -n "$API_BASE" | pbcopy
      info "新しいURLをクリップボードにコピーしました"
    fi
    echo ""
  fi

  sleep 5
done
