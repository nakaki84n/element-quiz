import type { Element } from "./elements";

/** ひらがなをカタカナにする */
function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

/**
 * 元素名の比較用に文字列をそろえる。
 * 全角・半角の違いをなくし (NFKC)、空白を除き、ひらがなをカタカナにする。
 */
export function normalizeName(raw: string): string {
  return toKatakana(raw.normalize("NFKC").replace(/\s+/g, ""));
}

/**
 * 元素名が正しいか判定する。
 * 文科省の表記そのもの、その読み（ひらがな・カタカナ）、
 * またはその元素を表す別の漢字表記（錫・珪素など）を正解とする。
 * 例: 水素 / すいそ / スイソ、ケイ素 / けい素 / けいそ / 珪素、スズ / すず / 錫
 */
export function isCorrectName(answer: string, e: Element): boolean {
  const a = normalizeName(answer);
  if (!a) return false;
  if (a === normalizeName(e.nameJa)) return true;
  if (e.reading !== undefined && a === e.reading) return true;
  return (e.kanji ?? []).some((k) => a === normalizeName(k));
}
