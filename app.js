// ===================================================
// データ（本当の情報はここだけが持つ）
// ===================================================

// 旅行1件の形:
// {
//   id: string,
//   name: string,
//   startDate: 'YYYY-MM-DD',
//   endDate:   'YYYY-MM-DD',
//   plans: [],   // ステップ5で使う
//   items: [],   // ステップ7で使う
// }
let trips = [];

// いま詳細画面で開いている旅行のid
let currentTripId = null;

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function findTrip(id) {
  return trips.find((trip) => trip.id === id) || null;
}

// ===================================================
// 保存（localStorage）
// ===================================================

// localStorage は「キー」と「文字列」の組でしか保存できない。
// キーは他サイトと混ざらないよう、アプリ固有の名前にしておく。
const STORAGE_KEY = 'travel-app:trips';

// trips を文字列(JSON)に変換して保存する
function saveTrips() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  } catch (error) {
    // 容量オーバーやプライベートモードで失敗することがある。
    // 保存できなくても画面は動き続けるようにする。
    console.error('保存に失敗しました', error);
  }
}

// 保存された文字列を読み戻す。無ければ空の配列を返す。
function loadTrips() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    // 古い保存データに plans / items が無くても動くようにそろえておく
    return parsed.map((trip) => ({
      plans: [],
      items: [],
      ...trip,
    }));
  } catch (error) {
    console.error('読み込みに失敗しました', error);
    return [];
  }
}

// ===================================================
// 画面の切り替え
// ===================================================

const SCREENS = {
  home: 'screen-home',
  detail: 'screen-detail',
  edit: 'screen-edit',
};

function showScreen(name) {
  for (const [key, id] of Object.entries(SCREENS)) {
    document.getElementById(id).hidden = key !== name;
  }
  window.scrollTo(0, 0);
}

document.body.addEventListener('click', (event) => {
  const button = event.target.closest('[data-goto]');
  if (!button) return;
  showScreen(button.dataset.goto);
});

// ===================================================
// 日付まわりの小道具
// ===================================================

// '2026-10-01' -> '2026/10/01'
function formatDate(value) {
  return value.replaceAll('-', '/');
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// 'YYYY-MM-DD' を日付として扱う（時差の影響を受けないよう UTC で固定）
function toDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// 今日の日付を 'YYYY-MM-DD' で返す（端末のローカル時間で判定する）
function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// 開始日と終了日から日数を数える（両端を含む）
function countDays(startDate, endDate) {
  const diff = toDate(endDate).getTime() - toDate(startDate).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

// 開始日〜終了日の各日を作る（保存せず、毎回ここで計算する）
function buildDays(trip) {
  const days = [];
  const total = countDays(trip.startDate, trip.endDate);
  const start = toDate(trip.startDate);

  for (let i = 0; i < total; i++) {
    const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const iso = date.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    days.push({
      index: i + 1,                         // 1日目、2日目…
      date: iso,
      weekday: date.getUTCDay(),            // 0=日, 6=土
      label: `${date.getUTCMonth() + 1}月${date.getUTCDate()}日(${WEEKDAYS[date.getUTCDay()]})`,
    });
  }
  return days;
}

// ===================================================
// 予定の並べ替え
// ===================================================

// その日の予定を、表示用の順番で取り出す。
// 1) 開始時刻のあるものを時刻順  2) 時刻なしは後ろに追加順
function plansForDate(trip, date) {
  const timed = [];
  const untimed = [];

  for (const plan of trip.plans) {
    if (plan.date !== date) continue;
    (plan.start ? timed : untimed).push(plan);
  }

  timed.sort((a, b) => a.start.localeCompare(b.start));
  return [...timed, ...untimed];
}

// ===================================================
// ホーム画面の描画
// ===================================================

const tripListEl = document.getElementById('trip-list');

function renderHome() {
  tripListEl.innerHTML = '';

  if (trips.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'まだ旅行がありません。下のボタンから追加してください。';
    tripListEl.appendChild(empty);
    return;
  }

  for (const trip of trips) {
    const card = document.createElement('div');
    card.className = 'trip-card';

    const main = document.createElement('button');
    main.className = 'trip-card-main';
    main.type = 'button';
    main.dataset.tripId = trip.id;

    const name = document.createElement('div');
    name.className = 'trip-card-name';
    name.textContent = trip.name;

    const dates = document.createElement('div');
    dates.className = 'trip-card-dates';
    dates.textContent =
      `${formatDate(trip.startDate)} 〜 ${formatDate(trip.endDate)}` +
      `（${countDays(trip.startDate, trip.endDate)}日間）`;

    main.append(name, dates);

    const remove = document.createElement('button');
    remove.className = 'btn-icon trip-card-delete';
    remove.type = 'button';
    remove.dataset.deleteTripId = trip.id;
    remove.setAttribute('aria-label', `${trip.name} を削除`);
    remove.textContent = '✕';

    card.append(main, remove);
    tripListEl.appendChild(card);
  }
}

tripListEl.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('[data-delete-trip-id]');
  if (deleteButton) {
    deleteTrip(deleteButton.dataset.deleteTripId);
    return;
  }

  const main = event.target.closest('[data-trip-id]');
  if (main) openDetail(main.dataset.tripId);
});

// 旅行の削除（予定と持ち物もまとめて消えるので、件数を伝えて確認する）
function deleteTrip(tripId) {
  const trip = findTrip(tripId);
  if (!trip) return;

  const message =
    `「${trip.name}」を削除します。\n` +
    `予定${trip.plans.length}件と持ち物${trip.items.length}件も一緒に消えます。\n` +
    `この操作は取り消せません。よろしいですか？`;
  if (!confirm(message)) return;

  trips = trips.filter((t) => t.id !== tripId);
  if (currentTripId === tripId) currentTripId = null;

  saveTrips();
  renderHome();
}

// ===================================================
// 詳細画面の描画
// ===================================================

const detailTitleEl = document.getElementById('detail-title');
const detailDatesEl = document.getElementById('detail-dates');
const dayListEl = document.getElementById('day-list');

function openDetail(tripId) {
  currentTripId = tripId;
  switchTab('schedule');
  renderDetail();
  showScreen('detail');
}

function renderDetail() {
  const trip = findTrip(currentTripId);
  if (!trip) return;

  detailTitleEl.textContent = trip.name;
  detailDatesEl.textContent =
    `${formatDate(trip.startDate)} 〜 ${formatDate(trip.endDate)}` +
    `（${countDays(trip.startDate, trip.endDate)}日間）`;

  renderDays(trip);
  renderItems(trip);
}

// 日程タブの中身
function renderDays(trip) {
  dayListEl.innerHTML = '';

  const days = buildDays(trip);
  const today = todayIso();

  // 今日が旅行期間内ならその日を開く。期間外なら1日目を開く。
  const openDate = days.some((day) => day.date === today) ? today : days[0].date;

  for (const day of days) {
    const dayEl = document.createElement('details');
    dayEl.className = 'day';
    dayEl.dataset.date = day.date;
    dayEl.open = day.date === openDate;

    const header = document.createElement('summary');
    header.className = 'day-header';

    const indexEl = document.createElement('span');
    indexEl.className = 'day-index';
    indexEl.textContent = `${day.index}日目`;

    const dateEl = document.createElement('span');
    dateEl.className = 'day-date';
    if (day.weekday === 0) dateEl.classList.add('is-sunday');
    if (day.weekday === 6) dateEl.classList.add('is-saturday');
    dateEl.textContent = day.label;

    header.append(indexEl, dateEl);

    if (day.date === today) {
      const badge = document.createElement('span');
      badge.className = 'day-badge';
      badge.textContent = '今日';
      header.appendChild(badge);
    }

    // 閉じているときも予定の数が分かるようにする
    const count = plansForDate(trip, day.date).length;
    const countEl = document.createElement('span');
    countEl.className = 'day-count';
    countEl.textContent = count === 0 ? '—' : `${count}件`;
    header.appendChild(countEl);

    const body = document.createElement('div');
    body.className = 'day-body';

    const plans = plansForDate(trip, day.date);
    if (plans.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'day-empty';
      empty.textContent = '予定はまだありません';
      body.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'plan-list';
      for (const plan of plans) {
        list.appendChild(createPlanElement(plan));
      }
      body.appendChild(list);
    }

    const addButton = document.createElement('button');
    addButton.className = 'btn-add-plan';
    addButton.type = 'button';
    addButton.dataset.addPlanDate = day.date;
    addButton.textContent = '＋ 予定を追加';
    body.appendChild(addButton);

    dayEl.append(header, body);
    dayListEl.appendChild(dayEl);
  }
}

// 予定1件ぶんの表示を作る
function createPlanElement(plan) {
  const el = document.createElement('div');
  el.className = 'plan';
  el.dataset.planId = plan.id;

  const time = document.createElement('div');
  time.className = 'plan-time';
  if (plan.start) {
    time.textContent = plan.start;
    if (plan.end) {
      const end = document.createElement('div');
      end.className = 'plan-time-end';
      end.textContent = `〜${plan.end}`;
      time.appendChild(end);
    }
  } else {
    time.classList.add('is-empty');
    time.textContent = '時刻なし';
  }

  const body = document.createElement('div');
  body.className = 'plan-body';

  const title = document.createElement('div');
  title.className = 'plan-title';
  title.textContent = plan.title;
  body.appendChild(title);

  if (plan.place) {
    const place = document.createElement('div');
    place.className = 'plan-place';
    place.textContent = `📍 ${plan.place}`;
    body.appendChild(place);
  }

  if (plan.memo) {
    const memo = document.createElement('div');
    memo.className = 'plan-memo';
    memo.textContent = plan.memo;
    body.appendChild(memo);
  }

  const remove = document.createElement('button');
  remove.className = 'btn-icon';
  remove.type = 'button';
  remove.dataset.deletePlanId = plan.id;
  remove.title = '削除';
  remove.setAttribute('aria-label', `${plan.title} を削除`);
  remove.textContent = '✕';

  el.append(time, body, remove);
  return el;
}

// ---- 予定の入力ダイアログ ----
const planDialogEl = document.getElementById('plan-dialog');
const planFormEl = document.getElementById('plan-form');
const planDialogDateEl = document.getElementById('plan-dialog-date');
const planStartEl = document.getElementById('plan-start');
const planEndEl = document.getElementById('plan-end');
const planTitleEl = document.getElementById('plan-title');
const planPlaceEl = document.getElementById('plan-place');
const planMemoEl = document.getElementById('plan-memo');
const planErrorEl = document.getElementById('plan-error');

// いまダイアログがどの日に対して開かれているか
let planDialogDate = null;
// 編集中の予定のid。null なら新規追加
let editingPlanId = null;

const planDialogTitleEl = document.getElementById('plan-dialog-title');

// plan を渡すと編集、渡さなければ新規追加として開く
function openPlanDialog(date, plan = null) {
  planDialogDate = date;
  editingPlanId = plan ? plan.id : null;

  planFormEl.reset();
  planErrorEl.hidden = true;

  planDialogTitleEl.textContent = plan ? '予定を編集' : '予定を追加';

  if (plan) {
    planStartEl.value = plan.start;
    planEndEl.value = plan.end;
    planTitleEl.value = plan.title;
    planPlaceEl.value = plan.place;
    planMemoEl.value = plan.memo;
  }

  const day = buildDays(findTrip(currentTripId)).find((d) => d.date === date);
  planDialogDateEl.textContent = day ? `${day.index}日目 ${day.label}` : '';

  planDialogEl.showModal();
  planTitleEl.focus();
}

// 日程タブのクリックをまとめて受け取る
dayListEl.addEventListener('click', (event) => {
  const addButton = event.target.closest('[data-add-plan-date]');
  if (addButton) {
    openPlanDialog(addButton.dataset.addPlanDate);
    return;
  }

  const deleteButton = event.target.closest('[data-delete-plan-id]');
  if (deleteButton) {
    deletePlan(deleteButton.dataset.deletePlanId);
    return;
  }

  const planEl = event.target.closest('[data-plan-id]');
  if (planEl) {
    const trip = findTrip(currentTripId);
    const plan = trip && trip.plans.find((p) => p.id === planEl.dataset.planId);
    if (plan) openPlanDialog(plan.date, plan);
  }
});

function deletePlan(planId) {
  const trip = findTrip(currentTripId);
  if (!trip) return;

  const plan = trip.plans.find((p) => p.id === planId);
  if (!plan) return;

  if (!confirm(`「${plan.title}」を削除します。よろしいですか？`)) return;

  // 配列から id が一致するものを取り除く
  trip.plans = trip.plans.filter((p) => p.id !== planId);
  saveTrips();
  renderDetail();
}

document.getElementById('plan-cancel').addEventListener('click', () => {
  planDialogEl.close();
});

planFormEl.addEventListener('submit', (event) => {
  event.preventDefault();

  const title = planTitleEl.value.trim();
  const start = planStartEl.value;
  const end = planEndEl.value;

  if (!title) {
    planErrorEl.textContent = '内容を入力してください。';
    planErrorEl.hidden = false;
    return;
  }
  if (start && end && end < start) {
    planErrorEl.textContent = '終了時刻は開始時刻より後にしてください。';
    planErrorEl.hidden = false;
    return;
  }

  const trip = findTrip(currentTripId);
  if (!trip) return;

  const values = {
    start,
    end,
    title,
    place: planPlaceEl.value.trim(),
    memo: planMemoEl.value.trim(),
  };

  if (editingPlanId) {
    // 既存の予定を上書きする（id と date はそのまま）
    const plan = trip.plans.find((p) => p.id === editingPlanId);
    if (!plan) return;
    Object.assign(plan, values);
  } else {
    trip.plans.push({ id: createId(), date: planDialogDate, ...values });
  }

  saveTrips();
  renderDetail();
  planDialogEl.close();
});

// ===================================================
// 持ち物チェックリスト
// ===================================================

const itemFormEl = document.getElementById('item-form');
const itemInputEl = document.getElementById('item-input');
const itemListEl = document.getElementById('item-list');
const itemProgressEl = document.getElementById('item-progress');

function renderItems(trip) {
  itemListEl.innerHTML = '';

  const checked = trip.items.filter((item) => item.checked).length;
  itemProgressEl.textContent =
    trip.items.length === 0
      ? 'まだ持ち物がありません。上の欄から追加してください。'
      : `${checked} / ${trip.items.length} 個 準備済み`;

  for (const item of trip.items) {
    const row = document.createElement('div');
    row.className = 'item';
    if (item.checked) row.classList.add('is-checked');
    row.dataset.itemId = item.id;

    const check = document.createElement('input');
    check.className = 'item-check';
    check.type = 'checkbox';
    check.checked = item.checked;
    check.setAttribute('aria-label', `${item.name} を準備済みにする`);

    // 名前は入力欄そのもの。打つたびにデータへ書き戻す（画面は作り直さない）
    const name = document.createElement('input');
    name.className = 'item-name';
    name.type = 'text';
    name.value = item.name;

    const remove = document.createElement('button');
    remove.className = 'btn-icon';
    remove.type = 'button';
    remove.dataset.deleteItemId = item.id;
    remove.setAttribute('aria-label', `${item.name} を削除`);
    remove.textContent = '✕';

    row.append(check, name, remove);
    itemListEl.appendChild(row);
  }
}

function findItem(itemId) {
  const trip = findTrip(currentTripId);
  return trip ? trip.items.find((item) => item.id === itemId) || null : null;
}

// 追加
itemFormEl.addEventListener('submit', (event) => {
  event.preventDefault();

  const name = itemInputEl.value.trim();
  if (!name) return;

  const trip = findTrip(currentTripId);
  if (!trip) return;

  trip.items.push({ id: createId(), name, checked: false });
  saveTrips();
  renderItems(trip);

  itemInputEl.value = '';
  itemInputEl.focus(); // 続けて入力できるようにする
});

// チェックの切り替え（画面は作り直さず、見た目だけ切り替える）
itemListEl.addEventListener('change', (event) => {
  const check = event.target.closest('.item-check');
  if (!check) return;

  const row = check.closest('.item');
  const item = findItem(row.dataset.itemId);
  if (!item) return;

  item.checked = check.checked;
  row.classList.toggle('is-checked', item.checked);
  saveTrips();

  const trip = findTrip(currentTripId);
  const checked = trip.items.filter((i) => i.checked).length;
  itemProgressEl.textContent = `${checked} / ${trip.items.length} 個 準備済み`;
});

// 名前の編集（入力中なので再描画しない）
itemListEl.addEventListener('input', (event) => {
  const nameInput = event.target.closest('.item-name');
  if (!nameInput) return;

  const item = findItem(nameInput.closest('.item').dataset.itemId);
  if (!item) return;

  item.name = nameInput.value;
  saveTrips();
});

// 削除
itemListEl.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('[data-delete-item-id]');
  if (!deleteButton) return;

  const trip = findTrip(currentTripId);
  if (!trip) return;

  const item = findItem(deleteButton.dataset.deleteItemId);
  if (!item) return;
  if (!confirm(`「${item.name}」を削除します。よろしいですか？`)) return;

  trip.items = trip.items.filter((i) => i.id !== item.id);
  saveTrips();
  renderItems(trip);
});

// ---- タブの切り替え ----
const TAB_PANELS = {
  schedule: 'tab-schedule',
  items: 'tab-items',
};

function switchTab(name) {
  for (const [key, id] of Object.entries(TAB_PANELS)) {
    document.getElementById(id).hidden = key !== name;
  }
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('is-active', tab.dataset.tab === name);
  }
}

document.querySelector('.tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('.tab');
  if (!tab) return;
  switchTab(tab.dataset.tab);
});

// ===================================================
// 新規作成フォーム
// ===================================================

// 日付を選んだ時点でピッカーを閉じる（毎回チェックマークを押さずに済む）。
// ただし iOS はピッカーを開いた瞬間にも当日の日付を入れて変更イベントを出すため、
// 「開いた直後の自動入力」と「本人が選んだ操作」を時間差で区別する。
let datePickerOpenedAt = 0;

document.body.addEventListener('focusin', (event) => {
  if (event.target.matches('input[type="date"]')) {
    datePickerOpenedAt = Date.now();
  }
});

document.body.addEventListener('change', (event) => {
  const el = event.target;
  if (!el.matches('input[type="date"]') || !el.value) return;

  // 開いて1秒以内の変更は、iOS が勝手に入れたものとみなして閉じない
  if (Date.now() - datePickerOpenedAt < 1000) return;

  el.blur();
});

const formEl = document.getElementById('trip-form');
const inputNameEl = document.getElementById('input-name');
const inputStartEl = document.getElementById('input-start');
const inputEndEl = document.getElementById('input-end');
const formErrorEl = document.getElementById('form-error');

const editTitleEl = document.getElementById('edit-title');

// 編集中の旅行のid。null なら新規作成
let editingTripId = null;

document.getElementById('btn-new-trip').addEventListener('click', () => {
  editingTripId = null;
  formEl.reset();
  hideFormError();
  editTitleEl.textContent = '新しい旅行';
  showScreen('edit');
  inputNameEl.focus();
});

document.getElementById('btn-edit-trip').addEventListener('click', () => {
  const trip = findTrip(currentTripId);
  if (!trip) return;

  editingTripId = trip.id;
  hideFormError();
  editTitleEl.textContent = '旅行を編集';
  inputNameEl.value = trip.name;
  inputStartEl.value = trip.startDate;
  inputEndEl.value = trip.endDate;
  showScreen('edit');
});

// 編集画面の「戻る」。新規作成なら一覧、編集なら詳細へ戻す
document.getElementById('btn-edit-back').addEventListener('click', () => {
  showScreen(editingTripId ? 'detail' : 'home');
});

function showFormError(message) {
  formErrorEl.textContent = message;
  formErrorEl.hidden = false;
}

function hideFormError() {
  formErrorEl.hidden = true;
}

// 入力内容を確認する。問題があればメッセージ、なければ null を返す
function validateTripInput(name, startDate, endDate) {
  if (!name) return '旅行名を入力してください。';
  if (!startDate) return '開始日を入力してください。';
  if (!endDate) return '終了日を入力してください。';
  if (endDate < startDate) return '終了日は開始日より後にしてください。';
  return null;
}

formEl.addEventListener('submit', (event) => {
  event.preventDefault(); // ページの再読み込みを止める

  const name = inputNameEl.value.trim();
  const startDate = inputStartEl.value;
  const endDate = inputEndEl.value;

  const error = validateTripInput(name, startDate, endDate);
  if (error) {
    showFormError(error);
    return;
  }

  if (editingTripId) {
    const trip = findTrip(editingTripId);
    if (!trip) return;

    // 日程を縮めると、範囲外になる予定が画面から参照されなくなる。
    // 残しても見えないだけなので、確認のうえ消す。
    const orphans = trip.plans.filter(
      (plan) => plan.date < startDate || plan.date > endDate
    );
    if (orphans.length > 0) {
      const message =
        `日程の変更で、${orphans.length}件の予定が期間の外に出ます。\n` +
        `この予定は削除されます。よろしいですか？`;
      if (!confirm(message)) return;
      trip.plans = trip.plans.filter(
        (plan) => plan.date >= startDate && plan.date <= endDate
      );
    }

    trip.name = name;
    trip.startDate = startDate;
    trip.endDate = endDate;

    saveTrips();
    renderHome();
    renderDetail();

    hideFormError();
    showScreen('detail');
    return;
  }

  // データを変える → 画面を作り直す、の順番
  trips.push({ id: createId(), name, startDate, endDate, plans: [], items: [] });
  saveTrips();
  renderHome();

  hideFormError();
  showScreen('home');
});

// ===================================================
// 起動
// ===================================================

trips = loadTrips();
renderHome();
showScreen('home');
