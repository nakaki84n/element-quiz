import { clearRecords, loadRecords, type Score } from "./storage";

let dialog: HTMLDialogElement | null = null;

function percent(s: Score): string {
  return s.total === 0 ? "—" : `${((s.correct / s.total) * 100).toFixed(1)}%`;
}

function scoreCell(s: Score | null): HTMLTableCellElement {
  const td = document.createElement("td");
  td.className = "num";
  if (!s) {
    td.textContent = "—";
    td.classList.add("muted");
    return td;
  }
  const rate = document.createElement("strong");
  rate.textContent = percent(s);
  const count = document.createElement("span");
  count.className = "muted";
  count.textContent = ` ${s.correct}/${s.total}`;
  td.append(rate, count);
  return td;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ensureDialog(): HTMLDialogElement {
  if (dialog) return dialog;
  const d = document.createElement("dialog");
  d.className = "history";
  // 背景をクリックしたら閉じる
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  });
  document.body.append(d);
  dialog = d;
  return d;
}

/** 履歴のダイアログを開く（中身は開くたびに作り直す） */
export function renderHistory() {
  const d = ensureDialog();
  const { history } = loadRecords();

  const head = document.createElement("div");
  head.className = "history-head";
  const title = document.createElement("h2");
  title.textContent = "履歴";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "button button-ghost button-small";
  close.textContent = "閉じる";
  close.addEventListener("click", () => d.close());
  head.append(title, close);

  const body = document.createElement("div");
  body.className = "history-body";
  if (history.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "まだ記録がありません。答え合わせをすると、ここに正答率が記録されます。";
    body.append(empty);
  } else {
    const tableEl = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th>日時</th><th>範囲</th><th class="num">記号</th><th class="num">名前</th></tr>`;
    const tbody = document.createElement("tbody");
    for (const h of [...history].reverse()) {
      const tr = document.createElement("tr");
      const date = document.createElement("td");
      date.textContent = formatDate(h.date);
      date.className = "nowrap";
      const scope = document.createElement("td");
      scope.textContent = h.scope;
      tr.append(date, scope, scoreCell(h.symbol), scoreCell(h.name));
      tbody.append(tr);
    }
    tableEl.append(thead, tbody);
    body.append(tableEl);
  }

  const foot = document.createElement("div");
  foot.className = "history-foot";
  const count = document.createElement("span");
  count.className = "muted";
  count.textContent = `${history.length} 回`;
  foot.append(count);
  if (history.length > 0) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "button button-ghost button-small";
    clear.textContent = "履歴を消去";
    clear.addEventListener("click", () => {
      if (!window.confirm("これまでの履歴をすべて消去しますか？元に戻せません。")) return;
      clearRecords();
      renderHistory();
    });
    foot.append(clear);
  }

  d.replaceChildren(head, body, foot);
  if (!d.open) d.showModal();
}
