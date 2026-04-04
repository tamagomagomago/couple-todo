/**
 * ユーザープロフィール
 * AIアドバイス・TODO生成・スケジュール計画に共通で使用するコンテキスト
 */
export const USER_PROFILE = {
  name: "外堀",
  location: "東京都新宿区（新宿御苑前駅付近）",
  commute: "浜町駅付近へ通勤。9:20出社、19:00退社（理想）。残業時は19:00〜22:00帰宅。",
  personality: "論理的思考、アウトプット重視。効率と成果を最優先する。",
  income: "年収850万",
  investment_principal: "投資元本約800万",
  available_time: "平日夜3時間（20:00-22:00）、休日10時間",

  goals: {
    long_term:  "5年以内: 資産1億円でサイドFIRE、タワマン居住、VFX/AI事業での成功",
    mid_term:   "1〜2年: 投資額3000万円突破、英語でのコミュニケーション習得",
    short_term: "2026年4月まで: ベンチプレス100kg達成",
  },

  projects: {
    vfx:        "Blender・DaVinci Resolveを使用。AIを活用した副業やFOOHコンテンツ制作。",
    investment: "株式投資（押し目買い、新高値ブレイク戦略）。AI関連銘柄や成長株に注目。",
    fitness:    "ベンチプレス特化型メニュー。月・水・金の胸トレを軸に、姿勢矯正（背中）や肩トレをルーティン化。",
    english:    "現在TOEIC500程度。2026年GWに一人で海外旅行に行けるレベルを目指す。",
    social:     "彼女できたので恋愛は一旦完了。男女問わずいつでも仲良くなれるトーク・外見磨きのレベルアップを目指す。",
  },

  ai_role: "人生の最高責任者兼コンサルタント",
  tools:   "GoogleカレンダーとGoogle TODOを併用",
} as const;

/** AI呼び出し時に添付するプロフィール文字列を生成 */
export function buildProfileContext(): string {
  const p = USER_PROFILE;
  return `
【ユーザープロフィール: ${p.name}】
居住地: ${p.location}
通勤: ${p.commute}
性格・志向: ${p.personality}
収入: ${p.income} / ${p.investment_principal}
利用可能時間: ${p.available_time}

【目標】
長期（5年）: ${p.goals.long_term}
中期（1〜2年）: ${p.goals.mid_term}
短期（〜2026/04）: ${p.goals.short_term}

【プロジェクト】
VFX/生成AI: ${p.projects.vfx}
投資: ${p.projects.investment}
筋トレ: ${p.projects.fitness}
英語: ${p.projects.english}
社交: ${p.projects.social}
`.trim();
}
