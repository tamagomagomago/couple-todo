/**
 * GET /api/weather?city=Tokyo
 * OpenWeatherMap API で天気を取得し、服装を提案する
 */
import { NextRequest, NextResponse } from "next/server";

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

function suggestOutfit(
  temp: number,
  feelsLike: number,
  isRain: boolean
): { suggestions: string[]; level: WeatherData["outfit_level"] } {
  const effective = feelsLike; // 体感温度基準
  let suggestions: string[] = [];
  let level: WeatherData["outfit_level"] = "mild";

  if (effective < 5) {
    level = "cold";
    suggestions = ["ヘビーコート必須", "マフラー・手袋", "厚手インナー", "ウールパンツ推奨"];
  } else if (effective < 10) {
    level = "cold";
    suggestions = ["コート必須", "厚手ニット or インナーダウン", "ネックウォーマー推奨"];
  } else if (effective < 15) {
    level = "cool";
    suggestions = ["ライトコート or ジャケット", "長袖トップス", "重ね着推奨"];
  } else if (effective < 20) {
    level = "cool";
    suggestions = ["薄手ジャケット or カーディガン", "長袖 or 七分袖"];
  } else if (effective < 25) {
    level = "mild";
    suggestions = ["長袖シャツ or 薄手トップス", "朝晩は羽織りもの推奨"];
  } else if (effective < 30) {
    level = "warm";
    suggestions = ["半袖 OK", "日焼け止め推奨"];
  } else {
    level = "hot";
    suggestions = ["半袖・通気性重視", "熱中症注意・水分補給", "帽子・日焼け止め必須"];
  }

  if (isRain) {
    suggestions.push("☂ 傘必携", "防水シューズ or 長靴推奨");
  }

  return { suggestions, level };
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city") ?? process.env.WEATHER_CITY ?? "Tokyo";
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENWEATHER_API_KEY が未設定です" },
      { status: 400 }
    );
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=ja`;
    const res = await fetch(url, { next: { revalidate: 1800 } }); // 30分キャッシュ

    if (!res.ok) {
      return NextResponse.json({ error: `Weather API error: ${res.status}` }, { status: 500 });
    }

    const raw = await res.json();

    const isRain =
      raw.weather?.[0]?.main === "Rain" ||
      raw.weather?.[0]?.main === "Drizzle" ||
      raw.weather?.[0]?.main === "Thunderstorm";

    const temp = Math.round(raw.main?.temp ?? 0);
    const feelsLike = Math.round(raw.main?.feels_like ?? 0);
    const { suggestions, level } = suggestOutfit(temp, feelsLike, isRain);

    const data: WeatherData = {
      temp,
      feels_like: feelsLike,
      temp_max: Math.round(raw.main?.temp_max ?? 0),
      temp_min: Math.round(raw.main?.temp_min ?? 0),
      description: raw.weather?.[0]?.description ?? "",
      icon: raw.weather?.[0]?.icon ?? "",
      humidity: raw.main?.humidity ?? 0,
      wind_speed: Math.round((raw.wind?.speed ?? 0) * 10) / 10,
      city: raw.name ?? city,
      is_rain: isRain,
      outfit_suggestion: suggestions,
      outfit_level: level,
    };

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
