"use client";

import { useState, useEffect, useCallback } from "react";

interface ShoppingItem {
  id: number;
  title: string;
  category: string;
  is_completed: boolean;
  created_at: string;
}

const DEFAULT_CATEGORIES = ["百均", "スーパー", "本屋", "ドラッグストア"];

export default function ShoppingListPanel() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("百均");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [sortBy, setSortBy] = useState<"category" | "date">("category");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  // 初期読み込み
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/shopping-lists");
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error("Failed to fetch items:", err);
    }
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setLoading(true);
    try {
      const category = showCustomCat ? customCategory : newCategory;
      const res = await fetch("/api/shopping-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, category }),
      });

      if (res.ok) {
        setNewTitle("");
        setCustomCategory("");
        setShowCustomCat(false);
        setNewCategory("百均");
        await fetchItems();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await fetch(`/api/shopping-lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: true }),
      });
      await fetchItems();
    } catch (err) {
      console.error("Failed to complete item:", err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/shopping-lists/${id}`, { method: "DELETE" });
      await fetchItems();
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  // ソート処理
  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === "category") {
      const catOrder = [...DEFAULT_CATEGORIES];
      const aIdx = catOrder.indexOf(a.category);
      const bIdx = catOrder.indexOf(b.category);
      if (aIdx !== bIdx) {
        return (aIdx === -1 ? catOrder.length : aIdx) -
               (bIdx === -1 ? catOrder.length : bIdx);
      }
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // カテゴリ別にグループ化
  const groupedItems: Record<string, ShoppingItem[]> = {};
  sortedItems.forEach((item) => {
    if (!groupedItems[item.category]) {
      groupedItems[item.category] = [];
    }
    groupedItems[item.category].push(item);
  });

  const allCategories = Object.keys(groupedItems).sort((a, b) => {
    const aIdx = DEFAULT_CATEGORIES.indexOf(a);
    const bIdx = DEFAULT_CATEGORIES.indexOf(b);
    return (aIdx === -1 ? DEFAULT_CATEGORIES.length : aIdx) -
           (bIdx === -1 ? DEFAULT_CATEGORIES.length : bIdx);
  });

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors border-b border-gray-800"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🛒</span>
          <span className="font-semibold text-gray-200">買うものリスト</span>
        </div>
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
      <div className="px-4 py-3 border-b border-gray-800">

        {/* 追加フォーム */}
        <form onSubmit={handleAddItem} className="space-y-2 bg-gray-800 p-3 rounded-lg">
          <input
            placeholder="買うものを入力"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {/* カテゴリ選択ボタン */}
          <div className="flex gap-1 flex-wrap">
            {showCustomCat ? (
              <>
                <input
                  placeholder="カテゴリ名"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="flex-1 bg-gray-700 text-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomCat(false);
                    setCustomCategory("");
                  }}
                  className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5"
                >
                  キャンセル
                </button>
              </>
            ) : (
              <>
                {DEFAULT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNewCategory(cat)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      newCategory === cat
                        ? "bg-blue-900/60 text-blue-300 border-blue-600"
                        : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowCustomCat(true)}
                  className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
                >
                  +新規
                </button>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !newTitle.trim()}
            className="w-full py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded transition-colors disabled:opacity-50"
          >
            {loading ? "追加中..." : "追加"}
          </button>
        </form>
      </div>

      {/* ソートボタン */}
      <div className="px-4 py-2 border-b border-gray-800 flex gap-2">
        <button
          onClick={() => setSortBy("category")}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            sortBy === "category"
              ? "bg-blue-900/50 text-blue-300 border-blue-700"
              : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
          }`}
        >
          カテゴリ順
        </button>
        <button
          onClick={() => setSortBy("date")}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            sortBy === "date"
              ? "bg-blue-900/50 text-blue-300 border-blue-700"
              : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
          }`}
        >
          新しい順
        </button>
      </div>

        {/* リスト表示 */}
        <div className="px-4 py-3 space-y-3 max-h-96 overflow-y-auto">
          {allCategories.length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-4">
              買うものがありません
            </p>
          ) : (
            allCategories.map((category) => (
              <div key={category}>
                <p className="text-xs text-gray-500 font-semibold mb-1.5 uppercase tracking-wider">
                  {category}
                </p>
                <div className="space-y-1">
                  {groupedItems[category].map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 bg-gray-800 p-2 rounded group hover:bg-gray-750 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={item.is_completed}
                        onChange={() => handleComplete(item.id)}
                        className="w-4 h-4 rounded accent-green-500 cursor-pointer"
                      />
                      <span
                        className={`text-sm flex-1 ${
                          item.is_completed
                            ? "line-through text-gray-600"
                            : "text-gray-300"
                        }`}
                      >
                        {item.title}
                      </span>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
