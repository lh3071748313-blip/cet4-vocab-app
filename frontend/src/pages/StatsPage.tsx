import React, { useEffect, useState } from 'react';
import { Award, Calendar, Flame, LogOut, Server, Target } from 'lucide-react';
import { api, getServerUrl } from '../api/client';
import type { StatsOverview, User } from '../types';

interface Props {
  user: User;
  onUserUpdate: (u: User) => void;
  onLogout: () => void;
}

export const StatsPage: React.FC<Props> = ({ user, onUserUpdate, onLogout }) => {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [goalInput, setGoalInput] = useState(user.daily_goal);
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    api.getStatsOverview().then(setStats).catch(() => {});
  }, []);

  const handleSaveGoal = async () => {
    setSavingGoal(true);
    try {
      const res = await api.updateGoal(goalInput);
      onUserUpdate(res.user);
      const refreshed = await api.getStatsOverview();
      setStats(refreshed);
    } finally {
      setSavingGoal(false);
    }
  };

  if (!stats) {
    return <div className="py-16 text-center text-sm text-slate-400">正在加载学习数据...</div>;
  }

  const maxTrend = Math.max(10, ...stats.daily_trend.map((d) => d.words_count));
  const goalPct = Math.min(100, Math.round((stats.studied_today / stats.daily_goal) * 100));

  return (
    <div className="space-y-4">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-3xl p-4 shadow-md shadow-indigo-100">
          <div className="flex items-center justify-between opacity-85 text-xs">
            <span>连续打卡</span>
            <Flame className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-3xl font-extrabold mt-2">
            {stats.streak_days} <span className="text-sm font-normal">天</span>
          </div>
          <div className="text-[11px] opacity-80 mt-1">今日正确率 {stats.accuracy_today}%</div>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>已掌握词汇</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {stats.mastered_words}
            <span className="text-sm font-normal text-slate-400"> / {stats.total_words}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            已学 {stats.learned_words} · 错题 {stats.mistake_count}
          </div>
        </div>
      </div>

      {/* Today's Goal Progress */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Target className="w-4 h-4 text-indigo-600" />
            今日学习目标
          </div>
          <span className="text-xs font-semibold text-indigo-600">
            {stats.studied_today} / {stats.daily_goal} 词 ({goalPct}%)
          </span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all"
            style={{ width: `${goalPct}%` }}
          />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={goalInput}
            onChange={(e) => setGoalInput(Number(e.target.value))}
            className="flex-1 accent-indigo-600"
          />
          <button
            type="button"
            disabled={savingGoal || goalInput === user.daily_goal}
            onClick={handleSaveGoal}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-semibold disabled:opacity-40"
          >
            设为 {goalInput} 词
          </button>
        </div>
      </div>

      {/* Mastery Distribution */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-900">词汇记忆分布</h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: '未学', val: stats.mastery_distribution.new, cls: 'bg-slate-100 text-slate-700' },
            { label: '初识', val: stats.mastery_distribution.learning, cls: 'bg-amber-50 text-amber-700' },
            { label: '熟悉', val: stats.mastery_distribution.familiar, cls: 'bg-sky-50 text-sky-700' },
            { label: '掌握', val: stats.mastery_distribution.mastered, cls: 'bg-emerald-50 text-emerald-700' },
          ].map((b) => (
            <div key={b.label} className={`rounded-2xl py-3 ${b.cls}`}>
              <div className="text-lg font-bold">{b.val}</div>
              <div className="text-[11px]">{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 14-day Trend Bar Chart */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Calendar className="w-4 h-4 text-indigo-600" />
          近 14 天学习趋势
        </div>
        <div className="flex items-end justify-between gap-1.5 h-32 pt-4">
          {stats.daily_trend.map((d) => {
            const hPct = Math.max(6, Math.round((d.words_count / maxTrend) * 100));
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div
                  title={`${d.date}: ${d.words_count}词`}
                  className={`w-full rounded-t-md transition-all ${
                    d.words_count > 0 ? 'bg-indigo-500' : 'bg-slate-100'
                  }`}
                  style={{ height: `${hPct}%` }}
                />
                <span className="text-[9px] text-slate-400">{d.label.slice(3)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Account & Server Info */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">当前账号：{user.username}</div>
          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
            <Server className="w-3.5 h-3.5" />
            {getServerUrl() || '同域服务器'}
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-rose-50 hover:text-rose-600 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          退出登录
        </button>
      </div>
    </div>
  );
};
