"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { DayType, ScheduleResult, TimeBlock } from "@/types";

const BLOCK_COLORS: Record<string, string> = {
  sleep: "#1e3a5f",
  work: "#374151",
  commute: "#78716c",
  task: "#1d4ed8",
  fitness: "#7c3aed",
  break: "#065f46",
  meal: "#92400e",
  deep_work: "#854d0e",
  free: "#1f2937",
  routine: "#1f2937",
};

const BLOCK_LABEL: Record<string, string> = {
  sleep: "睡眠",
  work: "仕事",
  commute: "通勤",
  task: "作業",
  fitness: "筋トレ",
  break: "休憩",
  meal: "食事",
  deep_work: "ディープワーク⚡",
  free: "自由",
  routine: "ルーティン",
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const DAY_END = 24 * 60;

function blockPosition(block: TimeBlock, dayStart: number): { top: number; height: number } {
  const dayTotal = DAY_END - dayStart;
  let startMin = timeToMinutes(block.start_time);
  let endMin = timeToMinutes(block.end_time);
  if (endMin <= startMin) endMin = DAY_END;
  const top = ((startMin - dayStart) / dayTotal) * 100;
  const height = ((endMin - startMin) / dayTotal) * 100;
  return { top: Math.max(0, top), height: Math.max(0.2, height) };
}

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function findCurrentBlock(blocks: TimeBlock[], nowMin: number): TimeBlock | null {
  return (
    blocks.find((b) => {
      const start = timeToMinutes(b.start_time);
      let end = timeToMinutes(b.end_time);
      if (end <= start) end = DAY_END;
      return nowMin >= start && nowMin < end;
    }) ?? null
  );
}

function isTaskSlot(block: TimeBlock): boolean {
  return block.type === "deep_work" || block.type === "task";
}

// AI計画で置き換えるべきブロックタイプ
function isReplaceable(block: TimeBlock): boolean {
  return block.type === "deep_work" || block.type === "task" || block.type === "free";
}

// AI計画ブロックを固定スケジュールにマージ
function mergeWithAiBlocks(baseBlocks: TimeBlock[], aiBlocks: TimeBlock[]): TimeBlock[] {
  const fixed = baseBlocks.filter((b) => !isReplaceable(b));
  return [...fixed, ...aiBlocks].sort(
    (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  );
}

const GRAPH_HEIGHT = 720; // px（グラフ固定高さ）

function snapToFive(min: number): number {
  return Math.round(min / 5) * 5;
}

// ブロックIDが custom かどうか（AI生成・custom どちらでもない基本ブロック）
function isBaseBlock(id: string): boolean {
  return !id.startsWith("ai-block-");
}

// Supabase経由でAI計画・スロットノートを保存/取得
async function savePlan(date: string, updates: {
  ai_blocks?: unknown;
  plan_text?: string;
  slot_notes?: unknown;
  custom_blocks?: unknown;
}) {
  await fetch("/api/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, ...updates }),
  });
}

export default function DailyTimeline({
  date,
  dayType,
  wakeTime = "06:30",
}: {
  date: string;
  dayType: DayType;
  wakeTime?: string;
}) {
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TimeBlock | null>(null);
  const [nowMin, setNowMin] = useState(getCurrentMinutes());

  // スロットノート（テキスト）
  const [slotNotes, setSlotNotes] = useState<Record<string, string>>({});
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const nowLineRef = useRef<HTMLDivElement>(null);
  const isToday = date === new Date().toISOString().split("T")[0];

  // AI計画
  const [showPlanInput, setShowPlanInput] = useState(false);
  const [viewMode, setViewMode] = useState<"graph" | "list">("list");
  const [planFocus, setPlanFocus] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [aiBlocks, setAiBlocks] = useState<TimeBlock[] | null>(null);
  const [aiPlanText, setAiPlanText] = useState<string>("");

  // カスタム時刻上書き: blockId → { start_time, end_time }
  const [customBlocks, setCustomBlocks] = useState<Record<string, { start_time: string; end_time: string }>>({});

  // ドラッグ状態
  const [dragState, setDragState] = useState<{
    blockId: string;
    origStartMin: number;
    durationMin: number;
    pointerStartY: number;
    offsetMin: number; // 現在のドラッグ量（分）
  } | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);

  // 時刻編集（選択パネル）
  const [timeEdit, setTimeEdit] = useState<{ blockId: string; start: string; end: string } | null>(null);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule?date=${date}&day_type=${dayType}&wake_time=${wakeTime}`);
      const data = await res.json();
      setSchedule(data);
    } finally {
      setLoading(false);
    }
  }, [date, dayType, wakeTime]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  // dateが変わったらSupabaseからAI計画・スロットノートを取得
  useEffect(() => {
    setAiBlocks(null);
    setAiPlanText("");
    setSlotNotes({});
    setCustomBlocks({});
    setTimeEdit(null);
    fetch(`/api/plans?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data) return;
        if (data.ai_blocks) setAiBlocks(data.ai_blocks);
        if (data.plan_text) setAiPlanText(data.plan_text);
        if (data.slot_notes) setSlotNotes(data.slot_notes);
        if (data.custom_blocks) setCustomBlocks(data.custom_blocks);
      })
      .catch(() => {/* 無視 */});
  }, [date]);

  // 1分ごとに現在時刻更新
  useEffect(() => {
    const timer = setInterval(() => setNowMin(getCurrentMinutes()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (editingSlot && editInputRef.current) editInputRef.current.focus();
  }, [editingSlot]);

  // スケジュール読み込み後、今日の場合は現在時刻に自動スクロール
  useEffect(() => {
    if (schedule && isToday && nowLineRef.current && viewMode === "graph") {
      setTimeout(() => {
        nowLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
    }
  }, [schedule, isToday, viewMode]);

  const dayStart = timeToMinutes(wakeTime);
  const dayTotal = DAY_END - dayStart;

  const currentBlock = schedule
    ? findCurrentBlock(aiBlocks ? mergeWithAiBlocks(schedule.blocks, aiBlocks) : schedule.blocks, nowMin)
    : null;

  const nowPos = ((nowMin - dayStart) / dayTotal) * 100;

  // 表示ブロック（AI計画があれば上書き）
  const displayBlocks = schedule
    ? aiBlocks
      ? mergeWithAiBlocks(schedule.blocks, aiBlocks)
      : schedule.blocks
    : [];

  // custom_blocks / ドラッグ上書きを適用した最終ブロック一覧
  const effectiveBlocks = displayBlocks.map((block) => {
    // ドラッグ中のブロック
    if (dragState?.blockId === block.id) {
      const newStart = Math.max(dayStart, Math.min(DAY_END - dragState.durationMin,
        dragState.origStartMin + dragState.offsetMin));
      const newEnd = newStart + dragState.durationMin;
      return { ...block, start_time: minutesToTime(newStart), end_time: minutesToTime(newEnd),
               duration_minutes: dragState.durationMin };
    }
    // 保存済みカスタム上書き
    const ov = customBlocks[block.id];
    if (ov) {
      return { ...block, ...ov,
               duration_minutes: timeToMinutes(ov.end_time) - timeToMinutes(ov.start_time) };
    }
    return block;
  });

  // ===== ドラッグハンドラ =====
  const handleDragStart = (e: React.PointerEvent, block: TimeBlock) => {
    if (!isBaseBlock(block.id) && !block.id.startsWith("ai-block-")) return;
    e.preventDefault();
    e.stopPropagation();
    const startMin = timeToMinutes(block.start_time);
    let endMin = timeToMinutes(block.end_time);
    if (endMin <= startMin) endMin = DAY_END;
    const duration = endMin - startMin;
    setDragState({ blockId: block.id, origStartMin: startMin, durationMin: duration,
                   pointerStartY: e.clientY, offsetMin: 0 });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    const mpp = dayTotal / GRAPH_HEIGHT; // minutes per pixel
    const raw = (e.clientY - dragState.pointerStartY) * mpp;
    const snapped = snapToFive(raw);
    const minOff = dayStart - dragState.origStartMin;
    const maxOff = DAY_END - dragState.origStartMin - dragState.durationMin;
    setDragState(prev => prev ? { ...prev, offsetMin: Math.max(minOff, Math.min(maxOff, snapped)) } : null);
  };

  const handleDragEnd = () => {
    if (!dragState) return;
    const { blockId, origStartMin, durationMin, offsetMin } = dragState;
    if (offsetMin !== 0) {
      const newStart = Math.max(dayStart, Math.min(DAY_END - durationMin, origStartMin + offsetMin));
      const newEnd = newStart + durationMin;
      const updated = { ...customBlocks, [blockId]: { start_time: minutesToTime(newStart), end_time: minutesToTime(newEnd) } };
      setCustomBlocks(updated);
      savePlan(date, { custom_blocks: updated });
    }
    setDragState(null);
  };

  // ===== 時刻直接編集 =====
  const handleSaveTimeEdit = () => {
    if (!timeEdit) return;
    const { blockId, start, end } = timeEdit;
    const updated = { ...customBlocks, [blockId]: { start_time: start, end_time: end } };
    setCustomBlocks(updated);
    savePlan(date, { custom_blocks: updated });
    setTimeEdit(null);
  };

  const handleResetBlock = (blockId: string) => {
    const updated = { ...customBlocks };
    delete updated[blockId];
    setCustomBlocks(updated);
    savePlan(date, { custom_blocks: updated });
    setTimeEdit(null);
  };

  // スロットノート保存（Supabase）
  const handleSaveSlotNote = (blockKey: string) => {
    const updated = { ...slotNotes, [blockKey]: editText };
    setSlotNotes(updated);
    savePlan(date, { slot_notes: updated });
    setEditingSlot(null);
    setEditText("");
  };

  // AI計画実行
  const handleAIPlan = async () => {
    if (!planFocus.trim()) return;
    setPlanLoading(true);
    try {
      const res = await fetch("/api/schedule/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, day_type: dayType, focus: planFocus }),
      });
      const data = await res.json();
      if (data.ai_blocks && Array.isArray(data.ai_blocks)) {
        const planText = data.plan ?? "";
        setAiBlocks(data.ai_blocks);
        setAiPlanText(planText);
        // Supabaseに保存（デバイス間同期）
        await savePlan(date, { ai_blocks: data.ai_blocks, plan_text: planText });
        setShowPlanInput(false);
        setPlanFocus("");
      }
    } catch {
      alert("エラーが発生しました");
    } finally {
      setPlanLoading(false);
    }
  };

  // AI計画クリア（Supabaseからも削除）
  const handleClearAiPlan = async () => {
    setAiBlocks(null);
    setAiPlanText("");
    await fetch(`/api/plans?date=${date}`, { method: "DELETE" });
  };

  // 時刻マーク（起床時刻から23時まで）
  const wakeHour = Math.floor(dayStart / 60);
  const hourMarks = Array.from({ length: 24 - wakeHour }, (_, i) => {
    const hour = wakeHour + i;
    // 最初のマークは起床時刻ちょうど、以降は整時
    const min = i === 0 ? dayStart : hour * 60;
    const pos = ((min - dayStart) / dayTotal) * 100;
    const mm = min % 60;
    return {
      label: `${String(hour).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      pos,
    };
  }).filter(m => m.pos <= 100);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      {/* ヘッダー */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-lg">📅</span>
          <span className="font-semibold text-gray-200">タイムライン</span>
          {aiBlocks && (
            <span className="text-xs bg-amber-900/60 text-amber-300 border border-amber-700 px-2 py-0.5 rounded-full">
              🤖 AI計画中
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* グラフ/リスト切替 */}
          <div className="flex bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            <button
              onClick={() => setViewMode("graph")}
              className={`text-xs px-2 py-1 transition-colors ${viewMode === "graph" ? "bg-blue-700 text-white" : "text-gray-400 hover:text-gray-200"}`}
            >
              📊
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`text-xs px-2 py-1 transition-colors ${viewMode === "list" ? "bg-blue-700 text-white" : "text-gray-400 hover:text-gray-200"}`}
            >
              📋
            </button>
          </div>
          {aiBlocks ? (
            <button
              onClick={handleClearAiPlan}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              AI計画をクリア
            </button>
          ) : (
            <button
              onClick={() => setShowPlanInput((v) => !v)}
              className="text-xs bg-amber-900/60 hover:bg-amber-800/60 text-amber-300 px-2 py-1 rounded transition-colors"
            >
              🤖 AIで計画
            </button>
          )}
          <button
            onClick={fetchSchedule}
            className="text-xs text-gray-400 hover:text-blue-400 transition-colors"
          >
            更新
          </button>
        </div>
      </div>

      {/* 現在時刻バナー（今日のみ） */}
      {isToday && currentBlock && (
        <div className="px-4 py-2 bg-blue-950/50 border-b border-blue-900/50 flex items-center gap-2">
          <span className="text-blue-300 text-xs font-mono font-bold">
            {minutesToTime(nowMin)}
          </span>
          <span className="text-gray-400 text-xs">›</span>
          <span className="text-blue-200 text-xs font-medium">
            {currentBlock.is_golden_time ? "⚡ " : ""}
            {slotNotes[`${currentBlock.start_time}-${currentBlock.end_time}`] || currentBlock.title}
          </span>
          <span className="text-gray-500 text-xs ml-auto">
            〜{currentBlock.end_time}
          </span>
        </div>
      )}

      {/* AI計画サマリー（計画中の場合） */}
      {aiBlocks && aiPlanText && (
        <div className="px-4 py-2 bg-amber-950/20 border-b border-amber-900/30">
          <p className="text-xs text-amber-300">
            <span className="font-semibold">🤖 今日の計画:</span> {aiPlanText}
          </p>
        </div>
      )}

      {/* AI計画入力パネル */}
      {showPlanInput && !aiBlocks && (
        <div className="px-4 py-3 bg-amber-950/30 border-b border-amber-900/30 space-y-2">
          <p className="text-xs text-amber-300 font-semibold">
            今日やりたいことをClaudeに伝えてください
          </p>
          <textarea
            value={planFocus}
            onChange={(e) => setPlanFocus(e.target.value)}
            placeholder={`例：\n朝はVFXのコンポジット作業を90分やって、残りで英語をやりたい。\n夜はSNS投稿とFOOH素材の収集をしたい。`}
            rows={4}
            className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none border border-gray-600"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAIPlan}
              disabled={planLoading || !planFocus.trim()}
              className="flex-1 py-2 bg-amber-700 hover:bg-amber-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {planLoading ? "🤖 Claudeがスケジュールを組んでいます..." : "🤖 タイムラインに反映"}
            </button>
            <button
              onClick={() => setShowPlanInput(false)}
              className="px-3 py-2 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="px-4 py-8 text-center text-gray-500 text-sm">読み込み中...</div>
      ) : schedule ? (
        <div className="px-4 pb-4">

          {/* ===== リスト表示モード ===== */}
          {viewMode === "list" && (() => {
            const listBlocks = effectiveBlocks.filter(b => b.type !== "sleep");

            // 朝/昼/夜の判定
            function getTimeSection(startTime: string): "morning" | "afternoon" | "evening" {
              const m = timeToMinutes(startTime);
              if (m < 12 * 60) return "morning";
              if (m < 18 * 60) return "afternoon";
              return "evening";
            }
            const sectionConfig = {
              morning:   { label: "🌅 朝",  headerBg: "bg-amber-950/40",  headerText: "text-amber-300",  rowBg: "bg-amber-950/10",  borderLeft: "border-l-2 border-amber-700/60" },
              afternoon: { label: "☀️ 昼",  headerBg: "bg-sky-950/40",    headerText: "text-sky-300",    rowBg: "bg-sky-950/10",    borderLeft: "border-l-2 border-sky-700/60" },
              evening:   { label: "🌙 夜",  headerBg: "bg-indigo-950/40", headerText: "text-indigo-300", rowBg: "bg-indigo-950/10", borderLeft: "border-l-2 border-indigo-700/60" },
            };

            let lastSection: string | null = null;
            const rows: React.ReactNode[] = [];

            listBlocks.forEach((block) => {
              const section = getTimeSection(block.start_time);
              const cfg = sectionConfig[section];
              const note = slotNotes[`${block.start_time}-${block.end_time}`];
              const isNow = isToday &&
                timeToMinutes(block.start_time) <= nowMin &&
                nowMin < timeToMinutes(block.end_time);

              // セクションヘッダー挿入
              if (section !== lastSection) {
                lastSection = section;
                rows.push(
                  <tr key={`header-${section}`} className={`${cfg.headerBg}`}>
                    <td colSpan={3} className={`px-2 py-1 text-xs font-bold ${cfg.headerText}`}>
                      {cfg.label}
                    </td>
                  </tr>
                );
              }

              const rowBg = isNow ? "bg-blue-950/70" : cfg.rowBg;
              rows.push(
                <tr key={block.id} className={`border-t border-gray-800/60 ${rowBg} ${cfg.borderLeft}`}>
                  <td className="px-2 py-1.5 font-mono text-gray-400 whitespace-nowrap text-[11px]">
                    {block.start_time}
                    <span className="text-gray-600">〜{block.end_time}</span>
                  </td>
                  <td className="px-2 py-1.5 text-gray-200 text-xs">
                    {block.is_golden_time && <span className="text-amber-400 mr-1">⚡</span>}
                    {isNow && <span className="text-blue-400 mr-1">▶</span>}
                    {note || block.title}
                  </td>
                  <td className="px-2 py-1.5 text-right text-gray-500 text-xs">
                    {block.duration_minutes}
                  </td>
                </tr>
              );
            });

            return (
              <div className="mt-3 rounded-lg overflow-hidden border border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-800 text-gray-400">
                      <th className="text-left px-2 py-1.5 font-medium w-24">時刻</th>
                      <th className="text-left px-2 py-1.5 font-medium">内容</th>
                      <th className="text-right px-2 py-1.5 font-medium w-10">分</th>
                    </tr>
                  </thead>
                  <tbody>{rows}</tbody>
                </table>
              </div>
            );
          })()}

          {/* overflow todos */}
          {!aiBlocks && schedule.overflow_todos.length > 0 && (
            <div className="my-3 bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
              <p className="text-yellow-400 text-xs font-semibold mb-1">
                ⚠ 配置できなかったタスク ({schedule.overflow_todos.length}件)
              </p>
              {schedule.overflow_todos.map((t) => (
                <p key={t.id} className="text-yellow-300 text-xs">
                  • {t.title} ({t.estimated_minutes}分)
                </p>
              ))}
            </div>
          )}

          {/* ===== グラフ表示モード ===== */}
          <div className={`flex gap-2 mt-3 ${viewMode === "list" ? "hidden" : ""}`}>
            {/* 時刻軸 */}
            <div className="relative w-12 shrink-0" style={{ height: "720px" }}>
              {hourMarks.map((mark) => (
                <div
                  key={mark.label}
                  className="absolute right-0 text-gray-500 text-xs"
                  style={{ top: `${mark.pos}%`, transform: "translateY(-50%)" }}
                >
                  {mark.label}
                </div>
              ))}
            </div>

            {/* ブロック */}
            <div
              ref={graphRef}
              className="relative flex-1 touch-none"
              style={{ height: `${GRAPH_HEIGHT}px` }}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerLeave={handleDragEnd}
            >
              {/* グリッド線 */}
              {hourMarks.map((mark) => (
                <div
                  key={mark.label}
                  className="absolute left-0 right-0 border-t border-gray-800"
                  style={{ top: `${mark.pos}%` }}
                />
              ))}

              {effectiveBlocks.map((block) => {
                const { top, height } = blockPosition(block, dayStart);
                const bg = BLOCK_COLORS[block.type] ?? "#1f2937";
                const noteKey = `${block.start_time}-${block.end_time}`;
                const note = slotNotes[noteKey];
                const isEditing = editingSlot === noteKey;
                const isAiBlock = block.id.startsWith("ai-block-");
                const isCustomized = !!customBlocks[block.id];
                const isDragging = dragState?.blockId === block.id;

                return (
                  <div
                    key={block.id}
                    className={`absolute left-0 right-0 rounded overflow-hidden border group ${
                      isDragging ? "opacity-80 z-30 shadow-lg shadow-black/50 cursor-grabbing" :
                      isAiBlock   ? "border-amber-600/50 ring-1 ring-amber-700/30" :
                      isCustomized ? "border-cyan-500/60 ring-1 ring-cyan-600/30" :
                      "border-black/20"
                    }`}
                    style={{
                      top: `${top}%`,
                      height: `${height}%`,
                      backgroundColor: bg,
                      minHeight: "4px",
                      transition: isDragging ? "none" : "top 0.15s, height 0.15s",
                    }}
                  >
                    {/* クリックで選択 */}
                    <button
                      onClick={() => { if (!isDragging) setSelected(selected?.id === block.id ? null : block); }}
                      className="absolute inset-0 w-full h-full text-left hover:brightness-125 transition-all"
                    />
                    {height > 1.5 && (
                      <div className="px-1.5 py-0.5 pointer-events-none">
                        {/* 開始・終了時刻 */}
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-white/70 text-[10px] font-mono leading-none">
                            {block.start_time}
                          </span>
                          {height > 3 && (
                            <span className="text-white/50 text-[10px] font-mono leading-none">
                              〜{block.end_time}
                            </span>
                          )}
                        </div>
                        {/* タイトル行 */}
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-white text-xs font-medium truncate leading-tight">
                            {block.is_golden_time ? "⚡ " : ""}
                            {isCustomized && <span className="text-cyan-300 mr-0.5">✎</span>}
                            {isAiBlock ? (
                              <span className="text-amber-200">{block.title}</span>
                            ) : (
                              note || block.title
                            )}
                          </span>
                          {isTaskSlot(block) && !isAiBlock && height > 3 && (
                            <button
                              className="pointer-events-auto shrink-0 text-white/50 hover:text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSlot(noteKey);
                                setEditText(note || "");
                              }}
                            >
                              ✏
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {/* ドラッグハンドル（高さがある場合のみ） */}
                    {height > 2.5 && block.type !== "sleep" && (
                      <div
                        className="pointer-events-auto absolute right-1 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/80 cursor-grab active:cursor-grabbing text-xs select-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onPointerDown={(e) => handleDragStart(e, block)}
                        title="ドラッグで移動"
                      >
                        ⠿
                      </div>
                    )}

                    {/* スロット編集UI */}
                    {isEditing && (
                      <div
                        className="absolute inset-0 bg-gray-900/95 z-10 p-2 flex flex-col gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-xs text-gray-400">
                          {block.start_time}–{block.end_time} の内容
                        </p>
                        <input
                          ref={editInputRef}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          placeholder={block.title}
                          className="flex-1 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveSlotNote(noteKey);
                            if (e.key === "Escape") setEditingSlot(null);
                          }}
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSaveSlotNote(noteKey)}
                            className="flex-1 text-xs bg-blue-700 hover:bg-blue-600 text-white rounded py-0.5 transition-colors"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingSlot(null)}
                            className="flex-1 text-xs bg-gray-700 text-gray-300 rounded py-0.5 hover:bg-gray-600 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 現在時刻ライン */}
              {isToday && nowMin >= dayStart && nowMin <= DAY_END && (
                <div
                  ref={nowLineRef}
                  className="absolute left-0 right-0 z-20 pointer-events-none"
                  style={{ top: `${nowPos}%` }}
                >
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded-full shrink-0 shadow-lg shadow-red-500/50" />
                    <div className="flex-1 h-0.5 bg-red-500 shadow-sm" />
                    <span className="text-red-400 text-[10px] font-mono font-bold pr-1">
                      {minutesToTime(nowMin)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 選択ブロック詳細 */}
          {selected && (() => {
            const eff = effectiveBlocks.find(b => b.id === selected.id) ?? selected;
            const isCustomized = !!customBlocks[selected.id];
            return (
              <div className="mt-3 bg-gray-800 rounded-lg p-3 border border-gray-600">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-200 text-sm">
                    {eff.is_golden_time ? "⚡ " : ""}
                    {isCustomized && <span className="text-cyan-400 text-xs mr-1">✎編集済み</span>}
                    {slotNotes[`${eff.start_time}-${eff.end_time}`] || eff.title}
                  </span>
                  <button onClick={() => { setSelected(null); setTimeEdit(null); }}
                    className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
                </div>
                <p className="text-gray-400 text-xs">
                  {eff.start_time} → {eff.end_time}（{eff.duration_minutes}分）
                </p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {BLOCK_LABEL[eff.type] ?? eff.type}
                  {eff.id.startsWith("ai-block-") && <span className="ml-2 text-amber-500">🤖 AI計画</span>}
                </p>

                {/* 時刻編集UI */}
                {eff.type !== "sleep" && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    {timeEdit?.blockId === selected.id ? (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400 font-medium">🕐 時刻を変更</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={timeEdit.start}
                            onChange={e => setTimeEdit({ ...timeEdit, start: e.target.value })}
                            className="flex-1 bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 border border-gray-600"
                          />
                          <span className="text-gray-500 text-xs">〜</span>
                          <input
                            type="time"
                            value={timeEdit.end}
                            onChange={e => setTimeEdit({ ...timeEdit, end: e.target.value })}
                            className="flex-1 bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 border border-gray-600"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveTimeEdit}
                            className="flex-1 py-1 bg-cyan-700 hover:bg-cyan-600 text-white text-xs rounded transition-colors"
                          >保存</button>
                          <button
                            onClick={() => setTimeEdit(null)}
                            className="flex-1 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600 transition-colors"
                          >キャンセル</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setTimeEdit({ blockId: selected.id, start: eff.start_time, end: eff.end_time })}
                          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >🕐 時刻を直接変更</button>
                        {isCustomized && (
                          <button
                            onClick={() => handleResetBlock(selected.id)}
                            className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1"
                          >↩ 元の時刻に戻す</button>
                        )}
                        {isTaskSlot(eff) && !eff.id.startsWith("ai-block-") && (
                          <button
                            onClick={() => {
                              const noteKey = `${eff.start_time}-${eff.end_time}`;
                              setEditingSlot(noteKey);
                              setEditText(slotNotes[noteKey] || "");
                              setSelected(null);
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >✏ 内容メモ</button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ヒント */}
          <p className="mt-2 text-xs text-gray-600 text-center">
            {aiBlocks
              ? "🤖 AI計画中 | タップ→詳細 | 「AI計画をクリア」で元に戻す"
              : "タップ→詳細 | ✏ホバーで内容メモ | 🤖AIで計画を組む"}
          </p>

          {/* 凡例 */}
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(BLOCK_COLORS)
              .filter(([k]) => k !== "routine")
              .map(([type, color]) => (
                <div key={type} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-gray-400 text-xs">{BLOCK_LABEL[type] ?? type}</span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-gray-500 text-sm">
          スケジュールを取得できませんでした
        </div>
      )}
    </div>
  );
}
