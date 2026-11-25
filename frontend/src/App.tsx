import React, { useEffect, useState } from 'react';
import { BarChart3, BookOpen, BookX, Library } from 'lucide-react';
import { api, getToken, setToken } from './api/client';
import { AuthPage } from './pages/AuthPage';
import { MistakesPage } from './pages/MistakesPage';
import { StatsPage } from './pages/StatsPage';
import { StudyPage } from './pages/StudyPage';
import { WordsPage } from './pages/WordsPage';
import type { User } from './types';

type Tab = 'study' | 'mistakes' | 'words' | 'stats';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('study');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChecking(false);
      return;
    }
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
        正在同步学习进度...
      </div>
    );
  }

  if (!user) {
    return <AuthPage onSuccess={(u) => setUser(u)} />;
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'study', label: '背单词', icon: BookOpen },
    { id: 'mistakes', label: '错题本', icon: BookX },
    { id: 'words', label: '词库', icon: Library },
    { id: 'stats', label: '统计', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-100 safe-top">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              CET4
            </div>
            <span className="font-bold text-slate-900 text-base">四级词汇大师</span>
          </div>
          <span className="text-xs text-slate-500">Hi, {user.username}</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4">
        {tab === 'study' && <StudyPage dailyGoal={user.daily_goal} />}
        {tab === 'mistakes' && <MistakesPage />}
        {tab === 'words' && <WordsPage />}
        {tab === 'stats' && (
          <StatsPage
            user={user}
            onUserUpdate={setUser}
            onLogout={() => {
              setToken(null);
              setUser(null);
            }}
          />
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 safe-bottom">
        <div className="max-w-lg mx-auto grid grid-cols-4">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] font-medium transition ${
                  active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default App;
