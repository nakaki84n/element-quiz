import "./style.css";
import { ELEMENTS } from "./elements";
import { letterFromKey, normalizeSymbol, SYMBOL_MAX } from "./symbol";
import { buildTable, type CellRefs } from "./table";

type Phase = "symbol" | "symbolResult";

// タッチ操作が主の端末ではキーボードを出すために本物の <input> を使う
const useNativeInput = window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches;

const state = {
  phase: "symbol" as Phase,
  /** 出題する原子番号（原子番号順） */
  targets: ELEMENTS.map((e) => e.z),
  /** 入力された記号 */
  symbols: new Map<number, string>(),
};

const app = document.querySelector<HTMLDivElement>("#app")!;
const { root: table, cells } = buildTable(useNativeInput);

// ---- 画面の骨組み ----

const header = document.createElement("header");
header.className = "header";
const title = document.createElement("h1");
title.textContent = "元素記号暗記";
const resetButton = button("最初から", "button button-ghost");
header.append(title, resetButton);

const scroller = document.createElement("div");
scroller.className = "ptable-scroll";
scroller.append(table);

const footer = document.createElement("footer");
footer.className = "footer";
const status = document.createElement("div");
status.className = "status";
const actions = document.createElement("div");
actions.className = "actions";
footer.append(status, actions);

app.append(header, scroller, footer);

function button(label: string, className = "button"): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = label;
  return b;
}

// ---- 入力 ----

function getSymbol(z: number): string {
  return state.symbols.get(z) ?? "";
}

function setSymbol(z: number, value: string) {
  const v = normalizeSymbol(value);
  if (v) state.symbols.set(z, v);
  else state.symbols.delete(z);
  const field = cells.get(z)!.symbol;
  if (field instanceof HTMLInputElement) {
    if (field.value !== v) field.value = v;
  } else {
    field.textContent = v;
  }
  renderStatus();
}

function focusSymbol(z: number) {
  const refs = cells.get(z)!;
  refs.symbol.focus({ preventScroll: true });
  refs.cell.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** 原子番号順で前後の出題マスへ移る。端まで来たら答え合わせボタンへ */
function moveBy(z: number, delta: 1 | -1) {
  const i = state.targets.indexOf(z) + delta;
  if (i >= 0 && i < state.targets.length) focusSymbol(state.targets[i]);
  else if (delta === 1) actions.querySelector("button")?.focus();
}

/** 同じ列の上下で一番近い出題マスへ移る */
function moveVertical(z: number, dir: 1 | -1) {
  const from = cells.get(z)!;
  let best: CellRefs | null = null;
  for (const t of state.targets) {
    const c = cells.get(t)!;
    if (c.col !== from.col || (c.row - from.row) * dir <= 0) continue;
    if (!best || Math.abs(c.row - from.row) < Math.abs(best.row - from.row)) best = c;
  }
  if (best) focusSymbol(best.element.z);
}

function handleNavKey(e: KeyboardEvent, z: number): boolean {
  switch (e.key) {
    case "Enter":
    case "Tab":
      moveBy(z, e.shiftKey ? -1 : 1);
      return true;
    case "ArrowLeft":
      moveBy(z, -1);
      return true;
    case "ArrowRight":
      moveBy(z, 1);
      return true;
    case "ArrowUp":
      moveVertical(z, -1);
      return true;
    case "ArrowDown":
      moveVertical(z, 1);
      return true;
  }
  return false;
}

/** PC: 入力欄ではない要素でキーを受け取る（IME を通らないので常に英字が入る） */
function onFieldKeydown(e: KeyboardEvent, z: number) {
  if (handleNavKey(e, z)) {
    e.preventDefault();
    return;
  }
  if (state.phase !== "symbol") return;

  const current = getSymbol(z);
  const letter = letterFromKey(e);
  if (letter) {
    e.preventDefault();
    // すでに2文字入っていれば打ち直しとみなす
    const next = current.length >= SYMBOL_MAX ? letter : current + letter;
    setSymbol(z, next);
    if (next.length >= SYMBOL_MAX) moveBy(z, 1);
  } else if (e.key === "Backspace") {
    e.preventDefault();
    if (current) setSymbol(z, current.slice(0, -1));
    else moveBy(z, -1);
  } else if (e.key === "Delete") {
    e.preventDefault();
    setSymbol(z, "");
  }
}

/** タッチ端末: <input> の内容を整形する */
function onNativeInput(e: Event, z: number) {
  const input = e.target as HTMLInputElement;
  if ((e as InputEvent).isComposing) return;
  const before = getSymbol(z);
  setSymbol(z, input.value);
  const after = getSymbol(z);
  if (after.length >= SYMBOL_MAX && after !== before) moveBy(z, 1);
}

function onNativeKeydown(e: KeyboardEvent, z: number) {
  const input = e.target as HTMLInputElement;
  // 文字カーソルの移動に使う左右キーはそのまま
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") return;
  if (e.key === "Backspace" && !input.value && state.phase === "symbol") {
    e.preventDefault();
    moveBy(z, -1);
    return;
  }
  if (handleNavKey(e, z)) e.preventDefault();
}

for (const [z, refs] of cells) {
  const field = refs.symbol;
  if (field instanceof HTMLInputElement) {
    field.addEventListener("input", (e) => onNativeInput(e, z));
    field.addEventListener("compositionend", (e) => onNativeInput(e, z));
    field.addEventListener("keydown", (e) => onNativeKeydown(e, z));
  } else {
    field.addEventListener("keydown", (e) => onFieldKeydown(e, z));
  }
  refs.cell.addEventListener("click", () => {
    if (document.activeElement !== field) field.focus();
  });
}

// ---- 答え合わせ ----

function gradeSymbols() {
  const blanks = state.targets.filter((z) => !getSymbol(z)).length;
  if (blanks > 0 && !window.confirm(`未入力のマスが ${blanks} 個あります。答え合わせしますか？`)) return;

  state.phase = "symbolResult";
  for (const z of state.targets) {
    const refs = cells.get(z)!;
    const answer = getSymbol(z);
    const result = !answer ? "blank" : answer === refs.element.symbol ? "correct" : "wrong";
    refs.cell.classList.add(`is-${result}`);
    refs.answer.textContent = result === "correct" ? "" : refs.element.symbol;
  }
  render();
}

function reset() {
  state.phase = "symbol";
  for (const [z, refs] of cells) {
    setSymbol(z, "");
    refs.cell.classList.remove("is-correct", "is-wrong", "is-blank");
    refs.answer.textContent = "";
  }
  render();
  scroller.scrollTo({ left: 0 });
  focusSymbol(state.targets[0]);
}

resetButton.addEventListener("click", () => {
  const hasInput = state.symbols.size > 0;
  if (hasInput && state.phase === "symbol" && !window.confirm("入力した内容を消して最初からやり直しますか？")) return;
  reset();
});

// ---- 表示 ----

function renderStatus() {
  const total = state.targets.length;
  if (state.phase === "symbol") {
    const filled = state.targets.filter((z) => getSymbol(z)).length;
    status.innerHTML = `<span class="phase">記号ターン</span> 入力 ${filled} / ${total}`;
  } else {
    const correct = state.targets.filter((z) => getSymbol(z) === cells.get(z)!.element.symbol).length;
    const rate = ((correct / total) * 100).toFixed(1);
    status.innerHTML = `<span class="phase">記号ターン 結果</span> 正解 <strong>${correct}</strong> / ${total}（${rate}%）`;
  }
}

function render() {
  app.dataset.phase = state.phase;
  for (const refs of cells.values()) {
    if (refs.symbol instanceof HTMLInputElement) refs.symbol.readOnly = state.phase !== "symbol";
  }
  actions.replaceChildren();
  if (state.phase === "symbol") {
    const grade = button("答え合わせ", "button button-primary");
    grade.addEventListener("click", gradeSymbols);
    actions.append(grade);
  } else {
    const again = button("もう一度", "button button-primary");
    again.addEventListener("click", reset);
    actions.append(again);
  }
  renderStatus();
}

render();
