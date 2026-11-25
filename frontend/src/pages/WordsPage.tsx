import React, { useEffect, useState } from 'react';
import { Search, Volume2 } from 'lucide-react';
import { api } from '../api/client';
import type { WordItem } from '../types';
import { speakEnglish } from '../utils/tts';

const masteryBadge = (level = 0) => {
  if (level >= 3) return { label: '已掌握', cls: 'bg-emerald-100 text-emerald-700' };
  if (level === 2) return { label: '熟悉', cls: 'bg-sky-100 text-sky-700' };
  if (level === 1) return { label: '初识', cls: 'bg-amber-100 text-amber-700' };
  return { label: '未学', cls: 'bg-slate-100 text-slate-500' };
};

export const WordsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<WordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.listWords(query, 1, 50);
        if (active) {
          setItems(res.items);
          setTotal(res.total);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">核心词库</h2>
        <span className="text-xs text-slate-500">共 {total} 词</span>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索英文单词或中文释义..."
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">正在加载词库...</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">没有找到匹配的单词</div>
      ) : (
        <div className="space-y-2.5">
          {items.map((w) => {
            const badge = masteryBadge(w.mastery_level);
            return (
              <div
                key={w.id}
                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-slate-900">{w.word}</span>
                    <span className="text-xs text-slate-400 font-mono">{w.phonetic}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mt-1">
                    <span className="text-indigo-600 font-medium mr-1.5">{w.pos}</span>
                    {w.meaning}
                  </p>
                  {w.example && (
                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{w.example}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => speakEnglish(w.word)}
                  aria-label={`朗读 ${w.word}`}
                  className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:scale-95 transition shrink-0"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
