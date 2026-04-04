"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Goal, GoalCategory } from "@/types";

const CATEGORY_EMOJI: Record<GoalCategory, string> = {
  fitness: "💪",
  investment: "💰",
  english: "🗣️",
  vfx: "🎬",
  personal: "⭐",
};

function calcProgress(current: number, target: number | null | undefined): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

function calcDaysLeft(endDate: string): number {
  return Math.ceil(
    (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
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

interface VisionImage {
  url: string;
  pathname: string;
}

interface VisualGoalCardProps {
  goal: Goal;
  onEdit?: (goal: Goal) => void;
  onDelete?: (id: number) => void;
  onBreakdown?: (goal: Goal) => void;
  showVisionBoard?: boolean;
}

export default function VisualGoalCard({
  goal,
  onEdit,
  onDelete,
  onBreakdown,
  showVisionBoard = true,
}: VisualGoalCardProps) {
  const progress = calcProgress(goal.current_value, goal.target_value ?? null);
  const daysLeft = calcDaysLeft(goal.end_date);
  const [images, setImages] = useState<VisionImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = useCallback(async () => {
    if (!showVisionBoard) return;
    try {
      const res = await fetch(`/api/vision?goal_id=${goal.id}`);
      if (res.ok) {
        const data = await res.json();
        setImages(data.images ?? []);
      }
    } catch {
      // ignore
    }
  }, [goal.id, showVisionBoard]);

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
      {showVisionBoard && images.length > 0 && (
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
          {showVisionBoard && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-gray-400 hover:text-cyan-400 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
                title="画像を追加"
              >
                {uploading ? "..." : "📷 画像を追加"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
            </>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(goal)}
              className="text-gray-400 hover:text-blue-400 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
            >
              編集
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(goal.id)}
              className="text-gray-400 hover:text-red-400 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
            >
              削除
            </button>
          )}
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
    </div>
  );
}
