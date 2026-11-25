export interface User {
  id: number;
  username: string;
  daily_goal: number;
  created_at: string;
}

export interface WordItem {
  id: number;
  word: string;
  phonetic: string;
  pos: string;
  meaning: string;
  example: string;
  example_cn: string;
  mnemonic: string;
  frequency: number;
  tags: string;
  repetitions?: number;
  interval_days?: number;
  ease_factor?: number;
  mastery_level?: number;
  wrong_count?: number;
  is_mistake?: number;
  is_new?: number;
  next_review_at?: string | null;
  quiz_options?: string[];
}

export interface StudyQueueResponse {
  queue: WordItem[];
  due_count: number;
  new_count: number;
  studied_today: number;
  daily_goal: number;
}

export interface StatsOverview {
  total_words: number;
  learned_words: number;
  mastered_words: number;
  mistake_count: number;
  due_count: number;
  studied_today: number;
  reviews_today: number;
  accuracy_today: number;
  daily_goal: number;
  streak_days: number;
  mastery_distribution: {
    new: number;
    learning: number;
    familiar: number;
    mastered: number;
  };
  daily_trend: {
    date: string;
    label: string;
    words_count: number;
    reviews_count: number;
    correct_count: number;
  }[];
}
