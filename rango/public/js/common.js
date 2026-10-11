/* Utilidades compartilhadas do Lpoint (sem framework). */

// Unidade ativa (multi-unidade). O backend SEMPRE revalida; isto é só conveniência.
let ACTIVE_UNIT = null;
try { ACTIVE_UNIT = localStorage.getItem('rango_unit') || null; } catch {}
function setActiveUnit(id) { ACTIVE_UNIT = id ? String(id) : null; try { if (id) localStorage.setItem('rango_unit', String(id)); else localStorage.removeItem('rango_unit'); } catch {} }
async function api(path, { method = 'GET', body } = {}) {
  const opt = { method, headers: {}, credentials: 'same-origin' };
  if (ACTIVE_UNIT) opt.headers['X-Unit-Id'] = ACTIVE_UNIT;
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const res = await fetch(path, opt);
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) { const err = new Error((data && data.error) || 'Erro'); err.data = data; err.status = res.status; throw err; }
  return data;
}

function toast(msg, kind = '') {
  let box = document.getElementById('toast');
  if (!box) { box = document.createElement('div'); box.id = 'toast'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 2800);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const STATUS_META = {
  pendente:    ['warn', 'Pendente', '🟡'],
  confirmada:  ['ok', 'Confirmada', '🟢'],
  chegou:      ['info', 'Cliente chegou', '🔵'],
  atendimento: ['info', 'Em atendimento', '🍽️'],
  finalizada:  ['mut', 'Finalizada', '✔️'],
  concluida:   ['mut', 'Finalizada', '✔️'],
  noshow:      ['danger', 'Não compareceu', '🔴'],
  cancelada:   ['danger', 'Cancelada', '⛔'],
};
function statusBadge(status) {
  const [cls, label] = STATUS_META[status] || ['mut', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// Status operacionais das MESAS (sistema de salão)
const OPS_STATUS = {
  disponivel:           { label: 'Disponível',    short: 'Livre',      cls: 'ok' },
  reservada:            { label: 'Reservada',      short: 'Reserv.',    cls: 'warn' },
  aguardando_cliente:   { label: 'Aguardando cliente', short: 'Aguard.', cls: 'info' },
  ocupada:              { label: 'Ocupada',        short: 'Ocupada',    cls: 'danger' },
  aguardando_pagamento: { label: 'Aguardando pagamento', short: 'Pagto', cls: 'warn' },
  pago:                 { label: 'Pago',           short: 'Pago',       cls: 'info' },
  limpeza:              { label: 'Em preparação',  short: 'Limpeza',    cls: 'mut' },
  bloqueada:            { label: 'Bloqueada',      short: 'Bloq.',      cls: 'mut' },
  agrupada:             { label: 'Agrupada',       short: 'Grupo',      cls: 'info' },
};
function opsBadge(status) {
  const m = OPS_STATUS[status] || { label: status, cls: 'mut' };
  return `<span class="badge ${m.cls}">${m.label}</span>`;
}

function areaLabel(pref) {
  if (pref === 'rooftop') return '🌇 ROOFTOP';
  if (pref === 'salao') return '🍽 SALÃO';
  return '';
}
function areaBadge(pref) {
  const l = areaLabel(pref);
  if (!l) return '';
  return `<span class="badge ${pref==='rooftop'?'info':'mut'}" style="font-size:10px">${l}</span>`;
}

/* Modal genérico: openModal(htmlString) -> retorna o elemento .modal para ligar eventos. */
function openModal(html, opts = {}) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.id = '__modal';
  bg.innerHTML = `<div class="modal${opts.wide ? ' wide' : ''}"><button type="button" class="modal-x" aria-label="Fechar" onclick="closeModal()">✕</button>${html}</div>`;
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) closeModal(); });
  document.body.appendChild(bg);
  return bg.querySelector('.modal');
}
function closeModal() { const m = document.getElementById('__modal'); if (m) m.remove(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function todayISO(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function qs(name) { return new URLSearchParams(location.search).get(name); }
