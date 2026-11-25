import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Flame,
  HelpCircle,
  Keyboard,
  Layers,
  RefreshCw,
  Shuffle,
  Sparkles,
  Volume2,
  XCircle,
  Zap,
} from 'lucide-react';
import { api } from '../api/client';
import type { WordItem } from '../types';
import { speakEnglish } from '../utils/tts';

type StudyMode = 'card' | 'quiz' | 'spell' | 'flash';
type OrderType = 'sequential' | 'random';
type ScopeType = 'all' | 'core';

interface Props {
  dailyGoal: number;
  onMutated?: () => void;
}

export const StudyPage: React.FC<Props> = ({ dailyGoal, onMutated }) => {
  const [queue, setQueue] = useState<WordItem[]>([]);
  const [index, setIndex] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [studiedToday, setStudiedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<StudyMode>('card');
  const [order, setOrder] = useState<OrderType>(
    () => (localStorage.getItem('cet4_study_order') as OrderType) || 'sequential'
  );
  const [scope, setScope] = useState<ScopeType>(
    () => (localStorage.getItem('cet4_study_scope') as ScopeType) || 'all'
  );
  const [revealed, setRevealed] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [spellInput, setSpellInput] = useState('');
  const [spellChecked, setSpellChecked] = useState<'correct' | 'wrong' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const loadQueue = useCallback(
    async (customOrder = order, customScope = scope, customMode = mode) => {
      setLoading((prev) => (queue.length === 0 ? true : prev));
      const fetchLimit = customMode === 'flash' ? Math.max(dailyGoal, 50) : dailyGoal;
      try {
        const res = await api.getTodayQueue(fetchLimit, customOrder, customScope);
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
    },
    [dailyGoal, order, scope, mode]
  );

  useEffect(() => {
    loadQueue(order, scope, mode);
  }, [dailyGoal, order, scope]);

  const currentWord = queue[index];

  useEffect(() => {
    if (currentWord && mode !== 'spell') {
      speakEnglish(currentWord.word);
    }
  }, [currentWord?.id, mode]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  };

  const handleToggleOrder = (next: OrderType) => {
    if (next === order) return;
    setOrder(next);
    localStorage.setItem('cet4_study_order', next);
  };

  const handleToggleScope = (next: ScopeType) => {
    if (next === scope) return;
    setScope(next);
    localStorage.setItem('cet4_study_scope', next);
  };

  const handleSwitchMode = (nextMode: StudyMode) => {
    const prevWasFlash = mode === 'flash';
    setMode(nextMode);
    setRevealed(false);
    setSelectedOption(null);
    setSpellInput('');
    setSpellChecked(null);
    if (nextMode === 'flash' && !prevWasFlash && queue.length < 40) {
      loadQueue(order, scope, nextMode);
    }
  };

  // Optimistic UI: advance to next word immediately (0ms delay), sync to server in background
  const handleAction = (action: 'known' | 'fuzzy' | 'forgot') => {
    if (!currentWord) return;
    const targetWord = currentWord;
    const submitMode = mode === 'flash' ? 'card' : mode;

    setStudiedToday((n) => n + 1);
    setIndex((i) => i + 1);
    setRevealed(false);
    setSelectedOption(null);
    setSpellInput('');
    setSpellChecked(null);

    if (action === 'known') {
      showToast('已标记认识');
    } else if (action === 'fuzzy') {
      showToast('已标记模糊，明天巩固');
    } else {
      showToast('已加入错题本');
    }

    api
      .submitReview(targetWord.id, action, submitMode)
      .then(() => {
        onMutated?.();
      })
      .catch(() => {
        api.submitReview(targetWord.id, action, submitMode).then(() => onMutated?.()).catch(() => {});
      });
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

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      setDragX(dx);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    touchStartRef.current = null;
    setIsDragging(false);
    if (dragX <= -70) {
      setDragX(0);
      handleAction('known');
    } else if (dragX >= 70) {
      setDragX(0);
      handleAction('forgot');
    } else {
      setDragX(0);
    }
  };

  if (loading && queue.length === 0) {
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
        <h3 className="text-xl font-bold text-slate-900">本组词汇已刷完！</h3>
        <p className="text-sm text-slate-500 mt-2">
          今天已学习 <span className="font-semibold text-indigo-600">{studiedToday}</span> 个词汇，记忆曲线正在发挥作用。
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => loadQueue(order, scope, mode)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium shadow-md shadow-indigo-200 hover:bg-indigo-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            再来一组
          </button>
          {scope === 'core' && (
            <button
              type="button"
              onClick={() => handleToggleScope('all')}
              className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium"
            >
              切到全部词库
            </button>
          )}
        </div>
      </div>
    );
  }

  const progressPct = Math.min(100, Math.round(((index + 1) / queue.length) * 100));
  const showDetails = mode === 'flash' || revealed;

  return (
    <div className="space-y-3.5">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              本组 {index + 1} / {queue.length}
            </span>
            {dueCount > 0 && (
              <span className="text-slate-500">含 {dueCount} 复习</span>
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

        {/* Scope & Order Pills */}
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <div className="flex bg-slate-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => handleToggleScope('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                scope === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
              }`}
            >
              全部词库
            </button>
            <button
              type="button"
              onClick={() => handleToggleScope('core')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                scope === 'core' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-600'
              }`}
            >
              核心高频
            </button>
          </div>

          <div className="flex bg-slate-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => handleToggleOrder('sequential')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                order === 'sequential' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
              }`}
            >
              顺序
            </button>
            <button
              type="button"
              onClick={() => handleToggleOrder('random')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
                order === 'random' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-600'
              }`}
            >
              <Shuffle className="w-3 h-3" />
              乱序
            </button>
          </div>
        </div>

        {/* 4 Study Modes */}
        <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'card' as const, label: '卡片', icon: Layers },
            { id: 'flash' as const, label: '快刷', icon: Zap },
            { id: 'quiz' as const, label: '测验', icon: HelpCircle },
            { id: 'spell' as const, label: '拼写', icon: Keyboard },
          ].map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSwitchMode(m.id)}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition ${
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

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${dragX}px) rotate(${dragX * 0.03}deg)`,
          opacity: Math.max(0.55, 1 - Math.abs(dragX) / 280),
        }}
        className={`relative bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 touch-pan-y select-none ${
          isDragging ? '' : 'transition-all duration-200'
        }`}
      >
        {dragX <= -24 && (
          <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold shadow">
            认识 · 下一词 →
          </div>
        )}
        {dragX >= 24 && (
          <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-rose-500 text-white text-xs font-bold shadow">
            ← 不熟 · 加错题
          </div>
        )}
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
              {currentWord.frequency >= 4 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                  核心高频
                </span>
              )}
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
                {currentWord.phonetic && (
                  <p className="text-sm text-slate-400 font-mono mt-1">{currentWord.phonetic}</p>
                )}
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

        {showDetails && (
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

      {mode === 'flash' ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleAction('forgot')}
            className="py-4 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-sm active:scale-[0.98] transition"
          >
            不熟 / 加错题
          </button>
          <button
            type="button"
            onClick={() => handleAction('known')}
            className="py-4 rounded-2xl bg-indigo-600 text-white font-semibold text-sm shadow-md shadow-indigo-200 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
          >
            <Zap className="w-4 h-4" />
            认识 / 下一个
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => handleAction('forgot')}
            className="py-3.5 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-sm active:scale-[0.98] transition"
          >
            忘记 / 错题
          </button>
          <button
            type="button"
            onClick={() => handleAction('fuzzy')}
            className="py-3.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-sm active:scale-[0.98] transition"
          >
            模糊
          </button>
          <button
            type="button"
            onClick={() => handleAction('known')}
            className="py-3.5 rounded-2xl bg-emerald-600 text-white font-semibold text-sm shadow-md shadow-emerald-200 active:scale-[0.98] transition"
          >
            认识
          </button>
        </div>
      )}
      <p className="text-center text-[11px] text-slate-400">
        提示：左滑卡片认识并下一词 · 右滑标记不熟
      </p>
    </div>
  );
};
