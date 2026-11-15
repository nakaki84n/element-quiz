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
  /** 記号欄（キーボード用）: 文字入力欄ではないので IME を通らない。キー入力は自前で処理する */
  symbolKey: HTMLDivElement;
  /** 記号欄（タッチ用）: 画面キーボードを出すための <input> */
  symbolInput: HTMLInputElement;
  /** 元素名の入力欄 */
  nameInput: HTMLInputElement;
  /** 答え合わせ後の記号欄（記号ターン結果では「○ Be」、名前ターン以降は正しい記号） */
  symbolResult: HTMLDivElement;
  /** 名前の答え合わせ後の名前欄（「✕ ベリリム」など） */
  nameResult: HTMLDivElement;
  /** 不正解・未入力のときに正解を出す行（「→ Be」「→ ベリリウム」） */
  answer: HTMLDivElement;
  row: number;
  col: number;
}

/** 長い文字列を1行に収めるための文字サイズのクラス（○✕や→の分も含めた文字数で判定） */
export function lengthClass(length: number): string {
  return length >= 9 ? "is-xlong" : length >= 7 ? "is-long" : "";
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

function textInput(className: string, label: string, type: "text" | "url"): HTMLInputElement {
  const input = document.createElement("input");
  input.type = type;
  input.className = className;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocorrect", "off");
  input.enterKeyHint = "next";
  input.setAttribute("aria-label", label);
  return input;
}

function elementCell(e: Element): CellRefs {
  const cell = div("cell");
  cell.dataset.z = String(e.z);

  const symbolKey = div("cell-symbol cell-symbol-key");
  symbolKey.tabIndex = 0;
  symbolKey.setAttribute("role", "textbox");
  symbolKey.setAttribute("aria-label", `${e.z}番の元素記号`);
  // タッチ端末では英字キーボードが出やすい type="url" を使う
  const symbolInput = textInput("cell-symbol cell-symbol-input", `${e.z}番の元素記号`, "url");

  const nameInput = textInput("cell-name", `${e.z}番の元素名`, "text");
  nameInput.lang = "ja";
  nameInput.disabled = true;

  const symbolResult = div("cell-symbol-result");
  const nameResult = div("cell-name-result");
  const answer = div("cell-answer");

  cell.append(div("cell-z", String(e.z)), symbolKey, symbolInput, symbolResult, nameInput, nameResult, answer);
  const { row, col } = cellPosition(e);
  place(cell, row, col);
  return { element: e, cell, symbolKey, symbolInput, nameInput, symbolResult, nameResult, answer, row, col };
}

export function buildTable(): { root: HTMLDivElement; cells: Map<number, CellRefs> } {
  const root = div("ptable");

  for (let g = 1; g <= 18; g++) {
    const h = div("label label-group", String(g));
    h.dataset.range = `g${g}`;
    place(h, 1, groupCol(g));
    root.append(h);
  }
  for (let p = 1; p <= 7; p++) {
    const h = div("label label-period", String(p));
    h.dataset.range = `p${p}`;
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
    h.dataset.range = series;
    place(h, F_ROW[series], groupCol(1), 2);
    root.append(h);
  }

  const cells = new Map<number, CellRefs>();
  for (const e of ELEMENTS) {
    const refs = elementCell(e);
    cells.set(e.z, refs);
    root.append(refs.cell);
  }
  return { root, cells };
}
