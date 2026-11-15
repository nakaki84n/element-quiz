import { ELEMENTS, type Element } from "./elements";

// グリッドの列: 1列目が周期番号、2〜19列目が1〜18族
const groupCol = (group: number) => group + 1;
// グリッドの行: 1行目が族番号、2〜8行目が1〜7周期、9行目が余白、10・11行目がランタノイド・アクチノイド
const periodRow = (period: number) => period + 1;
const F_ROW = { lanthanoid: 10, actinoid: 11 } as const;
const F_FIRST = { lanthanoid: 57, actinoid: 89 } as const;

/** 1つの元素マスを構成する要素 */
export interface CellRefs {
  element: Element;
  cell: HTMLDivElement;
  /** 記号の入力欄。PC では入力欄ではない要素 (IME を通さないため)、タッチ端末では <input> */
  symbol: HTMLElement;
  name: HTMLDivElement;
  /** 答え合わせで正解を表示する場所 */
  answer: HTMLDivElement;
  row: number;
  col: number;
}

function place(el: HTMLElement, row: number, col: number, colSpan = 1) {
  el.style.gridRow = String(row);
  el.style.gridColumn = `${col} / span ${colSpan}`;
}

function div(className: string, text = ""): HTMLDivElement {
  const d = document.createElement("div");
  d.className = className;
  d.textContent = text;
  return d;
}

function cellPosition(e: Element): { row: number; col: number } {
  if (e.series) return { row: F_ROW[e.series], col: groupCol(3) + (e.z - F_FIRST[e.series]) };
  return { row: periodRow(e.period), col: groupCol(e.group!) };
}

function symbolField(e: Element, useNativeInput: boolean): HTMLElement {
  const label = `${e.z}番の元素記号`;
  if (useNativeInput) {
    // タッチ端末: 英字キーボードが出やすい type="url" を使う
    const input = document.createElement("input");
    input.type = "url";
    input.className = "cell-symbol";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocorrect", "off");
    input.enterKeyHint = "next";
    input.setAttribute("aria-label", label);
    return input;
  }
  // PC: フォーカスできるが文字入力欄ではない要素。キー入力は自前で処理する
  const field = div("cell-symbol");
  field.tabIndex = 0;
  field.setAttribute("role", "textbox");
  field.setAttribute("aria-label", label);
  return field;
}

function elementCell(e: Element, useNativeInput: boolean): CellRefs {
  const cell = div("cell");
  cell.dataset.z = String(e.z);
  const nameClass =
    e.nameJa.length >= 9 ? "cell-name cell-name-xlong" : e.nameJa.length >= 8 ? "cell-name cell-name-long" : "cell-name";
  const symbol = symbolField(e, useNativeInput);
  const name = div(nameClass);
  const answer = div("cell-answer");
  cell.append(div("cell-z", String(e.z)), answer, symbol, name);
  const { row, col } = cellPosition(e);
  place(cell, row, col);
  return { element: e, cell, symbol, name, answer, row, col };
}

export function buildTable(useNativeInput: boolean): { root: HTMLDivElement; cells: Map<number, CellRefs> } {
  const root = div("ptable");

  for (let g = 1; g <= 18; g++) {
    const h = div("label label-group", String(g));
    place(h, 1, groupCol(g));
    root.append(h);
  }
  for (let p = 1; p <= 7; p++) {
    const h = div("label label-period", String(p));
    place(h, periodRow(p), 1);
    root.append(h);
  }

  // 6・7周期の3族: ランタノイド・アクチノイドの参照マス
  const refs = [
    { period: 6, range: "57–71", name: "ランタノイド" },
    { period: 7, range: "89–103", name: "アクチノイド" },
  ];
  for (const r of refs) {
    const ref = div("cell cell-ref");
    ref.append(div("cell-ref-range", r.range), div("cell-ref-name", r.name));
    place(ref, periodRow(r.period), groupCol(3));
    root.append(ref);
  }

  // ランタノイド・アクチノイド行の見出し
  for (const [series, name] of [
    ["lanthanoid", "ランタノイド"],
    ["actinoid", "アクチノイド"],
  ] as const) {
    const h = div("label label-series", name);
    place(h, F_ROW[series], groupCol(1), 2);
    root.append(h);
  }

  const cells = new Map<number, CellRefs>();
  for (const e of ELEMENTS) {
    const refs = elementCell(e, useNativeInput);
    cells.set(e.z, refs);
    root.append(refs.cell);
  }
  return { root, cells };
}
