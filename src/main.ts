import "./style.css";
import { ELEMENTS } from "./elements";
import { isCorrectName } from "./name";
import { GROUP_KEYS, inRange, PERIOD_KEYS, rangeLabel, type RangeKey, selectionLabel, SERIES_KEYS } from "./range";
import { renderHistory } from "./history";
import { loadSession, recordNameTurn, recordSymbolTurn, saveSession } from "./storage";
import { letterFromKey, normalizeSymbol, SYMBOL_MAX } from "./symbol";
import { buildTable, type CellRefs } from "./table";

type Phase = "symbol" | "symbolResult" | "name" | "nameResult";
type Result = "correct" | "wrong" | "blank";
/** key: 物理キーボードで入力する / touch: 画面キーボードで入力する */
type InputMode = "key" | "touch";
/** full: 全体モード / focus: 集中モード */
type Mode = "full" | "focus";

const state = {
  phase: "symbol" as Phase,
  mode: "full" as Mode,
  /** 集中モードで選んでいる範囲 */
  selection: new Set<RangeKey>(),
  /** 出題する原子番号（原子番号順） */
  targets: ELEMENTS.map((e) => e.z),
  symbols: new Map<number, string>(),
  names: new Map<number, string>(),
  symbolResults: new Map<number, Result>(),
  nameResults: new Map<number, Result>(),
  /** この回の記録の id（記号ターンの答え合わせで決まる） */
  recordId: null as string | null,
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
const historyButton = button("履歴", "button button-ghost");
historyButton.addEventListener("click", () => renderHistory());

// 全体モード・集中モードの切り替え
const modeSwitch = document.createElement("div");
modeSwitch.className = "segmented";
modeSwitch.setAttribute("role", "group");
modeSwitch.setAttribute("aria-label", "モード");
const modeButtons = {
  full: button("全体", "segmented-item"),
  focus: button("集中", "segmented-item"),
} as const;
modeSwitch.append(modeButtons.full, modeButtons.focus);

const headerRight = document.createElement("div");
headerRight.className = "header-right";
headerRight.append(modeSwitch, historyButton, resetButton);
header.append(title, headerRight);

// 集中モードの範囲選択
const rangePanel = document.createElement("div");
rangePanel.className = "range-panel";
const rangeChips = new Map<RangeKey, HTMLButtonElement>();
for (const [label, keys] of [
  ["周期", PERIOD_KEYS],
  ["族", GROUP_KEYS],
  ["", SERIES_KEYS],
] as const) {
  const row = document.createElement("div");
  row.className = "range-row";
  const name = document.createElement("span");
  name.className = "range-row-label";
  name.textContent = label;
  const chips = document.createElement("div");
  chips.className = "range-chips";
  row.append(name, chips);
  for (const key of keys) {
    const chip = button(key.startsWith("p") || key.startsWith("g") ? key.slice(1) : rangeLabel(key), "chip");
    chip.title = rangeLabel(key);
    chip.addEventListener("click", () => toggleRange(key));
    rangeChips.set(key, chip);
    chips.append(chip);
  }
  rangePanel.append(row);
}
const clearRange = button("選択をすべて解除", "button button-ghost button-small");
clearRange.addEventListener("click", () => changeSelection(new Set()));
rangePanel.lastElementChild!.querySelector(".range-chips")!.append(clearRange);

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

app.append(header, rangePanel, scroller, footer);

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
  persist();
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
    persist();
  });
  refs.nameInput.addEventListener("keydown", (e) => onTextKeydown(e, z));
  refs.cell.addEventListener("click", () => {
    if (state.phase !== "symbol" && state.phase !== "name") return;
    if (!state.targets.includes(z)) return;
    const field = activeField(z);
    if (document.activeElement !== field) field.focus();
  });
}

// ---- 答え合わせ ----

function confirmBlanks(get: (z: number) => string): boolean {
  const blanks = state.targets.filter((z) => !get(z).trim()).length;
  return blanks === 0 || window.confirm(`未入力のマスが ${blanks} 個あります。答え合わせしますか？`);
}

/** 範囲の表示名（記録用） */
function scopeName(): string {
  return state.mode === "full" ? "全体" : selectionLabel(state.selection);
}

function gradeSymbols() {
  if (!confirmBlanks(getSymbol)) return;
  showSymbolResults();
  state.phase = "symbolResult";
  state.recordId = recordSymbolTurn(
    scopeName(),
    new Map(state.targets.map((z) => [z, state.symbolResults.get(z) === "correct"])),
  );
  render();
}

/** 入力された記号を採点して色分けする */
function showSymbolResults() {
  for (const z of state.targets) {
    const refs = cells.get(z)!;
    const answer = getSymbol(z);
    const result: Result = !answer ? "blank" : answer === refs.element.symbol ? "correct" : "wrong";
    state.symbolResults.set(z, result);
    refs.cell.classList.add(`sym-${result}`);
    refs.symbolAnswer.textContent = result === "correct" ? "" : refs.element.symbol;
  }
}

function startNameTurn() {
  state.phase = "name";
  render();
  scroller.scrollTo({ left: 0 });
  focusField(state.targets[0]);
}

function gradeNames() {
  if (!confirmBlanks(getName)) return;
  showNameResults();
  state.phase = "nameResult";
  if (state.recordId) {
    recordNameTurn(state.recordId, new Map(state.targets.map((z) => [z, state.nameResults.get(z) === "correct"])));
  }
  render();
}

/** 入力された元素名を採点して色分けする */
function showNameResults() {
  for (const z of state.targets) {
    const refs = cells.get(z)!;
    const answer = getName(z).trim();
    const result: Result = !answer ? "blank" : isCorrectName(answer, refs.element) ? "correct" : "wrong";
    state.nameResults.set(z, result);
    refs.cell.classList.add(`name-${result}`);
    refs.nameAnswer.textContent = result === "correct" ? "" : refs.element.nameJa;
  }
}

function reset(focusFirst = true) {
  state.phase = "symbol";
  state.recordId = null;
  state.names.clear();
  state.symbolResults.clear();
  state.nameResults.clear();
  for (const [z, refs] of cells) {
    setSymbol(z, "");
    refs.nameInput.value = "";
    refs.cell.classList.remove(
      ...["correct", "wrong", "blank"].flatMap((r) => [`sym-${r}`, `name-${r}`]),
    );
    refs.symbolAnswer.textContent = "";
    refs.nameAnswer.textContent = "";
  }
  render();
  scroller.scrollTo({ left: 0 });
  if (focusFirst && state.targets.length > 0) focusField(state.targets[0]);
}

/** 入力途中の内容があれば、消してよいか確認する */
function confirmDiscard(message: string): boolean {
  const inProgress = (state.phase === "symbol" && state.symbols.size > 0) || state.phase === "name";
  return !inProgress || window.confirm(message);
}

resetButton.addEventListener("click", () => {
  if (!confirmDiscard("入力した内容を消して最初からやり直しますか？")) return;
  reset();
});

// ---- 全体モード・集中モード ----

function computeTargets(): number[] {
  if (state.mode === "full") return ELEMENTS.map((e) => e.z);
  return ELEMENTS.filter((e) => [...state.selection].some((key) => inRange(e, key))).map((e) => e.z);
}

/** モードや範囲を変えたら、出題するマスを決め直して最初からにする */
function applyTargets() {
  state.targets = computeTargets();
  const targets = new Set(state.targets);
  for (const [z, refs] of cells) {
    const off = !targets.has(z);
    refs.cell.classList.toggle("is-off", off);
    refs.symbolKey.tabIndex = off ? -1 : 0;
    refs.symbolInput.disabled = off;
  }
  for (const label of table.querySelectorAll<HTMLElement>("[data-range]")) {
    label.classList.toggle("is-selected", state.mode === "focus" && state.selection.has(label.dataset.range!));
  }
  for (const [key, chip] of rangeChips) {
    const on = state.selection.has(key);
    chip.classList.toggle("is-selected", on);
    chip.setAttribute("aria-pressed", String(on));
  }
  reset(false);
  // 選んだ範囲が画面の外にあるときは見える位置までスクロールする
  const first = state.targets[0];
  if (first !== undefined) {
    const { cell } = cells.get(first)!;
    scroller.scrollTo({ left: Math.max(0, cell.offsetLeft - scroller.clientWidth / 2 + cell.offsetWidth / 2) });
  }
}

function syncModeButtons() {
  for (const [m, b] of Object.entries(modeButtons)) b.setAttribute("aria-pressed", String(m === state.mode));
  app.dataset.mode = state.mode;
}

function setMode(mode: Mode) {
  if (mode === state.mode) return;
  if (!confirmDiscard("入力した内容は消えます。モードを切り替えますか？")) return;
  state.mode = mode;
  syncModeButtons();
  applyTargets();
}

function changeSelection(next: Set<RangeKey>) {
  if (!confirmDiscard("入力した内容は消えます。範囲を変えますか？")) return;
  state.selection = next;
  applyTargets();
}

function toggleRange(key: RangeKey) {
  const next = new Set(state.selection);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  changeSelection(next);
}

modeButtons.full.addEventListener("click", () => setMode("full"));
modeButtons.focus.addEventListener("click", () => setMode("focus"));

// 集中モードでは表の周期・族の番号を押しても範囲を選べる
for (const label of table.querySelectorAll<HTMLElement>("[data-range]")) {
  label.addEventListener("click", () => {
    if (state.mode === "focus") toggleRange(label.dataset.range!);
  });
}

// ---- 表示 ----

/** 集中モードで練習中の範囲（例: "第3周期・1族"） */
function scopeTag(): string {
  return state.mode === "focus" ? `<span class="scope">${selectionLabel(state.selection)}</span>` : "";
}

function score(results: Map<number, Result>): string {
  const total = state.targets.length;
  const correct = state.targets.filter((z) => results.get(z) === "correct").length;
  return `<strong>${correct}</strong> / ${total}（${((correct / total) * 100).toFixed(1)}%）`;
}

function renderStatus() {
  const total = state.targets.length;
  if (total === 0) return;
  switch (state.phase) {
    case "symbol": {
      const filled = state.targets.filter((z) => getSymbol(z)).length;
      status.innerHTML = `${scopeTag()}<span class="phase">記号ターン</span>入力 ${filled} / ${total}`;
      break;
    }
    case "symbolResult":
      status.innerHTML = `${scopeTag()}<span class="phase">記号ターン 結果</span>正解 ${score(state.symbolResults)}`;
      break;
    case "name": {
      const filled = state.targets.filter((z) => getName(z).trim()).length;
      status.innerHTML = `${scopeTag()}<span class="phase">名前ターン</span>入力 ${filled} / ${total}`;
      break;
    }
    case "nameResult":
      status.innerHTML =
        `${scopeTag()}<span class="phase">結果</span>` +
        `<span class="score">記号 ${score(state.symbolResults)}</span>` +
        `<span class="score">名前 ${score(state.nameResults)}</span>`;
      break;
  }
}

function render() {
  persist();
  app.dataset.phase = state.phase;
  app.dataset.input = state.inputMode;
  app.dataset.mode = state.mode;
  const targets = new Set(state.targets);
  for (const [z, refs] of cells) {
    refs.symbolInput.readOnly = state.phase !== "symbol";
    refs.nameInput.disabled = !targets.has(z) || state.phase === "symbol" || state.phase === "symbolResult";
    refs.nameInput.readOnly = state.phase !== "name";
  }

  if (state.targets.length === 0) {
    actions.replaceChildren();
    status.innerHTML = `<span class="phase">集中モード</span>練習する周期・族を上で選んでください`;
    return;
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

// ---- 入力途中の内容の保存・復元 ----

let persistTimer: number | undefined;

/** 入力途中の内容をブラウザに保存する（連続した変更はまとめて1回で保存） */
function persist() {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    saveSession({
      version: 1,
      mode: state.mode,
      selection: [...state.selection],
      phase: state.phase,
      symbols: [...state.symbols],
      names: [...state.names],
      recordId: state.recordId,
    });
  }, 200);
}

/** 前回の続きを復元する */
function restore() {
  const saved = loadSession();
  if (saved) {
    state.mode = saved.mode;
    state.selection = new Set(saved.selection);
  }
  syncModeButtons();
  applyTargets();
  if (!saved) return;

  const targets = new Set(state.targets);
  for (const [z, v] of saved.symbols) if (targets.has(z)) setSymbol(z, v);
  for (const [z, v] of saved.names) {
    if (!targets.has(z)) continue;
    state.names.set(z, v);
    cells.get(z)!.nameInput.value = v;
  }
  state.recordId = saved.recordId;
  if (saved.phase !== "symbol") showSymbolResults();
  if (saved.phase === "nameResult") showNameResults();
  state.phase = saved.phase;
  render();
}

restore();
