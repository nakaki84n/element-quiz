// 表示設定（原子番号の表示、名前ターン中の記号の表示、名前ターンの言語）

import type { NameLang } from "./storage";

const SETTINGS_KEY = "element-quiz.settings.v1";

export interface Settings {
  /** マスに原子番号を表示する */
  showAtomicNumber: boolean;
  /** 名前ターン中に正しい記号を表示する */
  showSymbolsInNameTurn: boolean;
  /** 名前ターンで答える言語 */
  nameLang: NameLang;
}

const DEFAULTS: Settings = { showAtomicNumber: true, showSymbolsInNameTurn: true, nameLang: "ja" };

function load(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const s = { ...DEFAULTS, ...(raw ? (JSON.parse(raw) as Partial<Settings>) : {}) };
    if (s.nameLang !== "ja" && s.nameLang !== "en") s.nameLang = "ja";
    return s;
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // 保存できなくても続行する
  }
}

/** 設定を画面に反映する（CSS は #app の data 属性を見て表示を切り替える） */
function apply(app: HTMLElement, s: Settings) {
  app.dataset.showZ = String(s.showAtomicNumber);
  app.dataset.showSymbolsInName = String(s.showSymbolsInNameTurn);
}

/**
 * 設定ボタンと設定パネルを作る。
 * onNameLangChange は名前ターンの言語が変わったときに呼ばれる。
 */
export function createSettings(
  app: HTMLElement,
  onNameLangChange: (lang: NameLang) => void,
): { button: HTMLButtonElement; panel: HTMLDivElement; nameLang: () => NameLang } {
  const settings = load();
  apply(app, settings);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-ghost";
  button.textContent = "表示";
  button.setAttribute("aria-expanded", "false");

  const panel = document.createElement("div");
  panel.className = "settings-panel";
  panel.hidden = true;

  // 名前ターンの言語
  const langRow = document.createElement("div");
  langRow.className = "settings-row settings-lang";
  const langLabel = document.createElement("span");
  langLabel.textContent = "名前ターンの言語";
  const langSwitch = document.createElement("div");
  langSwitch.className = "segmented";
  langSwitch.setAttribute("role", "group");
  langSwitch.setAttribute("aria-label", "名前ターンの言語");
  const langButtons = new Map<NameLang, HTMLButtonElement>();
  for (const [lang, label] of [
    ["ja", "日本語"],
    ["en", "英語"],
  ] as const) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "segmented-item";
    b.textContent = label;
    b.addEventListener("click", () => {
      if (settings.nameLang === lang) return;
      settings.nameLang = lang;
      save(settings);
      syncLang();
      onNameLangChange(lang);
    });
    langButtons.set(lang, b);
    langSwitch.append(b);
  }
  const syncLang = () => {
    for (const [lang, b] of langButtons) b.setAttribute("aria-pressed", String(lang === settings.nameLang));
  };
  syncLang();
  langRow.append(langLabel, langSwitch);
  const langNote = document.createElement("div");
  langNote.className = "settings-note";
  langNote.textContent = "名前ターンの途中で変えた場合は、次の回から切り替わります（まだ何も入力していなければすぐ切り替わります）";
  panel.append(langRow, langNote);

  const options: ["showAtomicNumber" | "showSymbolsInNameTurn", string][] = [
    ["showAtomicNumber", "原子番号を表示する"],
    ["showSymbolsInNameTurn", "名前ターン中に記号を表示する"],
  ];
  for (const [key, label] of options) {
    const row = document.createElement("label");
    row.className = "settings-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = settings[key];
    checkbox.addEventListener("change", () => {
      settings[key] = checkbox.checked;
      save(settings);
      apply(app, settings);
    });
    row.append(checkbox, label);
    panel.append(row);
  }

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  };
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(panel.hidden);
  });
  // パネルの外を押すか Esc で閉じる
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target as Node)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) setOpen(false);
  });

  return { button, panel, nameLang: () => settings.nameLang };
}
