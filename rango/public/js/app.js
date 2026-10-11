/* ============================================================================
   Rango — Painel do restaurante (SPA vanilla).
   Cada seção é uma função render*() que busca dados via API e injeta em #content.
   Navegação e ações são filtradas pelas permissões do papel do usuário.
   ============================================================================ */

let ME = null, chartRefs = [];

const ROUTES = [
  { id: 'dashboard',    label: 'Dashboard',       ic: '▣', perm: 'reservations:read' },
  { id: 'operacao',     label: 'Operação (salão)',ic: '🟢', perm: 'ops:view' },
  { id: 'atendimento',  label: 'Atendimento',     ic: '🧾', perm: 'orders:read' },
  { id: 'cardapio',     label: 'Cardápio',        ic: '📖', perm: 'menu:read' },
  { id: 'producao',     label: 'Produção',        ic: '👨‍🍳', perm: 'orders:read' },
  { id: 'desempenho',   label: 'Desempenho',      ic: '⏱️', perm: 'reports:read' },
  { id: 'chamados',     label: 'Chamados',        ic: '🔔', perm: 'orders:read' },
  { id: 'adega',        label: 'Gestão de Adega', ic: '🍾', perm: 'adega:view' },
  { id: 'estoque',      label: 'Despensa',        ic: '🧺', perm: 'estoque:view' },
  { id: 'agenda',       label: 'Agenda do dia',   ic: '🗓', perm: 'reservations:read' },
  { id: 'reservas',     label: 'Reservas',        ic: '📅', perm: 'reservations:read' },
  { id: 'salao',        label: 'Salão / Mesas',   ic: '🍽', perm: 'tables:read' },
  { id: 'clientes',     label: 'Clientes',        ic: '👥', perm: 'customers:read' },
  { id: 'horarios',     label: 'Horários',        ic: '🕐', perm: 'reservations:read' },
  { id: 'impressao',    label: 'Impressão (cozinha)', ic: '🖨', perm: 'settings:write' },
  { id: 'qrmesas',      label: 'QR das Mesas',    ic: '🔳', perm: 'tables:read' },
  { id: 'config',       label: 'Configurações',   ic: '⚙', perm: 'settings:write' },
  { id: 'pagina',       label: 'Página pública',  ic: '🔗', perm: 'reservations:read' },
  { id: 'notificacoes', label: 'Notificações',    ic: '🔔', perm: 'reservations:read' },
  { id: 'relatorios',   label: 'Relatórios',      ic: '📊', perm: 'reports:read' },
  { id: 'financeiro',   label: 'Financeiro',      ic: '💰', perm: 'reports:read' },
  { id: 'metricas',     label: 'Métricas de giro',ic: '⏱', perm: 'reports:read' },
  { id: 'usuarios',     label: 'Funcionários',    ic: '🔑', perm: 'users:write' },
  { id: 'integracoes',  label: 'Integrações',     ic: '🧩', perm: 'settings:write' },
  // ---- Módulo Adega/Bar (só aparece em estabelecimentos do tipo adega_bar) ----
  { id: 'bar_dashboard',   label: 'Dashboard',       ic: '▣', perm: 'adega:custos', bar: true },
  { id: 'bar_pos',         label: 'Lançar Venda',    ic: '🧾', perm: 'orders:write', bar: true },
  { id: 'bar_cardapio',    label: 'Cardápio Digital',ic: '🔗', perm: 'adega:view',   bar: true },
  { id: 'bar_pedidos',     label: 'Pedidos / Delivery', ic: '🛵', perm: 'orders:read', bar: true },
  { id: 'bar_vendas',      label: 'Histórico de Vendas', ic: '🧾', perm: 'orders:read', bar: true },
  { id: 'bar_bebidas',     label: 'Bebidas',         ic: '🍾', perm: 'adega:custos', bar: true },
  { id: 'bar_conv',        label: 'Conveniência',    ic: '🛒', perm: 'adega:custos', bar: true },
  { id: 'bar_doses',       label: 'Doses',           ic: '🥃', perm: 'adega:custos', bar: true },
  { id: 'bar_drinks',      label: 'Drinks',          ic: '🍹', perm: 'adega:custos', bar: true },
  { id: 'bar_receitas',    label: 'Receitas',        ic: '🍹', perm: 'adega:custos', bar: true },
  { id: 'bar_compras',     label: 'Compras',         ic: '🛒', perm: 'adega:custos', bar: true },
  { id: 'bar_inventario',  label: 'Inventário',      ic: '🧺', perm: 'adega:custos', bar: true },
  { id: 'bar_consumo',     label: 'Perdas e Consumo',ic: '💧', perm: 'adega:custos', bar: true },
  { id: 'bar_cmv',         label: 'CMV e Lucro',     ic: '📈', perm: 'adega:custos', bar: true },
  { id: 'bar_caixa',       label: 'Caixa',           ic: '🧰', perm: 'orders:read',  bar: true },
  { id: 'bar_relatorios',  label: 'Relatórios',      ic: '📊', perm: 'adega:custos', bar: true },
];
// Menu enxuto do Módulo Adega/Bar, agrupado (especificação "RESULTADO FINAL DA NAVEGAÇÃO").
const BAR_MENU = [
  { item: 'bar_dashboard' },
  { item: 'bar_pos' },
  { item: 'bar_cardapio' },
  { group: 'Vendas', items: ['bar_pedidos', 'bar_vendas'] },
  { group: 'Produtos', items: ['bar_bebidas', 'bar_conv', 'bar_doses', 'bar_drinks'] },
  { group: 'Estoque', items: ['estoque', 'bar_compras', 'bar_consumo', 'bar_inventario'] },
  { group: 'Financeiro', items: ['bar_cmv', 'bar_caixa'] },
  { group: 'Gestão', items: ['bar_relatorios', 'usuarios', 'config'] },
];
// Rótulos ajustados no contexto do bar.
const BAR_LABELS = { estoque: 'Estoque', relatorios: 'Relatórios', config: 'Configurações', usuarios: 'Funcionários', bar_pos: 'Lançar Venda' };
function isBar() { return !!(ME && ME.tenant && ME.tenant.is_bar); }

/* Pacote ÚNICO de ícones do Rango — estilo linha, mesmo viewBox (24), mesma espessura.
   Renderizados com currentColor: ficam vermelhos quando inativos e brancos no item ativo.
   Um único conjunto para o sistema inteiro (nada de emoji/ícone avulso por módulo). */
const NAV_ICONS = {
  dashboard:    '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  operacao:     '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>',
  atendimento:  '<path d="M9 3h6a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2V4a1 1 0 0 1 1-1z"/><path d="M9 11h6M9 15h4"/>',
  cardapio:     '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M4 17.5h12"/>',
  producao:     '<path d="M6 13h12v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M7 13a5 5 0 0 1 10 0"/><path d="M12 3v3M8.5 4.5l1 2M15.5 4.5l-1 2"/>',
  desempenho:   '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
  adega:        '<path d="M10 2h4M11 2v4.5L9 9v11a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V9l-2-2.5V2"/><path d="M9 13h6"/>',
  estoque:      '<path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  agenda:       '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 15h3v3H8z"/>',
  reservas:     '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  salao:        '<path d="M3 11h18"/><path d="M5 11a7 7 0 0 1 14 0"/><path d="M12 11v9M8 20h8"/>',
  clientes:     '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  horarios:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  config:       '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  pagina:       '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
  notificacoes: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  relatorios:   '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
  financeiro:   '<circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 0 0-2.5-1.5c-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2A2.5 2.5 0 0 1 9.5 15M12 6v1.5M12 16.5V18"/>',
  metricas:     '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  usuarios:     '<circle cx="10" cy="8" r="4"/><path d="M3 21v-1a6 6 0 0 1 11-3.3"/><circle cx="18" cy="15" r="2"/><path d="m19.5 16.5 2 2M17 17l-3 3v1h1l3-3"/>',
  integracoes:  '<path d="M14 7h3a2 2 0 0 1 2 2v3M10 17H7a2 2 0 0 1-2-2V9"/><path d="M12 3 9 6l3 3 3-3z" /><path d="m12 15-3 3 3 3 3-3z"/>',
  chamados:     '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  impressao:    '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M8 17h8v4H8z"/><circle cx="17.5" cy="12.5" r="0.6" fill="currentColor" stroke="none"/>',
  qrmesas:      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v7h-7M17 21v-1"/>',
  // Módulo Adega/Bar
  bar_dashboard:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  bar_pos:      '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2l2.3 11a1 1 0 0 0 1 .8h8.1a1 1 0 0 0 1-.8L20 7H6"/>',
  bar_vendas:   '<path d="M6 2h9l3 3v15l-2-1.3L14 20l-2-1.3L10 20l-2-1.3L6 20z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  bar_consumo:  '<path d="M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11z"/><path d="M9 14a3 3 0 0 0 3 3"/>',
  bar_cmv:      '<path d="M3 3v18h18"/><path d="m7 14 3-3 3 3 5-6"/>',
  bar_caixa:    '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8V5h10v3M7 13h4"/><circle cx="16" cy="14" r="1.2"/>',
  bar_conv:     '<path d="M4 7h16l-1.2 10a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z"/><path d="M8.5 7a3.5 3.5 0 0 1 7 0"/>',
  bar_conv_cat: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  bar_conv_prices: '<path d="M20 12V6a2 2 0 0 0-2-2h-6L3 13l8 8 9-9z"/><circle cx="8.5" cy="8.5" r="1.3"/>',
  bar_receitas: '<path d="M5 3h14l-7 8z"/><path d="M12 11v8M8 21h8"/>',
  bar_doses:    '<path d="M7 3h10l-1 5a4 4 0 0 1-8 0z"/><path d="M12 13v6M8.5 21h7"/><path d="M8 7h8"/>',
  bar_drinks:   '<path d="M6 3h12l-2.2 6.5a3 3 0 0 1-5.6 0z"/><path d="M12 10v8M8 21h8"/><path d="M15 3l3-1"/>',
  bar_bebidas:  '<path d="M10 2h4M11 2v4.5L9 9v11a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V9l-2-2.5V2"/><path d="M9 13h6"/>',
  bar_compras:  '<path d="M4 7h16l-1.2 10a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z"/><path d="M8.5 7a3.5 3.5 0 0 1 7 0"/>',
  bar_inventario: '<path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  bar_relatorios: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
  bar_cardapio: '<path d="M4 7h16M4 12h16M4 17h10"/><circle cx="18.5" cy="17" r="2.5"/><path d="M20.3 18.8 22 20.5"/>',
  bar_pedidos: '<circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/><path d="M3 5h3l2 9h9l2-6H7"/>',
};
function navIcon(id) {
  const p = NAV_ICONS[id];
  if (!p) return '';
  return `<span class="ic ic-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg></span>`;
}

function can(perm) { return ME && ME.permissions.includes(perm); }
// Badge de status da reserva, com destaque para "data expirada" (virada de dia).
function rStatus(r) {
  if (r && r.expiration_reason === 'data_expirada')
    return '<span class="badge danger" title="A data da reserva passou — histórico preservado">Cancelada · data expirada</span>';
  return statusBadge(r.status);
}

// Tema do PAINEL MASTER (só para o usuário master): fundo branco, acento azul
// (identidade Rango), letras azul-marinho, logo Rango escura sobre fundo claro.
// Os demais usuários continuam no tema escuro azul.
function applyMasterTheme() {
  document.documentElement.setAttribute('data-theme', 'light');
  const css = `
    :root[data-theme="light"]{--bg:#f2f6fb;--card:#fff;--card-2:#f3f7fc;--brand:#2987D6;--brand-dark:#1f6fb0;--brand-soft:#e3f0fc;--brand-ink:#fff;--ink:#021324;--ink-2:#3a4a5c;--ink-3:#64748b;--line:#dce6f1;color-scheme:light}
    body{background:var(--bg);color:var(--ink)}
    .sidebar,.sidebar-foot{background:#fff;color:#3a4a5c;border-color:#dce6f1}
    .sidebar .brand{color:#021324;flex-direction:column;align-items:flex-start}
    .sidebar .sep{border-top:1px solid #dce6f1}
    .nav-item{color:#3a4a5c;font-weight:600}
    .nav-item:hover{background:#eef4fb;color:#021324;text-decoration:none}
    .nav-item.active{background:#2987D6;color:#fff}
    .nav-item.active .ic-svg{color:#fff}
    .topbar{background:#fff;border-bottom:1px solid #dce6f1}
    .topbar h1{color:#021324}
    #who{color:#64748b}
    .stat .value{color:#021324}
    .card,.table-card,.stat{border-color:#dce6f1}
    .master-logo{display:block;height:34px;width:auto;aspect-ratio:700/449;background:#021324;-webkit-mask:url(/rango-logo.png) no-repeat left center/contain;mask:url(/rango-logo.png) no-repeat left center/contain}
  `;
  const s = document.createElement('style'); s.id = 'master-theme'; s.textContent = css; document.head.appendChild(s);
  const brand = document.querySelector('.sidebar .brand');
  if (brand) brand.innerHTML = `<span class="master-logo" role="img" aria-label="Rango"></span><div style="font-family:var(--display);font-weight:800;font-size:11px;color:#8a8a8a;margin-top:7px;letter-spacing:.08em">PAINEL MASTER</div>`;
  document.title = 'Painel Master Rango';
}

async function init() {
  try { ME = await api('/api/auth/me'); }
  catch { location.href = '/'; return; }
  if (ME.user.role === 'platform' && !ME.impersonating) { location.href = '/admin'; return; }
  if (ME.impersonating) showMasterBanner();

  if (ME.user.email && ME.user.email.toLowerCase() === 'vexxa360') applyMasterTheme();
  else applyBranding(); // White Label do tenant (fallback = padrão Rango, sem mudança visual)

  document.getElementById('who').innerHTML = `${esc(ME.user.name)}<br><span class="tiny">${esc(ME.user.roleLabel)} · ${esc(ME.restaurant.name)}</span>`;
  const link = document.getElementById('public-link');
  link.href = '/r/' + ME.restaurant.slug;
  renderUnitSelector();

  buildNav();
  applyCollapsed();
  refreshNotifBadge();
  setInterval(refreshNotifBadge, 30000);
  window.addEventListener('hashchange', route);
  connectStream();
  route();
}

/* Tempo real: assina o stream SSE e atualiza a tela atual sem recarregar. */
let _refreshTimer = null;
function connectStream() {
  try {
    const es = new EventSource('/api/stream');
    es.addEventListener('reserva', (ev) => {
      let d = {}; try { d = JSON.parse(ev.data); } catch {}
      if (d.type === 'nova') toast(`🔔 Nova reserva: ${d.customer_name || ''} ${d.time || ''}`, 'ok');
      refreshNotifBadge();
      // recarrega a seção atual (com pequeno debounce p/ múltiplos eventos)
      clearTimeout(_refreshTimer);
      _refreshTimer = setTimeout(() => { if (!document.getElementById('__modal')) route(); }, 400);
    });
    es.addEventListener('ops', (ev) => {
      let d = {}; try { d = JSON.parse(ev.data); } catch {}
      if (d.kind === 'new_order') handleNewOrder(d);
      else if (d.kind === 'order_ready') handleOrderReady(d);
      else if (d.kind === 'dw_request') handleDwRequest(d);
      // Nova notificação em tempo real -> expande a cortina e destaca.
      if (d.kind === 'new_order' && can('orders:read')) notifyArrived();
      const r = location.hash.replace('#', '') || 'dashboard';
      if (can('orders:read')) refreshKdsBadges();
      if (r === 'producao') { renderProducao(true); return; }
      if (r === 'chamados') { renderChamados(true); return; }
      if (r === 'impressao' && d.kind === 'print' && !document.getElementById('__modal')) { renderImpressao(true); return; }
      if (r === 'atendimento' && !document.getElementById('__modal')) { renderAtendimento(true); return; }
      if (document.getElementById('__modal')) return;
      if (r === 'operacao') { renderOperacao(true); return; }
      if (['dashboard', 'agenda', 'reservas', 'salao', 'metricas'].includes(r)) {
        clearTimeout(_refreshTimer);
        _refreshTimer = setTimeout(() => { if (!document.getElementById('__modal')) route(); }, 400);
      }
    });
    es.onerror = () => {}; // o próprio EventSource reconecta automaticamente
  } catch {}
}

// Módulo (feature flag) de cada item de nav. Itens fora do mapa ficam sempre visíveis.
const FEATURE_OF = {
  operacao: 'operacao', atendimento: 'atendimento', cardapio: 'cardapio', producao: 'producao',
  desempenho: 'desempenho', adega: 'adega', estoque: 'estoque', reservas: 'reservas', salao: 'salao',
  clientes: 'clientes', relatorios: 'relatorios', financeiro: 'financeiro', integracoes: 'integracoes',
  chamados: 'garcom_digital', qrmesas: 'garcom_digital', impressao: 'impressao',
};
function featureOn(id) { const m = FEATURE_OF[id]; if (!m || !ME || !ME.features) return true; return ME.features[m] !== false; }
function navLabel(r) { return (isBar() && BAR_LABELS[r.id]) || r.label; }
function navItemHtml(r) {
  return `<a class="nav-item" data-id="${r.id}" data-tip="${esc(navLabel(r))}" onclick="go('${r.id}')">${navIcon(r.id)} <span class="nav-label">${navLabel(r)}</span>${r.id==='notificacoes'?'<span id="nav-notif" class="nav-badge hide">0</span>':''}${r.id==='producao'?'<span id="nav-prod" class="nav-badge hide">0</span>':''}${r.id==='atendimento'?'<span id="nav-atend" class="nav-badge hide">0</span>':''}${r.id==='chamados'?'<span id="nav-chamados" class="nav-badge hide">0</span>':''}</a>`;
}
function buildNav() {
  const nav = document.getElementById('nav');
  if (isBar()) {
    // Menu agrupado do Módulo Adega/Bar (seção "MENU DO MÓDULO ADEGA").
    const byId = id => ROUTES.find(r => r.id === id);
    let html = '';
    for (const blk of BAR_MENU) {
      if (blk.item) { const r = byId(blk.item); if (r && can(r.perm) && featureOn(r.id)) html += navItemHtml(r); continue; }
      const items = (blk.items || []).map(byId).filter(r => r && can(r.perm) && featureOn(r.id));
      if (!items.length) continue;
      html += `<div class="nav-group">${esc(blk.group)}</div>` + items.map(navItemHtml).join('');
    }
    nav.innerHTML = html;
  } else {
    nav.innerHTML = ROUTES.filter(r => !r.bar && can(r.perm) && featureOn(r.id)).map(navItemHtml).join('');
  }
  if (can('orders:read')) { refreshKdsBadges(); setInterval(refreshKdsBadges, 20000); }
}
// White Label: aplica a identidade do tenant (fallback = padrão Rango, sem mudança).
function applyBranding() {
  const b = ME.branding || {}; if (!ME.tenant || !ME.tenant.white_label) return;
  const s = document.createElement('style'); s.id = 'tenant-brand';
  s.textContent = `:root{--brand:${b.primary_color};--brand-dark:${b.primary_color}} .nav-item.active{background:${b.primary_color};color:#fff} .btn:not(.ghost):not(.danger):not(.ok){background:${b.primary_color}}`;
  document.head.appendChild(s);
  document.title = (b.display_name || 'Rango');
  const brandEl = document.querySelector('.sidebar .brand');
  if (brandEl) brandEl.innerHTML = b.logo_url ? `<img src="${esc(b.logo_url)}" alt="${esc(b.display_name)}" style="max-height:40px;max-width:160px">` : `<span style="font-weight:800;font-size:20px">${esc(b.display_name)}</span>`;
}
// Seletor de unidade (aparece só quando o usuário tem acesso a mais de uma).
function renderUnitSelector() {
  const units = (ME.units || []); const host = document.getElementById('unit-selector');
  if (!host) return;
  if (units.length < 2) { host.innerHTML = ''; return; }
  const cur = (ACTIVE_UNIT && units.find(u => String(u.id) === String(ACTIVE_UNIT))) ? ACTIVE_UNIT : String(ME.restaurant.id);
  host.innerHTML = `<select id="unit-sel" onchange="switchUnit(this.value)" title="Unidade">${units.map(u => `<option value="${u.id}" ${String(u.id) === String(cur) ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>`;
}
function switchUnit(id) { setActiveUnit(id); location.reload(); }
// Banner "Modo Master" quando a VEXXA360 acessa o ambiente de um restaurante.
function showMasterBanner() {
  if (document.getElementById('master-banner')) return;
  const b = document.createElement('div');
  b.id = 'master-banner';
  b.innerHTML = `<span><b>Modo Master</b> — Restaurante: ${esc(ME.restaurant ? ME.restaurant.name : '')}</span>
    <button onclick="exitMaster()">↩ Voltar ao Painel Master</button>`;
  document.body.appendChild(b);
  document.body.classList.add('has-master-banner');
}
async function exitMaster() {
  try { await api('/api/platform/impersonate/stop', { method: 'POST' }); } catch {}
  setActiveUnit(null); location.href = '/admin';
}
async function refreshKdsBadges() {
  try {
    const d = await api('/api/production/counts');
    const prod = document.getElementById('nav-prod');
    if (prod) { prod.textContent = d.total; prod.classList.toggle('hide', !d.total); }
    const atend = document.getElementById('nav-atend');
    if (atend) { atend.textContent = d.prontos; atend.classList.toggle('hide', !d.prontos); atend.classList.toggle('ok-badge', true); }
    const cham = document.getElementById('nav-chamados');
    if (cham) { cham.textContent = d.chamados || 0; cham.classList.toggle('hide', !d.chamados); }
  } catch {}
}

function go(id) { location.hash = id; toggleMenu(false); }
function toggleMenu(open) {
  document.getElementById('sidebar').classList.toggle('open', open);
  document.getElementById('scrim').classList.toggle('hide', !open);
}
/* Menu retrátil (cortina) — estado por usuário no navegador. */
function applyCollapsed() {
  let c = false; try { c = localStorage.getItem('rango_nav_collapsed') === '1'; } catch {}
  const sh = document.querySelector('.shell'); if (sh) sh.classList.toggle('nav-collapsed', c);
}
function toggleCollapse() {
  const sh = document.querySelector('.shell'); if (!sh) return;
  const now = !sh.classList.contains('nav-collapsed');
  sh.classList.toggle('nav-collapsed', now);
  try { localStorage.setItem('rango_nav_collapsed', now ? '1' : '0'); } catch {}
}
/* Nova notificação: expande a cortina (se recolhida) e destaca — sem ficar
   abrindo/fechando repetidamente nem recarregar a página. */
let _notifFlashOn = false;
function notifyArrived() {
  const sh = document.querySelector('.shell'); if (!sh) return;
  // só expande se estiver recolhido (não re-anima quando já aberto)
  if (sh.classList.contains('nav-collapsed')) sh.classList.remove('nav-collapsed');
  if (_notifFlashOn) return; // evita re-disparar o destaque com a mesma pendência
  _notifFlashOn = true;
  const bell = document.getElementById('notif-bell');
  const navN = document.querySelector('.nav-item[data-id="notificacoes"]');
  for (const elx of [bell, navN]) { if (!elx) continue; elx.classList.remove('notif-flash'); void elx.offsetWidth; elx.classList.add('notif-flash'); }
}
async function logout() { await api('/api/auth/logout', { method: 'POST' }); location.href = '/'; }

function route() {
  let id = (location.hash.replace('#', '') || 'dashboard');
  // Home do bar: gerente/admin -> Dashboard; operador -> Lançar venda.
  const barHome = () => (can('adega:custos') ? 'bar_dashboard' : 'bar_pos');
  if (isBar() && (id === 'dashboard')) id = barHome();
  if (!isBar() && String(id).startsWith('bar_')) id = 'dashboard';
  const r = ROUTES.find(x => x.id === id) || ROUTES[0];
  if (!can(r.perm)) return go(isBar() ? barHome() : 'dashboard');
  document.querySelectorAll('.nav-item[data-id]').forEach(n => n.classList.toggle('active', n.dataset.id === r.id));
  document.getElementById('page-title').textContent = navLabel(r);
  chartRefs.forEach(c => { try { c.destroy(); } catch {} }); chartRefs = [];
  document.getElementById('content').innerHTML = '<div class="spinner"></div>';
  ({ dashboard: renderDashboard, operacao: renderOperacao, atendimento: renderAtendimento, cardapio: renderCardapio, producao: renderProducao, desempenho: renderDesempenho, adega: renderAdega, estoque: renderEstoque,
     chamados: renderChamados, impressao: renderImpressao, qrmesas: renderQrMesas,
     agenda: renderAgenda, reservas: renderReservas, salao: renderSalao, clientes: renderClientes,
     horarios: renderHorarios, config: renderConfig, pagina: renderPagina, notificacoes: renderNotificacoes,
     relatorios: renderRelatorios, financeiro: renderFinanceiro, metricas: renderMetricas, usuarios: renderUsuarios, integracoes: renderIntegracoes,
     bar_dashboard: renderBarDashboard, bar_pos: renderBarPOS, bar_vendas: renderBarVendas, bar_consumo: renderBarConsumo, bar_cmv: renderBarCMV, bar_caixa: renderBarCaixa,
     bar_bebidas: () => renderBarProdutos('bebida'), bar_conv: () => renderBarProdutos('conveniencia'),
     bar_compras: renderBarCompras, bar_inventario: renderBarInventario, bar_relatorios: renderBarRelatorios,
     bar_cardapio: renderBarCardapio, bar_pedidos: renderBarPedidos,
     bar_receitas: () => renderBarReceitas('receitas'), bar_doses: () => renderBarReceitas('dose'), bar_drinks: () => renderBarReceitas('drink') }[r.id])();
}

let _lastUnread = 0, _notifInit = false;
async function refreshNotifBadge() {
  try {
    const d = await api('/api/notifications');
    for (const el of [document.getElementById('notif-badge'), document.getElementById('nav-notif')]) {
      if (!el) continue;
      el.textContent = d.unread; el.classList.toggle('hide', !d.unread);
    }
    // No 1º carregamento só inicializa (respeita a preferência de recolhido).
    if (_notifInit && d.unread > _lastUnread) notifyArrived();
    if (d.unread === 0) _notifFlashOn = false;      // lidas -> libera próximo destaque
    _lastUnread = d.unread; _notifInit = true;
  } catch {}
}

/* ---------------------------------------------------------------- DASHBOARD */
function trendBadge(pct){ if(pct>0) return `<span class="trend up">▲ ${pct}%</span>`; if(pct<0) return `<span class="trend down">▼ ${Math.abs(pct)}%</span>`; return `<span class="trend flat">0%</span>`; }
async function renderDashboard() {
  const el = document.getElementById('content');
  let d, s;
  try { [d, s] = await Promise.all([api('/api/dashboard'), api('/api/dashboard/sales')]); }
  catch (e) { el.innerHTML = `<div class="empty">${e.message}</div>`; return; }
  const c = d.cards;
  const taxa = c.taxaOcupacao || 0;
  const maxProd = Math.max(1, ...s.produtos.map(p=>p.q));
  const totCanal = Math.max(1, s.canais.reduce((a,b)=>a+b.valor_cents,0));
  el.innerHTML = `
    <div class="section-title mt0"><h2 style="font-size:15px;color:var(--ink-3);font-weight:700">Visão geral · hoje · ${fmtDate(d.date)}</h2>
      <span class="badge ok" title="Atualiza em tempo real">● ao vivo</span></div>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top"><span class="kpi-ic" style="background:var(--brand)">R$</span>${trendBadge(s.variacao.faturamento)}</div>
        <div class="kpi-val">${brl(s.hoje.faturamento_cents)}</div><div class="kpi-lbl">Faturamento hoje</div></div>
      <div class="kpi"><div class="kpi-top"><span class="kpi-ic" style="background:#3574d4">🧾</span>${trendBadge(s.variacao.pedidos)}</div>
        <div class="kpi-val">${s.hoje.pedidos}</div><div class="kpi-lbl">Pedidos</div></div>
      <div class="kpi"><div class="kpi-top"><span class="kpi-ic" style="background:#1f9d6b">🍽</span><span class="trend flat">${taxa}%</span></div>
        <div class="kpi-val">${c.mesasOcupadas}/${c.totalMesas}</div><div class="kpi-lbl">Mesas ocupadas</div></div>
      <div class="kpi"><div class="kpi-top"><span class="kpi-ic" style="background:#b8860b">⌀</span>${trendBadge(s.variacao.ticket)}</div>
        <div class="kpi-val">${brl(s.hoje.ticket_cents)}</div><div class="kpi-lbl">Ticket médio</div></div>
    </div>

    <div class="dash-grid">
      <div class="card"><h3 style="margin-top:0">Vendas por horário</h3>
        ${s.por_hora.length ? '<div class="dash-chart"><canvas id="dash-hora"></canvas></div>' : '<div class="empty" style="padding:30px">Sem vendas registradas hoje.</div>'}</div>
      <div class="dash-side">
        <div class="card" style="text-align:center">
          <h3 style="margin-top:0;text-align:left">Ocupação do salão</h3>
          <div class="donut-wrap"><canvas id="dash-ocup"></canvas><div class="donut-center">${taxa}%</div></div>
          <div class="tiny" style="margin-top:6px"><b>${c.mesasOcupadas}</b> de <b>${c.totalMesas}</b> mesas · ${c.mesasLivres} livres</div>
        </div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="card"><h3 style="margin-top:0">Produtos mais vendidos <span class="tiny" style="color:var(--ink-3)">hoje</span></h3>
        ${s.produtos.length ? s.produtos.map((p,i)=>`<div class="rank-row">
          <span class="rank-pos">${i+1}</span>
          <div style="flex:1;min-width:0"><div class="rank-name">${esc(p.nome)}</div><div class="rank-bar"><span style="width:${Math.round(p.q/maxProd*100)}%"></span></div></div>
          <div class="rank-val"><b>${p.q}</b><div class="tiny">${brl(p.v)}</div></div>
        </div>`).join('') : '<div class="empty" style="padding:24px">Sem vendas hoje.</div>'}</div>
      <div class="card"><h3 style="margin-top:0">Vendas por canal <span class="tiny" style="color:var(--ink-3)">hoje</span></h3>
        ${s.canais.length ? s.canais.map(c2=>`<div class="rank-row">
          <div style="flex:1;min-width:0"><div class="rank-name">${esc(c2.canal)} <span class="tiny" style="color:var(--ink-3)">· ${c2.pedidos} ped.</span></div><div class="rank-bar"><span style="width:${Math.round(c2.valor_cents/totCanal*100)}%;background:var(--brand)"></span></div></div>
          <div class="rank-val"><b>${brl(c2.valor_cents)}</b></div>
        </div>`).join('') : '<div class="empty" style="padding:24px">Sem vendas hoje.</div>'}</div>
    </div>

    <div class="section-title"><h2 style="font-size:15px">Operação agora</h2></div>
    <div class="op-grid">
      <div class="op-card"><div class="op-val" style="color:#3574d4">${s.operacional.em_preparo}</div><div class="op-lbl">Em preparo</div></div>
      <div class="op-card"><div class="op-val" style="color:var(--ok)">${s.operacional.prontos}</div><div class="op-lbl">Prontos</div></div>
      <div class="op-card"><div class="op-val">${s.operacional.tempo_medio_preparo_min}<span style="font-size:14px">min</span></div><div class="op-lbl">Tempo médio preparo</div></div>
      <div class="op-card"><div class="op-val">${c.mesasReservadas}</div><div class="op-lbl">Mesas reservadas</div></div>
      <div class="op-card"><div class="op-val">${c.reservasHoje}</div><div class="op-lbl">Reservas do dia</div></div>
      <div class="op-card"><div class="op-val" style="color:var(--danger)">${s.hoje.cancelamentos}</div><div class="op-lbl">Cancelamentos</div></div>
    </div>

    <div class="section-title" style="margin-top:22px"><h2>Próximas reservas</h2>
      ${can('reservations:write') ? '<button class="btn sm" onclick="reservaModal()">+ Nova reserva</button>' : ''}</div>
    <div class="card tight" id="next"></div>
    <div id="dash-reports"></div>`;
  const box = document.getElementById('next');
  box.innerHTML = d.proximas.length ? reservasTable(d.proximas) : '<div class="empty">Nenhuma reserva à frente hoje. 🌿</div>';
  // gráficos
  try {
    const inkColor = getComputedStyle(document.body).color;
    if (s.por_hora.length) chartRefs.push(new Chart(document.getElementById('dash-hora'), {
      type:'bar', data:{ labels:s.por_hora.map(x=>x.hora), datasets:[{ data:s.por_hora.map(x=>Math.round(x.valor_cents/100)), backgroundColor:'#E0352B', borderRadius:6, maxBarThickness:34 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(ctx)=>brl(ctx.parsed.y*100) } } },
        scales:{ x:{ ticks:{ color:inkColor, font:{size:10} }, grid:{display:false} }, y:{ beginAtZero:true, ticks:{ color:inkColor, font:{size:10}, callback:(v)=>'R$'+v }, grid:{ color:'rgba(128,128,128,.12)' } } } }
    }));
    chartRefs.push(new Chart(document.getElementById('dash-ocup'), {
      type:'doughnut', data:{ labels:['Ocupadas/Reservadas','Livres'], datasets:[{ data:[c.mesasOcupadas+c.mesasReservadas, Math.max(0,c.mesasLivres)], backgroundColor:['#E0352B','rgba(128,128,128,.18)'], borderWidth:0 }] },
      options:{ responsive:true, maintainAspectRatio:false, cutout:'72%', plugins:{ legend:{display:false} } }
    }));
  } catch {}
  renderDashReports();
}
// Relatórios de BI fixados no Dashboard (cada card mantém sua configuração)
async function renderDashReports() {
  const host = document.getElementById('dash-reports'); if (!host) return;
  let saved = []; try { saved = (await api('/api/reports/saved')).reports.filter(s => s.on_dashboard); } catch { return; }
  if (!saved.length) return;
  if (!REL.catalog) { try { REL.catalog = (await api('/api/reports/catalog')).indicators; } catch {} }
  host.innerHTML = `
    <div class="section-title" style="margin-top:26px"><h2>Meus indicadores</h2>
      <button class="btn ghost sm" onclick="go('relatorios')">Ver relatórios</button></div>
    <div class="rel-saved-grid">${saved.map(s => `
      <div class="card tight">
        <div class="row between center"><b>${esc(s.nome)}</b><span class="tiny">${s.range_days} dias</span></div>
        <div class="rel-chart sm"><canvas id="dash-rep-${s.id}"></canvas></div>
      </div>`).join('')}</div>`;
  for (const s of saved) {
    try { const d = await api(`/api/reports/data?indicator=${s.indicator}&days=${s.range_days}`); relDrawChart('dash-rep-' + s.id, s.chart_type || d.recomendada, d); } catch {}
  }
}

function reservasTable(rows) {
  return `<div style="overflow-x:auto"><table class="tbl">
    <thead><tr><th>Horário</th><th>Cliente</th><th>Pessoas</th><th>Área</th><th>Mesa</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td><b>${r.time}</b><div class="tiny">${fmtDate(r.date)}</div></td>
      <td class="cust">${esc(r.customer_name)}<div class="tiny">${esc(r.customer_phone)}</div></td>
      <td>${r.party_size}</td>
      <td>${areaBadge(r.area_pref) || '<span class="tiny">—</span>'}</td>
      <td>${esc(r.tableName)}</td>
      <td>${rStatus(r)}</td>
      <td class="right">${rowActions(r)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

function rowActions(r) {
  if (!can('reservations:write')) return '';
  return `<button class="btn ghost sm" onclick='reservaMenu(${r.id})'>⋯</button>`;
}

let RESV_CACHE = {};
// Próxima ação natural no fluxo, por status atual.
function flowActions(id, status) {
  const b = [];
  if (status === 'pendente') b.push(`<button class="btn ok sm" onclick="setStatus(${id},'confirmada')">✓ Confirmar</button>`);
  if (['pendente','confirmada'].includes(status)) b.push(`<button class="btn sm" style="background:var(--info)" onclick="setStatus(${id},'chegou')">📍 Cliente chegou</button>`);
  if (status === 'chegou') b.push(`<button class="btn sm" style="background:var(--info)" onclick="setStatus(${id},'atendimento')">🍽️ Em atendimento</button>`);
  if (['chegou','atendimento'].includes(status)) b.push(`<button class="btn sm" style="background:var(--ok)" onclick="setStatus(${id},'finalizada')">✔️ Finalizar</button>`);
  if (['pendente','confirmada'].includes(status)) b.push(`<button class="btn sm" style="background:var(--warn)" onclick="setStatus(${id},'noshow')">🔴 Não compareceu</button>`);
  if (!['cancelada','finalizada','concluida','noshow'].includes(status)) b.push(`<button class="btn danger sm" onclick="setStatus(${id},'cancelada')">⛔ Cancelar</button>`);
  if (['finalizada','concluida','noshow','cancelada'].includes(status)) b.push(`<button class="btn ghost sm" onclick="setStatus(${id},'confirmada')">↩ Reabrir</button>`);
  return b.join('');
}
async function reservaMenu(id) {
  const r = RESV_CACHE[id];
  if (!r) return;
  const link = location.origin + '/reserva/' + r.cancel_token;
  openModal(`
    <h3>${esc(r.customer_name)} ${rStatus(r)} ${areaBadge(r.area_pref)}</h3>
    <p class="muted small">📅 ${fmtDate(r.date)} · 🕐 ${r.time} · 👥 ${r.party_size} pessoa(s) · ☎ ${esc(r.customer_phone)}</p>
    <p class="small" style="margin:6px 0">🪑 Mesa: <b>${esc(r.tableName)}</b>
      ${can('reservations:write') ? `<button class="btn-link" style="margin-left:8px" onclick="assignTable(${id})">${r.tableName==='a definir'?'Selecionar mesa':'Trocar mesa'}</button>` : ''}</p>
    ${r.note ? `<p class="small">📝 ${esc(r.note)}</p>` : ''}
    ${r.checkin_at ? `<p class="tiny">Check-in: ${esc(r.checkin_at.slice(11,16))}</p>` : ''}
    ${(can('ops:allocate') && !r.occupation_id && !['cancelada','finalizada','concluida','noshow'].includes(r.status)) ? `<button class="btn block" style="margin:12px 0" onclick="seatReservationModal(${id})">📍 Cliente chegou — alocar mesa no salão</button>` : ''}
    ${r.occupation_id ? '<p class="small" style="color:var(--ok)">✔ Cliente sentado no salão.</p>' : ''}
    ${can('reservations:write') ? `<div class="stack" style="margin-top:14px">
      <div class="row wrap">${flowActions(id, r.status)}</div>
      <div class="row wrap">
        <button class="btn ghost sm" onclick="editReserva(${id})">✎ Alterar</button>
        <button class="btn ghost sm" onclick="showHistory(${id})">🕘 Histórico</button>
        <button class="btn soft sm" onclick="waModal(${id})">📱 WhatsApp</button>
      </div>
    </div>` : ''}
    <div class="card tight" style="margin-top:14px;background:var(--bg)">
      <div class="tiny" style="margin-bottom:4px">Link da reserva (cliente pode consultar/cancelar):</div>
      <div class="row center" style="gap:6px">
        <input value="${link}" readonly class="small" style="padding:8px">
        <button class="btn ghost sm" onclick="navigator.clipboard.writeText('${link}');toast('Link copiado!','ok')">Copiar</button>
        <a class="btn ghost sm" target="_blank" href="/reserva/${r.cancel_token}">Abrir ↗</a>
      </div>
    </div>`);
}

async function setStatus(id, status) {
  try { await api(`/api/reservations/${id}/status`, { method: 'POST', body: { status } }); toast('Status atualizado.', 'ok'); closeModal(); route(); refreshNotifBadge(); }
  catch (e) { toast(e.message, 'err'); }
}

async function assignTable(id) {
  const d = await api(`/api/reservations/${id}/options`);
  const opts = d.options.map((o) => {
    const disabled = !o.free ? 'disabled' : '';
    const tag = !o.free ? '<span class="badge danger" style="font-size:10px">ocupada</span>'
      : (o.fits ? '<span class="badge ok" style="font-size:10px">cabe</span>' : '<span class="badge warn" style="font-size:10px">pequena</span>');
    return `<button class="btn ghost sm ${o.id===d.current?'':''}" ${disabled} onclick="doAssign(${id},${o.id})"
       style="justify-content:space-between;${o.id===d.current?'border-color:var(--brand);background:var(--brand-soft)':''}">
       <span>${esc(o.label)} · ${o.capacity} lug</span> ${tag}</button>`;
  }).join('');
  openModal(`<h3>Selecionar mesa</h3>
    <p class="muted small">Grupo de ${d.party_size} pessoa(s). Mesas ocupadas nesse horário ficam desabilitadas (sem conflito).</p>
    <div class="stack" style="margin-top:12px;max-height:50vh;overflow:auto">${opts}</div>`);
}
async function doAssign(id, tableId) {
  try { const r = await api(`/api/reservations/${id}/table`, { method: 'POST', body: { table_id: tableId } }); toast(`Mesa atribuída: ${r.tableName}`, 'ok'); closeModal(); route(); }
  catch (e) { toast(e.message, 'err'); }
}

async function showHistory(id) {
  const d = await api(`/api/reservations/${id}/history`);
  const labels = {
    reserva_criada: 'Reserva criada', mesa_atribuida: 'Mesa atribuída', mesa_alterada: 'Mesa alterada',
    reserva_confirmada: 'Confirmada', cliente_chegou: 'Cliente chegou (check-in)', em_atendimento: 'Em atendimento',
    reserva_finalizada: 'Finalizada', nao_compareceu: 'Não compareceu', reserva_cancelada: 'Cancelada',
    reserva_alterada: 'Reserva alterada', reserva_pendente: 'Pendente', ambiente_alterado: 'Ambiente alterado', cliente_sentado: 'Cliente sentado',
  };
  openModal(`<h3>Histórico da reserva</h3>
    <div class="stack" style="margin-top:12px">
      ${d.events.map((e) => `<div class="row between center" style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div><b>${labels[e.action] || e.action}</b>${e.detail ? `<div class="tiny">${esc(e.detail)}</div>` : ''}</div>
        <div class="tiny right">${esc(e.created_at.slice(5,16))}<br>${esc(e.actor)}</div>
      </div>`).join('') || '<p class="muted small">Sem registros.</p>'}
    </div>`);
}

async function waModal(id) {
  const d = await api(`/api/reservations/${id}/whatsapp?kind=confirmacao`);
  openModal(`
    <h3>Mensagem de WhatsApp</h3>
    <div class="chips" style="margin:10px 0">
      ${['confirmacao','lembrete','alteracao','cancelamento','agradecimento'].map(k =>
        `<button class="chip" onclick="loadWa(${id},'${k}',this)">${k}</button>`).join('')}
    </div>
    <textarea id="wa-text" rows="7">${esc(d.text)}</textarea>
    <a id="wa-link" class="btn block soft" style="margin-top:12px" target="_blank" href="${d.link}">Abrir no WhatsApp</a>
    <p class="tiny" style="margin-top:8px">Arquitetura pronta para a WhatsApp Cloud API oficial — hoje o envio abre o WhatsApp com a mensagem pronta.</p>`);
}
async function loadWa(id, kind, btn) {
  document.querySelectorAll('#__modal .chip').forEach(c => c.classList.remove('active')); btn.classList.add('active');
  const d = await api(`/api/reservations/${id}/whatsapp?kind=${kind}`);
  document.getElementById('wa-text').value = d.text;
  document.getElementById('wa-link').href = d.link;
}

/* ----------------------------------------------------------------- RESERVAS */
async function renderReservas() {
  const el = document.getElementById('content');
  el.innerHTML = `
    <div class="section-title"><h2>Reservas</h2>
      ${can('reservations:write') ? '<button class="btn sm" onclick="reservaModal()">+ Nova reserva</button>' : ''}</div>
    <div class="chips" id="filters" style="margin-bottom:8px">
      ${['hoje','amanha','semana','todas'].map((f,i) => `<button class="chip ${i===0?'active':''}" data-f="${f}" onclick="setFilter('${f}',this)">${{hoje:'Hoje',amanha:'Amanhã',semana:'7 dias',todas:'Todas'}[f]}</button>`).join('')}
    </div>
    <div class="chips" id="statusf" style="margin-bottom:14px">
      ${['','confirmada','pendente','cancelada','concluida','noshow'].map((s,i) => `<button class="chip ${i===0?'active':''}" data-s="${s}" onclick="setStatusFilter('${s}',this)">${s?({confirmada:'Confirmadas',pendente:'Pendentes',cancelada:'Canceladas',concluida:'Concluídas',noshow:'Não compareceu'})[s]:'Todos status'}</button>`).join('')}
    </div>
    <div id="resv-list" class="card tight"><div class="spinner"></div></div>`;
  loadReservas();
}
let RF = { filter: 'hoje', status: '' };
function setFilter(f, btn) { RF.filter = f; document.querySelectorAll('#filters .chip').forEach(c=>c.classList.remove('active')); btn.classList.add('active'); loadReservas(); }
function setStatusFilter(s, btn) { RF.status = s; document.querySelectorAll('#statusf .chip').forEach(c=>c.classList.remove('active')); btn.classList.add('active'); loadReservas(); }
async function loadReservas() {
  const q = new URLSearchParams();
  if (RF.filter !== 'todas') q.set('filter', RF.filter);
  if (RF.status) q.set('status', RF.status);
  const d = await api('/api/reservations?' + q.toString());
  RESV_CACHE = {}; d.reservations.forEach(r => RESV_CACHE[r.id] = r);
  const box = document.getElementById('resv-list');
  box.innerHTML = d.reservations.length ? reservasTable(d.reservations) : '<div class="empty"><div class="big">📭</div>Nenhuma reserva neste filtro.</div>';
}

function reservaModal(prefill = {}) {
  const m = openModal(`
    <h3>Nova reserva</h3>
    <form id="rform" class="stack" onsubmit="return submitReservaManual(event)">
      <div class="grid-2">
        <div class="field"><label>Nome</label><input name="customer_name" required value="${esc(prefill.name||'')}"></div>
        <div class="field"><label>WhatsApp / telefone</label><input name="customer_phone" required value="${esc(prefill.phone||'')}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Pessoas</label><input type="number" name="party_size" min="1" value="2" required></div>
        <div class="field"><label>Duração (min)</label><input type="number" name="duration_minutes" min="30" step="15" value="${ME.restaurant.slot_minutes||90}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Data</label><input type="date" name="date" min="${todayISO()}" value="${prefill.date||todayISO()}" required></div>
        <div class="field"><label>Horário</label><input type="time" name="time" value="${prefill.time||'20:00'}" required></div>
      </div>
      <div class="field"><label>Ambiente preferido</label><select name="area_pref">
        <option value="indiferente">Indiferente</option>
        ${(OPS_CACHE.areas||[]).filter(a=>a.active).map(a=>`<option value="${a.kind}">${esc(a.name)}</option>`).join('')}
      </select></div>
      <div class="field"><label>Observações</label><textarea name="note"></textarea></div>
      <div id="rform-msg"></div>
      <button class="btn block" type="submit">Reservar (mesa automática)</button>
    </form>`);
}
async function submitReservaManual(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button'); btn.disabled = true;
  const f = new FormData(e.target); const body = Object.fromEntries(f.entries());
  body.party_size = +body.party_size; body.duration_minutes = +body.duration_minutes;
  try {
    const r = await api('/api/reservations', { method: 'POST', body });
    toast(`Reserva criada · ${r.reservation.tableName}`, 'ok'); closeModal(); route(); refreshNotifBadge();
  } catch (err) {
    btn.disabled = false;
    let html = `<div class="card" style="border-color:var(--warn);background:var(--warn-soft)"><b>${esc(err.message)}</b>`;
    if (err.data && err.data.suggestions && err.data.suggestions.length) {
      html += '<div class="chips" style="margin-top:8px">' + err.data.suggestions.map(t =>
        `<button type="button" class="chip" onclick="document.querySelector('[name=time]').value='${t}'">${t}</button>`).join('') + '</div>';
    }
    document.getElementById('rform-msg').innerHTML = html + '</div>';
  }
}

async function editReserva(id) {
  const r = RESV_CACHE[id]; if (!r) return;
  openModal(`
    <h3>Alterar reserva</h3>
    <form id="eform" class="stack" onsubmit="return submitEdit(event, ${id})">
      <div class="field"><label>Nome de quem reservou</label><input name="customer_name" value="${esc(r.customer_name||'')}" required></div>
      <div class="grid-2">
        <div class="field"><label>Pessoas</label><input type="number" name="party_size" min="1" value="${r.party_size}" required></div>
        <div class="field"><label>Duração (min)</label><input type="number" name="duration_minutes" min="30" step="15" value="${r.duration_minutes}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Data</label><input type="date" name="date" value="${r.date}" required></div>
        <div class="field"><label>Horário</label><input type="time" name="time" value="${r.time}" required></div>
      </div>
      <div class="field"><label>Ambiente</label><select name="area_pref">
        <option value="indiferente" ${(r.area_pref||'indiferente')==='indiferente'?'selected':''}>Indiferente</option>
        <option value="salao" ${r.area_pref==='salao'?'selected':''}>Salão</option>
        <option value="rooftop" ${r.area_pref==='rooftop'?'selected':''}>Rooftop</option>
      </select></div>
      <div class="field"><label>Observações</label><textarea name="note">${esc(r.note||'')}</textarea></div>
      <div id="eform-msg"></div>
      <p class="tiny">Ao mudar data, horário ou nº de pessoas, o Rango recalcula a mesa automaticamente.</p>
      <button class="btn block" type="submit">Salvar alteração</button>
    </form>`);
}
async function submitEdit(e, id) {
  e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
  const body = Object.fromEntries(new FormData(e.target).entries());
  body.party_size = +body.party_size; body.duration_minutes = +body.duration_minutes;
  try { const r = await api(`/api/reservations/${id}`, { method: 'PATCH', body }); toast(`Atualizado · ${r.reservation.tableName}`, 'ok'); closeModal(); route(); }
  catch (err) {
    btn.disabled = false;
    let html = `<div class="card" style="border-color:var(--warn);background:var(--warn-soft)"><b>${esc(err.message)}</b>`;
    if (err.data && err.data.suggestions && err.data.suggestions.length)
      html += '<div class="chips" style="margin-top:8px">' + err.data.suggestions.map(t => `<button type="button" class="chip" onclick="document.querySelector('#eform [name=time]').value='${t}'">${t}</button>`).join('') + '</div>';
    document.getElementById('eform-msg').innerHTML = html + '</div>';
  }
}

/* ---------------------------------------------------------------- OPERAÇÃO */
const OPS = { area: 'todas', sel: new Set(), mode: null };
let OPS_CACHE = { areas: [], floors: {} };

function liveRefreshOps() {
  if ((location.hash.replace('#', '') || '') !== 'operacao') return;
  if (document.getElementById('__modal')) return;
  renderOperacao(true);
}

async function renderOperacao(silent) {
  const el = document.getElementById('content');
  if (!silent) el.innerHTML = '<div class="spinner"></div>';
  const [ov, ar] = await Promise.all([api('/api/ops/overview'), api('/api/areas')]);
  OPS_CACHE.areas = ar.areas;
  const areas = ar.areas.filter(a => a.active);
  const shown = OPS.area === 'todas' ? areas : areas.filter(a => String(a.id) === String(OPS.area));

  // busca o mapa de cada área exibida
  const floors = {};
  await Promise.all(shown.map(async (a) => { floors[a.id] = (await api('/api/ops/floor?area=' + a.id)).tables; }));
  OPS_CACHE.floors = floors;

  const tabs = `<div class="chips">
    <button class="chip ${OPS.area==='todas'?'active':''}" onclick="opsTab('todas')">Todas</button>
    ${areas.map(a => `<button class="chip ${String(OPS.area)===String(a.id)?'active':''}" onclick="opsTab('${a.id}')">${esc(a.name)}</button>`).join('')}
  </div>`;

  const statsHtml = ov.areas.map(a => `
    <div class="area-block">
      <div class="area-title">${a.kind==='rooftop'?'🌇':'🍽'} ${esc(a.name)}
        <span class="tiny">${a.pessoas_sentadas} pessoas · ${a.capacidade_disponivel} lugares livres</span></div>
      <div class="ops-stats">
        ${opsStat('Total', a.total)}${opsStat('Livres', a.livres, 'ok')}${opsStat('Ocupadas', a.ocupadas, 'danger')}
        ${opsStat('Reservadas', a.reservadas, 'warn')}${opsStat('Preparação', a.preparacao)}${opsStat('Bloqueadas', a.bloqueadas)}
      </div>
    </div>`).join('');

  const alertsHtml = ov.alerts.length ? `<div class="alert-strip">${ov.alerts.map(a =>
    `<div class="alert ${a.level}">${{vermelho:'🔴',laranja:'🟠',amarelo:'🟡',azul:'🔵'}[a.level]||'🔔'} ${esc(a.text)}</div>`).join('')}</div>` : '';

  const predHtml = ov.predictions.length ? `
    <div class="card tight" style="margin-top:14px"><b>Próximas mesas a liberar</b>
      ${ov.predictions.slice(0,6).map(p => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(p.label||'—')}</span><span class="tiny">${etaText(p.expected_release)}</span></div>`).join('')}
    </div>` : '';

  const maps = shown.map(a => renderAreaMap(a, floors[a.id])).join('');

  el.innerHTML = `
    <div class="section-title"><h2>Operação do salão</h2>
      <div class="row wrap center">
        ${can('ops:allocate') ? '<button class="btn sm" onclick="walkinModal()">＋ Walk-in (sem reserva)</button>' : ''}
        ${can('ops:config') ? '<button class="btn ghost sm" onclick="opsConfigModal()">⚙ Áreas & tempos</button>' : ''}
      </div>
    </div>
    ${tabs}
    <div style="margin:14px 0">${statsHtml}</div>
    ${alertsHtml}
    <div class="legend">
      <span><i style="border-color:var(--ok)"></i>Livre</span>
      <span><i style="border-color:var(--warn)"></i>Reservada</span>
      <span><i style="border-color:var(--danger)"></i>Ocupada</span>
      <span><i style="border-color:var(--warn);background:var(--warn-soft)"></i>Pagamento</span>
      <span><i style="border-color:#8b7bd8"></i>Preparação</span>
      <span><i style="border-color:var(--info);border-style:dashed"></i>Agrupada</span>
      <span><i style="border-color:var(--ink-3)"></i>Bloqueada</span>
    </div>
    <div id="ops-maps">${maps}</div>
    ${predHtml}
    <div id="ops-selbar"></div>`;
  updateSelBar();
}
function opsStat(l, v, cls) { return `<div class="ops-stat"><div class="v" ${cls?`style="color:var(--${cls})"`:''}>${v}</div><div class="l">${l}</div></div>`; }
function opsTab(a) { OPS.area = a; OPS.sel.clear(); renderOperacao(); }
function etaText(sql) {
  if (!sql) return '—';
  const d = new Date(String(sql).replace(' ', 'T') + 'Z'); const mins = Math.round((d - Date.now())/60000);
  if (mins <= 0) return 'agora'; if (mins < 60) return `~${mins} min`; return `~${Math.floor(mins/60)}h${String(mins%60).padStart(2,'0')}`;
}

function renderAreaMap(area, tables) {
  if (!tables || !tables.length) return `<div class="area-block"><div class="area-title">${esc(area.name)}</div><p class="muted small">Sem mesas nesta área. ${can('ops:config')?'Use "Áreas & tempos" para gerar mesas.':''}</p></div>`;
  const rows = {};
  for (const t of tables) (rows[t.pos_y] = rows[t.pos_y] || []).push(t);
  const ys = Object.keys(rows).map(Number).sort((a,b)=>a-b);
  const html = ys.map(y => {
    const cells = rows[y].sort((a,b)=>a.pos_x-b.pos_x).map(cellHtml).join('');
    return `<div class="maprow">${cells}</div>`;
  }).join('');
  return `<div class="area-block"><div class="area-title">${area.kind==='rooftop'?'🌇':'🍽'} ${esc(area.name)}</div>${html}</div>`;
}
function cellHtml(t) {
  const m = OPS_STATUS[t.status] || { short: t.status };
  const sel = OPS.sel.has(t.id) ? 'sel' : '';
  const grp = t.group_id ? 'grp' : '';
  const lk = t.locked ? 'locked' : '';
  let sub = '';
  if (t.occupation) sub = `<span class="ct">${t.occupation.party_size}p · ${t.occupation.elapsed_min}m</span>`;
  else if (t.reservation) sub = `<span class="ct">${t.reservation.time}</span>`;
  return `<div class="cell c-${t.status} ${sel} ${grp} ${lk}" onclick="cellClick(${t.id}, this)">
    <span class="cl">${esc(t.label)}</span><span class="cs">${m.short}</span>${sub}</div>`;
}

function findCell(id) { for (const a in OPS_CACHE.floors) { const t = OPS_CACHE.floors[a].find(x => x.id === id); if (t) return t; } return null; }

function cellClick(id, elem) {
  const t = findCell(id); if (!t) return;
  // Modo agrupar: clique adiciona/remove mesas livres da seleção.
  if (OPS.mode === 'agrupar') {
    if (t.status !== 'disponivel') { toast('Só mesas livres podem ser agrupadas.', 'err'); return; }
    if (OPS.sel.has(id)) { OPS.sel.delete(id); elem && elem.classList.remove('sel'); }
    else { OPS.sel.add(id); elem && elem.classList.add('sel'); }
    updateSelBar();
    return;
  }
  // Clique normal: abre o menu de ações conforme o estado da mesa.
  if (t.status === 'disponivel') { if (can('ops:allocate') || can('ops:manage')) freeTableMenu(t); }
  else if (['ocupada','aguardando_pagamento','pago','limpeza'].includes(t.status) && t.occupation) occupationModal(t);
  else if (t.status === 'reservada' || t.status === 'aguardando_cliente') reservationCellModal(t);
  else if (t.status === 'bloqueada') blockedCellModal(t);
  else if (t.status === 'agrupada') groupCellModal(t);
}

// ---- Menu de ações de uma mesa LIVRE (direto no ícone) ----
function freeTableMenu(t) {
  openModal(`<h3>${esc(t.label)} ${opsBadge('disponivel')}</h3>
    <p class="muted small">Mesa livre · ${t.seats || 2} lugares. Escolha a ação:</p>
    <div class="big-actions" style="margin-top:12px">
      ${can('orders:write') ? `<button class="btn" style="background:var(--brand)" onclick="openComandaMesa(${t.id},'${esc(t.label)}')">🧾 Abrir comanda / pedido</button>` : ''}
      <button class="btn" onclick="reserveTableForm(${t.id})">📅 Reservar</button>
      <button class="btn" style="background:var(--danger)" onclick="occupyTableForm(${t.id})">🍽️ Ocupar agora</button>
      ${can('ops:manage') ? `<button class="btn ghost" onclick="startGrouping(${t.id})">⛓ Agrupar</button>` : ''}
      ${can('ops:manage') ? `<button class="btn ghost" onclick="blockTablePrompt(${t.id})">⛔ Bloquear</button>` : ''}
    </div>`);
}
// Abre comanda numa mesa livre (senta + cria comanda) e vai direto ao cardápio.
function openComandaMesa(tableId, label) {
  openModal(`<h3>Abrir comanda — ${esc(label)}</h3>
    <form class="stack" onsubmit="return submitOpenComandaMesa(event, ${tableId})">
      <div class="grid-2">
        <div class="field"><label>Pessoas</label><input type="number" name="party_size" min="1" value="2" required></div>
        <div class="field"><label>Cliente (opcional)</label><input name="customer_name" placeholder="Nome"></div>
      </div>
      <div id="ocm-msg"></div>
      <button class="btn block">Abrir e fazer pedido</button>
    </form>`);
}
async function submitOpenComandaMesa(e, tableId) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  b.party_size = +b.party_size; b.table_id = tableId;
  try { const r = await api('/api/comandas/open', { method: 'POST', body: b }); closeModal(); openComanda(r.comanda.id); }
  catch (err) { document.getElementById('ocm-msg').innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; }
  return false;
}
async function comandaFromOccupation(occId) {
  try { const r = await api('/api/comandas/open', { method: 'POST', body: { occupation_id: occId } }); closeModal(); openComanda(r.comanda.id); }
  catch (e) { toast(e.message, 'err'); }
}
function tableNum(t) { const m = (t.label || '').match(/\d+/); return m ? m[0] : t.label; }

// ---- RESERVAR (formulário completo) ----
function reserveTableForm(tid) {
  const t = findCell(tid); if (!t) return;
  openModal(`<h3>Reservar — ${esc(t.label)}</h3>
    <form class="stack" onsubmit="return submitReserveTable(event)">
      <div class="grid-2">
        <div class="field"><label>Nome do cliente</label><input name="customer_name" required></div>
        <div class="field"><label>Telefone</label><input name="customer_phone" placeholder="(11) 90000-0000"></div>
      </div>
      <div class="field"><label>E-mail</label><input type="email" name="email" placeholder="para contato/remarketing (opcional)"></div>
      <div class="grid-2">
        <div class="field"><label>Data</label><input type="date" name="date" value="${todayISO()}" min="${todayISO()}" required></div>
        <div class="field"><label>Horário de entrada</label><input type="time" name="time" value="20:00" required></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Duração</label><select name="duration_minutes">
          <option value="60">1 hora</option><option value="90">1h30</option><option value="120" selected>2 horas</option><option value="150">2h30</option><option value="180">3 horas</option>
        </select></div>
        <div class="field"><label>Pessoas</label><input type="number" name="party_size" min="1" value="2" required></div>
      </div>
      <input type="hidden" name="table_numbers" value="${tableNum(t)}">
      <div class="tiny">A mesa é definida automaticamente a partir de ${esc(t.label)}. Para grupos maiores, o Rango junta mesas livres do mesmo ambiente sozinho.</div>
      <div id="rt-msg"></div>
      <button class="btn block">Confirmar reserva</button>
    </form>`);
}
async function submitReserveTable(e) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  b.party_size = +b.party_size; b.duration_minutes = +b.duration_minutes;
  try {
    const r = await api('/api/ops/reserve-table', { method: 'POST', body: b });
    toast('Reserva criada: ' + r.reservation.tableName, 'ok'); closeModal(); renderOperacao(); refreshNotifBadge();
  } catch (err) { document.getElementById('rt-msg').innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; }
  return false;
}

// ---- OCUPAR agora (formulário) ----
function occupyTableForm(tid) {
  const t = findCell(tid); if (!t) return;
  openModal(`<h3>Ocupar — ${esc(t.label)}</h3>
    <form class="stack" onsubmit="return submitOccupy(event)">
      <div class="grid-2">
        <div class="field"><label>Nome</label><input name="customer_name" placeholder="opcional"></div>
        <div class="field"><label>Telefone</label><input name="customer_phone" placeholder="opcional"></div>
      </div>
      <div class="field"><label>E-mail</label><input type="email" name="email" placeholder="opcional"></div>
      <div class="grid-2">
        <div class="field"><label>Pessoas</label><input type="number" name="party_size" min="1" value="2" required></div>
        <div class="field"><label>Duração estimada</label><select name="duration_minutes">
          <option value="">Padrão da casa</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option><option value="150">2h30</option>
        </select></div>
      </div>
      <div class="field"><label>Mesas (números)</label><input name="table_numbers" value="${tableNum(t)}" required></div>
      <div id="oc-msg"></div>
      <button class="btn block" style="background:var(--danger)">Ocupar mesa</button>
    </form>`);
}
async function submitOccupy(e) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  b.party_size = +b.party_size; if (b.duration_minutes) b.duration_minutes = +b.duration_minutes; b.source = 'walkin';
  try {
    const r = await api('/api/ops/seat', { method: 'POST', body: b });
    toast('Mesa ocupada: ' + r.tables, 'ok'); closeModal(); renderOperacao();
  } catch (err) { document.getElementById('oc-msg').innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; }
  return false;
}

// ---- AGRUPAR (modo de seleção no mapa) ----
function startGrouping(tid) { closeModal(); OPS.mode = 'agrupar'; OPS.sel = new Set([tid]); renderOperacao(); }
function cancelGrouping() { OPS.mode = null; OPS.sel.clear(); renderOperacao(); }
async function confirmGrouping() {
  const ids = [...OPS.sel]; if (ids.length < 2) return toast('Selecione ao menos 2 mesas livres.', 'err');
  const seats = ids.length * 2;
  try {
    const r = await api('/api/ops/group', { method: 'POST', body: { table_ids: ids } });
    toast('Mesas agrupadas.', 'ok'); OPS.mode = null; OPS.sel.clear(); renderOperacao();
    // Após agrupar, abre direto o formulário para informar clientes + contato.
    occupyGroupForm(r.group_id, seats);
  } catch (e) { toast(e.message, 'err'); }
}
// Formulário: quantas pessoas + nome/telefone de quem reservou -> ocupa o grupo.
function occupyGroupForm(groupId, seats) {
  openModal(`<h3>Ocupar grupo</h3>
    <p class="muted small">Mesas agrupadas${seats ? ' · até ' + seats + ' lugares' : ''}. Informe os clientes:</p>
    <form class="stack" onsubmit="return submitOccupyGroup(event, ${groupId})">
      <div class="field"><label>Quantas pessoas</label><input type="number" name="party_size" min="1" value="${seats || 2}" required></div>
      <div class="grid-2">
        <div class="field"><label>Nome de quem reservou</label><input name="customer_name" placeholder="Nome"></div>
        <div class="field"><label>Telefone</label><input name="customer_phone" placeholder="(11) 90000-0000"></div>
      </div>
      <div class="field"><label>Duração estimada</label><select name="duration_minutes">
        <option value="">Padrão da casa</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option><option value="150">2h30</option>
      </select></div>
      <div id="og-msg"></div>
      <button class="btn danger block">Ocupar grupo</button>
    </form>`);
}
async function submitOccupyGroup(e, groupId) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  b.party_size = +b.party_size; if (b.duration_minutes) b.duration_minutes = +b.duration_minutes;
  try { const r = await api(`/api/ops/group/${groupId}/occupy`, { method: 'POST', body: b }); toast('Grupo ocupado: ' + r.tables, 'ok'); closeModal(); renderOperacao(); }
  catch (err) { document.getElementById('og-msg').innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; }
  return false;
}
function updateSelBar() {
  const box = document.getElementById('ops-selbar'); if (!box) return;
  if (OPS.mode === 'agrupar') {
    const n = OPS.sel.size;
    box.innerHTML = `<div class="card" style="position:sticky;bottom:0;border-color:var(--brand);margin-top:14px">
      <div class="row between center">
        <b>Agrupar: ${n} mesa(s) · ${n * 2} lugares</b>
        <div class="row" style="gap:8px">
          <button class="btn sm" ${n < 2 ? 'disabled' : ''} onclick="confirmGrouping()">Confirmar agrupamento</button>
          <button class="btn ghost sm" onclick="cancelGrouping()">Cancelar</button>
        </div>
      </div>
      <div class="tiny" style="margin-top:6px">Clique nas mesas livres que farão parte do grupo.</div></div>`;
    return;
  }
  box.innerHTML = '';
}

// ---- BLOQUEAR / desbloquear ----
async function blockTablePrompt(tid) {
  const motivo = prompt('Motivo do bloqueio (opcional):', 'Manutenção');
  if (motivo === null) return;
  try { await api(`/api/tables/${tid}`, { method: 'PATCH', body: { blocked: 1, block_reason: motivo } }); toast('Mesa bloqueada.', 'ok'); closeModal(); renderOperacao(); }
  catch (e) { toast(e.message, 'err'); }
}
function blockedCellModal(t) {
  openModal(`<h3>${esc(t.label)} ${opsBadge('bloqueada')}</h3>
    <p class="muted small">${t.block_reason ? ('Motivo: ' + esc(t.block_reason)) : 'Mesa bloqueada.'}</p>
    ${can('ops:manage') ? `<button class="btn block" onclick="toggleBlockTable(${t.id},0)">Liberar mesa (desbloquear)</button>` : ''}`);
}
async function toggleBlockTable(id, blocked) {
  try { await api(`/api/tables/${id}`, { method: 'PATCH', body: { blocked } }); toast(blocked ? 'Mesa bloqueada.' : 'Mesa liberada.', 'ok'); closeModal(); renderOperacao(); }
  catch (e) { toast(e.message, 'err'); }
}

function occupationModal(t) {
  const o = t.occupation;
  const st = OPS_STATUS[o.status]?.label || o.status;
  const b = [];
  if (can('orders:write')) {
    const cmd = t.comanda;
    b.push(`<button class="btn" style="background:var(--brand)" onclick="comandaFromOccupation(${o.id})">🧾 ${cmd ? `Comanda #${String(cmd.numero).padStart(5,'0')} · ${brl(cmd.total_consumido_cents)}` : 'Abrir comanda / pedido'}</button>`);
  }
  if (can('ops:allocate')) {
    if (o.status === 'ocupada') b.push(`<button class="btn" style="background:var(--warn)" onclick="occAction(${o.id},'payment-requested')">💳 Pagamento solicitado</button>`);
    if (['ocupada','aguardando_pagamento'].includes(o.status)) b.push(`<button class="btn" style="background:var(--info)" onclick="occAction(${o.id},'paid')">✅ Pago</button>`);
    if (['pago','aguardando_pagamento','ocupada'].includes(o.status)) b.push(`<button class="btn ok" onclick="occAction(${o.id},'left')">🚪 Cliente saiu</button>`);
  }
  if (can('ops:manage')) {
    b.push(`<button class="btn danger" onclick="occAction(${o.id},'release')">✔ Liberar mesa</button>`);
    b.push(`<button class="btn ghost" onclick="transferModal(${o.id},${t.area_id})">↔ Transferir</button>`);
  }
  if (can('ops:allocate')) b.push(`<button class="btn ghost" onclick="changePartyModal(${o.id},${o.party_size})">👥 Alterar pessoas</button>`);
  b.push(`<button class="btn ghost" onclick="occHistory(${o.id})">🕘 Histórico</button>`);
  openModal(`
    <h3>${esc(t.label)} ${opsBadge(o.status)}</h3>
    <p class="muted small">${o.customer_name ? esc(o.customer_name)+' · ' : ''}${o.party_size} pessoa(s) · sentou há ${o.elapsed_min} min ${o.overstay?'<b style="color:var(--danger)">(acima do tempo médio)</b>':''}</p>
    <p class="tiny">Previsão de liberação: ${etaText(o.expected_release)}${o.status==='limpeza'?' · em preparação':''}</p>
    <div class="big-actions">${b.join('')}</div>`);
}
async function occAction(id, action) {
  try { await api(`/api/ops/occupation/${id}/${action}`, { method: 'POST' }); toast('Atualizado.', 'ok'); closeModal(); renderOperacao(); }
  catch (e) { toast(e.message, 'err'); }
}
function changePartyModal(id, cur) {
  const n = prompt('Nova quantidade de pessoas:', String(cur)); if (n === null) return;
  api(`/api/ops/occupation/${id}/party-size`, { method: 'POST', body: { party_size: +n } })
    .then(() => { toast('Atualizado.', 'ok'); closeModal(); renderOperacao(); }).catch(e => toast(e.message, 'err'));
}
async function transferModal(occId, areaId) {
  const floor = OPS_CACHE.floors[areaId] || (await api('/api/ops/floor?area=' + areaId)).tables;
  const free = floor.filter(t => t.status === 'disponivel');
  openModal(`<h3>Transferir para…</h3><p class="muted small">Selecione as novas mesas livres desta área.</p>
    <div class="maprow" style="margin-top:10px">${free.map(t => `<div class="cell c-disponivel" onclick="toggleTransferSel(${t.id},this)"><span class="cl">${esc(t.label)}</span><span class="cs">Livre</span></div>`).join('') || '<p class="muted small">Sem mesas livres.</p>'}</div>
    <button class="btn block" style="margin-top:14px" onclick="doTransfer(${occId})">Confirmar transferência</button>`);
  window.__transferSel = new Set();
}
function toggleTransferSel(id, el) { const s = window.__transferSel; if (s.has(id)) { s.delete(id); el.classList.remove('sel'); } else { s.add(id); el.classList.add('sel'); } }
async function doTransfer(occId) {
  const ids = [...(window.__transferSel || [])]; if (!ids.length) return toast('Selecione as mesas.', 'err');
  try { const r = await api(`/api/ops/occupation/${occId}/transfer`, { method: 'POST', body: { table_ids: ids } }); toast('Transferido para ' + r.tables, 'ok'); closeModal(); renderOperacao(); }
  catch (e) { toast(e.message, 'err'); }
}
async function occHistory(id) {
  const d = await api(`/api/ops/occupation/${id}/history`);
  const labels = { cliente_sentado:'Cliente sentado', pagamento_solicitado:'Pagamento solicitado', pago:'Pago', cliente_saiu:'Cliente saiu', mesa_liberada:'Mesa liberada', limpeza_concluida:'Limpeza concluída', transferencia:'Transferência', alterou_pessoas:'Alterou pessoas' };
  openModal(`<h3>Histórico da ocupação</h3><div class="stack" style="margin-top:12px">
    ${d.events.map(e => `<div class="row between center" style="padding:8px 0;border-bottom:1px solid var(--line)"><div><b>${labels[e.action]||e.action}</b>${e.detail?`<div class="tiny">${esc(e.detail)}</div>`:''}</div><div class="tiny right">${esc(e.created_at.slice(5,16))}<br>${esc(e.actor)}</div></div>`).join('') || '<p class="muted small">Sem registros.</p>'}
  </div>`);
}

function reservationCellModal(t) {
  const r = t.reservation;
  openModal(`<h3>${esc(t.label)} ${opsBadge(t.status)}</h3>
    <p class="muted small">Reservada para <b>${esc(r.customer_name)}</b> às ${r.time} · ${r.party_size} pessoa(s).</p>
    <div class="stack" style="margin-top:12px">
      ${can('ops:allocate') ? `<button class="btn block" onclick="seatReservation(${r.id})">📍 Cliente chegou — sentar</button>` : ''}
      ${can('ops:manage') ? `<button class="btn danger block" onclick="releaseReservation(${r.id})">Liberar mesa (cancelar reserva)</button>` : ''}
    </div>`);
}
async function releaseReservation(resId) {
  if (!confirm('Cancelar esta reserva e liberar a mesa?')) return;
  try { await api(`/api/reservations/${resId}/status`, { method: 'POST', body: { status: 'cancelada' } }); toast('Reserva cancelada, mesa liberada.', 'ok'); closeModal(); renderOperacao(); }
  catch (e) { toast(e.message, 'err'); }
}
async function seatReservation(resId) {
  try { const r = await api(`/api/reservations/${resId}/seat`, { method: 'POST', body: {} }); toast('Reserva sentada: ' + r.tables, 'ok'); closeModal(); renderOperacao(); }
  catch (e) { toast(e.message, 'err'); }
}

// Alocar mesa para uma reserva escolhendo a combinação (seção 11).
async function seatReservationModal(resId) {
  const r = RESV_CACHE[resId]; if (!r) return;
  const ar = await api('/api/areas');
  window.__areas = ar.areas.filter(a => a.active);
  let area = window.__areas.find(a => a.kind === r.area_pref) || window.__areas[0];
  if (!area) return toast('Cadastre uma área/mesas primeiro.', 'err');
  const floor = (await api('/api/ops/floor?area=' + area.id)).tables;
  const free = floor.filter(t => t.status === 'disponivel');
  window.__seatSel = new Set();
  const need = Math.ceil(r.party_size / 2);
  openModal(`<h3>Alocar mesa — ${esc(r.customer_name)}</h3>
    <div class="card tight" style="background:var(--bg);border-color:var(--brand);margin-bottom:10px">
      <div class="row between center" style="gap:8px;flex-wrap:wrap">
        <div>🔒 Ambiente: <b>${esc(area.name)}</b> <span class="tiny">· travado nesta reserva</span></div>
        ${window.__areas.length > 1 ? `<button class="btn ghost sm" onclick="changeAreaStart(${resId})">Alterar ambiente</button>` : ''}
      </div>
      <div class="tiny" style="margin-top:4px">Somente mesas de <b>${esc(area.name)}</b> podem ser usadas nesta reserva.</div>
    </div>
    <p class="muted small">${r.party_size} pessoa(s) · sugestão: ${need} mesa(s) de 2 lugares.</p>
    <div class="card tight">
      <b>Digite as mesas (deste ambiente)</b>
      <div class="row" style="gap:8px;margin-top:8px">
        <input id="seatres-nums" placeholder="ex.: 10, 11, 12" class="grow">
        <button class="btn sm" onclick="confirmSeatReservationByNumbers(${resId})">Sentar</button>
      </div>
    </div>
    <div style="text-align:center;color:var(--ink-3);margin:10px 0;font-size:12px">— ou selecione no mapa —</div>
    <div class="maprow" style="max-height:34vh;overflow:auto">
      ${free.length ? free.map(t => `<div class="cell c-disponivel" onclick="toggleSeatSel(${t.id},this)"><span class="cl">${esc(t.label)}</span><span class="cs">Livre</span></div>`).join('') : '<p class="muted small">Sem mesas livres neste ambiente.</p>'}
    </div>
    <button class="btn block" style="margin-top:12px" onclick="confirmSeatReservation(${resId})">Sentar nas mesas selecionadas</button>`);
}

/* ---- Troca de ambiente da reserva: DUAS confirmações obrigatórias ---- */
function areaNameByKind(kind) { const a = (window.__areas || []).find(x => x.kind === kind); return a ? a.name : (kind === 'rooftop' ? 'Rooftop' : kind === 'salao' ? 'Salão' : kind); }
function changeAreaStart(resId) {
  const r = RESV_CACHE[resId]; if (!r) return;
  const others = (window.__areas || []).filter(a => a.kind !== r.area_pref);
  if (!others.length) return toast('Não há outro ambiente cadastrado.', 'err');
  openModal(`<h3>Alterar ambiente</h3>
    <p>Esta reserva está vinculada ao ambiente <b>${esc(areaNameByKind(r.area_pref))}</b>.<br>Deseja realmente alterar o ambiente?</p>
    <div class="row" style="gap:8px;margin-top:16px">
      <button class="btn ghost grow" onclick="seatReservationModal(${resId})">CANCELAR</button>
      <button class="btn grow" onclick="changeAreaPick(${resId})">CONTINUAR</button>
    </div>`);
}
function changeAreaPick(resId) {
  const r = RESV_CACHE[resId];
  const others = (window.__areas || []).filter(a => a.kind !== r.area_pref);
  if (others.length === 1) return changeAreaConfirm(resId, others[0].kind);
  openModal(`<h3>Para qual ambiente?</h3>
    <div class="stack" style="margin-top:10px">
      ${others.map(a => `<button class="btn ghost block" onclick="changeAreaConfirm(${resId},'${a.kind}')">${esc(a.name)}</button>`).join('')}
    </div>
    <button class="btn ghost block" style="margin-top:8px" onclick="changeAreaStart(${resId})">VOLTAR</button>`);
}
function changeAreaConfirm(resId, toKind) {
  const r = RESV_CACHE[resId];
  openModal(`<h3 style="color:var(--warn)">⚠️ Atenção</h3>
    <p>A alteração do ambiente modificará as mesas disponíveis para esta reserva.<br>
    Confirme que deseja alterar de <b>${esc(areaNameByKind(r.area_pref))}</b> para <b>${esc(areaNameByKind(toKind))}</b>.</p>
    <div class="row" style="gap:8px;margin-top:16px">
      <button class="btn ghost grow" onclick="changeAreaStart(${resId})">VOLTAR</button>
      <button class="btn danger grow" onclick="doChangeArea(${resId},'${toKind}')">CONFIRMAR ALTERAÇÃO</button>
    </div>`);
}
async function doChangeArea(resId, toKind) {
  try {
    const res = await api(`/api/reservations/${resId}/area`, { method: 'POST', body: { area_pref: toKind } });
    if (RESV_CACHE[resId]) { RESV_CACHE[resId].area_pref = toKind; RESV_CACHE[resId].table_id = null; RESV_CACHE[resId].combined_ids = ''; }
    toast(`Ambiente alterado para ${res.to_name || areaNameByKind(toKind)}.`, 'ok');
    seatReservationModal(resId); // recarrega as mesas do novo ambiente (seleção limpa)
  } catch (e) { toast(e.message, 'err'); }
}
function toggleSeatSel(id, el) { const s = window.__seatSel; if (s.has(id)) { s.delete(id); el.classList.remove('sel'); } else { s.add(id); el.classList.add('sel'); } }
async function confirmSeatReservation(resId) {
  const ids = [...(window.__seatSel || [])]; if (!ids.length) return toast('Selecione as mesas.', 'err');
  try { const r = await api(`/api/reservations/${resId}/seat`, { method: 'POST', body: { table_ids: ids } }); toast('Cliente sentado: ' + r.tables, 'ok'); closeModal(); route(); refreshNotifBadge(); }
  catch (e) { toast(e.message, 'err'); }
}
async function confirmSeatReservationByNumbers(resId) {
  const nums = document.getElementById('seatres-nums').value.trim();
  if (!nums) return toast('Digite os números das mesas.', 'err');
  try { const r = await api(`/api/reservations/${resId}/seat`, { method: 'POST', body: { table_numbers: nums } }); toast('Cliente sentado: ' + r.tables, 'ok'); closeModal(); route(); refreshNotifBadge(); }
  catch (e) { toast(e.message, 'err'); }
}
function groupCellModal(t) {
  // conta as mesas do grupo (para sugerir a capacidade)
  let n = 0; for (const a in OPS_CACHE.floors) n += OPS_CACHE.floors[a].filter(c => c.group_id === t.group_id).length;
  const seats = (n || 1) * 2;
  const labels = []; for (const a in OPS_CACHE.floors) for (const c of OPS_CACHE.floors[a]) if (c.group_id === t.group_id) labels.push(c.label);
  openModal(`<h3>Grupo agrupado</h3>
    <p class="muted small">${esc(labels.join(' + '))} · até ${seats} lugares · sem ocupação.</p>
    <div class="stack" style="margin-top:12px">
      ${can('ops:allocate') ? `<button class="btn block" onclick="occupyGroupForm(${t.group_id},${seats})">👥 Informar clientes e ocupar</button>` : ''}
      ${can('ops:manage') ? `<button class="btn danger block" onclick="ungroup(${t.group_id})">Desagrupar</button>` : ''}
    </div>`);
}
async function ungroup(gid) {
  try { await api(`/api/ops/group/${gid}/ungroup`, { method: 'POST' }); toast('Desagrupado.', 'ok'); closeModal(); renderOperacao(); }
  catch (e) { toast(e.message, 'err'); }
}

async function walkinModal() {
  openModal(`<h3>Walk-in — cliente sem reserva</h3>
    <div class="grid-2">
      <div class="field"><label>Nome (opcional)</label><input id="walkin-nome" placeholder="Cliente"></div>
      <div class="field"><label>Pessoas</label><input type="number" id="walkin-party" min="1" value="4"></div>
    </div>
    <div class="field"><label>Ambiente</label>
      <select id="walkin-area">
        <option value="indiferente">Indiferente (qualquer área)</option>
        ${OPS_CACHE.areas.filter(a=>a.active).map(a=>`<option value="${a.kind}">${esc(a.name)}</option>`).join('')}
      </select>
    </div>

    <div class="card tight" style="border-color:var(--brand)">
      <b>Alocação automática</b>
      <div class="tiny" style="margin:6px 0 10px">O Rango escolhe e junta as mesas livres compatíveis no ambiente — sem digitar números.</div>
      <button class="btn block" onclick="walkinAuto()">Alocar mesa e sentar cliente</button>
    </div>

    <div style="text-align:center;color:var(--ink-3);margin:12px 0;font-size:12px">— ou veja as mesas livres por área —</div>

    <form onsubmit="return doSuggest(event)" class="row" style="gap:8px">
      <select name="area" style="width:auto">
        <option value="indiferente">Todas as áreas</option>
        ${OPS_CACHE.areas.filter(a=>a.active).map(a=>`<option value="${a.kind}">${esc(a.name)}</option>`).join('')}
      </select>
      <input type="hidden" name="party" value="4">
      <button class="btn ghost sm">Ver mesas disponíveis</button>
    </form>
    <div id="walk-res"></div>`);
}
async function walkinAuto() {
  const party = +(document.getElementById('walkin-party').value) || 0;
  const nome = document.getElementById('walkin-nome').value.trim();
  const area = document.getElementById('walkin-area').value;
  if (!party) return toast('Informe a quantidade de pessoas.', 'err');
  try {
    const r = await api('/api/ops/walkin', { method: 'POST', body: { party_size: party, area_pref: area, customer_name: nome } });
    toast('Cliente sentado: ' + (r.tables || ''), 'ok'); closeModal(); renderOperacao();
  } catch (e) { toast(e.message, 'err'); }
}
async function doSuggest(e) {
  e.preventDefault(); const f = new FormData(e.target);
  const pInput = document.getElementById('walkin-party');
  const party = +(pInput ? pInput.value : f.get('party')) || 4, area = f.get('area');
  const box = document.getElementById('walk-res'); box.innerHTML = '<div class="spinner"></div>';
  try {
    const d = await api('/api/ops/suggest', { method: 'POST', body: { party_size: party, area_pref: area } });
    box.innerHTML = '<div class="stack" style="margin-top:14px">' + d.suggestions.map(s => {
      let inner;
      if (s.now) {
        const ids = s.now.tables.map(t=>t.id);
        const blocked = s.now.blocked_by_reservation;
        inner = blocked
          ? `<div class="alert amarelo">⚠️ ${s.now.tables.map(t=>t.label).join(' + ')} — reservada para ${blocked.time}</div>`
          : `<div class="row between center"><span><b>${s.now.tables.map(t=>t.label).join(' + ')}</b> — disponível agora</span>
             <button class="btn sm" onclick='doWalkinSeat(${JSON.stringify(ids)},${party})'>Sentar</button></div>`;
      } else if (s.soon) {
        inner = `<div class="muted small">Disponível ~${etaText(s.soon.eta)} (${(s.soon.tables_freeing||[]).join(', ')})</div>`;
      } else {
        inner = `<div class="muted small">Sem combinação para ${party} pessoas agora.</div>`;
      }
      return `<div class="card tight"><b>${s.area_kind==='rooftop'?'🌇':'🍽'} ${esc(s.area_name)}</b> <span class="tiny">${s.free_count} mesas livres</span><div style="margin-top:8px">${inner}</div></div>`;
    }).join('') + '</div>';
  } catch (err) { box.innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
  return false;
}
async function doWalkinSeat(ids, party) {
  const nome = prompt('Nome do cliente (opcional):', '') || '';
  try {
    // trava as mesas e senta
    await api('/api/ops/lock', { method: 'POST', body: { table_ids: ids } }).catch(()=>{});
    const r = await api('/api/ops/seat', { method: 'POST', body: { table_ids: ids, party_size: party, source: 'walkin', customer_name: nome } });
    toast('Cliente sentado: ' + r.tables, 'ok'); closeModal(); renderOperacao();
  } catch (e) { toast(e.message, 'err'); }
}

async function opsConfigModal() {
  const [ov, ar] = await Promise.all([api('/api/ops/overview'), api('/api/areas')]);
  const s = ov.settings;
  openModal(`<h3>Áreas & tempos</h3>
    <div class="stack">
      <div><b>Áreas</b>
        ${ar.areas.map(a => `<div class="row between center" style="padding:6px 0;border-bottom:1px solid var(--line);flex-wrap:wrap;gap:6px">
          <span>${esc(a.name)} <span class="tiny">(${a.kind})</span></span>
          <div class="row" style="gap:6px">
            <button class="btn ghost sm" onclick="reorganizeArea(${a.id},'${esc(a.name)}','${a.kind}')">Organizar em grade</button>
            <button class="btn ghost sm" onclick="genTablesPrompt(${a.id},'${esc(a.name)}')">Gerar mesas</button>
          </div></div>`).join('')}
        <form class="row" style="gap:8px;margin-top:10px" onsubmit="return addArea(event)">
          <input name="name" placeholder="Nova área" class="grow" required>
          <select name="kind" style="width:auto"><option value="salao">Salão</option><option value="rooftop">Rooftop</option></select>
          <button class="btn sm">+ Área</button>
        </form>
      </div>
      <form onsubmit="return saveTempos(event)" class="stack" style="border-top:1px solid var(--line);padding-top:12px">
        <b>Tempos operacionais (min)</b>
        <div class="grid-2">
          <div class="field"><label>Permanência média</label><input type="number" name="stay_minutes" value="${s.stay_minutes}"></div>
          <div class="field"><label>Preparo/limpeza</label><input type="number" name="cleaning_minutes" value="${s.cleaning_minutes}"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Pagamento</label><input type="number" name="payment_minutes" value="${s.payment_minutes}"></div>
          <div class="field"><label>Tolerância</label><input type="number" name="tolerance_minutes" value="${s.tolerance_minutes}"></div>
        </div>
        <div class="field"><label>Trava de alocação (segundos)</label><input type="number" name="lock_seconds" value="${s.lock_seconds}"></div>
        <button class="btn block">Salvar tempos</button>
      </form>
      <form onsubmit="return saveMetasKDS(event)" class="stack" style="border-top:1px solid var(--line);padding-top:12px">
        <b>Metas de tempo de preparo (min) — alerta de pedido demorado</b>
        <div class="grid-2">
          <div class="field"><label>🍳 Cozinha</label><input type="number" name="cozinha" min="1" value="${s.prep_target_cozinha||15}"></div>
          <div class="field"><label>🍸 Bar</label><input type="number" name="bar" min="1" value="${s.prep_target_bar||8}"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>🧊 Narguilé</label><input type="number" name="narguile" min="1" value="${s.prep_target_narguile||10}"></div>
          <div class="field"><label>📦 Outros</label><input type="number" name="outros" min="1" value="${s.prep_target_outros||10}"></div>
        </div>
        <button class="btn block">Salvar metas</button>
      </form>
      <div style="border-top:1px solid var(--line);padding-top:12px">
        <b style="color:var(--danger)">Zerar operação</b>
        <p class="tiny">Apaga reservas, ocupações, agrupamentos e clientes de teste. Mantém áreas, mesas e usuários.</p>
        <button class="btn danger block" onclick="resetOpsConfirm()">Zerar tudo para testar do zero</button>
      </div>
    </div>`);
}
function resetOpsConfirm() {
  openModal(`<h3 style="color:var(--danger)">⚠️ Zerar operação</h3>
    <p>Isto apaga <b>todas as reservas, ocupações, agrupamentos e clientes</b> deste restaurante.<br>As áreas, mesas e usuários são mantidos. Esta ação não pode ser desfeita.</p>
    <div class="row" style="gap:8px;margin-top:16px">
      <button class="btn ghost grow" onclick="opsConfigModal()">CANCELAR</button>
      <button class="btn danger grow" onclick="doResetOps()">CONFIRMAR E ZERAR</button>
    </div>`);
}
async function doResetOps() {
  try { const r = await api('/api/ops/reset', { method: 'POST', body: {} }); toast(`Operação zerada · ${r.tables} mesas livres.`, 'ok'); closeModal(); route(); refreshNotifBadge(); }
  catch (e) { toast(e.message, 'err'); }
}
async function addArea(e) { e.preventDefault(); const f=new FormData(e.target);
  try { await api('/api/areas',{method:'POST',body:{name:f.get('name'),kind:f.get('kind')}}); toast('Área criada.','ok'); opsConfigModal(); } catch(err){ toast(err.message,'err'); } return false; }
async function reorganizeArea(areaId, name, kind) {
  if (!confirm(`Reorganizar as mesas de "${name}" em grade simétrica e renomear em sequência?`)) return;
  const perRow = kind === 'rooftop' ? 6 : 8;
  const startNum = kind === 'rooftop' ? 101 : 1;
  try {
    const r = await api(`/api/areas/${areaId}/reorganize`, { method: 'POST', body: { perRow, startNum, relabel: true } });
    toast(`${r.count} mesas reorganizadas.`, 'ok'); opsConfigModal(); renderOperacao && renderOperacao();
  } catch (e) { toast(e.message, 'err'); }
}
async function genTablesPrompt(areaId, name) {
  const count = prompt(`Quantas mesas de 2 lugares gerar em "${name}"?`, '20'); if (count===null) return;
  const prefix = prompt('Prefixo do nome (ex.: S, R):', 'M') || 'M';
  try { const r = await api(`/api/areas/${areaId}/generate-tables`,{method:'POST',body:{count:+count,perRow:8,prefix}}); toast(`${r.created} mesas geradas.`,'ok'); opsConfigModal(); } catch(e){ toast(e.message,'err'); }
}
async function saveTempos(e) { e.preventDefault(); const b=Object.fromEntries(new FormData(e.target).entries());
  for (const k in b) b[k]=+b[k];
  try { await api('/api/ops/settings',{method:'PUT',body:b}); toast('Tempos salvos.','ok'); closeModal(); } catch(err){ toast(err.message,'err'); } return false; }
async function saveMetasKDS(e) { e.preventDefault(); const b=Object.fromEntries(new FormData(e.target).entries());
  for (const k in b) b[k]=+b[k];
  try { await api('/api/production/targets',{method:'PUT',body:b}); toast('Metas salvas.','ok'); closeModal(); } catch(err){ toast(err.message,'err'); } return false; }

/* --------------------------------------------------------------- MÉTRICAS */
async function renderMetricas() {
  const d = await api('/api/ops/metrics?days=7');
  document.getElementById('content').innerHTML = `
    <div class="section-title"><h2>Métricas de giro · últimos ${d.days} dias</h2></div>
    <div class="stats">
      <div class="stat accent"><div class="label">Clientes atendidos</div><div class="value">${d.clientes_atendidos}</div></div>
      <div class="stat"><div class="label">Ocupações</div><div class="value">${d.occupations}</div><div class="sub">${d.walkins} walk-ins · ${d.reservas} reservas</div></div>
      <div class="stat"><div class="label">Permanência média</div><div class="value">${d.tempo_medio_permanencia}<span style="font-size:16px">min</span></div></div>
      <div class="stat"><div class="label">Até pagamento</div><div class="value">${d.tempo_medio_pagamento}<span style="font-size:16px">min</span></div></div>
      <div class="stat"><div class="label">Giro por mesa</div><div class="value">${d.giro_por_mesa}</div><div class="sub">ocupações/mesa</div></div>
    </div>`;
}

/* ------------------------------------------------------------------- AGENDA */
let AGENDA_DATE = todayISO();
async function renderAgenda() {
  const el = document.getElementById('content');
  el.innerHTML = `
    <div class="section-title"><h2>Agenda do dia</h2>
      <div class="row center" style="gap:8px">
        ${can('reservations:write') ? '<button class="btn ghost sm" title="Expira reservas de dias anteriores e atualiza as mesas (histórico preservado)" onclick="syncReservasDia()">↻ Sincronizar dia</button>' : ''}
        <button class="btn ghost sm" onclick="agendaShift(-1)">◀</button>
        <input type="date" id="ag-date" value="${AGENDA_DATE}" onchange="AGENDA_DATE=this.value;loadAgenda()" style="width:auto">
        <button class="btn ghost sm" onclick="agendaShift(1)">▶</button>
      </div></div>
    <div id="agenda"><div class="spinner"></div></div>`;
  loadAgenda();
}
async function syncReservasDia() {
  try {
    const r = await api('/api/reservations/rollover', { method: 'POST', body: {} });
    toast(r.expiradas ? `${r.expiradas} reserva(s) de dias anteriores expirada(s). Mesas atualizadas.` : 'Tudo em dia — nenhuma reserva anterior em aberto.', 'ok');
    loadAgenda();
  } catch (e) { toast(e.message, 'err'); }
}
function agendaShift(days) {
  const d = new Date(AGENDA_DATE + 'T12:00:00'); d.setDate(d.getDate() + days);
  AGENDA_DATE = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const inp = document.getElementById('ag-date'); if (inp) inp.value = AGENDA_DATE;
  loadAgenda();
}
async function loadAgenda() {
  const d = await api('/api/reservations?date=' + AGENDA_DATE);
  RESV_CACHE = {}; d.reservations.forEach(r => RESV_CACHE[r.id] = r);
  const box = document.getElementById('agenda');
  const visible = d.reservations.filter(r => r.status !== 'cancelada');
  if (!visible.length) { box.innerHTML = '<div class="empty"><div class="big">🗓</div>Nenhuma reserva neste dia.</div>'; return; }
  const byTime = {};
  for (const r of visible) (byTime[r.time] = byTime[r.time] || []).push(r);
  const times = Object.keys(byTime).sort();
  box.innerHTML = times.map(t => `
    <div class="row" style="gap:14px;align-items:flex-start;margin-bottom:6px">
      <div style="width:64px;flex:0 0 auto;text-align:right;padding-top:14px"><b style="font-family:var(--display);font-size:18px">${t}</b></div>
      <div class="grow stack" style="border-left:2px solid var(--line);padding-left:14px">
        ${byTime[t].map(r => `
          <div class="list-card row between center" style="gap:10px;cursor:pointer" onclick="reservaMenu(${r.id})">
            <div><b>${esc(r.customer_name)}</b> <span class="tiny">${r.party_size}p</span> ${areaBadge(r.area_pref)}
              <div class="tiny">🪑 ${esc(r.tableName)}</div></div>
            ${rStatus(r)}
          </div>`).join('')}
      </div>
    </div>`).join('');
}

/* ------------------------------------------------------------- SALÃO / MESAS */
let FLOOR = { date: todayISO(), time: '20:00' };
async function renderSalao() {
  const el = document.getElementById('content');
  el.innerHTML = `
    <div class="section-title"><h2>Visão do salão</h2>
      <div class="row wrap center">
        <input type="date" id="fl-date" value="${FLOOR.date}" onchange="FLOOR.date=this.value;loadFloor()" style="width:auto">
        <input type="time" id="fl-time" value="${FLOOR.time}" onchange="FLOOR.time=this.value;loadFloor()" style="width:auto">
        ${can('tables:write') ? '<button class="btn ghost sm" onclick="manageTables()">Gerenciar mesas</button>' : ''}
      </div>
    </div>
    <div class="row wrap" style="gap:14px;margin-bottom:14px">
      <span class="badge ok">● Livre</span><span class="badge warn">● Reservada</span>
      <span class="badge danger">● Ocupada</span><span class="badge mut">● Bloqueada</span>
    </div>
    <div id="floor"><div class="spinner"></div></div>`;
  loadFloor();
}
async function loadFloor() {
  const d = await api(`/api/floor?date=${FLOOR.date}&time=${FLOOR.time}`);
  const box = document.getElementById('floor');
  if (!d.tables.length) { box.innerHTML = '<div class="empty"><div class="big">🍽</div>Nenhuma mesa cadastrada.' + (can('tables:write') ? ' <br><button class="btn sm" style="margin-top:12px" onclick="manageTables()">Cadastrar mesas</button>' : '') + '</div>'; return; }
  window.__floor = d.tables;
  box.innerHTML = '<div class="floor-grid">' + d.tables.map(t => `
    <div class="table-card st-${t.status}" onclick="tableDetail(${t.id})">
      <div class="tname">${esc(t.label)}</div>
      <div class="tcap">${t.capacity} lugares · ${esc(t.zone)}</div>
      <div class="tstatus">${t.status}</div>
      ${t.reservations.length ? `<div class="tiny" style="margin-top:8px">${t.reservations.length} reserva(s) no dia</div>` : ''}
    </div>`).join('') + '</div>';
}
function tableDetail(id) {
  const t = (window.__floor || []).find(x => x.id === id); if (!t) return;
  const list = t.reservations.length ? t.reservations.map(r =>
    `<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line)">
      <div><b>${r.time}</b> · ${esc(r.customer_name)} <span class="tiny">(${r.party_size}p)</span>${r.note?`<div class="tiny">📝 ${esc(r.note)}</div>`:''}</div>
      ${rStatus(r)}
    </div>`).join('') : '<p class="muted small">Sem reservas neste dia.</p>';
  openModal(`
    <h3>${esc(t.label)}</h3>
    <p class="muted small">${t.capacity} lugares · ${esc(t.zone)} · Status agora: <b>${t.status}</b></p>
    <h4 style="margin-top:14px">Reservas em ${fmtDate(FLOOR.date)}</h4>
    ${list}
    ${can('tables:write') ? `<div class="row" style="margin-top:16px">
      <button class="btn ghost sm grow" onclick="toggleBlock(${t.id},${t.status==='bloqueada'?0:1})">${t.status==='bloqueada'?'Desbloquear mesa':'Bloquear temporariamente'}</button>
    </div>`:''}`);
}
async function toggleBlock(id, blocked) {
  try { await api(`/api/tables/${id}`, { method: 'PATCH', body: { blocked } }); toast(blocked?'Mesa bloqueada.':'Mesa liberada.','ok'); closeModal(); loadFloor(); }
  catch (e) { toast(e.message, 'err'); }
}

async function manageTables() {
  const d = await api('/api/tables');
  openModal(`
    <h3>Mesas</h3>
    <div id="tbl-list" style="max-height:46vh;overflow:auto;margin:10px 0">${tablesRows(d.tables)}</div>
    <form class="card tight" onsubmit="return addTable(event)">
      <div class="row" style="gap:8px">
        <input name="label" placeholder="Nome (Mesa 09)" required class="grow">
        <input name="capacity" type="number" min="1" placeholder="Lug." style="width:80px" required>
        <input name="zone" placeholder="Zona" style="width:110px" value="Salão">
        <button class="btn sm">+ Add</button>
      </div>
    </form>`);
}
function tablesRows(tables) {
  if (!tables.length) return '<p class="muted small">Nenhuma mesa ainda.</p>';
  return tables.map(t => `
    <div class="row between center" style="padding:8px 0;border-bottom:1px solid var(--line)">
      <div><b>${esc(t.label)}</b> <span class="tiny">${t.capacity} lug · ${esc(t.zone)} ${t.active?'':'· inativa'} ${t.blocked?'· bloqueada':''}</span></div>
      <div class="row" style="gap:6px">
        <button class="btn ghost sm" onclick="editTable(${t.id},'${esc(t.label)}',${t.capacity},'${esc(t.zone)}')">✎</button>
        <button class="btn danger sm" onclick="delTable(${t.id})">🗑</button>
      </div>
    </div>`).join('');
}
async function addTable(e) {
  e.preventDefault(); const f = new FormData(e.target);
  try { await api('/api/tables', { method: 'POST', body: { label: f.get('label'), capacity: +f.get('capacity'), zone: f.get('zone') } }); toast('Mesa adicionada.', 'ok'); manageTables(); loadFloor && loadFloor(); }
  catch (err) { toast(err.message, 'err'); }
}
async function editTable(id, label, capacity, zone) {
  const nl = prompt('Nome da mesa:', label); if (nl === null) return;
  const nc = prompt('Capacidade:', capacity); if (nc === null) return;
  try { await api(`/api/tables/${id}`, { method: 'PATCH', body: { label: nl, capacity: +nc } }); toast('Mesa atualizada.', 'ok'); manageTables(); }
  catch (e) { toast(e.message, 'err'); }
}
async function delTable(id) {
  if (!confirm('Excluir esta mesa?')) return;
  try { await api(`/api/tables/${id}`, { method: 'DELETE' }); toast('Mesa excluída.', 'ok'); manageTables(); }
  catch (e) { toast(e.message, 'err'); }
}

/* ----------------------------------------------------------------- CLIENTES */
async function renderClientes() {
  const d = await api('/api/customers');
  const el = document.getElementById('content');
  el.innerHTML = `<div class="section-title"><h2>Clientes</h2><span class="muted small">${d.customers.length} cadastrados</span></div>
    <div class="card tight">${d.customers.length ? `<div style="overflow-x:auto"><table class="tbl">
      <thead><tr><th>Cliente</th><th>Telefone</th><th>Reservas</th><th>Última</th><th>Cancel.</th></tr></thead>
      <tbody>${d.customers.map(c => `<tr>
        <td class="cust">${esc(c.name)}</td><td>${esc(c.phone)}</td>
        <td><b>${c.total}</b></td><td>${c.ultima?fmtDate(c.ultima):'—'}</td>
        <td>${c.cancelamentos}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><div class="big">👥</div>Ainda sem clientes. Eles aparecem aqui após a primeira reserva.</div>'}</div>`;
}

/* ----------------------------------------------------------------- HORÁRIOS */
async function renderHorarios() {
  const d = await api('/api/hours');
  const el = document.getElementById('content');
  const editable = can('settings:write');
  el.innerHTML = `
    <div class="section-title"><h2>Horários de funcionamento</h2></div>
    <div class="card"><div class="stack" id="hours">
      ${d.hours.map(h => `<div class="row center between" style="gap:10px;flex-wrap:wrap" data-wd="${h.weekday}">
        <b style="width:90px">${WEEKDAYS[h.weekday]}</b>
        <label class="row center" style="gap:6px;margin:0;width:auto"><input type="checkbox" style="width:auto" class="h-closed" ${h.closed?'checked':''} ${editable?'':'disabled'}> Fechado</label>
        <input type="time" class="h-open" value="${h.open_time}" style="width:auto" ${editable?'':'disabled'}>
        <span>até</span>
        <input type="time" class="h-close" value="${h.close_time}" style="width:auto" ${editable?'':'disabled'}>
      </div>`).join('')}
      ${editable ? '<button class="btn" style="margin-top:8px;width:auto" onclick="saveHours()">Salvar horários</button>' : ''}
    </div></div>

    <div class="section-title" style="margin-top:26px"><h2>Datas bloqueadas</h2></div>
    <div class="card">
      ${editable ? `<form class="row" style="gap:8px;margin-bottom:14px" onsubmit="return addBlocked(event)">
        <input type="date" name="date" required style="width:auto">
        <input name="reason" placeholder="Motivo (feriado, evento...)" class="grow">
        <button class="btn sm">Bloquear</button>
      </form>` : ''}
      <div id="blocked-list">${blockedRows(d.blocked, editable)}</div>
    </div>`;
}
function blockedRows(list, editable) {
  if (!list.length) return '<p class="muted small">Nenhuma data bloqueada.</p>';
  return list.map(b => `<div class="row between center" style="padding:8px 0;border-bottom:1px solid var(--line)">
    <div><b>${fmtDate(b.date)}</b> <span class="tiny">${esc(b.reason||'')}</span></div>
    ${editable ? `<button class="btn danger sm" onclick="delBlocked(${b.id})">Remover</button>` : ''}</div>`).join('');
}
async function saveHours() {
  const hours = [...document.querySelectorAll('#hours [data-wd]')].map(row => ({
    weekday: +row.dataset.wd,
    closed: row.querySelector('.h-closed').checked,
    open_time: row.querySelector('.h-open').value,
    close_time: row.querySelector('.h-close').value,
  }));
  try { await api('/api/hours', { method: 'PUT', body: { hours } }); toast('Horários salvos.', 'ok'); }
  catch (e) { toast(e.message, 'err'); }
}
async function addBlocked(e) {
  e.preventDefault(); const f = new FormData(e.target);
  try { await api('/api/blocked-dates', { method: 'POST', body: { date: f.get('date'), reason: f.get('reason') } }); toast('Data bloqueada.', 'ok'); renderHorarios(); }
  catch (err) { toast(err.message, 'err'); }
}
async function delBlocked(id) {
  try { await api(`/api/blocked-dates/${id}`, { method: 'DELETE' }); toast('Removido.', 'ok'); renderHorarios(); }
  catch (e) { toast(e.message, 'err'); }
}

/* ------------------------------------------------------------- CONFIGURAÇÕES */
async function renderConfig() {
  const d = await api('/api/settings'); const r = d.restaurant;
  const el = document.getElementById('content');
  el.innerHTML = `
    <form id="cfg" onsubmit="return saveConfig(event)">
    <div class="section-title"><h2>Identidade do restaurante</h2><button class="btn sm">Salvar tudo</button></div>
    <div class="card stack">
      <div class="grid-2">
        <div class="field"><label>Nome</label><input name="name" value="${esc(r.name)}"></div>
        <div class="field"><label>Link público (slug)</label><input name="slug" value="${esc(r.slug)}"></div>
      </div>
      <div class="field"><label>Descrição</label><textarea name="description">${esc(r.description)}</textarea></div>
      <div class="grid-2">
        <div class="field"><label>Endereço</label><input name="address" value="${esc(r.address)}"></div>
        <div class="field"><label>Telefone</label><input name="phone" value="${esc(r.phone)}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>WhatsApp (só números)</label><input name="whatsapp" value="${esc(r.whatsapp)}"></div>
        <div class="field"><label>Instagram</label><input name="instagram" value="${esc(r.instagram)}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>URL do logo</label><input name="logo_url" value="${esc(r.logo_url)}" placeholder="https://..."></div>
        <div class="field"><label>URL da capa</label><input name="cover_url" value="${esc(r.cover_url)}" placeholder="https://..."></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Cor principal</label><input type="color" name="primary_color" value="${esc(r.primary_color)}" style="height:46px;padding:4px"></div>
        <div class="field"><label>Informações importantes</label><input name="info" value="${esc(r.info)}"></div>
      </div>
    </div>

    <div class="section-title" style="margin-top:26px"><h2>Regras de reserva</h2></div>
    <div class="card stack">
      <div class="grid-2">
        <div class="field"><label>Abertura</label><input type="time" name="opening_time" value="${r.opening_time}"></div>
        <div class="field"><label>Fechamento</label><input type="time" name="closing_time" value="${r.closing_time}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Duração da reserva (min)</label>
          <select name="slot_minutes">${[60,90,120,150,180].map(v=>`<option value="${v}" ${r.slot_minutes==v?'selected':''}>${v} min</option>`).join('')}</select></div>
        <div class="field"><label>Preparo/limpeza entre reservas (min)</label>
          <select name="prep_minutes">${[0,10,15,20,30].map(v=>`<option value="${v}" ${r.prep_minutes==v?'selected':''}>${v} min</option>`).join('')}</select></div>
      </div>
      <label class="row center" style="gap:8px;margin:0"><input type="checkbox" name="allow_combine" style="width:auto" ${r.allow_combine?'checked':''}> Permitir junção de mesas para grupos grandes</label>
      <div class="grid-2">
        <div class="field"><label>Tolerância de check-in (min)</label><input type="number" name="checkin_tolerance_min" min="0" value="${r.checkin_tolerance_min ?? 15}"></div>
        <div class="field"><label>Marcar "não compareceu" após (min)</label><input type="number" name="noshow_after_min" min="0" value="${r.noshow_after_min ?? 30}"></div>
      </div>
      <div class="field"><label>Lembretes automáticos (horas antes, separadas por vírgula)</label><input name="reminder_hours" value="${esc(r.reminder_hours)}" placeholder="24,2"></div>
    </div>
    </form>`;
}
async function saveConfig(e) {
  e.preventDefault(); const f = new FormData(e.target); const body = Object.fromEntries(f.entries());
  body.allow_combine = f.get('allow_combine') ? 1 : 0;
  body.slot_minutes = +body.slot_minutes; body.prep_minutes = +body.prep_minutes;
  body.checkin_tolerance_min = +body.checkin_tolerance_min; body.noshow_after_min = +body.noshow_after_min;
  try {
    const r = await api('/api/settings', { method: 'PUT', body });
    ME.restaurant.slug = r.restaurant.slug; ME.restaurant.slot_minutes = r.restaurant.slot_minutes;
    document.getElementById('public-link').href = '/r/' + r.restaurant.slug;
    toast('Configurações salvas.', 'ok');
  } catch (err) { toast(err.message, 'err'); }
}

/* ------------------------------------------------------------ PÁGINA PÚBLICA */
async function renderPagina() {
  const url = location.origin + '/r/' + ME.restaurant.slug;
  const el = document.getElementById('content');
  el.innerHTML = `
    <div class="section-title"><h2>Sua página pública</h2></div>
    <div class="card stack" style="text-align:center">
      <p class="muted">Divulgue este link no Instagram, Google, WhatsApp e QR Code:</p>
      <div class="row center" style="gap:8px;justify-content:center;flex-wrap:wrap">
        <input id="pub-url" value="${url}" readonly style="max-width:340px;text-align:center">
        <button class="btn sm" onclick="copyUrl()">Copiar</button>
        <a class="btn ghost sm" target="_blank" href="${url}">Abrir ↗</a>
      </div>
      <div id="qrcode" style="margin:18px auto;width:200px;height:200px"></div>
      <div><button class="btn soft sm" onclick="downloadQR()">⬇ Baixar QR Code (PNG)</button></div>
      <p class="tiny">Cole o QR Code em mesas, balcão, porta, cartões e materiais impressos.</p>
    </div>`;
  new QRCode(document.getElementById('qrcode'), { text: url, width: 200, height: 200, colorDark: '#12161f' });
}
function copyUrl() { const i = document.getElementById('pub-url'); i.select(); navigator.clipboard.writeText(i.value); toast('Link copiado!', 'ok'); }
function downloadQR() {
  const img = document.querySelector('#qrcode img') || document.querySelector('#qrcode canvas');
  const src = img.tagName === 'IMG' ? img.src : img.toDataURL();
  const a = document.createElement('a'); a.href = src; a.download = 'qrcode-' + ME.restaurant.slug + '.png'; a.click();
}

/* ------------------------------------------------------------- NOTIFICAÇÕES */
async function renderNotificacoes() {
  const d = await api('/api/notifications');
  await api('/api/notifications/read', { method: 'POST' }); refreshNotifBadge();
  const el = document.getElementById('content');
  const ic = { nova_reserva:'🟢', reserva_cancelada:'🔴', reserva_alterada:'🟡', reserva_confirmada:'✅', reserva_concluida:'🔵', reserva_noshow:'⚠️' };
  el.innerHTML = `<div class="section-title"><h2>Notificações</h2></div>
    <div class="card tight">${d.notifications.length ? d.notifications.map(n => `
      <div class="row" style="gap:10px;padding:12px 6px;border-bottom:1px solid var(--line);${n.read?'':'background:var(--brand-soft);border-radius:8px'}">
        <div style="font-size:20px">${ic[n.type]||'🔔'}</div>
        <div class="grow"><b>${esc(n.title)}</b><div class="small muted">${esc(n.body)}</div></div>
        <div class="tiny">${esc(n.created_at.slice(5,16))}</div>
      </div>`).join('') : '<div class="empty"><div class="big">🔔</div>Sem notificações ainda.</div>'}</div>`;
}

/* ============================================================ RELATÓRIOS (BI) */
let REL_DAYS = 30;
const REL_PERIODS = [[7, '7 dias'], [30, '30 dias'], [90, 'Trimestral'], [180, 'Semestral'], [365, 'Anual']];
const VIZ_LABEL = { linha: 'Linha', colunas: 'Colunas', barras: 'Barras', pizza: 'Pizza' };
const VIZ_ICON = { linha: '📈', colunas: '📊', barras: '📶', pizza: '🥧' };
const REL_PALETTE = ['#E0352B', '#3574d4', '#1f9d6b', '#b8860b', '#7a5bd4', '#d44f9e', '#2bb3c0', '#e07b39', '#6b7280', '#9d1f6b'];
let REL = { tab: 'explorar', catalog: null, indicator: null, days: 30, viz: null };

function relPeriod(d) { REL.days = d; REL_DAYS = d; relRenderViewer(); }
function relFmt(v, unidade) {
  if (unidade === 'moeda') return brl(Math.round(v * 100));
  if (unidade === 'min') return v + ' min';
  return String(v);
}
// Recomendação no cliente (mesma regra do servidor — estrutura escalável)
function relRecommend(meta, shape) {
  const n = shape.n || 0;
  if (meta.serie_temporal) return meta.recomendada === 'colunas' ? 'colunas' : 'linha';
  if (meta.percentual) return n > 6 ? 'barras' : 'pizza';
  if (meta.ranking) return 'barras';
  return meta.recomendada || 'colunas';
}
function relWarning(meta, chosen, shape) {
  const n = shape.n || 0;
  if (chosen === 'pizza' && meta.serie_temporal) return 'Para evolução no tempo, linha ou colunas representam melhor do que pizza.';
  if (chosen === 'pizza' && n > 6) return 'Para muitas categorias, barras facilitam a leitura do que a pizza.';
  if (chosen === 'linha' && !meta.serie_temporal && (meta.ranking || meta.percentual)) return 'Para comparar categorias, barras ou colunas facilitam a comparação entre os valores.';
  if (chosen === 'barras' && meta.serie_temporal) return 'Para evolução no tempo, linha costuma representar melhor a tendência.';
  return '';
}

async function renderRelatorios() {
  const el = document.getElementById('content');
  if (!REL.catalog) { try { REL.catalog = (await api('/api/reports/catalog')).indicators; } catch (e) { el.innerHTML = `<div class="empty">${e.message}</div>`; return; } }
  if (!REL.indicator) REL.indicator = REL.catalog[0].id;
  let saved = []; try { saved = (await api('/api/reports/saved')).reports; } catch {}
  el.innerHTML = `
    <div class="section-title"><h2>Relatórios</h2>
      <button class="btn sm" onclick="relBuilder()">+ Criar relatório</button></div>
    <div class="chips" style="margin-bottom:14px">
      <button class="chip ${REL.tab === 'explorar' ? 'active' : ''}" onclick="relTab('explorar')">Explorar indicadores</button>
      <button class="chip ${REL.tab === 'salvos' ? 'active' : ''}" onclick="relTab('salvos')">Meus relatórios ${saved.length ? `<span class="pill">${saved.length}</span>` : ''}</button>
    </div>
    <div id="rel-body"></div>`;
  if (REL.tab === 'explorar') relRenderExplorar();
  else relRenderSalvos(saved);
}
function relTab(t) { REL.tab = t; renderRelatorios(); }

function relRenderExplorar() {
  const grupos = {};
  for (const ind of REL.catalog) { (grupos[ind.grupo] = grupos[ind.grupo] || []).push(ind); }
  document.getElementById('rel-body').innerHTML = `
    <div id="rel-viewer"></div>
    <div class="card" style="margin-top:16px">
      <h3 style="margin-top:0">Indicadores</h3>
      ${Object.entries(grupos).map(([g, inds]) => `
        <div style="margin-bottom:12px"><div class="tiny" style="font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">${esc(g)}</div>
        <div class="chips" style="flex-wrap:wrap">${inds.map(i => `<button class="chip ${REL.indicator === i.id ? 'active' : ''}" onclick="relPick('${i.id}')">${esc(i.nome)}</button>`).join('')}</div></div>`).join('')}
    </div>`;
  relRenderViewer();
}
function relPick(id) { REL.indicator = id; REL.viz = null; relRenderExplorarHighlight(); relRenderViewer(); }
function relRenderExplorarHighlight() {
  document.querySelectorAll('#rel-body .chip').forEach(c => { const on = c.getAttribute('onclick') === `relPick('${REL.indicator}')`; c.classList.toggle('active', on); });
}
async function relRenderViewer() {
  const host = document.getElementById('rel-viewer'); if (!host) return;
  host.innerHTML = '<div class="card"><div class="spinner"></div></div>';
  let d; try { d = await api(`/api/reports/data?indicator=${REL.indicator}&days=${REL.days}`); } catch (e) { host.innerHTML = `<div class="card"><div class="empty">${e.message}</div></div>`; return; }
  const viz = REL.viz || d.recomendada;
  const isRec = viz === d.recomendada;
  const warn = relWarning(d.meta, viz, d.shape);
  const vizBtns = (d.meta.alternativas || ['linha', 'colunas', 'barras', 'pizza']).map(v =>
    `<button class="viz-btn ${viz === v ? 'active' : ''}" onclick="relSetViz('${v}')">${VIZ_ICON[v]} ${VIZ_LABEL[v]}${v === d.recomendada ? ' ★' : ''}</button>`).join('');
  host.innerHTML = `
    <div class="card">
      <div class="row between center" style="flex-wrap:wrap;gap:8px">
        <div><h3 style="margin:0">${esc(d.meta.nome)}</h3><div class="tiny">${esc(d.meta.descricao)}</div></div>
        <div class="kpi-big">${relFmt(d.kpi, d.unidade)}<span class="tiny" style="display:block;font-weight:600">${esc(d.kpi_label)}</span></div>
      </div>
      <div class="chips" style="margin:12px 0 6px">${REL_PERIODS.map(([v, l]) => `<button class="chip ${REL.days === v ? 'active' : ''}" onclick="relPeriod(${v})">${l}</button>`).join('')}</div>
      <div class="rel-chart"><canvas id="rel-canvas"></canvas></div>
      <div class="row between center" style="flex-wrap:wrap;gap:10px;margin-top:12px">
        <div>
          <div class="tiny" style="margin-bottom:5px">${isRec ? '✓ Visualização recomendada' : 'Alterar visualização'}</div>
          <div class="viz-row">${vizBtns}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn ghost sm" onclick="relSaveCurrent(0)">Salvar</button>
          <button class="btn sm" onclick="relSaveCurrent(1)">+ Dashboard</button>
        </div>
      </div>
      ${warn ? `<div class="viz-warn">⚠️ ${warn}</div>` : ''}
    </div>`;
  relDrawChart('rel-canvas', viz, d);
}
function relSetViz(v) { REL.viz = v; relRenderViewer(); }
async function relSaveCurrent(dash) {
  const d = REL.catalog.find(i => i.id === REL.indicator);
  try {
    await api('/api/reports/saved', { method: 'POST', body: { nome: d.nome, indicator: REL.indicator, days: REL.days, chart_type: REL.viz || '', on_dashboard: dash } });
    toast(dash ? 'Adicionado ao Dashboard.' : 'Relatório salvo.', 'ok');
  } catch (e) { toast(e.message, 'err'); }
}

// Desenha o gráfico conforme o tipo (linha/colunas/barras/pizza)
function relDrawChart(canvasId, viz, d) {
  const cv = document.getElementById(canvasId); if (!cv) return;
  const chartType = viz === 'pizza' ? 'pie' : viz === 'linha' ? 'line' : 'bar';
  const horizontal = viz === 'barras';
  const total = d.values.reduce((a, b) => a + b, 0) || 1;
  const fmt = (v) => relFmt(v, d.unidade);
  let ds;
  if (viz === 'pizza') {
    ds = [{ data: d.values, backgroundColor: d.labels.map((_, i) => REL_PALETTE[i % REL_PALETTE.length]), borderWidth: 2, borderColor: 'rgba(0,0,0,.15)' }];
  } else if (viz === 'linha') {
    ds = [{ data: d.values, borderColor: '#E0352B', backgroundColor: 'rgba(224,53,43,.12)', fill: true, tension: .35, pointRadius: d.values.length > 45 ? 0 : 2, borderWidth: 2 }];
  } else {
    const single = !d.meta.percentual && d.meta.dimensao === 'tempo';
    ds = [{ data: d.values, backgroundColor: single ? '#E0352B' : d.labels.map((_, i) => REL_PALETTE[i % REL_PALETTE.length]), borderRadius: 6, maxBarThickness: 46 }];
  }
  const isPie = viz === 'pizza';
  const opts = {
    responsive: true, maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: { display: isPie, position: 'right', labels: { color: getComputedStyle(document.body).color, boxWidth: 12, font: { size: 11 } } },
      tooltip: { callbacks: { label: (ctx) => { const v = ctx.parsed.y ?? ctx.parsed.x ?? ctx.parsed; const val = isPie ? ctx.parsed : v; const pct = isPie ? ` (${Math.round(val / total * 100)}%)` : ''; return `${isPie ? ctx.label + ': ' : ''}${fmt(val)}${pct}`; } } },
    },
    scales: isPie ? {} : {
      x: { ticks: { color: getComputedStyle(document.body).color, maxRotation: 60, autoSkip: true, font: { size: 10 } }, grid: { display: !horizontal, color: 'rgba(128,128,128,.12)' } },
      y: { beginAtZero: true, ticks: { color: getComputedStyle(document.body).color, precision: 0, font: { size: 10 }, callback: (v) => d.unidade === 'moeda' ? 'R$' + v : v }, grid: { display: horizontal, color: 'rgba(128,128,128,.12)' } },
    },
  };
  chartRefs.push(new Chart(cv, { type: chartType, data: { labels: d.labels, datasets: ds }, options: opts }));
}

/* ---- Meus relatórios (salvos) ---- */
function relRenderSalvos(saved) {
  const body = document.getElementById('rel-body');
  if (!saved.length) { body.innerHTML = '<div class="card"><div class="empty">Nenhum relatório salvo ainda.<br>Explore um indicador e clique em <b>Salvar</b> ou <b>+ Dashboard</b>.</div></div>'; return; }
  body.innerHTML = `<div class="rel-saved-grid">${saved.map((s, i) => `
    <div class="card tight" data-sid="${s.id}">
      <div class="row between center">
        <b>${esc(s.nome)}</b>
        <div style="display:flex;gap:3px">
          <button class="iconbtn" title="Subir" onclick="relMove(${s.id},-1)" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="iconbtn" title="Descer" onclick="relMove(${s.id},1)" ${i === saved.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
      </div>
      <div class="tiny">${esc((REL.catalog.find(c => c.id === s.indicator) || {}).grupo || '')} · ${s.range_days} dias${s.chart_type ? ' · ' + VIZ_LABEL[s.chart_type] : ' · recomendado'}</div>
      <div class="rel-chart sm"><canvas id="saved-${s.id}"></canvas></div>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">
        <button class="btn ghost sm" onclick="relEditSaved(${s.id})">Editar</button>
        <button class="btn ghost sm" onclick="relDupSaved(${s.id})">Duplicar</button>
        <button class="btn ${s.on_dashboard ? '' : 'ghost'} sm" onclick="relToggleDash(${s.id},${s.on_dashboard ? 0 : 1})">${s.on_dashboard ? '✓ No Dashboard' : '+ Dashboard'}</button>
        <button class="btn danger sm" onclick="relDelSaved(${s.id})">Excluir</button>
      </div>
    </div>`).join('')}</div>`;
  for (const s of saved) relDrawSaved(s);
}
async function relDrawSaved(s) {
  try {
    const d = await api(`/api/reports/data?indicator=${s.indicator}&days=${s.range_days}`);
    relDrawChart('saved-' + s.id, s.chart_type || d.recomendada, d);
  } catch {}
}
async function relMove(id, dir) {
  const saved = (await api('/api/reports/saved')).reports;
  const idx = saved.findIndex(s => s.id === id); const j = idx + dir;
  if (j < 0 || j >= saved.length) return;
  const ids = saved.map(s => s.id); [ids[idx], ids[j]] = [ids[j], ids[idx]];
  await api('/api/reports/saved/reorder', { method: 'POST', body: { ids } });
  renderRelatorios();
}
async function relDupSaved(id) { try { await api(`/api/reports/saved/${id}/duplicate`, { method: 'POST' }); toast('Duplicado.', 'ok'); renderRelatorios(); } catch (e) { toast(e.message, 'err'); } }
async function relDelSaved(id) { if (!confirm('Excluir este relatório?')) return; try { await api(`/api/reports/saved/${id}`, { method: 'DELETE' }); toast('Excluído.', 'ok'); renderRelatorios(); } catch (e) { toast(e.message, 'err'); } }
async function relToggleDash(id, on) { try { await api(`/api/reports/saved/${id}`, { method: 'PATCH', body: { on_dashboard: on } }); toast(on ? 'Adicionado ao Dashboard.' : 'Removido do Dashboard.', 'ok'); renderRelatorios(); } catch (e) { toast(e.message, 'err'); } }
function relEditSaved(id) {
  api('/api/reports/saved').then(({ reports }) => {
    const s = reports.find(x => x.id === id); if (!s) return;
    openModal(`<h3>Editar relatório</h3>
      <div class="field"><label>Nome</label><input id="er-nome" value="${esc(s.nome)}"></div>
      <div class="field"><label>Período</label><select id="er-days">${REL_PERIODS.map(([v, l]) => `<option value="${v}" ${s.range_days === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Visualização</label><select id="er-viz"><option value="">Recomendada</option>${['linha', 'colunas', 'barras', 'pizza'].map(v => `<option value="${v}" ${s.chart_type === v ? 'selected' : ''}>${VIZ_LABEL[v]}</option>`).join('')}</select></div>
      <button class="btn block" onclick="relSaveEdit(${id})">Salvar alterações</button>`);
  });
}
async function relSaveEdit(id) {
  const g = (x) => document.getElementById(x).value;
  try { await api(`/api/reports/saved/${id}`, { method: 'PATCH', body: { nome: g('er-nome'), days: g('er-days'), chart_type: g('er-viz') } }); toast('Salvo.', 'ok'); closeModal(); renderRelatorios(); } catch (e) { toast(e.message, 'err'); }
}

/* ---- Criar relatório (builder) ---- */
function relBuilder() {
  const grupos = {};
  for (const ind of REL.catalog) { (grupos[ind.grupo] = grupos[ind.grupo] || []).push(ind); }
  openModal(`<h3>Criar relatório</h3>
    <div class="field"><label>Indicador</label><select id="b-ind" onchange="relBuilderSuggest()">
      ${Object.entries(grupos).map(([g, inds]) => `<optgroup label="${esc(g)}">${inds.map(i => `<option value="${i.id}">${esc(i.nome)}</option>`).join('')}</optgroup>`).join('')}
    </select></div>
    <div class="field"><label>Período</label><select id="b-days">${REL_PERIODS.map(([v, l]) => `<option value="${v}" ${v === 30 ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label>Visualização</label><select id="b-viz"><option value="">Recomendada (automática)</option>${['linha', 'colunas', 'barras', 'pizza'].map(v => `<option value="${v}">${VIZ_LABEL[v]}</option>`).join('')}</select></div>
    <div class="field"><label>Nome do relatório</label><input id="b-nome" placeholder="(usa o nome do indicador)"></div>
    <div id="b-suggest" class="viz-rec" style="margin-bottom:12px"></div>
    <div style="display:flex;gap:8px"><button class="btn block" onclick="relCreate(0)">Salvar</button><button class="btn ghost block" onclick="relCreate(1)">Salvar no Dashboard</button></div>`);
  relBuilderSuggest();
}
function relBuilderSuggest() {
  const id = document.getElementById('b-ind').value;
  const meta = REL.catalog.find(i => i.id === id);
  if (!meta) return;
  const rec = relRecommend(meta, { n: meta.dimensao === 'tempo' ? 30 : 5 });
  document.getElementById('b-suggest').innerHTML = `💡 Visualização recomendada: <b>${VIZ_LABEL[rec]}</b> — ${esc(meta.descricao)}`;
}
async function relCreate(dash) {
  const g = (x) => document.getElementById(x).value;
  const id = g('b-ind');
  try { await api('/api/reports/saved', { method: 'POST', body: { indicator: id, days: g('b-days'), chart_type: g('b-viz'), nome: g('b-nome') || undefined, on_dashboard: dash } }); toast('Relatório criado.', 'ok'); closeModal(); REL.tab = 'salvos'; renderRelatorios(); } catch (e) { toast(e.message, 'err'); }
}
/* (renderRelatorios e chartOpts antigos substituídos pelo módulo de BI acima) */

/* --------------------------------------------------------------- FUNCIONÁRIOS */
let STAFF = { roles: [], labels: {} };
async function renderUsuarios() {
  const d = await api('/api/users');
  STAFF = { roles: d.roles || [], labels: d.roleLabels || {} };
  const s = d.stats || {};
  const el = document.getElementById('content');
  const lbl = (r) => STAFF.labels[r] || r;
  el.innerHTML = `
    <div class="section-title"><h2>Funcionários / Equipe</h2><button class="btn sm" onclick="userModal()" ${s.limite && s.disponiveis<=0?'disabled title="Limite do plano atingido"':''}>+ Novo funcionário</button></div>
    <div class="stats" style="margin-bottom:16px">
      <div class="stat accent"><div class="label">Ativos</div><div class="value">${s.ativos||0}</div></div>
      <div class="stat"><div class="label">Inativos</div><div class="value">${s.inativos||0}</div></div>
      <div class="stat"><div class="label">Total cadastrados</div><div class="value">${s.total||0}</div></div>
      <div class="stat"><div class="label">Plano permite</div><div class="value">${s.limite||'—'}</div><div class="sub">${s.disponiveis||0} disponíveis</div></div>
    </div>
    ${s.limite && s.disponiveis<=0 ? '<div class="viz-warn" style="margin-bottom:12px">⚠️ Limite de funcionários do plano atingido. Desative um funcionário ou peça upgrade de plano à VEXXA360.</div>' : ''}
    <div class="card tight"><div style="overflow-x:auto"><table class="tbl">
      <thead><tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Status</th><th>Criado</th><th>Último acesso</th><th></th></tr></thead>
      <tbody>${d.users.map(u => `<tr>
        <td class="cust">${esc(u.name)}${u.unit_scope==='all'?' <span class="badge mut" style="font-size:9px">todas unidades</span>':''}</td><td class="small">${esc(u.email)}</td>
        <td>${esc(lbl(u.role))}</td>
        <td>${u.active?'<span class="badge ok">Ativo</span>':'<span class="badge mut">Inativo</span>'}</td>
        <td class="tiny">${esc((u.created_at||'').slice(0,10))}</td>
        <td class="tiny">${u.last_login?esc(u.last_login.slice(0,16)):'—'}</td>
        <td class="right">${u.id!==ME.user.id?`<button class="btn ghost sm" onclick="userEdit(${u.id},'${u.role}',${u.active},'${u.unit_scope||''}')">✎</button> <button class="btn danger sm" onclick="userDel(${u.id})">🗑</button>`:'<span class="tiny">você</span>'}</td>
      </tr>`).join('')}</tbody></table></div></div>
    <p class="tiny" style="color:var(--ink-3);margin-top:10px">Cada funcionário tem conta própria, cargo e permissões. Todos pertencem a este cliente (tenant) — nunca cruzam com outros restaurantes.</p>`;
}
function roleOptions(sel) { return (STAFF.roles.length?STAFF.roles:['owner','manager','reception','caixa','waiter','cozinha','bar','estoque']).map(r=>`<option value="${r}" ${r===sel?'selected':''}>${esc(STAFF.labels[r]||r)}</option>`).join(''); }
function userModal() {
  const multi = (ME.units||[]).length>1;
  openModal(`<h3>Novo funcionário</h3>
    <form class="stack" onsubmit="return userCreate(event)">
      <div class="field"><label>Nome</label><input name="name" required></div>
      <div class="field"><label>E-mail (login)</label><input type="email" name="email" required></div>
      <div class="field"><label>Senha</label><input type="password" name="password" required minlength="6"></div>
      <div class="field"><label>Cargo</label><select name="role">${roleOptions('waiter')}</select></div>
      ${multi?`<label class="row center" style="gap:8px;margin:0"><input type="checkbox" name="unit_scope" style="width:auto"> Acessa todas as unidades do cliente</label>`:''}
      <button class="btn block">Criar funcionário</button>
    </form>`);
}
async function userCreate(e) {
  e.preventDefault(); const f = new FormData(e.target);
  const body = { name: f.get('name'), email: f.get('email'), password: f.get('password'), role: f.get('role'), unit_scope: f.get('unit_scope') ? 'all' : '' };
  try { await api('/api/users', { method: 'POST', body }); toast('Funcionário criado.', 'ok'); closeModal(); renderUsuarios(); }
  catch (err) { toast(err.message, 'err'); }
}
function userEdit(id, role, active, scope) {
  const multi = (ME.units||[]).length>1;
  openModal(`<h3>Editar funcionário</h3>
    <form class="stack" onsubmit="return userUpdate(event, ${id})">
      <div class="field"><label>Cargo</label><select name="role">${roleOptions(role)}</select></div>
      <label class="row center" style="gap:8px;margin:0"><input type="checkbox" name="active" style="width:auto" ${active?'checked':''}> Ativo</label>
      ${multi?`<label class="row center" style="gap:8px;margin:6px 0 0"><input type="checkbox" name="unit_scope" style="width:auto" ${scope==='all'?'checked':''}> Acessa todas as unidades</label>`:''}
      <div class="field"><label>Nova senha (opcional)</label><input type="password" name="password" minlength="6"></div>
      <button class="btn block">Salvar</button>
    </form>`);
}
async function userUpdate(e, id) {
  e.preventDefault(); const f = new FormData(e.target);
  const body = { role: f.get('role'), active: f.get('active') ? 1 : 0, unit_scope: f.get('unit_scope') ? 'all' : '' };
  if (f.get('password')) body.password = f.get('password');
  try { await api(`/api/users/${id}`, { method: 'PATCH', body }); toast('Atualizado.', 'ok'); closeModal(); renderUsuarios(); }
  catch (err) { toast(err.message, 'err'); }
}
async function userDel(id) {
  if (!confirm('Remover este funcionário?')) return;
  try { await api(`/api/users/${id}`, { method: 'DELETE' }); toast('Removido.', 'ok'); renderUsuarios(); }
  catch (e) { toast(e.message, 'err'); }
}

/* ------------------------------------------------------------- INTEGRAÇÕES */
/* ===================================================== CENTRAL DE INTEGRAÇÕES */
const PLAT_LOGO = {
  ifood: `<img src="/img/logos/ifood.svg" alt="iFood">`,
  pix: `<img src="/img/logos/pix.svg" alt="PIX">`,
  keeta: `<div class="plat-badge" style="background:#FFCC00;color:#111">K</div>`,
  '99': `<div class="plat-badge" style="background:#FFD100;color:#111">99</div>`,
};
const INT_ST = { conectado: ['ok', 'Conectado'], desconectado: ['mut', 'Desconectado'], erro: ['danger', 'Erro'], pendente: ['warn', 'Pendente'] };
let INT_CACHE = null;
async function renderIntegracoes() {
  const el = document.getElementById('content');
  let d, orders = { orders: [] }, logs = { logs: [] };
  try { d = await api('/api/integrations'); INT_CACHE = d; } catch (e) { el.innerHTML = `<div class="empty">${e.message}</div>`; return; }
  try { orders = await api('/api/integrations/orders'); } catch {}
  try { logs = await api('/api/integrations/logs'); } catch {}
  const wurl = `${d.webhook_base}/<plataforma>/${d.webhook_token}`;
  el.innerHTML = `
    <div class="section-title"><h2>Central de Integrações</h2></div>
    <p class="muted" style="margin:-6px 0 16px">O Rango é o centro da operação: marketplaces, PIX e pedidos próprios em um só lugar. Conectores dependem de habilitação/credenciais oficiais de cada plataforma.</p>
    <div class="int-grid">
      ${d.integrations.map(i => integCard(i)).join('')}
      <div class="int-card"><div class="row between center"><div class="integ-logo"><img src="/img/logos/whatsapp.svg"></div><span class="badge ok" style="font-size:10px">Ativo (link)</span></div>
        <div class="int-name">WhatsApp</div><div class="tiny">Confirmação, lembrete e cancelamento geram texto + link wa.me.</div></div>
    </div>

    <div class="card" style="margin-top:18px">
      <h3 style="margin-top:0">🔗 Endereço de Webhook</h3>
      <p class="tiny">Cole este endereço no painel oficial de cada plataforma (trocando <b>&lt;plataforma&gt;</b> por <b>ifood</b> ou <b>pix</b>). O token autentica o seu restaurante — não compartilhe.</p>
      <div class="row" style="gap:8px"><input id="wh-url" value="${esc(wurl)}" readonly onclick="this.select()" style="flex:1"><button class="btn sm" onclick="navigator.clipboard.writeText(document.getElementById('wh-url').value);toast('Copiado.','ok')">Copiar</button></div>
    </div>

    <div class="section-title" style="margin-top:22px"><h2>Pedidos recebidos (canais)</h2></div>
    <div class="card tight"><div style="overflow-x:auto"><table class="tbl">
      <thead><tr><th>Canal</th><th>Pedido externo</th><th>Comanda</th><th>Status</th><th>Valor</th><th>Cliente</th><th>Quando</th></tr></thead>
      <tbody>${(orders.orders || []).map(o => `<tr>
        <td>${esc((o.platform || '').toUpperCase())}</td><td class="tiny">${esc(o.external_order_id)}</td>
        <td>${o.internal_comanda_id ? '#' + o.internal_comanda_id : '—'}</td><td><span class="badge mut">${esc(o.internal_status)}</span></td>
        <td>${brl(o.total_cents)}</td><td class="small">${esc(o.customer_name || '—')}</td><td class="tiny">${esc((o.created_at || '').slice(5, 16))}</td>
      </tr>`).join('') || '<tr><td colspan="7" class="muted">Nenhum pedido externo ainda. Conecte um marketplace para recebê-los aqui.</td></tr>'}</tbody></table></div></div>

    <div class="section-title" style="margin-top:22px"><h2>Logs das integrações</h2>
      <button class="btn ghost sm" onclick="integRetry()">Reprocessar falhas</button></div>
    <div class="card tight"><div style="overflow-x:auto"><table class="tbl">
      <thead><tr><th>Quando</th><th>Plataforma</th><th>Evento</th><th>Detalhe</th></tr></thead>
      <tbody>${(logs.logs || []).map(l => `<tr><td class="tiny">${esc((l.created_at || '').slice(5, 16))}</td><td>${esc(l.platform || '—')}</td><td>${esc(l.event)}</td><td class="small" style="color:${l.level === 'error' ? 'var(--danger)' : l.level === 'warn' ? 'var(--warn)' : 'inherit'}">${esc(l.detail)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sem registros.</td></tr>'}</tbody></table></div></div>`;
}
function integCard(i) {
  const [cls, lbl] = INT_ST[i.status] || ['mut', i.status];
  const logo = PLAT_LOGO[i.platform] || `<div class="plat-badge" style="background:${i.color};color:#fff">${esc(i.name[0])}</div>`;
  return `<div class="int-card">
    <div class="row between center"><div class="integ-logo">${logo}</div><span class="badge ${cls}" style="font-size:10px">${lbl}</span></div>
    <div class="int-name">${esc(i.name)}${i.official ? '' : ' <span class="tiny" style="color:var(--ink-3)">· preparado</span>'}</div>
    ${i.store_name ? `<div class="tiny">Conta: ${esc(i.store_name)}</div>` : ''}
    ${i.last_sync ? `<div class="tiny">Última sinc.: ${esc(i.last_sync.slice(5, 16))}</div>` : ''}
    ${i.last_error ? `<div class="tiny" style="color:var(--danger)">${esc(i.last_error)}</div>` : ''}
    <div class="tiny" style="margin:6px 0;color:var(--ink-3)">${esc(i.note || '')}</div>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">
      <button class="btn sm" onclick="integConfig('${i.platform}')">${i.has_credentials ? 'Configurar' : 'Conectar'}</button>
      <button class="btn ghost sm" onclick="integTest('${i.platform}')">Testar</button>
      ${i.status !== 'desconectado' ? `<button class="btn ghost sm" onclick="integDisconnect('${i.platform}')">Desconectar</button>` : ''}
    </div></div>`;
}
function integConfig(platform) {
  const i = INT_CACHE.integrations.find(x => x.platform === platform); if (!i) return;
  const fields = (i.credentials_meta || []).map(c => {
    if (c.options) return `<div class="field"><label>${esc(c.label)}</label><select id="ic-${c.key}">${c.options.map(o => `<option value="${o}">${o}</option>`).join('')}</select></div>`;
    return `<div class="field"><label>${esc(c.label)}</label><input id="ic-${c.key}" type="${c.secret ? 'password' : 'text'}" placeholder="${c.secret && i.has_credentials ? '•••••• (manter atual)' : ''}" autocomplete="off"></div>`;
  }).join('');
  openModal(`<h3>${PLAT_LOGO[platform] ? '' : ''}Conectar ${esc(i.name)}</h3>
    <p class="tiny" style="margin-top:2px">${esc(i.note || '')}</p>
    ${fields}
    <p class="tiny" style="color:var(--ink-3)">🔒 As credenciais são criptografadas e nunca exibidas novamente.</p>
    <div style="display:flex;gap:8px"><button class="btn block" onclick="integSave('${platform}')">Salvar</button><button class="btn ghost block" onclick="integSave('${platform}',true)">Salvar e testar</button></div>`);
}
async function integSave(platform, test) {
  const i = INT_CACHE.integrations.find(x => x.platform === platform);
  const body = {};
  for (const c of (i.credentials_meta || [])) { const el = document.getElementById('ic-' + c.key); if (el && el.value !== '') body[c.key] = el.value; }
  try {
    await api(`/api/integrations/${platform}/credentials`, { method: 'POST', body });
    if (test) { const r = await api(`/api/integrations/${platform}/test`, { method: 'POST' }); toast(r.ok ? `Conectado${r.store ? ' · ' + r.store : ''}.` : (r.message || 'Não conectou.'), r.ok ? 'ok' : 'err'); }
    else toast('Credenciais salvas.', 'ok');
    closeModal(); renderIntegracoes();
  } catch (e) { toast(e.message, 'err'); }
}
async function integTest(platform) {
  toast('Testando…');
  try { const r = await api(`/api/integrations/${platform}/test`, { method: 'POST' }); toast(r.ok ? `Conectado${r.store ? ' · ' + r.store : ''}.` : (r.message || 'Não foi possível conectar.'), r.ok ? 'ok' : 'err'); renderIntegracoes(); }
  catch (e) { toast(e.message, 'err'); }
}
async function integDisconnect(platform) {
  if (!confirm('Desconectar esta integração?')) return;
  try { await api(`/api/integrations/${platform}/disconnect`, { method: 'POST' }); toast('Desconectado.', 'ok'); renderIntegracoes(); } catch (e) { toast(e.message, 'err'); }
}
async function integRetry() { try { const r = await api('/api/integrations/retry', { method: 'POST', body: {} }); toast(`Reprocessados: ${r.reprocessados}, falharam: ${r.falharam}.`, 'ok'); renderIntegracoes(); } catch (e) { toast(e.message, 'err'); } }

/* ===================================================== FINANCEIRO (conciliação) */
let FIN_DAYS = 30;
const CANAL_LABEL = { GARCOM: 'Garçom', QR_CODE: 'QR Code / Mesa', ATENDIMENTO_INTERNO: 'Balcão', BALCAO: 'Balcão', RANGO: 'Rango', IFOOD: 'iFood', KEETA: 'Keeta', NINETYNINE: '99' };
function finPeriod(d) { FIN_DAYS = d; renderFinanceiro(); }
async function renderFinanceiro() {
  const el = document.getElementById('content');
  let d; try { d = await api('/api/finance/transactions?days=' + FIN_DAYS); } catch (e) { el.innerHTML = `<div class="empty">${e.message}</div>`; return; }
  const t = d.totais;
  const FORMA = { pix: 'PIX', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', marketplace: 'Marketplace', outro: 'Outro' };
  el.innerHTML = `
    <div class="section-title"><h2>Financeiro · Transações</h2></div>
    <div class="chips" style="margin-bottom:16px">${REL_PERIODS.map(([v, l]) => `<button class="chip ${FIN_DAYS === v ? 'active' : ''}" onclick="finPeriod(${v})">${l}</button>`).join('')}</div>
    <div class="stats" style="margin-bottom:18px">
      <div class="stat accent"><div class="label">Valor bruto</div><div class="value">${brl(t.bruto)}</div></div>
      <div class="stat"><div class="label">Taxas</div><div class="value" style="color:var(--danger)">− ${brl(t.taxa)}</div></div>
      <div class="stat"><div class="label">Valor líquido</div><div class="value" style="color:var(--ok)">${brl(t.liquido)}</div></div>
    </div>
    <div class="section-title"><h2>Por canal</h2></div>
    <div class="card tight" style="margin-bottom:18px"><div style="overflow-x:auto"><table class="tbl">
      <thead><tr><th>Canal</th><th>Transações</th><th>Bruto</th><th>Taxas</th><th>Líquido</th></tr></thead>
      <tbody>${(d.por_canal || []).sort((a, b) => b.bruto - a.bruto).map(c => `<tr>
        <td><b>${esc(CANAL_LABEL[c.origem] || c.origem)}</b></td><td>${c.n}</td><td>${brl(c.bruto)}</td>
        <td style="color:var(--danger)">${c.taxa ? '− ' + brl(c.taxa) : '—'}</td><td style="color:var(--ok)">${brl(c.liquido)}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="muted">Sem transações no período.</td></tr>'}</tbody></table></div></div>
    <div class="section-title"><h2>Transações</h2></div>
    <div class="card tight"><div style="overflow-x:auto"><table class="tbl">
      <thead><tr><th>Data</th><th>Canal</th><th>Forma</th><th>Bruto</th><th>Taxa</th><th>Líquido</th><th>ID transação</th><th>Status</th></tr></thead>
      <tbody>${(d.transacoes || []).map(x => `<tr>
        <td class="tiny">${esc((x.created_at || '').slice(5, 16))}</td><td>${esc(CANAL_LABEL[x.origem] || x.origem)}</td>
        <td>${esc(FORMA[x.forma] || x.forma)}${x.provider ? `<div class="tiny">${esc(x.provider)}</div>` : ''}</td>
        <td>${brl(x.bruto_cents)}</td><td>${x.taxa_cents ? brl(x.taxa_cents) : '—'}</td><td>${brl(x.liquido_cents)}</td>
        <td class="tiny">${esc((x.external_txn_id || '—').slice(0, 18))}</td><td><span class="badge ok">${esc(x.status)}</span></td>
      </tr>`).join('') || '<tr><td colspan="8" class="muted">Sem transações.</td></tr>'}</tbody></table></div></div>`;
}

// Se a sessão expirar/for invalidada durante o uso, volta para o login em vez
// de deixar a tela quebrada com erros 401.
/* ============================================================================
   ATENDIMENTO — Comandas · Pedidos · Pagamento manual   (seções do briefing)
   ============================================================================ */
function brl(cents) { return 'R$ ' + (Number(cents || 0) / 100).toFixed(2).replace('.', ','); }
const FIN_META = {
  em_aberto:   ['warn', 'Em aberto'],
  pago_parcial:['info', 'Pagamento parcial'],
  paga:        ['ok', 'Paga'],
};
function finBadge(s) { const [c, l] = FIN_META[s] || ['mut', s]; return `<span class="badge ${c}">${l}</span>`; }

let ATEND = { view: 'list', comandaId: null, cart: [] };
let MENU_CACHE = null;

async function loadMenu(force) {
  if (MENU_CACHE && !force) return MENU_CACHE;
  const d = await api('/api/menu');
  MENU_CACHE = d.categories;
  return MENU_CACHE;
}

async function renderAtendimento(silent) {
  if (ATEND.view === 'comanda') return renderComandaView(silent);
  if (ATEND.view === 'menu') return renderMenuPicker(silent);
  const el = document.getElementById('content');
  if (!silent) el.innerHTML = '<div class="spinner"></div>';
  const d = await api('/api/comandas');
  const cards = d.comandas.map(c => `
    <div class="card tight" style="cursor:pointer" onclick="openComanda(${c.id})">
      <div class="row between center">
        <div><b>${esc(c.mesas || 'Mesa —')}</b> <span class="tiny">Comanda #${String(c.numero).padStart(5,'0')}</span></div>
        ${finBadge(c.status_financeiro)}
      </div>
      <div class="row between center" style="margin-top:6px">
        <span class="tiny">👤 ${esc(c.responsavel_nome || '—')}</span>
        <span><b>${brl(c.total_consumido_cents)}</b>${c.saldo_cents>0&&c.total_pago_cents>0?` <span class="tiny">· falta ${brl(c.saldo_cents)}</span>`:''}</span>
      </div>
    </div>`).join('');
  el.innerHTML = `
    <div class="section-title"><h2>Atendimento</h2>
      ${can('orders:write') ? '<button class="btn sm" onclick="abrirComandaMesaLivre()">+ Abrir comanda</button>' : ''}
    </div>
    ${d.comandas.length ? `<div class="stack">${cards}</div>` : '<div class="empty"><div class="big">🧾</div>Nenhuma comanda aberta. Abra uma comanda numa mesa para começar os pedidos.</div>'}`;
}

// Abrir comanda escolhendo uma mesa livre
async function abrirComandaMesaLivre() {
  const [ov, ar] = await Promise.all([api('/api/ops/overview'), api('/api/areas')]);
  const areas = ar.areas.filter(a => a.active);
  const floors = {};
  await Promise.all(areas.map(async a => { floors[a.id] = (await api('/api/ops/floor?area=' + a.id)).tables; }));
  const livres = [];
  for (const a of areas) for (const t of (floors[a.id]||[])) if (t.status === 'disponivel') livres.push({ ...t, areaName: a.name });
  openModal(`<h3>Abrir comanda</h3>
    <form class="stack" onsubmit="return submitAbrirComanda(event)">
      <div class="grid-2">
        <div class="field"><label>Mesa</label><select name="table_id" required>
          <option value="">Selecione…</option>
          ${livres.map(t => `<option value="${t.id}">${esc(t.label)} · ${esc(t.areaName)}</option>`).join('')}
        </select></div>
        <div class="field"><label>Pessoas</label><input type="number" name="party_size" min="1" value="2" required></div>
      </div>
      <div class="field"><label>Cliente (opcional)</label><input name="customer_name" placeholder="Nome"></div>
      <div id="ac-msg"></div>
      <button class="btn block">Abrir comanda e fazer pedido</button>
    </form>`);
}
async function submitAbrirComanda(e) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  b.party_size = +b.party_size; b.table_id = +b.table_id;
  try {
    const r = await api('/api/comandas/open', { method: 'POST', body: b });
    closeModal(); openComanda(r.comanda.id);
  } catch (err) { document.getElementById('ac-msg').innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; }
  return false;
}

function openComanda(id) { ATEND = { view: 'comanda', comandaId: id, cart: [] }; if ((location.hash.replace('#',''))!=='atendimento') location.hash = 'atendimento'; else renderAtendimento(); }
function atendBackToList() { ATEND = { view: 'list', comandaId: null, cart: [] }; renderAtendimento(); }

async function renderComandaView(silent) {
  const el = document.getElementById('content');
  if (!silent) el.innerHTML = '<div class="spinner"></div>';
  const d = await api('/api/comandas/' + ATEND.comandaId);
  const c = d.comanda;
  const pedidosHtml = d.pedidos.map(p => {
    const itens = p.itens.map(it => {
      const cancel = it.status === 'cancelado';
      const adic = (it.adicionais||[]).length ? `<div class="tiny" style="color:var(--ink-3)">${it.adicionais.map(a=>esc(a.name)).join(', ')}</div>` : '';
      const obs = it.observacao ? `<div class="tiny" style="color:var(--warn)">Obs: ${esc(it.observacao)}</div>` : '';
      return `<div class="row between" style="padding:4px 0;${cancel?'opacity:.5;text-decoration:line-through':''}">
        <div><b>${it.quantidade}x</b> ${esc(it.nome_produto_snapshot)} ${prodStatusBadge(it.status)}${adic}${obs}</div>
        <div class="row center" style="gap:6px"><span>${brl(it.subtotal_cents)}</span>
          ${!cancel && can('orders:write') ? `<button class="btn ghost sm" title="Cancelar item" onclick="cancelItemPrompt(${c.id},${it.id})">✕</button>` : ''}
        </div></div>`;
    }).join('');
    // status por setor (seções 6 e 9)
    const order = ['enviado','recebido','em_preparo','pronto','entregue'];
    const bySetor = {};
    for (const it of p.itens) { if (it.status==='cancelado') continue; const s=bySetor[it.setor]||(bySetor[it.setor]={min:'entregue'}); if (order.indexOf(it.status)<order.indexOf(s.min)) s.min=it.status; }
    const setorChips = Object.entries(bySetor).map(([setor,s])=>`<span class="badge ${s.min==='entregue'?'ok':(s.min==='pronto'?'info':'warn')}" style="font-size:10px">${esc(setor)}: ${({enviado:'Enviado',recebido:'Recebido',em_preparo:'Preparo',pronto:'PRONTO ✓',entregue:'Entregue ✓'})[s.min]}</span>`).join(' ');
    const entregaBtns = Object.entries(bySetor).filter(([,s])=>s.min==='pronto').map(([setor])=>`<button class="btn sm ok" onclick="entregarSetor(${c.id},${p.id},'${setor}')">🍽 Entregar ${esc(setor)}</button>`).join(' ');
    return `<div class="card tight">
      <div class="row between center"><b>Pedido #${String(p.numero_pedido).padStart(4,'0')}${p.is_complemento?' — Complemento':''}</b>
        <span class="tiny">${esc(p.funcionario_nome||'')} · ${esc((p.enviado_em||'').slice(11,16))}</span></div>
      <div style="margin-top:6px">${itens}</div>
      ${setorChips?`<div class="row" style="gap:4px;flex-wrap:wrap;margin-top:8px">${setorChips}</div>`:''}
      ${entregaBtns?`<div class="row" style="gap:6px;margin-top:8px">${entregaBtns}</div>`:''}
    </div>`;
  }).join('');

  const pagos = d.pagamentos.filter(p=>p.status==='confirmado');
  el.innerHTML = `
    <div class="section-title"><h2 style="display:flex;align-items:center;gap:8px"><button class="btn ghost sm" onclick="atendBackToList()">←</button> Comanda #${String(c.numero).padStart(5,'0')}</h2>
      ${finBadge(c.status_financeiro)}</div>
    <div class="card tight">
      <div class="row between center"><b>${esc(c.mesas || 'Mesa —')}</b><span class="tiny">${c.party_size} pessoa(s)</span></div>
      <div class="tiny" style="margin-top:4px">👤 Responsável: ${esc(c.responsavel_nome||'—')} · Aberta ${esc((c.aberta_em||'').slice(11,16))}${c.cliente_nome?` · Cliente: ${esc(c.cliente_nome)}`:''}</div>
    </div>
    ${can('orders:write') ? `<button class="btn block" style="margin:10px 0" onclick="abrirCardapio()">+ Novo pedido</button>` : ''}
    <h3 style="margin:14px 0 6px">Consumo</h3>
    ${pedidosHtml || '<p class="muted small">Nenhum pedido ainda.</p>'}
    <div class="card" style="margin-top:10px">
      <div class="row between center"><b>Total consumido</b><b style="font-size:20px">${brl(c.total_consumido_cents)}</b></div>
      ${c.total_pago_cents>0?`<div class="row between center" style="margin-top:6px"><span>Pago</span><span>${brl(c.total_pago_cents)}</span></div>
      <div class="row between center"><span>Restante</span><b style="color:${c.saldo_cents>0?'var(--warn)':'var(--ok)'}">${brl(Math.max(0,c.saldo_cents))}</b></div>`:''}
    </div>
    ${pagos.length ? `<h3 style="margin:14px 0 6px">Pagamentos ${c.tipo_pagamento==='dividido'?'<span class="badge info">DIVIDIDO</span>':(c.tipo_pagamento==='unico'?'<span class="badge mut">ÚNICO</span>':'')}</h3>
      <div class="card tight">${pagos.map(p=>`<div class="row between" style="padding:4px 0"><span>${formaLabel(p.forma_pagamento)}${p.pessoa?` · ${esc(p.pessoa)}`:''} <span class="tiny">(${esc(p.funcionario_nome||'')} ${esc((p.pago_em||'').slice(11,16))})</span></span><b>${brl(p.valor_cents)}</b></div>`).join('')}</div>` : ''}
    <div class="big-actions" style="margin-top:14px">
      ${can('payments:write') ? `<button class="btn" style="background:var(--info)" onclick="pagamentoModal(${c.id})">💳 Registrar pagamento</button>` : ''}
      ${can('orders:write') ? `<button class="btn ok" onclick="fecharConta(${c.id})">✔ Fechar conta e liberar mesa</button>` : ''}
    </div>`;
}

function prodStatusBadge(s) {
  const m = { enviado:['warn','Enviado'], recebido:['info','Recebido'], em_preparo:['info','Em preparo'], pronto:['ok','Pronto'], entregue:['mut','Entregue'], cancelado:['danger','Cancelado'] };
  const [c,l] = m[s]||['mut',s]; return `<span class="badge ${c}" style="font-size:10px">${l}</span>`;
}
function formaLabel(f) { return ({ dinheiro:'💵 Dinheiro', pix:'⚡ Pix', debito:'💳 Débito', credito:'💳 Crédito', outro:'Outro' })[f] || f; }

async function entregarSetor(comandaId, pedidoId, setor) {
  try { await api(`/api/production/pedido/${pedidoId}/setor/${setor}/status`, { method:'POST', body:{ status:'entregue' } }); toast('Entregue ✓', 'ok'); renderAtendimento(); refreshKdsBadges(); }
  catch (e) { toast(e.message, 'err'); }
}
async function cancelItemPrompt(comandaId, itemId) {
  const motivo = prompt('Motivo do cancelamento do item:'); if (motivo === null) return;
  try { await api(`/api/comandas/${comandaId}/item/${itemId}/cancel`, { method: 'POST', body: { motivo } }); toast('Item cancelado.', 'ok'); renderAtendimento(); }
  catch (e) { toast(e.message, 'err'); }
}

/* ---- Cardápio: montar pedido (carrinho) ---- */
async function abrirCardapio() { ATEND.view = 'menu'; ATEND.cart = ATEND.cart || []; await loadMenu(); renderAtendimento(); }
function voltarComanda() { ATEND.view = 'comanda'; renderAtendimento(); }

async function renderMenuPicker(silent) {
  const el = document.getElementById('content');
  const cats = await loadMenu();
  const cartCount = ATEND.cart.reduce((s,i)=>s+i.quantidade,0);
  const cartTotal = ATEND.cart.reduce((s,i)=>s+i.line_cents,0);
  const catTabs = cats.map((c,i)=>`<button class="chip ${i===0?'active':''}" onclick="menuScrollTo('cat${c.id}',this)">${esc(c.name)}</button>`).join('');
  const body = cats.map(c => `
    <div id="cat${c.id}" class="menu-cat">
      <h3 style="margin:14px 0 6px">${esc(c.name)} <span class="tiny">${esc(c.sector)}</span></h3>
      <div class="stack">
        ${c.products.map(p => `
          <div class="card tight ${p.available?'':'muted'}" style="${p.available?'cursor:pointer':''}" ${p.available?`onclick='menuPick(${p.id})'`:''}>
            <div class="row between center">
              <div><b>${esc(p.name)}</b>${p.option_groups.length?' <span class="tiny">⚙ opções</span>':''}${p.available?'':' <span class="badge danger" style="font-size:10px">Indisponível</span>'}
                ${p.description?`<div class="tiny" style="color:var(--ink-3)">${esc(p.description)}</div>`:''}</div>
              <div class="row center" style="gap:8px"><b>${brl(p.price_cents)}</b>${p.available?'<span class="btn sm">+</span>':''}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('');
  el.innerHTML = `
    <div class="section-title"><h2 style="display:flex;align-items:center;gap:8px"><button class="btn ghost sm" onclick="voltarComanda()">←</button> Cardápio</h2></div>
    <div class="chips" style="position:sticky;top:0;background:var(--bg);z-index:5;padding:6px 0;overflow-x:auto;flex-wrap:nowrap">${catTabs}</div>
    ${body}
    <div style="height:80px"></div>
    <div class="cart-bar">
      <button class="btn ghost" onclick="verCarrinho()">🛒 ${cartCount} item(s)</button>
      <div class="grow"></div>
      <b style="margin-right:10px">${brl(cartTotal)}</b>
      <button class="btn" ${cartCount?'':'disabled'} onclick="enviarPedido()">Enviar pedido</button>
    </div>`;
}
function menuScrollTo(id, btn) {
  document.querySelectorAll('.chips .chip').forEach(c=>c.classList.remove('active')); if(btn) btn.classList.add('active');
  const t = document.getElementById(id); if (t) t.scrollIntoView({ behavior:'smooth', block:'start' });
}
function findProduct(id) { for (const c of MENU_CACHE) { const p = c.products.find(x=>x.id===id); if (p) return p; } return null; }

function menuPick(id) {
  const p = findProduct(id); if (!p) return;
  if (p.option_groups.length) return menuOptionsModal(p);
  addToCart(p, 1, [], '');
  toast(`+1 ${p.name}`, 'ok');
}
function menuOptionsModal(p) {
  const groups = p.option_groups.map(g => `
    <div class="field"><label>${esc(g.name)} ${g.required?'<span style="color:var(--danger)">*</span>':''} <span class="tiny">${g.type==='single'?'(escolha 1)':'(pode escolher vários)'}</span></label>
      <div class="stack">
        ${g.options.map(o => `<label class="opt-row"><input type="${g.type==='single'?'radio':'checkbox'}" name="g${g.id}" value="${o.id}" data-group="${g.id}"> ${esc(o.name)}${o.price_cents?` <span class="tiny">+${brl(o.price_cents)}</span>`:''}</label>`).join('')}
      </div></div>`).join('');
  openModal(`<h3>${esc(p.name)}</h3>
    <p class="muted small">${brl(p.price_cents)}${p.description?` · ${esc(p.description)}`:''}</p>
    <form onsubmit="return confirmOptions(event, ${p.id})">
      ${groups}
      <div class="grid-2">
        <div class="field"><label>Quantidade</label><input type="number" name="qty" min="1" value="1"></div>
      </div>
      <div class="field"><label>Observação</label><input name="obs" placeholder="ex.: sem cebola, ponto da carne"></div>
      <div id="opt-msg"></div>
      <button class="btn block">Adicionar ao pedido</button>
    </form>`);
}
function confirmOptions(e, id) {
  e.preventDefault(); const p = findProduct(id); const form = e.target;
  const selected = [];
  for (const g of p.option_groups) {
    const checked = [...form.querySelectorAll(`input[name=g${g.id}]:checked`)].map(i=>+i.value);
    if (g.required && checked.length < 1) { document.getElementById('opt-msg').innerHTML = `<div class="alert vermelho">Escolha ${esc(g.name)}.</div>`; return false; }
    selected.push(...checked);
  }
  const qty = Math.max(1, +form.qty.value || 1);
  const obs = form.obs.value.trim();
  const labels = [];
  for (const g of p.option_groups) for (const o of g.options) if (selected.includes(o.id)) labels.push(o);
  addToCart(p, qty, labels, obs, selected);
  closeModal(); toast(`+${qty} ${p.name}`, 'ok');
  return false;
}
function addToCart(p, qty, optObjs, obs, optionIds) {
  const option_ids = optionIds || optObjs.map(o=>o.id);
  const adic = optObjs.reduce((s,o)=>s+o.price_cents,0);
  const unit = p.price_cents + adic;
  const sig = p.id + '|' + [...option_ids].sort().join(',') + '|' + (obs||'');
  const ex = ATEND.cart.find(i=>i.sig===sig);
  if (ex) { ex.quantidade += qty; ex.line_cents = ex.unit_cents * ex.quantidade; }
  else ATEND.cart.push({ sig, produto_id: p.id, name: p.name, unit_cents: unit, quantidade: qty, line_cents: unit*qty, option_ids, option_labels: optObjs.map(o=>o.name), observacao: obs||'' });
  if (ATEND.view === 'menu') renderAtendimento(true);
}
function verCarrinho() {
  if (!ATEND.cart.length) return toast('Carrinho vazio.', '');
  openModal(`<h3>Pedido (carrinho)</h3>
    <div class="stack">${ATEND.cart.map((i,idx)=>`
      <div class="card tight"><div class="row between center">
        <div><b>${i.quantidade}x</b> ${esc(i.name)}${i.option_labels.length?`<div class="tiny" style="color:var(--ink-3)">${i.option_labels.map(esc).join(', ')}</div>`:''}${i.observacao?`<div class="tiny" style="color:var(--warn)">Obs: ${esc(i.observacao)}</div>`:''}</div>
        <div class="row center" style="gap:8px"><span>${brl(i.line_cents)}</span>
          <button class="btn ghost sm" onclick="cartQty(${idx},-1)">−</button><button class="btn ghost sm" onclick="cartQty(${idx},1)">+</button>
          <button class="btn danger sm" onclick="cartDel(${idx})">✕</button></div>
      </div></div>`).join('')}</div>
    <div class="row between center" style="margin-top:10px"><b>Total</b><b>${brl(ATEND.cart.reduce((s,i)=>s+i.line_cents,0))}</b></div>
    <button class="btn block" style="margin-top:10px" onclick="closeModal();enviarPedido()">Enviar pedido</button>`);
}
function cartQty(idx, delta) { const i = ATEND.cart[idx]; if (!i) return; i.quantidade = Math.max(1, i.quantidade+delta); i.line_cents = i.unit_cents*i.quantidade; closeModal(); verCarrinho(); renderAtendimento(true); }
function cartDel(idx) { ATEND.cart.splice(idx,1); closeModal(); if (ATEND.cart.length) verCarrinho(); renderAtendimento(true); }
async function enviarPedido() {
  if (!ATEND.cart.length) return toast('Adicione itens ao pedido.', '');
  const items = ATEND.cart.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade, option_ids: i.option_ids, observacao: i.observacao }));
  try {
    const r = await api(`/api/comandas/${ATEND.comandaId}/pedido`, { method: 'POST', body: { items } });
    ATEND.cart = []; ATEND.view = 'comanda';
    toast(`Pedido #${String(r.numero_pedido).padStart(4,'0')} enviado${r.is_complemento?' (complemento)':''}`, 'ok');
    renderAtendimento();
  } catch (e) { toast(e.message, 'err'); }
}

/* ---- Pagamento manual ---- */
let PAG = { comandaId: null, saldo: 0, mode: 'unico', lines: [] };
const FORMAS = { dinheiro: '💵 Dinheiro', pix: '⚡ Pix', debito: '💳 Débito', credito: '💳 Crédito', outro: 'Outro' };
function formaOpts(sel) { return Object.entries(FORMAS).map(([v, l]) => `<option value="${v}" ${sel === v ? 'selected' : ''}>${l}</option>`).join(''); }

async function pagamentoModal(comandaId) {
  const d = await api('/api/comandas/' + comandaId);
  const c = d.comanda;
  const saldo = Math.max(0, c.saldo_cents);
  PAG = { comandaId, saldo, mode: 'unico', lines: [] };
  openModal(`<h3>Registrar pagamento</h3>
    <div class="card tight"><div class="row between"><span>Total</span><b>${brl(c.total_consumido_cents)}</b></div>
      <div class="row between"><span>Pago</span><span>${brl(c.total_pago_cents)}</span></div>
      <div class="row between"><span>Restante</span><b style="color:var(--warn)">${brl(saldo)}</b></div></div>
    <div class="chips" style="margin:12px 0 4px">
      <button type="button" class="chip active" id="pg-m-unico" onclick="setPagMode('unico')">Pagamento único</button>
      <button type="button" class="chip" id="pg-m-dividido" onclick="setPagMode('dividido')">Dividir pagamento</button>
      <button type="button" class="chip" id="pg-m-pix" onclick="setPagMode('pix')">⚡ Cobrança PIX</button>
    </div>
    <div id="pg-body"></div>`);
  renderPagBody();
}
function setPagMode(m) {
  PAG.mode = m;
  for (const [id, mode] of [['pg-m-unico', 'unico'], ['pg-m-dividido', 'dividido'], ['pg-m-pix', 'pix']]) { const b = document.getElementById(id); if (b) b.classList.toggle('active', m === mode); }
  if (m === 'dividido' && !PAG.lines.length) PAG.lines = [{ valor: (PAG.saldo / 100).toFixed(2), forma: 'dinheiro', pessoa: '' }];
  renderPagBody();
}
function renderPagBody() {
  const el = document.getElementById('pg-body'); if (!el) return;
  if (PAG.mode === 'pix') { renderPagPix(el); return; }
  if (PAG.mode === 'unico') {
    el.innerHTML = `<form class="stack" onsubmit="return submitPagUnico(event)">
      <div class="grid-2">
        <div class="field"><label>Valor (R$)</label><input type="number" name="valor" step="0.01" min="0.01" value="${(PAG.saldo / 100).toFixed(2)}" required></div>
        <div class="field"><label>Forma</label><select name="forma" required>${formaOpts('dinheiro')}</select></div>
      </div>
      <div class="field"><label>Observação</label><input name="observacao" placeholder="opcional"></div>
      <div id="pg-msg"></div>
      <button class="btn block" style="background:var(--info)">Registrar pagamento</button>
    </form>`;
  } else {
    el.innerHTML = `
      <div class="row center" style="gap:8px;margin-bottom:8px">
        <span class="tiny">Dividir igualmente entre</span>
        <input type="number" id="pg-n" min="2" max="20" value="${Math.max(2, PAG.lines.length)}" style="width:64px">
        <button type="button" class="btn ghost sm" onclick="dividirIgual()">pessoas</button>
      </div>
      <div class="stack">${PAG.lines.map((l, i) => `
        <div class="card tight">
          <div class="grid-2">
            <div class="field"><label>Valor (R$)</label><input type="number" step="0.01" min="0.01" value="${l.valor}" oninput="pagLine(${i},'valor',this.value)"></div>
            <div class="field"><label>Forma</label><select onchange="pagLine(${i},'forma',this.value)">${formaOpts(l.forma)}</select></div>
          </div>
          <div class="row" style="gap:8px"><input placeholder="Pessoa (opcional)" value="${esc(l.pessoa || '')}" oninput="pagLine(${i},'pessoa',this.value)" class="grow">
            ${PAG.lines.length > 1 ? `<button type="button" class="btn danger sm" onclick="rmPagLine(${i})">✕</button>` : ''}</div>
        </div>`).join('')}</div>
      <button type="button" class="btn ghost sm" style="margin-top:8px" onclick="addPagLine()">+ Adicionar pagamento</button>
      <div id="pg-tot"></div>
      <div id="pg-msg"></div>
      <button type="button" id="pg-div-btn" class="btn block" style="background:var(--info);margin-top:8px" onclick="submitPagDividido()">Registrar pagamentos</button>`;
    updatePagTotals();
  }
}
/* ---- Cobrança PIX dentro do pagamento (gera QR; pago só após confirmação) ---- */
let PIX_POLL = null;
function renderPagPix(el) {
  if (PIX_POLL) { clearInterval(PIX_POLL); PIX_POLL = null; }
  el.innerHTML = `
    <div class="field"><label>Valor da cobrança (R$)</label><input type="number" id="pix-valor" step="0.01" min="0.01" value="${(PAG.saldo / 100).toFixed(2)}"></div>
    <div class="field"><label>Pessoa (opcional)</label><input id="pix-pessoa" placeholder="nome"></div>
    <div id="pix-area"></div>
    <button class="btn block" style="background:var(--info)" id="pix-gen" onclick="pgPixGenerate()">Gerar cobrança PIX</button>
    <p class="tiny" style="color:var(--ink-3);margin-top:8px">O QR Code é só a cobrança. A comanda só é quitada após a <b>confirmação do pagamento</b> pelo provedor.</p>`;
}
async function pgPixGenerate() {
  const valor = Number(document.getElementById('pix-valor').value);
  if (!(valor > 0)) { toast('Informe o valor.', 'err'); return; }
  const btn = document.getElementById('pix-gen'); btn.disabled = true; btn.textContent = 'Gerando…';
  try {
    const r = await api('/api/pix/charge', { method: 'POST', body: { comanda_id: PAG.comandaId, valor_cents: Math.round(valor * 100), pessoa: document.getElementById('pix-pessoa').value || '' } });
    pgPixShow(r.charge);
  } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.textContent = 'Gerar cobrança PIX'; }
}
function pgPixShow(ch) {
  const area = document.getElementById('pix-area'); const gen = document.getElementById('pix-gen'); if (gen) gen.style.display = 'none';
  const sandbox = ch.provider === 'sandbox';
  area.innerHTML = `
    <div class="card tight" style="text-align:center">
      <div id="pix-qr" style="width:190px;height:190px;margin:4px auto;background:#fff;border-radius:10px;display:grid;place-items:center"></div>
      <div class="tiny" style="margin-top:6px">Copia e cola</div>
      <div class="row" style="gap:6px;margin-top:4px"><input id="pix-cc" value="${esc(ch.qr_payload)}" readonly onclick="this.select()" style="flex:1;font-size:11px"><button class="btn sm" onclick="navigator.clipboard.writeText(document.getElementById('pix-cc').value);toast('Copiado.','ok')">Copiar</button></div>
      <div id="pix-status" class="badge warn" style="margin-top:10px">⏳ Aguardando pagamento…</div>
      ${sandbox ? `<button class="btn block sm" style="margin-top:10px" onclick="pgPixSandbox(${ch.id})">Simular pagamento (sandbox)</button>` : ''}
    </div>`;
  // desenha o QR do copia-e-cola
  const draw = () => { const box = document.getElementById('pix-qr'); if (box && window.QRCode) { box.innerHTML = ''; new QRCode(box, { text: ch.qr_payload, width: 180, height: 180, colorDark: '#021324', colorLight: '#fff' }); } };
  if (window.QRCode) draw(); else { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = draw; document.head.appendChild(s); }
  // polling de confirmação
  if (PIX_POLL) clearInterval(PIX_POLL);
  PIX_POLL = setInterval(() => pgPixCheck(ch.id), 3000);
}
async function pgPixCheck(id) {
  try {
    const r = await api('/api/pix/' + id);
    if (r.charge.status === 'pago') {
      clearInterval(PIX_POLL); PIX_POLL = null;
      const st = document.getElementById('pix-status'); if (st) { st.className = 'badge ok'; st.textContent = '✅ Pagamento confirmado'; }
      toast('PIX confirmado! Comanda atualizada.', 'ok');
      setTimeout(() => { closeModal(); renderComandaView(); }, 1200);
    } else if (['expirado', 'cancelado', 'falhou'].includes(r.charge.status)) {
      clearInterval(PIX_POLL); PIX_POLL = null;
      const st = document.getElementById('pix-status'); if (st) { st.className = 'badge danger'; st.textContent = '❌ ' + r.charge.status; }
    }
  } catch {}
}
async function pgPixSandbox(id) {
  try { await api(`/api/pix/${id}/confirm-sandbox`, { method: 'POST' }); pgPixCheck(id); } catch (e) { toast(e.message, 'err'); }
}

function pagTotals() { const soma = PAG.lines.reduce((s, l) => s + Math.round(Number(l.valor || 0) * 100), 0); return { soma, rest: PAG.saldo - soma }; }
function updatePagTotals() {
  const { soma, rest } = pagTotals();
  const tot = document.getElementById('pg-tot');
  if (tot) tot.innerHTML = `<div class="card tight" style="margin-top:10px"><div class="row between"><span>Somado</span><b>${brl(soma)}</b></div>
    <div class="row between"><span>Restante da comanda</span><b style="color:${rest < 0 ? 'var(--danger)' : (rest === 0 ? 'var(--ok)' : 'var(--warn)')}">${brl(rest)}</b></div></div>
    ${rest < 0 ? '<div class="alert vermelho" style="margin-top:8px">A soma passou do restante da comanda.</div>' : ''}`;
  const btn = document.getElementById('pg-div-btn');
  if (btn) { btn.disabled = soma <= 0 || rest < 0; btn.textContent = `Registrar ${PAG.lines.length} pagamento(s)`; }
}
function pagLine(i, field, val) { if (PAG.lines[i]) { PAG.lines[i][field] = val; if (field === 'valor') updatePagTotals(); } }
function addPagLine() { PAG.lines.push({ valor: '', forma: 'dinheiro', pessoa: '' }); renderPagBody(); }
function rmPagLine(i) { PAG.lines.splice(i, 1); renderPagBody(); }
function dividirIgual() {
  const n = Math.max(2, Math.min(20, +document.getElementById('pg-n').value || 2));
  const base = Math.floor(PAG.saldo / n), rem = PAG.saldo - base * n;
  PAG.lines = [];
  for (let i = 0; i < n; i++) PAG.lines.push({ valor: ((base + (i === 0 ? rem : 0)) / 100).toFixed(2), forma: 'dinheiro', pessoa: 'Pessoa ' + (i + 1) });
  renderPagBody();
}
async function submitPagUnico(e) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  const valor_cents = Math.round(Number(b.valor) * 100);
  try {
    const r = await api(`/api/comandas/${PAG.comandaId}/payment`, { method: 'POST', body: { valor_cents, forma: b.forma, observacao: b.observacao } });
    closeModal();
    toast(r.status_financeiro === 'paga' ? 'Comanda quitada! ✅' : `Pago. Restante ${brl(r.saldo_cents)}`, 'ok');
    renderAtendimento();
  } catch (err) { const el = document.getElementById('pg-msg'); if (el) el.innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; }
  return false;
}
async function submitPagDividido() {
  const lines = PAG.lines.filter((l) => Number(l.valor) > 0);
  if (!lines.length) return toast('Adicione ao menos um pagamento.', 'err');
  let last = null;
  try {
    for (const l of lines) last = await api(`/api/comandas/${PAG.comandaId}/payment`, { method: 'POST', body: { valor_cents: Math.round(Number(l.valor) * 100), forma: l.forma, pessoa: l.pessoa || '' } });
    closeModal();
    toast(last && last.status_financeiro === 'paga' ? 'Comanda quitada! ✅' : `Pago. Restante ${brl(last ? last.saldo_cents : 0)}`, 'ok');
    renderAtendimento();
  } catch (err) {
    const el = document.getElementById('pg-msg'); if (el) el.innerHTML = `<div class="alert vermelho">${esc(err.message)} (os pagamentos já aceitos foram registrados)</div>`;
    renderAtendimento();
  }
}
async function fecharConta(comandaId) {
  try {
    await api(`/api/comandas/${comandaId}/close`, { method: 'POST', body: {} });
    toast('Conta encerrada e mesa liberada.', 'ok'); atendBackToList();
  } catch (e) {
    if (e.status === 409 && confirm(e.message + '\n\nDeseja registrar o pagamento agora?')) return pagamentoModal(comandaId);
    toast(e.message, 'err');
  }
}

/* ============================================================================
   CARDÁPIO — administração (categorias / produtos)
   ============================================================================ */
async function renderCardapio(silent) {
  const el = document.getElementById('content');
  if (!silent) el.innerHTML = '<div class="spinner"></div>';
  const admin = can('menu:write');
  const d = await api('/api/menu' + (admin ? '?all=1' : ''));
  const cats = d.categories;
  const total = cats.reduce((s,c)=>s+c.products.length,0);
  el.innerHTML = `
    <div class="section-title"><h2>Cardápio</h2>
      <span class="muted small">${cats.length} categorias · ${total} produtos</span></div>
    ${admin ? `<div class="card tight"><form class="row" style="gap:8px;flex-wrap:wrap" onsubmit="return addCategoria(event)">
      <input name="name" placeholder="Nova categoria" class="grow" required>
      <select name="sector" style="width:auto">${['COZINHA','BAR','NARGUILE','OUTROS'].map(s=>`<option>${s}</option>`).join('')}</select>
      <button class="btn sm">+ Categoria</button></form></div>` : ''}
    <div class="stack" style="margin-top:12px">
      ${cats.map(c => `
        <div class="card tight ${c.active?'':'muted'}">
          <div class="row between center">
            <b>${esc(c.name)} <span class="tiny">${esc(c.sector)}${c.active?'':' · inativa'}</span></b>
            ${admin ? `<div class="row" style="gap:6px">
              <button class="btn ghost sm" onclick="addProdutoModal(${c.id},'${esc(c.name)}')">+ Produto</button>
              <button class="btn ghost sm" onclick="editCategoria(${c.id})">✎</button>
            </div>` : ''}
          </div>
          <div style="margin-top:6px">
            ${c.products.map(p => `<div class="row between center" style="padding:5px 0;border-top:1px solid var(--line);${p.active?'':'opacity:.5'}">
              <div><b>${esc(p.name)}</b> ${p.available?'':'<span class="badge danger" style="font-size:10px">Indisponível</span>'}${p.active?'':' <span class="tiny">(inativo)</span>'}
                ${p.description?`<div class="tiny" style="color:var(--ink-3)">${esc(p.description)}</div>`:''}</div>
              <div class="row center" style="gap:8px"><b>${brl(p.price_cents)}</b>
                ${admin?`<button class="btn ghost sm" onclick="editProduto(${p.id})">✎</button>`:''}</div>
            </div>`).join('') || '<p class="muted small" style="margin-top:6px">Sem produtos.</p>'}
          </div>
        </div>`).join('')}
    </div>`;
  window.__MENU_ADMIN = cats;
}
function findAdminProduct(id) { for (const c of (window.__MENU_ADMIN||[])) { const p = c.products.find(x=>x.id===id); if (p) return p; } return null; }
function findAdminCat(id) { return (window.__MENU_ADMIN||[]).find(c=>c.id===id); }

async function addCategoria(e) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  try { await api('/api/menu/categories', { method: 'POST', body: b }); toast('Categoria criada.', 'ok'); renderCardapio(); }
  catch (err) { toast(err.message, 'err'); } return false;
}
function editCategoria(id) {
  const c = findAdminCat(id); if (!c) return;
  openModal(`<h3>Editar categoria</h3><form class="stack" onsubmit="return submitEditCategoria(event, ${id})">
    <div class="field"><label>Nome</label><input name="name" value="${esc(c.name)}" required></div>
    <div class="field"><label>Setor</label><select name="sector">${['COZINHA','BAR','NARGUILE','OUTROS'].map(s=>`<option ${c.sector===s?'selected':''}>${s}</option>`).join('')}</select></div>
    <label class="opt-row"><input type="checkbox" name="active" ${c.active?'checked':''}> Ativa</label>
    <div class="row" style="gap:8px"><button class="btn block">Salvar</button>
      <button type="button" class="btn danger" onclick="delCategoria(${id})">Desativar</button></div></form>`);
}
async function submitEditCategoria(e, id) {
  e.preventDefault(); const f = e.target;
  try { await api('/api/menu/categories/'+id, { method:'PATCH', body:{ name:f.name.value, sector:f.sector.value, active:f.active.checked } }); toast('Salvo.','ok'); closeModal(); renderCardapio(); }
  catch (err){ toast(err.message,'err'); } return false;
}
async function delCategoria(id) { if (!confirm('Desativar a categoria e seus produtos?')) return; try { await api('/api/menu/categories/'+id,{method:'DELETE'}); toast('Desativada.','ok'); closeModal(); renderCardapio(); } catch(e){ toast(e.message,'err'); } }

function addProdutoModal(catId, catName) { produtoForm(null, catId, catName); }
function editProduto(id) { const p = findAdminProduct(id); if (p) produtoForm(p, p.category_id); }
function produtoForm(p, catId, catName) {
  const isNew = !p;
  openModal(`<h3>${isNew?'Novo produto':'Editar produto'}${catName?` · ${esc(catName)}`:''}</h3>
    <form class="stack" onsubmit="return submitProduto(event, ${isNew?'null':p.id}, ${catId})">
      <div class="field"><label>Nome</label><input name="name" value="${esc(p?p.name:'')}" required></div>
      <div class="field"><label>Descrição</label><textarea name="description">${esc(p?p.description:'')}</textarea></div>
      <div class="grid-2">
        <div class="field"><label>Preço (R$)</label><input type="number" name="price" step="0.01" min="0" value="${p?(p.price_cents/100).toFixed(2):'0.00'}" required></div>
        <div class="field"><label>Setor</label><select name="sector">${['COZINHA','BAR','NARGUILE','OUTROS'].map(s=>`<option ${p&&p.sector===s?'selected':''}>${s}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Imagem (URL)</label><input name="image_url" value="${esc(p?p.image_url:'')}" placeholder="opcional"></div>
      ${!isNew?`<div class="row" style="gap:16px">
        <label class="opt-row"><input type="checkbox" name="available" ${p.available?'checked':''}> Disponível</label>
        <label class="opt-row"><input type="checkbox" name="active" ${p.active?'checked':''}> Ativo</label></div>`:''}
      <div id="pr-msg"></div>
      <button class="btn block">${isNew?'Criar produto':'Salvar'}</button>
      ${!isNew?`<button type="button" class="btn danger block" onclick="delProduto(${p.id})">Desativar produto</button>`:''}
    </form>`);
}
async function submitProduto(e, id, catId) {
  e.preventDefault(); const f = e.target;
  const body = { name: f.name.value, description: f.description.value, price: f.price.value, sector: f.sector.value, image_url: f.image_url.value, category_id: catId };
  if (f.available) body.available = f.available.checked;
  if (f.active) body.active = f.active.checked;
  try {
    if (id) await api('/api/menu/products/'+id, { method:'PATCH', body });
    else await api('/api/menu/products', { method:'POST', body });
    toast('Salvo.','ok'); closeModal(); renderCardapio();
  } catch (err) { document.getElementById('pr-msg').innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; } return false;
}
async function delProduto(id) { if (!confirm('Desativar este produto?')) return; try { await api('/api/menu/products/'+id,{method:'DELETE'}); toast('Desativado.','ok'); closeModal(); renderCardapio(); } catch(e){ toast(e.message,'err'); } }

/* ============================================================================
   PRODUÇÃO — cozinha / bar / narguilé / outros
   ============================================================================ */
let PROD_PANEL = 'COZINHA';
let KDS_TICK = null, KDS_LASTMAX = 0;
const PANEL_LABEL = { COZINHA: '🍳 Cozinha', BAR: '🍸 Bar / Narguilé', OUTROS: '📦 Outros' };

async function renderProducao(silent) {
  const el = document.getElementById('content');
  if (!silent && !document.getElementById('kds-list')) el.innerHTML = '<div class="spinner"></div>';
  const [d, counts] = await Promise.all([api('/api/production?panel=' + PROD_PANEL), api('/api/production/counts')]);
  const panels = ['COZINHA', 'BAR', 'OUTROS'];
  const cards = d.cards.map(c => kdsCard(c)).join('');

  // alerta sonoro/visual de novo pedido
  const topMax = d.cards.reduce((m, c) => Math.max(m, c.pedido_id), 0);
  if (!silent) KDS_LASTMAX = topMax;
  else if (topMax > KDS_LASTMAX && KDS_LASTMAX > 0) { kdsBeep(); toast('🔴 Novo pedido na ' + PANEL_LABEL[PROD_PANEL], 'ok'); KDS_LASTMAX = topMax; }
  else KDS_LASTMAX = Math.max(KDS_LASTMAX, topMax);

  el.innerHTML = `
    <div class="section-title"><h2>Central de Pedidos</h2>
      <label class="tiny" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="kds-sound" ${KDS_SOUND?'checked':''} onchange="KDS_SOUND=this.checked"> som</label></div>
    <div class="chips">${panels.map(p => `<button class="chip ${PROD_PANEL===p?'active':''}" onclick="prodTab('${p}')">${PANEL_LABEL[p]} ${counts[p]?`<span class="pill">${counts[p]}</span>`:''}</button>`).join('')}</div>
    <div id="kds-list" class="kds-grid" style="margin-top:12px">${d.cards.length?cards:'<div class="empty"><div class="big">👨‍🍳</div>Nenhum pedido pendente neste painel.</div>'}</div>`;
  startKdsTick();
}
function kdsCard(c) {
  const itens = c.itens.map(it => {
    const adic = (it.adicionais||[]).length ? `<div class="tiny" style="color:var(--ink-3)">${it.adicionais.map(a=>esc(a.name)).join(', ')}</div>` : '';
    const obs = it.observacao ? `<div class="tiny" style="color:var(--warn)">Obs: ${esc(it.observacao)}</div>` : '';
    return `<div style="padding:3px 0"><b>${it.quantidade}x</b> ${esc(it.nome_produto_snapshot)}${c.setor==='NARGUILE'?' 🧊':''}${adic}${obs}</div>`;
  }).join('');
  const freeze = c.ready_at || '';
  const btn = { enviado:['em_preparo','▶ Iniciar preparo'], recebido:['em_preparo','▶ Iniciar preparo'], em_preparo:['pronto','✓ Pedido pronto'], pronto:['entregue','🍽 Entregue'] }[c.status];
  return `<div class="kds-card status-${c.status}">
    <div class="row between center">
      <b>Pedido #${String(c.numero_pedido).padStart(4,'0')}${c.is_complemento?' · compl.':''}</b>
      <span class="kds-timer" data-start="${c.enviado_em}" data-target="${c.target_min}" data-ready="${freeze}">--:--</span>
    </div>
    <div class="tiny">${esc(c.mesa||'Mesa')} · Comanda #${String(c.comanda_numero).padStart(5,'0')} · ${esc(c.setor)}${c.garcom?` · ${esc(c.garcom)}`:''}</div>
    ${c.print_status ? `<div style="margin-top:6px">${c.print_status === 'PRINTED' ? '<span class="print-tag ok">🖨 Impresso</span>' : '<span class="print-tag pend">⚠️ Impressão pendente</span>'}</div>` : ''}
    <div style="margin:8px 0">${itens}</div>
    <div class="row between center">${prodStatusBadge(c.status)}
      ${btn && can('orders:write') ? `<button class="btn sm" onclick="prodSetor(${c.pedido_id},'${c.setor}','${btn[0]}')">${btn[1]}</button>` : ''}</div>
  </div>`;
}
function prodTab(p) { PROD_PANEL = p; KDS_LASTMAX = 0; renderProducao(); }
async function prodSetor(pedidoId, setor, status) {
  try { await api(`/api/production/pedido/${pedidoId}/setor/${setor}/status`, { method:'POST', body:{ status } }); renderProducao(true); refreshKdsBadges(); }
  catch (e) { toast(e.message, 'err'); }
}
// cronômetro ao vivo dos cartões + destaque de atraso
function startKdsTick() {
  if (KDS_TICK) clearInterval(KDS_TICK);
  const upd = () => {
    document.querySelectorAll('.kds-timer').forEach(el => {
      const start = el.dataset.start; if (!start) return;
      const end = el.dataset.ready ? el.dataset.ready : null;
      const t0 = new Date(start.replace(' ','T')+'Z').getTime();
      const t1 = end ? new Date(end.replace(' ','T')+'Z').getTime() : Date.now();
      let s = Math.max(0, Math.floor((t1 - t0)/1000));
      const mm = String(Math.floor(s/60)).padStart(2,'0'), ss = String(s%60).padStart(2,'0');
      el.textContent = `${mm}:${ss}`;
      const target = +el.dataset.target || 0;
      const card = el.closest('.kds-card');
      if (card && target && s/60 > target && !el.dataset.ready) card.classList.add('atrasado'); else if (card) card.classList.remove('atrasado');
    });
  };
  upd(); KDS_TICK = setInterval(upd, 1000);
}
let KDS_SOUND = true;
function kdsBeep() {
  if (!KDS_SOUND) return;
  try { const a = new (window.AudioContext||window.webkitAudioContext)(); const o = a.createOscillator(); const g = a.createGain();
    o.connect(g); g.connect(a.destination); o.type='sine'; o.frequency.value=880; g.gain.value=0.1; o.start(); setTimeout(()=>{o.stop();a.close();}, 250); } catch {}
}

/* ============================================================================
   DESEMPENHO — indicadores operacionais / histórico (seções 14-18)
   ============================================================================ */
let DESEMP_RANGE = 'today';
function fmtMin(m) { if (!m) return '—'; const s = Math.round(m*60); return `${Math.floor(s/60)}min ${String(s%60).padStart(2,'0')}s`; }
async function renderDesempenho(silent) {
  const el = document.getElementById('content');
  if (!silent) el.innerHTML = '<div class="spinner"></div>';
  const d = await api('/api/ops/kds-metrics?range=' + DESEMP_RANGE);
  const ranges = [['today','Hoje'],['yesterday','Ontem'],['7d','7 dias'],['30d','30 dias']];
  const stat = (label, val, extra='') => `<div class="stat"><div class="label">${label}</div><div class="value">${val}</div>${extra?`<div class="tiny">${extra}</div>`:''}</div>`;
  el.innerHTML = `
    <div class="section-title"><h2>Desempenho operacional</h2></div>
    <div class="chips">${ranges.map(([v,l])=>`<button class="chip ${DESEMP_RANGE===v?'active':''}" onclick="desempRange('${v}')">${l}</button>`).join('')}</div>
    <div class="ops-stats kpi-stats" style="margin-top:12px">
      ${stat('Pedidos', d.pedidos_hoje)}
      ${stat('Itens', d.itens_total)}
      ${stat('Tempo médio preparo', fmtMin(d.tempo_medio_preparo))}
      ${stat('Tempo médio até entrega', fmtMin(d.tempo_medio_entrega))}
      ${stat('Em produção', d.em_producao)}
      ${stat('Atrasados', d.atrasados)}
      ${stat('Entregues', d.finalizados)}
      ${stat('Cancelados', d.cancelados)}
    </div>
    <h3 style="margin:16px 0 6px">Por setor</h3>
    <div class="card tight"><div style="overflow-x:auto"><table class="tbl">
      <thead><tr><th>Setor</th><th>Itens</th><th>Tempo médio</th><th>Meta</th><th>Atrasados</th></tr></thead>
      <tbody>${d.por_setor.map(s=>`<tr><td>${esc(s.setor)}</td><td>${s.pedidos}</td><td>${fmtMin(s.media)}</td><td>${s.target}min</td><td>${s.atrasados}</td></tr>`).join('')||'<tr><td colspan="5" class="muted">Sem dados.</td></tr>'}</tbody></table></div></div>
    <h3 style="margin:16px 0 6px">Por garçom</h3>
    <div class="card tight"><div style="overflow-x:auto"><table class="tbl">
      <thead><tr><th>Garçom</th><th>Itens</th><th>Tempo médio entrega</th><th>Receita</th></tr></thead>
      <tbody>${d.por_garcom.map(g=>`<tr><td>${esc(g.garcom)}</td><td>${g.itens}</td><td>${fmtMin(g.media_entrega)}</td><td>${brl(g.receita_cents)}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">Sem dados.</td></tr>'}</tbody></table></div></div>
    <h3 style="margin:16px 0 6px">Produtos que mais demoram</h3>
    <div class="card tight"><div style="overflow-x:auto"><table class="tbl">
      <thead><tr><th>Produto</th><th>Qtd</th><th>Tempo médio preparo</th></tr></thead>
      <tbody>${d.por_produto.map(p=>`<tr><td>${esc(p.produto)}</td><td>${p.qtd}</td><td>${fmtMin(p.media_preparo)}</td></tr>`).join('')||'<tr><td colspan="3" class="muted">Sem dados.</td></tr>'}</tbody></table></div></div>
    ${d.por_hora.length?`<h3 style="margin:16px 0 6px">Movimento por horário</h3>
    <div class="card tight">${d.por_hora.map(h=>`<div class="row between" style="padding:3px 0"><span>${esc(h.hora)}</span><b>${h.qtd}</b></div>`).join('')}</div>`:''}`;
}
function desempRange(r) { DESEMP_RANGE = r; renderDesempenho(); }

/* ============================================================================
   ALERTAS EM TEMPO REAL — Garçom → Produção → Garçom (pop-up + som)
   ============================================================================ */
let _ac = null;
function _audio() {
  try { if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)(); if (_ac.state === 'suspended') _ac.resume(); } catch {}
  return _ac;
}
// desbloqueia o áudio na primeira interação do usuário
document.addEventListener('click', _audio, { capture: true });
document.addEventListener('keydown', _audio, { capture: true });
function playChime(kind) {
  const ac = _audio(); if (!ac) return;
  const seq = kind === 'ready' ? [880, 1174, 1568] : [880, 880, 880]; // pronto: subindo | novo: 3 toques de atenção
  const t0 = ac.currentTime;
  seq.forEach((f, i) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
    const t = t0 + i * 0.17;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.start(t); o.stop(t + 0.18);
  });
}
const ALERT_SEEN_NEW = new Set(), ALERT_SEEN_READY = new Set();
const _alertTimers = {};
function alertStack() {
  let s = document.getElementById('alert-stack');
  if (!s) { s = document.createElement('div'); s.id = 'alert-stack'; s.className = 'alert-stack'; document.body.appendChild(s); }
  return s;
}
function dismissAlert(id) {
  const el = document.getElementById(id); if (el) el.remove();
  if (_alertTimers[id]) { clearInterval(_alertTimers[id]); delete _alertTimers[id]; }
}
// NOVO PEDIDO → aparece para quem está na tela de Produção (fila continua lá de qualquer forma)
function handleNewOrder(d) {
  if ((location.hash.replace('#', '') || '') !== 'producao') return;
  if (!d.pedido_id || ALERT_SEEN_NEW.has(d.pedido_id)) return;
  ALERT_SEEN_NEW.add(d.pedido_id);
  const id = 'al-new-' + d.pedido_id;
  const itens = (d.itens || []).map((i) =>
    `<div>• <b>${i.qtd}x</b> ${esc(i.nome)}${i.adicionais && i.adicionais.length ? ` <span class="al-dim">(${i.adicionais.map(esc).join(', ')})</span>` : ''}${i.obs ? ` <span class="al-obs">obs: ${esc(i.obs)}</span>` : ''} <span class="al-dim">[${esc(i.setor)}]</span></div>`).join('');
  const el = document.createElement('div'); el.id = id; el.className = 'alertpop new pulse';
  el.innerHTML = `
    <div class="ah"><span>🔔 NOVO PEDIDO — ${esc(d.mesa || 'Mesa')}</span><button class="al-x" aria-label="Fechar">✕</button></div>
    <div class="ab"><b>Pedido #${String(d.numero_pedido).padStart(4, '0')}${d.is_complemento ? ' (compl.)' : ''}</b> · Garçom: ${esc(d.garcom || '—')} · ${esc(d.hora || '')}
      <div class="al-items">${itens}</div></div>
    <div class="aact"><button class="al-ack">✓ Recebido</button></div>`;
  alertStack().appendChild(el);
  const ack = () => dismissAlert(id);
  el.querySelector('.al-x').onclick = ack;
  el.querySelector('.al-ack').onclick = ack;
  playChime('new'); // toca 3x apenas, no momento do pedido (não repete)
  setTimeout(ack, 180000); // o pop-up some sozinho em 3 min (o pedido continua na fila)
}
// PEDIDO PRONTO → SOMENTE para o garçom que criou o pedido
function handleOrderReady(d) {
  if (!ME || !ME.user || d.funcionario_id !== ME.user.id) return;
  const key = d.pedido_id + ':' + d.setor;
  if (ALERT_SEEN_READY.has(key)) return;
  ALERT_SEEN_READY.add(key);
  notifyArrived(); // pedido pronto para este garçom -> expande/destaca
  const id = 'al-ready-' + d.pedido_id + '-' + d.setor;
  const el = document.createElement('div'); el.id = id; el.className = 'alertpop ready';
  el.innerHTML = `
    <div class="ah"><span>✅ PEDIDO PRONTO! — ${esc(d.mesa || 'Mesa')}</span><button class="al-x" aria-label="Fechar">✕</button></div>
    <div class="ab">Pedido #${String(d.numero_pedido).padStart(4, '0')} <b>(${esc(d.setor)})</b> está pronto para retirada.</div>
    <div class="aact"><button class="al-ack">Ver pedido</button></div>`;
  alertStack().appendChild(el);
  el.querySelector('.al-x').onclick = () => dismissAlert(id);
  el.querySelector('.al-ack').onclick = () => { dismissAlert(id); if (d.comanda_id) openComanda(d.comanda_id); };
  playChime('ready');
  setTimeout(() => dismissAlert(id), 90000);
}

/* ============================================================================
   GESTÃO DE ADEGA — rentabilidade real de bebidas (garrafas e doses)
   ============================================================================ */
const ADEGA = { tab: 'dashboard', range: 'hoje', rankOrder: 'lucro', rankRange: '30d' };
const ADEGA_TABS = [['dashboard', 'Raio-X'], ['produtos', 'Bebidas'], ['rankings', 'Rentabilidade'], ['perdas', 'Perdas'], ['simulador', 'Simulador'], ['alertas', 'Alertas']];
const ADEGA_RANGES = [['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Este mês']];
const MOTIVO_LABEL = { derramamento: 'Derramamento', quebra: 'Quebra', dose_acima: 'Dose acima do padrão', erro_preparo: 'Erro de preparo', vencida: 'Bebida vencida', consumo_interno: 'Consumo interno', cortesia: 'Cortesia', ajuste: 'Ajuste de estoque', divergencia_consumo: 'Divergência de consumo', outros: 'Outros' };
const adegaWrite = () => can('adega:write');

function adegaTab(t) { ADEGA.tab = t; renderAdega(); }
function adegaSetRange(r) { ADEGA.range = r; renderAdega(); }
async function renderAdega(silent) {
  const el = document.getElementById('content');
  if (!silent) el.innerHTML = '<div class="spinner"></div>';
  let body = '';
  try {
    if (ADEGA.tab === 'dashboard') body = await adegaDashboard();
    else if (ADEGA.tab === 'produtos') body = await adegaProdutos();
    else if (ADEGA.tab === 'rankings') body = await adegaRankings();
    else if (ADEGA.tab === 'perdas') body = await adegaPerdas();
    else if (ADEGA.tab === 'simulador') body = adegaSimulador();
    else if (ADEGA.tab === 'alertas') body = await adegaAlertas();
  } catch (e) { body = `<div class="alert vermelho">${esc(e.message)}</div>`; }
  el.innerHTML = `
    <div class="section-title"><h2>🍾 Gestão de Adega</h2></div>
    <div class="chips">${ADEGA_TABS.map(([v, l]) => `<button class="chip ${ADEGA.tab === v ? 'active' : ''}" onclick="adegaTab('${v}')">${l}</button>`).join('')}</div>
    <div id="adega-body" style="margin-top:16px">${body}</div>`;
  if (ADEGA.tab === 'simulador') bindSimulador();
}
function adegaStat(label, val, extra, cls) { return `<div class="stat ${cls || ''}"><div class="label">${label}</div><div class="value">${val}</div>${extra ? `<div class="tiny">${extra}</div>` : ''}</div>`; }

async function adegaDashboard() {
  const [d, al] = await Promise.all([api('/api/adega/dashboard?range=' + ADEGA.range), api('/api/adega/alertas')]);
  const ranges = `<div class="chips" style="margin-bottom:12px">${ADEGA_RANGES.map(([v, l]) => `<button class="chip ${ADEGA.range === v ? 'active' : ''}" onclick="adegaSetRange('${v}')">${l}</button>`).join('')}</div>`;
  const raiox = (titulo, item, campo) => `<div class="card tight"><div class="tiny">${titulo}</div>${item ? `<b style="font-size:1.05rem">${esc(item.nome)}</b><div class="tiny">${campo(item)}</div>` : '<span class="muted small">—</span>'}</div>`;
  const alertas = (al.alertas || []).slice(0, 6);
  return `${ranges}
    <div class="ops-stats kpi-stats">
      ${adegaStat('Faturamento', brl(d.faturamento_cents), ADEGA.range, 'accent')}
      ${adegaStat('Lucro estimado', brl(d.lucro_cents))}
      ${adegaStat('Margem média', d.margem_media + '%')}
      ${adegaStat('Garrafas vendidas', d.garrafas_vendidas)}
      ${adegaStat('Doses vendidas', d.doses_vendidas)}
      ${adegaStat('Valor em estoque', brl(d.valor_estoque_cents))}
      ${adegaStat('Perdas estimadas', brl(d.perdas_cents))}
      ${adegaStat('Estoque baixo', d.produtos_estoque_baixo.length)}
    </div>
    <h3 style="margin:18px 0 8px">Raio-X — de onde vem (e pra onde vai) o dinheiro</h3>
    <div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      ${raiox('🏆 Produto mais vendido', d.mais_vendido, (x) => `${x.qtd} un · ${brl(x.faturamento)}`)}
      ${raiox('💰 Mais lucrativo', d.mais_lucrativo, (x) => `${brl(x.lucro)} de lucro`)}
      ${raiox('⚠️ Maior perda', d.maior_perda, (x) => `${brl(x.perda)} em perdas`)}
    </div>
    ${d.produtos_estoque_baixo.length ? `<h3 style="margin:18px 0 8px">Precisa repor</h3><div class="card tight">${d.produtos_estoque_baixo.map((p) => `<div class="row between" style="padding:4px 0"><span>${esc(p.nome)}</span><b class="badge warn">${p.fechadas} / mín ${p.minimo}</b></div>`).join('')}</div>` : ''}
    ${alertas.length ? `<h3 style="margin:18px 0 8px">Alertas</h3><div class="stack">${alertas.map(adegaAlertRow).join('')}</div>` : ''}`;
}
function adegaAlertRow(a) {
  const cls = { warn: 'warn', ok: 'ok', danger: 'danger', mut: 'mut' }[a.nivel] || 'mut';
  return `<div class="card tight"><span class="badge ${cls}">${({ estoque_baixo: 'Estoque baixo', alta_margem: 'Alta margem', vencido: 'Vencimento', alta_perda: 'Alta perda', baixa_saida: 'Baixa saída' })[a.tipo] || a.tipo}</span> ${esc(a.texto)}</div>`;
}

async function adegaProdutos() {
  const d = await api('/api/adega/produtos');
  const cards = d.produtos.map((p) => `
    <div class="card tight" style="cursor:pointer" onclick="adegaProdutoModal(${p.id})">
      <div class="row between center"><b>${esc(p.nome)}</b> <span class="badge ${p.estoque.baixo ? 'warn' : 'mut'}">${p.estoque.fechadas} garrafa(s)</span></div>
      <div class="tiny">${esc([p.marca, p.categoria, (p.volume_ml ? p.volume_ml + 'ml' : '')].filter(Boolean).join(' · '))}</div>
      <div class="row between" style="margin-top:8px"><span class="tiny">Dose ${p.dose_ml}ml · ${brl(p.preco_dose_cents)}</span><span class="tiny">Margem <b style="color:var(--ok)">${p.margem_dose}%</b></span></div>
      <div class="row between"><span class="tiny">${p.estoque.doses_disponiveis} doses disp.</span><span class="tiny">Lucro/dose ${brl(p.lucro_dose_cents)}</span></div>
    </div>`).join('');
  return `${adegaWrite() ? '<button class="btn block" style="margin-bottom:12px" onclick="adegaNovaBebida()">+ Nova bebida</button>' : ''}
    ${d.produtos.length ? `<div class="kds-grid">${cards}</div>` : '<div class="empty"><div class="big">🍾</div>Nenhuma bebida cadastrada. Comece adicionando sua primeira bebida.</div>'}`;
}

async function adegaProdutoModal(id) {
  const d = await api('/api/adega/produtos/' + id);
  const p = d.produto;
  const abertas = (p.garrafas_abertas || []).map((b) => `<div class="row between" style="padding:3px 0"><span class="tiny">Garrafa #${b.id} aberta</span><span class="tiny"><b>${b.volume_restante_ml}ml</b> ${adegaWrite() ? `<button class="btn ghost sm" onclick="adegaFecharGarrafa(${b.id},${id})">finalizar</button>` : ''}</span></div>`).join('');
  openModal(`<h3>${esc(p.nome)} <span class="tiny">${p.volume_ml}ml</span></h3>
    <div class="card tight">
      <div class="row between"><span>Custo da garrafa</span><b>${brl(p.custo_compra_cents)}</b></div>
      <div class="row between"><span>Dose padrão</span><b>${p.dose_ml}ml</b></div>
      <div class="row between"><span>Rendimento teórico</span><b>${p.doses_teoricas} doses</b></div>
      <div class="row between"><span>Custo por dose</span><b>${brl(p.custo_dose_cents)}</b></div>
      <div class="row between"><span>Preço da dose</span><b>${brl(p.preco_dose_cents)}</b></div>
      <div class="row between"><span>Lucro bruto por dose</span><b style="color:var(--ok)">${brl(p.lucro_dose_cents)} (${p.margem_dose}%)</b></div>
      <div class="row between" style="border-top:1px solid var(--line);margin-top:6px;padding-top:6px"><span>Faturamento potencial</span><b>${brl(p.faturamento_potencial_cents)}</b></div>
      <div class="row between"><span>Lucro potencial</span><b style="color:var(--ok)">${brl(p.lucro_potencial_cents)}</b></div>
    </div>
    <div class="card tight" style="margin-top:8px">
      <div class="row between"><span>Estoque</span><b>${p.estoque.fechadas} fechada(s) · ${p.estoque.abertas} aberta(s)</b></div>
      <div class="row between"><span>Disponível</span><b>${p.estoque.volume_total_ml}ml · ${p.estoque.doses_disponiveis} doses</b></div>
      <div class="row between"><span>Dinheiro parado</span><b>${brl(p.estoque.valor_custo_cents)}</b></div>
      ${abertas}
    </div>
    ${adegaWrite() ? `<div class="big-actions" style="margin-top:12px">
      <button class="btn" style="background:var(--ok)" onclick="adegaVenderDose(${id})">🥃 Vender dose</button>
      <button class="btn" style="background:var(--info)" onclick="adegaVenderGarrafa(${id})">🍾 Vender garrafa</button>
      <button class="btn ghost" onclick="adegaEntrada(${id})">📦 Entrada</button>
      <button class="btn ghost" onclick="adegaAbrirGarrafa(${id})">🔓 Abrir garrafa</button>
      <button class="btn ghost" onclick="adegaPerdaModal(${id},'${esc(p.nome)}')">💧 Perda</button>
      <button class="btn ghost" onclick="adegaVincularModal(${id})">🔗 Vincular ao cardápio</button>
      <button class="btn ghost" onclick="adegaEditBebida(${id})">✎ Editar</button>
    </div>` : ''}`);
  window.__ADEGA_P = p;
}

function adegaFormBebida(p) {
  const n = p || {};
  const val = (k, d) => (n[k] != null ? n[k] : (d != null ? d : ''));
  const re = (c) => (c ? (c / 100).toFixed(2) : '');
  return `
    <div class="field"><label>Nome da bebida</label><input name="nome" value="${esc(val('nome'))}" required></div>
    <div class="grid-2">
      <div class="field"><label>Categoria</label><input name="categoria" value="${esc(val('categoria'))}" placeholder="Whisky, Vodka, Gin…"></div>
      <div class="field"><label>Marca</label><input name="marca" value="${esc(val('marca'))}"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Volume da garrafa (ml)</label><input type="number" name="volume_ml" min="1" value="${val('volume_ml') || ''}" placeholder="750" required></div>
      <div class="field"><label>Dose padrão (ml)</label><input type="number" name="dose_ml" min="1" value="${val('dose_ml', 50)}" required></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Custo da garrafa (R$)</label><input type="number" step="0.01" name="custo_compra" value="${re(n.custo_compra_cents)}" placeholder="0,00"></div>
      <div class="field"><label>Preço da garrafa (R$)</label><input type="number" step="0.01" name="preco_garrafa" value="${re(n.preco_garrafa_cents)}" placeholder="0,00"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Preço da dose (R$)</label><input type="number" step="0.01" name="preco_dose" value="${re(n.preco_dose_cents)}" placeholder="0,00"></div>
      <div class="field"><label>Estoque mínimo (garrafas)</label><input type="number" name="estoque_minimo" min="0" value="${val('estoque_minimo', 0)}"></div>
    </div>
    ${!p ? '<div class="field"><label>Estoque inicial (garrafas)</label><input type="number" name="estoque_garrafas" min="0" value="0"></div>' : ''}
    <div class="grid-2">
      <div class="field"><label>Fornecedor</label><input name="fornecedor" value="${esc(val('fornecedor'))}"></div>
      <div class="field"><label>Validade (opcional)</label><input type="date" name="validade" value="${esc(val('validade'))}"></div>
    </div>
    <div class="field"><label>Código de barras</label><input name="codigo_barras" value="${esc(val('codigo_barras'))}"></div>
    <div class="field"><label>Observações</label><input name="obs" value="${esc(val('obs'))}"></div>`;
}
function adegaNovaBebida() {
  openModal(`<h3>Nova bebida</h3><form class="stack" onsubmit="return adegaSaveBebida(event,null)">${adegaFormBebida(null)}<div id="ab-msg"></div><button class="btn block">Cadastrar bebida</button></form>`);
}
async function adegaVincularModal(id) {
  const p = window.__ADEGA_P;
  const [menu, vinc] = await Promise.all([api('/api/menu'), api('/api/adega/produtos/' + id + '/vinculos')]);
  const produtos = menu.categories.flatMap((c) => c.products.map((x) => ({ id: x.id, name: x.name, price: x.price_cents })));
  const atuais = vinc.vinculos.map((v) => `<div class="row between" style="padding:4px 0;border-top:1px solid var(--line)"><span>${esc(v.name)} <span class="tiny">(${v.adega_venda_tipo}${v.adega_dose_ml ? ' ' + v.adega_dose_ml + 'ml' : ''})</span></span><button class="btn ghost sm" onclick="adegaDesvincular(${id},${v.id})">remover</button></div>`).join('');
  openModal(`<h3>Vincular ao cardápio — ${esc(p.nome)}</h3>
    <p class="tiny">Ao vender o item do cardápio numa comanda, o estoque e o faturamento desta bebida baixam automaticamente na Adega.</p>
    ${vinc.vinculos.length ? `<div class="card tight"><b class="tiny">Itens já vinculados</b>${atuais}</div>` : ''}
    <form class="stack" style="margin-top:10px" onsubmit="return adegaDoVincular(event,${id})">
      <div class="field"><label>Item do cardápio</label><select name="menu_product_id" required>${produtos.map((x) => `<option value="${x.id}">${esc(x.name)} — ${brl(x.price)}</option>`).join('')}</select></div>
      <div class="grid-2">
        <div class="field"><label>Vender como</label><select name="tipo" id="vinc-tipo" onchange="document.getElementById('vinc-dose').style.display=this.value==='dose'?'':'none'"><option value="dose">Dose</option><option value="garrafa">Garrafa inteira</option></select></div>
        <div class="field" id="vinc-dose"><label>Dose (ml)</label><input type="number" name="dose_ml" value="${p.dose_ml}"></div>
      </div>
      <div id="vc-msg"></div><button class="btn block">Vincular</button>
    </form>`);
}
async function adegaDoVincular(e, id) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  try { await api(`/api/adega/produtos/${id}/vincular`, { method: 'POST', body: b }); toast('Vinculado! Vendas na comanda agora baixam na Adega.', 'ok'); adegaVincularModal(id); }
  catch (err) { document.getElementById('vc-msg').innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; } return false;
}
async function adegaDesvincular(id, mpId) {
  try { await api(`/api/adega/produtos/${id}/desvincular`, { method: 'POST', body: { menu_product_id: mpId } }); toast('Desvinculado.', 'ok'); adegaVincularModal(id); }
  catch (e) { toast(e.message, 'err'); }
}
function adegaEditBebida(id) {
  const p = window.__ADEGA_P;
  openModal(`<h3>Editar bebida</h3><form class="stack" onsubmit="return adegaSaveBebida(event,${id})">${adegaFormBebida(p)}<div id="ab-msg"></div>
    <button class="btn block">Salvar</button><button type="button" class="btn danger block" onclick="adegaDelBebida(${id})">Desativar bebida</button></form>`);
}
async function adegaSaveBebida(e, id) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  try {
    if (id) await api('/api/adega/produtos/' + id, { method: 'PATCH', body: b });
    else await api('/api/adega/produtos', { method: 'POST', body: b });
    toast('Salvo.', 'ok'); closeModal(); renderAdega();
  } catch (err) { document.getElementById('ab-msg').innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; }
  return false;
}
async function adegaDelBebida(id) { if (!confirm('Desativar esta bebida?')) return; try { await api('/api/adega/produtos/' + id, { method: 'DELETE' }); toast('Desativada.', 'ok'); closeModal(); renderAdega(); } catch (e) { toast(e.message, 'err'); } }

function adegaVenderDose(id) {
  const p = window.__ADEGA_P;
  openModal(`<h3>Vender dose — ${esc(p.nome)}</h3>
    <form class="stack" onsubmit="return adegaDoSell(event,${id},'dose')">
      <div class="grid-2">
        <div class="field"><label>Dose (ml)</label><input type="number" name="dose_ml" value="${p.dose_ml}" required></div>
        <div class="field"><label>Quantidade</label><input type="number" name="quantidade" min="1" value="1" required></div>
      </div>
      <div class="field"><label>Preço unitário (R$)</label><input type="number" step="0.01" name="preco" value="${(p.preco_dose_cents/100).toFixed(2)}"></div>
      <p class="tiny">Disponível: ${p.estoque.doses_disponiveis} doses · O estoque é descontado automaticamente.</p>
      <div id="vd-msg"></div><button class="btn block" style="background:var(--ok)">Registrar venda</button>
    </form>`);
}
function adegaVenderGarrafa(id) {
  const p = window.__ADEGA_P;
  openModal(`<h3>Vender garrafa — ${esc(p.nome)}</h3>
    <form class="stack" onsubmit="return adegaDoSell(event,${id},'garrafa')">
      <div class="field"><label>Quantidade de garrafas</label><input type="number" name="quantidade" min="1" value="1" required></div>
      <div class="field"><label>Preço unitário (R$)</label><input type="number" step="0.01" name="preco" value="${(p.preco_garrafa_cents/100).toFixed(2)}"></div>
      <p class="tiny">Em estoque: ${p.estoque.fechadas} garrafa(s) fechada(s).</p>
      <div id="vd-msg"></div><button class="btn block" style="background:var(--info)">Registrar venda</button>
    </form>`);
}
async function adegaDoSell(e, id, tipo) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  try {
    const r = await api(`/api/adega/produtos/${id}/vender-${tipo}`, { method: 'POST', body: b });
    toast(`Venda registrada: ${brl(r.total_cents)} · lucro ${brl(r.lucro_cents)}`, 'ok'); closeModal(); renderAdega();
  } catch (err) { document.getElementById('vd-msg').innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; }
  return false;
}
function adegaEntrada(id) {
  const p = window.__ADEGA_P;
  openModal(`<h3>Entrada de estoque — ${esc(p.nome)}</h3>
    <form class="stack" onsubmit="return adegaDoEntrada(event,${id})">
      <div class="grid-2">
        <div class="field"><label>Garrafas</label><input type="number" name="garrafas" min="1" value="1" required></div>
        <div class="field"><label>Custo unitário (R$)</label><input type="number" step="0.01" name="custo" value="${(p.custo_compra_cents/100).toFixed(2)}"></div>
      </div>
      <div class="field"><label>Fornecedor</label><input name="fornecedor" value="${esc(p.fornecedor||'')}"></div>
      <div id="en-msg"></div><button class="btn block">Adicionar ao estoque</button>
    </form>`);
}
async function adegaDoEntrada(e, id) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  try { await api(`/api/adega/produtos/${id}/entrada`, { method: 'POST', body: b }); toast('Estoque atualizado.', 'ok'); closeModal(); renderAdega(); }
  catch (err) { document.getElementById('en-msg').innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; } return false;
}
async function adegaAbrirGarrafa(id) {
  try { await api(`/api/adega/produtos/${id}/abrir`, { method: 'POST', body: {} }); toast('Garrafa aberta.', 'ok'); adegaProdutoModal(id); }
  catch (e) { toast(e.message, 'err'); }
}
async function adegaFecharGarrafa(bottleId, prodId) {
  const esvaziada = confirm('A garrafa está vazia? \n\nOK = esvaziada (converte o volume restante em perda por divergência)\nCancelar = apenas finalizar sem perda');
  try {
    const r = await api(`/api/adega/garrafas/${bottleId}/fechar`, { method: 'POST', body: { esvaziada } });
    if (r.divergencia) toast(`Divergência: ${r.divergencia.volume_ml}ml · perda ${brl(r.divergencia.valor_cents)}`, 'err');
    else toast('Garrafa finalizada.', 'ok');
    adegaProdutoModal(prodId);
  } catch (e) { toast(e.message, 'err'); }
}
function adegaPerdaModal(id, nome) {
  openModal(`<h3>Registrar perda — ${esc(nome || '')}</h3>
    <form class="stack" onsubmit="return adegaDoPerda(event,${id})">
      <div class="field"><label>Motivo</label><select name="motivo" required>${Object.entries(MOTIVO_LABEL).filter(([k])=>k!=='divergencia_consumo').map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></div>
      <div class="grid-2">
        <div class="field"><label>Quantidade</label><input type="number" step="0.01" name="quantidade" min="0.01" required></div>
        <div class="field"><label>Unidade</label><select name="unidade"><option value="ml">ml</option><option value="dose">dose</option><option value="garrafa">garrafa</option></select></div>
      </div>
      <label class="opt-row"><input type="checkbox" name="baixar_estoque"> Baixar do estoque</label>
      <div class="field"><label>Observação</label><input name="obs"></div>
      <div id="pd-msg"></div><button class="btn block" style="background:var(--danger)">Registrar perda</button>
    </form>`);
}
async function adegaDoPerda(e, id) {
  e.preventDefault(); const f = e.target; const b = Object.fromEntries(new FormData(f).entries()); b.baixar_estoque = f.baixar_estoque.checked;
  try { const r = await api(`/api/adega/produtos/${id}/perda`, { method: 'POST', body: b }); toast(`Perda registrada: ${brl(r.valor_cents)}`, 'ok'); closeModal(); renderAdega(); }
  catch (err) { document.getElementById('pd-msg').innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; } return false;
}

async function adegaRankings() {
  const orders = [['lucro', 'Maior lucro'], ['margem', 'Maior margem'], ['faturamento', 'Faturamento'], ['qtd', 'Mais vendidos'], ['perda', 'Maior perda']];
  const d = await api(`/api/adega/rankings?order=${ADEGA.rankOrder}&range=${ADEGA.rankRange}`);
  const chips = `<div class="chips" style="margin-bottom:10px">${orders.map(([v, l]) => `<button class="chip ${ADEGA.rankOrder === v ? 'active' : ''}" onclick="ADEGA.rankOrder='${v}';renderAdega()">${l}</button>`).join('')}</div>
    <div class="chips" style="margin-bottom:12px">${ADEGA_RANGES.map(([v, l]) => `<button class="chip ${ADEGA.rankRange === v ? 'active' : ''}" onclick="ADEGA.rankRange='${v}';renderAdega()">${l}</button>`).join('')}</div>`;
  const rows = d.rankings.map((r, i) => `<tr><td><b>${i + 1}º</b> ${esc(r.nome)}</td><td>${r.qtd}</td><td>${brl(r.faturamento)}</td><td style="color:var(--ok)">${brl(r.lucro)}</td><td>${r.margem}%</td><td style="color:var(--danger)">${r.perda ? brl(r.perda) : '—'}</td></tr>`).join('');
  return `${chips}<div class="card tight"><div style="overflow-x:auto"><table class="tbl">
    <thead><tr><th>Produto</th><th>Qtd</th><th>Faturam.</th><th>Lucro</th><th>Margem</th><th>Perda</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" class="muted">Sem vendas no período.</td></tr>'}</tbody></table></div></div>`;
}

async function adegaPerdas() {
  const [d, lista] = await Promise.all([api('/api/adega/dashboard?range=30d'), api('/api/adega/perdas')]);
  const motivos = Object.entries(d.perdas_por_motivo || {}).sort((a, b) => b[1] - a[1]);
  const total = motivos.reduce((s, m) => s + m[1], 0);
  const linhas = lista.perdas.slice(0, 50).map((p) => `<tr><td>${esc(p.produto_nome)}</td><td>${MOTIVO_LABEL[p.motivo] || p.motivo}</td><td>${p.quantidade}${p.unidade}</td><td style="color:var(--danger)">${brl(p.valor_cents)}</td><td class="tiny">${esc((p.created_at || '').slice(0, 16))}</td></tr>`).join('');
  return `<div class="card accent" style="margin-bottom:14px"><div class="label">Perdas (últimos 30 dias)</div><div class="value">${brl(total)}</div></div>
    ${motivos.length ? `<h3 style="margin:6px 0 8px">Por motivo</h3><div class="card tight">${motivos.map(([m, v]) => `<div class="row between" style="padding:4px 0"><span>${MOTIVO_LABEL[m] || m}</span><b>${brl(v)}</b></div>`).join('')}</div>` : ''}
    <h3 style="margin:16px 0 8px">Histórico de perdas</h3>
    <div class="card tight"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Produto</th><th>Motivo</th><th>Qtd</th><th>Valor</th><th>Data</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="5" class="muted">Nenhuma perda registrada.</td></tr>'}</tbody></table></div></div>`;
}

function adegaSimulador() {
  return `<div class="card">
    <h3 style="margin-bottom:10px">Simular preço da dose</h3>
    <div class="grid-2">
      <div class="field"><label>Custo da garrafa (R$)</label><input type="number" step="0.01" id="sim-custo" value="100"></div>
      <div class="field"><label>Volume da garrafa (ml)</label><input type="number" id="sim-vol" value="1000"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Tamanho da dose (ml)</label><input type="number" id="sim-dose" value="50"></div>
      <div class="field"><label>Margem desejada (%)</label><input type="number" id="sim-margem" value="60"></div>
    </div>
    <div class="field"><label>Ou informe um preço de venda (R$) para ver a margem</label><input type="number" step="0.01" id="sim-preco" placeholder="opcional"></div>
    <div id="sim-out" class="card tight" style="margin-top:8px"></div>
  </div>`;
}
function bindSimulador() {
  const ids = ['sim-custo', 'sim-vol', 'sim-dose', 'sim-margem', 'sim-preco'];
  const run = async () => {
    const g = (id) => document.getElementById(id).value;
    const body = { custo: g('sim-custo'), volume_ml: g('sim-vol'), dose_ml: g('sim-dose') };
    if (g('sim-preco')) body.preco = g('sim-preco'); else body.margem = g('sim-margem');
    try {
      const r = await api('/api/adega/simular', { method: 'POST', body });
      document.getElementById('sim-out').innerHTML = `
        <div class="row between"><span>Rendimento teórico</span><b>${r.doses_teoricas} doses</b></div>
        <div class="row between"><span>Custo por dose</span><b>${brl(r.custo_dose_cents)}</b></div>
        ${r.preco_sugerido_cents != null ? `<div class="row between"><span>Preço sugerido da dose</span><b style="color:var(--ok);font-size:1.2rem">${brl(r.preco_sugerido_cents)}</b></div>` : ''}
        ${r.lucro_dose_cents != null ? `<div class="row between"><span>Lucro por dose</span><b>${brl(r.lucro_dose_cents)}</b></div>` : ''}
        ${r.margem_resultante != null ? `<div class="row between"><span>Margem resultante</span><b>${r.margem_resultante}%</b></div>` : ''}
        ${r.markup != null ? `<div class="row between"><span>Markup</span><b>${r.markup}%</b></div>` : ''}`;
    } catch (e) { document.getElementById('sim-out').innerHTML = `<div class="alert vermelho">${esc(e.message)}</div>`; }
  };
  ids.forEach((id) => { const el = document.getElementById(id); if (el) el.addEventListener('input', run); });
  run();
}

async function adegaAlertas() {
  const d = await api('/api/adega/alertas');
  if (!d.alertas.length) return '<div class="empty"><div class="big">✅</div>Nenhum alerta no momento.</div>';
  return `<div class="stack">${d.alertas.map(adegaAlertRow).join('')}</div>`;
}

/* ============================================================================
   ESTOQUE & FICHAS TÉCNICAS (ligado ao Cardápio)
   ============================================================================ */
const EST = { tab: 'dashboard', range: 'hoje' };
const EST_TABS = [['dashboard', 'Dashboard / CMV'], ['insumos', 'Insumos'], ['fichas', 'Fichas Técnicas'], ['reposicao', 'Reposição'], ['movimentos', 'Movimentações']];
const EST_RANGES = [['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Este mês']];
const UNIDADES = ['un', 'ml', 'l', 'g', 'kg', 'porcao', 'dose', 'garrafa', 'lata', 'caixa'];
const estWrite = () => can('estoque:write');
const TIPO_MOV = { compra: 'Compra', reposicao: 'Reposição', venda: 'Venda', perda: 'Perda', quebra: 'Quebra', vencido: 'Vencido', erro_preparo: 'Erro de preparo', consumo_interno: 'Consumo interno', degustacao: 'Degustação', estorno: 'Estorno', ajuste: 'Ajuste', inventario: 'Inventário', transferencia: 'Transferência', devolucao: 'Devolução' };
const SAIDA_MOTIVOS = ['perda', 'quebra', 'vencido', 'erro_preparo', 'consumo_interno', 'degustacao'];

function estTab(t) { EST.tab = t; renderEstoque(); }
async function renderEstoque(silent) {
  const el = document.getElementById('content');
  if (!silent) el.innerHTML = '<div class="spinner"></div>';
  let body = '';
  try {
    if (EST.tab === 'dashboard') body = await estDashboard();
    else if (EST.tab === 'insumos') body = await estInsumos();
    else if (EST.tab === 'fichas') body = await estFichas();
    else if (EST.tab === 'reposicao') body = await estReposicao();
    else if (EST.tab === 'movimentos') body = await estMovimentos();
  } catch (e) { body = `<div class="alert vermelho">${esc(e.message)}</div>`; }
  el.innerHTML = `
    <div class="section-title"><h2>🧺 Despensa</h2></div>
    <div class="chips">${EST_TABS.map(([v, l]) => `<button class="chip ${EST.tab === v ? 'active' : ''}" onclick="estTab('${v}')">${l}</button>`).join('')}</div>
    <div style="margin-top:16px">${body}</div>`;
}
function estStat(l, v, cls) { return `<div class="stat ${cls || ''}"><div class="label">${l}</div><div class="value">${v}</div></div>`; }

async function estDashboard() {
  const d = await api('/api/estoque/dashboard?range=' + EST.range);
  const ranges = `<div class="chips" style="margin-bottom:12px">${EST_RANGES.map(([v, l]) => `<button class="chip ${EST.range === v ? 'active' : ''}" onclick="EST.range='${v}';renderEstoque()">${l}</button>`).join('')}</div>`;
  const rx = (t, it, campo) => `<div class="card tight"><div class="tiny">${t}</div>${it ? `<b>${esc(it.nome)}</b><div class="tiny">${campo(it)}</div>` : '<span class="muted small">—</span>'}</div>`;
  const porProd = d.por_produto && d.por_produto.length ? `<h3 style="margin:16px 0 8px">Receitas no período</h3><div class="card tight"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Produto</th><th>Qtd</th><th>Faturam.</th><th>Lucro</th></tr></thead><tbody>${d.por_produto.map((p) => `<tr><td>${esc(p.nome)}</td><td>${p.qtd}</td><td>${brl(p.faturamento)}</td><td style="color:var(--ok)">${brl(p.lucro)}</td></tr>`).join('')}</tbody></table></div></div>` : '';
  return `${ranges}
    <div class="ops-stats kpi-stats">
      ${estStat('Faturamento', brl(d.faturamento_cents), 'accent')}
      ${estStat('Custo (CMV R$)', brl(d.custo_cents))}
      ${estStat('Lucro bruto', brl(d.lucro_cents))}
      ${estStat('CMV', d.cmv + '%')}
      ${estStat('Margem', d.margem + '%')}
      ${estStat('Valor em estoque', brl(d.valor_estoque_cents))}
      ${estStat('Estoque baixo', d.estoque_baixo)}
      ${estStat('Sem estoque', d.sem_estoque)}
    </div>
    <div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-top:14px">
      ${rx('🏆 Receita mais vendida', d.mais_vendida, (x) => `${x.qtd} un · ${brl(x.faturamento)}`)}
      ${rx('💰 Mais lucrativa', d.mais_lucrativa, (x) => `${brl(x.lucro)} de lucro`)}
      ${rx('🧃 Insumo mais consumido', d.insumo_mais_consumido, (x) => `${brl(x.valor_cents)}`)}
      ${rx('⚠️ Maior desperdício', d.maior_desperdicio, (x) => `${brl(x.valor_cents)} em perdas`)}
    </div>${porProd}`;
}

async function estInsumos() {
  const d = await api('/api/estoque/insumos');
  const cards = d.insumos.map((i) => `
    <div class="card tight" style="cursor:pointer" onclick="estInsumoModal(${i.id})">
      <div class="row between center"><b>${esc(i.nome)}</b> <span class="badge ${i.sem_estoque ? 'danger' : (i.baixo ? 'warn' : 'mut')}">${i.estoque_atual}${esc(i.unidade_controle)}</span></div>
      <div class="tiny">${esc([i.marca, i.categoria].filter(Boolean).join(' · ') || 'Insumo')}</div>
      <div class="row between" style="margin-top:6px"><span class="tiny">Custo ${brl(i.custo_control_cents)}/${esc(i.unidade_controle)}</span><span class="tiny">Em estoque ${brl(i.valor_estoque_cents)}</span></div>
    </div>`).join('');
  return `${estWrite() ? '<button class="btn block" style="margin-bottom:12px" onclick="estNovoInsumo()">+ Novo insumo</button>' : ''}
    ${d.insumos.length ? `<div class="kds-grid">${cards}</div>` : '<div class="empty"><div class="big">📦</div>Nenhum insumo cadastrado. Comece pelos ingredientes/matérias-primas.</div>'}`;
}
function estFormInsumo(i) {
  const n = i || {}, v = (k, d) => (n[k] != null ? n[k] : (d != null ? d : '')), re = (c) => (c ? (c / 100).toFixed(2) : '');
  return `
    <div class="field"><label>Nome</label><input name="nome" value="${esc(v('nome'))}" required></div>
    <div class="grid-2">
      <div class="field"><label>Categoria</label><input name="categoria" value="${esc(v('categoria'))}"></div>
      <div class="field"><label>Marca</label><input name="marca" value="${esc(v('marca'))}"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Unidade de compra</label><select name="unidade_compra">${UNIDADES.map((u) => `<option ${v('unidade_compra', 'garrafa') === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      <div class="field"><label>Qtd por compra (na unidade de controle)</label><input type="number" step="0.001" name="qtd_por_compra" value="${v('qtd_por_compra', 1)}" required></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Unidade de controle</label><select name="unidade_controle">${UNIDADES.map((u) => `<option ${v('unidade_controle', 'ml') === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      <div class="field"><label>Custo da compra (R$)</label><input type="number" step="0.01" name="custo_compra" value="${re(n.custo_compra_cents)}"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Estoque mínimo</label><input type="number" step="0.001" name="estoque_minimo" value="${v('estoque_minimo', 0)}"></div>
      <div class="field"><label>Estoque máximo</label><input type="number" step="0.001" name="estoque_maximo" value="${v('estoque_maximo', 0)}"></div>
    </div>
    ${!i ? '<div class="field"><label>Estoque inicial (na unidade de controle)</label><input type="number" step="0.001" name="estoque_atual" value="0"></div>' : ''}
    <div class="grid-2">
      <div class="field"><label>Fornecedor</label><input name="fornecedor" value="${esc(v('fornecedor'))}"></div>
      <div class="field"><label>Validade</label><input type="date" name="validade" value="${esc(v('validade'))}"></div>
    </div>
    <p class="tiny">Ex.: Uísque → compra "garrafa", qtd por compra 1000, unidade de controle "ml", custo R$80 → R$0,08/ml.</p>`;
}
function estNovoInsumo() { openModal(`<h3>Novo insumo</h3><form class="stack" onsubmit="return estSaveInsumo(event,null)">${estFormInsumo(null)}<div id="ei-msg"></div><button class="btn block">Cadastrar</button></form>`); }
async function estSaveInsumo(e, id) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  try { if (id) await api('/api/estoque/insumos/' + id, { method: 'PATCH', body: b }); else await api('/api/estoque/insumos', { method: 'POST', body: b }); toast('Salvo.', 'ok'); closeModal(); renderEstoque(); }
  catch (err) { document.getElementById('ei-msg').innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; } return false;
}
async function estInsumoModal(id) {
  const d = await api('/api/estoque/insumos/' + id);
  const i = d.insumo; window.__EST_I = i;
  const movs = d.movimentos.slice(0, 15).map((m) => `<div class="row between" style="padding:3px 0;border-top:1px solid var(--line)"><span class="tiny">${m.sinal > 0 ? '➕' : '➖'} ${TIPO_MOV[m.tipo] || m.tipo}${m.ref ? ' · ' + esc(m.ref) : ''}</span><span class="tiny">${m.sinal > 0 ? '+' : '-'}${m.quantidade}${esc(m.unidade)} → ${m.estoque_posterior}</span></div>`).join('');
  openModal(`<h3>${esc(i.nome)}</h3>
    <div class="card tight">
      <div class="row between"><span>Estoque atual</span><b class="${i.sem_estoque ? 'badge danger' : (i.baixo ? 'badge warn' : '')}">${i.estoque_atual} ${esc(i.unidade_controle)}</b></div>
      <div class="row between"><span>Custo</span><b>${brl(i.custo_control_cents)}/${esc(i.unidade_controle)}</b></div>
      <div class="row between"><span>Valor em estoque</span><b>${brl(i.valor_estoque_cents)}</b></div>
      <div class="row between"><span>Equivale a</span><b>${i.equivalente_compra} ${esc(i.unidade_compra)}(s)</b></div>
      <div class="row between"><span>Mínimo</span><b>${i.estoque_minimo} ${esc(i.unidade_controle)}</b></div>
    </div>
    ${estWrite() ? `<div class="big-actions" style="margin-top:12px">
      <button class="btn" style="background:var(--ok)" onclick="estEntradaModal(${id})">📥 Entrada</button>
      <button class="btn" style="background:var(--danger)" onclick="estSaidaModal(${id})">💧 Perda / saída</button>
      <button class="btn ghost" onclick="estInventarioModal(${id})">🧮 Inventário</button>
      <button class="btn ghost" onclick="estSaveInsumoEdit(${id})">✎ Editar</button>
    </div>` : ''}
    <h3 style="margin:14px 0 6px">Rastreabilidade (últimos movimentos)</h3>
    <div class="card tight">${movs || '<span class="muted small">Sem movimentos.</span>'}</div>`);
}
function estSaveInsumoEdit(id) { const i = window.__EST_I; openModal(`<h3>Editar insumo</h3><form class="stack" onsubmit="return estSaveInsumo(event,${id})">${estFormInsumo(i)}<div id="ei-msg"></div><button class="btn block">Salvar</button><button type="button" class="btn danger block" onclick="estDelInsumo(${id})">Desativar</button></form>`); }
async function estDelInsumo(id) { if (!confirm('Desativar este insumo?')) return; try { await api('/api/estoque/insumos/' + id, { method: 'DELETE' }); toast('Desativado.', 'ok'); closeModal(); renderEstoque(); } catch (e) { toast(e.message, 'err'); } }
function estEntradaModal(id) {
  const i = window.__EST_I;
  openModal(`<h3>Entrada — ${esc(i.nome)}</h3><form class="stack" onsubmit="return estDoMov(event,${id},'entrada')">
    <div class="grid-2"><div class="field"><label>Quantidade</label><input type="number" step="0.001" name="quantidade" required></div>
      <div class="field"><label>Unidade</label><select name="unidade">${UNIDADES.map((u) => `<option ${u === i.unidade_controle ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
    <div class="field"><label>Custo da compra (R$) — opcional, atualiza o custo</label><input type="number" step="0.01" name="custo"></div>
    <div id="em-msg"></div><button class="btn block" style="background:var(--ok)">Dar entrada</button></form>`);
}
function estSaidaModal(id) {
  const i = window.__EST_I;
  openModal(`<h3>Perda / saída — ${esc(i.nome)}</h3><form class="stack" onsubmit="return estDoMov(event,${id},'saida')">
    <div class="field"><label>Motivo</label><select name="tipo">${SAIDA_MOTIVOS.map((m) => `<option value="${m}">${TIPO_MOV[m]}</option>`).join('')}</select></div>
    <div class="grid-2"><div class="field"><label>Quantidade</label><input type="number" step="0.001" name="quantidade" required></div>
      <div class="field"><label>Unidade</label><select name="unidade">${UNIDADES.map((u) => `<option ${u === i.unidade_controle ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
    <div id="em-msg"></div><button class="btn block" style="background:var(--danger)">Registrar</button></form>`);
}
function estInventarioModal(id) {
  const i = window.__EST_I;
  openModal(`<h3>Inventário — ${esc(i.nome)}</h3><form class="stack" onsubmit="return estDoMov(event,${id},'inventario')">
    <div class="card tight"><div class="row between"><span>Estoque no sistema</span><b>${i.estoque_atual} ${esc(i.unidade_controle)}</b></div></div>
    <div class="field"><label>Contagem física (${esc(i.unidade_controle)})</label><input type="number" step="0.001" name="estoque_fisico" value="${i.estoque_atual}" required></div>
    <div class="field"><label>Observação</label><input name="motivo"></div>
    <div id="em-msg"></div><button class="btn block">Confirmar ajuste</button></form>`);
}
async function estDoMov(e, id, kind) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  const path = kind === 'entrada' ? 'entrada' : (kind === 'saida' ? 'saida' : 'inventario');
  try { await api(`/api/estoque/insumos/${id}/${path}`, { method: 'POST', body: b }); toast('Estoque atualizado.', 'ok'); estInsumoModal(id); renderEstoque(true); }
  catch (err) { const m = document.getElementById('em-msg'); if (m) m.innerHTML = `<div class="alert vermelho">${esc(err.message)}</div>`; } return false;
}

async function estFichas() {
  const d = await api('/api/estoque/fichas');
  const cards = d.fichas.map((f) => `
    <div class="card tight" style="cursor:pointer" onclick="estFichaModal(${f.id})">
      <div class="row between center"><b>${esc(f.name)}</b> <span class="badge ${f.cmv > 40 ? 'warn' : 'ok'}">CMV ${f.cmv}%</span></div>
      <div class="row between" style="margin-top:6px"><span class="tiny">Venda ${brl(f.price_cents)} · Custo ${brl(f.custo_total_cents)}</span><span class="tiny">Margem <b style="color:var(--ok)">${f.margem}%</b></span></div>
      <div class="tiny">${f.ingredientes.length} ingrediente(s)</div>
    </div>`).join('');
  return `${estWrite() ? '<button class="btn block" style="margin-bottom:12px" onclick="estNovaFicha()">+ Montar ficha de um item do cardápio</button>' : ''}
    ${d.fichas.length ? `<div class="kds-grid">${cards}</div>` : '<div class="empty"><div class="big">🧾</div>Nenhuma ficha técnica. Monte a composição de um item do cardápio para ter custo, CMV e baixa automática.</div>'}`;
}
async function estNovaFicha() {
  const d = await api('/api/estoque/cardapio');
  openModal(`<h3>Montar ficha técnica</h3>
    <div class="field"><label>Escolha o item do cardápio</label>
      <select id="ficha-mp">${d.produtos.map((p) => `<option value="${p.id}">${esc(p.name)} — ${brl(p.price_cents)}</option>`).join('')}</select></div>
    <button class="btn block" onclick="estFichaModal(+document.getElementById('ficha-mp').value)">Abrir ficha</button>`);
}
async function estFichaModal(mpId) {
  const [d, ins] = await Promise.all([api('/api/estoque/ficha/' + mpId), api('/api/estoque/insumos')]);
  const f = d.ficha;
  const linhas = f.ingredientes.map((x) => `<tr><td>${esc(x.nome)}</td><td>${x.quantidade} ${esc(x.unidade)}</td><td>${brl(x.custo_cents)}</td>${estWrite() ? `<td class="right"><button class="btn ghost sm" onclick="estDelFichaItem(${x.ficha_item_id},${mpId})">✕</button></td>` : ''}</tr>`).join('');
  openModal(`<h3>${esc(f.name)}</h3>
    <div class="card tight">
      <div class="row between"><span>Venda</span><b>${brl(f.price_cents)}</b></div>
      <div class="row between"><span>Custo</span><b>${brl(f.custo_total_cents)}</b></div>
      <div class="row between"><span>Lucro bruto</span><b style="color:var(--ok)">${brl(f.lucro_cents)}</b></div>
      <div class="row between"><span>Margem</span><b>${f.margem}%</b></div>
      <div class="row between"><span>CMV</span><b style="color:${f.cmv > 40 ? 'var(--warn)' : 'var(--ok)'}">${f.cmv}%</b></div>
    </div>
    <h3 style="margin:12px 0 6px">Ingredientes</h3>
    <div class="card tight"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Insumo</th><th>Qtd</th><th>Custo</th>${estWrite() ? '<th></th>' : ''}</tr></thead>
      <tbody>${linhas || `<tr><td colspan="4" class="muted">Sem ingredientes ainda.</td></tr>`}</tbody></table></div></div>
    ${estWrite() ? `<form class="stack" style="margin-top:10px" onsubmit="return estAddFichaItem(event,${mpId})">
      <div class="row" style="gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div class="field grow"><label>Insumo</label><select name="insumo_id" id="fi-insumo">${ins.insumos.map((i) => `<option value="${i.id}" data-u="${esc(i.unidade_controle)}">${esc(i.nome)} (${esc(i.unidade_controle)})</option>`).join('')}</select></div>
        <div class="field" style="width:90px"><label>Qtd</label><input type="number" step="0.001" name="quantidade" required></div>
        <div class="field" style="width:90px"><label>Unid.</label><select name="unidade">${UNIDADES.map((u) => `<option>${u}</option>`).join('')}</select></div>
        <button class="btn">+ Add</button>
      </div></form>` : ''}`);
}
async function estAddFichaItem(e, mpId) {
  e.preventDefault(); const b = Object.fromEntries(new FormData(e.target).entries());
  try { await api(`/api/estoque/ficha/${mpId}/item`, { method: 'POST', body: b }); estFichaModal(mpId); renderEstoque(true); }
  catch (err) { toast(err.message, 'err'); } return false;
}
async function estDelFichaItem(itemId, mpId) { try { await api('/api/estoque/ficha-item/' + itemId, { method: 'DELETE' }); estFichaModal(mpId); renderEstoque(true); } catch (e) { toast(e.message, 'err'); } }

async function estReposicao() {
  const d = await api('/api/estoque/reposicao');
  if (!d.reposicao.length) return '<div class="empty"><div class="big">✅</div>Nenhum insumo precisa de reposição agora.</div>';
  return `<div class="card tight"><div style="overflow-x:auto"><table class="tbl">
    <thead><tr><th>Insumo</th><th>Estoque</th><th>Consumo/dia</th><th>Dias restantes</th><th>Mínimo</th></tr></thead>
    <tbody>${d.reposicao.map((r) => `<tr><td>${esc(r.nome)}</td><td class="${r.sem ? 'badge danger' : ''}">${r.estoque} ${esc(r.unidade)}</td><td>${r.media_dia || '—'}</td><td>${r.dias_restantes != null ? `<b style="color:${r.dias_restantes <= 3 ? 'var(--danger)' : 'var(--warn)'}">${r.dias_restantes} dias</b>` : '—'}</td><td>${r.minimo}</td></tr>`).join('')}</tbody></table></div></div>`;
}
async function estMovimentos() {
  const d = await api('/api/estoque/movimentos');
  return `<div class="card tight"><div style="overflow-x:auto"><table class="tbl">
    <thead><tr><th>Data</th><th>Insumo</th><th>Tipo</th><th>Qtd</th><th>Saldo</th><th>Ref</th></tr></thead>
    <tbody>${d.movimentos.map((m) => `<tr><td class="tiny">${esc((m.created_at || '').slice(5, 16))}</td><td>${esc(m.insumo_nome)}</td><td>${TIPO_MOV[m.tipo] || m.tipo}</td><td style="color:${m.sinal > 0 ? 'var(--ok)' : 'var(--danger)'}">${m.sinal > 0 ? '+' : '-'}${m.quantidade}${esc(m.unidade)}</td><td>${m.estoque_posterior}</td><td class="tiny">${esc(m.ref)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sem movimentações.</td></tr>'}</tbody></table></div></div>`;
}

/* ============================================================ CHAMADOS (Garçom Digital) */
const CHAMADO_ICON = { atendimento: '🙋', pedido: '🍽', bebidas: '🥤', talheres: '🍴', guardanapo: '🧻', duvida: '❓', conta: '💳', outro: '✨' };
function handleDwRequest(d) {
  if (d.attended) return;
  if (can('orders:read')) refreshKdsBadges();
  notifyArrived(); // chamado de cliente -> expande/destaca
  // aviso sonoro + toast para a equipe (chamado do cliente)
  try { playChime('new'); } catch {}
  toast(`🔔 ${d.mesa || 'Mesa'} · ${(d.tipo === 'conta' ? 'pediu a conta' : 'chamou o garçom')}`, 'ok');
}
async function renderChamados(silent) {
  const el = document.getElementById('content');
  let d; try { d = await api('/api/dw-requests'); } catch (e) { if (!silent) el.innerHTML = `<div class="empty">${e.message}</div>`; return; }
  const reqs = d.requests || [];
  el.innerHTML = `
    <div class="section-title mt0"><h2>Chamados das mesas <span class="muted" style="font-weight:600">· ${d.pendentes} pendente(s)</span></h2></div>
    <p class="muted" style="margin:-6px 0 14px">Solicitações feitas pelos clientes no Garçom Digital (chamar garçom e pedir a conta).</p>
    <div class="kds-grid">
      ${reqs.length ? reqs.map(r => `
        <div class="card tight" style="border-left:4px solid ${r.tipo === 'conta' ? 'var(--warn)' : 'var(--brand)'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <div>
              <div style="font-weight:800;font-size:17px">${CHAMADO_ICON[r.tipo] || '🔔'} ${esc(r.mesa || 'Mesa')}</div>
              <div style="margin-top:3px">${esc(r.tipo_label || r.tipo)}</div>
              ${r.cliente_nome ? `<div class="tiny">Cliente: ${esc(r.cliente_nome)}</div>` : ''}
              ${r.mensagem ? `<div class="tiny">"${esc(r.mensagem)}"</div>` : ''}
              <div class="tiny">${esc((r.created_at || '').slice(11, 16))}</div>
            </div>
            <button class="btn sm" onclick="attendChamado(${r.id})">Atender</button>
          </div>
        </div>`).join('') : '<div class="empty">Nenhum chamado pendente. 🎉</div>'}
    </div>`;
}
async function attendChamado(id) {
  try { await api(`/api/dw-requests/${id}/attend`, { method: 'POST' }); refreshKdsBadges(); renderChamados(true); }
  catch (e) { toast(e.message, 'err'); }
}

/* ============================================================ IMPRESSÃO (COZINHA) */
let IMP_TAB = 'config';
function impTab(t) { IMP_TAB = t; renderImpressao(); }
async function renderImpressao(silent) {
  const el = document.getElementById('content');
  let mon, pr; try { [mon, pr] = await Promise.all([api('/api/print/monitor'), api('/api/print/printer')]); }
  catch (e) { if (!silent) el.innerHTML = `<div class="empty">${e.message}</div>`; return; }
  const p = pr.printer, imp = mon.impressora || {};
  const stColor = { online: 'var(--ok)', erro: 'var(--danger)', offline: 'var(--ink-3)' }[imp.status] || 'var(--ink-3)';
  const stLabel = { online: '🟢 ONLINE', erro: '⚠️ ERRO', offline: '🔴 OFFLINE' }[imp.status] || '🔴 OFFLINE';
  const tabs = [['config', 'Impressora'], ['monitor', 'Monitor'], ['agents', 'Agente (PC da cozinha)'], ['queue', 'Fila']];
  el.innerHTML = `
    <div class="section-title mt0"><h2>Impressão na cozinha</h2>
      <span class="badge" style="background:${stColor}22;color:${stColor};font-weight:800">${stLabel}</span></div>
    <div class="chips" style="margin-bottom:14px">${tabs.map(([v, l]) => `<button class="chip ${IMP_TAB === v ? 'active' : ''}" onclick="impTab('${v}')">${l}</button>`).join('')}</div>
    <div id="imp-body"></div>`;
  const body = document.getElementById('imp-body');
  if (IMP_TAB === 'config') {
    const chk = (k, l) => `<label class="opt-row" style="justify-content:space-between"><span>${l}</span><input type="checkbox" id="pf-${k}" ${p[k] ? 'checked' : ''}></label>`;
    body.innerHTML = `
      <div class="card">
        <div class="grid2">
          <div class="field"><label>Nome da impressora</label><input id="pf-nome" value="${esc(p.nome)}"></div>
          <div class="field"><label>Tipo de conexão</label><select id="pf-conn"><option value="network" ${p.conn_type === 'network' ? 'selected' : ''}>Rede / IP (TCP · ESC/POS)</option><option value="usb" ${p.conn_type === 'usb' ? 'selected' : ''}>USB (futuro)</option><option value="bluetooth" ${p.conn_type === 'bluetooth' ? 'selected' : ''}>Bluetooth (futuro)</option></select></div>
          <div class="field"><label>IP da impressora</label><input id="pf-ip" value="${esc(p.ip)}" placeholder="192.168.1.100"></div>
          <div class="field"><label>Porta</label><input id="pf-porta" type="number" value="${p.porta}" placeholder="9100"></div>
          <div class="field"><label>Largura do papel</label><select id="pf-width"><option value="80" ${p.paper_width === 80 ? 'selected' : ''}>80 mm</option><option value="58" ${p.paper_width === 58 ? 'selected' : ''}>58 mm</option></select></div>
        </div>
        <div style="margin-top:8px;font-weight:700">O que imprimir no ticket</div>
        <div class="grid2" style="margin-top:6px">
          ${chk('auto_print', 'Impressão automática')}${chk('auto_cut', 'Corte automático')}
          ${chk('print_header', 'Cabeçalho (RANGO · COZINHA)')}${chk('print_mesa', 'Mesa')}
          ${chk('print_comanda', 'Comanda')}${chk('print_garcom', 'Garçom')}
          ${chk('print_obs', 'Observações')}${chk('print_horario', 'Horário')}
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
          <button class="btn" onclick="savePrinter()">Salvar configuração</button>
          <button class="btn ghost" onclick="testPrint()">🖨 Testar impressão</button>
        </div>
      </div>
      <p class="muted" style="margin-top:12px">A impressão é <b>somente da cozinha</b> e <b>nunca bloqueia o pedido</b>: se a impressora estiver offline, o pedido continua no painel da cozinha e é impresso automaticamente quando ela voltar.</p>`;
  } else if (IMP_TAB === 'monitor') {
    body.innerHTML = `
      <div class="stats" style="margin-bottom:14px">
        <div class="stat"><div class="label">Impressos hoje</div><div class="value">${mon.impressos_hoje}</div></div>
        <div class="stat"><div class="label">Aguardando impressão</div><div class="value">${mon.pendentes}</div></div>
        <div class="stat ${mon.falhas ? 'danger' : ''}"><div class="label">Falhas</div><div class="value">${mon.falhas}</div></div>
      </div>
      <div class="card tight">
        <div><b>Impressora da Cozinha</b> · <span style="color:${stColor};font-weight:800">${stLabel}</span></div>
        <div class="tiny">Última comunicação: ${esc((imp.last_seen || '—').slice(11, 19) || '—')} · Última impressão: ${esc((imp.last_print_at || '—').slice(11, 19) || '—')}</div>
        ${imp.last_error ? `<div class="tiny" style="color:var(--danger)">Último erro: ${esc(imp.last_error)}</div>` : ''}
      </div>`;
  } else if (IMP_TAB === 'agents') {
    body.innerHTML = `
      <div class="card">
        <p>O <b>Rango Print Agent</b> é um pequeno programa instalado no computador da cozinha. Ele busca os pedidos e envia para a impressora térmica (ESC/POS) na rede local.</p>
        <button class="btn" onclick="newAgent()">+ Gerar credencial do agente</button>
        <p class="muted" style="margin-top:8px">Baixe o agente e o guia em <b>/agent/</b> no servidor. Cada agente tem credencial própria e pode ser revogado aqui.</p>
      </div>
      <div class="card tight" style="margin-top:12px"><div style="overflow-x:auto"><table class="tbl">
        <thead><tr><th>Agente</th><th>PC</th><th>Versão</th><th>Status</th><th>Última comunicação</th><th></th></tr></thead>
        <tbody>${(mon.agentes || []).map(a => `<tr>
          <td>${esc(a.nome)}${a.revoked ? ' <span class="badge danger">revogado</span>' : ''}</td>
          <td class="tiny">${esc(a.hostname || '—')}</td><td class="tiny">${esc(a.versao || '—')}</td>
          <td>${a.status === 'online' && !a.revoked ? '<span class="badge ok">online</span>' : '<span class="badge mut">offline</span>'}</td>
          <td class="tiny">${esc((a.last_seen || '—').slice(0, 16))}</td>
          <td class="right">${a.revoked ? '' : `<button class="btn danger sm" onclick="revokeAgent(${a.id})">Revogar</button>`}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="muted">Nenhum agente cadastrado.</td></tr>'}</tbody></table></div></div>`;
  } else if (IMP_TAB === 'queue') {
    let q; try { q = await api('/api/print/queue'); } catch { q = { jobs: [] }; }
    const stBadge = { PENDING: '<span class="badge mut">na fila</span>', PRINTING: '<span class="badge">imprimindo</span>', PRINTED: '<span class="badge ok">impresso</span>', FAILED: '<span class="badge danger">falhou</span>', CANCELLED: '<span class="badge mut">cancelado</span>' };
    body.innerHTML = `<div class="card tight"><div style="overflow-x:auto"><table class="tbl">
      <thead><tr><th>Job</th><th>Tipo</th><th>Pedido</th><th>Status</th><th>Tentativas</th><th>Quando</th><th></th></tr></thead>
      <tbody>${(q.jobs || []).map(j => `<tr>
        <td>#${j.id}</td><td>${esc(j.tipo)}</td><td>${j.order_id ? '#' + j.order_id : '—'}</td>
        <td>${stBadge[j.status] || j.status}</td><td>${j.retry_count || 0}</td>
        <td class="tiny">${esc((j.printed_at || j.created_at || '').slice(5, 16))}</td>
        <td class="right">${j.order_id ? `<button class="btn ghost sm" onclick="reprintPedido(${j.order_id})">Reimprimir</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="7" class="muted">Fila vazia.</td></tr>'}</tbody></table></div></div>`;
  }
}
async function savePrinter() {
  const g = (id) => document.getElementById(id);
  const body = { nome: g('pf-nome').value, conn_type: g('pf-conn').value, ip: g('pf-ip').value, porta: g('pf-porta').value, paper_width: g('pf-width').value };
  for (const k of ['auto_print', 'auto_cut', 'print_header', 'print_mesa', 'print_comanda', 'print_garcom', 'print_obs', 'print_horario']) body[k] = g('pf-' + k).checked ? 1 : 0;
  try { await api('/api/print/printer', { method: 'PUT', body }); toast('Configuração salva.', 'ok'); renderImpressao(true); } catch (e) { toast(e.message, 'err'); }
}
async function testPrint() {
  try { const r = await api('/api/print/test', { method: 'POST' }); toast(r.message || 'Teste enviado.', 'ok'); } catch (e) { toast(e.message, 'err'); }
}
async function newAgent() {
  const nome = prompt('Nome do agente (ex.: PC da Cozinha):', 'PC da Cozinha'); if (nome === null) return;
  try {
    const r = await api('/api/print/agents', { method: 'POST', body: { nome } });
    openModal(`<h3>Credencial do agente criada</h3>
      <p>Copie o token agora — ele <b>não será exibido novamente</b>. Cole no arquivo de configuração do Rango Print Agent.</p>
      <div class="field"><label>Token do agente</label><input id="agtok" value="${esc(r.token)}" readonly onclick="this.select()"></div>
      <button class="btn block" onclick="navigator.clipboard.writeText(document.getElementById('agtok').value);toast('Token copiado.','ok')">Copiar token</button>
      <p class="muted" style="margin-top:10px">Depois de configurar o agente no PC da cozinha, ele aparecerá como <b>online</b> aqui.</p>`);
    renderImpressao(true);
  } catch (e) { toast(e.message, 'err'); }
}
async function revokeAgent(id) {
  if (!confirm('Revogar este agente? Ele deixará de imprimir imediatamente.')) return;
  try { await api('/api/print/agents/' + id, { method: 'DELETE' }); toast('Agente revogado.', 'ok'); renderImpressao(true); } catch (e) { toast(e.message, 'err'); }
}
async function reprintPedido(pedidoId) {
  if (!confirm('Tem certeza que deseja reimprimir este pedido na cozinha?')) return;
  try { await api('/api/print/reprint/' + pedidoId, { method: 'POST' }); toast('Reimpressão enviada.', 'ok'); renderImpressao(true); } catch (e) { toast(e.message, 'err'); }
}

/* ============================================================ QR DAS MESAS */
async function renderQrMesas() {
  const el = document.getElementById('content');
  let d; try { d = await api('/api/tables/qr-tokens'); } catch (e) { el.innerHTML = `<div class="empty">${e.message}</div>`; return; }
  const origin = location.origin;
  el.innerHTML = `
    <div class="section-title mt0"><h2>QR Code das mesas</h2><button class="btn ghost sm" onclick="window.print()">🖨 Imprimir todos</button></div>
    <p class="muted" style="margin:-6px 0 14px">Cada mesa tem um QR exclusivo. O cliente escaneia, abre o <b>Garçom Digital do Rango</b> e faz o pedido direto da mesa.</p>
    <div class="qr-grid">
      ${d.tables.map(t => { const url = `${origin}/m/${d.slug}/${t.qr_token}`; return `
        <div class="qr-card">
          <div class="qr-box" id="qr-${t.id}"></div>
          <div class="qr-label">${esc(t.label)}</div>
          <div class="tiny">${esc(t.zone || '')}</div>
          <a class="tiny" href="${url}" target="_blank" style="word-break:break-all">${esc('/m/' + d.slug + '/' + t.qr_token.slice(0, 6) + '…')}</a>
          <div style="margin-top:8px"><a class="btn sm" style="background:#25D366;color:#fff;text-decoration:none" href="https://wa.me/?text=${encodeURIComponent('Cardápio e pedidos da ' + t.label + ' no Rango: ' + url)}" target="_blank">💬 Enviar no WhatsApp</a></div>
        </div>`; }).join('')}
    </div>`;
  // Gera os QR Codes (lib via CDN). Fallback: link clicável acima.
  const draw = () => { for (const t of d.tables) { const box = document.getElementById('qr-' + t.id); if (box && window.QRCode) { box.innerHTML = ''; new QRCode(box, { text: `${origin}/m/${d.slug}/${t.qr_token}`, width: 150, height: 150, colorDark: '#021324', colorLight: '#ffffff' }); } } };
  if (window.QRCode) draw();
  else { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = draw; document.head.appendChild(s); }
}

/* =========================================================================
   MÓDULO ADEGA/BAR — telas (Dashboard, Venda Rápida, Vendas, Perdas e Consumo,
   CMV, Caixa). Reutiliza api/esc/brl/openModal/toast e o motor do backend.
   ========================================================================= */
function reaisToCents(v) { const n = Number(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')); return Math.max(0, Math.round((isFinite(n) ? n : 0) * 100)); }
// Custo por unidade: mostra mais casas quando é fração de centavo (ex.: R$ 0,1284/ml, R$ 0,0060/g).
function custoFmt(cents) { const r = Number(cents || 0) / 100; if (r > 0 && r < 1) return 'R$ ' + r.toFixed(4).replace('.', ','); return 'R$ ' + r.toFixed(2).replace('.', ','); }
const BAR_RANGES = [['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Este mês'], ['mes_ant', 'Mês anterior']];
function barRangeSel(cur, fn) {
  return `<select class="input sm" style="width:auto" onchange="${fn}({range:this.value})">` +
    BAR_RANGES.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('') + `</select>`;
}
function barHead(title, cur, fn, extra = '') {
  return `<div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
    <div style="font-weight:800;font-size:19px">${esc(title)}</div>
    <div class="row" style="gap:8px;align-items:center">${extra}${barRangeSel(cur, fn)}</div></div>`;
}
function kpi(label, value, sub = '', accent = '') {
  return `<div class="kpi"><div class="kpi-val" style="${accent ? 'color:' + accent : ''}">${value}</div><div class="kpi-lbl">${esc(label)}</div>${sub ? `<div class="small mut" style="margin-top:3px">${sub}</div>` : ''}</div>`;
}
const PG_LABEL = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito', outros: 'Outros' };

/* ----------------------------------------------------------- BAR · DASHBOARD */
async function renderBarDashboard(opts = {}) {
  const range = opts.range || 'hoje';
  const el = document.getElementById('content');
  let d; try { d = await api('/api/bar/dashboard?range=' + range); } catch (e) { el.innerHTML = `<div class="card">Erro: ${esc(e.message)}</div>`; return; }
  const baixo = (d.estoque_baixo || []).map(b => `<div class="rank-row"><span>${esc(b.nome)}</span><span class="${b.sem ? 'danger' : 'warn'}" style="font-weight:700">${b.sem ? 'SEM ESTOQUE' : (b.atual + ' ' + esc(b.unidade))}</span></div>`).join('') || '<div class="small mut">Tudo em dia.</div>';
  const rank = (d.ranking || []).map((r, i) => `<div class="rank-row"><span>${i + 1}. ${esc(r.nome)}</span><span>${r.qtd}x · ${brl(r.faturamento_cents)} · <b>${r.margem}%</b></span></div>`).join('') || '<div class="small mut">Sem vendas no período.</div>';
  const cons = Object.entries(d.consumo_por_categoria || {}).filter(([k, v]) => v > 0)
    .map(([k, v]) => `<div class="rank-row"><span>${esc((BAR_CONSUMO_LABEL[k]) || k)}</span><span>${brl(v)}</span></div>`).join('') || '<div class="small mut">Nenhuma perda/consumo no período.</div>';
  el.innerHTML = barHead('Painel do Bar · ' + d.range, range, 'renderBarDashboard',
      `<button class="btn primary sm" onclick="go('bar_pos')">+ Lançar venda</button>`) + `
    <div class="kpi-grid">
      ${kpi('Faturamento', brl(d.faturamento_cents), d.vendas + ' venda(s)', '#1b9e52')}
      ${kpi('Custo (CMV)', brl(d.custo_cents), 'CMV ' + d.cmv + '%')}
      ${kpi('Lucro bruto', brl(d.lucro_cents), 'Margem ' + d.margem + '%', '#1b9e52')}
      ${kpi('Ticket médio', brl(d.ticket_medio_cents))}
      ${kpi('Itens vendidos', d.itens_vendidos, d.doses_vendidas + ' dose(s)')}
      ${kpi('Perdas e consumo', brl(d.consumo_total_cents), 'não entra no faturamento', '#e0352b')}
    </div>
    <div class="dash-grid" style="margin-top:16px">
      <div class="card"><h3 style="margin:0 0 10px">⚠ Estoque crítico ${d.estoque_baixo_total ? `<span class="nav-badge">${d.estoque_baixo_total}</span>` : ''}</h3>${baixo}</div>
      <div class="card"><h3 style="margin:0 0 10px">🏆 Ranking (faturamento)</h3>${rank}</div>
      <div class="card"><h3 style="margin:0 0 10px">💧 Perdas e consumo por tipo</h3>${cons}</div>
    </div>`;
}

/* --------------------------------------------------------- BAR · VENDA RÁPIDA */
let barCart = [];
async function renderBarPOS() {
  const el = document.getElementById('content');
  let data; try { data = await api('/api/bar/catalog'); } catch (e) { el.innerHTML = `<div class="card">Erro: ${esc(e.message)}</div>`; return; }
  barPOSCatalog = data.catalogo || [];
  el.innerHTML = `
    <div class="pos-wrap">
      <div class="pos-left">
        <input id="pos-search" class="input" placeholder="Buscar produto…" oninput="barPOSFilter()" autocomplete="off" style="margin-bottom:10px">
        <div id="pos-cats" class="pos-cats"></div>
        <div id="pos-grid" class="pos-grid"></div>
      </div>
      <div class="pos-right card" id="pos-cart"></div>
    </div>`;
  barPOSCat = ''; barPOSRenderCats(); barPOSRenderGrid(); barRenderCart();
}
let barPOSCatalog = [], barPOSCat = '';
// Filtros de alto nível do Lançar Venda (seção 4).
const POS_FILTROS = [['', 'Todos'], ['bebida', 'Bebidas'], ['dose', 'Doses'], ['drink', 'Drinks'], ['conveniencia', 'Conveniência']];
function barPOSRenderCats() {
  const host = document.getElementById('pos-cats'); if (!host) return;
  host.innerHTML = POS_FILTROS.map(([k, l]) => `<button class="chip ${barPOSCat === k ? 'active' : ''}" onclick="barPOSCat='${k}';barPOSRenderCats();barPOSRenderGrid()">${l}</button>`).join('');
}
function barPOSFilter() { barPOSRenderGrid(); }
function barPOSRenderGrid() {
  const host = document.getElementById('pos-grid'); if (!host) return;
  const q = (document.getElementById('pos-search')?.value || '').toLowerCase().trim();
  const list = barPOSCatalog.filter(c => (!barPOSCat || (c.filtro || 'bebida') === barPOSCat) && (!q || c.nome.toLowerCase().includes(q)));
  if (!list.length) { host.innerHTML = '<div class="small mut" style="padding:20px">Nenhum produto neste filtro. Cadastre em Produtos (Bebidas/Conveniência) ou Doses/Drinks.</div>'; return; }
  const tipoTag = { dose: '🥃 dose', garrafa: '🍾 garrafa', drink: '🍹 drink', produto: '' };
  const hasCaixa = c => (c.formas || []).some(f => f.forma === 'caixa');
  const estTxt = c => c.estoque_disponivel != null ? ` · ${c.estoque_disponivel} ${esc(c.unidade || 'un')}${hasCaixa(c) && c.caixas_estoque ? ' (' + c.caixas_estoque + ' cx)' : ''} disp.` : '';
  host.innerHTML = list.map((c, ci) => {
    const formas = c.formas || [{ forma: 'unidade', preco_cents: c.preco_cents, label: '' }];
    if (formas.length === 1) {
      return `<button class="pos-item" onclick="barAddItem(${ci},'${formas[0].forma}')">
        <div class="pos-item-name">${esc(c.nome)}</div>
        <div class="pos-item-meta">${tipoTag[c.tipo] || ''}${estTxt(c)}</div>
        <div class="pos-item-price">${brl(formas[0].preco_cents)}</div>
      </button>`;
    }
    // produto com duas formas: card com dois botões (Unidade / Caixa)
    return `<div class="pos-item" style="cursor:default">
      <div class="pos-item-name">${esc(c.nome)}</div>
      <div class="pos-item-meta">${tipoTag[c.tipo] || ''}${estTxt(c)}</div>
      <div style="display:flex;gap:6px;margin-top:4px">${formas.map(f => `<button class="btn sm" style="flex:1;padding:7px 4px" onclick="barAddItem(${ci},'${f.forma}')"><div style="font-size:11px;opacity:.8">${esc(f.label || 'Unidade')}</div><b>${brl(f.preco_cents)}</b></button>`).join('')}</div>
    </div>`;
  }).join('');
}
function barAddItem(ci, forma) {
  const c = barPOSCatalog[ci]; if (!c) return;
  forma = forma || 'unidade';
  const f = (c.formas || []).find(x => x.forma === forma) || { forma: 'unidade', preco_cents: c.preco_cents, label: '', unidades: 1 };
  const key = c.id + '|' + forma;
  const nome = c.nome + (forma === 'caixa' ? ' · ' + (f.label || 'Caixa') : '');
  const ex = barCart.find(i => i.key === key);
  if (ex) ex.qtd++; else barCart.push({ key, id: c.id, forma, nome, tipo: c.tipo, preco_cents: f.preco_cents, qtd: 1 });
  barRenderCart();
}
function barCartQty(key, delta) {
  const i = barCart.find(x => x.key === key); if (!i) return;
  i.qtd += delta; if (i.qtd <= 0) barCart = barCart.filter(x => x.key !== key);
  barRenderCart();
}
function barRenderCart() {
  const host = document.getElementById('pos-cart'); if (!host) return;
  const subtotal = barCart.reduce((s, i) => s + i.preco_cents * i.qtd, 0);
  const desc = reaisToCents(document.getElementById('pos-desc')?.value || '0');
  const total = Math.max(0, subtotal - desc);
  const pg = (window._posPg) || 'dinheiro';
  host.innerHTML = `
    <h3 style="margin:0 0 10px">🧾 Venda rápida</h3>
    <div class="pos-cart-items">${barCart.length ? barCart.map(i => `
      <div class="pos-cart-row">
        <div style="flex:1"><div style="font-weight:600">${esc(i.nome)}</div><div class="small mut">${brl(i.preco_cents)} ${i.forma === 'caixa' ? 'cx' : 'un'}</div></div>
        <div class="qty"><button onclick="barCartQty('${i.key}',-1)">−</button><b>${i.qtd}</b><button onclick="barCartQty('${i.key}',1)">+</button></div>
        <div style="width:78px;text-align:right;font-weight:700">${brl(i.preco_cents * i.qtd)}</div>
      </div>`).join('') : '<div class="small mut" style="padding:16px 0">Toque nos produtos para adicionar.</div>'}</div>
    <div class="row" style="justify-content:space-between;margin-top:8px"><span class="mut">Subtotal</span><b>${brl(subtotal)}</b></div>
    <div class="row" style="justify-content:space-between;align-items:center;margin:6px 0"><span class="mut">Desconto R$</span>
      <input id="pos-desc" class="input sm" style="width:90px;text-align:right" value="${(desc/100).toFixed(2).replace('.',',')}" oninput="barRenderCart()"></div>
    <div class="row" style="justify-content:space-between;font-size:20px;font-weight:800;margin:4px 0 10px"><span>Total</span><span>${brl(total)}</span></div>
    <input id="pos-cliente" class="input sm" placeholder="Cliente (opcional)" style="margin-bottom:8px" value="${esc(window._posCliente||'')}" oninput="window._posCliente=this.value">
    <div class="pos-pg">${Object.entries(PG_LABEL).map(([k, l]) => `<button class="chip ${pg === k ? 'active' : ''}" onclick="window._posPg='${k}';barRenderCart()">${l}</button>`).join('')}</div>
    <button class="btn primary block" style="margin-top:12px;font-size:17px;padding:14px" ${barCart.length ? '' : 'disabled'} onclick="barFinalizar()">Lançar venda · ${brl(total)}</button>
    ${barCart.length ? `<button class="btn ghost block sm" style="margin-top:6px" onclick="barCart=[];barRenderCart()">Limpar</button>` : ''}`;
}
async function barFinalizar() {
  if (!barCart.length) return;
  const desc = reaisToCents(document.getElementById('pos-desc')?.value || '0');
  const btn = event?.target; if (btn) btn.disabled = true;
  try {
    const r = await api('/api/bar/vendas', { method: 'POST', body: {
      itens: barCart.map(i => ({ menu_product_id: i.id, quantidade: i.qtd, forma: i.forma })),
      pagamento: window._posPg || 'dinheiro', desconto_cents: desc,
      cliente_nome: window._posCliente || '',
    } });
    const v = r.venda;
    barCart = []; window._posCliente = '';
    toast('Venda #' + v.numero + ' lançada!', 'ok');
    openModal(`<h2 style="margin:0 0 6px">✅ Venda #${v.numero}</h2>
      <div class="small mut" style="margin-bottom:10px">${PG_LABEL[v.pagamento]} · ${new Date().toLocaleTimeString('pt-BR')}</div>
      <div class="kpi-grid" style="grid-template-columns:${can('adega:custos') ? '1fr 1fr' : '1fr'}">
        ${kpi('Total', brl(v.total_cents))}
        ${can('adega:custos') ? kpi('Lucro', brl(v.lucro_cents), 'CMV ' + v.cmv + '% · margem ' + v.margem + '%', '#1b9e52') : ''}
      </div>
      <div style="margin-top:12px">${v.itens.map(i => `<div class="rank-row"><span>${i.quantidade}x ${esc(i.nome)}</span><span>${brl(i.total_cents)}</span></div>`).join('')}</div>
      <button class="btn primary block" style="margin-top:14px" onclick="closeModal()">Nova venda</button>`);
    barRenderCart();
  } catch (e) { toast(e.message || 'Erro ao lançar venda', 'err'); if (btn) btn.disabled = false; }
}

/* -------------------------------------------------------------- BAR · VENDAS */
async function renderBarVendas(opts = {}) {
  const range = opts.range || 'hoje';
  const el = document.getElementById('content');
  let d; try { d = await api('/api/bar/vendas?range=' + range); } catch (e) { el.innerHTML = `<div class="card">Erro: ${esc(e.message)}</div>`; return; }
  const t = d.totais;
  const see = can('adega:custos') && d.pode_ver_custos !== false;
  const rows = (d.vendas || []).map(v => `
    <tr class="${v.status === 'cancelada' ? 'mut' : ''}" style="cursor:pointer" onclick="barVendaDetail(${v.id})">
      <td><b>#${v.numero}</b></td>
      <td>${new Date(v.created_at + 'Z').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
      <td>${esc(PG_LABEL[v.pagamento] || v.pagamento)}</td>
      <td style="text-align:right">${brl(v.total_cents)}</td>
      ${see ? `<td style="text-align:right" class="hide-mobile">${v.status === 'cancelada' ? '—' : brl(v.lucro_cents)}</td>` : ''}
      <td>${v.status === 'cancelada' ? '<span class="danger">Cancelada</span>' : '<span style="color:#1b9e52">Concluída</span>'}</td>
    </tr>`).join('');
  el.innerHTML = barHead('Vendas · ' + d.range, range, 'renderBarVendas') + `
    <div class="kpi-grid">
      ${kpi('Faturamento', brl(t.faturamento_cents), t.vendas + ' venda(s)', '#1b9e52')}
      ${see ? kpi('Lucro', brl(t.lucro_cents), 'margem ' + t.margem + '%') : kpi('Vendas', t.vendas)}
      ${kpi('Ticket médio', brl(t.ticket_medio_cents))}
      ${kpi('Canceladas', t.canceladas)}
    </div>
    <div class="card" style="margin-top:14px;overflow:auto">
      <table class="tbl"><thead><tr><th>Nº</th><th>Data/hora</th><th>Pgto</th><th style="text-align:right">Total</th>${see ? '<th style="text-align:right" class="hide-mobile">Lucro</th>' : ''}<th>Status</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="${see ? 6 : 5}" class="mut" style="padding:18px">Nenhuma venda no período.</td></tr>`}</tbody></table>
    </div>`;
}
async function barVendaDetail(id) {
  let r; try { r = await api('/api/bar/vendas/' + id); } catch (e) { toast(e.message, 'err'); return; }
  const v = r.venda;
  const see = can('adega:custos');
  const itens = v.itens.map(i => `<div class="rank-row"><span>${i.quantidade}x ${esc(i.nome)} <span class="small mut">[${i.tipo}]</span></span><span>${brl(i.total_cents)}${see ? ' · custo ' + brl(i.custo_total_cents) : ''}</span></div>`).join('');
  openModal(`<h2 style="margin:0 0 4px">Venda #${v.numero}</h2>
    <div class="small mut">${new Date(v.created_at + 'Z').toLocaleString('pt-BR')} · ${PG_LABEL[v.pagamento]} ${v.cliente_nome ? '· ' + esc(v.cliente_nome) : ''}</div>
    <div style="margin:12px 0">${itens}</div>
    <div class="row" style="justify-content:space-between"><span class="mut">Subtotal</span><span>${brl(v.subtotal_cents)}</span></div>
    ${v.desconto_cents ? `<div class="row" style="justify-content:space-between"><span class="mut">Desconto</span><span>- ${brl(v.desconto_cents)}</span></div>` : ''}
    <div class="row" style="justify-content:space-between;font-weight:800;font-size:18px"><span>Total</span><span>${brl(v.total_cents)}</span></div>
    ${see ? `<div class="row" style="justify-content:space-between"><span class="mut">Custo (CMV ${v.cmv}%)</span><span>${brl(v.custo_cents)}</span></div>
    <div class="row" style="justify-content:space-between;color:#1b9e52"><span>Lucro (margem ${v.margem}%)</span><span>${brl(v.lucro_cents)}</span></div>` : ''}
    ${v.status === 'cancelada'
      ? `<div class="card" style="margin-top:12px;background:#fff0f0"><b class="danger">Cancelada</b><div class="small">${esc(v.cancel_usuario)} · ${esc(v.cancel_motivo || '—')}</div></div>`
      : (can('adega:write') ? `<button class="btn danger block" style="margin-top:14px" onclick="barCancelVenda(${v.id})">Cancelar venda (devolve estoque)</button>` : '')}`, { wide: true });
}
async function barCancelVenda(id) {
  const motivo = prompt('Motivo do cancelamento:'); if (motivo === null) return;
  try { await api('/api/bar/vendas/' + id + '/cancel', { method: 'POST', body: { motivo } }); toast('Venda cancelada e estoque devolvido.', 'ok'); closeModal(); renderBarVendas(); }
  catch (e) { toast(e.message, 'err'); }
}

/* ------------------------------------------------- BAR · PERDAS E CONSUMO */
const BAR_CONSUMO_LABEL = { consumo_proprietario: 'Consumo do proprietário', consumo_funcionario: 'Consumo de funcionário', consumo_interno: 'Consumo interno', cortesia: 'Cortesia', degustacao: 'Degustação', quebra: 'Quebra', avaria: 'Avaria', vencimento: 'Vencimento', erro_preparo: 'Erro de preparo', outros: 'Outros' };
async function renderBarConsumo(opts = {}) {
  const range = opts.range || '30d';
  const el = document.getElementById('content');
  let d; try { d = await api('/api/bar/consumo?range=' + range); } catch (e) { el.innerHTML = `<div class="card">Erro: ${esc(e.message)}</div>`; return; }
  const cards = Object.entries(d.por_categoria).filter(([k, v]) => v > 0).map(([k, v]) => kpi(BAR_CONSUMO_LABEL[k] || k, brl(v))).join('') || '<div class="small mut">Nenhum registro no período.</div>';
  const rows = (d.registros || []).map(r => `
    <tr>
      <td>${new Date(r.created_at + 'Z').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
      <td>${esc(BAR_CONSUMO_LABEL[r.categoria] || r.categoria)}</td>
      <td>${esc(r.descricao)}</td>
      <td style="text-align:right">${brl(r.custo_cents)}</td>
      <td>${esc(r.responsavel || r.usuario || '')}</td>
      <td>${can('adega:write') ? `<button class="btn ghost sm" onclick="barEstornoConsumo(${r.id})">Estornar</button>` : ''}</td>
    </tr>`).join('');
  el.innerHTML = barHead('Perdas e Consumo · ' + d.range, range, 'renderBarConsumo',
      `<button class="btn primary sm" onclick="barConsumoForm()">+ Registrar</button>`) + `
    <div class="card" style="margin-bottom:14px"><div class="row" style="justify-content:space-between"><b>Total do período (custo)</b><b class="danger" style="font-size:20px">${brl(d.total_cents)}</b></div><div class="small mut">Essas saídas NÃO entram no faturamento — são custo separado do CMV de vendas.</div></div>
    <div class="kpi-grid">${cards}</div>
    <div class="card" style="margin-top:14px;overflow:auto">
      <table class="tbl"><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th style="text-align:right">Custo</th><th>Responsável</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="mut" style="padding:18px">Nenhum registro.</td></tr>'}</tbody></table>
    </div>`;
}
async function barConsumoForm() {
  // carrega alvos possíveis: produtos do cardápio (receitas), bebidas e insumos
  let cat, ins, beb;
  try {
    [cat, beb, ins] = await Promise.all([
      api('/api/bar/catalog'),
      api('/api/adega/produtos').catch(() => ({ produtos: [] })),
      api('/api/estoque/insumos').catch(() => ({ insumos: [] })),
    ]);
  } catch (e) { toast(e.message, 'err'); return; }
  const cats = Object.entries(BAR_CONSUMO_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
  const prods = (cat.catalogo || []).map(c => `<option value="mp:${c.id}">${esc(c.nome)} (receita)</option>`).join('');
  const bebs = (beb.produtos || []).map(b => `<option value="ad:${b.id}">${esc(b.nome)} (bebida)</option>`).join('');
  const inss = (ins.insumos || []).map(i => `<option value="in:${i.id}">${esc(i.nome)} (insumo · ${esc(i.unidade_controle)})</option>`).join('');
  openModal(`<h2 style="margin:0 0 12px">Registrar perda / consumo</h2>
    <label class="field"><span>Categoria</span><select id="co-cat" class="input">${cats}</select></label>
    <label class="field"><span>Item</span><select id="co-alvo" class="input"><optgroup label="Receitas/Produtos">${prods}</optgroup><optgroup label="Bebidas (dose/garrafa/ml)">${bebs}</optgroup><optgroup label="Insumos">${inss}</optgroup></select></label>
    <div class="row" style="gap:10px">
      <label class="field" style="flex:1"><span>Quantidade</span><input id="co-qtd" class="input" type="number" min="0" step="0.01" value="1"></label>
      <label class="field" style="flex:1"><span>Unidade</span><select id="co-un" class="input"><option value="">auto</option><option value="dose">dose</option><option value="garrafa">garrafa</option><option value="ml">ml</option><option value="un">un</option><option value="g">g</option><option value="kg">kg</option><option value="l">l</option></select></label>
    </div>
    <label class="field"><span>Responsável</span><input id="co-resp" class="input" placeholder="Nome (ex.: proprietário, funcionário)"></label>
    <label class="field"><span>Observação</span><input id="co-obs" class="input" placeholder="Opcional"></label>
    <button class="btn primary block" style="margin-top:10px" onclick="barConsumoSalvar()">Registrar baixa</button>
    <div class="small mut" style="margin-top:8px">Baixa o estoque e registra o custo. Para receitas, dá baixa em todos os ingredientes.</div>`, { wide: true });
}
async function barConsumoSalvar() {
  const alvo = document.getElementById('co-alvo').value || '';
  const body = {
    categoria: document.getElementById('co-cat').value,
    quantidade: Number(document.getElementById('co-qtd').value) || 1,
    unidade: document.getElementById('co-un').value || null,
    responsavel: document.getElementById('co-resp').value || '',
    obs: document.getElementById('co-obs').value || '',
  };
  const [kind, id] = alvo.split(':');
  if (kind === 'mp') body.menu_product_id = Number(id);
  else if (kind === 'ad') body.adega_produto_id = Number(id);
  else if (kind === 'in') body.insumo_id = Number(id);
  try { const r = await api('/api/bar/consumo', { method: 'POST', body }); toast('Registrado · custo ' + brl(r.custo_cents), 'ok'); closeModal(); renderBarConsumo(); }
  catch (e) { toast(e.message, 'err'); }
}
async function barEstornoConsumo(id) {
  const motivo = prompt('Motivo do estorno:'); if (motivo === null) return;
  try { await api('/api/bar/consumo/' + id + '/estornar', { method: 'POST', body: { motivo } }); toast('Estornado.', 'ok'); renderBarConsumo(); }
  catch (e) { toast(e.message, 'err'); }
}

/* ----------------------------------------------------------------- BAR · CMV */
async function renderBarCMV(opts = {}) {
  const range = opts.range || 'mes';
  const el = document.getElementById('content');
  let d; try { d = await api('/api/bar/cmv?range=' + range); } catch (e) { el.innerHTML = `<div class="card">Erro: ${esc(e.message)}</div>`; return; }
  const g = d.geral;
  const tipos = (d.por_tipo || []).map(t => `<tr><td>${esc(t.tipo)}</td><td style="text-align:right">${t.qtd}</td><td style="text-align:right">${brl(t.faturamento_cents)}</td><td style="text-align:right">${brl(t.custo_cents)}</td><td style="text-align:right">${t.cmv}%</td><td style="text-align:right">${t.margem}%</td></tr>`).join('');
  const prods = (d.por_produto || []).map(p => `<tr><td>${esc(p.nome)}</td><td style="text-align:right">${p.qtd}</td><td style="text-align:right">${brl(p.faturamento_cents)}</td><td style="text-align:right">${brl(p.custo_cents)}</td><td style="text-align:right">${brl(p.lucro_cents)}</td><td style="text-align:right"><b>${p.cmv}%</b></td><td style="text-align:right">${p.margem}%</td></tr>`).join('');
  const fLabel = { unidade: 'Unidade', caixa: 'Caixa/Fardo' };
  const formas = (d.por_forma || []).map(f => `<tr><td>${fLabel[f.forma] || f.forma}</td><td style="text-align:right">${f.qtd}</td><td style="text-align:right">${brl(f.faturamento_cents)}</td><td style="text-align:right">${brl(f.custo_cents)}</td><td style="text-align:right">${brl(f.lucro_cents)}</td><td style="text-align:right">${f.cmv}%</td><td style="text-align:right">${f.margem}%</td></tr>`).join('');
  el.innerHTML = barHead('CMV · ' + d.range, range, 'renderBarCMV') + `
    <div class="kpi-grid">
      ${kpi('Faturamento', brl(g.faturamento_cents))}
      ${kpi('Custo (CMV)', brl(g.custo_cents), 'CMV ' + g.cmv + '%', '#e0352b')}
      ${kpi('Lucro', brl(g.lucro_cents), 'Margem ' + g.margem + '%', '#1b9e52')}
      ${kpi('CMV geral', g.cmv + '%')}
    </div>
    <div class="dash-grid" style="margin-top:14px">
      <div class="card" style="overflow:auto"><h3 style="margin:0 0 8px">Por tipo</h3>
        <table class="tbl"><thead><tr><th>Tipo</th><th style="text-align:right">Qtd</th><th style="text-align:right">Fat.</th><th style="text-align:right">Custo</th><th style="text-align:right">CMV</th><th style="text-align:right">Margem</th></tr></thead><tbody>${tipos || '<tr><td colspan="6" class="mut">Sem vendas.</td></tr>'}</tbody></table>
      </div>
      <div class="card" style="overflow:auto"><h3 style="margin:0 0 8px">Por forma de venda</h3>
        <table class="tbl"><thead><tr><th>Forma</th><th style="text-align:right">Qtd</th><th style="text-align:right">Fat.</th><th style="text-align:right">Custo</th><th style="text-align:right">Lucro</th><th style="text-align:right">CMV</th><th style="text-align:right">Margem</th></tr></thead><tbody>${formas || '<tr><td colspan="7" class="mut">Sem vendas.</td></tr>'}</tbody></table>
      </div>
    </div>
    <div class="card" style="margin-top:14px;overflow:auto"><h3 style="margin:0 0 8px">Por produto</h3>
      <table class="tbl"><thead><tr><th>Produto</th><th style="text-align:right">Qtd</th><th style="text-align:right">Fat.</th><th style="text-align:right">Custo</th><th style="text-align:right">Lucro</th><th style="text-align:right">CMV</th><th style="text-align:right">Margem</th></tr></thead><tbody>${prods || '<tr><td colspan="7" class="mut">Sem vendas.</td></tr>'}</tbody></table>
    </div>`;
}

/* --------------------------------------------------------------- BAR · CAIXA */
async function renderBarCaixa() {
  const el = document.getElementById('content');
  let d; try { d = await api('/api/bar/caixa'); } catch (e) { el.innerHTML = `<div class="card">Erro: ${esc(e.message)}</div>`; return; }
  if (!d.aberto) {
    const u = d.ultimo;
    el.innerHTML = `<div style="font-weight:800;font-size:19px;margin-bottom:14px">Caixa</div>
      <div class="card" style="max-width:460px">
        <h3 style="margin:0 0 10px">Abrir caixa</h3>
        <label class="field"><span>Fundo de troco (R$)</span><input id="cx-ab" class="input" type="text" value="0,00"></label>
        <button class="btn primary block" onclick="barAbrirCaixa()">Abrir caixa</button>
      </div>
      ${u && u.fechado_at ? `<div class="card" style="margin-top:14px;max-width:460px"><h3 style="margin:0 0 8px">Último fechamento</h3>
        <div class="row" style="justify-content:space-between"><span class="mut">Esperado</span><span>${brl(u.esperado_cents)}</span></div>
        <div class="row" style="justify-content:space-between"><span class="mut">Informado</span><span>${brl(u.informado_cents)}</span></div>
        <div class="row" style="justify-content:space-between;font-weight:700"><span>Diferença</span><span class="${u.diferenca_cents < 0 ? 'danger' : ''}">${brl(u.diferenca_cents)}</span></div>
        <div class="small mut">${new Date(u.fechado_at + 'Z').toLocaleString('pt-BR')} · ${esc(u.usuario_fechamento || '')}</div></div>` : ''}`;
    return;
  }
  const c = d.caixa, r = d.resumo;
  const formas = Object.entries(r.porForma).map(([k, v]) => `<div class="rank-row"><span>${esc(PG_LABEL[k] || k)}</span><span>${brl(v)}</span></div>`).join('');
  el.innerHTML = `<div style="font-weight:800;font-size:19px;margin-bottom:14px">Caixa aberto</div>
    <div class="kpi-grid">
      ${kpi('Faturamento', brl(r.faturamento_cents), r.vendas + ' venda(s)', '#1b9e52')}
      ${can('adega:custos') ? kpi('Lucro', brl(r.lucro_cents)) : kpi('Vendas', r.vendas)}
      ${kpi('Dinheiro esperado', brl(d.esperado_dinheiro_cents), 'fundo ' + brl(c.abertura_cents))}
      ${kpi('Canceladas', r.canceladas)}
    </div>
    <div class="dash-grid" style="margin-top:14px">
      <div class="card"><h3 style="margin:0 0 8px">Por forma de pagamento</h3>${formas}</div>
      <div class="card">
        <h3 style="margin:0 0 10px">Fechar caixa</h3>
        <label class="field"><span>Valor contado em dinheiro (R$)</span><input id="cx-inf" class="input" type="text" value="${(d.esperado_dinheiro_cents/100).toFixed(2).replace('.',',')}"></label>
        <label class="field"><span>Observação</span><input id="cx-obs" class="input" placeholder="Opcional"></label>
        <button class="btn primary block" onclick="barFecharCaixa()">Fechar caixa</button>
        <div class="small mut" style="margin-top:6px">Aberto em ${new Date(c.aberto_at + 'Z').toLocaleString('pt-BR')} por ${esc(c.usuario_abertura || '')}</div>
      </div>
    </div>`;
}
async function barAbrirCaixa() {
  try { await api('/api/bar/caixa/abrir', { method: 'POST', body: { abertura_cents: reaisToCents(document.getElementById('cx-ab').value) } }); toast('Caixa aberto.', 'ok'); renderBarCaixa(); }
  catch (e) { toast(e.message, 'err'); }
}
async function barFecharCaixa() {
  try {
    const r = await api('/api/bar/caixa/fechar', { method: 'POST', body: { informado_cents: reaisToCents(document.getElementById('cx-inf').value), obs: document.getElementById('cx-obs').value || '' } });
    const dif = r.caixa.diferenca_cents;
    toast('Caixa fechado. Diferença ' + brl(dif), dif === 0 ? 'ok' : 'err');
    renderBarCaixa();
  } catch (e) { toast(e.message, 'err'); }
}

/* ------------------------------------------------------- BAR · CONVENIÊNCIA */
let BARCONV = { produtos: [], categorias: [] };
let BARCONV_GRUPO = 'conveniencia';
let _cvEditing = { p: null, id: 0 };
const VOL_UNITS = ['ml', 'l', 'cl', 'mg', 'g', 'kg', 'litro', 'litros'];
// Produto controlado por CAIXA/FARDO: vem em embalagem múltipla (qtd>1) e a unidade é
// contável (lata, un, garrafa…), não volume (ml/g). Estoque informado em caixas.
function barConvIsCaixa(qc, unidade) { return (Number(qc) || 1) > 1 && !VOL_UNITS.includes(String(unidade || '').toLowerCase().trim()); }
function barConvEstoqueTotal() {
  const qc = Number((document.getElementById('cv-qc') || {}).value) || 1;
  const cx = Number((document.getElementById('cv-est-cx') || {}).value) || 0;
  const un = Number((document.getElementById('cv-est-un') || {}).value) || 0;
  const t = document.getElementById('cv-est-total'); if (t) t.innerHTML = `<b style="color:#1b9e52">${cx * qc + un}</b> un`;
}
function barConvEstoqueMode() {
  const host = document.getElementById('cv-estoque-fields'); if (!host) return;
  const p = _cvEditing.p, isNew = !_cvEditing.id;
  const qc = Number((document.getElementById('cv-qc') || {}).value) || 1;
  const un = ((document.getElementById('cv-un') || {}).value || 'un').trim();
  const caixa = barConvIsCaixa(qc, un);
  if (caixa) {
    const minCx = p ? +((p.estoque_minimo || 0) / qc).toFixed(2) : 0;
    const idealCx = p ? +((p.estoque_ideal || 0) / qc).toFixed(2) : 0;
    host.innerHTML = `
      ${isNew ? `<div class="row" style="gap:10px">
        <label class="field" style="flex:1"><span>Caixas em estoque</span><input id="cv-est-cx" type="number" min="0" step="1" value="0" oninput="barConvEstoqueTotal()"></label>
        <label class="field" style="flex:1"><span>Unidades abertas</span><input id="cv-est-un" type="number" min="0" step="1" value="0" oninput="barConvEstoqueTotal()"></label>
        <div class="field" style="flex:1"><span>Total disponível</span><div id="cv-est-total" style="font-weight:800;font-size:16px;padding:9px 0"></div></div>
      </div>`
      : `<div class="card tight" style="margin:0 0 10px">Estoque atual: <b>📦 ${p.caixas_estoque} caixas · 🍺 ${p.resto_estoque} ${esc(un)}</b> · = ${p.estoque_atual} ${esc(un)}<div class="small mut">Use "+ Estoque", Compras ou Inventário para movimentar.</div></div>`}
      <div class="row" style="gap:10px">
        <label class="field" style="flex:1"><span>Estoque mínimo (caixas)</span><input id="cv-min-cx" type="number" min="0" step="0.01" value="${minCx}"></label>
        <label class="field" style="flex:1"><span>Estoque ideal (caixas)</span><input id="cv-ideal-cx" type="number" min="0" step="0.01" value="${idealCx}"></label>
        <div class="field" style="flex:1"></div>
      </div>`;
    barConvEstoqueTotal();
  } else {
    host.innerHTML = `<div class="row" style="gap:10px">
      <label class="field" style="flex:1"><span>Estoque atual</span><input id="cv-est" type="number" min="0" step="0.01" value="${p ? p.estoque_atual : 0}" ${p ? 'disabled title="Use + Estoque para movimentar"' : ''}></label>
      <label class="field" style="flex:1"><span>Estoque mínimo</span><input id="cv-min" type="number" min="0" step="0.01" value="${p ? p.estoque_minimo : 0}"></label>
      <label class="field" style="flex:1"><span>Estoque ideal</span><input id="cv-ideal" type="number" min="0" step="0.01" value="${p ? p.estoque_ideal : 0}"></label>
    </div>`;
  }
}
// Categorias sugeridas da Adega (seção 3) — por grupo.
const CAT_SUGEST = {
  bebida: ['Cervejas', 'Cervejas Long Neck', 'Cervejas 600ml', 'Cervejas Lata', 'Destilados', 'Whisky', 'Vodka', 'Gin', 'Cachaça', 'Tequila', 'Licores', 'Vinhos', 'Espumantes', 'Energéticos', 'Refrigerantes', 'Água', 'Água Tônica', 'Sucos', 'Gelo'],
  conveniencia: ['Chocolates', 'Balas', 'Chicletes', 'Pirulitos', 'Doces', 'Amendoins', 'Salgadinhos', 'Snacks', 'Carvão', 'Essências', 'Narguilé', 'Descartáveis', 'Copos', 'Outros'],
};
function convStatus(p) {
  if (p.sem_estoque) return '<span class="badge danger">🔴 Sem estoque</span>';
  if (p.baixo) return '<span class="badge warn">🟡 Baixo</span>';
  return '<span class="badge ok">🟢 Normal</span>';
}
async function renderBarProdutos(grupo = 'conveniencia') {
  BARCONV_GRUPO = grupo;
  const el = document.getElementById('content');
  let d; try { d = await api('/api/bar/conveniencia?all=1&grupo=' + grupo); } catch (e) { el.innerHTML = `<div class="card">Erro: ${esc(e.message)}</div>`; return; }
  BARCONV = d;
  const titulo = grupo === 'bebida' ? 'Bebidas' : 'Conveniência';
  const dica = grupo === 'bebida' ? 'Cervejas, destilados (por ML), energéticos, gelo…' : 'Chocolates, snacks, carvão, essências, copos…';
  const ativos = d.produtos.filter(p => p.active);
  const rows = ativos.map(p => `<tr>
    <td><b>${esc(p.nome)}</b>${p.marca ? ` <span class="small mut">${esc(p.marca)}</span>` : ''}${p.vende_direto ? '' : ' <span class="badge mut">ingrediente</span>'}</td>
    <td>${esc(p.categoria)}</td>
    <td style="text-align:right">${p.qtd_por_compra > 1 ? `📦 ${p.caixas_estoque} cx · 🍺 ${p.resto_estoque}<div class="small mut">= ${p.estoque_atual} ${esc(p.unidade)} · ${p.qtd_por_compra}/cx</div>` : `${p.estoque_atual} ${esc(p.unidade)}`}</td>
    <td style="text-align:right">${custoFmt(p.custo_unit_cents)}</td>
    <td style="text-align:right">${p.vende_direto ? brl(p.preco_venda_cents) : '—'}${p.vende_caixa ? `<div class="small mut">cx ${brl(p.preco_caixa_cents)}</div>` : ''}</td>
    <td style="text-align:right">${p.vende_direto ? p.margem + '%' : '—'}${p.vende_caixa ? `<div class="small mut">${p.margem_caixa}%</div>` : ''}</td>
    <td>${convStatus(p)}</td>
    <td style="white-space:nowrap">
      <button class="btn ghost sm" onclick="barConvEntrada(${p.id})" title="Registrar compra/entrada">+ Estoque</button>
      <button class="btn ghost sm" onclick="barConvForm(${p.id})">Editar</button>
    </td></tr>`).join('');
  el.innerHTML = `<div style="font-weight:800;font-size:19px;margin-bottom:12px">${titulo}</div>
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
      <div class="small mut">${ativos.length} produto(s) · ${dica}</div>
      <button class="btn primary sm" onclick="barConvForm(0,'${grupo}')">+ Novo produto</button>
    </div>
    <div class="card" style="overflow:auto"><table class="tbl"><thead><tr><th>Produto</th><th>Categoria</th><th style="text-align:right">Estoque</th><th style="text-align:right">Custo/un</th><th style="text-align:right">Preço</th><th style="text-align:right">Margem</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8" class="mut" style="padding:18px">Nenhum produto. Clique em “+ Novo produto”.</td></tr>'}</tbody></table></div>`;
}
function barConvCatList(grupo) { return [...new Set([...(CAT_SUGEST[grupo] || []), ...(BARCONV.categorias || []).map(c => c.name)])]; }
function barConvForm(id, grupoDefault) {
  const p = id ? BARCONV.produtos.find(x => x.id === id) : null;
  _cvEditing = { p: p || null, id: id || 0 };
  const grupo = p ? (p.grupo || 'conveniencia') : (grupoDefault || BARCONV_GRUPO || 'conveniencia');
  const dl = barConvCatList(grupo).map(n => `<option value="${esc(n)}"></option>`).join('');
  const v = (k, d = '') => p ? (p[k] != null ? p[k] : d) : d;
  const money = c => ((c || 0) / 100).toFixed(2).replace('.', ',');
  const unOn = p ? !!p.vende_direto : true;
  const cxOn = !!(p && p.vende_caixa);
  const SH = 'font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-3);font-size:11.5px;margin:16px 0 8px;border-bottom:1px solid var(--line);padding-bottom:5px';
  openModal(`<h2 style="margin:0 0 4px">${p ? 'Editar produto' : 'Novo produto'}</h2>
    <div style="${SH};margin-top:10px">Produto</div>
    <div class="row" style="gap:10px"><label class="field" style="flex:2"><span>Nome *</span><input id="cv-nome" value="${esc(v('nome'))}"></label>
      <label class="field" style="flex:1"><span>Grupo</span><select id="cv-grupo"><option value="bebida" ${grupo === 'bebida' ? 'selected' : ''}>Bebida</option><option value="conveniencia" ${grupo !== 'bebida' ? 'selected' : ''}>Conveniência</option></select></label></div>
    <div class="row" style="gap:10px">
      <label class="field" style="flex:1"><span>Categoria</span><input id="cv-cat" list="cv-cats" value="${esc(v('categoria'))}" placeholder="ex.: Whisky, Energéticos, Snacks…"><datalist id="cv-cats">${dl}</datalist></label>
      <label class="field" style="flex:1"><span>Marca</span><input id="cv-marca" value="${esc(v('marca'))}"></label>
      <label class="field" style="flex:1"><span>Unidade</span><input id="cv-un" value="${esc(v('unidade', 'un'))}" placeholder="un, lata, ml, g, garrafa…" oninput="barConvMargemPreview();barConvEstoqueMode()"></label>
    </div>

    <div style="${SH}">Embalagem de compra</div>
    <div class="row" style="gap:10px">
      <label class="field" style="flex:1"><span>Quantidade por caixa/fardo</span><input id="cv-qc" type="number" min="1" step="1" value="${v('qtd_por_compra', 1)}" oninput="barConvMargemPreview();barConvEstoqueMode()"><div class="small mut" id="cv-qc-hint" style="margin-top:3px">ⓘ Informe quantas unidades vêm em cada caixa ou fardo.</div></label>
      <label class="field" style="flex:1"><span>Custo da compra por caixa/fardo (R$)</span><input id="cv-custo" value="${money(v('custo_compra_cents', 0))}" oninput="barConvMargemPreview()"></label>
      <div class="field" style="flex:1"><span>Custo calculado por unidade</span><div id="cv-custo-unit" style="font-weight:800;font-size:18px;padding:9px 0"></div></div>
    </div>

    <div style="${SH}">Formas de venda</div>
    <label class="row" style="gap:8px;align-items:center;margin:2px 0 6px;cursor:pointer"><input type="checkbox" id="cv-direto" style="width:auto" ${unOn ? 'checked' : ''} onchange="barConvToggleUnidade(this.checked)"><span><b>Vender por unidade</b></span></label>
    <div id="cv-un-box" style="display:${unOn ? 'block' : 'none'};border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px">
      <label class="field" style="margin-bottom:8px"><span style="font-weight:700">Preço de venda por unidade (R$)</span><input id="cv-preco" value="${money(v('preco_venda_cents', 0))}" oninput="barConvMargemPreview()" placeholder="ex.: 7,00"></label>
      <div class="small" id="cv-margem-un"></div>
    </div>
    <label class="row" style="gap:8px;align-items:center;margin:2px 0 6px;cursor:pointer"><input type="checkbox" id="cv-caixa-on" style="width:auto" ${cxOn ? 'checked' : ''} onchange="barConvToggleCaixa(this.checked)"><span><b>Vender por caixa/fardo</b> <span class="small mut">(preço próprio; baixa N unidades)</span></span></label>
    <div id="cv-caixa-box" style="display:${cxOn ? 'block' : 'none'};border:1px solid var(--brand);border-radius:12px;padding:12px;margin-bottom:8px">
      <label class="field" style="margin-bottom:8px"><span style="font-weight:700">Preço de venda da caixa/fardo (R$)</span><input id="cv-preco-caixa" value="${money(v('preco_caixa_cents', 0))}" oninput="barConvMargemPreview()" placeholder="ex.: 50,00"></label>
      <div class="small" id="cv-margem-caixa"></div>
    </div>
    <div class="small mut" style="margin-bottom:6px">Deixe as duas desmarcadas se for só ingrediente de receita (ex.: whisky em ML).</div>

    <div style="${SH}">Estoque</div>
    <div id="cv-estoque-fields"></div>
    <div class="row" style="gap:10px">
      <label class="field" style="flex:1"><span>SKU/código</span><input id="cv-sku" value="${esc(v('sku'))}"></label>
      <label class="field" style="flex:1"><span>Fornecedor</span><input id="cv-forn" value="${esc(v('fornecedor'))}"></label>
      <label class="field" style="flex:1"><span>Validade</span><input id="cv-val" type="date" value="${esc(v('validade'))}"></label>
    </div>
    <label class="field"><span>Foto (URL, opcional)</span><input id="cv-img" value="${esc(v('image_url'))}" placeholder="https://..."></label>
    <div class="row" style="gap:10px;margin-top:6px">
      <button class="btn primary block" onclick="barConvSave(${id || 0})">${p ? 'Salvar' : 'Criar produto'}</button>
      ${p ? `<button class="btn danger" onclick="barConvDelete(${id})">Excluir</button>` : ''}
    </div>`, { wide: true });
  barConvEstoqueMode();
  barConvMargemPreview();
}
function barConvToggleUnidade(on) {
  const box = document.getElementById('cv-un-box');
  if (box) box.style.display = on ? 'block' : 'none';
  barConvMargemPreview();
}
function barConvToggleCaixa(on) {
  const box = document.getElementById('cv-caixa-box');
  if (box) box.style.display = on ? 'block' : 'none';
  if (on) { const f = document.getElementById('cv-preco-caixa'); if (f) setTimeout(() => f.focus(), 30); }
  barConvMargemPreview();
}
function barConvMargemPreview() {
  const g = x => (document.getElementById(x) || {}).value;
  const qc = Number(g('cv-qc')) || 1;
  const un = (g('cv-un') || 'unidade').trim() || 'unidade';
  const hint = document.getElementById('cv-qc-hint');
  if (hint) hint.innerHTML = qc > 1 ? `<b style="color:var(--brand)">1 caixa/fardo = ${qc} ${esc(un)}</b>` : 'ⓘ Informe quantas unidades vêm em cada caixa ou fardo.';
  const custoCompra = reaisToCents(g('cv-custo'));
  const custoUn = qc > 0 ? custoCompra / qc : custoCompra;
  const cu = document.getElementById('cv-custo-unit');
  if (cu) cu.textContent = custoFmt(custoUn);
  const precoUn = reaisToCents(g('cv-preco'));
  const lucroUn = precoUn - custoUn;
  const mUn = document.getElementById('cv-margem-un');
  if (mUn) mUn.innerHTML = `Custo unitário <b>${custoFmt(custoUn)}</b> · Preço <b>${brl(precoUn)}</b> · Lucro <b style="color:#1b9e52">${brl(Math.round(lucroUn))}</b> · Margem <b>${precoUn > 0 ? ((lucroUn / precoUn) * 100).toFixed(1) : 0}%</b> · CMV <b>${precoUn > 0 ? ((custoUn / precoUn) * 100).toFixed(1) : 0}%</b>`;
  const mCx = document.getElementById('cv-margem-caixa');
  if (mCx) {
    const precoCx = reaisToCents(g('cv-preco-caixa'));
    const custoCx = Math.round(qc * custoUn);
    const lucroCx = precoCx - custoCx;
    mCx.innerHTML = `${qc} unidades · Custo <b>${brl(custoCx)}</b> · Preço <b>${brl(precoCx)}</b> · Lucro <b style="color:#1b9e52">${brl(lucroCx)}</b> · Margem <b>${precoCx > 0 ? ((lucroCx / precoCx) * 100).toFixed(1) : 0}%</b> · CMV <b>${precoCx > 0 ? ((custoCx / precoCx) * 100).toFixed(1) : 0}%</b>`;
  }
}
async function barConvSave(id) {
  const g = x => (document.getElementById(x) || {}).value;
  const qc = Number(g('cv-qc')) || 1;
  const body = {
    nome: g('cv-nome'), marca: g('cv-marca'), categoria: g('cv-cat'), unidade: g('cv-un'),
    qtd_por_compra: qc,
    custo_compra_cents: reaisToCents(g('cv-custo')), preco_venda_cents: reaisToCents(g('cv-preco')),
    sku: g('cv-sku'), fornecedor: g('cv-forn'), validade: g('cv-val'), image_url: g('cv-img'),
    grupo: g('cv-grupo') || 'conveniencia',
    vende_direto: (document.getElementById('cv-direto') || {}).checked ? 1 : 0,
    vende_caixa: (document.getElementById('cv-caixa-on') || {}).checked ? 1 : 0,
    preco_caixa_cents: reaisToCents(g('cv-preco-caixa')),
  };
  // Estoque e mínimo/ideal em CAIXAS quando for produto de caixa/fardo (converte p/ unidades).
  if (barConvIsCaixa(qc, g('cv-un'))) {
    body.estoque_minimo = (Number(g('cv-min-cx')) || 0) * qc;
    body.estoque_ideal = (Number(g('cv-ideal-cx')) || 0) * qc;
    if (!id) body.estoque_atual = (Number(g('cv-est-cx')) || 0) * qc + (Number(g('cv-est-un')) || 0);
  } else {
    body.estoque_minimo = Number(g('cv-min')) || 0;
    body.estoque_ideal = Number(g('cv-ideal')) || 0;
    if (!id) body.estoque_atual = Number(g('cv-est')) || 0;
  }
  try {
    if (id) await api('/api/bar/conveniencia/' + id, { method: 'PATCH', body });
    else await api('/api/bar/conveniencia', { method: 'POST', body });
    toast('Produto salvo.', 'ok'); closeModal(); renderBarProdutos(BARCONV_GRUPO);
  } catch (e) { toast(e.message, 'err'); }
}
async function barConvDelete(id) {
  if (!confirm('Excluir este produto? Ele deixa de ser vendido (histórico preservado).')) return;
  try { await api('/api/bar/conveniencia/' + id, { method: 'DELETE' }); toast('Produto removido.', 'ok'); closeModal(); renderBarProdutos(BARCONV_GRUPO); }
  catch (e) { toast(e.message, 'err'); }
}
let _ceProd = null;
async function barConvEntrada(id) {
  const p = BARCONV.produtos.find(x => x.id === id); if (!p) return;
  _ceProd = p;
  openModal(`<h2 style="margin:0 0 10px">Entrada de estoque · ${esc(p.nome)}</h2>
    <div class="small mut" style="margin-bottom:10px">Estoque atual: <b>${p.estoque_atual} ${esc(p.unidade)}</b>${p.qtd_por_compra > 1 ? ` (${p.caixas_estoque} cx + ${p.resto_estoque})` : ''} · 1 caixa/fardo = ${p.qtd_por_compra} ${esc(p.unidade)}</div>
    <div class="row" style="gap:10px">
      <label class="field" style="flex:1"><span>Quantidade</span><input id="ce-qtd" type="number" min="1" step="0.01" value="1" oninput="barEntradaPreview()"></label>
      <label class="field" style="flex:1"><span>Informada em</span><select id="ce-modo" onchange="barEntradaPreview()"><option value="caixa">Caixas/fardos</option><option value="unidade">Unidades</option></select></label>
    </div>
    <div class="card tight" id="ce-preview" style="margin:0 0 10px"></div>
    <label class="field"><span>Custo da compra (R$, opcional — por caixa/fardo)</span><input id="ce-custo" placeholder="deixe vazio para manter"></label>
    <label class="field"><span>Fornecedor (opcional)</span><input id="ce-forn" value="${esc(p.fornecedor || '')}"></label>
    <button class="btn primary block" onclick="barConvEntradaSave(${id})">Registrar entrada</button>`, { wide: false });
  barEntradaPreview();
}
function barEntradaPreview() {
  const p = _ceProd; if (!p) return;
  const q = Number((document.getElementById('ce-qtd') || {}).value) || 0;
  const modo = (document.getElementById('ce-modo') || {}).value || 'caixa';
  const un = modo === 'unidade' ? q : q * (p.qtd_por_compra || 1);
  const box = document.getElementById('ce-preview');
  if (box) box.innerHTML = `Entra no estoque: <b style="color:#1b9e52">+${un} ${esc(p.unidade)}</b>${modo === 'caixa' && p.qtd_por_compra > 1 ? ` <span class="small mut">(${q} × ${p.qtd_por_compra})</span>` : ''} · novo total ${(p.estoque_atual + un)} ${esc(p.unidade)}`;
}
async function barConvEntradaSave(id) {
  const custo = (document.getElementById('ce-custo').value || '').trim();
  const body = { quantidade: Number(document.getElementById('ce-qtd').value) || 1, modo: (document.getElementById('ce-modo') || {}).value || 'caixa', fornecedor: document.getElementById('ce-forn').value || '' };
  if (custo) body.custo_compra_cents = reaisToCents(custo);
  try { await api('/api/bar/conveniencia/' + id + '/entrada', { method: 'POST', body }); toast('Entrada registrada.', 'ok'); closeModal(); renderBarProdutos(BARCONV_GRUPO); }
  catch (e) { toast(e.message, 'err'); }
}
/* --------------------------------------------------- BAR · COMPRAS */
async function renderBarCompras() {
  const el = document.getElementById('content');
  let d; try { d = await api('/api/bar/compras'); } catch (e) { el.innerHTML = `<div class="card">Erro: ${esc(e.message)}</div>`; return; }
  const prodOpts = (d.produtos || []).map(p => `<option value="${p.id}" data-un="${esc(p.unidade)}" data-qc="${p.qtd_por_compra}">${esc(p.nome)} (${esc(p.unidade)})</option>`).join('');
  const rows = (d.compras || []).map(c => `<tr>
    <td>${new Date(c.created_at + 'Z').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
    <td>${esc(c.insumo_nome)}</td>
    <td style="text-align:right">${c.quantidade} ${esc(c.unidade)}</td>
    <td style="text-align:right">${brl(c.valor_cents)}</td>
    <td>${esc(c.motivo || '')}</td><td>${esc(c.usuario || '')}</td></tr>`).join('');
  el.innerHTML = `<div style="font-weight:800;font-size:19px;margin-bottom:12px">Compras</div>
    <div class="card" style="margin-bottom:14px">
      <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">
        <label class="field" style="flex:2;min-width:160px"><span>Produto</span><select id="co-prod" onchange="barCompraPreview()">${prodOpts || '<option value="">Cadastre produtos primeiro</option>'}</select></label>
        <label class="field" style="flex:1;min-width:90px"><span>Quantidade</span><input id="co-qtd" type="number" min="1" step="0.01" value="1" oninput="barCompraPreview()"></label>
        <label class="field" style="flex:1;min-width:120px"><span>Informada em</span><select id="co-modo" onchange="barCompraPreview()"><option value="caixa">Caixas/fardos</option><option value="unidade">Unidades</option></select></label>
        <label class="field" style="flex:1;min-width:120px"><span>Custo (R$/caixa)</span><input id="co-custo" placeholder="opcional"></label>
        <label class="field" style="flex:1;min-width:120px"><span>Fornecedor</span><input id="co-forn"></label>
        <button class="btn primary" style="margin-bottom:14px" onclick="barCompraSalvar()">Registrar compra</button>
      </div>
      <div class="small mut" id="co-preview">Ao registrar, o estoque é atualizado automaticamente (converte caixas/fardos em unidades).</div>
    </div>
    <div class="card" style="overflow:auto"><h3 style="margin:0 0 8px">Últimas compras</h3>
      <table class="tbl"><thead><tr><th>Data</th><th>Produto</th><th style="text-align:right">Qtd</th><th style="text-align:right">Valor</th><th>Origem</th><th>Usuário</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="mut" style="padding:16px">Nenhuma compra registrada.</td></tr>'}</tbody></table></div>`;
  barCompraPreview();
}
function barCompraPreview() {
  const sel = document.getElementById('co-prod'); const opt = sel && sel.selectedOptions[0];
  const box = document.getElementById('co-preview'); if (!box) return;
  if (!opt || !sel.value) { box.textContent = 'Selecione um produto.'; return; }
  const qc = Number(opt.dataset.qc) || 1; const un = opt.dataset.un || 'un';
  const q = Number((document.getElementById('co-qtd') || {}).value) || 0;
  const modo = (document.getElementById('co-modo') || {}).value || 'caixa';
  const total = modo === 'unidade' ? q : q * qc;
  box.innerHTML = `1 caixa/fardo = <b>${qc} ${esc(un)}</b> · entra <b style="color:#1b9e52">+${total} ${esc(un)}</b>${modo === 'caixa' && qc > 1 ? ` <span class="mut">(${q} × ${qc})</span>` : ''}`;
}
async function barCompraSalvar() {
  const sel = document.getElementById('co-prod'); const id = Number(sel.value); if (!id) { toast('Selecione um produto.', 'err'); return; }
  const custo = (document.getElementById('co-custo').value || '').trim();
  const body = { insumo_id: id, quantidade: Number(document.getElementById('co-qtd').value) || 1, modo: (document.getElementById('co-modo') || {}).value || 'caixa', fornecedor: document.getElementById('co-forn').value || '' };
  if (custo) body.custo_compra_cents = reaisToCents(custo);
  try { await api('/api/bar/compras', { method: 'POST', body }); toast('Compra registrada · estoque atualizado.', 'ok'); renderBarCompras(); }
  catch (e) { toast(e.message, 'err'); }
}
/* --------------------------------------------------- BAR · INVENTÁRIO */
async function renderBarInventario() {
  const el = document.getElementById('content');
  let d; try { d = await api('/api/bar/inventario'); } catch (e) { el.innerHTML = `<div class="card">Erro: ${esc(e.message)}</div>`; return; }
  const rows = (d.produtos || []).filter(p => p.active).map(p => {
    const emb = p.qtd_por_compra > 1;
    const teor = emb
      ? `📦 ${p.caixas_estoque} cx · 🍺 ${p.resto_estoque} ${esc(p.unidade)}<div class="small mut">= ${p.estoque_atual} ${esc(p.unidade)}</div>`
      : `${p.estoque_atual} ${esc(p.unidade)}`;
    const fisico = emb
      ? `<div style="display:flex;gap:6px;justify-content:flex-end"><input data-cx="${p.id}" type="number" min="0" step="1" style="width:68px;text-align:right" placeholder="cx" title="Caixas fechadas"><input data-un="${p.id}" type="number" min="0" step="1" style="width:68px;text-align:right" placeholder="un" title="Unidades abertas"></div>`
      : `<input data-un="${p.id}" type="number" min="0" step="0.01" style="width:110px;text-align:right" placeholder="físico">`;
    return `<tr>
      <td><b>${esc(p.nome)}</b>${emb ? ` <span class="small mut">(${p.qtd_por_compra}/cx)</span>` : ''}</td><td>${esc(p.categoria)}</td>
      <td style="text-align:right">${teor}</td>
      <td style="text-align:right">${fisico}</td>
      <td><button class="btn ghost sm" onclick="barInvAjustar(${p.id}, ${p.qtd_por_compra}, '${esc(p.nome).replace(/'/g, '')}', '${esc(p.unidade)}')">Ajustar</button></td></tr>`;
  }).join('');
  el.innerHTML = `<div style="font-weight:800;font-size:19px;margin-bottom:12px">Inventário</div>
    <div class="small mut" style="margin-bottom:10px">Para produtos em caixa/fardo, informe <b>caixas fechadas</b> e <b>unidades abertas</b>. O sistema converte em unidades, compara com o teórico e registra o ajuste rastreado.</div>
    <div class="card" style="overflow:auto"><table class="tbl"><thead><tr><th>Produto</th><th>Categoria</th><th style="text-align:right">Teórico</th><th style="text-align:right">Contagem física</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="mut" style="padding:16px">Nenhum produto.</td></tr>'}</tbody></table></div>`;
}
async function barInvAjustar(id, qtdPorCaixa, nome, unidade) {
  const emb = qtdPorCaixa > 1;
  let fisico;
  if (emb) {
    const cx = Number((document.querySelector(`[data-cx="${id}"]`) || {}).value || 0);
    const un = Number((document.querySelector(`[data-un="${id}"]`) || {}).value || 0);
    const cxEl = document.querySelector(`[data-cx="${id}"]`); const unEl = document.querySelector(`[data-un="${id}"]`);
    if ((!cxEl || cxEl.value === '') && (!unEl || unEl.value === '')) { toast('Informe caixas e/ou unidades.', 'err'); return; }
    fisico = cx * qtdPorCaixa + un;
  } else {
    const inp = document.querySelector(`[data-un="${id}"]`);
    if (!inp || inp.value === '') { toast('Informe a contagem física.', 'err'); return; }
    fisico = Number(inp.value);
  }
  if (isNaN(fisico)) { toast('Contagem inválida.', 'err'); return; }
  const motivo = prompt(`Ajustar "${nome}" para ${fisico} ${unidade}${emb ? ' (' + Math.floor(fisico / qtdPorCaixa) + ' cx + ' + (fisico % qtdPorCaixa) + ')' : ''}. Motivo (opcional):`);
  if (motivo === null) return;
  try { const r = await api('/api/bar/inventario', { method: 'POST', body: { insumo_id: id, estoque_fisico: fisico, motivo: motivo || 'inventário' } }); toast('Ajustado (dif ' + r.diferenca + ').', 'ok'); renderBarInventario(); }
  catch (e) { toast(e.message, 'err'); }
}

/* ------------------------------------------------- BAR · DOSES & DRINKS (RECEITAS) */
let BARREC = { all: [], rows: [] };
function barRecTabs(active) {
  const t = [['receitas', 'Receitas', 'bar_receitas'], ['dose', 'Doses', 'bar_doses'], ['drink', 'Drinks', 'bar_drinks']];
  return `<div class="chips" style="margin-bottom:14px">${t.map(([k, l, id]) => `<button class="chip ${active === k ? 'active' : ''}" onclick="go('${id}')">${l}</button>`).join('')}</div>`;
}
async function renderBarReceitas(view = 'receitas') {
  const tipo = view === 'dose' ? 'dose' : view === 'drink' ? 'drink' : '';
  const el = document.getElementById('content');
  let d; try { d = await api('/api/bar/receitas' + (tipo ? '?tipo=' + tipo : '')); } catch (e) { el.innerHTML = `<div class="card">Erro: ${esc(e.message)}</div>`; return; }
  BARREC.all = d.ingredientes || [];
  const tbadge = { dose: '<span class="badge info">Dose</span>', drink: '<span class="badge ok">Drink</span>' };
  const cards = (d.receitas || []).map(r => `
    <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:6px">
      <div class="row" style="justify-content:space-between;align-items:flex-start"><b style="font-size:15px">${esc(r.nome)}</b>${tbadge[r.tipo] || ''}</div>
      ${r.descricao ? `<div class="small mut">${esc(r.descricao)}</div>` : ''}
      <div class="row" style="justify-content:space-between;margin-top:4px"><span class="mut small">Custo ${brl(r.custo_cents)} · ${r.ingredientes_qtd} ingrediente(s)</span></div>
      <div class="row" style="justify-content:space-between;align-items:baseline"><span style="font-size:20px;font-weight:800">${brl(r.preco_cents)}</span><span class="small" style="color:#1b9e52">Lucro ${brl(r.lucro_cents)} · ${r.margem}%</span></div>
      <div class="small mut">CMV ${r.cmv}%</div>
      <button class="btn ghost sm" style="margin-top:4px" onclick="barReceitaForm(${r.id})">Editar receita</button>
    </div>`).join('');
  const hint = BARREC.all.length ? '' : `<div class="card" style="margin-bottom:12px;background:var(--warn-soft)">Cadastre produtos/ingredientes em <b>Conveniência</b> ou <b>Estoque</b> antes de montar receitas (ex.: Whisky em ML, Red Bull, Gelo).</div>`;
  el.innerHTML = `<div style="font-weight:800;font-size:19px;margin-bottom:12px">Doses & Drinks</div>${barRecTabs(view)}
    ${hint}
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px"><div class="small mut">A receita baixa os ingredientes do estoque na venda. Custo e CMV são automáticos.</div>
      <button class="btn primary sm" onclick="barReceitaForm(0,'${tipo || 'dose'}')">+ Criar receita</button></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px">${cards || '<div class="small mut">Nenhuma receita ainda.</div>'}</div>`;
}
function barRecIngOptions(sel) {
  const opt = i => `<option value="${i.insumo_id}" ${String(sel) === String(i.insumo_id) ? 'selected' : ''}>${esc(i.nome)} (${esc(i.unidade)} · ${custoFmt(i.custo_unit_cents)}/${esc(i.unidade)})</option>`;
  // agrupa a lista suspensa por categoria (facilita achar entre muitos produtos)
  const byCat = {};
  BARREC.all.forEach(i => { const c = i.categoria || 'Outros'; (byCat[c] = byCat[c] || []).push(i); });
  let html = `<option value="">Selecione um produto…</option>`;
  Object.keys(byCat).sort((a, b) => a.localeCompare(b)).forEach(cat => {
    html += `<optgroup label="${esc(cat)}">` + byCat[cat].sort((a, b) => a.nome.localeCompare(b.nome)).map(opt).join('') + `</optgroup>`;
  });
  return html;
}
function barRecRowHtml(idx, row) {
  return `<div class="row" data-rowi="${idx}" style="gap:8px;align-items:center;margin-bottom:6px">
    <select class="rec-ing" style="flex:2" onchange="barRecRowChange(${idx})">${barRecIngOptions(row.insumo_id)}</select>
    <input class="rec-qtd" type="number" min="0" step="0.01" style="width:90px" value="${row.quantidade || ''}" oninput="barRecRecalc()" placeholder="qtd">
    <span class="rec-un small mut" style="width:46px">${esc(row.unidade || '')}</span>
    <span class="rec-linecost small" style="width:70px;text-align:right">${brl(row._custo || 0)}</span>
    <button class="btn ghost sm" onclick="barRecRemove(${idx})" title="Remover">✕</button>
  </div>`;
}
function barRecRenderRows() {
  const host = document.getElementById('rec-rows'); if (!host) return;
  host.innerHTML = BARREC.rows.map((r, i) => barRecRowHtml(i, r)).join('') || '<div class="small mut">Nenhum ingrediente. Clique em “+ Adicionar produto”.</div>';
  barRecRecalc();
}
function barRecRowChange(idx) {
  const sel = document.querySelector(`[data-rowi="${idx}"] .rec-ing`); if (!sel) return;
  const ing = BARREC.all.find(x => String(x.insumo_id) === String(sel.value));
  BARREC.rows[idx].insumo_id = sel.value ? Number(sel.value) : 0;
  BARREC.rows[idx].unidade = ing ? ing.unidade : '';
  const un = document.querySelector(`[data-rowi="${idx}"] .rec-un`); if (un) un.textContent = BARREC.rows[idx].unidade;
  barRecRecalc();
}
function barRecRecalc() {
  let custo = 0;
  BARREC.rows.forEach((r, i) => {
    const qEl = document.querySelector(`[data-rowi="${i}"] .rec-qtd`); const q = qEl ? Number(qEl.value) || 0 : (r.quantidade || 0);
    r.quantidade = q;
    const ing = BARREC.all.find(x => String(x.insumo_id) === String(r.insumo_id));
    const lc = ing ? Math.round(q * ing.custo_unit_cents) : 0; r._custo = lc;
    const cEl = document.querySelector(`[data-rowi="${i}"] .rec-linecost`); if (cEl) cEl.textContent = brl(lc);
    custo += lc;
  });
  const precoEl = document.getElementById('rec-preco'); const preco = precoEl ? reaisToCents(precoEl.value) : 0;
  const lucro = preco - custo; const margem = preco > 0 ? ((lucro / preco) * 100).toFixed(1) : '0';
  const cmv = preco > 0 ? ((custo / preco) * 100).toFixed(1) : '0';
  const out = document.getElementById('rec-tot');
  if (out) out.innerHTML = `Custo <b>${brl(custo)}</b> · Preço <b>${brl(preco)}</b> · Lucro <b style="color:#1b9e52">${brl(lucro)}</b> · CMV <b>${cmv}%</b> · Margem <b>${margem}%</b>`;
}
function barRecAdd() { BARREC.rows.push({ insumo_id: 0, quantidade: '', unidade: '' }); barRecRenderRows(); }
function barRecRemove(idx) { BARREC.rows.splice(idx, 1); barRecRenderRows(); }
function barRecSugerir() {
  const mEl = document.getElementById('rec-margem'); const m = mEl ? Number(mEl.value) : 0;
  let custo = 0; BARREC.rows.forEach(r => { const ing = BARREC.all.find(x => String(x.insumo_id) === String(r.insumo_id)); custo += ing ? Math.round((Number(r.quantidade) || 0) * ing.custo_unit_cents) : 0; });
  if (!(m >= 0 && m < 100)) { toast('Informe uma margem entre 0 e 99%.', 'err'); return; }
  const preco = Math.round(custo / (1 - m / 100));
  const el = document.getElementById('rec-preco'); if (el) { el.value = (preco / 100).toFixed(2).replace('.', ','); barRecRecalc(); }
}
async function barReceitaForm(id, tipoDefault = 'dose') {
  let rec = null;
  if (id) { try { rec = (await api('/api/bar/receitas/' + id)).receita; } catch (e) { toast(e.message, 'err'); return; } }
  BARREC.rows = rec ? (rec.ingredientes || []).map(l => ({ insumo_id: l.insumo_id, quantidade: l.quantidade, unidade: l.unidade })) : [{ insumo_id: 0, quantidade: '', unidade: '' }];
  const tipo = rec ? rec.tipo : tipoDefault;
  const v = (k, d = '') => rec ? (rec[k] != null ? rec[k] : d) : d;
  openModal(`<h2 style="margin:0 0 12px">${rec ? 'Editar receita' : 'Nova receita (dose/drink)'}</h2>
    <div class="row" style="gap:10px">
      <label class="field" style="flex:2"><span>Nome *</span><input id="rec-nome" value="${esc(v('nome'))}" placeholder="Ex.: Whisky + Red Bull + Gelo de Coco"></label>
      <label class="field" style="flex:1"><span>Tipo</span><select id="rec-tipo"><option value="dose" ${tipo === 'dose' ? 'selected' : ''}>Dose</option><option value="drink" ${tipo === 'drink' ? 'selected' : ''}>Drink</option></select></label>
    </div>
    <div class="row" style="gap:10px">
      <label class="field" style="flex:1"><span>Categoria</span><input id="rec-cat" value="${esc(v('categoria'))}" placeholder="Doses, Drinks…"></label>
      <label class="field" style="flex:2"><span>Descrição</span><input id="rec-desc" value="${esc(v('descricao'))}"></label>
    </div>
    <label class="field"><span>Foto (URL, opcional)</span><input id="rec-img" value="${esc(v('image_url'))}" placeholder="https://..."></label>
    <div style="font-weight:700;margin:6px 0 6px">Ingredientes (do estoque)</div>
    <div id="rec-rows"></div>
    <button class="btn ghost sm" onclick="barRecAdd()">+ Adicionar produto</button>
    <div class="card tight" id="rec-tot" style="margin:12px 0;background:var(--card)"></div>
    <div class="row" style="gap:10px;align-items:flex-end">
      <label class="field" style="flex:1"><span>Preço de venda (R$)</span><input id="rec-preco" value="${((v('preco_cents', 0)) / 100).toFixed(2).replace('.', ',')}" oninput="barRecRecalc()"></label>
      <label class="field" style="flex:1"><span>Margem desejada (%)</span><input id="rec-margem" type="number" min="0" max="99" placeholder="ex.: 60"></label>
      <button class="btn sm" style="margin-bottom:14px" onclick="barRecSugerir()">Sugerir preço</button>
    </div>
    <div class="row" style="gap:10px">
      <button class="btn primary block" onclick="barReceitaSave(${id || 0})">${rec ? 'Salvar receita' : 'Criar receita'}</button>
      ${rec ? `<button class="btn danger" onclick="barReceitaDelete(${id})">Excluir</button>` : ''}
    </div>`, { wide: true });
  barRecRenderRows();
}
async function barReceitaSave(id) {
  const g = x => (document.getElementById(x) || {}).value;
  const ingredientes = BARREC.rows.filter(r => r.insumo_id && Number(r.quantidade) > 0).map(r => ({ insumo_id: r.insumo_id, quantidade: Number(r.quantidade), unidade: r.unidade }));
  if (!ingredientes.length) { toast('Adicione ao menos um ingrediente com quantidade.', 'err'); return; }
  const body = { nome: g('rec-nome'), tipo: g('rec-tipo'), categoria: g('rec-cat'), descricao: g('rec-desc'), image_url: g('rec-img'), preco_venda_cents: reaisToCents(g('rec-preco')), ingredientes };
  try {
    if (id) await api('/api/bar/receitas/' + id, { method: 'PATCH', body });
    else await api('/api/bar/receitas', { method: 'POST', body });
    toast('Receita salva.', 'ok'); closeModal();
    renderBarReceitas((location.hash.replace('#', '') === 'bar_doses') ? 'dose' : (location.hash.replace('#', '') === 'bar_drinks') ? 'drink' : 'receitas');
  } catch (e) { toast(e.message, 'err'); }
}
async function barReceitaDelete(id) {
  if (!confirm('Excluir esta receita? Ela deixa de ser vendida (histórico preservado).')) return;
  try { await api('/api/bar/receitas/' + id, { method: 'DELETE' }); toast('Receita removida.', 'ok'); closeModal(); renderBarReceitas('receitas'); }
  catch (e) { toast(e.message, 'err'); }
}

/* ------------------------------------------------- BAR · RELATÓRIOS */
let BARREL = { range: '30d', from: '', to: '', data: null, prodSort: 'qtd' };
const BARREL_RANGES = [['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Este mês'], ['mes_ant', 'Mês anterior'], ['trimestre', 'Trimestre'], ['semestre', 'Semestre'], ['ano', 'Ano'], ['custom', 'Personalizado']];
function barRelSetRange(v) { BARREL.range = v; if (v !== 'custom') renderBarRelatorios(); else renderBarRelatorios(); }
function barRelCustom() {
  const f = document.getElementById('brel-from'), t = document.getElementById('brel-to');
  if (!f.value || !t.value) { toast('Informe data inicial e final.', 'err'); return; }
  BARREL.from = f.value; BARREL.to = t.value; renderBarRelatorios();
}
function relT(headers, rows, empty) {
  return `<div class="card" style="overflow:auto"><table class="tbl"><thead><tr>${headers.map((h, idx) => `<th${idx ? ' style="text-align:right"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="mut" style="padding:16px">${empty || 'Sem dados.'}</td></tr>`}</tbody></table></div>`;
}
function relH(t) { return `<div style="font-weight:800;font-size:16px;margin:20px 0 8px">${esc(t)}</div>`; }
async function renderBarRelatorios() {
  const el = document.getElementById('content');
  const r = BARREL.range;
  const qs = r === 'custom' ? `?range=custom&from=${encodeURIComponent(BARREL.from)}&to=${encodeURIComponent(BARREL.to)}` : `?range=${r}`;
  let d; try { d = await api('/api/bar/relatorios' + qs); } catch (e) { el.innerHTML = `<div class="card">Erro: ${esc(e.message)}</div>`; return; }
  BARREL.data = d;
  const i = d.indicadores;
  const sel = `<select style="width:auto" onchange="barRelSetRange(this.value)">${BARREL_RANGES.map(([v, l]) => `<option value="${v}" ${r === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const custom = r === 'custom' ? `<input type="date" id="brel-from" value="${BARREL.from}" style="width:auto"><input type="date" id="brel-to" value="${BARREL.to}" style="width:auto"><button class="btn sm" onclick="barRelCustom()">Aplicar</button>` : '';
  const head = `<div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
    <div style="font-weight:800;font-size:19px">Relatórios · ${esc(d.range)}</div>
    <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">${custom}${sel}</div></div>`;
  const vazio = i.vendas === 0;
  const cards = `<div class="kpi-grid">
    ${kpi('Faturamento', brl(i.faturamento_cents), i.vendas + ' venda(s)', '#1b9e52')}
    ${kpi('Ticket médio', brl(i.ticket_medio_cents))}
    ${kpi('Custo (CMV)', brl(i.custo_cents), 'CMV ' + i.cmv + '%', '#e0352b')}
    ${kpi('Lucro bruto', brl(i.lucro_cents), 'Margem ' + i.margem + '%', '#1b9e52')}
    ${kpi('Itens vendidos', i.itens_vendidos, i.unidades_vendidas + ' un · ' + i.caixas_vendidas + ' cx')}
    ${kpi('Doses / Drinks', i.doses_vendidas + ' / ' + i.drinks_vendidos)}
  </div>`;
  if (vazio) {
    el.innerHTML = head + cards + `<div class="card" style="text-align:center;padding:30px;margin-top:14px"><div style="font-size:40px">📊</div><b>Nenhuma venda encontrada no período selecionado.</b><div class="small mut" style="margin-top:4px">Faturamento R$ 0,00 · Vendas 0 · Lucro R$ 0,00 · CMV 0%</div></div>`;
    return;
  }
  // tabelas
  const prodRows = () => (barRelSortProd()).map(p => `<tr><td>${esc(p.nome)}</td><td style="text-align:right">${p.qtd}</td><td style="text-align:right">${brl(p.faturamento_cents)}</td><td style="text-align:right">${brl(p.custo_cents)}</td><td style="text-align:right">${brl(p.lucro_cents)}</td><td style="text-align:right">${p.margem}%</td></tr>`).join('');
  const catRows = d.categorias.map(c => `<tr><td>${esc(c.categoria)}</td><td style="text-align:right">${c.qtd}</td><td style="text-align:right">${brl(c.faturamento_cents)}</td><td style="text-align:right">${brl(c.custo_cents)}</td><td style="text-align:right">${brl(c.lucro_cents)}</td><td style="text-align:right">${c.margem}%</td><td style="text-align:right">${c.participacao}%</td></tr>`).join('');
  const fLabel = { unidade: 'Unidade', caixa: 'Caixa/Fardo' };
  const formaRows = d.por_forma.map(f => `<tr><td>${fLabel[f.forma] || f.forma}</td><td style="text-align:right">${f.qtd}</td><td style="text-align:right">${brl(f.faturamento_cents)}</td><td style="text-align:right">${brl(f.custo_cents)}</td><td style="text-align:right">${brl(f.lucro_cents)}</td><td style="text-align:right">${f.margem}%</td><td style="text-align:right">${f.cmv}%</td></tr>`).join('');
  const rankRows = (arr) => arr.map(p => `<tr><td>${esc(p.nome)}</td><td style="text-align:right">${p.qtd}</td><td style="text-align:right">${brl(p.faturamento_cents)}</td><td style="text-align:right">${brl(p.custo_cents)}</td><td style="text-align:right">${brl(p.lucro_cents)}</td><td style="text-align:right">${p.margem}%</td><td style="text-align:right">${p.cmv}%</td></tr>`).join('');
  const cervRows = d.cervejas.map(c => `<tr><td>${esc(c.nome)}</td><td style="text-align:right">${c.caixas}</td><td style="text-align:right">${c.unidades}</td><td style="text-align:right">${brl(c.faturamento_cents)}</td><td style="text-align:right">${brl(c.custo_cents)}</td><td style="text-align:right">${brl(c.lucro_cents)}</td><td style="text-align:right">${c.margem}%</td></tr>`).join('');
  const pagRows = d.pagamentos.map(p => `<tr><td>${PG_LABEL[p.forma] || p.forma}</td><td style="text-align:right">${p.vendas}</td><td style="text-align:right">${brl(p.valor_cents)}</td><td style="text-align:right">${p.participacao}%</td></tr>`).join('');
  const lucroRows = d.mais_lucrativos.map(p => `<tr><td>${esc(p.nome)}</td><td style="text-align:right">${brl(p.faturamento_cents)}</td><td style="text-align:right">${brl(p.custo_cents)}</td><td style="text-align:right">${brl(p.lucro_cents)}</td><td style="text-align:right">${p.margem}%</td></tr>`).join('');
  const baixaRows = d.estoque.lista_baixa.map(p => `<tr><td>${esc(p.nome)}</td><td style="text-align:right">${p.qtd_por_compra > 1 ? `📦 ${p.caixas} · 🍺 ${p.abertas} <span class="small mut">(${p.estoque_atual})</span>` : `${p.estoque_atual} ${esc(p.unidade)}`}</td><td style="text-align:right">${p.qtd_por_compra > 1 ? (p.estoque_minimo / p.qtd_por_compra) + ' cx' : p.estoque_minimo}</td><td style="text-align:right">${p.qtd_por_compra > 1 ? (p.estoque_ideal / p.qtd_por_compra) + ' cx' : p.estoque_ideal}</td><td>${p.status === 'sem' ? '<span class="badge danger">🔴 Sem estoque</span>' : '<span class="badge warn">🟡 Repor</span>'}</td></tr>`).join('');
  const compRows = d.compras.produtos.map(c => `<tr><td>${esc(c.nome)}</td><td style="text-align:right">${c.quantidade}</td><td style="text-align:right">${brl(c.valor_cents)}</td><td style="text-align:right">${c.compras}</td></tr>`).join('');
  const fornRows = d.compras.fornecedores.map(f => `<tr><td>${esc(f.fornecedor)}</td><td style="text-align:right">${f.compras}</td><td style="text-align:right">${brl(f.valor_cents)}</td></tr>`).join('');
  const perdasCats = Object.entries(d.perdas.por_categoria).filter(([k, v]) => v > 0).map(([k, v]) => `<tr><td>${esc((d.perdas.labels && d.perdas.labels[k]) || k)}</td><td style="text-align:right">${brl(v)}</td></tr>`).join('');
  const perdasReg = (d.perdas.registros || []).slice(0, 30).map(rr => `<tr><td>${new Date(rr.created_at + 'Z').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit' })}</td><td>${esc((d.perdas.labels && d.perdas.labels[rr.categoria]) || rr.categoria)}</td><td>${esc(rr.descricao)}</td><td style="text-align:right">${brl(rr.custo_cents)}</td><td>${esc(rr.responsavel || rr.usuario || '')}</td></tr>`).join('');
  const funcRows = d.funcionarios.map(f => `<tr><td>${esc(f.nome)}</td><td style="text-align:right">${f.vendas}</td><td style="text-align:right">${brl(f.faturamento_cents)}</td><td style="text-align:right">${brl(f.ticket_medio_cents)}</td><td style="text-align:right">${f.itens}</td><td style="text-align:right">${f.cancelamentos}</td></tr>`).join('');
  const cancRows = d.cancelamentos.map(c => `<tr><td>#${c.numero}</td><td style="text-align:right">${brl(c.total_cents)}</td><td>${c.cancel_at ? new Date(c.cancel_at + 'Z').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</td><td>${esc(c.cancel_usuario || '')}</td><td>${esc(c.motivo || '')}</td></tr>`).join('');

  el.innerHTML = head + cards +
    relH('Evolução do faturamento') + `<div class="card"><div style="height:240px;position:relative"><canvas id="brel-evo"></canvas></div></div>` +
    relH('Produtos mais vendidos') +
    `<div class="chips" style="margin-bottom:8px">${[['qtd', 'Mais vendidos'], ['faturamento', 'Maior faturamento'], ['lucro', 'Maior lucro'], ['margem', 'Maior margem']].map(([k, l]) => `<button class="chip ${BARREL.prodSort === k ? 'active' : ''}" onclick="BARREL.prodSort='${k}';barRelReRenderProd()">${l}</button>`).join('')}</div>` +
    `<div id="brel-prod">${relT(['Produto', 'Qtd', 'Faturamento', 'Custo', 'Lucro', 'Margem'], prodRows(), 'Sem vendas.')}</div>` +
    relH('Vendas por categoria') + relT(['Categoria', 'Qtd', 'Faturamento', 'Custo', 'Lucro', 'Margem', 'Part.'], catRows, 'Sem vendas.') +
    relH('Venda por unidade × caixa/fardo') + relT(['Forma', 'Qtd', 'Faturamento', 'Custo', 'Lucro', 'Margem', 'CMV'], formaRows, 'Sem vendas.') +
    relH(`Doses (${d.doses.qtd} vendidas · ${brl(d.doses.faturamento_cents)} · CMV ${d.doses.cmv}%)`) + relT(['Dose', 'Qtd', 'Faturamento', 'Custo', 'Lucro', 'Margem', 'CMV'], rankRows(d.doses.ranking), 'Nenhuma dose vendida.') +
    relH(`Drinks (${d.drinks.qtd} vendidos · ${brl(d.drinks.faturamento_cents)} · CMV ${d.drinks.cmv}%)`) + relT(['Drink', 'Qtd', 'Faturamento', 'Custo', 'Lucro', 'Margem', 'CMV'], rankRows(d.drinks.ranking), 'Nenhum drink vendido.') +
    relH(`Conveniência (${d.conveniencia.qtd} vendidos · ${brl(d.conveniencia.faturamento_cents)})`) + relT(['Produto', 'Qtd', 'Faturamento', 'Custo', 'Lucro', 'Margem', 'CMV'], rankRows(d.conveniencia.ranking), 'Nenhum produto de conveniência vendido.') +
    relH('Cervejas (caixas × unidades)') + relT(['Produto', 'Caixas', 'Unidades', 'Faturamento', 'Custo', 'Lucro', 'Margem'], cervRows, 'Nenhuma cerveja vendida.') +
    relH('Produtos mais lucrativos') + relT(['Produto', 'Faturamento', 'Custo', 'Lucro', 'Margem'], lucroRows, 'Sem vendas.') +
    relH('Formas de pagamento') + relT(['Forma', 'Vendas', 'Valor', 'Part.'], pagRows, 'Sem vendas.') +
    relH('Vendas por origem') + relT(['Origem', 'Vendas', 'Valor', 'Part.'], (d.origens || []).map(o => `<tr><td>${esc({ venda_rapida: 'Balcão (Venda Rápida)', cardapio: 'Cardápio', qrcode: 'QR Code', link: 'Link', whatsapp: 'WhatsApp', delivery: 'Delivery' }[o.origem] || o.origem)}</td><td style="text-align:right">${o.vendas}</td><td style="text-align:right">${brl(o.valor_cents)}</td><td style="text-align:right">${o.participacao}%</td></tr>`).join(''), 'Sem vendas.') +
    relH(`Estoque (📦 ${d.estoque.produtos} produtos · 🟡 ${d.estoque.baixo} baixo · 🔴 ${d.estoque.sem} sem estoque · valor ${brl(d.estoque.valor_estoque_cents)})`) +
    relT(['Produto (repor)', 'Estoque', 'Mínimo', 'Ideal', 'Situação'], baixaRows, 'Nenhum produto para repor. 🎉') +
    relH(`Compras (${d.compras.qtd_compras} · ${brl(d.compras.total_cents)})`) +
    `<div class="dash-grid"><div>${relT(['Produto', 'Qtd', 'Valor', 'Compras'], compRows, 'Nenhuma compra no período.')}</div><div>${relT(['Fornecedor', 'Compras', 'Valor'], fornRows, 'Sem fornecedores.')}</div></div>` +
    relH(`Perdas e consumo (${brl(d.perdas.total_cents)} — não entra no faturamento)`) +
    `<div class="dash-grid"><div>${relT(['Tipo', 'Custo'], perdasCats, 'Nenhuma perda/consumo.')}</div><div>${relT(['Data', 'Tipo', 'Descrição', 'Custo', 'Responsável'], perdasReg, 'Nenhum registro.')}</div></div>` +
    relH('Desempenho por funcionário') + relT(['Funcionário', 'Vendas', 'Faturamento', 'Ticket médio', 'Itens', 'Cancel.'], funcRows, 'Sem vendas.') +
    relH(`Cancelamentos (${d.cancelamentos.length})`) + relT(['Venda', 'Valor', 'Data', 'Usuário', 'Motivo'], cancRows, 'Nenhum cancelamento no período.');

  // gráfico de evolução (dados reais)
  const ctx = document.getElementById('brel-evo');
  if (ctx && window.Chart && d.evolucao.length) {
    const labels = d.evolucao.map(e => d.byMonth ? e.periodo : e.periodo.slice(8) + '/' + e.periodo.slice(5, 7));
    const ch = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Faturamento', data: d.evolucao.map(e => e.faturamento_cents / 100), borderColor: '#E0352B', backgroundColor: 'rgba(224,53,43,.12)', fill: true, tension: .25 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => 'R$ ' + v } } } } });
    chartRefs.push(ch);
  } else if (ctx) { ctx.parentElement.innerHTML = '<div class="mut small" style="padding:40px;text-align:center">Sem dados de faturamento no período.</div>'; }
}
function barRelSortProd() {
  const d = BARREL.data; if (!d) return [];
  const key = { qtd: 'qtd', faturamento: 'faturamento_cents', lucro: 'lucro_cents', margem: 'margem' }[BARREL.prodSort] || 'qtd';
  return [...d.produtos].sort((a, b) => b[key] - a[key]);
}
function barRelReRenderProd() {
  const host = document.getElementById('brel-prod'); if (!host) return;
  // re-render chips active state
  host.previousElementSibling.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.textContent === { qtd: 'Mais vendidos', faturamento: 'Maior faturamento', lucro: 'Maior lucro', margem: 'Maior margem' }[BARREL.prodSort]));
  const rows = barRelSortProd().map(p => `<tr><td>${esc(p.nome)}</td><td style="text-align:right">${p.qtd}</td><td style="text-align:right">${brl(p.faturamento_cents)}</td><td style="text-align:right">${brl(p.custo_cents)}</td><td style="text-align:right">${brl(p.lucro_cents)}</td><td style="text-align:right">${p.margem}%</td></tr>`).join('');
  host.innerHTML = relT(['Produto', 'Qtd', 'Faturamento', 'Custo', 'Lucro', 'Margem'], rows, 'Sem vendas.');
}

/* ------------------------------------------------- BAR · CARDÁPIO DIGITAL (compartilhar) */
async function renderBarCardapio() {
  const el = document.getElementById('content');
  let d; try { d = await api('/api/bar/cardapio-info'); } catch (e) { el.innerHTML = `<div class="card">Erro: ${esc(e.message)}</div>`; return; }
  const url = location.origin + '/c/' + d.slug;
  const urlLink = url + '?origem=link';
  const r = d.resumo || {};
  el.innerHTML = `<div style="font-weight:800;font-size:19px;margin-bottom:12px">Cardápio Digital da Adega</div>
    <div class="dash-grid">
      <div class="card">
        <h3 style="margin:0 0 8px">Link do cardápio</h3>
        <div class="row" style="gap:8px"><input id="card-url" value="${esc(url)}" readonly style="flex:1"><button class="btn sm" onclick="barCardCopy()">Copiar</button></div>
        <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
          <a class="btn sm" href="${esc(url)}?origem=qrcode" target="_blank">Ver cardápio ↗</a>
          ${d.whatsapp ? `<button class="btn sm ok" onclick="barCardWhats('${esc(urlLink)}')">Compartilhar no WhatsApp</button>` : ''}
        </div>
        <div class="small mut" style="margin-top:8px">O cliente acessa, escolhe os produtos e faz o pedido — que entra direto em <b>Pedidos / Delivery</b>.</div>
      </div>
      <div class="card" style="text-align:center">
        <h3 style="margin:0 0 8px">QR Code</h3>
        <div id="card-qr" style="display:inline-block;background:#fff;padding:10px;border-radius:12px"></div>
        <div style="margin-top:10px"><button class="btn sm" onclick="barCardDownloadQR()">Baixar QR Code</button></div>
      </div>
    </div>
    <div class="kpi-grid" style="margin-top:14px">
      ${kpi('Pedidos abertos', r.abertos || 0, (r.novo || 0) + ' novo(s)')}
      ${kpi('Em separação', r.separacao || 0)}
      ${kpi('Em entrega', r.entrega || 0)}
      ${kpi('Finalizados', r.finalizado || 0)}
    </div>
    <div class="small mut" style="margin-top:10px">Para imprimir: baixe o QR Code e cole no balcão, na porta ou nas mesas. Para enviar por link, use “Copiar”.</div>`;
  // QR
  const host = document.getElementById('card-qr');
  const draw = () => { host.innerHTML = ''; try { new QRCode(host, { text: url + '?origem=qrcode', width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M }); } catch (e) { host.textContent = 'QR indisponível'; } };
  if (window.QRCode) draw(); else { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = draw; document.head.appendChild(s); }
}
function barCardCopy() { const i = document.getElementById('card-url'); i.select(); try { navigator.clipboard.writeText(i.value); toast('Link copiado!', 'ok'); } catch { document.execCommand('copy'); toast('Link copiado!', 'ok'); } }
function barCardWhats(u) { window.open('https://wa.me/?text=' + encodeURIComponent('Peça pelo nosso cardápio digital: ' + u), '_blank'); }
function barCardDownloadQR() {
  const cv = document.querySelector('#card-qr canvas'); const img = document.querySelector('#card-qr img');
  const src = cv ? cv.toDataURL('image/png') : (img ? img.src : '');
  if (!src) { toast('QR ainda carregando…', 'err'); return; }
  const a = document.createElement('a'); a.href = src; a.download = 'cardapio-qr.png'; a.click();
}

/* ------------------------------------------------- BAR · PEDIDOS / DELIVERY */
const PED_ST_LABEL = { novo: 'Novo', confirmado: 'Confirmado', separacao: 'Em separação', entrega: 'Saiu p/ entrega', entregue: 'Entregue', finalizado: 'Finalizado', cancelado: 'Cancelado' };
const PED_MET_LABEL = { pix: 'PIX', dinheiro: 'Dinheiro', cartao_entrega: 'Cartão na entrega', outros: 'Outros' };
const PED_PAG_LABEL = { pendente: 'Pendente', aguardando: 'Aguardando PIX', confirmado: 'Confirmado', nao_recebido: 'Não recebido' };
const PED_NEXT = { novo: 'confirmado', confirmado: 'separacao', separacao: 'entrega', entrega: 'entregue', entregue: 'finalizado' };
const PED_ORIG_LABEL = { cardapio: 'Cardápio', qrcode: 'QR Code', link: 'Link', whatsapp: 'WhatsApp' };
let BARPED = { status: '' };
function pedStatusBadge(s) { const map = { novo: 'warn', confirmado: 'info', separacao: 'info', entrega: 'info', entregue: 'ok', finalizado: 'ok', cancelado: 'danger' }; return `<span class="badge ${map[s] || 'mut'}">${PED_ST_LABEL[s] || s}</span>`; }
function pedPagBadge(p) { const map = { pendente: 'warn', aguardando: 'warn', confirmado: 'ok', nao_recebido: 'danger' }; return `<span class="badge ${map[p.pagamento_status] || 'mut'}">${PED_MET_LABEL[p.pagamento_metodo] || ''} · ${PED_PAG_LABEL[p.pagamento_status] || ''}</span>`; }
async function renderBarPedidos(opts = {}) {
  if (opts.status != null) BARPED.status = opts.status;
  const el = document.getElementById('content');
  let d; try { d = await api('/api/bar/pedidos' + (BARPED.status ? '?status=' + BARPED.status : '')); } catch (e) { el.innerHTML = `<div class="card">Erro: ${esc(e.message)}</div>`; return; }
  const r = d.resumo || {};
  const filtros = [['', 'Todos'], ['novo', 'Novos'], ['confirmado', 'Confirmados'], ['separacao', 'Em separação'], ['entrega', 'Em entrega'], ['entregue', 'Entregues'], ['finalizado', 'Finalizados'], ['cancelado', 'Cancelados']];
  const rows = (d.pedidos || []).map(p => `<tr style="cursor:pointer" onclick="barPedidoDetalhe(${p.id})">
    <td><b>#${p.numero}</b><div class="small mut">${PED_ORIG_LABEL[p.origem] || p.origem}</div></td>
    <td>${esc(p.cliente_nome)}<div class="small mut">${esc(p.cliente_telefone || '')}</div></td>
    <td style="text-align:right">${brl(p.total_cents)}</td>
    <td>${pedPagBadge(p)}</td>
    <td>${pedStatusBadge(p.status)}</td>
    <td class="small mut">${new Date(p.created_at + 'Z').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
  </tr>`).join('');
  el.innerHTML = `<div style="font-weight:800;font-size:19px;margin-bottom:12px">Pedidos / Delivery</div>
    <div class="kpi-grid">
      ${kpi('Abertos', r.abertos || 0, (r.novo || 0) + ' novo(s)', '#e0352b')}
      ${kpi('Em separação', r.separacao || 0)}
      ${kpi('Em entrega', r.entrega || 0)}
      ${kpi('Finalizados', r.finalizado || 0)}
    </div>
    <div class="chips" style="margin:12px 0">${filtros.map(([k, l]) => `<button class="chip ${BARPED.status === k ? 'active' : ''}" onclick="renderBarPedidos({status:'${k}'})">${l}${k && r[k] ? ' (' + r[k] + ')' : ''}</button>`).join('')}</div>
    <div class="card" style="overflow:auto"><table class="tbl"><thead><tr><th>Nº</th><th>Cliente</th><th style="text-align:right">Total</th><th>Pagamento</th><th>Status</th><th>Hora</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="mut" style="padding:18px">Nenhum pedido.</td></tr>'}</tbody></table></div>`;
}
async function barPedidoDetalhe(id) {
  let r; try { r = await api('/api/bar/pedidos/' + id); } catch (e) { toast(e.message, 'err'); return; }
  const p = r.pedido; const see = can('adega:custos');
  const itens = p.itens.map(i => `<div class="rank-row"><span>${i.quantidade}x ${esc(i.nome)}</span><span>${brl(i.total_cents)}</span></div>`).join('');
  const canWrite = can('orders:write');
  const next = PED_NEXT[p.status];
  let acoes = '';
  if (p.status !== 'cancelado' && p.status !== 'finalizado' && canWrite) {
    if (p.pagamento_status !== 'confirmado') acoes += `<button class="btn ok block" onclick="barPedPagamento(${p.id}, true, ${p.total_cents})">💵 Confirmar pagamento (${brl(p.total_cents)})</button>
      <button class="btn ghost block sm" style="margin-top:6px" onclick="barPedPagamento(${p.id}, false)">Pagamento não recebido</button>`;
    if (next) acoes += `<button class="btn primary block" style="margin-top:8px" onclick="barPedStatus(${p.id}, '${next}')">${{ confirmado: 'Confirmar pedido', separacao: 'Iniciar separação', entrega: '🛵 Saiu para entrega', entregue: 'Marcar como entregue', finalizado: 'Finalizar pedido' }[next]}</button>`;
    acoes += `<button class="btn danger block sm" style="margin-top:8px" onclick="barPedCancelar(${p.id})">Cancelar pedido</button>`;
  }
  const troco = p.pagamento_metodo === 'dinheiro' && p.troco_para_cents ? `<div class="row" style="justify-content:space-between"><span class="mut">Troco para</span><span>${brl(p.troco_para_cents)} (troco ${brl(Math.max(0, p.troco_para_cents - p.total_cents))})</span></div>` : '';
  openModal(`<h2 style="margin:0 0 2px">Pedido #${p.numero} ${pedStatusBadge(p.status)}</h2>
    <div class="small mut" style="margin-bottom:10px">${PED_ORIG_LABEL[p.origem] || p.origem} · ${new Date(p.created_at + 'Z').toLocaleString('pt-BR')}</div>
    <div class="card tight" style="margin:0 0 10px">
      <b>${esc(p.cliente_nome)}</b>${p.cliente_telefone ? ` · ${esc(p.cliente_telefone)}` : ''}
      ${p.endereco ? `<div class="small">📍 ${esc(p.endereco)}${p.complemento ? ' · ' + esc(p.complemento) : ''}${p.referencia ? ' · Ref: ' + esc(p.referencia) : ''}</div>` : '<div class="small mut">Retirada / sem endereço</div>'}
      ${p.obs ? `<div class="small mut">Obs: ${esc(p.obs)}</div>` : ''}
    </div>
    <div style="margin:8px 0">${itens}</div>
    <div class="row" style="justify-content:space-between;font-weight:800;font-size:18px"><span>Total</span><span>${brl(p.total_cents)}</span></div>
    ${troco}
    <div class="row" style="justify-content:space-between;margin-top:4px"><span class="mut">Pagamento</span><span>${pedPagBadge(p)}</span></div>
    ${see && p.lucro_cents != null ? `<div class="row" style="justify-content:space-between;color:#1b9e52"><span>Lucro</span><span>${brl(p.lucro_cents)}</span></div>` : ''}
    ${p.status === 'cancelado' ? `<div class="card tight" style="margin-top:10px;background:#fff0f0"><b class="danger">Cancelado</b> <span class="small">${esc(p.cancel_usuario || '')} · ${esc(p.cancel_motivo || '')}</span></div>` : ''}
    <div style="margin-top:12px">${acoes}</div>`, { wide: true });
}
async function barPedStatus(id, status) {
  try { await api('/api/bar/pedidos/' + id + '/status', { method: 'POST', body: { status } }); toast('Pedido atualizado: ' + (PED_ST_LABEL[status] || status), 'ok'); closeModal(); renderBarPedidos(); }
  catch (e) { toast(e.message, 'err'); }
}
async function barPedPagamento(id, recebido, total) {
  if (recebido && !confirm('Confirma que o pagamento de ' + brl(total) + ' foi recebido?')) return;
  if (!recebido && !confirm('Marcar pagamento como NÃO recebido?')) return;
  try { await api('/api/bar/pedidos/' + id + '/pagamento', { method: 'POST', body: { recebido } }); toast(recebido ? 'Pagamento confirmado.' : 'Registrado como não recebido.', recebido ? 'ok' : 'err'); closeModal(); renderBarPedidos(); }
  catch (e) { toast(e.message, 'err'); }
}
async function barPedCancelar(id) {
  const motivo = prompt('Motivo do cancelamento:'); if (motivo === null) return;
  try { await api('/api/bar/pedidos/' + id + '/cancel', { method: 'POST', body: { motivo } }); toast('Pedido cancelado (estoque devolvido).', 'ok'); closeModal(); renderBarPedidos(); }
  catch (e) { toast(e.message, 'err'); }
}

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.status === 401) location.href = '/';
});

init();
