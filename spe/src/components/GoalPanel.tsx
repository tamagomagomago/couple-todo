"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Goal, CreateGoalInput, GoalCategory, PeriodType } from "@/types";

const CATEGORY_EMOJI: Record<GoalCategory, string> = {
  fitness: "💪",
  investment: "💰",
  english: "🗣️",
  vfx: "🎬",
  personal: "⭐",
};

const CATEGORY_LABEL: Record<GoalCategory, string> = {
  fitness: "フィットネス",
  investment: "投資",
  english: "英語",
  vfx: "VFX",
  personal: "その他",
};

const PERIOD_LABEL: Record<PeriodType, string> = {
  annual: "年間",
  monthly: "月次",
  weekly: "週次",
};

function calcDaysLeft(endDate: string): number {
  return Math.ceil(
    (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
}

function calcProgress(current: number, target: number | null | undefined): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

function ProgressBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-green-500" : value >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-500`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

interface MonthlyGoalData {
  title: string;
  target_value: number;
  unit: string;
  start_date: string;
  end_date: string;
  description: string;
}

interface WeeklyGoalData {
  title: string;
  target_value: number;
  unit: string;
  start_date: string;
  end_date: string;
  description: string;
}

interface TodoData {
  title: string;
  priority: number;
  estimated_minutes: number;
  category: string;
}

interface BreakdownResult {
  analysis: string;
  monthly_goals: MonthlyGoalData[];
  weekly_goals: WeeklyGoalData[];
  todos: TodoData[];
}

interface VisionImage {
  url: string;
  pathname: string;
}

const EMPTY_FORM: CreateGoalInput = {
  title: "",
  description: "",
  category: "personal",
  period_type: "annual",
  target_value: undefined,
  current_value: 0,
  unit: "",
  start_date: new Date().toISOString().split("T")[0],
  end_date: "",
  parent_id: undefined,
};

// ----------------------
// VisualGoalCard sub-component
// ----------------------
function VisualGoalCard({
  goal,
  onEdit,
  onDelete,
  onBreakdown,
}: {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (id: number) => void;
  onBreakdown?: (goal: Goal) => void;
}) {
  const progress = calcProgress(goal.current_value, goal.target_value ?? null);
  const daysLeft = calcDaysLeft(goal.end_date);
  const [images, setImages] = useState<VisionImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // メモ機能
  const [showMemo, setShowMemo] = useState(false);
  const [memoText, setMemoText] = useState(goal.description ?? "");
  const [memoSaving, setMemoSaving] = useState(false);

  const handleMemoSave = async () => {
    setMemoSaving(true);
    try {
      await fetch(`/api/goals/${goal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: memoText }),
      });
    } finally {
      setMemoSaving(false);
    }
  };

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch(`/api/vision?goal_id=${goal.id}`);
      if (res.ok) {
        const data = await res.json();
        setImages(data.images ?? []);
      }
    } catch {
      // ignore
    }
  }, [goal.id]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/vision?goal_id=${goal.id}`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        await fetchImages();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteImage = async (url: string) => {
    try {
      await fetch(`/api/vision?url=${encodeURIComponent(url)}`, {
        method: "DELETE",
      });
      await fetchImages();
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
      {/* ビジョン画像サムネイル */}
      {images.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {images.map((img) => (
            <div key={img.url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt="vision"
                className="w-16 h-16 object-cover rounded-lg border border-gray-600"
              />
              <button
                onClick={() => handleDeleteImage(img.url)}
                className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-5 h-5 bg-red-600 text-white rounded-full text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span>{CATEGORY_EMOJI[goal.category]}</span>
          <span className="text-gray-200 text-sm font-medium truncate">
            {goal.title}
          </span>
          {goal.is_achieved && (
            <span className="text-green-400 text-xs bg-green-900/50 px-1.5 py-0.5 rounded">
              達成✓
            </span>
          )}
        </div>
        <div className="flex gap-1 ml-2 shrink-0 flex-wrap justify-end">
          {/* AI分解ボタン（年間目標のみ） */}
          {goal.period_type === "annual" && onBreakdown && (
            <button
              onClick={() => onBreakdown(goal)}
              className="text-xs px-1.5 py-0.5 rounded bg-purple-900/60 hover:bg-purple-800/60 text-purple-300 border border-purple-700/50 transition-colors"
            >
              🤖 AI分解
            </button>
          )}
          {/* 画像アップロードボタン */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-gray-400 hover:text-cyan-400 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
          >
            {uploading ? "..." : "📷"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => onEdit(goal)}
            className="text-gray-400 hover:text-blue-400 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
          >
            編集
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="text-gray-400 hover:text-red-400 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
          >
            削除
          </button>
        </div>
      </div>

      {/* 進捗数値 */}
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-400">
          現在{" "}
          <span className="text-gray-200 font-semibold">
            {goal.current_value}
            {goal.unit ?? ""}
          </span>
          {" / "}
          目標{" "}
          <span className="text-gray-200 font-semibold">
            {goal.target_value ?? "?"}
            {goal.unit ?? ""}
          </span>
        </span>
        <span
          className={`font-bold ${
            progress >= 80
              ? "text-green-400"
              : progress >= 40
              ? "text-yellow-400"
              : "text-red-400"
          }`}
        >
          {progress}%
        </span>
      </div>
      <ProgressBar value={progress} />
      <div className="mt-1.5 flex justify-between items-center">
        <span className="text-xs text-gray-600">終了予定日 {goal.end_date}</span>
        <span
          className={`text-xs ${
            daysLeft > 30
              ? "text-gray-500"
              : daysLeft > 7
              ? "text-yellow-600"
              : "text-red-500"
          }`}
        >
          残り {daysLeft > 0 ? `${daysLeft}日` : "期限超過"}
        </span>
      </div>

      {/* メモ */}
      <div className="mt-2">
        <button
          onClick={() => setShowMemo((v) => !v)}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
        >
          📝 {showMemo ? "メモを閉じる" : memoText ? "メモを見る" : "メモを追加"}
        </button>
        {!showMemo && memoText && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{memoText}</p>
        )}
        {showMemo && (
          <div className="mt-1.5 space-y-1">
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              placeholder="メモ・戦略・気づきなど..."
              rows={3}
              className="w-full bg-gray-700/50 text-gray-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none border border-gray-600"
            />
            <button
              onClick={handleMemoSave}
              disabled={memoSaving}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              {memoSaving ? "保存中..." : "保存"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------
// BreakdownModal sub-component
// ----------------------
function BreakdownModal({
  goalId,
  result,
  saving,
  onSave,
  onClose,
}: {
  goalId: number;
  result: BreakdownResult;
  saving: boolean;
  onSave: (goalId: number, result: BreakdownResult) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">🤖 AI分解結果</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4 space-y-5">
          {/* 現状分析 */}
          <div>
            <p className="text-xs font-semibold text-gray-300 mb-1">📊 現状分析</p>
            <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">
              {result.analysis}
            </p>
          </div>

          {/* 月次目標 */}
          <div>
            <p className="text-xs font-semibold text-gray-300 mb-2">
              📅 月次目標（{result.monthly_goals.length}件）
            </p>
            <div className="space-y-2">
              {result.monthly_goals.map((g, i) => (
                <div
                  key={i}
                  className="bg-gray-800 rounded-lg p-2.5 border border-gray-700"
                >
                  <p className="text-xs text-gray-200 font-medium">{g.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    目標値: {g.target_value} {g.unit} ／ {g.start_date} 〜 {g.end_date}
                  </p>
                  {g.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 週次目標 */}
          <div>
            <p className="text-xs font-semibold text-gray-300 mb-2">
              📆 週次目標（{result.weekly_goals.length}件）
            </p>
            <div className="space-y-2">
              {result.weekly_goals.map((g, i) => (
                <div
                  key={i}
                  className="bg-gray-800 rounded-lg p-2.5 border border-gray-700"
                >
                  <p className="text-xs text-gray-200 font-medium">{g.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    目標値: {g.target_value} {g.unit} ／ {g.start_date} 〜 {g.end_date}
                  </p>
                  {g.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* TODO */}
          <div>
            <p className="text-xs font-semibold text-gray-300 mb-2">
              ✅ 今日のTODO（{result.todos.length}件）
            </p>
            <div className="space-y-1">
              {result.todos.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-gray-800 rounded-lg px-2.5 py-1.5 border border-gray-700"
                >
                  <span className="text-xs text-gray-400 w-4 shrink-0">
                    P{t.priority}
                  </span>
                  <span className="text-xs text-gray-200 flex-1">{t.title}</span>
                  <span className="text-xs text-gray-500 shrink-0">
                    {t.estimated_minutes}分
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-700 flex gap-2">
          <button
            onClick={() => onSave(goalId, result)}
            disabled={saving}
            className="flex-1 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : "一括保存"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------
// Main GoalPanel component
// ----------------------
export default function GoalPanel() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateGoalInput>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // AI breakdown state
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownResult, setBreakdownResult] = useState<BreakdownResult | null>(null);
  const [breakdownGoalId, setBreakdownGoalId] = useState<number | null>(null);
  const [breakdownSaving, setBreakdownSaving] = useState(false);

  const fetchGoals = useCallback(async () => {
    const res = await fetch("/api/goals");
    const data = await res.json();
    if (Array.isArray(data)) setGoals(data);
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.start_date || !form.end_date) return;
    setLoading(true);
    try {
      const url = editId ? `/api/goals/${editId}` : "/api/goals";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await fetchGoals();
        setShowForm(false);
        setForm(EMPTY_FORM);
        setEditId(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditId(goal.id);
    setForm({
      title: goal.title,
      description: goal.description ?? "",
      category: goal.category,
      period_type: goal.period_type,
      target_value: goal.target_value ?? undefined,
      current_value: goal.current_value,
      unit: goal.unit ?? "",
      start_date: goal.start_date,
      end_date: goal.end_date,
      parent_id: goal.parent_id ?? undefined,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    await fetchGoals();
  };

  const handleBreakdown = async (goal: Goal) => {
    setBreakdownLoading(true);
    setBreakdownResult(null);
    setBreakdownGoalId(goal.id);
    try {
      const res = await fetch(`/api/goals/${goal.id}/breakdown`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setBreakdownResult(data);
      } else {
        alert("AI分解に失敗しました");
        setBreakdownGoalId(null);
      }
    } catch {
      alert("AI分解中にエラーが発生しました");
      setBreakdownGoalId(null);
    } finally {
      setBreakdownLoading(false);
    }
  };

  const handleBreakdownSave = async (goalId: number, result: BreakdownResult) => {
    setBreakdownSaving(true);
    try {
      const res = await fetch(`/api/goals/${goalId}/breakdown?save=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (res.ok) {
        await fetchGoals();
        setBreakdownResult(null);
        setBreakdownGoalId(null);
        alert("保存しました");
      } else {
        alert("保存に失敗しました");
      }
    } finally {
      setBreakdownSaving(false);
    }
  };

  // OKR階層: 年間 → 月次 → 週次 のネスト表示
  const annualGoals = goals.filter((g) => g.period_type === "annual");
  const monthlyGoals = goals.filter((g) => g.period_type === "monthly");
  const weeklyGoals = goals.filter((g) => g.period_type === "weekly");

  // 親なし月次（parent_id が null/undefined）または parent_id が年間目標の id に一致
  const getMonthlyForAnnual = (annualId: number) =>
    monthlyGoals.filter((g) => g.parent_id === annualId);
  const orphanMonthly = monthlyGoals.filter(
    (g) => !g.parent_id || !goals.find((ag) => ag.id === g.parent_id)
  );

  const getWeeklyForMonthly = (monthlyId: number) =>
    weeklyGoals.filter((g) => g.parent_id === monthlyId);
  const orphanWeekly = weeklyGoals.filter(
    (g) => !g.parent_id || !goals.find((mg) => mg.id === g.parent_id)
  );

  // 親目標セレクター用: annual + monthly を表示
  const parentCandidates = goals.filter(
    (g) => g.period_type === "annual" || g.period_type === "monthly"
  );

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      {/* AI分解ロード中オーバーレイ */}
      {breakdownLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl px-6 py-5 text-center">
            <p className="text-white text-sm">🤖 AIが目標を分解中...</p>
            <p className="text-gray-400 text-xs mt-1">しばらくお待ちください</p>
          </div>
        </div>
      )}

      {/* AI分解結果モーダル */}
      {breakdownResult && breakdownGoalId && (
        <BreakdownModal
          goalId={breakdownGoalId}
          result={breakdownResult}
          saving={breakdownSaving}
          onSave={handleBreakdownSave}
          onClose={() => {
            setBreakdownResult(null);
            setBreakdownGoalId(null);
          }}
        />
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-lg">🎯</span>
          <span className="font-semibold text-gray-200">目標管理（OKR）</span>
          <span className="text-xs bg-gray-700 text-gray-400 rounded-full px-2 py-0.5">
            {goals.length}件
          </span>
        </div>
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setEditId(null);
              setShowForm((v) => !v);
            }}
            className="w-full py-2 rounded-lg bg-blue-800 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            {showForm ? "▲ フォームを閉じる" : "+ 目標を追加"}
          </button>

          {showForm && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-3 border border-gray-600">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                {editId ? "目標を編集" : "新しい目標"}
              </p>
              <input
                placeholder="目標タイトル *（例：ベンチプレス100kg達成）"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">カテゴリ</label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as GoalCategory })
                    }
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    {(
                      [
                        "fitness",
                        "investment",
                        "english",
                        "vfx",
                        "personal",
                      ] as GoalCategory[]
                    ).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_EMOJI[c]} {CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">期間タイプ</label>
                  <select
                    value={form.period_type}
                    onChange={(e) =>
                      setForm({ ...form, period_type: e.target.value as PeriodType })
                    }
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="annual">年間目標</option>
                    <option value="monthly">月次目標</option>
                    <option value="weekly">週次目標</option>
                  </select>
                </div>
              </div>

              {/* 親目標セレクター */}
              {(form.period_type === "monthly" || form.period_type === "weekly") && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    親目標（OKR）
                  </label>
                  <select
                    value={form.parent_id ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        parent_id: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">なし</option>
                    {parentCandidates
                      .filter((g) =>
                        form.period_type === "monthly"
                          ? g.period_type === "annual"
                          : g.period_type === "monthly"
                      )
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          [{PERIOD_LABEL[g.period_type]}] {g.title}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">現在値</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.current_value ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, current_value: Number(e.target.value) })
                    }
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">目標値</label>
                  <input
                    type="number"
                    placeholder="100"
                    value={form.target_value ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        target_value: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">単位</label>
                  <input
                    placeholder="kg / 点 / 本"
                    value={form.unit ?? ""}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">開始日</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">終了予定日</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? "保存中..." : editId ? "更新する" : "目標を保存"}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditId(null);
                    setForm(EMPTY_FORM);
                  }}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          {/* OKR階層表示: 年間 → 月次 → 週次 */}
          {annualGoals.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2">
                🏆 年間目標
              </h3>
              <div className="space-y-3">
                {annualGoals.map((annual) => {
                  const children = getMonthlyForAnnual(annual.id);
                  return (
                    <div key={annual.id}>
                      <VisualGoalCard
                        goal={annual}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onBreakdown={handleBreakdown}
                      />
                      {/* 紐づく月次目標 */}
                      {children.length > 0 && (
                        <div className="ml-4 mt-2 space-y-2 border-l-2 border-blue-800/40 pl-3">
                          <p className="text-xs text-blue-400 font-semibold mb-1">
                            📅 月次目標
                          </p>
                          {children.map((monthly) => {
                            const weeklyChildren = getWeeklyForMonthly(monthly.id);
                            return (
                              <div key={monthly.id}>
                                <VisualGoalCard
                                  goal={monthly}
                                  onEdit={handleEdit}
                                  onDelete={handleDelete}
                                />
                                {/* 紐づく週次目標 */}
                                {weeklyChildren.length > 0 && (
                                  <div className="ml-4 mt-2 space-y-2 border-l-2 border-green-800/40 pl-3">
                                    <p className="text-xs text-green-400 font-semibold mb-1">
                                      📆 週次目標
                                    </p>
                                    {weeklyChildren.map((weekly) => (
                                      <VisualGoalCard
                                        key={weekly.id}
                                        goal={weekly}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 親なし月次目標 */}
          {orphanMonthly.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
                📅 月次目標
              </h3>
              <div className="space-y-3">
                {orphanMonthly.map((monthly) => {
                  const weeklyChildren = getWeeklyForMonthly(monthly.id);
                  return (
                    <div key={monthly.id}>
                      <VisualGoalCard
                        goal={monthly}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                      {weeklyChildren.length > 0 && (
                        <div className="ml-4 mt-2 space-y-2 border-l-2 border-green-800/40 pl-3">
                          <p className="text-xs text-green-400 font-semibold mb-1">
                            📆 週次目標
                          </p>
                          {weeklyChildren.map((weekly) => (
                            <VisualGoalCard
                              key={weekly.id}
                              goal={weekly}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 親なし週次目標 */}
          {orphanWeekly.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">
                📆 週次目標
              </h3>
              <div className="space-y-3">
                {orphanWeekly.map((weekly) => (
                  <VisualGoalCard
                    key={weekly.id}
                    goal={weekly}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {goals.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">目標がありません</p>
          )}
        </div>
      )}
    </div>
  );
}
