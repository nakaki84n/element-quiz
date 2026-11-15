import type { Element } from "./elements";

/**
 * 集中モードで選べる範囲。
 * "p1"〜"p7": 周期 / "g1"〜"g18": 族 / "lanthanoid" / "actinoid"
 * ランタノイド・アクチノイドは周期・族の選択には含めず、専用の範囲で選ぶ。
 */
export type RangeKey = string;

export const PERIOD_KEYS: RangeKey[] = Array.from({ length: 7 }, (_, i) => `p${i + 1}`);
export const GROUP_KEYS: RangeKey[] = Array.from({ length: 18 }, (_, i) => `g${i + 1}`);
export const SERIES_KEYS: RangeKey[] = ["lanthanoid", "actinoid"];

/** 慣用名のある族 */
export const GROUP_NAMES: Readonly<Record<RangeKey, string>> = {
  g1: "アルカリ金属",
  g2: "アルカリ土類金属",
  g15: "プニクトゲン",
  g16: "カルコゲン",
  g17: "ハロゲン",
  g18: "貴ガス",
};

export function inRange(e: Element, key: RangeKey): boolean {
  if (key === "lanthanoid" || key === "actinoid") return e.series === key;
  if (e.series) return false;
  if (key.startsWith("p")) return e.period === Number(key.slice(1));
  if (key.startsWith("g")) return e.group === Number(key.slice(1));
  return false;
}

export function rangeLabel(key: RangeKey): string {
  if (key === "lanthanoid") return "ランタノイド";
  if (key === "actinoid") return "アクチノイド";
  return key.startsWith("p") ? `第${key.slice(1)}周期` : `${key.slice(1)}族`;
}

/** 選択範囲の表示用の名前（例: "第3周期・1族"） */
export function selectionLabel(keys: Iterable<RangeKey>): string {
  const order = [...PERIOD_KEYS, ...GROUP_KEYS, ...SERIES_KEYS];
  return [...keys]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map(rangeLabel)
    .join("・");
}
