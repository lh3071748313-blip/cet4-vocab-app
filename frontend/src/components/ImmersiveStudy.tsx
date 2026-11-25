import React, { useEffect, useRef, useState } from 'react';
import { Shuffle, Sparkles, Volume2, X } from 'lucide-react';
import type { WordItem } from '../types';
import { speakEnglish } from '../utils/tts';

interface Props {
  queue: WordItem[];
  index: number;
  order: 'sequential' | 'random';
  scope: 'all' | 'core';
  onToggleOrder: () => void;
  onToggleScope: () => void;
  onCommit: (action: 'known' | 'fuzzy' | 'forgot') => void;
  onClose: () => void;
  onReload: () => void;
}

export const ImmersiveStudy: React.FC<Props> = ({
  queue,
  index,
  order,
  scope,
  onToggleOrder,
  onToggleScope,
  onCommit,
  onClose,
  onReload,
}) => {
  const [revealed, setRevealed] = useState(false);
  const [pendingAction, setPendingAction] = useState<'known' | 'fuzzy' | 'forgot' | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [leavingDir, setLeavingDir] = useState<'left' | 'right' | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const currentWord = queue[index];
  const nextWord = queue[index + 1];

  useEffect(() => {
    setRevealed(false);
    setPendingAction(null);
    setDragX(0);
    setLeavingDir(null);
    if (currentWord) {
      speakEnglish(currentWord.word);
    }
  }, [currentWord?.id]);

  const triggerNextWithFlyOut = (dir: 'left' | 'right', action: 'known' | 'fuzzy' | 'forgot') => {
    if (leavingDir) return;
    setLeavingDir(dir);
    setDragX(dir === 'left' ? -440 : 440);
    setTimeout(() => {
      onCommit(action);
    }, 190);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (leavingDir) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || leavingDir) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      setDragX(dx);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || leavingDir) return;
    touchStartRef.current = null;
    setIsDragging(false);

    if (dragX <= -65) {
      if (!revealed) {
        setDragX(0);
        setPendingAction('known');
        setRevealed(true);
        return;
      }
      triggerNextWithFlyOut('left', pendingAction || 'known');
    } else if (dragX >= 65) {
      if (!revealed) {
        setDragX(0);
        setPendingAction('forgot');
        setRevealed(true);
        return;
      }
      triggerNextWithFlyOut('right', 'forgot');
    } else {
      setDragX(0);
    }
  };

  const handleButtonAction = (action: 'known' | 'fuzzy' | 'forgot') => {
    if (!currentWord || leavingDir) return;
    if (!revealed) {
      setPendingAction(action);
      setRevealed(true);
      return;
    }
    triggerNextWithFlyOut(action === 'forgot' ? 'right' : 'left', action);
  };

  // Smoothly interpolate background card scale/opacity when top card is dragged after reveal
  const dragRatio = revealed ? Math.min(1, Math.abs(dragX) / 220) : 0;
  const nextScale = leavingDir ? 1 : 0.94 + dragRatio * 0.06;
  const nextTranslateY = leavingDir ? 0 : 14 - dragRatio * 14;
  const nextOpacity = leavingDir ? 1 : 0.42 + dragRatio * 0.58;

  const progressPct = queue.length > 0 ? Math.min(100, Math.round(((index + 1) / queue.length) * 100)) : 100;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 text-white flex flex-col safe-top safe-bottom overflow-hidden">
      {/* Top Minimal Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition"
          aria-label="退出沉浸刷词"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex-1 max-w-xs space-y-1">
          <div className="flex items-center justify-between text-[11px] text-indigo-200/80">
            <span>沉浸刷词</span>
            <span>{currentWord ? `${index + 1} / ${queue.length}` : '完成'}</span>
          </div>
          <div className="h-1 bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={onToggleScope}
            className={`px-2.5 py-1.5 rounded-full font-medium transition ${
              scope === 'core' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-white/10 text-slate-200'
            }`}
          >
            {scope === 'core' ? '核心' : '全部'}
          </button>
          <button
            type="button"
            onClick={onToggleOrder}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full font-medium transition ${
              order === 'random' ? 'bg-violet-400/25 text-violet-200 border border-violet-400/30' : 'bg-white/10 text-slate-200'
            }`}
          >
            <Shuffle className="w-3 h-3" />
            {order === 'random' ? '乱序' : '顺序'}
          </button>
        </div>
      </div>

      {/* Card Stack Stage */}
      <div className="flex-1 flex flex-col justify-center px-5 py-3 relative max-w-lg w-full mx-auto">
        {!currentWord ? (
          <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 text-center space-y-4">
            <h3 className="text-2xl font-bold">本组沉浸刷词完成！</h3>
            <p className="text-sm text-indigo-200/80">记忆曲线已同步保存</p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onReload}
                className="px-5 py-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-sm font-semibold"
              >
                再来一组
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl bg-white/10 text-sm font-semibold"
              >
                退出
              </button>
            </div>
          </div>
        ) : (
          <div className="relative w-full min-h-[380px] flex items-center justify-center">
            {/* Underlying Next Card (Preview) */}
            {nextWord && (
              <div
                key={`next-${nextWord.id}`}
                style={{
                  transform: `translate3d(0, ${nextTranslateY}px, 0) scale(${nextScale})`,
                  opacity: nextOpacity,
                  transition: isDragging
                    ? 'none'
                    : 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out',
                }}
                className="absolute inset-x-0 bg-white/10 backdrop-blur-md border border-white/10 rounded-[2rem] p-7 min-h-[360px] flex flex-col justify-between pointer-events-none will-change-transform"
              >
                <div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 text-indigo-200">
                    下一个
                  </span>
                  <h2 className="text-4xl font-extrabold tracking-tight text-white/90 mt-6">
                    {nextWord.word}
                  </h2>
                  {nextWord.phonetic && (
                    <p className="text-sm text-indigo-200/60 font-mono mt-2">{nextWord.phonetic}</p>
                  )}
                </div>
              </div>
            )}

            {/* Active Top Card */}
            <div
              key={currentWord.id}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                transform: `translate3d(${dragX}px, ${leavingDir ? -16 : 0}px, 0) rotate(${dragX * 0.04}deg)`,
                opacity: leavingDir ? 0 : Math.max(0.65, 1 - Math.abs(dragX) / 380),
                transition: isDragging
                  ? 'none'
                  : 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease-out',
              }}
              className="relative w-full bg-gradient-to-br from-slate-900/95 to-indigo-950/95 backdrop-blur-xl border border-white/15 rounded-[2rem] p-7 min-h-[360px] shadow-2xl flex flex-col justify-between touch-pan-y select-none will-change-transform"
            >
              {/* Swipe Indicator Badges */}
              {dragX <= -22 && (
                <div className="absolute top-5 right-5 z-10 px-3.5 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-lg">
                  {!revealed ? '认识 · 看释义 →' : '确认 · 下一词 →'}
                </div>
              )}
              {dragX >= 22 && (
                <div className="absolute top-5 left-5 z-10 px-3.5 py-1.5 rounded-full bg-rose-500 text-white text-xs font-bold shadow-lg">
                  {!revealed ? '← 不熟 · 看释义' : '← 记错了 · 加错题'}
                </div>
              )}

              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-500/25 text-indigo-200 border border-indigo-400/20">
                      {currentWord.is_new ? '新词' : '曲线复习'}
                    </span>
                    <span className="text-xs text-amber-300">
                      {'★'.repeat(currentWord.frequency || 3)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakEnglish(currentWord.word)}
                    className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-indigo-200 active:scale-95 transition"
                    aria-label="播放发音"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                <h2 className="text-4xl font-extrabold tracking-tight text-white mt-5">
                  {currentWord.word}
                </h2>
                {currentWord.phonetic && (
                  <p className="text-sm text-indigo-200/70 font-mono mt-1.5">{currentWord.phonetic}</p>
                )}

                {revealed ? (
                  <div className="mt-6 pt-5 border-t border-white/10 space-y-3.5 animate-[fadeIn_180ms_ease-out]">
                    <p className="text-lg font-semibold text-white leading-snug">
                      <span className="text-indigo-300 mr-2">{currentWord.pos}</span>
                      {currentWord.meaning}
                    </p>
                    {currentWord.example && (
                      <div className="bg-white/5 rounded-2xl p-3.5 space-y-1">
                        <p className="text-xs text-indigo-100/90 leading-relaxed">{currentWord.example}</p>
                        <p className="text-[11px] text-indigo-200/60">{currentWord.example_cn}</p>
                      </div>
                    )}
                    {currentWord.mnemonic && (
                      <div className="flex items-start gap-2 text-xs text-amber-200/90 bg-amber-400/10 rounded-xl p-3">
                        <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                        <span>{currentWord.mnemonic}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-14 text-center">
                    <p className="text-xs text-indigo-200/50">
                      左滑认识看释义 · 右滑不熟看释义
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 text-center text-[11px] text-indigo-200/45">
                {!revealed ? '← 右滑不熟 · 左滑认识 →' : '← 右滑记错加错题 · 左滑确认下一词 →'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Quick Action Bar */}
      {currentWord && (
        <div className="px-5 pb-5 max-w-lg w-full mx-auto">
          {!revealed ? (
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleButtonAction('forgot')}
                className="py-3.5 rounded-2xl bg-rose-500/20 text-rose-200 border border-rose-400/25 font-semibold text-sm active:scale-95 transition"
              >
                忘记
              </button>
              <button
                type="button"
                onClick={() => handleButtonAction('fuzzy')}
                className="py-3.5 rounded-2xl bg-amber-500/20 text-amber-200 border border-amber-400/25 font-semibold text-sm active:scale-95 transition"
              >
                模糊
              </button>
              <button
                type="button"
                onClick={() => handleButtonAction('known')}
                className="py-3.5 rounded-2xl bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 active:scale-95 transition"
              >
                认识
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleButtonAction('forgot')}
                className="py-3.5 rounded-2xl bg-rose-500/20 text-rose-200 border border-rose-400/25 font-semibold text-sm active:scale-95 transition"
              >
                记错了 · 加错题
              </button>
              <button
                type="button"
                onClick={() => handleButtonAction(pendingAction || 'known')}
                className="py-3.5 rounded-2xl bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 active:scale-95 transition"
              >
                {pendingAction === 'forgot' ? '下一词 →' : '确认正确 · 下一词 →'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
