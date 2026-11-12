'use strict';

/* =========================================================
 * Caixa & Portaria — aplicativo único (PWA, offline)
 * Dados salvos no localStorage do aparelho.
 * ========================================================= */

const STORAGE_KEY = 'caixa-portaria:v1';

const defaultState = () => ({
  config: { local: '', operador: '', estacHora: 5 },
  caixa: { aberto: false, aberturaEm: null, fechamentos: [] },
  movimentos: [],
  visitas: [],
  encomendas: [],
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const data = JSON.parse(raw);
    const base = defaultState();
    return {
      ...base,
      ...data,
      config: { ...base.config, ...(data.config || {}) },
      caixa: { ...base.caixa, ...(data.caixa || {}) },
    };
  } catch {
    return defaultState();
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
}

/* ---------- utilidades ---------- */
const $ = (sel) => document.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hora = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dataHora = (ts) => new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hoje = () => dayKey(Date.now());
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const operador = () => state.config.operador || 'Operador';

function duracao(inicio, fim = Date.now()) {
  const min = Math.max(0, Math.round((fim - inicio) / 60000));
  const h = Math.floor(min / 60);
  return h ? `${h}h${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

/** Abre um diálogo; `body` é HTML. Resolve com os campos do formulário ou null se cancelado. */
function dialog(title, body, okLabel = 'Confirmar') {
  return new Promise((resolve) => {
    const dlg = $('#dialog');
    $('#dialog-title').textContent = title;
    $('#dialog-body').innerHTML = body;
    $('#dialog-ok').textContent = okLabel;
    dlg.returnValue = '';
    dlg.onclose = () => {
      if (dlg.returnValue !== 'ok') return resolve(null);
      const fields = {};
      $('#dialog-body').querySelectorAll('[name]').forEach((el) => (fields[el.name] = el.value));
      resolve(fields);
    };
    dlg.showModal();
  });
}

/* ---------- CAIXA ---------- */
function saldo(ate = Infinity) {
  return state.movimentos
    .filter((m) => m.ts <= ate)
    .reduce((acc, m) => acc + (m.tipo === 'entrada' ? m.valor : -m.valor), 0);
}

function lancar({ tipo, valor, forma = 'Dinheiro', categoria = '', descricao = '', origem = null }) {
  const v = Math.round(parseFloat(String(valor).replace(',', '.')) * 100) / 100;
  if (!(v > 0)) {
    toast('Valor inválido');
    return false;
  }
  state.movimentos.push({ id: uid(), ts: Date.now(), tipo, valor: v, forma, categoria, descricao, operador: operador(), origem });
  return true;
}

async function abrirCaixa() {
  const r = await dialog(
    'Abrir caixa',
    `<p class="muted">Saldo atual: ${brl(saldo())}</p>
     <label>Suprimento inicial (troco) em R$
       <input name="valor" type="number" step="0.01" min="0" inputmode="decimal" value="0" />
     </label>`,
    'Abrir'
  );
  if (!r) return;
  state.caixa.aberto = true;
  state.caixa.aberturaEm = Date.now();
  if (parseFloat(r.valor) > 0) {
    lancar({ tipo: 'entrada', valor: r.valor, categoria: 'Suprimento', descricao: 'Abertura de caixa' });
  }
  save();
  toast('Caixa aberto');
}

async function fecharCaixa() {
  const esperado = saldo();
  const desde = state.caixa.aberturaEm || 0;
  const movs = state.movimentos.filter((m) => m.ts >= desde);
  const ent = movs.filter((m) => m.tipo === 'entrada').reduce((a, m) => a + m.valor, 0);
  const sai = movs.filter((m) => m.tipo === 'saida').reduce((a, m) => a + m.valor, 0);
  const r = await dialog(
    'Fechar caixa',
    `<pre>Aberto em: ${dataHora(desde)}
Entradas no turno: ${brl(ent)}
Saídas no turno:   ${brl(sai)}
Saldo esperado:    ${brl(esperado)}</pre>
     <label>Valor contado em caixa (R$)
       <input name="contado" type="number" step="0.01" min="0" inputmode="decimal" value="${esperado.toFixed(2)}" />
     </label>`,
    'Fechar caixa'
  );
  if (!r) return;
  const contado = parseFloat(r.contado) || 0;
  const diferenca = Math.round((contado - esperado) * 100) / 100;
  if (diferenca !== 0) {
    lancar({
      tipo: diferenca > 0 ? 'entrada' : 'saida',
      valor: Math.abs(diferenca),
      categoria: 'Ajuste',
      descricao: diferenca > 0 ? 'Sobra no fechamento' : 'Falta no fechamento',
    });
  }
  state.caixa.fechamentos.push({ id: uid(), abertura: desde, fechamento: Date.now(), esperado, contado, diferenca, operador: operador() });
  state.caixa.aberto = false;
  state.caixa.aberturaEm = null;
  save();
  toast(diferenca === 0 ? 'Caixa fechado sem diferenças' : `Caixa fechado (diferença ${brl(diferenca)})`);
}

/* ---------- PORTARIA ---------- */
function registrarEntrada(dados) {
  state.visitas.push({
    id: uid(),
    nome: dados.nome.trim(),
    documento: dados.documento.trim(),
    tipo: dados.tipo,
    destino: dados.destino.trim(),
    placa: dados.placa.trim().toUpperCase(),
    autorizado: dados.autorizado.trim(),
    obs: dados.obs.trim(),
    entrada: Date.now(),
    saida: null,
    operador: operador(),
  });
}

async function registrarSaida(id) {
  const v = state.visitas.find((x) => x.id === id);
  if (!v || v.saida) return;

  // Integração portaria -> caixa: cobrança de estacionamento para veículos
  if (v.placa) {
    const horas = Math.max(1, Math.ceil((Date.now() - v.entrada) / 3600000));
    const sugerido = (horas * (Number(state.config.estacHora) || 0)).toFixed(2);
    const aviso = state.caixa.aberto ? '' : '<p class="neg">O caixa está fechado: a cobrança não será lançada.</p>';
    const r = await dialog(
      `Saída de ${v.nome}`,
      `<p class="muted">Veículo ${esc(v.placa)} · permanência ${duracao(v.entrada)}</p>
       ${aviso}
       <label>Cobrar estacionamento (R$) — deixe 0 para não cobrar
         <input name="valor" type="number" step="0.01" min="0" inputmode="decimal" value="${state.caixa.aberto ? sugerido : 0}" ${state.caixa.aberto ? '' : 'disabled'} />
       </label>
       <label>Forma de pagamento
         <select name="forma" ${state.caixa.aberto ? '' : 'disabled'}>
           <option>Dinheiro</option><option>PIX</option><option>Cartão de débito</option><option>Cartão de crédito</option>
         </select>
       </label>`,
      'Registrar saída'
    );
    if (!r) return;
    if (state.caixa.aberto && parseFloat(r.valor) > 0) {
      lancar({
        tipo: 'entrada',
        valor: r.valor,
        forma: r.forma,
        categoria: 'Estacionamento',
        descricao: `${v.placa} — ${v.nome}`,
        origem: { tipo: 'visita', id: v.id },
      });
      v.cobrado = parseFloat(r.valor);
    }
  }
  v.saida = Date.now();
  save();
  toast(`Saída registrada: ${v.nome}`);
}

async function entregarEncomenda(id) {
  const e = state.encomendas.find((x) => x.id === id);
  if (!e) return;
  const r = await dialog(
    'Entregar encomenda',
    `<p class="muted">${esc(e.descricao)} · ${esc(e.destino)}</p>
     <label>Retirado por <input name="quem" required /></label>`,
    'Entregar'
  );
  if (!r) return;
  e.retirada = Date.now();
  e.retiradoPor = r.quem.trim() || '—';
  save();
  toast('Encomenda entregue');
}

/* ---------- RENDER ---------- */
function li(html) {
  return `<li>${html}</li>`;
}
const vazio = (msg) => `<li class="empty">${msg}</li>`;

function renderPainel() {
  const h = hoje();
  const movsHoje = state.movimentos.filter((m) => dayKey(m.ts) === h);
  const ent = movsHoje.filter((m) => m.tipo === 'entrada').reduce((a, m) => a + m.valor, 0);
  const sai = movsHoje.filter((m) => m.tipo === 'saida').reduce((a, m) => a + m.valor, 0);
  $('#kpi-saldo').textContent = brl(saldo());
  $('#kpi-entradas').textContent = brl(ent);
  $('#kpi-saidas').textContent = brl(sai);
  $('#kpi-presentes').textContent = state.visitas.filter((v) => !v.saida).length;
  $('#kpi-visitas').textContent = state.visitas.filter((v) => dayKey(v.entrada) === h).length;
  $('#kpi-encomendas').textContent = state.encomendas.filter((e) => !e.retirada).length;

  const eventos = [
    ...state.movimentos.map((m) => ({
      ts: m.ts,
      html: `<div class="info"><span>${m.tipo === 'entrada' ? '💰' : '💸'} ${esc(m.categoria || m.descricao || m.tipo)}</span><small>${dataHora(m.ts)} · ${esc(m.operador)}</small></div>
             <strong class="${m.tipo === 'entrada' ? 'pos' : 'neg'}">${m.tipo === 'entrada' ? '+' : '−'}${brl(m.valor)}</strong>`,
    })),
    ...state.visitas.flatMap((v) => {
      const out = [{ ts: v.entrada, html: `<div class="info"><span>🟢 Entrada: ${esc(v.nome)}</span><small>${dataHora(v.entrada)} · ${esc(v.destino || v.tipo)}</small></div>` }];
      if (v.saida) out.push({ ts: v.saida, html: `<div class="info"><span>🔴 Saída: ${esc(v.nome)}</span><small>${dataHora(v.saida)}</small></div>` });
      return out;
    }),
    ...state.encomendas.map((e) => ({
      ts: e.retirada || e.recebida,
      html: `<div class="info"><span>📦 ${e.retirada ? 'Entregue' : 'Recebida'}: ${esc(e.descricao)}</span><small>${dataHora(e.retirada || e.recebida)} · ${esc(e.destino)}</small></div>`,
    })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 15);

  $('#atividade').innerHTML = eventos.length ? eventos.map((e) => li(e.html)).join('') : vazio('Nenhuma atividade ainda');
}

function renderCaixa() {
  const st = $('#caixa-status');
  if (state.caixa.aberto) {
    st.className = 'status aberto';
    st.innerHTML = `<span>🟢 Caixa aberto desde ${dataHora(state.caixa.aberturaEm)}</span><button class="btn small" data-act="fechar-caixa">Fechar caixa</button>`;
  } else {
    st.className = 'status fechado';
    st.innerHTML = `<span>🔴 Caixa fechado</span><button class="btn small primary" data-act="abrir-caixa">Abrir caixa</button>`;
  }
  $('#form-mov button[type=submit]').disabled = !state.caixa.aberto;

  const dia = $('#caixa-data').value || hoje();
  const movs = state.movimentos.filter((m) => dayKey(m.ts) === dia).sort((a, b) => b.ts - a.ts);
  const ent = movs.filter((m) => m.tipo === 'entrada').reduce((a, m) => a + m.valor, 0);
  const sai = movs.filter((m) => m.tipo === 'saida').reduce((a, m) => a + m.valor, 0);
  $('#caixa-resumo').innerHTML = `
    <div>Entradas<strong class="pos">${brl(ent)}</strong></div>
    <div>Saídas<strong class="neg">${brl(sai)}</strong></div>
    <div>Resultado<strong>${brl(ent - sai)}</strong></div>`;

  $('#lista-mov').innerHTML = movs.length
    ? movs
        .map((m) =>
          li(`<div class="info">
                <span>${esc(m.descricao || m.categoria || (m.tipo === 'entrada' ? 'Entrada' : 'Saída'))}</span>
                <small>${hora(m.ts)} · ${esc(m.forma)}${m.categoria ? ' · ' + esc(m.categoria) : ''} · ${esc(m.operador)}</small>
              </div>
              <div class="actions">
                <strong class="${m.tipo === 'entrada' ? 'pos' : 'neg'}">${m.tipo === 'entrada' ? '+' : '−'}${brl(m.valor)}</strong>
                <button class="btn small" data-act="estornar" data-id="${m.id}" title="Estornar">↩</button>
              </div>`)
        )
        .join('')
    : vazio('Sem movimentações neste dia');
}

function renderPortaria() {
  const termo = $('#busca-presentes').value.trim().toLowerCase();
  const presentes = state.visitas
    .filter((v) => !v.saida)
    .filter((v) => !termo || [v.nome, v.destino, v.placa, v.documento].join(' ').toLowerCase().includes(termo))
    .sort((a, b) => b.entrada - a.entrada);

  $('#lista-presentes').innerHTML = presentes.length
    ? presentes
        .map((v) =>
          li(`<div class="info">
                <span>${esc(v.nome)} <small>(${esc(v.tipo)})</small></span>
                <small>${esc(v.destino || '—')}${v.placa ? ' · 🚗 ' + esc(v.placa) : ''} · entrou ${hora(v.entrada)} (${duracao(v.entrada)})</small>
              </div>
              <div class="actions"><button class="btn small primary" data-act="saida" data-id="${v.id}">Saída</button></div>`)
        )
        .join('')
    : vazio('Ninguém no local');

  const pend = state.encomendas.filter((e) => !e.retirada).sort((a, b) => b.recebida - a.recebida);
  $('#lista-encomendas').innerHTML = pend.length
    ? pend
        .map((e) =>
          li(`<div class="info"><span>📦 ${esc(e.descricao)}</span><small>${esc(e.destino)} · recebida ${dataHora(e.recebida)}</small></div>
              <div class="actions"><button class="btn small" data-act="entregar" data-id="${e.id}">Entregar</button></div>`)
        )
        .join('')
    : vazio('Nenhuma encomenda pendente');

  const dia = $('#portaria-data').value || hoje();
  const hist = state.visitas.filter((v) => dayKey(v.entrada) === dia).sort((a, b) => b.entrada - a.entrada);
  $('#lista-historico').innerHTML = hist.length
    ? hist
        .map((v) =>
          li(`<div class="info">
                <span>${esc(v.nome)} <small>(${esc(v.tipo)})</small></span>
                <small>${hora(v.entrada)} → ${v.saida ? hora(v.saida) : 'no local'} · ${esc(v.destino || '—')}${v.placa ? ' · ' + esc(v.placa) : ''}${v.cobrado ? ' · pago ' + brl(v.cobrado) : ''}</small>
              </div>`)
        )
        .join('')
    : vazio('Sem registros neste dia');

  // sugestões de visitantes já conhecidos
  const nomes = [...new Set(state.visitas.map((v) => v.nome))].slice(-200);
  $('#visitantes-conhecidos').innerHTML = nomes.map((n) => `<option value="${esc(n)}">`).join('');
}

function renderConfig() {
  if (document.activeElement?.id?.startsWith('cfg-')) return;
  $('#cfg-local').value = state.config.local;
  $('#cfg-operador').value = state.config.operador;
  $('#cfg-estac').value = state.config.estacHora;
  document.querySelector('.topbar h1').textContent = state.config.local ? `${state.config.local}` : 'Caixa & Portaria';
}

function renderAll() {
  renderPainel();
  renderCaixa();
  renderPortaria();
  renderConfig();
}

/* ---------- RELATÓRIOS / EXPORTAÇÃO ---------- */
function download(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function csv(linhas) {
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + linhas.map((l) => l.map(cel).join(';')).join('\n');
}

function relatorioDia() {
  const h = hoje();
  const movs = state.movimentos.filter((m) => dayKey(m.ts) === h);
  const porForma = {};
  const porCat = {};
  for (const m of movs) {
    const s = m.tipo === 'entrada' ? m.valor : -m.valor;
    porForma[m.forma] = (porForma[m.forma] || 0) + s;
    const c = m.categoria || 'Sem categoria';
    porCat[c] = (porCat[c] || 0) + s;
  }
  const visitas = state.visitas.filter((v) => dayKey(v.entrada) === h);
  const tipos = {};
  visitas.forEach((v) => (tipos[v.tipo] = (tipos[v.tipo] || 0) + 1));
  const fmt = (o, f) => Object.entries(o).map(([k, v]) => `  ${k}: ${f(v)}`).join('\n') || '  —';

  const texto = `${state.config.local || 'Caixa & Portaria'} — ${new Date().toLocaleDateString('pt-BR')}

CAIXA
Saldo atual: ${brl(saldo())}
Por forma de pagamento:
${fmt(porForma, brl)}
Por categoria:
${fmt(porCat, brl)}

PORTARIA
Visitas: ${visitas.length}
${fmt(tipos, (n) => n)}
No local agora: ${state.visitas.filter((v) => !v.saida).length}
Encomendas pendentes: ${state.encomendas.filter((e) => !e.retirada).length}`;

  dialog('Relatório do dia', `<pre>${esc(texto)}</pre>`, 'Baixar .txt').then((r) => {
    if (r) download(`relatorio-${h}.txt`, texto, 'text/plain');
  });
}

/* ---------- EVENTOS ---------- */
function bind() {
  // navegação
  document.querySelectorAll('.tabbar button').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll('.tabbar button').forEach((x) => x.classList.toggle('active', x === b));
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${b.dataset.tab}`));
      window.scrollTo(0, 0);
    })
  );

  // ações nas listas
  document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, id } = btn.dataset;
    if (act === 'abrir-caixa') abrirCaixa();
    if (act === 'fechar-caixa') fecharCaixa();
    if (act === 'saida') registrarSaida(id);
    if (act === 'entregar') entregarEncomenda(id);
    if (act === 'estornar') {
      const m = state.movimentos.find((x) => x.id === id);
      if (!m) return;
      if (!state.caixa.aberto) return toast('Abra o caixa para estornar');
      const ok = await dialog('Estornar lançamento', `<p>Lançar estorno de ${brl(m.valor)} (${esc(m.descricao || m.categoria || m.tipo)})?</p>`, 'Estornar');
      if (!ok) return;
      lancar({
        tipo: m.tipo === 'entrada' ? 'saida' : 'entrada',
        valor: m.valor,
        forma: m.forma,
        categoria: 'Estorno',
        descricao: `Estorno: ${m.descricao || m.categoria || m.tipo}`,
      });
      save();
      toast('Estorno lançado');
    }
  });

  $('#form-mov').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.caixa.aberto) return toast('Abra o caixa primeiro');
    const d = Object.fromEntries(new FormData(e.target));
    if (!lancar(d)) return;
    e.target.reset();
    save();
    toast('Lançamento registrado');
  });

  $('#form-visita').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (!d.nome.trim()) return;
    registrarEntrada(d);
    e.target.reset();
    save();
    toast(`Entrada registrada: ${d.nome}`);
  });

  // preenche dados de visitante conhecido
  $('#form-visita [name=nome]').addEventListener('change', (e) => {
    const ult = [...state.visitas].reverse().find((v) => v.nome.toLowerCase() === e.target.value.trim().toLowerCase());
    if (!ult) return;
    const f = e.target.form;
    for (const k of ['documento', 'tipo', 'destino', 'placa']) if (!f[k].value || k === 'tipo') f[k].value = ult[k] || f[k].value;
  });

  $('#form-encomenda').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    state.encomendas.push({ id: uid(), destino: d.destino.trim(), descricao: d.descricao.trim(), recebida: Date.now(), retirada: null, operador: operador() });
    e.target.reset();
    save();
    toast('Encomenda registrada');
  });

  $('#busca-presentes').addEventListener('input', renderPortaria);
  $('#caixa-data').addEventListener('change', renderCaixa);
  $('#portaria-data').addEventListener('change', renderPortaria);

  // configurações
  $('#cfg-local').addEventListener('change', (e) => { state.config.local = e.target.value.trim(); save(); });
  $('#cfg-operador').addEventListener('change', (e) => { state.config.operador = e.target.value.trim(); save(); });
  $('#cfg-estac').addEventListener('change', (e) => { state.config.estacHora = parseFloat(e.target.value) || 0; save(); });

  // relatórios e backup
  $('#btn-relatorio').addEventListener('click', relatorioDia);
  $('#btn-csv-caixa').addEventListener('click', () =>
    download(
      `caixa-${hoje()}.csv`,
      csv([
        ['Data/hora', 'Tipo', 'Valor', 'Forma', 'Categoria', 'Descrição', 'Operador'],
        ...state.movimentos.map((m) => [dataHora(m.ts), m.tipo, m.valor.toFixed(2).replace('.', ','), m.forma, m.categoria, m.descricao, m.operador]),
      ]),
      'text/csv'
    )
  );
  $('#btn-csv-portaria').addEventListener('click', () =>
    download(
      `portaria-${hoje()}.csv`,
      csv([
        ['Nome', 'Documento', 'Tipo', 'Destino', 'Placa', 'Autorizado por', 'Entrada', 'Saída', 'Valor cobrado', 'Obs'],
        ...state.visitas.map((v) => [v.nome, v.documento, v.tipo, v.destino, v.placa, v.autorizado, dataHora(v.entrada), v.saida ? dataHora(v.saida) : '', v.cobrado ? v.cobrado.toFixed(2).replace('.', ',') : '', v.obs]),
      ]),
      'text/csv'
    )
  );
  $('#btn-backup').addEventListener('click', () => download(`backup-caixa-portaria-${hoje()}.json`, JSON.stringify(state, null, 2), 'application/json'));
  $('#input-restore').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.movimentos) || !Array.isArray(data.visitas)) throw new Error();
      const ok = await dialog('Restaurar backup', '<p>Os dados atuais serão substituídos pelos do backup. Continuar?</p>', 'Restaurar');
      if (!ok) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      state = load();
      save();
      toast('Backup restaurado');
    } catch {
      toast('Arquivo de backup inválido');
    } finally {
      e.target.value = '';
    }
  });
  $('#btn-limpar').addEventListener('click', async () => {
    const r = await dialog('Apagar todos os dados', '<p class="neg">Esta ação não pode ser desfeita. Digite APAGAR para confirmar.</p><input name="conf" autocomplete="off" />', 'Apagar');
    if (!r || r.conf.trim().toUpperCase() !== 'APAGAR') return;
    state = defaultState();
    save();
    toast('Dados apagados');
  });
}

/* ---------- INICIALIZAÇÃO ---------- */
function tick() {
  $('#clock').textContent = new Date().toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

$('#caixa-data').value = hoje();
$('#portaria-data').value = hoje();
bind();
renderAll();
tick();
setInterval(() => { tick(); renderPainel(); renderPortaria(); }, 30000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
