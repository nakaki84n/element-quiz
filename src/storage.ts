// ブラウザ内 (localStorage) への保存。
// プライベートブラウズなどで保存できない環境でも、アプリ自体は動くようにすべて try/catch で包む。

const RECORDS_KEY = "element-quiz.records.v1";
const SESSION_KEY = "element-quiz.session.v1";
const HISTORY_LIMIT = 500;

export interface Score {
  correct: number;
  total: number;
}

/** 1回分の記録 */
export interface HistoryEntry {
  id: string;
  /** ISO 形式の日時 */
  date: string;
  /** 範囲の表示名（全体モードなら "全体"） */
  scope: string;
  symbol: Score;
  /** 名前ターンまで進まなかった回は null */
  name: Score | null;
}

/** 元素ごとの累計 */
export interface ElementStat {
  symbolOk: number;
  symbolTry: number;
  nameOk: number;
  nameTry: number;
}

export interface Records {
  version: 1;
  history: HistoryEntry[];
  perElement: Record<number, ElementStat>;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できなくても続行する
  }
}

export function loadRecords(): Records {
  const r = read<Records>(RECORDS_KEY);
  if (r && r.version === 1 && Array.isArray(r.history)) return r;
  return { version: 1, history: [], perElement: {} };
}

function saveRecords(r: Records) {
  r.history = r.history.slice(-HISTORY_LIMIT);
  write(RECORDS_KEY, r);
}

/** 記号ターンの答え合わせを記録し、その回の id を返す */
export function recordSymbolTurn(scope: string, results: Map<number, boolean>): string {
  const r = loadRecords();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const correct = [...results.values()].filter(Boolean).length;
  r.history.push({ id, date: new Date().toISOString(), scope, symbol: { correct, total: results.size }, name: null });
  for (const [z, ok] of results) {
    const s = (r.perElement[z] ??= { symbolOk: 0, symbolTry: 0, nameOk: 0, nameTry: 0 });
    s.symbolTry++;
    if (ok) s.symbolOk++;
  }
  saveRecords(r);
  return id;
}

/** 名前ターンの答え合わせを、同じ回の記録に追加する */
export function recordNameTurn(id: string, results: Map<number, boolean>) {
  const r = loadRecords();
  const entry = r.history.find((h) => h.id === id);
  if (entry) entry.name = { correct: [...results.values()].filter(Boolean).length, total: results.size };
  for (const [z, ok] of results) {
    const s = (r.perElement[z] ??= { symbolOk: 0, symbolTry: 0, nameOk: 0, nameTry: 0 });
    s.nameTry++;
    if (ok) s.nameOk++;
  }
  saveRecords(r);
}

export function clearRecords() {
  try {
    localStorage.removeItem(RECORDS_KEY);
  } catch {
    // 何もしない
  }
}

// ---- 入力途中の内容 ----

export interface SavedSession {
  version: 1;
  mode: "full" | "focus";
  selection: string[];
  phase: "symbol" | "symbolResult" | "name" | "nameResult";
  symbols: [number, string][];
  names: [number, string][];
  /** この回の記録の id（答え合わせ前は null） */
  recordId: string | null;
}

export function loadSession(): SavedSession | null {
  const s = read<SavedSession>(SESSION_KEY);
  return s && s.version === 1 ? s : null;
}

export function saveSession(s: SavedSession) {
  write(SESSION_KEY, s);
}
