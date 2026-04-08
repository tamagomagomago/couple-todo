"use client";

import { useState, useEffect, useCallback } from "react";
import { Todo, CreateTodoInput, GeneratedTodo, PreferredTime } from "@/types";

// 優先度ラベル→数値
const PRIORITY_TO_NUM: Record<string, number> = { 高: 1, 中: 3, 低: 5 };
// 数値→ラベル
function numToLabel(n: number): string {
  if (n <= 2) return "高";
  if (n <= 3) return "中";
  return "低";
}

const PRIORITY_BADGE: Record<string, string> = {
  高: "bg-red-900/60 text-red-300 border border-red-700",
  中: "bg-yellow-900/60 text-yellow-300 border border-yellow-700",
  低: "bg-green-900/60 text-green-300 border border-green-700",
};

const CAT_BADGE = "bg-blue-900/60 text-blue-300 border border-blue-700";

const PRESET_CATEGORIES = ["vfx", "english", "engineer", "investment", "fitness", "personal"];

const TIME_PREF_OPTIONS: { value: PreferredTime; label: string; emoji: string }[] = [
  { value: "morning",   label: "朝",   emoji: "🌅" },
  { value: "afternoon", label: "昼",   emoji: "☀️" },
  { value: "evening",   label: "夜",   emoji: "🌙" },
];

const CATEGORY_EMOJI: Record<string, string> = {
  vfx: "🎬",
  english: "🗣️",
  engineer: "📐",
  investment: "💰",
  fitness: "💪",
  personal: "⭐",
};

// ルーティンテンプレート（平日・休日）
const DMM_CAMP_END = "2026-04-20";

interface RoutineTemplate {
  title: string;
  category: string;
  estimated_minutes: number;
  preferred_time: PreferredTime;
  note: string;
}

function getRoutineTemplates(): RoutineTemplate[] {
  const today = new Date().toISOString().split("T")[0];
  const isWeekend = [0, 6].includes(new Date().getDay());
  const hasDmmCamp = today <= DMM_CAMP_END;

  // 朝ルーティン
  const morningRoutines = [
    { title: "スマホアラームで即座にベッドを出る", category: "personal", estimated_minutes: 1, preferred_time: "morning", note: "6:30起床 5秒以内" },
    { title: "着替える", category: "personal", estimated_minutes: 5, preferred_time: "morning", note: "起床直後" },
    { title: "冷たい水をコップ1杯飲む", category: "personal", estimated_minutes: 2, preferred_time: "morning", note: "スマホの上の水" },
  ];

  // 夜ルーティン
  const eveningRoutines = [
    { title: "シャワー浴びる", category: "personal", estimated_minutes: 15, preferred_time: "evening", note: "21:00" },
    { title: "スマホを別室に置く", category: "personal", estimated_minutes: 3, preferred_time: "evening", note: "22:00 スマホの上に水を置く" },
    { title: "部屋を薄暗くする", category: "personal", estimated_minutes: 2, preferred_time: "evening", note: "22:00" },
    { title: "瞑想・日記・読書", category: "personal", estimated_minutes: 30, preferred_time: "evening", note: "22:00〜22:30" },
    { title: "ベッドに入る", category: "personal", estimated_minutes: 5, preferred_time: "evening", note: "23:00" },
  ];

  if (isWeekend) {
    return [
      ...morningRoutines,
      { title: "Duolingo & Speak", category: "english", estimated_minutes: 15, preferred_time: "morning" as const, note: "起床後15分" },
      { title: "VFX作業", category: "vfx", estimated_minutes: 120, preferred_time: "morning" as const, note: "朝2時間" },
      { title: "飯・休憩", category: "personal", estimated_minutes: 30, preferred_time: "afternoon" as const, note: "19:00〜19:30" },
      { title: "技術士", category: "engineer", estimated_minutes: 120, preferred_time: "afternoon" as const, note: "19:30〜21:30" },
      { title: "VFX", category: "vfx", estimated_minutes: 30, preferred_time: "evening" as const, note: "21:30〜22:00" },
      ...eveningRoutines,
    ] satisfies RoutineTemplate[];
  }

  return [
    ...morningRoutines,
    { title: "Duolingo & Speak", category: "english", estimated_minutes: 15, preferred_time: "morning" as const, note: "起床後15分" },
    { title: "VFX作業", category: "vfx", estimated_minutes: 120, preferred_time: "morning" as const, note: "朝2時間" },
    { title: "技術士（通勤）", category: "engineer", estimated_minutes: 60, preferred_time: "morning" as const, note: "通勤往復1時間" },
    { title: "飯・休憩", category: "personal", estimated_minutes: 30, preferred_time: "afternoon" as const, note: "19:00〜19:30" },
    hasDmmCamp
      ? { title: "DMMキャンプ", category: "english", estimated_minutes: 120, preferred_time: "afternoon" as const, note: "19:30〜21:30（4/20まで）" }
      : { title: "技術士", category: "engineer", estimated_minutes: 120, preferred_time: "afternoon" as const, note: "19:30〜21:30" },
    { title: "技術士30分", category: "engineer", estimated_minutes: 30, preferred_time: "evening" as const, note: "21:30〜22:00" },
    ...eveningRoutines,
  ] satisfies RoutineTemplate[];
}

function getCatEmoji(cat: string): string {
  return CATEGORY_EMOJI[cat] ?? "📌";
}

// 空フォーム
function emptyForm(): CreateTodoInput {
  return {
    title: "",
    priority: 3,
    estimated_minutes: 30,
    category: "personal",
    is_today: false,
    due_date: undefined,
  };
}

// 期限警告判定：今日から2日以内か
function isDeadlineSoon(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return daysLeft >= 0 && daysLeft <= 2;
}

// ミニTODOカード（マスターリスト用）
function MasterTodoCard({
  todo,
  onMoveToToday,
  onEdit,
  onDelete,
  isSelectedFocus,
}: {
  todo: Todo;
  onMoveToToday: (id: number) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: number) => void;
  isSelectedFocus?: boolean;
}) {
  const [isChecked, setIsChecked] = useState(false);

  const handleCheckChange = (checked: boolean) => {
    setIsChecked(checked);
    if (checked) {
      onMoveToToday(todo.id);
    }
  };

  const priorityLabel = numToLabel(todo.priority);
  const hasDeadlineSoon = isDeadlineSoon(todo.due_date);
  const borderClass = isSelectedFocus
    ? "border-cyan-500 bg-cyan-950/40"
    : hasDeadlineSoon
    ? "border-red-600 bg-red-950/30"
    : "border-gray-700 bg-gray-800";

  return (
    <div className={`${borderClass} rounded-lg p-2.5 hover:border-gray-600 transition-colors border ${isSelectedFocus ? "ring-2 ring-cyan-500/40" : ""}`} style={isSelectedFocus ? { boxShadow: "0 0 12px rgba(34, 211, 238, 0.3)" } : {}}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-gray-200 text-sm font-medium leading-tight break-words">
            {todo.title}
          </p>
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_BADGE[priorityLabel]}`}>
              {priorityLabel}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${CAT_BADGE}`}>
              {getCatEmoji(todo.category)} {todo.category}
            </span>
            <span className="text-gray-500 text-xs">⏱{todo.estimated_minutes}分</span>
            {todo.due_date && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${hasDeadlineSoon ? "bg-red-900/60 text-red-300 border border-red-700" : "bg-purple-900/60 text-purple-300 border border-purple-700"}`}>
                📅 {new Date(todo.due_date).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => handleCheckChange(e.target.checked)}
              className="w-4 h-4 rounded border border-gray-600 bg-gray-700 cursor-pointer"
            />
            <span className="text-xs text-blue-300">今日へ</span>
          </label>
          <div className="flex gap-1 justify-end">
            <button
              onClick={() => onEdit(todo)}
              className="text-gray-500 hover:text-blue-400 text-xs"
            >
              編集
            </button>
            <button
              onClick={() => onDelete(todo.id)}
              className="text-gray-500 hover:text-red-400 text-xs"
            >
              削除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 今日のTODOカード
function TodayTodoCard({
  todo,
  onToggle,
  onRemove,
  onSetPreferredTime,
  onSetPriority,
  onEditTitle,
  onSetFocus,
  onDragStart,
  onDragOver,
  onDrop,
  isSelectedFocus,
}: {
  todo: Todo;
  onToggle: (id: number, completed: boolean) => void;
  onRemove: (id: number) => void;
  onSetPreferredTime: (id: number, t: PreferredTime | null) => void;
  onSetPriority: (id: number, p: number) => void;
  onEditTitle: (id: number, title: string) => void;
  onSetFocus: (todo: Todo) => void;
  onDragStart?: (id: number, e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (id: number, e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (id: number, e: React.DragEvent<HTMLDivElement>) => void;
  isSelectedFocus?: boolean;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(todo.title);
  const priorityLabel = numToLabel(todo.priority);

  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft.trim() !== todo.title) {
      onEditTitle(todo.id, titleDraft.trim());
    }
    setEditingTitle(false);
  };

  const PRIORITY_OPTS = [
    { label: "高", val: 1 },
    { label: "中", val: 3 },
    { label: "低", val: 5 },
  ];

  return (
    <div
      draggable={!todo.is_completed}
      onDragStart={(e) => onDragStart?.(todo.id, e)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(todo.id, e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.(todo.id, e);
      }}
      className={`border rounded-lg p-2.5 transition-all ${
        isSelectedFocus
          ? "bg-cyan-900/30 border-cyan-500 ring-2 ring-cyan-500/40 cursor-move"
          : todo.is_completed
          ? "bg-gray-800 border-gray-700 opacity-60"
          : "bg-gray-800 border-gray-600 cursor-move hover:border-blue-500/50"
      }`}
      style={isSelectedFocus ? { boxShadow: "0 0 12px rgba(34, 211, 238, 0.3)" } : {}}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={todo.is_completed}
          onChange={() => onToggle(todo.id, !todo.is_completed)}
          className="mt-0.5 w-5 h-5 shrink-0 cursor-pointer accent-green-500"
        />
        <div className="flex-1 min-w-0">
          {/* タイトル（タップで編集） */}
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(todo.title); }
              }}
              className="w-full bg-gray-700 text-gray-200 text-sm rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : (
            <p
              onClick={() => { if (!todo.is_completed) { setEditingTitle(true); setTitleDraft(todo.title); } }}
              className={`text-sm font-medium leading-tight break-words ${
                todo.is_completed ? "line-through text-gray-500" : "text-gray-200 cursor-text hover:text-white"
              }`}
              title="タップで名前を編集"
            >
              {todo.title}
            </p>
          )}

          {/* バッジ行 */}
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_BADGE[priorityLabel]}`}>
              {priorityLabel}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${CAT_BADGE}`}>
              {getCatEmoji(todo.category)} {todo.category}
            </span>
            <span className="text-gray-500 text-xs">⏱{todo.estimated_minutes}分</span>
          </div>

          {!todo.is_completed && (
            <>
              {/* 優先度選択 */}
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-gray-600 text-xs shrink-0">優先度:</span>
                {PRIORITY_OPTS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => onSetPriority(todo.id, p.val)}
                    className={`text-xs px-2 py-0.5 rounded border transition-all ${
                      todo.priority === p.val
                        ? PRIORITY_BADGE[p.label]
                        : "border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* 朝昼夜選択 */}
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-gray-600 text-xs shrink-0">時間帯:</span>
                {TIME_PREF_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onSetPreferredTime(todo.id, todo.preferred_time === opt.value ? null : opt.value)}
                    className={`text-xs px-2 py-0.5 rounded border transition-all ${
                      todo.preferred_time === opt.value
                        ? "border-blue-500 bg-blue-900/50 text-blue-300"
                        : "border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400"
                    }`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0 items-end">
          {!todo.is_completed && (
            <button
              onClick={() => onSetFocus(todo)}
              className="text-gray-600 hover:text-blue-400 hover:bg-gray-700/50 text-lg px-2 py-1.5 rounded transition-colors"
              title="シングルフォーカスに設定"
            >
              🎯
            </button>
          )}
          <button
            onClick={() => onRemove(todo.id)}
            className="text-gray-600 hover:text-gray-400 text-xs"
            title="今日のリストから外す"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// 生成されたTODOカード（プレビュー用）
function GeneratedTodoCard({
  todo,
  onAdd,
  onDiscard,
}: {
  todo: GeneratedTodo;
  onAdd: () => void;
  onDiscard: () => void;
}) {
  const badge = PRIORITY_BADGE[todo.priority] ?? PRIORITY_BADGE["中"];
  return (
    <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-gray-200 text-sm leading-tight">{todo.text}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded ${badge}`}>
              {todo.priority}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${CAT_BADGE}`}>
              {getCatEmoji(todo.cat)} {todo.cat}
            </span>
            <span className="text-gray-500 text-xs">⏱{todo.est}分</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={onAdd}
            className="text-xs bg-green-800 hover:bg-green-700 text-green-200 px-2 py-1 rounded transition-colors"
          >
            追加
          </button>
          <button
            onClick={onDiscard}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

interface TodoListProps {
  selectedFocusTask?: Todo | null;
}

export default function TodoList({ selectedFocusTask }: TodoListProps = {}) {
  const [masterTodos, setMasterTodos] = useState<Todo[]>([]);
  const [todayTodos, setTodayTodos] = useState<Todo[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<CreateTodoInput>(emptyForm());
  const [editId, setEditId] = useState<number | null>(null);
  const [customCat, setCustomCat] = useState(false);
  const [showWeeklyList, setShowWeeklyList] = useState(false);
  const [showTodayAddForm, setShowTodayAddForm] = useState(false);
  const [todayFormCat, setTodayFormCat] = useState<string>("personal");
  const [todayFormCustomCat, setTodayFormCustomCat] = useState(false);
  const [todayFormStartTime, setTodayFormStartTime] = useState<string>("");
  const [currentTab, setCurrentTab] = useState<"weekly" | "today">("weekly");
  const [sortByDue, setSortByDue] = useState(false);

  // AI生成
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [generatedTodos, setGeneratedTodos] = useState<GeneratedTodo[]>([]);
  const [showAiInput, setShowAiInput] = useState(false);

  const [loading, setLoading] = useState(false);

  // ドラッグアンドドロップ状態
  const [draggedTodoId, setDraggedTodoId] = useState<number | null>(null);
  const [dragOverTodoId, setDragOverTodoId] = useState<number | null>(null);
  const [todoOrderMap, setTodoOrderMap] = useState<Record<number, number>>({});

  // シングルフォーカスを設定
  const handleSetFocus = useCallback((todo: Todo) => {
    try {
      localStorage.setItem("spe-selected-focus-task", JSON.stringify(todo));
      // ページ全体に通知
      window.dispatchEvent(new CustomEvent("focusTaskChanged", { detail: todo }));
    } catch {}
  }, []);

  // ドラッグアンドドロップハンドラー
  const handleTodoDragStart = useCallback((id: number, e: React.DragEvent<HTMLDivElement>) => {
    setDraggedTodoId(id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleTodoDragOver = useCallback((id: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTodoId(id);
  }, []);

  const handleTodoDrop = useCallback((targetId: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedTodoId || draggedTodoId === targetId) {
      setDraggedTodoId(null);
      setDragOverTodoId(null);
      return;
    }

    // TODOの順序を更新
    const draggedIndex = todayTodos.findIndex((t) => t.id === draggedTodoId);
    const targetIndex = todayTodos.findIndex((t) => t.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedTodoId(null);
      setDragOverTodoId(null);
      return;
    }

    const newTodos = [...todayTodos];
    const [draggedTodo] = newTodos.splice(draggedIndex, 1);
    newTodos.splice(targetIndex, 0, draggedTodo);

    setTodayTodos(newTodos);

    // 新しい順序をlocalStorageに保存
    const newOrderMap: Record<number, number> = {};
    newTodos.forEach((todo, index) => {
      newOrderMap[todo.id] = index;
    });
    setTodoOrderMap(newOrderMap);
    try {
      localStorage.setItem("spe-todo-order", JSON.stringify(newOrderMap));
    } catch {}

    setDraggedTodoId(null);
    setDragOverTodoId(null);
  }, [draggedTodoId, todayTodos]);

  const fetchTodos = useCallback(async () => {
    try {
      const [masterRes, todayRes] = await Promise.all([
        fetch("/api/todos?is_today=false"),
        fetch("/api/todos?is_today=true"),
      ]);
      const masterData = await masterRes.json();
      const todayData = await todayRes.json();
      if (Array.isArray(masterData)) setMasterTodos(masterData);
      if (Array.isArray(todayData)) setTodayTodos(todayData);
    } catch (e) {
      console.error("fetchTodos error:", e);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
    // localStorage から順序を復元
    try {
      const saved = localStorage.getItem("spe-todo-order");
      if (saved) {
        setTodoOrderMap(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // TODOが変更されたときに順序をリセット（新しい日付）
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const lastDateKey = "spe-todo-order-date";
    try {
      const lastDate = localStorage.getItem(lastDateKey);
      if (lastDate !== today) {
        // 新しい日付、順序をリセット
        localStorage.setItem(lastDateKey, today);
        localStorage.removeItem("spe-todo-order");
        setTodoOrderMap({});
      }
    } catch {}
  }, []);

  // フォーム送信
  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      const url = editId ? `/api/todos/${editId}` : "/api/todos";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await fetchTodos();
        setShowAddForm(false);
        setForm(emptyForm());
        setEditId(null);
        setCustomCat(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // 今日へ移動
  const handleMoveToToday = async (id: number) => {
    // 重複チェック
    if (todayTodos.find((t) => t.id === id)) return;
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_today: true }),
    });
    await fetchTodos();
  };

  // 今日リストから外す
  const handleRemoveFromToday = async (id: number) => {
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_today: false }),
    });
    await fetchTodos();
  };

  // 完了トグル（楽観的UI更新）
  const handleToggle = async (id: number, completed: boolean) => {
    // 楽観的UI更新：即座にローカル状態を更新
    setTodayTodos(prevTodos =>
      prevTodos.map(todo =>
        todo.id === id
          ? { ...todo, is_completed: completed, completed_at: completed ? new Date().toISOString() : null }
          : todo
      )
    );

    // バックグラウンドでAPIを呼び出し
    try {
      await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: completed }),
      });
    } catch (e) {
      console.error("Toggle todo failed:", e);
      // エラーがあれば、サーバー状態を再度取得
      await fetchTodos();
    }
  };

  // 編集
  const handleEdit = (todo: Todo) => {
    setEditId(todo.id);
    const isCustom = !PRESET_CATEGORIES.includes(todo.category);
    setCustomCat(isCustom);
    setForm({
      title: todo.title,
      priority: todo.priority,
      estimated_minutes: todo.estimated_minutes,
      category: todo.category,
      preferred_time: todo.preferred_time ?? undefined,
      due_date: todo.due_date ?? undefined,
    });
    setShowAddForm(true);
  };

  // 今日のTODOの時間帯設定
  const handleSetPreferredTime = async (id: number, t: PreferredTime | null) => {
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferred_time: t }),
    });
    await fetchTodos();
  };

  // 優先度変更
  const handleSetPriority = async (id: number, priority: number) => {
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    await fetchTodos();
  };

  // タイトル編集
  const handleEditTitle = async (id: number, title: string) => {
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    await fetchTodos();
  };

  // ルーティンテンプレートを今日へ追加
  const handleAddTemplate = async (tmpl: RoutineTemplate) => {
    // マスターリストに作成して即日追加
    const today = new Date().toISOString().split("T")[0];
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: tmpl.title,
        category: tmpl.category,
        estimated_minutes: tmpl.estimated_minutes,
        priority: 3,
        is_today: true,
        preferred_time: tmpl.preferred_time,
        today_date: today,
      }),
    });
    await fetchTodos();
  };

  // 削除
  const handleDelete = async (id: number) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    await fetchTodos();
  };

  // AI生成
  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setGeneratedTodos([]);
    try {
      const res = await fetch("/api/todos/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const data = await res.json();
      if (Array.isArray(data.todos)) {
        setGeneratedTodos(data.todos);
      }
    } catch {
      alert("生成に失敗しました");
    } finally {
      setAiLoading(false);
    }
  };

  // 生成されたTODOを追加
  const handleAddGenerated = async (todo: GeneratedTodo) => {
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: todo.text,
        priority: PRIORITY_TO_NUM[todo.priority] ?? 3,
        estimated_minutes: todo.est,
        category: todo.cat,
        is_today: false,
      }),
    });
    if (res.ok) {
      setGeneratedTodos((prev) => prev.filter((t) => t.text !== todo.text));
      await fetchTodos();
    }
  };

  // 全追加
  const handleAddAllGenerated = async () => {
    for (const todo of generatedTodos) {
      await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: todo.text,
          priority: PRIORITY_TO_NUM[todo.priority] ?? 3,
          estimated_minutes: todo.est,
          category: todo.cat,
          is_today: false,
        }),
      });
    }
    setGeneratedTodos([]);
    setAiPrompt("");
    setShowAiInput(false);
    await fetchTodos();
  };

  // 今日のTODOを全てマスターリストに戻す
  const handleResetTodayTodos = async () => {
    if (!confirm(`今日のTODO（${todayTodos.length}件）を全てマスターリストに戻しますか？\n明日のために設定し直す場合などにご利用ください。`)) return;
    for (const todo of todayTodos) {
      await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_today: false }),
      });
    }
    await fetchTodos();
  };

  // 今日のTODO統計（今日 completed_at があるものだけ）
  const todayStr = new Date().toISOString().split("T")[0];
  const completedToday = todayTodos.filter(
    (t) => t.is_completed && t.completed_at?.startsWith(todayStr)
  ).length;
  const completionRate =
    todayTodos.length > 0
      ? Math.round((completedToday / todayTodos.length) * 100)
      : 0;

  // フォーカス中タスクを計算（現在時間帯の最優先未完了タスク）
  const currentFocusTodo = (() => {
    const hour = new Date().getHours();
    const sectionOrder: (PreferredTime | null)[] =
      hour < 12
        ? ["morning", "afternoon", "evening", null]
        : hour < 18
        ? ["afternoon", "morning", "evening", null]
        : ["evening", "afternoon", "morning", null];
    const incomplete = todayTodos.filter((t) => !t.is_completed);
    for (const section of sectionOrder) {
      const tasks = incomplete
        .filter((t) =>
          section === null ? !t.preferred_time : t.preferred_time === section
        )
        .sort((a, b) => a.priority - b.priority);
      if (tasks.length > 0) return tasks[0];
    }
    return null;
  })();

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-lg">✅</span>
            <span className="font-semibold text-gray-200">TODO</span>
          </div>
        </div>

        {/* タブ */}
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentTab("weekly")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentTab === "weekly"
                ? "bg-blue-700 text-white border border-blue-600"
                : "bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600"
            }`}
          >
            📅 今週のTODO ({masterTodos.filter(t => !t.is_completed).length}件)
          </button>
          <button
            onClick={() => setCurrentTab("today")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentTab === "today"
                ? "bg-blue-700 text-white border border-blue-600"
                : "bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600"
            }`}
          >
            📅 今日のTODO ({todayTodos.filter(t => !t.is_completed).length}件)
          </button>
        </div>
      </div>

      {/* タブコンテンツ */}
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
        {/* ===== 今週のTODO タブ ===== */}
        {currentTab === "weekly" && (
        <div className="flex flex-col h-full">
          <div className="px-3 py-2 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                今週のタスク
              </span>
              <span className="text-xs text-gray-600">({masterTodos.filter(t => !t.is_completed).length}件)</span>
            </div>
          </div>

          <div className="px-3 py-2 space-y-2">
            {/* ソートボタン */}
            <button
              onClick={() => setSortByDue(!sortByDue)}
              className={`w-full py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                sortByDue
                  ? "bg-purple-900/60 text-purple-300 border-purple-700"
                  : "bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600"
              }`}
            >
              {sortByDue ? "📅 期限の近い順" : "通常の順"}
            </button>

            {/* AI生成ボタン */}
            <button
              onClick={() => {
                setShowAiInput((v) => !v);
                setGeneratedTodos([]);
              }}
              className="w-full py-1.5 rounded-lg bg-purple-900/60 hover:bg-purple-800/60 text-purple-300 text-xs font-medium border border-purple-700 transition-colors"
            >
              🤖 AIで自動生成
            </button>

            {showAiInput && (
              <div className="space-y-2">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="達成したい目標や、やりたいことを入力&#10;例：FOOH作品を完成させるためのタスク"
                  rows={3}
                  className="w-full bg-gray-800 text-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none border border-gray-600"
                />
                <button
                  onClick={handleAIGenerate}
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="w-full py-1.5 bg-purple-700 hover:bg-purple-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  {aiLoading ? "生成中..." : "TODOを生成"}
                </button>

                {/* 生成されたTODOプレビュー */}
                {generatedTodos.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">{generatedTodos.length}件生成</p>
                      <button
                        onClick={handleAddAllGenerated}
                        className="text-xs bg-green-800 hover:bg-green-700 text-green-200 px-2 py-1 rounded transition-colors"
                      >
                        全て追加
                      </button>
                    </div>
                    {generatedTodos.map((todo, i) => (
                      <GeneratedTodoCard
                        key={i}
                        todo={todo}
                        onAdd={() => handleAddGenerated(todo)}
                        onDiscard={() =>
                          setGeneratedTodos((prev) => prev.filter((_, j) => j !== i))
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 手動追加ボタン */}
            <button
              onClick={() => {
                setForm(emptyForm());
                setEditId(null);
                setCustomCat(false);
                setShowAddForm((v) => !v);
              }}
              className="w-full py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium transition-colors"
            >
              {showAddForm && !editId ? "▲ 閉じる" : "+ 手動で追加"}
            </button>

            {/* 追加・編集フォーム */}
            {showAddForm && (
              <div className="bg-gray-800 rounded-xl p-3 space-y-2 border border-gray-600">
                <p className="text-xs text-gray-400 font-semibold">
                  {editId ? "TODO編集" : "TODO追加"}
                </p>
                <input
                  placeholder="タイトル *"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">優先度</label>
                  <div className="flex gap-1">
                    {[
                      { label: "🐸 高", val: 1, active: "border-red-500 bg-red-900/50 text-red-300" },
                      { label: "中",    val: 3, active: "border-yellow-500 bg-yellow-900/50 text-yellow-300" },
                      { label: "低",    val: 5, active: "border-green-500 bg-green-900/50 text-green-300" },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setForm({ ...form, priority: p.val })}
                        className={`flex-1 py-1.5 rounded border text-xs font-medium transition-colors ${
                          form.priority === p.val
                            ? p.active
                            : "border-gray-600 bg-gray-700 text-gray-400 hover:border-gray-500"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">見積(分)</label>
                  <input
                    type="number"
                    value={form.estimated_minutes}
                    onChange={(e) => setForm({ ...form, estimated_minutes: Number(e.target.value) })}
                    min={5}
                    step={5}
                    className="w-full bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">カテゴリ</label>
                  <div className="flex gap-1">
                    {!customCat ? (
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="flex-1 bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none"
                      >
                        {PRESET_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{getCatEmoji(c)} {c}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        placeholder="カテゴリ名を入力"
                        className="flex-1 bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none"
                      />
                    )}
                    <button
                      onClick={() => {
                        setCustomCat((v) => !v);
                        setForm({ ...form, category: "personal" });
                      }}
                      className="text-xs text-gray-500 hover:text-gray-300 px-1.5"
                    >
                      {customCat ? "選択" : "自由入力"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">優先時間帯（任意）</label>
                  <div className="flex gap-1">
                    {TIME_PREF_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm({ ...form, preferred_time: form.preferred_time === opt.value ? undefined : opt.value })}
                        className={`flex-1 py-1 rounded border text-xs transition-colors ${
                          form.preferred_time === opt.value
                            ? "border-blue-500 bg-blue-900/50 text-blue-300"
                            : "border-gray-600 bg-gray-700 text-gray-400 hover:border-gray-500"
                        }`}
                      >
                        {opt.emoji} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">期限（任意）</label>
                  <input
                    type="date"
                    value={form.due_date || ""}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value || undefined })}
                    className="w-full bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? "保存中..." : editId ? "更新" : "追加"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setEditId(null);
                      setForm(emptyForm());
                      setCustomCat(false);
                    }}
                    className="flex-1 py-1.5 bg-gray-700 text-gray-300 rounded text-xs transition-colors hover:bg-gray-600"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* マスターリスト */}
          <div className="px-3 pb-3 space-y-2 flex-1">
            {masterTodos.filter((t) => !t.is_completed).length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-4">
                マスターリストにTODOがありません
              </p>
            ) : (
              masterTodos
                .filter((t) => !t.is_completed)
                .sort((a, b) => {
                  if (!sortByDue) return 0; // 通常順
                  // 期限でソート：期限ありを上に、期限なしを下に
                  if (!a.due_date && !b.due_date) return 0;
                  if (!a.due_date) return 1;
                  if (!b.due_date) return -1;
                  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                })
                .map((todo) => (
                  <MasterTodoCard
                    key={todo.id}
                    todo={todo}
                    onMoveToToday={handleMoveToToday}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isSelectedFocus={selectedFocusTask?.id === todo.id}
                  />
                ))
            )}
            {/* 完了済みアーカイブ */}
            {masterTodos.filter((t) => t.is_completed).length > 0 && (
              <details className="mt-2">
                <summary className="text-gray-600 text-xs cursor-pointer hover:text-gray-400 select-none py-1">
                  ✅ 完了済み ({masterTodos.filter((t) => t.is_completed).length}件)
                </summary>
                <div className="mt-2 space-y-2">
                  {masterTodos
                    .filter((t) => t.is_completed)
                    .map((todo) => (
                      <div key={todo.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-2.5 opacity-60">
                        <div className="flex items-start gap-2">
                          <span className="text-green-500 text-sm shrink-0 mt-0.5">✓</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-400 text-sm line-through leading-tight break-words">{todo.title}</p>
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <span className="text-gray-600 text-xs">{getCatEmoji(todo.category)} {todo.category}</span>
                              {todo.completed_at && (
                                <span className="text-gray-700 text-xs">
                                  {new Date(todo.completed_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}完了
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(todo.id)}
                            className="text-gray-700 hover:text-red-500 text-xs shrink-0"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </details>
            )}
          </div>
        </div>
        )}

        {/* ===== 今日のTODO タブ ===== */}
        {currentTab === "today" && (
        <div className="flex flex-col h-full">
          <div className="px-3 py-2 border-b border-gray-800">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  今日のタスク
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {completedToday}/{todayTodos.length}件
                </span>
                {todayTodos.length > 0 && (
                  <button
                    onClick={handleResetTodayTodos}
                    className="text-xs text-gray-600 hover:text-amber-400 transition-colors border border-gray-700 hover:border-amber-700 px-1.5 py-0.5 rounded"
                    title="今日のTODOを全て今週のリストに戻す"
                  >
                    🔄 全て戻す
                  </button>
                )}
              </div>
            </div>
            {/* 進捗バー */}
            <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <p className="text-right text-xs text-gray-500 mt-0.5">{completionRate}%</p>
          </div>

          {/* ルーティンテンプレート */}
          {(() => {
            const templates = getRoutineTemplates();
            const isWeekend = [0, 6].includes(new Date().getDay());
            return (
              <details className="border-b border-gray-800">
                <summary className="px-3 py-2 text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none flex items-center gap-1.5">
                  <span>📋 ルーティンテンプレート</span>
                  <span className="text-gray-600">({isWeekend ? "休日" : "平日"})</span>
                  <span className="ml-auto text-gray-600">▼</span>
                </summary>
                <div className="px-3 pb-2 space-y-1">
                  {templates.map((tmpl, i) => {
                    const alreadyAdded = todayTodos.some((t) => t.title === tmpl.title);
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 py-1 border-b border-gray-800/50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-gray-300">{getCatEmoji(tmpl.category)} {tmpl.title}</span>
                          <span className="text-[10px] text-gray-600 ml-1.5">{tmpl.note}</span>
                        </div>
                        <button
                          onClick={() => !alreadyAdded && handleAddTemplate(tmpl)}
                          disabled={alreadyAdded}
                          className={`text-xs px-2 py-0.5 rounded shrink-0 transition-colors ${
                            alreadyAdded
                              ? "text-gray-600 cursor-default"
                              : "bg-blue-900/60 text-blue-300 hover:bg-blue-800/60 border border-blue-700"
                          }`}
                        >
                          {alreadyAdded ? "追加済" : "+ 今日へ"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })()}

          {/* 今日のTODO追加フォーム */}
          <div className="px-3 py-2 border-b border-gray-800">
            <button
              onClick={() => {
                setTodayFormCat("personal");
                setTodayFormCustomCat(false);
                setShowTodayAddForm((v) => !v);
              }}
              className="w-full py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium transition-colors"
            >
              {showTodayAddForm ? "▲ 閉じる" : "+ 今日のタスク追加"}
            </button>

            {showTodayAddForm && (
              <div className="bg-gray-800 rounded-xl p-3 space-y-2 border border-gray-600 mt-2">
                <p className="text-xs text-gray-400 font-semibold">
                  タスク追加
                </p>
                <input
                  placeholder="タイトル *"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">優先度</label>
                  <div className="flex gap-1">
                    {[
                      { label: "🐸 高", val: 1, active: "border-red-500 bg-red-900/50 text-red-300" },
                      { label: "中",    val: 3, active: "border-yellow-500 bg-yellow-900/50 text-yellow-300" },
                      { label: "低",    val: 5, active: "border-green-500 bg-green-900/50 text-green-300" },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setForm({ ...form, priority: p.val })}
                        className={`flex-1 py-1.5 rounded border text-xs font-medium transition-colors ${
                          form.priority === p.val
                            ? p.active
                            : "border-gray-600 bg-gray-700 text-gray-400 hover:border-gray-500"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">見積(分)</label>
                  <input
                    type="number"
                    value={form.estimated_minutes}
                    onChange={(e) => setForm({ ...form, estimated_minutes: Number(e.target.value) })}
                    min={5}
                    step={5}
                    className="w-full bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">カテゴリ</label>
                  <div className="flex gap-1">
                    {!todayFormCustomCat ? (
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="flex-1 bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none"
                      >
                        {PRESET_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{getCatEmoji(c)} {c}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        placeholder="カテゴリ名を入力"
                        className="flex-1 bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none"
                      />
                    )}
                    <button
                      onClick={() => {
                        setTodayFormCustomCat((v) => !v);
                        setForm({ ...form, category: "personal" });
                      }}
                      className="text-xs text-gray-500 hover:text-gray-300 px-1.5"
                    >
                      {todayFormCustomCat ? "選択" : "自由入力"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">優先時間帯（任意）</label>
                  <div className="flex gap-1">
                    {TIME_PREF_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm({ ...form, preferred_time: form.preferred_time === opt.value ? undefined : opt.value })}
                        className={`flex-1 py-1 rounded border text-xs transition-colors ${
                          form.preferred_time === opt.value
                            ? "border-blue-500 bg-blue-900/50 text-blue-300"
                            : "border-gray-600 bg-gray-700 text-gray-400 hover:border-gray-500"
                        }`}
                      >
                        {opt.emoji} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">実行時間（HH:MM、任意）</label>
                  <input
                    type="time"
                    value={todayFormStartTime}
                    onChange={(e) => setTodayFormStartTime(e.target.value)}
                    className="w-full bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-600 mt-0.5">指定した時間でタイムラインに配置します</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!form.title.trim()) return;
                      setLoading(true);
                      try {
                        const res = await fetch("/api/todos", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ ...form, is_today: true }),
                        });
                        if (res.ok) {
                          const newTodo = await res.json();

                          // If start time is specified, create a custom block in daily_plans
                          if (todayFormStartTime && newTodo.id) {
                            const today = new Date().toISOString().split("T")[0];
                            const startTime = todayFormStartTime;
                            const [startHour, startMin] = startTime.split(":").map(Number);
                            const estimatedMinutes = form.estimated_minutes ?? 30;
                            const endMin = startMin + estimatedMinutes;
                            const endHour = startHour + Math.floor(endMin / 60);
                            const endTime = `${String(endHour % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

                            // Get existing plan data
                            const planRes = await fetch(`/api/plans?date=${today}`);
                            const existingPlan = await planRes.json();
                            const customBlocks = existingPlan?.custom_blocks ?? [];

                            // Add new custom block
                            const newCustomBlock = {
                              id: `todo-${newTodo.id}`,
                              start_time: startTime,
                              end_time: endTime,
                              title: form.title,
                              type: "task" as const,
                              duration_minutes: estimatedMinutes,
                              todo_id: newTodo.id,
                            };

                            // Save updated plan
                            await fetch("/api/plans", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                date: today,
                                plan_text: existingPlan?.plan_text ?? "",
                                ai_blocks: existingPlan?.ai_blocks ?? [],
                                slot_notes: existingPlan?.slot_notes ?? {},
                                custom_blocks: [...customBlocks, newCustomBlock],
                              }),
                            });
                          }

                          await fetchTodos();
                          setShowTodayAddForm(false);
                          setForm(emptyForm());
                          setTodayFormCustomCat(false);
                          setTodayFormStartTime("");
                        }
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="flex-1 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? "保存中..." : "追加"}
                  </button>
                  <button
                    onClick={() => {
                      setShowTodayAddForm(false);
                      setForm(emptyForm());
                      setTodayFormCustomCat(false);
                      setTodayFormStartTime("");
                    }}
                    className="flex-1 py-1.5 bg-gray-700 text-gray-300 rounded text-xs transition-colors hover:bg-gray-600"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="px-3 py-2 flex-1">
            {todayTodos.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-600 text-xs">今日のTODOがありません</p>
                <p className="text-gray-700 text-xs mt-1">{showWeeklyList ? '← 左のリストから「今日へ」で追加' : '↑ 上の「タスク追加」で作成'}</p>
              </div>
            ) : (
              <>
                {/* 朝/昼/夜/未設定 セクション */}
                {(
                  [
                    { key: "morning",   label: "🌅 朝",   color: "text-amber-400 border-amber-800/60" },
                    { key: "afternoon", label: "☀️ 昼",   color: "text-sky-400 border-sky-800/60" },
                    { key: "evening",   label: "🌙 夜",   color: "text-indigo-400 border-indigo-800/60" },
                    { key: null,        label: "⋯ 未設定", color: "text-gray-600 border-gray-700" },
                  ] as { key: PreferredTime | null; label: string; color: string }[]
                ).map(({ key, label, color }) => {
                  const sectionTodos = todayTodos
                    .filter((t) => !t.is_completed)
                    .filter((t) =>
                      key === null ? !t.preferred_time : t.preferred_time === key
                    )
                    .sort((a, b) => {
                      // Use manual order if available, otherwise sort by priority
                      const orderA = todoOrderMap[a.id] ?? a.priority;
                      const orderB = todoOrderMap[b.id] ?? b.priority;
                      return orderA - orderB;
                    });
                  if (sectionTodos.length === 0) return null;
                  return (
                    <div key={String(key)} className="mb-3">
                      <div className={`flex items-center gap-1.5 text-xs font-semibold pb-1 mb-1.5 border-b ${color}`}>
                        <span>{label}</span>
                        <span className="font-normal opacity-60">{sectionTodos.length}件</span>
                      </div>
                      <div className="space-y-2">
                        {sectionTodos.map((todo) => {
                          const isSelected = selectedFocusTask?.id === todo.id;
                          return (
                            <div
                              key={todo.id}
                              className={isSelected ? "ring-2 ring-cyan-500/60 rounded-lg" : ""}
                            >
                              {isSelected && (
                                <div className="bg-cyan-900/40 rounded-t-lg px-2.5 py-1 flex items-center gap-1.5">
                                  <span className="text-cyan-400 text-[11px] font-bold animate-pulse">🎯</span>
                                  <span className="text-cyan-300 text-[11px] font-semibold">NOW — シングルフォーカス</span>
                                </div>
                              )}
                              <TodayTodoCard
                                todo={todo}
                                onToggle={handleToggle}
                                onRemove={handleRemoveFromToday}
                                onSetPreferredTime={handleSetPreferredTime}
                                onSetPriority={handleSetPriority}
                                onEditTitle={handleEditTitle}
                                onSetFocus={handleSetFocus}
                                onDragStart={handleTodoDragStart}
                                onDragOver={handleTodoDragOver}
                                onDrop={handleTodoDrop}
                                isSelectedFocus={isSelected}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* 完了済み */}
                {todayTodos.filter((t) => t.is_completed).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-gray-600 text-xs cursor-pointer hover:text-gray-400 select-none">
                      完了済み ({todayTodos.filter((t) => t.is_completed).length}件)
                    </summary>
                    <div className="mt-2 space-y-2">
                      {todayTodos
                        .filter((t) => t.is_completed)
                        .map((todo) => (
                          <TodayTodoCard
                            key={todo.id}
                            todo={todo}
                            onToggle={handleToggle}
                            onRemove={handleRemoveFromToday}
                            onSetPreferredTime={handleSetPreferredTime}
                            onSetPriority={handleSetPriority}
                            onEditTitle={handleEditTitle}
                            onSetFocus={handleSetFocus}
                            onDragStart={handleTodoDragStart}
                            onDragOver={handleTodoDragOver}
                            onDrop={handleTodoDrop}
                            isSelectedFocus={selectedFocusTask?.id === todo.id}
                          />
                        ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
