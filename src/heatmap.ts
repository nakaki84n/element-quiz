// 苦手マップ: 元素ごとの累計正答率を、周期表のマスの色で表示する

import { loadRecords, type ElementStat } from "./storage";
import { type CellRefs, lengthClass } from "./table";

type Kind = "symbol" | "name" | "nameEn";

// 配色: 単色の赤。苦手（正答率が低い）ほど濃く鮮やかな赤になり、
// 得意な元素は背景になじむ暗いグレーになる。
// 色は OKLCH（人の目に感じる明るさがそろう色空間）で、色相は赤 (25) のまま
// 明るさと鮮やかさだけを変える。
const WEAKEST = { l: 0.52, c: 0.18 }; // 正答率 0%
const STRONGEST = { l: 0.27, c: 0.012 }; // 正答率 100%
const HUE = 25;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const oklch = (l: number, c: number) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${HUE})`;

function colorOf(rate: number): { bg: string; border: string } {
  const t = Math.min(1, Math.max(0, rate));
  const l = lerp(WEAKEST.l, STRONGEST.l, t);
  const c = lerp(WEAKEST.c, STRONGEST.c, t);
  return { bg: oklch(l, c), border: oklch(l + 0.12, c) };
}

const LEGEND = `linear-gradient(90deg, ${oklch(WEAKEST.l, WEAKEST.c)}, ${oklch(STRONGEST.l, STRONGEST.c)})`;

const percent = (ok: number, n: number) => `${Math.round((ok / n) * 100)}%`;

export function createHeatmap(app: HTMLElement, cells: Map<number, CellRefs>) {
  let kind: Kind = "symbol";
  let stats: Record<number, ElementStat> = {};

  // 各マスに苦手マップ用の表示を追加
  const mapParts = new Map<number, { name: HTMLDivElement; stat: HTMLDivElement }>();
  for (const [z, refs] of cells) {
    const map = document.createElement("div");
    map.className = "cell-map";
    const symbol = document.createElement("div");
    symbol.className = "cell-map-symbol";
    symbol.textContent = refs.element.symbol;
    const name = document.createElement("div");

    const stat = document.createElement("div");
    stat.className = "cell-map-stat";
    map.append(symbol, name, stat);
    refs.cell.append(map);
    mapParts.set(z, { name, stat });
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
    ["nameEn", "英語名"],
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


  const close = document.createElement("button");
  close.type = "button";
  close.className = "button button-primary";
  close.textContent = "閉じる";

  const left = document.createElement("div");
  left.className = "map-bar-left";
  left.append(kindSwitch, detail);
  const right = document.createElement("div");
  right.className = "map-bar-right";
  right.append(legend, close);
  bar.append(left, right);

  function count(s: ElementStat | undefined): { ok: number; n: number } {
    if (!s) return { ok: 0, n: 0 };
    if (kind === "symbol") return { ok: s.symbolOk, n: s.symbolTry };
    if (kind === "nameEn") return { ok: s.nameEnOk ?? 0, n: s.nameEnTry ?? 0 };
    return { ok: s.nameOk, n: s.nameTry };
  }

  function showDetail(z: number) {
    if (app.dataset.view !== "map") return;
    const { element: e } = cells.get(z)!;
    const s = stats[z];
    const part = (label: string, ok: number, n: number) =>
      n === 0 ? `${label}：未回答` : `${label}：${ok} / ${n}（${percent(ok, n)}）`;
    detail.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = `${e.z} ${e.symbol} ${e.nameJa}（${e.nameEn}）`;
    detail.append(
      title,
      `　${part("記号", s?.symbolOk ?? 0, s?.symbolTry ?? 0)}` +
        `　${part("名前", s?.nameOk ?? 0, s?.nameTry ?? 0)}` +
        `　${part("英語名", s?.nameEnOk ?? 0, s?.nameEnTry ?? 0)}`,
    );
  }

  function paint() {
    legendBar.style.background = LEGEND;
    for (const [k, b] of Object.entries(kindButtons)) b.setAttribute("aria-pressed", String(k === kind));
    for (const [z, refs] of cells) {
      const { ok, n } = count(stats[z]);
      const { name, stat } = mapParts.get(z)!;
      // 英語名の表示中はマスの名前も英語にする（英字は仮名より幅が狭いので少なめに数える）
      const en = kind === "nameEn";
      const text = en ? refs.element.nameEn : refs.element.nameJa;
      name.textContent = text;
      name.className = `cell-map-name ${lengthClass(en ? Math.ceil(text.length * 0.6) : text.length)}`;
      const none = n === 0;
      refs.cell.classList.toggle("map-none", none);
      if (none) {
        refs.cell.style.removeProperty("--map-bg");
        refs.cell.style.removeProperty("--map-border");
        stat.textContent = "未回答";
      } else {
        const c = colorOf(ok / n);
        refs.cell.style.setProperty("--map-bg", c.bg);
        refs.cell.style.setProperty("--map-border", c.border);
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
