import type { StatsOverview, StudyQueueResponse, User, WordItem } from '../types';

const TOKEN_KEY = 'cet4_token';
const SERVER_URL_KEY = 'cet4_server_url';
const DEFAULT_NATIVE_SERVER_URL = 'https://cet4.35-212-219-217.sslip.io';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getServerUrl(): string {
  const saved = localStorage.getItem(SERVER_URL_KEY);
  if (saved) return saved;
  return isNativeCapacitor() ? DEFAULT_NATIVE_SERVER_URL : '';
}

export function setServerUrl(url: string): void {
  const cleaned = url.trim().replace(/\/+$/, '');
  if (cleaned) {
    localStorage.setItem(SERVER_URL_KEY, cleaned);
  } else {
    localStorage.removeItem(SERVER_URL_KEY);
  }
}

export function isNativeCapacitor(): boolean {
  return Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = getServerUrl();
  const url = `${base}${path}`;
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const errData = await res.json();
      if (errData?.detail) {
        message = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // ignore json parse failure
    }
    if (res.status === 401) {
      setToken(null);
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: (customBase?: string) => {
    const base = customBase !== undefined ? customBase.trim().replace(/\/+$/, '') : getServerUrl();
    return fetch(`${base}/api/health`).then((r) => {
      if (!r.ok) throw new Error('服务器连接失败');
      return r.json() as Promise<{ status: string; service: string }>;
    });
  },
  register: (username: string, password: string, daily_goal = 20) =>
    request<{ access_token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, daily_goal }),
    }),
  login: (username: string, password: string) =>
    request<{ access_token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<{ user: User }>('/api/auth/me'),
  updateGoal: (daily_goal: number) =>
    request<{ user: User }>('/api/auth/goal', {
      method: 'PATCH',
      body: JSON.stringify({ daily_goal }),
    }),
  getTodayQueue: (limit = 20, order: 'sequential' | 'random' = 'sequential', scope: 'all' | 'core' = 'all') =>
    request<StudyQueueResponse>(`/api/study/today?limit=${limit}&order=${order}&scope=${scope}`),
  submitReview: (word_id: number, action: 'known' | 'fuzzy' | 'forgot', mode: 'card' | 'quiz' | 'spell' | 'mistake') =>
    request<{
      word_id: number;
      mastery_level: number;
      interval_days: number;
      next_review_at: string;
      is_mistake: boolean;
    }>('/api/study/review', {
      method: 'POST',
      body: JSON.stringify({ word_id, action, mode }),
    }),
  listMistakes: () => request<{ items: WordItem[]; total: number }>('/api/mistakes'),
  resolveMistake: (wordId: number) =>
    request<{ ok: boolean; word_id: number }>(`/api/mistakes/${wordId}`, { method: 'DELETE' }),
  getStatsOverview: () => request<StatsOverview>('/api/stats/overview'),
  listWords: (q = '', page = 1, pageSize = 30) =>
    request<{ items: WordItem[]; total: number; page: number; page_size: number }>(
      `/api/words?q=${encodeURIComponent(q)}&page=${page}&page_size=${pageSize}`
    ),
};
