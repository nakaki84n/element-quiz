// 表示設定（原子番号の表示、名前ターン中の記号の表示）

const SETTINGS_KEY = "element-quiz.settings.v1";

export interface Settings {
  /** マスに原子番号を表示する */
  showAtomicNumber: boolean;
  /** 名前ターン中に記号ターンの結果を表示する */
  showSymbolsInNameTurn: boolean;
}

const DEFAULTS: Settings = { showAtomicNumber: true, showSymbolsInNameTurn: true };

function load(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULTS, ...(raw ? (JSON.parse(raw) as Partial<Settings>) : {}) };
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

/** 設定ボタンと設定パネルを作る */
export function createSettings(app: HTMLElement): { button: HTMLButtonElement; panel: HTMLDivElement } {
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

  const options: [keyof Settings, string][] = [
    ["showAtomicNumber", "原子番号を表示する"],
    ["showSymbolsInNameTurn", "名前ターン中に記号の結果を表示する"],
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

  return { button, panel };
}
