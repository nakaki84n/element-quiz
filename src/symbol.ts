/** 元素記号の最大文字数 */
export const SYMBOL_MAX = 2;

/**
 * 入力された文字列を元素記号の形にそろえる。
 * 全角英字は半角にし、英字以外は捨て、2文字までに切り、
 * 1文字目を大文字・2文字目を小文字にする。
 */
export function normalizeSymbol(raw: string): string {
  const letters = raw
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[^A-Za-z]/g, "")
    .slice(0, SYMBOL_MAX);
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
}

/**
 * キーボードイベントから入力された英字1文字を取り出す。英字でなければ null。
 * IME がオンでも物理キー (e.code) から英字を拾えるようにしている。
 */
export function letterFromKey(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (/^[A-Za-z]$/.test(e.key)) return e.key;
  const m = /^Key([A-Z])$/.exec(e.code);
  if (m && (e.key === "Process" || e.key.length === 1)) return m[1];
  return null;
}
