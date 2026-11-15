// 苦手マップ: 元素ごとの累計正答率を、周期表のマスの色で表示する

import { loadRecords, type ElementStat } from "./storage";
import type { CellRefs } from "./table";

type Kind = "symbol" | "name";

/** 正答率 0〜1 からマスの色を決める配色 */
interface Palette {
  label: string;
  /** 凡例のグラデーション */
  legend: string;
  color: (rate: number) => { bg: string; border: string; fg: string };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** OKLCH の 2 色の間を補間する（色相は短い方向に回す） */
function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  let dh = b[2] - a[2];
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), a[2] + dh * t];
}

/** 複数の色を順に通るグラデーション */
function ramp(stops: [number, number, number][], t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

const css = ([l, c, h]: [number, number, number]) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;

function fromStops(stops: [number, number, number][]): Palette["color"] {
  return (rate) => {
    const [l, c, h] = ramp(stops, rate);
    return {
      bg: css([l, c, h]),
      border: css([Math.min(0.95, l + 0.12), c, h]),
      // 明るい背景には暗い文字、暗い背景には明るい文字
      fg: l > 0.66 ? "#10131a" : "#f1f3f8",
    };
  };
}

function legendOf(stops: [number, number, number][]): string {
  return `linear-gradient(90deg, ${stops.map((s, i) => `${css(s)} ${(i / (stops.length - 1)) * 100}%`).join(", ")})`;
}

function palette(label: string, stops: [number, number, number][]): Palette {
  return { label, legend: legendOf(stops), color: fromStops(stops) };
}

// 色は OKLCH（人の目に感じる明るさがそろう色空間）で指定する: [明るさ, 鮮やかさ, 色相]
export const PALETTES = {
  // 赤 → 黄 → 緑。明るさはほぼ一定で色相だけが変わる
  traffic: palette("信号（赤→黄→緑）", [
    [0.45, 0.14, 25],
    [0.52, 0.12, 85],
    [0.5, 0.13, 150],
  ]),
  // 単色: 苦手なほど濃い赤。得意な元素は背景になじみ、苦手だけが浮かび上がる
  weakRed: palette("単色・赤（苦手だけ目立つ）", [
    [0.52, 0.18, 25],
    // 色相は赤のまま、鮮やかさだけを落として背景になじませる（途中で紫を通らないように）
    [0.27, 0.012, 25],
  ]),
  // 単色: 得意なほど明るい青。覚えた元素が塗りつぶされていく
  masteryBlue: palette("単色・青（覚えた所が明るく）", [
    [0.27, 0.015, 260],
    [0.68, 0.13, 245],
  ]),
  // 紫 → 青緑 → 黄。色覚の個人差に強く、明るさが単調に増える
  viridis: palette("紫→青緑→黄（色覚に配慮）", [
    [0.32, 0.12, 300],
    [0.52, 0.1, 200],
    [0.86, 0.17, 105],
  ]),
} satisfies Record<string, Palette>;

export type PaletteKey = keyof typeof PALETTES;

const PALETTE_KEY = "element-quiz.palette.v1";

function loadPalette(): PaletteKey {
  try {
    const v = localStorage.getItem(PALETTE_KEY);
    if (v && v in PALETTES) return v as PaletteKey;
  } catch {
    // 何もしない
  }
  return "traffic";
}

function savePalette(key: PaletteKey) {
  try {
    localStorage.setItem(PALETTE_KEY, key);
  } catch {
    // 何もしない
  }
}

/** 苦手と判断する正答率 */
const WEAK = 0.5;

const percent = (ok: number, n: number) => `${Math.round((ok / n) * 100)}%`;

export function createHeatmap(app: HTMLElement, cells: Map<number, CellRefs>) {
  let kind: Kind = "symbol";
  let paletteKey = loadPalette();
  let stats: Record<number, ElementStat> = {};

  // 各マスに苦手マップ用の表示を追加
  const mapParts = new Map<number, { stat: HTMLDivElement }>();
  for (const [z, refs] of cells) {
    const map = document.createElement("div");
    map.className = "cell-map";
    const symbol = document.createElement("div");
    symbol.className = "cell-map-symbol";
    symbol.textContent = refs.element.symbol;
    const name = document.createElement("div");
    name.className = refs.nameAnswer.className.replace("cell-name-answer", "cell-map-name");
    name.textContent = refs.element.nameJa;
    const stat = document.createElement("div");
    stat.className = "cell-map-stat";
    map.append(symbol, name, stat);
    refs.cell.append(map);
    mapParts.set(z, { stat });
    refs.cell.addEventListener("mouseenter", () => showDetail(z));
    refs.cell.addEventListener("click", () => showDetail(z));
  }

  // ---- 下のバー ----
  const bar = document.createElement("div");
  bar.className = "map-bar";

  const kindSwitch = document.createElement("div");
  kindSwitch.className = "segmented";
  const kindButtons = {} as Record<Kind, HTMLButtonElement>;
  for (const [k, label] of [
    ["symbol", "記号"],
    ["name", "名前"],
  ] as const) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "segmented-item";
    b.textContent = label;
    b.addEventListener("click", () => {
      kind = k;
      paint();
    });
    kindButtons[k] = b;
    kindSwitch.append(b);
  }

  const detail = document.createElement("div");
  detail.className = "map-detail";

  const legend = document.createElement("div");
  legend.className = "map-legend";
  const legendBar = document.createElement("span");
  legendBar.className = "map-legend-bar";
  legend.append("0%", legendBar, "100%");
  const legendNone = document.createElement("span");
  legendNone.className = "map-legend-none";
  legend.append(legendNone, "未回答");

  const select = document.createElement("select");
  select.className = "map-palette";
  select.setAttribute("aria-label", "配色");
  for (const [key, p] of Object.entries(PALETTES)) {
    const o = document.createElement("option");
    o.value = key;
    o.textContent = p.label;
    select.append(o);
  }
  select.addEventListener("change", () => {
    paletteKey = select.value as PaletteKey;
    savePalette(paletteKey);
    paint();
  });

  const close = document.createElement("button");
  close.type = "button";
  close.className = "button button-primary";
  close.textContent = "閉じる";

  const left = document.createElement("div");
  left.className = "map-bar-left";
  left.append(kindSwitch, detail);
  const right = document.createElement("div");
  right.className = "map-bar-right";
  right.append(legend, select, close);
  bar.append(left, right);

  function count(s: ElementStat | undefined): { ok: number; n: number } {
    if (!s) return { ok: 0, n: 0 };
    return kind === "symbol" ? { ok: s.symbolOk, n: s.symbolTry } : { ok: s.nameOk, n: s.nameTry };
  }

  function showDetail(z: number) {
    if (app.dataset.view !== "map") return;
    const { element: e } = cells.get(z)!;
    const s = stats[z];
    const part = (label: string, ok: number, n: number) =>
      n === 0 ? `${label}：未回答` : `${label}：${ok} / ${n}（${percent(ok, n)}）`;
    detail.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = `${e.z} ${e.symbol} ${e.nameJa}`;
    detail.append(
      title,
      `　${part("記号", s?.symbolOk ?? 0, s?.symbolTry ?? 0)}　${part("名前", s?.nameOk ?? 0, s?.nameTry ?? 0)}`,
    );
  }

  function paint() {
    const p = PALETTES[paletteKey];
    select.value = paletteKey;
    legendBar.style.background = p.legend;
    for (const [k, b] of Object.entries(kindButtons)) b.setAttribute("aria-pressed", String(k === kind));
    for (const [z, refs] of cells) {
      const { ok, n } = count(stats[z]);
      const { stat } = mapParts.get(z)!;
      const none = n === 0;
      refs.cell.classList.toggle("map-none", none);
      refs.cell.classList.toggle("map-weak", !none && ok / n < WEAK);
      if (none) {
        refs.cell.style.removeProperty("--map-bg");
        refs.cell.style.removeProperty("--map-border");
        refs.cell.style.removeProperty("--map-fg");
        stat.textContent = "未回答";
      } else {
        const c = p.color(ok / n);
        refs.cell.style.setProperty("--map-bg", c.bg);
        refs.cell.style.setProperty("--map-border", c.border);
        refs.cell.style.setProperty("--map-fg", c.fg);
        stat.textContent = `${percent(ok, n)}　${ok}/${n}`;
      }
    }
  }

  function open() {
    stats = loadRecords().perElement;
    app.dataset.view = "map";
    detail.textContent = "マスにマウスを乗せるかタップすると、記号と名前の成績が出ます";
    paint();
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function closeMap() {
    delete app.dataset.view;
  }
  close.addEventListener("click", closeMap);

  return { bar, open, close: closeMap, isOpen: () => app.dataset.view === "map" };
}
