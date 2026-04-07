"use client";

import { useState, useEffect } from "react";
import { Todo } from "@/types";

interface FocusTaskSelectorProps {
  onTaskSelect: (task: Todo | null) => void;
  selectedTask: Todo | null;
}

export default function FocusTaskSelector({
  onTaskSelect,
  selectedTask,
}: FocusTaskSelectorProps) {
  const [todayTodos, setTodayTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTodos = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/todos?is_today=true`);
        if (!res.ok) throw new Error("Failed to fetch todos");
        const todos = await res.json();

        // 今日のTODOで未完了のもの（優先度フィルター無し）
        const uncompleted = (Array.isArray(todos) ? todos : []).filter(
          (t: Todo) => !t.is_completed
        );
        setTodayTodos(uncompleted);
      } catch (error) {
        console.error("Failed to fetch today's todos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodos();
  }, []);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-200 mb-2">
          🎯 シングルフォーカスタスク
        </h3>
        <p className="text-xs text-gray-500">
          今日のタスクの中から1つ選択（オプション）
        </p>
      </div>

      {loading && <p className="text-xs text-gray-400">読込中...</p>}

      {!loading && todayTodos.length === 0 && (
        <p className="text-xs text-gray-500">
          今日のタスクがありません
        </p>
      )}

      {!loading && todayTodos.length > 0 && (
        <div className="space-y-2">
          {/* Clear selection button */}
          {selectedTask && (
            <button
              onClick={() => onTaskSelect(null)}
              className="w-full px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition-colors"
            >
              ✕ 選択を解除
            </button>
          )}

          {/* Task list */}
          {todayTodos.map((todo) => (
            <button
              key={todo.id}
              onClick={() => onTaskSelect(todo)}
              className={`w-full px-3 py-2 text-xs rounded transition-colors text-left ${
                selectedTask?.id === todo.id
                  ? "bg-red-600 text-white font-semibold"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-200"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0">
                  {selectedTask?.id === todo.id ? "✓" : "◇"}
                </span>
                <div className="flex-1">
                  <p className="font-medium truncate">{todo.title}</p>
                  <p className="text-gray-400 text-xs">
                    {todo.estimated_minutes}分
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
