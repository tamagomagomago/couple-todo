"""
失敗パターン記録・自動警告システム

data/trade_lessons.json に失敗パターンを記録し、
スクリーニング・レポート実行時に自動警告する。
"""
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from .paths import LESSONS_JSON as _LESSONS_READ, LESSONS_JSON_WRITE as LESSONS_FILE

# 警告トリガーのキーワードマッピング
# signal_type → lesson の trigger フィールドに含まれるべきキーワード
SIGNAL_KEYWORDS = {
    "rsi_overbought":   ["rsi70", "rsi 70", "rsi超", "高値掴み", "過熱"],
    "rsi_oversold":     ["rsi30", "rsi 30", "rsi下", "売られ過ぎ"],
    "new_high":         ["新高値", "高値ブレイク", "breakout"],
    "earnings_miss":    ["決算ミス", "ガイダンス", "下方修正"],
    "volume_spike":     ["出来高急増", "volume spike"],
    "trend_break":      ["トレンド崩れ", "ma割れ", "200ma", "200日"],
}


def _load_lessons() -> list[dict]:
    """trade_lessons.json を読み込む（読み取り専用パスを優先）"""
    for path in [LESSONS_FILE, _LESSONS_READ]:
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                return data.get("lessons", [])
            except Exception:
                continue
    return []


def _save_lessons(lessons: list[dict]) -> None:
    """trade_lessons.json に書き込む"""
    LESSONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    LESSONS_FILE.write_text(
        json.dumps({"lessons": lessons}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def add_lesson(
    ticker: str,
    trigger: str,
    lesson: str,
    next_action: str = "",
    date: Optional[str] = None,
) -> dict:
    """
    失敗パターン（レッスン）を記録する

    Args:
        ticker: 銘柄コード（例: "7974", "NVDA"）
        trigger: 失敗のトリガー（例: "RSI70超で高値掴み"）
        lesson: 学んだこと
        next_action: 次回の対応方針
        date: 日付（省略時は今日）

    Returns:
        追加したレコード
    """
    lessons = _load_lessons()

    record = {
        "id": len(lessons) + 1,
        "ticker": ticker.upper().replace(".T", ""),  # 正規化（4桁コードは.Tなし）
        "ticker_raw": ticker,
        "date": date or datetime.now().strftime("%Y-%m-%d"),
        "trigger": trigger,
        "lesson": lesson,
        "next_action": next_action,
        "created_at": datetime.now().isoformat(),
    }

    lessons.append(record)
    _save_lessons(lessons)
    return record


def get_lessons_for_ticker(ticker: str) -> list[dict]:
    """
    特定銘柄の全レッスンを取得する
    ticker は .T あり・なし両方にマッチ
    """
    lessons = _load_lessons()
    normalized = ticker.upper().replace(".T", "")
    return [
        l for l in lessons
        if l.get("ticker") == normalized or l.get("ticker_raw", "").upper() == ticker.upper()
    ]


def check_warnings(ticker: str, signals: Optional[list[str]] = None) -> list[dict]:
    """
    現在のシグナルと過去レッスンを照合して警告を返す

    Args:
        ticker: 銘柄コード
        signals: 現在発生しているシグナルのリスト（例: ["rsi_overbought", "new_high"]）

    Returns:
        警告リスト（各要素: {"lesson": ..., "trigger": ..., "date": ..., "severity": ...}）
    """
    ticker_lessons = get_lessons_for_ticker(ticker)
    if not ticker_lessons:
        return []

    warnings = []

    for lesson in ticker_lessons:
        trigger_text = lesson.get("trigger", "").lower()
        matched = False

        # シグナルとトリガーキーワードのマッチング
        if signals:
            for signal in signals:
                keywords = SIGNAL_KEYWORDS.get(signal, [signal])
                if any(kw.lower() in trigger_text for kw in keywords):
                    matched = True
                    break

        # シグナル指定なしの場合は全レッスンを表示
        if not signals:
            matched = True

        if matched:
            warnings.append({
                "ticker": ticker,
                "date": lesson.get("date", ""),
                "trigger": lesson.get("trigger", ""),
                "lesson": lesson.get("lesson", ""),
                "next_action": lesson.get("next_action", ""),
                "severity": "high" if "高値掴み" in trigger_text or "損切り" in trigger_text else "medium",
            })

    return warnings


def format_lesson_warnings(ticker: str, signals: Optional[list[str]] = None) -> str:
    """
    警告ブロックを文字列で返す（レポート・スクリーニング結果に挿入する用）
    """
    warnings = check_warnings(ticker, signals)
    if not warnings:
        return ""

    lines = [
        f"\n⚠️  過去レッスン警告: {ticker}",
        "─" * 50,
    ]
    for w in warnings:
        sev = "🔴" if w["severity"] == "high" else "🟡"
        lines.append(f"{sev} [{w['date']}] {w['trigger']}")
        lines.append(f"   → {w['lesson']}")
        if w.get("next_action"):
            lines.append(f"   対応: {w['next_action']}")
    lines.append("─" * 50)
    return "\n".join(lines)


def list_all_lessons(limit: int = 20) -> list[dict]:
    """最新のレッスンを一覧返す"""
    lessons = _load_lessons()
    return sorted(lessons, key=lambda x: x.get("created_at", ""), reverse=True)[:limit]


def delete_lesson(lesson_id: int) -> bool:
    """レッスンIDで削除する"""
    lessons = _load_lessons()
    new_lessons = [l for l in lessons if l.get("id") != lesson_id]
    if len(new_lessons) == len(lessons):
        return False
    _save_lessons(new_lessons)
    return True
