"use client";

import { useState, useEffect, useRef } from "react";
import { FocusMode, FocusSession, Todo } from "@/types";
import FocusTimerDisplay from "./FocusTimerDisplay";
import FocusModeSelector from "./FocusModeSelector";

type SessionState = "setup" | "active" | "completed" | "break";

interface FocusSessionScreenProps {
  userId: string;
  onClose?: () => void;
}

export default function FocusSessionScreen({ userId, onClose }: FocusSessionScreenProps) {
  const [state, setState] = useState<SessionState>("setup");
  const [modes, setModes] = useState<FocusMode[]>([]);
  const [selectedMode, setSelectedMode] = useState<string>("FOOH制作");
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState(25);
  const [currentSession, setCurrentSession] = useState<FocusSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [breakRemaining, setBreakRemaining] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Todo | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch modes on mount
  useEffect(() => {
    const fetchModes = async () => {
      try {
        const res = await fetch(`/api/focus/modes?user_id=${userId}`);
        console.log("Modes response status:", res.status);
        if (!res.ok) {
          console.error("Modes API error:", res.status, res.statusText);
          return;
        }
        const data = await res.json();
        console.log("Modes data:", data);
        if (data.modes) {
          setModes(data.modes);
          setSelectedMode(data.modes[0]?.mode_name || "FOOH制作");
        }
      } catch (e) {
        console.error("Failed to fetch modes:", e);
      }
    };
    fetchModes();
  }, [userId]);

  // LocalStorage からシングルフォーカスタスクを復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem("spe-selected-focus-task");
      if (saved) {
        const task = JSON.parse(saved) as Todo;
        setSelectedTask(task);
      }
    } catch {}

    // focusTaskChanged イベントをリッスン
    const handleFocusChanged = (e: Event) => {
      const event = e as CustomEvent<Todo>;
      setSelectedTask(event.detail);
    };
    window.addEventListener("focusTaskChanged", handleFocusChanged);
    return () => window.removeEventListener("focusTaskChanged", handleFocusChanged);
  }, []);

  // Timer logic
  useEffect(() => {
    if (state === "active" && currentSession) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else if (state === "break") {
      timerRef.current = setInterval(() => {
        setBreakRemaining((prev) => {
          if (prev <= 1) {
            setState("setup");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [state, currentSession]);

  const handleStartSession = async () => {
    try {
      const minutes = targetMinutes === 999 ? customMinutes : targetMinutes;
      const res = await fetch("/api/focus/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          mode_name: selectedMode,
          target_minutes: minutes,
        }),
      });

      const data = await res.json();
      console.log("Start session response:", data);
      if (data.session_id) {
        // Map API response to FocusSession object
        const session: FocusSession = {
          id: data.session_id,
          user_id: userId,
          mode_name: selectedMode,
          target_minutes: minutes,
          start_time: data.start_time,
          end_time: null,
          actual_minutes: 0,
          session_status: "active",
          break_minutes: 0,
          break_end_time: null,
          created_at: data.start_time,
          updated_at: data.start_time,
          tip: data.tip,
        };
        setCurrentSession(session);
        setState("active");
        setElapsedSeconds(0);
      }
    } catch (e) {
      console.error("Failed to start session:", e);
    }
  };

  const handleEndSession = async () => {
    if (!currentSession) return;
    try {
      console.log("Ending session:", currentSession.id);
      const res = await fetch(`/api/focus/sessions/${currentSession.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      console.log("End session response status:", res.status);
      if (!res.ok) {
        console.error("End session API error:", res.status);
        return;
      }

      const data = await res.json();
      console.log("End session response data:", data);
      setState("completed");
      setCurrentSession((prev) =>
        prev ? { ...prev, actual_minutes: data.actual_minutes, end_time: data.end_time } : null
      );
    } catch (e) {
      console.error("Failed to end session:", e);
    }
  };

  const handleStartBreak = async (breakMinutes: number) => {
    if (!currentSession) return;
    try {
      await fetch(`/api/focus/sessions/${currentSession.id}/break-end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, break_minutes: breakMinutes }),
      });

      setState("break");
      setBreakRemaining(breakMinutes * 60);
    } catch (e) {
      console.error("Failed to start break:", e);
    }
  };

  // Persistent notifications when session completes
  useEffect(() => {
    if (state !== "completed" || !currentSession) return;

    // Send 4 notifications immediately
    const sendNotification = () => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("✨ 集中セッション完了！", {
          body: `実際の集中時間: ${currentSession.actual_minutes}分`,
          icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='75'>✨</text></svg>",
          requireInteraction: true,
        });
      }
    };

    // Send 4 notifications at completion
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        sendNotification();
      }, i * 300); // 300ms apart
    }

    // Then send notifications every 5 minutes
    const intervalId = setInterval(
      () => {
        sendNotification();
      },
      5 * 60 * 1000 // 5 minutes
    );

    return () => clearInterval(intervalId);
  }, [state, currentSession]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
      {/* Setup State */}
      {state === "setup" && (
        <div className="max-w-md mx-auto mt-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-6">⏱ 集中セッション</h2>

            {/* Mode Selection */}
            <FocusModeSelector
              modes={modes}
              selectedMode={selectedMode}
              onSelectMode={setSelectedMode}
              userId={userId}
              onModesChange={() => {
                const fetchModes = async () => {
                  try {
                    const res = await fetch(`/api/focus/modes?user_id=${userId}`);
                    if (res.ok) {
                      const data = await res.json();
                      if (data.modes) {
                        setModes(data.modes);
                        setSelectedMode(data.modes[0]?.mode_name || "FOOH制作");
                      }
                    }
                  } catch (e) {
                    console.error("Failed to fetch modes:", e);
                  }
                };
                fetchModes();
              }}
            />

            {/* Selected Task Display */}
            {selectedTask ? (
              <div className="mt-6 bg-blue-600/20 border-2 border-blue-500 rounded-lg p-3">
                <p className="text-xs text-blue-300 mb-1">🎯 シングルフォーカス対象</p>
                <p className="text-sm font-semibold text-blue-100 truncate">
                  {selectedTask.title}
                </p>
              </div>
            ) : (
              <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-500">
                  TODOで🎯を押して、シングルフォーカス対象を設定できます
                </p>
              </div>
            )}

            {/* Time Selection */}
            <div className="mt-6">
              <label className="block text-sm font-medium mb-3">時間選択:</label>
              <div className="grid grid-cols-3 gap-2">
                {[10, 25, 60].map((min) => (
                  <button
                    key={min}
                    onClick={() => {
                      setTargetMinutes(min);
                      setCustomMinutes(min);
                    }}
                    className={`py-2 px-3 rounded border-2 transition-all ${
                      targetMinutes === min
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-gray-600 bg-gray-700 hover:border-gray-500"
                    }`}
                  >
                    {min}分
                  </button>
                ))}
              </div>

              {/* Custom Time */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={customMinutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setCustomMinutes(val);
                    setTargetMinutes(999);
                  }}
                  className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white"
                />
                <span className="text-sm text-gray-400">分</span>
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartSession}
              className="w-full mt-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors"
            >
              開始
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="w-full mt-2 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
              >
                キャンセル
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active State */}
      {state === "active" && currentSession && (
        <div className="max-w-md mx-auto mt-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
            <p className="text-sm text-gray-400 mb-2">
              {currentSession.mode_name} | {new Date(currentSession.start_time).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 開始
            </p>

            {/* Selected Focus Task */}
            {selectedTask && (
              <div className="bg-red-600/20 border border-red-500/50 rounded-lg p-3 mb-4">
                <p className="text-xs text-red-300 mb-1">🎯 フォーカスタスク</p>
                <p className="text-sm font-semibold text-red-100">{selectedTask.title}</p>
                <p className="text-xs text-red-200/70">{selectedTask.estimated_minutes}分</p>
              </div>
            )}

            <FocusTimerDisplay elapsedSeconds={elapsedSeconds} />

            {/* Daily Tip */}
            <p className="text-sm text-gray-400 my-6 italic leading-relaxed">
              💡 {currentSession.tip || "集中力を高めましょう"}
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setState("setup")}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                一時停止
              </button>
              <button
                onClick={handleEndSession}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                終了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed State */}
      {state === "completed" && currentSession && (
        <div className="max-w-md mx-auto mt-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
            <h3 className="text-2xl font-bold text-green-400 mb-4">✅ セッション完了！</h3>
            <p className="text-lg mb-6">
              実際の集中時間: <span className="font-bold text-green-300">{currentSession.actual_minutes}分</span>
            </p>

            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-400 mb-3">休憩時間を選択:</p>
              <div className="flex gap-3">
                {[3, 5].map((min) => (
                  <button
                    key={min}
                    onClick={() => handleStartBreak(min)}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                  >
                    {min}分
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setState("setup");
                setCurrentSession(null);
              }}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              別のモードを開始
            </button>
          </div>
        </div>
      )}

      {/* Break State */}
      {state === "break" && (
        <div className="max-w-md mx-auto mt-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
            <h3 className="text-2xl font-bold text-blue-400 mb-4">🕐 休憩中...</h3>
            <p className="text-5xl font-bold my-6">
              {Math.floor(breakRemaining / 60)}:{String(breakRemaining % 60).padStart(2, "0")}
            </p>

            <button
              onClick={() => {
                setState("setup");
                setCurrentSession(null);
              }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              スキップ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
