# 投資分析システム設計書（Phase 2対応）

## 概要
個人投資家向けの株式スクリーニング・分析システム。
Pythonとyfinanceを使用し、コード実行はすべてローカルで行う。
**使うほど賢くなる**知識蓄積ループを実装済み。

## 投資スタイル
- メイン戦略：新高値ブレイク買い、押し目買い
- 主な対象：日本株（東証プライム・グロース）、米国AI関連成長株
- 保有スタイル：中長期（数週間〜数ヶ月）
- 除外：デイトレード・スキャルピング

## ディレクトリ構造
```
stock_skills/
├── CLAUDE.md                      # このファイル（セッション跨ぎ参照用）
├── main.py                        # 自然言語インターフェース（エントリポイント）
├── config/
│   └── screening_rules.yaml       # スクリーニング閾値設定（変更可能）
├── core/
│   ├── data_fetcher.py            # yfinanceラッパー（24hキャッシュ・異常値除外）
│   ├── screener.py                # 3プリセットのスクリーニングエンジン
│   ├── scorer.py                  # バリュースコアリング（0〜100点）
│   ├── health_check.py            # ポートフォリオ・ウォッチリスト管理
│   ├── context_manager.py         # [Phase 2] 自動コンテキスト注入・鮮度判定・関係性判定
│   ├── lesson_manager.py          # [Phase 2] 失敗パターン記録・自動警告
│   └── snapshot_manager.py        # [Phase 2] ポートフォリオスナップショット・週次比較
└── data/
    ├── portfolio.csv              # 保有銘柄（ticker,name,market,buy_date,buy_price,shares,current_price,sector,notes）
    ├── watchlist.json             # ウォッチリスト
    ├── trade_lessons.json         # 失敗・学びの記録
    ├── analysis/                  # 銘柄別分析履歴（{ticker}.json、鮮度管理用）
    ├── snapshots/                 # ポートフォリオスナップショット（JSON）
    └── cache/                     # yfinanceキャッシュ（24hTTL）
```

---

## 自然言語インターフェース

```bash
# スクリーニング
python3 main.py "新高値ブレイクの銘柄を探して"   # プリセット1
python3 main.py "押し目買いチャンスは？"          # プリセット2
python3 main.py "AI関連で割安なやつある？"        # プリセット3

# 個別レポート
python3 main.py "NVDAのレポートを見せて"
python3 main.py "7203のレポートを見せて"          # 日本株は4桁コード

# ポートフォリオ・ウォッチリスト
python3 main.py "ポートフォリオの調子は？"
python3 main.py "ウォッチリストを確認して"

# スナップショット（Phase 2）
python3 main.py "ポートフォリオのスナップショットを保存"
python3 main.py "週次比較を見せて"

# レッスン管理（Phase 2）
python3 main.py "レッスン一覧"
python3 main.py "レッスンを追加 NVDA RSI70超で高値掴み 次はRSI60以下を待つ"
```

---

## Phase 2: 知識蓄積ループ

### 1. 自動コンテキスト注入（context_manager.py）

銘柄が指定されると `data/analysis/` から過去分析結果を自動検索し、鮮度を4段階で判定：

| 鮮度 | 条件 | フェッチモード |
|------|------|--------------|
| 🟢 新しい | 24時間以内 | `skip`（キャッシュ利用） |
| 🟡 最近 | 7日以内 | `diff`（差分更新） |
| 🔴 古い | 7日超 | `full`（フル再取得） |
| ⚪ なし | データなし | `full`（ゼロから分析） |

### 2. 銘柄との関係性による推奨アクション

| 関係性 | 推奨アクション |
|--------|--------------|
| 💼 保有中 | ヘルスチェック優先 |
| ⏰ 保有中（取得90日超） | ヘルスチェック + 投資テーゼ振り返り |
| 👀 ウォッチリスト登録済 | 前回との差分レポート |
| 🔥 スクリーニング3回以上出現 | 注目フラグ付きレポート |
| 🆕 初見 | 通常レポート |

### 3. 失敗パターン記録（lesson_manager.py）

`data/trade_lessons.json` に失敗パターンを記録。
スクリーニング・レポート・ヘルスチェック実行時に自動で警告を表示する。

```json
{
  "lessons": [
    {
      "id": 1,
      "ticker": "7974",
      "ticker_raw": "7974.T",
      "date": "2026-03-26",
      "trigger": "RSI70超で高値掴み",
      "lesson": "RSI70超ではエントリーしない。次はRSI60以下を待つ",
      "next_action": "同じ銘柄でRSI70超のシグナルが出たら自動警告"
    }
  ]
}
```

シグナル種別と自動マッチングキーワード：
- `new_high` → "新高値", "高値ブレイク", "breakout"
- `rsi_overbought` → "rsi70", "高値掴み", "過熱"
- `rsi_oversold` → "rsi30", "売られ過ぎ"
- `earnings_miss` → "決算ミス", "下方修正"
- `trend_break` → "200ma", "トレンド崩れ"

### 4. スナップショット機能（snapshot_manager.py）

- `data/snapshots/` にJSONで保存
- 週次比較：最新スナップと7日前のスナップを自動比較
- 保有銘柄の追加・除外・価格変化率を表示

---

## スクリーニングプリセット

### プリセット1: 新高値ブレイク（new_high_breakout）
- 52週高値の95%以上の価格
- 出来高が20日平均の1.5倍以上
- 時価総額: 日本株100億円以上 / 米国株10億ドル以上

### プリセット2: 押し目買い（dip_buying）
- RSI 30〜45 かつ 200日MA上
- PER 5〜30、配当利回り1%以上（日本株）
- バリュースコア: PER(25点) + PBR(25点) + 配当利回り(20点) + ROE(15点) + 売上成長率(15点)

### プリセット3: AI関連成長株（ai_growth）
- AI・半導体・クラウドセクター（米国中心）
- 売上成長率15%以上、粗利率50%以上
- バリュースコア: 売上成長率(35点) + 粗利率(30点) + ROE(15点) + PER(10点) + PBR(10点)

スクリーニングで3回以上ヒットした銘柄には 🔥 注目フラグが自動付与される。

---

## データ形式

### portfolio.csv
```csv
ticker,name,market,buy_date,buy_price,shares,current_price,sector,notes
7203.T,トヨタ自動車,JP,2026-01-15,2800,100,,自動車,
NVDA,NVIDIA Corporation,US,2026-02-01,140.0,10,,Technology,
```

### watchlist.json
```json
{
  "watchlist": [
    {
      "ticker": "7203.T",
      "name": "トヨタ自動車",
      "market": "JP",
      "added_date": "2026-01-01",
      "reason": "新高値ブレイク候補",
      "target_price": null,
      "notes": ""
    }
  ]
}
```

### data/analysis/{TICKER}.json（鮮度管理ファイル）
```json
{
  "ticker": "NVDA",
  "last_updated": "2026-03-26T10:00:00",
  "screening_hit_count": 5,
  "screening_hit_history": [
    {"date": "2026-03-26", "preset": "ai_growth"}
  ],
  "current_price": 178.68,
  "technicals": {...},
  "fundamentals": {...}
}
```

---

## 実装上の注意
- yfinanceのETF判定は `bool()` で行うこと（空リストを誤判定するバグ回避）
- アナリスト数が3名未満の銘柄はスプレッド警告（`"wide (少数アナリスト)"`）を付与
- 配当利回りが15%超の異常値は除外（`dividendYield = None` に設定）
- PBRが0.1未満の異常値は除外（`priceToBook = None` に設定）
- APIコール間に1秒のディレイを入れてレート制限対策
- キャッシュTTL：24時間（`data/cache/` に保存）
- 分析履歴TTL：鮮度判定で使用（`data/analysis/` に保存、削除しない）
