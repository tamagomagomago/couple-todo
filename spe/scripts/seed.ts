/**
 * サンプルデータ投入スクリプト
 * 実行: npm run seed
 * 前提: .env.local に Supabase の環境変数が設定済みであること
 */

import { config } from "dotenv";
import { resolve } from "path";

// .env.local を読み込む
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seed() {
  console.log("🌱 サンプルデータを投入します...\n");

  // --- TODOs (5件) ---
  const todos = [
    {
      title: "FOOH動画 コンテ作成",
      description: "新宿駅前のFOOHコンセプト動画のコンテを完成させる",
      priority: 1,
      estimated_minutes: 60,
      category: "vfx",
      due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    },
    {
      title: "TOEIC リスニング練習 Part3&4",
      description: "公式問題集 Vol.9 を2セット解く",
      priority: 2,
      estimated_minutes: 45,
      category: "english",
    },
    {
      title: "S&P500 ETF 積立設定の見直し",
      description: "毎月の積立額を確認し、ポートフォリオのリバランスを検討する",
      priority: 2,
      estimated_minutes: 30,
      category: "investment",
    },
    {
      title: "ベンチプレス 60kg×10rep×3set",
      description: "昼休みのジムセッション",
      priority: 3,
      estimated_minutes: 30,
      category: "fitness",
    },
    {
      title: "技術士 第二次試験 過去問を3問解く",
      description: "選択科目: 電気電子",
      priority: 2,
      estimated_minutes: 90,
      category: "personal",
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    },
  ];

  const { data: insertedTodos, error: todoError } = await supabase
    .from("todos")
    .insert(todos)
    .select();

  if (todoError) {
    console.error("❌ TODO挿入エラー:", todoError.message);
  } else {
    console.log(`✅ TODO ${insertedTodos?.length}件を挿入しました`);
    insertedTodos?.forEach((t) => console.log(`   - [P${t.priority}/${t.category}] ${t.title}`));
  }

  // --- Goals (3件) ---
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
  const yearEnd = new Date(now.getFullYear(), 11, 31).toISOString().split("T")[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
  const weekStart = new Date(
    now.getTime() - now.getDay() * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];
  const weekEnd = new Date(
    now.getTime() + (6 - now.getDay()) * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const goals = [
    {
      title: "ベンチプレス 100kg達成",
      description: "年間目標: 現在70kg → 100kgを目指す",
      category: "fitness",
      period_type: "annual",
      target_value: 100,
      current_value: 72.5,
      unit: "kg",
      start_date: yearStart,
      end_date: yearEnd,
    },
    {
      title: "TOEIC 700点取得",
      description: "現在580点 → 700点を目指す",
      category: "english",
      period_type: "annual",
      target_value: 700,
      current_value: 580,
      unit: "点",
      start_date: yearStart,
      end_date: yearEnd,
    },
    {
      title: "FOOH作品 3本公開",
      description: "SNSでのFOOH動画を3本完成・公開する",
      category: "vfx",
      period_type: "annual",
      target_value: 3,
      current_value: 0,
      unit: "本",
      start_date: yearStart,
      end_date: yearEnd,
    },
  ];

  const { data: insertedGoals, error: goalError } = await supabase
    .from("goals")
    .insert(goals)
    .select();

  if (goalError) {
    console.error("❌ Goal挿入エラー:", goalError.message);
  } else {
    console.log(`\n✅ Goal ${insertedGoals?.length}件を挿入しました`);
    insertedGoals?.forEach((g) =>
      console.log(
        `   - [${g.period_type}/${g.category}] ${g.title}: ${g.current_value}/${g.target_value}${g.unit}`
      )
    );
  }

  console.log("\n🎉 シード完了！");
}

seed().catch((e) => {
  console.error("予期せぬエラー:", e);
  process.exit(1);
});
