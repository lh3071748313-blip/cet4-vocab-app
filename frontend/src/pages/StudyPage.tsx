import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Flame,
  HelpCircle,
  Keyboard,
  Layers,
  RefreshCw,
  Sparkles,
  Volume2,
  XCircle,
} from 'lucide-react';
import { api } from '../api/client';
import type { WordItem } from '../types';
import { speakEnglish } from '../utils/tts';

type StudyMode = 'card' | 'quiz' | 'spell';

interface Props {
  dailyGoal: number;
}

export const StudyPage: React.FC<Props> = ({ dailyGoal }) => {
  const [queue, setQueue] = useState<WordItem[]>([]);
  const [index, setIndex] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [studiedToday, setStudiedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<StudyMode>('card');
  const [revealed, setRevealed] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [spellInput, setSpellInput] = useState('');
  const [spellChecked, setSpellChecked] = useState<'correct' | 'wrong' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getTodayQueue(dailyGoal);
      setQueue(res.queue);
      setDueCount(res.due_count);
      setStudiedToday(res.studied_today);
      setIndex(0);
      setRevealed(false);
      setSelectedOption(null);
      setSpellInput('');
      setSpellChecked(null);
    } finally {
      setLoading(false);
    }
  }, [dailyGoal]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const currentWord = queue[index];

  useEffect(() => {
    if (currentWord && mode !== 'spell') {
      speakEnglish(currentWord.word);
    }
  }, [currentWord?.id, mode]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleAction = async (action: 'known' | 'fuzzy' | 'forgot') => {
    if (!currentWord || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.submitReview(currentWord.id, action, mode);
      setStudiedToday((n) => n + 1);
      if (action === 'known') {
        showToast(`已掌握！${res.interval_days} 天后再次复习`);
      } else if (action === 'fuzzy') {
        showToast('已标记模糊，明天继续巩固');
      } else {
        showToast('已加入错题本，10分钟后可再次复习');
      }
      setIndex((i) => i + 1);
      setRevealed(false);
      setSelectedOption(null);
      setSpellInput('');
      setSpellChecked(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuizSelect = (opt: string) => {
    if (selectedOption || !currentWord) return;
    setSelectedOption(opt);
    setRevealed(true);
  };

  const handleSpellCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWord || spellChecked) return;
    const isCorrect = spellInput.trim().toLowerCase() === currentWord.word.toLowerCase();
    setSpellChecked(isCorrect ? 'correct' : 'wrong');
    setRevealed(true);
    speakEnglish(currentWord.word);
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm">正在生成今日艾宾浩斯复习队列...</div>
    );
  }

  if (!currentWord) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-100 mt-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">今日任务已完成！</h3>
        <p className="text-sm text-slate-500 mt-2">
          今天已学习 <span className="font-semibold text-indigo-600">{studiedToday}</span> 个词汇，记忆曲线正在发挥作用。
        </p>
        <button
          type="button"
          onClick={loadQueue}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium shadow-md shadow-indigo-200 hover:bg-indigo-700 transition"
        >
          <RefreshCw className="w-4 h-4" />
          再来一组新词
        </button>
      </div>
    );
  }

  const progressPct = Math.min(100, Math.round(((index + 1) / queue.length) * 100));

  return (
    <div className="space-y-4">
      {/* Top progress & mode switcher */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              本组 {index + 1} / {queue.length}
            </span>
            {dueCount > 0 && (
              <span className="text-slate-500">含 {dueCount} 个到期复习词</span>
            )}
          </div>
          <span className="text-slate-500">今日已学 {studiedToday} 词</span>
        </div>

        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'card' as const, label: '卡片记忆', icon: Layers },
            { id: 'quiz' as const, label: '词义测验', icon: HelpCircle },
            { id: 'spell' as const, label: '拼写默写', icon: Keyboard },
          ].map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id);
                  setRevealed(false);
                  setSelectedOption(null);
                  setSpellInput('');
                  setSpellChecked(null);
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {toast && (
        <div className="bg-slate-900 text-white text-xs text-center py-2 px-4 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Main Study Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  currentWord.is_new
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {currentWord.is_new ? '新词' : '曲线复习'}
              </span>
              <span className="text-[11px] text-amber-500">
                {'★'.repeat(currentWord.frequency || 3)}
              </span>
            </div>

            {mode === 'spell' && !revealed ? (
              <div className="mt-2">
                <p className="text-lg font-bold text-slate-900">
                  <span className="text-indigo-600 mr-1.5">{currentWord.pos}</span>
                  {currentWord.meaning}
                </p>
                <p className="text-xs text-slate-400 mt-1">请根据中文释义拼写对应的四级单词</p>
              </div>
            ) : (
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {currentWord.word}
                </h2>
                <p className="text-sm text-slate-400 font-mono mt-1">{currentWord.phonetic}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => speakEnglish(currentWord.word)}
            className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:scale-95 transition"
            aria-label="播放单词发音"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>

        {/* Mode-specific interactive area */}
        {mode === 'quiz' && !revealed && currentWord.quiz_options && (
          <div className="space-y-2.5 pt-2">
            {currentWord.quiz_options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleQuizSelect(opt)}
                className="w-full text-left px-4 py-3.5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-sm text-slate-700 transition"
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {mode === 'spell' && !revealed && (
          <form onSubmit={handleSpellCheck} className="space-y-3 pt-2">
            <input
              type="text"
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              value={spellInput}
              onChange={(e) => setSpellInput(e.target.value)}
              placeholder="输入英文单词..."
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-base font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition"
            >
              检查拼写
            </button>
          </form>
        )}

        {mode === 'card' && !revealed && (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="w-full py-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-slate-600 text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-100 transition"
          >
            <Eye className="w-4 h-4" />
            点击显示释义与例句
          </button>
        )}

        {/* Revealed Answer Details */}
        {revealed && (
          <div className="space-y-4 pt-2 border-t border-slate-100">
            {mode === 'quiz' && selectedOption && (
              <div
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium ${
                  selectedOption === currentWord.meaning
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {selectedOption === currentWord.meaning ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    回答正确！
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 shrink-0" />
                    你选择了：{selectedOption}
                  </>
                )}
              </div>
            )}

            {mode === 'spell' && spellChecked && (
              <div
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium ${
                  spellChecked === 'correct'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {spellChecked === 'correct' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    拼写完全正确！
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 shrink-0" />
                    你的拼写：{spellInput || '(空)'} · 正确：{currentWord.word}
                  </>
                )}
              </div>
            )}

            <div>
              <div className="text-xs font-semibold text-indigo-600 mb-1">词义</div>
              <p className="text-base font-medium text-slate-900">
                <span className="text-indigo-600 mr-1.5">{currentWord.pos}</span>
                {currentWord.meaning}
              </p>
            </div>

            {currentWord.example && (
              <div className="bg-slate-50 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400">真题例句</span>
                  <button
                    type="button"
                    onClick={() => speakEnglish(currentWord.example)}
                    className="text-xs text-indigo-600 flex items-center gap-1"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    朗读例句
                  </button>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed">{currentWord.example}</p>
                <p className="text-xs text-slate-500">{currentWord.example_cn}</p>
              </div>
            )}

            {currentWord.mnemonic && (
              <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-3.5 flex gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-semibold text-amber-700">记忆技巧</div>
                  <p className="text-xs text-amber-900 mt-0.5">{currentWord.mnemonic}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom SM-2 Action Buttons */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleAction('forgot')}
          className="py-3.5 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-sm active:scale-[0.98] transition"
        >
          忘记 / 错题
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleAction('fuzzy')}
          className="py-3.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-sm active:scale-[0.98] transition"
        >
          模糊
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleAction('known')}
          className="py-3.5 rounded-2xl bg-emerald-600 text-white font-semibold text-sm shadow-md shadow-emerald-200 active:scale-[0.98] transition"
        >
          认识
        </button>
      </div>
    </div>
  );
};
