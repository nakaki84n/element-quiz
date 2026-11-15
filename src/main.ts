import "./style.css";
import { ELEMENTS, type Element } from "./elements";

// グリッドの列: 1列目が周期番号、2〜19列目が1〜18族
const groupCol = (group: number) => group + 1;
// グリッドの行: 1行目が族番号、2〜8行目が1〜7周期、9行目が余白、10・11行目がランタノイド・アクチノイド
const periodRow = (period: number) => period + 1;
const F_ROW = { lanthanoid: 10, actinoid: 11 } as const;
const F_FIRST = { lanthanoid: 57, actinoid: 89 } as const;

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

function elementCell(e: Element): HTMLDivElement {
  const cell = div("cell");
  cell.dataset.z = String(e.z);
  const nameClass = e.nameJa.length >= 9 ? "cell-name cell-name-xlong" : e.nameJa.length >= 8 ? "cell-name cell-name-long" : "cell-name";
  cell.append(div("cell-z", String(e.z)), div("cell-symbol", e.symbol), div(nameClass, e.nameJa));
  if (e.series) {
    place(cell, F_ROW[e.series], groupCol(3) + (e.z - F_FIRST[e.series]));
  } else {
    place(cell, periodRow(e.period), groupCol(e.group!));
  }
  return cell;
}

function buildTable(): HTMLDivElement {
  const table = div("ptable");

  for (let g = 1; g <= 18; g++) {
    const h = div("label label-group", String(g));
    place(h, 1, groupCol(g));
    table.append(h);
  }
  for (let p = 1; p <= 7; p++) {
    const h = div("label label-period", String(p));
    place(h, periodRow(p), 1);
    table.append(h);
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
    table.append(ref);
  }

  // ランタノイド・アクチノイド行の見出し
  for (const [series, name] of [
    ["lanthanoid", "ランタノイド"],
    ["actinoid", "アクチノイド"],
  ] as const) {
    const h = div("label label-series", name);
    place(h, F_ROW[series], groupCol(1), 2);
    table.append(h);
  }

  for (const e of ELEMENTS) table.append(elementCell(e));
  return table;
}

function main() {
  const app = document.querySelector<HTMLDivElement>("#app")!;

  const header = document.createElement("header");
  header.className = "header";
  const title = document.createElement("h1");
  title.textContent = "元素記号暗記";

  // ステップ1の確認用: 元素データを表に表示する
  const toggle = document.createElement("label");
  toggle.className = "toggle";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  toggle.append(checkbox, "正解を表示");
  header.append(title, toggle);

  const scroller = div("ptable-scroll");
  scroller.append(buildTable());
  app.append(header, scroller);

  checkbox.addEventListener("change", () => {
    app.classList.toggle("show-answers", checkbox.checked);
  });
}

main();
