import "./style.css";
import { ELEMENTS } from "./elements";
import { isCorrectName } from "./name";
import { letterFromKey, normalizeSymbol, SYMBOL_MAX } from "./symbol";
import { buildTable, type CellRefs } from "./table";

type Phase = "symbol" | "symbolResult" | "name" | "nameResult";
type Result = "correct" | "wrong" | "blank";
/** key: 物理キーボードで入力する / touch: 画面キーボードで入力する */
type InputMode = "key" | "touch";

const state = {
  phase: "symbol" as Phase,
  /** 出題する原子番号（原子番号順） */
  targets: ELEMENTS.map((e) => e.z),
  symbols: new Map<number, string>(),
  names: new Map<number, string>(),
  symbolResults: new Map<number, Result>(),
  nameResults: new Map<number, Result>(),
  inputMode: (window.matchMedia("(pointer: coarse)").matches ? "touch" : "key") as InputMode,
};

// iOS は 16px 未満の入力欄にフォーカスすると画面を拡大してしまうので、それを止める
// （maximum-scale を付けても iOS ではピンチ操作での拡大はできる）
if (/iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1");
}

const app = document.querySelector<HTMLDivElement>("#app")!;
const { root: table, cells } = buildTable();

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

// ---- 入力方法の切り替え ----
// 最初は端末の種類から推測し、その後はマスを指でタップしたかマウスでクリックしたかで切り替える

function setInputMode(mode: InputMode) {
  state.inputMode = mode;
  app.dataset.input = mode;
}

table.addEventListener("pointerdown", (e) => setInputMode(e.pointerType === "mouse" ? "key" : "touch"));

// ---- 入力欄の操作 ----

function getSymbol(z: number): string {
  return state.symbols.get(z) ?? "";
}

function setSymbol(z: number, value: string) {
  const v = normalizeSymbol(value);
  if (v) state.symbols.set(z, v);
  else state.symbols.delete(z);
  const refs = cells.get(z)!;
  refs.symbolKey.textContent = v;
  if (refs.symbolInput.value !== v) refs.symbolInput.value = v;
  renderStatus();
}

function getName(z: number): string {
  return state.names.get(z) ?? "";
}

/** いまのターンで入力する欄 */
function activeField(z: number): HTMLElement {
  const refs = cells.get(z)!;
  if (state.phase === "name") return refs.nameInput;
  return state.inputMode === "touch" ? refs.symbolInput : refs.symbolKey;
}

function focusField(z: number) {
  activeField(z).focus({ preventScroll: true });
  cells.get(z)!.cell.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** 原子番号順で前後の出題マスへ移る。最後のマスの次はボタンへ */
function moveBy(z: number, delta: 1 | -1) {
  const i = state.targets.indexOf(z) + delta;
  if (i >= 0 && i < state.targets.length) focusField(state.targets[i]);
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
  if (best) focusField(best.element.z);
}

/** マス移動のキー。処理したら true */
function handleNavKey(e: KeyboardEvent, z: number, { arrowsLeftRight }: { arrowsLeftRight: boolean }): boolean {
  switch (e.key) {
    case "Enter":
    case "Tab":
      moveBy(z, e.shiftKey ? -1 : 1);
      return true;
    case "ArrowUp":
      moveVertical(z, -1);
      return true;
    case "ArrowDown":
      moveVertical(z, 1);
      return true;
    case "ArrowLeft":
    case "ArrowRight":
      if (!arrowsLeftRight) return false;
      moveBy(z, e.key === "ArrowLeft" ? -1 : 1);
      return true;
  }
  return false;
}

/** 記号欄（キーボード用）: IME を通らないので常に英字が入る */
function onSymbolKeydown(e: KeyboardEvent, z: number) {
  if (state.phase !== "symbol") return;
  if (handleNavKey(e, z, { arrowsLeftRight: true })) {
    e.preventDefault();
    return;
  }
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

/** 記号欄（タッチ用）: <input> の内容を整形する */
function onSymbolInput(e: Event, z: number) {
  if ((e as InputEvent).isComposing) return;
  const before = getSymbol(z);
  setSymbol(z, (e.target as HTMLInputElement).value);
  const after = getSymbol(z);
  if (after.length >= SYMBOL_MAX && after !== before) moveBy(z, 1);
}

/** 文字入力欄 (<input>) 共通のキー操作 */
function onTextKeydown(e: KeyboardEvent, z: number) {
  // IME で変換中の Enter や矢印キーは変換操作なので触らない
  if (e.isComposing || e.keyCode === 229) return;
  if (state.phase !== "symbol" && state.phase !== "name") return;
  const input = e.target as HTMLInputElement;
  if (e.key === "Backspace" && !input.value) {
    e.preventDefault();
    moveBy(z, -1);
    return;
  }
  // 左右キーは文字カーソルの移動に使う
  if (handleNavKey(e, z, { arrowsLeftRight: false })) e.preventDefault();
}

for (const [z, refs] of cells) {
  refs.symbolKey.addEventListener("keydown", (e) => onSymbolKeydown(e, z));
  refs.symbolInput.addEventListener("input", (e) => onSymbolInput(e, z));
  refs.symbolInput.addEventListener("compositionend", (e) => onSymbolInput(e, z));
  refs.symbolInput.addEventListener("keydown", (e) => onTextKeydown(e, z));
  refs.nameInput.addEventListener("input", () => {
    state.names.set(z, refs.nameInput.value);
    renderStatus();
  });
  refs.nameInput.addEventListener("keydown", (e) => onTextKeydown(e, z));
  refs.cell.addEventListener("click", () => {
    if (state.phase !== "symbol" && state.phase !== "name") return;
    const field = activeField(z);
    if (document.activeElement !== field) field.focus();
  });
}

// ---- 答え合わせ ----

function confirmBlanks(get: (z: number) => string): boolean {
  const blanks = state.targets.filter((z) => !get(z).trim()).length;
  return blanks === 0 || window.confirm(`未入力のマスが ${blanks} 個あります。答え合わせしますか？`);
}

function gradeSymbols() {
  if (!confirmBlanks(getSymbol)) return;
  for (const z of state.targets) {
    const refs = cells.get(z)!;
    const answer = getSymbol(z);
    const result: Result = !answer ? "blank" : answer === refs.element.symbol ? "correct" : "wrong";
    state.symbolResults.set(z, result);
    refs.cell.classList.add(`sym-${result}`);
    refs.symbolAnswer.textContent = result === "correct" ? "" : refs.element.symbol;
  }
  state.phase = "symbolResult";
  render();
}

function startNameTurn() {
  state.phase = "name";
  render();
  scroller.scrollTo({ left: 0 });
  focusField(state.targets[0]);
}

function gradeNames() {
  if (!confirmBlanks(getName)) return;
  for (const z of state.targets) {
    const refs = cells.get(z)!;
    const answer = getName(z).trim();
    const result: Result = !answer ? "blank" : isCorrectName(answer, refs.element) ? "correct" : "wrong";
    state.nameResults.set(z, result);
    refs.cell.classList.add(`name-${result}`);
    refs.nameAnswer.textContent = result === "correct" ? "" : refs.element.nameJa;
  }
  state.phase = "nameResult";
  render();
}

function reset() {
  state.phase = "symbol";
  state.names.clear();
  state.symbolResults.clear();
  state.nameResults.clear();
  for (const [z, refs] of cells) {
    setSymbol(z, "");
    refs.nameInput.value = "";
    refs.cell.className = "cell";
    refs.symbolAnswer.textContent = "";
    refs.nameAnswer.textContent = "";
  }
  render();
  scroller.scrollTo({ left: 0 });
  focusField(state.targets[0]);
}

resetButton.addEventListener("click", () => {
  const inProgress = (state.phase === "symbol" && state.symbols.size > 0) || state.phase === "name";
  if (inProgress && !window.confirm("入力した内容を消して最初からやり直しますか？")) return;
  reset();
});

// ---- 表示 ----

function score(results: Map<number, Result>): string {
  const total = state.targets.length;
  const correct = state.targets.filter((z) => results.get(z) === "correct").length;
  return `<strong>${correct}</strong> / ${total}（${((correct / total) * 100).toFixed(1)}%）`;
}

function renderStatus() {
  const total = state.targets.length;
  switch (state.phase) {
    case "symbol": {
      const filled = state.targets.filter((z) => getSymbol(z)).length;
      status.innerHTML = `<span class="phase">記号ターン</span>入力 ${filled} / ${total}`;
      break;
    }
    case "symbolResult":
      status.innerHTML = `<span class="phase">記号ターン 結果</span>正解 ${score(state.symbolResults)}`;
      break;
    case "name": {
      const filled = state.targets.filter((z) => getName(z).trim()).length;
      status.innerHTML = `<span class="phase">名前ターン</span>入力 ${filled} / ${total}`;
      break;
    }
    case "nameResult":
      status.innerHTML =
        `<span class="phase">結果</span>` +
        `<span class="score">記号 ${score(state.symbolResults)}</span>` +
        `<span class="score">名前 ${score(state.nameResults)}</span>`;
      break;
  }
}

function render() {
  app.dataset.phase = state.phase;
  app.dataset.input = state.inputMode;
  for (const refs of cells.values()) {
    refs.symbolInput.readOnly = state.phase !== "symbol";
    refs.nameInput.disabled = state.phase === "symbol" || state.phase === "symbolResult";
    refs.nameInput.readOnly = state.phase !== "name";
  }

  actions.replaceChildren();
  const add = (label: string, onClick: () => void, primary = true) => {
    const b = button(label, primary ? "button button-primary" : "button");
    b.addEventListener("click", onClick);
    actions.append(b);
  };
  switch (state.phase) {
    case "symbol":
      add("答え合わせ", gradeSymbols);
      break;
    case "symbolResult":
      add("名前ターンへ", startNameTurn);
      add("もう一度", reset, false);
      break;
    case "name":
      add("答え合わせ", gradeNames);
      break;
    case "nameResult":
      add("もう一度", reset);
      break;
  }
  renderStatus();
}

render();
