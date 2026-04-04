"use client";

import { Todo } from "@/types";

const PRIORITY_COLORS: Record<number, string> = {
  1: "text-red-400",
  2: "text-orange-400",
  3: "text-yellow-400",
  4: "text-blue-400",
  5: "text-gray-400",
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "最高",
  2: "高",
  3: "中",
  4: "低",
  5: "最低",
};

const CATEGORY_EMOJI: Record<string, string> = {
  vfx: "🎬",
  english: "🗣️",
  investment: "💰",
  fitness: "💪",
  personal: "⭐",
};

interface Props {
  todo: Todo;
  onComplete: (id: number, completed: boolean) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: number) => void;
}

export default function TodoItem({ todo, onComplete, onEdit, onDelete }: Props) {
  return (
    <div
      className={`bg-gray-800 border rounded-xl p-3 transition-all ${
        todo.is_completed
          ? "border-gray-700 opacity-50"
          : "border-gray-600"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onComplete(todo.id, !todo.is_completed)}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
            todo.is_completed
              ? "border-green-500 bg-green-500"
              : "border-gray-500 hover:border-green-400"
          }`}
        >
          {todo.is_completed && (
            <span className="text-white text-xs">✓</span>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-sm font-medium ${
                todo.is_completed ? "line-through text-gray-500" : "text-gray-200"
              }`}
            >
              {todo.title}
            </span>
            <span className="text-base" title={todo.category}>
              {CATEGORY_EMOJI[todo.category]}
            </span>
          </div>

          {todo.description && (
            <p className="text-gray-400 text-xs mt-0.5 truncate">{todo.description}</p>
          )}

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className={`text-xs font-medium ${PRIORITY_COLORS[todo.priority]}`}>
              P{todo.priority} {PRIORITY_LABELS[todo.priority]}
            </span>
            <span className="text-gray-500 text-xs">
              ⏱ {todo.estimated_minutes}分
            </span>
            {todo.due_date && (
              <span className="text-gray-500 text-xs">
                📅 {todo.due_date}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onEdit(todo)}
            className="text-gray-500 hover:text-blue-400 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
          >
            編集
          </button>
          <button
            onClick={() => onDelete(todo.id)}
            className="text-gray-500 hover:text-red-400 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}
