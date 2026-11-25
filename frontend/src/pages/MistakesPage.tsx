import React, { useCallback, useEffect, useState } from 'react';
import { BookX, CheckCircle2, Play, Trash2, Volume2 } from 'lucide-react';
import { api } from '../api/client';
import type { WordItem } from '../types';
import { speakEnglish } from '../utils/tts';

interface Props {
  syncVersion?: number;
  active?: boolean;
}

export const MistakesPage: React.FC<Props> = ({ syncVersion = 0, active = true }) => {
  const [items, setItems] = useState<WordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const loadMistakes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.listMistakes();
      setItems(res.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMistakes(items.length > 0);
  }, [loadMistakes, syncVersion, active]);

  const handleResolve = async (wordId: number) => {
    await api.resolveMistake(wordId);
    setItems((prev) => prev.filter((item) => item.id !== wordId));
  };

  const handleReviewAnswer = async (action: 'known' | 'forgot') => {
    const current = items[reviewIdx];
    if (!current) return;
    await api.submitReview(current.id, action, 'mistake');
    if (action === 'known') {
      const remaining = items.filter((i) => i.id !== current.id);
      setItems(remaining);
      if (reviewIdx >= remaining.length) {
        setReviewIdx(0);
        if (remaining.length === 0) setReviewing(false);
      }
    } else {
      setReviewIdx((idx) => (idx + 1) % items.length);
    }
    setRevealed(false);
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400">正在加载错题本...</div>;
  }

  if (reviewing && items.length > 0) {
    const current = items[reviewIdx] || items[0];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">错题专项消灭</h2>
          <button
            type="button"
            onClick={() => {
              setReviewing(false);
              setRevealed(false);
            }}
            className="text-xs text-indigo-600 font-medium"
          >
            返回列表 ({items.length})
          </button>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">
                累计错误 {current.wrong_count || 1} 次
              </span>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{current.word}</h3>
              <p className="text-sm text-slate-400 font-mono">{current.phonetic}</p>
            </div>
            <button
              type="button"
              onClick={() => speakEnglish(current.word)}
              className="p-3 rounded-2xl bg-indigo-50 text-indigo-600"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>

          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="w-full py-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-sm text-slate-600 font-medium"
            >
              点击查看释义与助记
            </button>
          ) : (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <p className="text-base font-medium text-slate-900">
                <span className="text-indigo-600 mr-1.5">{current.pos}</span>
                {current.meaning}
              </p>
              {current.example && (
                <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                  <p>{current.example}</p>
                  <p className="text-slate-400">{current.example_cn}</p>
                </div>
              )}
              {current.mnemonic && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3">
                  记忆技巧：{current.mnemonic}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleReviewAnswer('forgot')}
            className="py-3.5 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-sm"
          >
            还是不会
          </button>
          <button
            type="button"
            onClick={() => handleReviewAnswer('known')}
            className="py-3.5 rounded-2xl bg-emerald-600 text-white font-semibold text-sm shadow-md shadow-emerald-200"
          >
            记住了（移出错题本）
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">错题本</h2>
          <p className="text-xs text-slate-500">背词时标记“忘记”的单词会自动收录于此</p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setReviewIdx(0);
              setRevealed(false);
              setReviewing(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold shadow-sm"
          >
            <Play className="w-3.5 h-3.5" />
            专项复习 ({items.length})
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-100">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-slate-800">暂无待消灭错题</p>
          <p className="text-xs text-slate-400 mt-1">继续保持，每次复习都是对记忆的加固</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((w) => (
            <div
              key={w.id}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <BookX className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="font-bold text-base text-slate-900">{w.word}</span>
                  <span className="text-xs text-slate-400 font-mono">{w.phonetic}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">
                    错 {w.wrong_count || 1} 次
                  </span>
                </div>
                <p className="text-sm text-slate-700 mt-1">
                  <span className="text-indigo-600 font-medium mr-1">{w.pos}</span>
                  {w.meaning}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => speakEnglish(w.word)}
                  className="p-2 rounded-xl bg-indigo-50 text-indigo-600"
                  aria-label="发音"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleResolve(w.id)}
                  className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-emerald-600"
                  title="移出错题本"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
