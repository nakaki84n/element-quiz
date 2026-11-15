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
 * 文科省の表記そのもの、またはその読み（ひらがな・カタカナ）を正解とする。
 * 例: 水素 / すいそ / スイソ、ケイ素 / けい素 / けいそ / ケイソ
 */
export function isCorrectName(answer: string, e: Element): boolean {
  const a = normalizeName(answer);
  if (!a) return false;
  return a === normalizeName(e.nameJa) || (e.reading !== undefined && a === e.reading);
}
