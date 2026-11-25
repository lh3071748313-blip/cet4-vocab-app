/**
 * Pronounce English word or sentence.
 * Prefers browser/WebView SpeechSynthesis, falls back to Youdao audio stream for single words.
 */
export function speakEnglish(text: string, accent: 'US' | 'UK' = 'US'): void {
  const cleaned = text.trim();
  if (!cleaned) return;

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(cleaned);
      utter.lang = accent === 'US' ? 'en-US' : 'en-GB';
      utter.rate = 0.92;
      window.speechSynthesis.speak(utter);
      return;
    } catch {
      // Fallback to audio stream below
    }
  }

  // Fallback for environments without SpeechSynthesis
  if (!cleaned.includes(' ')) {
    const type = accent === 'US' ? 2 : 1;
    const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleaned)}&type=${type}`);
    audio.play().catch(() => {});
  }
}
