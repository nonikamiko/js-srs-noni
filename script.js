(() => {
'use strict';


const KEY = 'diary-v1';                                      
const MEALS = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];        
const TYPES = ['Кардио', 'Силовая', 'Растяжка', 'Другое'];   
const INT = {1: 'Лёгкая', 2: 'Средняя', 3: 'Высокая'};       


const $ = s => document.querySelector(s);

const pad = n => String(n).padStart(2, '0');

const key = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };

const shift = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };

const fmt = n => Math.round(n).toLocaleString('ru-RU');

const num = v => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) && x > 0 ? x : 0; };

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const on = (l, d) => l.filter(e => e.date === d);

const sum = (l, f) => l.reduce((s, e) => s + (Number(f(e)) || 0), 0);

const load = e => (e.min || 0) * (e.int || 1);

let S = {goal: 2000, mode: 'food', food: [], work: []};

let date = key(new Date()), editId = null, wipeTimer;

try {
  const r = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (r && typeof r === 'object') {
    S.goal = num(r.goal) || 2000;
    S.mode = r.mode === 'work' ? 'work' : 'food';
    S.food = Array.isArray(r.food) ? r.food : [];
    S.work = Array.isArray(r.work) ? r.work : [];
  }
} catch (e) {}

const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { $('#warn').hidden = false; }
};

const row = (id, name, meta, val, unit) =>
  `<li class="row"><div><div class="nm">${esc(name)}</div><div class="meta">${meta}</div></div>` +
  `<div class="val">${val}<small>${unit}</small></div><div class="acts">` +
  `<button class="ib sm" data-a="edit" data-id="${id}" aria-label="Изменить запись">✎</button>` +
  `<button class="ib sm" data-a="del" data-id="${id}" aria-label="Удалить запись">✕</button></div></li>`;

const foodRow = e => row(e.id, e.name,
  [['Б', e.p], ['Ж', e.f], ['У', e.c]].filter(x => x[1]).map(x => `<span>${x[0]} ${fmt(x[1])} г</span>`).join(''),
  fmt(e.kcal), 'ккал');

const workRow = e => row(e.id, e.name,
  `<span>${esc(e.tp)}</span><span>${fmt(e.min)} мин</span><span>${INT[e.int] || ''}</span>` + (e.kc ? `<span>${fmt(e.kc)} ккал</span>` : ''),
  fmt(load(e)), 'баллов');

function render() {
  const food = S.mode === 'food';
  document.body.dataset.mode = S.mode;

  document.querySelectorAll('.tabs button').forEach(b => {
    const o = b.dataset.mode === S.mode;
    b.classList.toggle('on', o); b.setAttribute('aria-selected', o);
  });

  $('#formFood').hidden = !food; $('#formWork').hidden = food; $('#goalRow').hidden = !food;

  const ed = !!editId;
  $('#formTitle').textContent = ed ? 'Изменить запись' : food ? 'Добавить приём пищи' : 'Добавить тренировку';
  document.querySelectorAll('.go').forEach(b => b.textContent = ed ? 'Сохранить' : 'Добавить');
  document.querySelectorAll('.cancel').forEach(b => b.hidden = !ed);

  const t = key(new Date());
  $('#date').value = date;
  $('#dlabel').textContent = (date === t ? 'Сегодня, ' : '') + parse(date).toLocaleDateString('ru-RU', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});
  $('#todayBtn').disabled = date === t;

  const fd = on(S.food, date), wd = on(S.work, date);
  const eaten = sum(fd, e => e.kcal), burned = sum(wd, e => e.kc);

  let segs, tiles;
  if (food) {
    segs = MEALS.map(m => { const v = sum(fd.filter(e => e.meal === m), e => e.kcal); return {l: m, v, t: fmt(v)}; });
    const rem = S.goal - eaten;
    $('#pLabel').textContent = 'Съедено'; $('#pBig').textContent = fmt(eaten); $('#pUnit').textContent = 'ккал';
    $('#pNote').innerHTML = rem >= 0 ? `Осталось ${fmt(rem)} из ${fmt(S.goal)}` : `<span class="over">Больше цели на ${fmt(-rem)}</span>`;
    tiles = [['Белки', sum(fd, e => e.p), 'г'], ['Жиры', sum(fd, e => e.f), 'г'], ['Углеводы', sum(fd, e => e.c), 'г']];
    if (document.activeElement !== $('#goal')) $('#goal').value = S.goal;
  } else {
    segs = TYPES.map(k => { const it = wd.filter(e => e.tp === k); return {l: k, v: sum(it, load), t: fmt(sum(it, e => e.min)) + ' мин'}; });
    $('#pLabel').textContent = 'Нагрузка'; $('#pBig').textContent = fmt(sum(wd, load)); $('#pUnit').textContent = 'баллов';
    $('#pNote').textContent = 'Баллы: минуты × интенсивность (1–3)';
    tiles = [['Время', sum(wd, e => e.min), 'мин'], ['Сожжено', burned, 'ккал'], ['Тренировок', wd.length, '']];
  }

  const tot = sum(segs, s => s.v), den = Math.max(food ? S.goal : tot, tot, 1);
  $('#seg').innerHTML = segs.map((s, i) => s.v ? `<span class="piece p${i}" style="width:${s.v / den * 100}%"></span>` : '').join('') +
    (food && tot > S.goal ? `<span class="tick" style="left:${S.goal / den * 100}%"></span>` : '');
  $('#leg').innerHTML = segs.map((s, i) => s.v ? `<li><i class="d p${i}"></i>${s.l} <b>${s.t}</b></li>` : '').join('');
  $('#tiles').innerHTML = tiles.map(([n, v, u]) => `<div><b>${fmt(v)}${u ? `<small> ${u}</small>` : ''}</b><span>${n}</span></div>`).join('');

  const net = eaten - burned;
  $('#bEat').textContent = fmt(eaten); $('#bBurn').textContent = fmt(burned);
  $('#bNet').textContent = (net > 0 ? '+' : net < 0 ? '−' : '') + fmt(Math.abs(net));

  $('#listTitle').textContent = food ? 'Что съедено' : 'Тренировки за день';
  const empty = txt => `<p class="empty">${txt}</p>`;
  $('#list').innerHTML = food
    ? (fd.length ? MEALS.map(m => {
        const it = fd.filter(e => e.meal === m);
        return it.length ? `<div class="grp"><span>${m}</span><span>${fmt(sum(it, e => e.kcal))} ккал</span></div><ul class="rows">${it.map(foodRow).join('')}</ul>` : '';
      }).join('') : empty('На этот день записей нет. Добавьте первый приём пищи в форме выше.'))
    : (wd.length ? `<ul class="rows">${wd.map(workRow).join('')}</ul>` : empty('На этот день тренировок нет. Добавьте первую в форме выше.'));

  const days = [...Array(7)].map((_, i) => shift(date, i - 6));
  const vals = days.map(d => food ? sum(on(S.food, d), e => e.kcal) : sum(on(S.work, d), e => e.min));
  const mx = Math.max(...vals, 1);
  $('#chartTitle').textContent = food ? 'Калории за 7 дней' : 'Минуты тренировок за 7 дней';
  $('#chart').innerHTML = days.map((d, i) => {
    const dt = parse(d);
    return `<button class="col${d === date ? ' sel' : ''}" data-d="${d}" aria-label="${dt.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'})}: ${fmt(vals[i])}">` +
      `<span class="v">${vals[i] ? fmt(vals[i]) : ''}</span><span class="bw"><span class="b" style="height:${vals[i] / mx * 100}%"></span></span>` +
      `<span class="l">${dt.toLocaleDateString('ru-RU', {weekday: 'short'})}</span><span class="dn">${dt.getDate()}</span></button>`;
  }).join('');
  $('#avg').textContent = `В среднем за день: ${fmt(vals.reduce((a, b) => a + b, 0) / 7)} ${food ? 'ккал' : 'мин'}`;

  const names = l => [...new Set(l.map(e => e.name))].slice(-40).map(n => `<option value="${esc(n)}">`).join('');
  $('#foodNames').innerHTML = names(S.food); $('#workNames').innerHTML = names(S.work);
}

function cancelEdit() {
  editId = null;
  $('#formFood').reset(); $('#formWork').reset();
  const h = new Date().getHours();
  $('#formFood').elements.meal.value = h < 11 ? 'Завтрак' : h < 16 ? 'Обед' : h < 21 ? 'Ужин' : 'Перекус';
}

function commit(list, r) {
  if (editId) {
    const i = S[list].findIndex(x => x.id === editId);
    if (i > -1) S[list][i] = {...S[list][i], ...r};
  } else S[list].push({id: uid(), date, ...r});
  save(); cancelEdit(); render();
}

function startEdit(id) {
  const list = S.mode, r = S[list].find(x => x.id === id);
  if (!r) return;
  editId = id;
  if (list === 'food') {
    const x = $('#formFood').elements;
    x.nm.value = r.name; x.meal.value = r.meal; x.kcal.value = r.kcal; x.pr.value = r.p || ''; x.fa.value = r.f || ''; x.ca.value = r.c || '';
  } else {
    const x = $('#formWork').elements;
    x.nm.value = r.name; x.tp.value = r.tp; x.mn.value = r.min; x.it.value = r.int; x.kc.value = r.kc || '';
  }
  render();
  const f = list === 'food' ? $('#formFood') : $('#formWork');
  f.scrollIntoView({behavior: 'smooth', block: 'center'});
  f.elements.nm.focus({preventScroll: true});
}


$('.tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b && S.mode !== b.dataset.mode) { S.mode = b.dataset.mode; cancelEdit(); save(); render(); }
});

$('#prev').onclick = () => { date = shift(date, -1); cancelEdit(); render(); };
$('#next').onclick = () => { date = shift(date, 1); cancelEdit(); render(); };
$('#todayBtn').onclick = () => { date = key(new Date()); cancelEdit(); render(); };
$('#date').onchange = e => { if (e.target.value) { date = e.target.value; cancelEdit(); render(); } };

$('#goal').onchange = e => { const g = num(e.target.value); if (g) { S.goal = g; save(); } e.target.value = S.goal; render(); };

$('#formFood').onsubmit = e => {
  e.preventDefault();
  const x = e.target.elements, name = x.nm.value.trim();
  if (!name) return;
  commit('food', {name, meal: x.meal.value, kcal: num(x.kcal.value), p: num(x.pr.value), f: num(x.fa.value), c: num(x.ca.value)});
};

$('#formWork').onsubmit = e => {
  e.preventDefault();
  const x = e.target.elements, name = x.nm.value.trim(), min = num(x.mn.value);
  if (!name || !min) return;
  commit('work', {name, tp: x.tp.value, min, int: Number(x.it.value) || 2, kc: num(x.kc.value)});
};

$('#formFood').elements.nm.addEventListener('change', e => {
  if (editId) return;
  const x = $('#formFood').elements, v = e.target.value.trim().toLowerCase();
  const p = [...S.food].reverse().find(r => r.name.toLowerCase() === v);
  if (p && !x.kcal.value) { x.kcal.value = p.kcal; x.pr.value = p.p || ''; x.fa.value = p.f || ''; x.ca.value = p.c || ''; }
});

document.querySelectorAll('.cancel').forEach(b => b.onclick = () => { cancelEdit(); render(); });

$('#list').addEventListener('click', e => {
  const b = e.target.closest('button[data-a]');
  if (!b) return;
  const id = b.dataset.id;
  if (b.dataset.a === 'edit') startEdit(id);
  else { S[S.mode] = S[S.mode].filter(x => x.id !== id); if (editId === id) cancelEdit(); save(); render(); }
});

$('#chart').addEventListener('click', e => {
  const b = e.target.closest('[data-d]');
  if (b) { date = b.dataset.d; cancelEdit(); render(); }
});

const wipe = $('#wipe'), wipeText = 'Очистить все данные';
wipe.onclick = () => {
  if (wipe.dataset.arm) {
    S.food = []; S.work = []; save(); cancelEdit(); delete wipe.dataset.arm; wipe.textContent = wipeText; render();
  } else {
    wipe.dataset.arm = 1; wipe.textContent = 'Нажмите ещё раз, чтобы удалить всё';
    clearTimeout(wipeTimer);
    wipeTimer = setTimeout(() => { delete wipe.dataset.arm; wipe.textContent = wipeText; }, 3500);
  }
};

cancelEdit();
render();

})();
