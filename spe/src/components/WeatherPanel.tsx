"use client";

import { useEffect, useState } from "react";

interface WeatherData {
  temp: number;
  feels_like: number;
  temp_max: number;
  temp_min: number;
  description: string;
  icon: string;
  humidity: number;
  wind_speed: number;
  city: string;
  is_rain: boolean;
  outfit_suggestion: string[];
  outfit_level: "cold" | "cool" | "mild" | "warm" | "hot";
}

const LEVEL_COLOR: Record<string, string> = {
  cold:  "text-blue-300",
  cool:  "text-cyan-300",
  mild:  "text-green-300",
  warm:  "text-yellow-300",
  hot:   "text-red-400",
};

const LEVEL_BG: Record<string, string> = {
  cold:  "bg-blue-950/40 border-blue-800/50",
  cool:  "bg-cyan-950/40 border-cyan-800/50",
  mild:  "bg-green-950/40 border-green-800/50",
  warm:  "bg-yellow-950/40 border-yellow-800/50",
  hot:   "bg-red-950/40 border-red-800/50",
};

export default function WeatherPanel({ city = "Tokyo" }: { city?: string }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetch(`/api/weather?city=${encodeURIComponent(city)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setWeather(d);
      })
      .catch(() => setError("天気の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [city]);

  const borderClass = weather ? LEVEL_BG[weather.outfit_level] : "bg-gray-900 border-gray-700";

  return (
    <div className={`rounded-xl border overflow-hidden ${borderClass}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🌤</span>
          <span className="font-semibold text-gray-200">天気・服装</span>
          {weather && !loading && (
            <span className={`text-sm font-bold ${LEVEL_COLOR[weather.outfit_level]}`}>
              {weather.temp}°C
            </span>
          )}
          {weather?.is_rain && (
            <span className="text-xs text-blue-300">☂ 雨</span>
          )}
        </div>
        <span className="text-gray-500 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {loading && <p className="text-gray-500 text-sm">天気を取得中...</p>}

          {error && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-yellow-400 text-xs font-semibold mb-1">⚠ 天気を取得できませんでした</p>
              <p className="text-gray-400 text-xs">{error}</p>
              <p className="text-gray-500 text-xs mt-1">
                OPENWEATHER_API_KEY を環境変数に設定してください（openweathermap.org で無料取得）
              </p>
            </div>
          )}

          {weather && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {weather.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                      alt={weather.description}
                      width={48}
                      height={48}
                      className="drop-shadow"
                    />
                  )}
                  <div>
                    <p className={`text-2xl font-bold ${LEVEL_COLOR[weather.outfit_level]}`}>
                      {weather.temp}°C
                    </p>
                    <p className="text-gray-400 text-xs">{weather.description}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-400 space-y-0.5">
                  <p>体感 {weather.feels_like}°C</p>
                  <p>最高 {weather.temp_max}° / 最低 {weather.temp_min}°</p>
                  <p>湿度 {weather.humidity}% 風 {weather.wind_speed}m/s</p>
                  <p className="text-gray-500">{weather.city}</p>
                </div>
              </div>

              <div className="bg-black/20 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-300 mb-2">👕 今日の服装</p>
                <div className="flex flex-wrap gap-1.5">
                  {weather.outfit_suggestion.map((item, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        item.startsWith("☂") || item.startsWith("防水")
                          ? "bg-blue-900/50 border-blue-700/50 text-blue-300"
                          : "bg-gray-800/50 border-gray-600/50 text-gray-300"
                      }`}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
