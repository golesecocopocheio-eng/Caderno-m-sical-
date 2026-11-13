/* Tabela de preços (aba 💲 Preços do Bar Conect)
 *
 * - Lê a foto da nota de compra (bebidas, limão, açúcar, qualquer insumo) sem internet, com o
 *   mesmo leitor da aba 📸 Foto, e monta uma linha por produto: quantidade, unidade (UN, KG,
 *   CX...), preço unitário, total e conteúdo (750 ml, 1 kg, 12×350 ml...).
 * - Liga cada produto ao ingrediente da Ficha técnica e ao item do Estoque (sugere sozinho e
 *   lembra a escolha para as próximas notas).
 * - Aplicar: atualiza o custo das receitas (meta.custo do Caixa), soma a compra no Estoque
 *   (movimento de compra + preço + registro da compra) e guarda na tabela de preços
 *   (meta.tabPrecos do Caixa, que também vai para a nuvem quando a sincronização estiver ligada).
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const painel = $('#f-precos');
  if (!painel) return;

  /* ---------- utilidades ---------- */
  const num = (s) => {
    s = String(s ?? '').trim().replace(/[R$\s]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return isNaN(n) ? 0 : n;
  };
  const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const campo = (n, d = 2) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const chaveNome = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const lerJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  const doseMl = () => num(lerJSON('caixa-bar-meta').doseMl) || 50;
  // valor da garrafa (ou unidade) e da dose, a partir do preço unitário e dos ml
  const garrafaDose = (it) => it.tipo === 'ml' && it.conteudo > 0 ? 'garrafa ' + brl(it.preco) + ' · dose ' + doseMl() + ' ml ' + brl(it.preco * doseMl() / it.conteudo) : '';

  /* ---------- leitura da nota ---------- */
  const PULAR = /\b(TOTAL|SUBTOTAL|SUB-TOTAL|DESCONTO|ACRESCIMO|TROCO|ICMS|IPI|PIS|COFINS|CNPJ|CPF|IE\b|VALOR A PAGAR|FORMA DE PAG|DINHEIRO|CARTAO|CREDITO|DEBITO|PIX|TRIBUTOS|FRETE|QTD\.? TOTAL|ITENS)\b/;
  const UNID = /\b(UN|UND|UNID|CX|KG|PCT|PC|PT|FD|FDO|GF|GFA|LT|DZ|SC|BD|BJ)\b/;
  const VALOR = /\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+,\d{2,4}/g;
  function conteudoDe(desc) {
    const D = semAcento(desc).toUpperCase();
    let m = D.match(/(?<![\d.,])(\d{1,3})\s*[X×]\s*(\d{1,4}(?:[.,]\d+)?)\s*(ML|L|LT|G|GR|KG)\b/);
    const conv = (v, u) => (u === 'L' || u === 'LT' || u === 'KG' ? v * 1000 : v);
    const tipo = (u) => (u === 'G' || u === 'GR' || u === 'KG' ? 'g' : 'ml');
    if (m) return { conteudo: +m[1] * conv(num(m[2]), m[3]), tipo: tipo(m[3]) };
    m = D.match(/(?<![\d.,])(\d{1,4}(?:[.,]\d{1,3})?)\s*(ML|L|LT|LTS|G|GR|KG)\b/);
    if (m) return { conteudo: conv(num(m[1]), m[2].replace('LTS', 'LT')), tipo: tipo(m[2]) };
    return null;
  }
  function lerNota(texto) {
    const itens = [];
    texto.split(/\r?\n/).forEach((linha) => {
      const L = semAcento(linha).toUpperCase().trim();
      if (L.length < 6 || PULAR.test(L)) return;
      const vs = (L.match(VALOR) || []).map(num);
      if (!vs.length) return;
      // descrição: começa no primeiro texto com letras, até o primeiro número longo (NCM) ou valor
      let desc = L.replace(/^\s*\d{1,14}\s+/, '');
      const descInteira = desc;
      const corte = desc.search(/\s\d{6,}\s|\s\d+,\d{2,4}\b|\s\d+(?:[.,]\d+)?\s+(UN|UND|UNID|CX|KG|PCT|PC|FD|DZ)\b|\s(UN|UND|UNID|CX|KG|PCT|PC|FD|DZ)\s+\d|\s(UN|UND|UNID|CX|KG|PCT|PC|FD|DZ)\s*$/);
      if (corte > 2) desc = desc.slice(0, corte);
      desc = desc.replace(/\s+/g, ' ').trim();
      if (!/[A-Z]{3,}/.test(desc)) return;
      let qtd = 0, unit = 0, total = 0;
      const ok = (q, u, t) => q > 0 && u > 0 && Math.abs(q * u - t) <= Math.max(0.05, t * 0.012);
      if (vs.length >= 3) {
        const [q, u, t] = vs.slice(-3);
        if (ok(q, u, t)) { qtd = q; unit = u; total = t; }
        else { for (let i = 0; i < vs.length - 1 && !qtd; i++) for (let j = i + 1; j < vs.length - 1 && !qtd; j++) if (ok(vs[i], vs[j], vs[vs.length - 1])) { qtd = vs[i]; unit = vs[j]; total = vs[vs.length - 1]; } }
      }
      if (!qtd && vs.length >= 2) {
        const [a, b] = vs.slice(-2);
        const mq = L.match(/(\d+(?:[.,]\d+)?)\s*(UN|UND|UNID|CX|KG|PCT|PC|FD|DZ|LT)\b/);
        const q = mq ? num(mq[1]) : 0;
        if (q && ok(q, a, b)) { qtd = q; unit = a; total = b; }
        else if (b > a && Math.abs(b / a - Math.round(b / a)) < 0.01) { qtd = Math.round(b / a); unit = a; total = b; }
        else if (a < b && a < 100 && (a % 1)) { qtd = a; total = b; unit = b / a; }
        else { qtd = 1; unit = b; total = b; }
      }
      if (!qtd && vs.length === 1) { qtd = 1; unit = vs[0]; total = vs[0]; }
      if (!total) return;
      const um = (L.match(UNID) || [])[1] || 'UN';
      const c = conteudoDe(desc) || conteudoDe(descInteira.replace(/\s\d+(?:[.,]\d+)?\s*X\s.*$/, '')) || (um === 'KG' ? { conteudo: 1000, tipo: 'g' } : null);
      itens.push({ produto: desc, qtd, un: um === 'UND' || um === 'UNID' ? 'UN' : um, preco: Math.round(unit * 100) / 100, total, conteudo: c ? c.conteudo : 0, tipo: c ? c.tipo : 'un' });
    });
    return itens;
  }

  /* ---------- vínculos com a ficha técnica e o estoque ---------- */
  let ingredientes = {}, estoque = { items: {}, mov: {}, price: {} };
  async function carregarFontes() {
    try { const w = document.getElementById('f-caixa').contentWindow; ingredientes = (w.__cxIngredientes && w.__cxIngredientes()) || {}; } catch (e) { ingredientes = {}; }
    try { const b = await window.__barExportar(); estoque = b.apps.estoque || estoque; } catch (e) {}
  }
  const tokens = (s) => chaveNome(s).replace(/\b\d+([.,]\d+)?\s*(ml|l|lt|kg|g|gr|un|und|cx|pct)\b/g, ' ').split(' ').filter((t) => t.length > 2 && !/^(com|sem|de|da|do|para|tipo|unid|und|pct|cxa|garrafa|lata|pet|vidro)$/.test(t));
  function melhor(desc, opcoes, ehFicha) {
    const td = tokens(desc);
    let best = '', score = 0;
    opcoes.forEach(([id, nome]) => {
      if (ehFicha && /\(dose\)|^completar|^finalizar|^tintura|^redu[cç]/.test(nome)) return;
      const tn = tokens(nome);
      if (!tn.length) return;
      const comum = tn.filter((t) => td.some((d) => d === t || (t.length > 4 && (d.startsWith(t.slice(0, 5)) || t.startsWith(d.slice(0, 5))))));
      const s = comum.length / tn.length + comum.length * 0.05;
      if (comum.length && s > score) { score = s; best = id; }
    });
    return score >= 0.5 ? best : '';
  }
  // rendimento padrão (unidades por kg) para itens comprados por peso e usados por unidade
  const RENDE_KG = [[/limao siciliano/, 6], [/limao/, 8], [/laranja/, 5], [/maracuja/, 6], [/abacaxi/, 0.7], [/gengibre/, 20], [/manjericao|capim/, 40]];
  const rendePadrao = (k) => { const n = chaveNome(k); const r = RENDE_KG.find(([re]) => re.test(n)); return r ? r[1] : 1; };
  const ML_KG = [[/limao/, 400], [/laranja/, 450], [/maracuja/, 300], [/abacaxi/, 500]];
  const mlkgPadrao = (k) => { const n = chaveNome(k); const r = ML_KG.find(([re]) => re.test(n)); return r ? r[1] : 1000; };

  /* ---------- estado ---------- */
  let rascunho = [];
  let nf = '';
  const meta = () => lerJSON('caixa-bar-meta');
  const tabela = () => meta().tabPrecos || { produtos: {}, alias: {} };
  function sugerir(it) {
    const tp = tabela(), alias = tp.alias[chaveNome(it.produto)];
    const opF = Object.keys(ingredientes).map((k) => [k, k]);
    const opE = Object.entries(estoque.items || {}).map(([id, v]) => [id, v.n]);
    it.ficha = alias ? alias.ficha : melhor(it.produto, opF, true);
    it.estoque = alias ? alias.estoque : melhor(it.produto, opE, false);
    if (alias && alias.conteudo && !it.conteudo) { it.conteudo = alias.conteudo; it.tipo = alias.tipo; }
    it.rende = alias && alias.rende ? alias.rende : (it.un === 'KG' ? rendePadrao(it.ficha || it.produto) : it.un === 'DZ' ? 12
      : it.ficha && ingredientes[it.ficha] === 'un' && it.tipo === 'ml' && it.conteudo ? it.conteudo : 1);
    it.mlkg = alias && alias.mlkg ? alias.mlkg : mlkgPadrao(it.ficha || it.produto);
    // bebida sem ml na nota: usa a garrafa padrão (750 ml, ajustável na Ficha técnica)
    if (!it.conteudo && it.un !== 'KG' && it.ficha && ingredientes[it.ficha] === 'ml') { it.conteudo = num(lerJSON('caixa-bar-meta').garrafaMl) || 750; it.tipo = 'ml'; }
    it.somar = !!it.estoque;
  }

  /* ---------- tela ---------- */
  painel.innerHTML = `
    <h1>💲 Tabela de preços</h1>
    <p>Tire foto da nota de compra. O app lê cada produto, atualiza o <b>custo das receitas</b> da Ficha técnica, soma no <b>Estoque</b> e guarda o preço aqui.</p>
    <div class="ft-chips" style="margin-top:12px">
      <label class="ft-foto-btn" style="margin:0!important;background:#ec4899">📷 Foto da nota<input type="file" id="pcCam" accept="image/*" capture="environment" hidden></label>
      <label class="ft-foto-btn" style="margin:0!important;background:#9d174d">🖼️ Galeria<input type="file" id="pcArq" accept="image/*" multiple hidden></label>
    </div>
    <button class="sec" id="pcManual">✍️ Adicionar produto sem foto</button>
    <div id="pcLeitura"></div>
    <div id="pcAcoes" hidden>
      <label>Fornecedor / número da nota<input id="pcNF" placeholder="ex.: Zumbi Atacado NF 1234"></label>
      <button id="pcAplicar" style="background:#15803d">✅ Aplicar na ficha técnica e no estoque</button>
      <p id="pcMsg"></p>
    </div>
    <h1 style="margin-top:26px">📋 Produtos</h1>
    <input id="pcBusca" placeholder="Buscar produto…" style="margin-top:4px">
    <div class="ft-card ft-tot" id="pcResumo"></div>
    <div id="pcTabela"></div>`;

  function opcoes(lista, sel) { return '<option value="">—</option>' + lista.map(([v, n]) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(n)}</option>`).join(''); }
  function desenharLeitura() {
    const opF = Object.keys(ingredientes).sort().map((k) => [k, k + (ingredientes[k] === 'ml' ? ' (ml)' : '')]);
    const opE = Object.entries(estoque.items || {}).sort((a, b) => a[1].n.localeCompare(b[1].n)).map(([id, v]) => [id, v.n]);
    $('#pcLeitura', painel).innerHTML = rascunho.map((it, i) => {
      if (it.lendo) return `<div class="ft-card"><div class="ft-cab">${it.mini ? `<img src="${it.mini}" alt="">` : ''}<div><b>Lendo a nota…</b><small>${esc(it.lendo)}</small></div></div></div>`;
      const usoUn = it.ficha && ingredientes[it.ficha] === 'un';
      return `<div class="ft-card pc-it" data-i="${i}">
        <div class="ft-cab"><div><input class="pc-nome" data-k="produto" value="${esc(it.produto)}"></div><button class="ft-x" data-x="${i}">✕</button></div>
        <div class="ft-grid pc-g3">
          <label>Qtd<input inputmode="decimal" data-k="qtd" value="${campo(it.qtd, it.qtd % 1 ? 3 : 0)}"></label>
          <label>Unidade<select data-k="un">${['UN', 'KG', 'CX', 'PCT', 'FD', 'DZ', 'LT', 'GF'].map((u) => `<option${u === it.un ? ' selected' : ''}>${u}</option>`).join('')}</select></label>
          <label>Preço un. (R$)<input inputmode="decimal" data-k="preco" value="${campo(it.preco)}"></label>
        </div>
        <label>Total pago (R$) <small>— o app divide pela quantidade</small><input inputmode="decimal" data-k="totalPago" value="${campo(it.qtd * it.preco)}"></label>
        <div class="ft-grid">
          <label>Conteúdo por ${esc(it.un)}<input inputmode="decimal" data-k="conteudo" value="${it.conteudo ? campo(it.conteudo, 0) : ''}" placeholder="ex.: 750"></label>
          <label>Medida<select data-k="tipo">${[['ml', 'ml'], ['g', 'g'], ['un', 'unidades']].map(([v, n]) => `<option value="${v}"${v === it.tipo ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        </div>
        <label>🍸 Ingrediente da ficha técnica<select data-k="ficha">${opcoes(opF, it.ficha)}</select></label>
        ${usoUn || (it.ficha && (it.un === 'KG' || it.un === 'DZ')) ? `<label>Rende quantas ${it.tipo === 'ml' && it.un !== 'KG' ? 'doses / dash (≈1 ml cada)' : 'unidades'} por ${esc(it.un)}?<input inputmode="decimal" data-k="rende" value="${campo(it.rende, it.rende % 1 ? 1 : 0)}"></label>` : ''}
        ${it.ficha && ingredientes[it.ficha] === 'ml' && it.un === 'KG' ? `<label>Rende quantos ml por kg? (suco / volume)<input inputmode="decimal" data-k="mlkg" value="${campo(it.mlkg, 0)}"></label>` : ''}
        <label>📦 Item do estoque<select data-k="estoque">${opcoes(opE, it.estoque)}</select></label>
        ${it.estoque ? `<label class="pc-check"><input type="checkbox" data-k="somar"${it.somar ? ' checked' : ''}> Somar ${campo(it.qtd, it.qtd % 1 ? 3 : 0)} ${esc(it.un)} no estoque</label>` : ''}
        <small class="ft-ok">${esc(rodape(it))}</small>
      </div>`;
    }).join('');
    $('#pcAcoes', painel).hidden = !rascunho.some((x) => !x.lendo);
  }
  // Como o ingrediente entra no custo das receitas (meta.custo do Caixa):
  // p = preço por unidade usada na receita; v = ml dessa unidade (só para ingredientes em ml).
  function custoFicha(it) {
    const u = ingredientes[it.ficha], r = it.rende || 1;
    if (it.un === 'KG' || it.un === 'DZ') return u === 'ml' ? { p: it.preco / r, v: (it.un === 'KG' ? it.mlkg || 1000 : it.conteudo || 0) / r } : { p: it.preco / r };
    if (u === 'ml') return { p: it.preco, v: it.conteudo || 0 };
    return { p: it.preco / r };
  }
  function custoReceita(it) {
    const c = custoFicha(it);
    if (ingredientes[it.ficha] === 'ml') return c.v ? brl(c.p / c.v) + ' por ml' : 'informe o conteúdo';
    return brl(c.p) + ' por unidade';
  }
  const rodape = (it) => [garrafaDose(it), 'total ' + brl(it.qtd * it.preco) + (it.total && Math.abs(it.total - it.qtd * it.preco) > 0.05 ? ' (na nota: ' + brl(it.total) + ' ⚠️)' : ''), it.ficha ? 'na receita: ' + custoReceita(it) : ''].filter(Boolean).join(' · ');
  function atualizarRodape(box, it) {
    const r = box.querySelector('.ft-ok');
    if (r) r.textContent = rodape(it);
  }
  painel.addEventListener('input', (e) => {
    const box = e.target.closest('.pc-it'); if (!box) return;
    const it = rascunho[+box.dataset.i], k = e.target.dataset.k; if (!k) return;
    if (k === 'totalPago') {
      const t = num(e.target.value); if (it.qtd > 0) it.preco = Math.round(t / it.qtd * 100) / 100;
      const pr = box.querySelector('[data-k="preco"]'); if (pr) pr.value = campo(it.preco);
      atualizarRodape(box, it); return;
    }
    it[k] = e.target.type === 'checkbox' ? e.target.checked : ['qtd', 'preco', 'conteudo', 'rende', 'mlkg'].includes(k) ? num(e.target.value) : e.target.value;
    if (k === 'preco' || k === 'qtd') { const tp = box.querySelector('[data-k="totalPago"]'); if (tp && document.activeElement !== tp) tp.value = campo(it.qtd * it.preco); }
    if (['ficha', 'estoque', 'un', 'somar'].includes(k)) setTimeout(desenharLeitura, 0); else atualizarRodape(box, it);
  });
  painel.addEventListener('change', (e) => { if (e.target.closest('.pc-it') && e.target.dataset.k === 'qtd') setTimeout(desenharLeitura, 0); });
  painel.addEventListener('click', (e) => {
    const x = e.target.closest('[data-x]'); if (!x || !x.closest('#pcLeitura')) return;
    if (!x.dataset.arm) { x.dataset.arm = '1'; x.textContent = 'Remover?'; setTimeout(() => { x.dataset.arm = ''; x.textContent = '✕'; }, 3000); return; }
    rascunho.splice(+x.dataset.x, 1); desenharLeitura();
  });
  $('#pcManual', painel).onclick = async () => { await carregarFontes(); const it = { produto: 'Produto', qtd: 1, un: 'UN', preco: 0, total: 0, conteudo: 0, tipo: 'ml' }; sugerir(it); rascunho.push(it); desenharLeitura(); };

  async function lerFotos(e) {
    const arquivos = [...e.target.files]; e.target.value = '';
    await carregarFontes();
    for (const arq of arquivos) {
      const marca = { lendo: 'Preparando a foto…' };
      rascunho.push(marca); desenharLeitura();
      try {
        const r = await window.__barOCR(arq, (m) => { if (m.status === 'recognizing text') { marca.lendo = 'Lendo… ' + Math.round(m.progress * 100) + '% (a primeira vez demora um pouco)'; desenharLeitura(); } }, 2400);
        const itens = lerNota(r.texto);
        itens.forEach(sugerir);
        const pos = rascunho.indexOf(marca);
        rascunho.splice(pos, 1, ...itens);
        if (!itens.length) $('#pcMsg', painel) && ($('#pcMsg', painel).textContent = 'Não encontrei produtos com preço nesta foto. Tente uma foto mais de perto, com a nota reta e bem iluminada, ou adicione sem foto.');
        window.__barNotaTexto = r.texto;
      } catch (err) {
        rascunho.splice(rascunho.indexOf(marca), 1);
        alert('Não consegui ler esta foto: ' + (err.message || err));
      }
      desenharLeitura();
    }
  }
  $('#pcCam', painel).onchange = lerFotos;
  $('#pcArq', painel).onchange = lerFotos;
  $('#pcNF', painel).oninput = (e) => (nf = e.target.value);

  /* ---------- aplicar ---------- */
  let armado = false;
  $('#pcAplicar', painel).onclick = async () => {
    const msg = $('#pcMsg', painel);
    const itens = rascunho.filter((x) => !x.lendo && x.produto && x.preco > 0);
    if (!itens.length) { msg.textContent = 'Nenhum produto com preço para aplicar.'; return; }
    const nFicha = itens.filter((x) => x.ficha).length, nEst = itens.filter((x) => x.estoque && x.somar).length;
    if (!armado) {
      armado = true; setTimeout(() => (armado = false), 8000);
      msg.textContent = `Vou guardar ${itens.length} preço(s), atualizar ${nFicha} ingrediente(s) da ficha técnica e somar ${nEst} compra(s) no estoque. Toque em Aplicar de novo para confirmar.`;
      return;
    }
    armado = false; msg.textContent = 'Aplicando…';
    try {
      const m = meta(), t = Date.now(), d = hoje();
      m.custo = m.custo || {}; m.tabPrecos = m.tabPrecos || { produtos: {}, alias: {} };
      const est = { mov: {}, price: {}, pg: {} };
      itens.forEach((it, i) => {
        const chave = chaveNome(it.produto);
        // ficha técnica
        if (it.ficha) {
          const c = custoFicha(it);
          // valores menores que R$ 1 vão com 4 casas: o Caixa lê "0,874" como 874 (três casas = milhar)
          m.custo[it.ficha] = { p: campo(c.p, c.p < 1 ? 4 : 2), v: c.v ? String(Math.round(c.v)) : '' };
        }
        // estoque: compra + preço + registro
        if (it.estoque && it.somar) {
          const id = 'nfp' + t.toString(36) + i;
          est.mov['m' + id] = { d: it.qtd, i: it.estoque, k: 'p', t: t + i };
          est.pg['p' + id] = { i: it.estoque, nf: nf || ('Nota ' + d.split('-').reverse().join('/')), q: it.qtd, t: t + i, u: it.qtd, v: campo(it.qtd * it.preco) };
        }
        if (it.estoque) est.price[it.estoque] = Object.assign({}, (estoque.price || {})[it.estoque] || {}, { pu: campo(it.preco).replace(/,00$/, '') });
        // tabela de preços e memória dos vínculos
        m.tabPrecos.produtos[chave] = { nome: it.produto, un: it.un, preco: it.preco, conteudo: it.conteudo, tipo: it.tipo, ficha: it.ficha || '', estoque: it.estoque || '', rende: it.rende || 1, data: d, nf: nf || '' };
        m.tabPrecos.alias[chave] = { ficha: it.ficha || '', estoque: it.estoque || '', conteudo: it.conteudo, tipo: it.tipo, rende: it.rende || 1, mlkg: it.mlkg || 0 };
      });
      localStorage.setItem('caixa-bar-meta', JSON.stringify(m));
      if (Object.keys(est.mov).length || Object.keys(est.price).length) await window.__barImportar({ apps: { estoque: est } });
      ['f-caixa', 'f-estoque'].forEach((id) => { const f = document.getElementById(id); if (f && f.src) f.contentWindow.location.reload(); });
      rascunho = []; nf = ''; $('#pcNF', painel).value = '';
      await carregarFontes();
      desenharLeitura(); desenharTabela();
      msg.textContent = `✅ Pronto: ${itens.length} preço(s) guardado(s), ${nFicha} ingrediente(s) da ficha técnica e ${nEst} compra(s) no estoque.`;
      $('#pcAcoes', painel).hidden = false;
    } catch (err) { msg.textContent = 'Não consegui aplicar: ' + (err.message || err); }
  };

  /* ---------- tabela de produtos ---------- */
  function qtdEstoque(id) {
    const it = (estoque.items || {})[id]; if (!it) return null;
    let q = num(it.base);
    Object.values(estoque.mov || {}).forEach((m) => { if (m.i === id && (m.t || 0) > (it.bt || 0)) q += Number(m.d) || 0; });
    return q;
  }
  function desenharTabela() {
    const busca = chaveNome($('#pcBusca', painel).value);
    const ps = Object.values(tabela().produtos || {}).filter((p) => !busca || chaveNome(p.nome).includes(busca)).sort((a, b) => a.nome.localeCompare(b.nome));
    let valorTotal = 0;
    const linhas = ps.map((p) => {
      const q = p.estoque ? qtdEstoque(p.estoque) : null;
      const valor = q !== null ? q * p.preco : null;
      if (valor) valorTotal += valor;
      const porMedida = p.conteudo ? (p.tipo === 'g' ? brl(p.preco / p.conteudo * 1000) + '/kg' : p.tipo === 'ml' ? brl(p.preco / p.conteudo * 1000) + '/litro · <b>dose ' + doseMl() + ' ml ' + brl(p.preco * doseMl() / p.conteudo) + '</b>' : brl(p.preco / p.conteudo) + '/un') : '';
      return `<div class="hs"><div><b>${esc(p.nome)}</b><small>${brl(p.preco)} por ${esc(p.un)}${p.conteudo ? ' (' + campo(p.conteudo, 0) + ' ' + (p.tipo === 'un' ? 'un' : p.tipo) + ')' : ''}${porMedida ? ' · ' + porMedida : ''} · ${esc(p.data.split('-').reverse().join('/'))}${p.nf ? ' · ' + esc(p.nf) : ''}${p.ficha ? '<br>🍸 ' + esc(p.ficha) : ''}${q !== null ? '<br>📦 Estoque: ' + campo(q, q % 1 ? 2 : 0) + ' · valor ' + brl(valor) : ''}</small></div></div>`;
    }).join('');
    $('#pcTabela', painel).innerHTML = linhas || '<p>Nenhum produto ainda. Tire foto de uma nota de compra.</p>';
    $('#pcResumo', painel).innerHTML = `<div class="ft-r"><span>Produtos na tabela</span><b>${ps.length}</b></div><div class="ft-r ft-big"><span>Valor em estoque</span><b>${brl(valorTotal)}</b></div>`;
  }
  $('#pcBusca', painel).oninput = desenharTabela;

  // Aberto pela Ficha técnica (botão 📷 Foto da nota) ou ao abrir a aba
  window.__barPrecosAtualizar = async () => { await carregarFontes(); desenharLeitura(); desenharTabela(); };
  window.__barAbrirNota = () => {
    const b = document.querySelector('nav [data-tab=precos]'); if (b) b.click();
    $('#pcCam', painel).click();
  };
  window.__barNotaLer = lerNota; // usado nos testes
  desenharTabela();
})();
