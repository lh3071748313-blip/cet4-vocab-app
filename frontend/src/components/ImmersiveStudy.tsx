import React, { useEffect, useRef, useState } from 'react';
import { Shuffle, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import type { WordItem } from '../types';
import { speakEnglish } from '../utils/tts';

interface Props {
  queue: WordItem[];
  index: number;
  order: 'sequential' | 'random';
  scope: 'all' | 'core';
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
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
  autoSpeak,
  onToggleAutoSpeak,
  onToggleOrder,
  onToggleScope,
  onCommit,
  onClose,
  onReload,
}) => {
  const [revealed, setRevealed] = useState(false);
  const [pendingAction, setPendingAction] = useState<'known' | 'fuzzy' | 'forgot' | null>(null);
  const [hintDir, setHintDir] = useState<'left' | 'right' | null>(null);

  const topCardRef = useRef<HTMLDivElement | null>(null);
  const nextCardRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentDxRef = useRef(0);
  const isLeavingRef = useRef(false);
  const hintDirRef = useRef<'left' | 'right' | null>(null);
  const rafRef = useRef<number | null>(null);

  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;

  const currentWord = queue[index];
  const nextWord = queue[index + 1];

  const applyCardTransforms = (dx: number, animated: boolean, leaving = false) => {
    const topEl = topCardRef.current;
    const nextEl = nextCardRef.current;
    if (topEl) {
      topEl.style.transition = animated
        ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease-out'
        : 'none';
      const yOffset = leaving ? -14 : 0;
      topEl.style.transform = `translate3d(${dx}px, ${yOffset}px, 0) rotate(${dx * 0.035}deg)`;
      topEl.style.opacity = leaving ? '0' : String(Math.max(0.68, 1 - Math.abs(dx) / 420));
    }
    if (nextEl) {
      nextEl.style.transition = animated
        ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease-out'
        : 'none';
      const ratio = revealed || leaving ? (leaving ? 1 : Math.min(1, Math.abs(dx) / 220)) : 0;
      const scale = 0.94 + ratio * 0.06;
      const ty = 14 - ratio * 14;
      const op = 0.45 + ratio * 0.55;
      nextEl.style.transform = `translate3d(0, ${ty}px, 0) scale(${scale})`;
      nextEl.style.opacity = String(op);
    }
  };

  useEffect(() => {
    setRevealed(false);
    setPendingAction(null);
    setHintDir(null);
    hintDirRef.current = null;
    currentDxRef.current = 0;
    isLeavingRef.current = false;

    const topEl = topCardRef.current;
    const nextEl = nextCardRef.current;
    if (topEl) {
      topEl.style.transition = 'none';
      topEl.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
      topEl.style.opacity = '1';
    }
    if (nextEl) {
      nextEl.style.transition = 'none';
      nextEl.style.transform = 'translate3d(0, 14px, 0) scale(0.94)';
      nextEl.style.opacity = '0.45';
    }

    if (currentWord && autoSpeakRef.current) {
      speakEnglish(currentWord.word);
    }
  }, [currentWord?.id]);

  const triggerNextWithFlyOut = (dir: 'left' | 'right', action: 'known' | 'fuzzy' | 'forgot') => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    setHintDir(null);
    hintDirRef.current = null;
    const targetX = dir === 'left' ? -window.innerWidth * 1.15 : window.innerWidth * 1.15;
    applyCardTransforms(targetX, true, true);
    setTimeout(() => {
      onCommit(action);
    }, 185);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isLeavingRef.current) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    currentDxRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || isLeavingRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      currentDxRef.current = dx;
      const nextHint = dx <= -24 ? 'left' : dx >= 24 ? 'right' : null;
      if (nextHint !== hintDirRef.current) {
        hintDirRef.current = nextHint;
        setHintDir(nextHint);
      }
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          if (!isLeavingRef.current) {
            applyCardTransforms(currentDxRef.current, false, false);
          }
        });
      }
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || isLeavingRef.current) return;
    touchStartRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const dx = currentDxRef.current;
    currentDxRef.current = 0;
    setHintDir(null);
    hintDirRef.current = null;

    if (dx <= -65) {
      if (!revealed) {
        applyCardTransforms(0, true, false);
        setPendingAction('known');
        setRevealed(true);
        return;
      }
      triggerNextWithFlyOut('left', pendingAction || 'known');
    } else if (dx >= 65) {
      if (!revealed) {
        applyCardTransforms(0, true, false);
        setPendingAction('forgot');
        setRevealed(true);
        return;
      }
      triggerNextWithFlyOut('right', 'forgot');
    } else {
      applyCardTransforms(0, true, false);
    }
  };

  const handleButtonAction = (action: 'known' | 'fuzzy' | 'forgot') => {
    if (!currentWord || isLeavingRef.current) return;
    if (!revealed) {
      setPendingAction(action);
      setRevealed(true);
      return;
    }
    triggerNextWithFlyOut(action === 'forgot' ? 'right' : 'left', action);
  };

  const progressPct = queue.length > 0 ? Math.min(100, Math.round(((index + 1) / queue.length) * 100)) : 100;

  return (
    <div
      className="fixed inset-0 z-50 text-white flex flex-col safe-top safe-bottom overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.28) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(139, 92, 246, 0.24) 0%, transparent 48%), linear-gradient(160deg, #0b1021 0%, #141c3a 55%, #0d1326 100%)',
      }}
    >
      {/* Top Minimal Header */}
      <div className="relative z-10 px-4 pt-3 pb-2 flex items-center justify-between gap-2.5">
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
            onClick={onToggleAutoSpeak}
            className={`p-1.5 rounded-full transition ${
              autoSpeak ? 'bg-indigo-400/25 text-indigo-200 border border-indigo-400/30' : 'bg-white/10 text-slate-400'
            }`}
            title={autoSpeak ? '关闭自动朗读' : '开启自动朗读'}
            aria-label={autoSpeak ? '关闭自动朗读' : '开启自动朗读'}
          >
            {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
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
          <div className="bg-[#1b2345] border border-white/15 rounded-3xl p-8 text-center space-y-4">
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
            {/* Underlying Next Card (Preview - zero backdrop-blur for 60/120fps) */}
            {nextWord && (
              <div
                ref={nextCardRef}
                key={`next-${nextWord.id}`}
                style={{
                  transform: 'translate3d(0, 14px, 0) scale(0.94)',
                  opacity: 0.45,
                }}
                className="absolute inset-x-0 bg-[#171e3b] border border-white/10 rounded-[2rem] p-7 min-h-[360px] flex flex-col justify-between pointer-events-none will-change-transform"
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

            {/* Active Top Card (zero backdrop-blur, direct DOM GPU transform) */}
            <div
              ref={topCardRef}
              key={currentWord.id}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="relative w-full bg-gradient-to-br from-[#1f284d] to-[#171e3b] border border-white/20 rounded-[2rem] p-7 min-h-[360px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col justify-between touch-pan-y select-none will-change-transform"
            >
              {hintDir === 'left' && (
                <div className="absolute top-5 right-5 z-10 px-3.5 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-lg">
                  {!revealed ? '认识 · 看释义 →' : '确认 · 下一词 →'}
                </div>
              )}
              {hintDir === 'right' && (
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
                  <div className="mt-6 pt-5 border-t border-white/10 space-y-3.5 animate-[fadeIn_160ms_ease-out]">
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
