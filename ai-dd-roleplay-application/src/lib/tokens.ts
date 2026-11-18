/** Быстрая оценка токенов без токенизатора: кириллица «дороже» латиницы. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cyr = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if ((c >= 0x0400 && c <= 0x04ff) || c > 0x2e80) cyr++;
  }
  const other = text.length - cyr;
  return Math.ceil(cyr / 2.1 + other / 3.8) + 1;
}

/** Обрезка текста до бюджета токенов с сохранением начала и конца. */
export function clipToTokens(text: string, max: number): string {
  if (estimateTokens(text) <= max) return text;
  const ratio = max / Math.max(1, estimateTokens(text));
  const keep = Math.max(20, Math.floor(text.length * ratio));
  const head = Math.floor(keep * 0.65);
  const tail = keep - head;
  return text.slice(0, head).trimEnd() + " […] " + text.slice(text.length - tail).trimStart();
}
