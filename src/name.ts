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
/** 英語名の比較用: 全角・半角をそろえ、小文字にし、空白とハイフンを除く */
export function normalizeNameEn(raw: string): string {
  return raw.normalize("NFKC").toLowerCase().replace(/[\s\-]+/g, "");
}

/**
 * 英語名が正しいか判定する。大文字・小文字は区別しない。
 * IUPAC の表記のほか、アメリカ式などの別のつづり（Aluminum、Cesium、Sulphur）も正解とする。
 */
export function isCorrectNameEn(answer: string, e: Element): boolean {
  const a = normalizeNameEn(answer);
  if (!a) return false;
  return [e.nameEn, ...(e.nameEnAlt ?? [])].some((n) => a === normalizeNameEn(n));
}

/** 英語名の表示用の整形: 英字だけにし、1文字目を大文字・残りを小文字にする */
export function formatNameEn(raw: string): string {
  const letters = raw
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[^A-Za-z]/g, "")
    .slice(0, NAME_EN_MAX);
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
}

/** 英語名の最大文字数（いちばん長いのは Rutherfordium などの13文字） */
export const NAME_EN_MAX = 16;

export function isCorrectName(answer: string, e: Element): boolean {
  const a = normalizeName(answer);
  if (!a) return false;
  if (a === normalizeName(e.nameJa)) return true;
  if (e.reading !== undefined && a === e.reading) return true;
  return (e.kanji ?? []).some((k) => a === normalizeName(k));
}
