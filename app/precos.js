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

  // 🥃 dose: garrafa de X ml rende X/dose doses; custo da dose = preço da garrafa × dose / X
  // só garrafas servidas em dose (destilados, licores, vinhos): 375 ml ou mais, sem cerveja/refri/água/suco
  const NAO_DOSE = /cerveja|chopp|refri|refrigerante|agua|água|suco|energ|tonica|tônica|lata|long\s*neck|\bln\b|soda|xarope|leite/i;
  const doses = (p) => p.tipo === 'ml' && p.conteudo >= 375 && !NAO_DOSE.test(p.nome || p.produto || '') ? { n: Math.floor(p.conteudo / doseMl() * 10) / 10, custo: p.preco * doseMl() / p.conteudo } : null;
  const doseTxt = (p) => { const d = doses(p); return d ? `🥃 garrafa ${brl(p.preco)} · ${campo(p.conteudo, 0)} ml = ${String(d.n).replace('.', ',')} doses de ${doseMl()} ml · <b>${brl(d.custo)} por dose</b>` : ''; };
  /* ---------- leitor do Android (Google ML Kit): scanner de documentos + texto com posição ---------- */
  const leitorNativo = () => { try { const C = window.Capacitor; return C && C.isPluginAvailable && C.isPluginAvailable('LeitorTexto') ? C.Plugins.LeitorTexto : null; } catch (e) { return null; } };
  // junta as palavras da mesma linha da nota (descrição, qtd, preço un., total ficam em colunas)
  function linhasParaTexto(linhas) {
    const L = (linhas || []).filter((l) => l && l.t && l.h > 0).map((l) => ({ t: String(l.t), x: +l.x || 0, h: +l.h, cy: (+l.y || 0) + (+l.h) / 2 }));
    if (!L.length) return '';
    const hs = L.map((l) => l.h).sort((a, b) => a - b), hm = hs[Math.floor(hs.length / 2)] || 10;
    L.sort((a, b) => a.cy - b.cy);
    const rows = [];
    for (const l of L) { const r = rows[rows.length - 1]; if (r && Math.abs(r.cy - l.cy) < hm * 0.55) { r.it.push(l); r.cy = r.it.reduce((s, x) => s + x.cy, 0) / r.it.length; } else rows.push({ cy: l.cy, it: [l] }); }
    return rows.map((r) => r.it.sort((a, b) => a.x - b.x).map((x) => x.t).join('  ')).join('\n');
  }
  window.__barNotaLinhas = linhasParaTexto; // usado nos testes
  async function paraBase64(arq, max) {
    const url = URL.createObjectURL(arq);
    try {
      const img = await new Promise((ok, er) => { const i = new Image(); i.onload = () => ok(i); i.onerror = er; i.src = url; });
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.9);
    } finally { URL.revokeObjectURL(url); }
  }

  /* ---------- leitura da nota ---------- */
  const PULAR = /\b(TOTAL|SUBTOTAL|SUB-TOTAL|DESCONTO|ACRESCIMO|TROCO|ICMS|IPI|PIS|COFINS|CNPJ|CPF|IE\b|VALOR A PAGAR|FORMA DE PAG|DINHEIRO|CARTAO|CREDITO|DEBITO|PIX|TRIBUTOS|FRETE|QTD\.? TOTAL|ITENS)\b/;
  const UNID = /\b(UN|UND|UNID|CX|KG|PCT|PC|PT|FD|FDO|GF|GFA|GAR|LT|DZ|SC|BD|BJ|LATA)\b/;
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
      // tira o número do item e o código de barras (EAN) do começo
      let desc = L.replace(/^\s*(\d{1,4}\s+)?(\d{6,14}\s+)?(\d{4}\.\d{2}\.\d{2}\s+)?/, '').replace(/\s\d{4}\.\d{2}\.\d{2}\b/, '');
      const descInteira = desc;
      const corte = desc.search(/\s\d{6,}\s|\s\d+,\d{2,4}\b|\s\d+(?:[.,]\d+)?\s+(UN|UND|UNID|CX|KG|PCT|PC|PT|FD|FDO|DZ|GF|GFA|GAR|LT|SC|BD|BJ|LATA)\b|\s(UN|UND|UNID|CX|KG|PCT|PC|PT|FD|FDO|DZ|GF|GFA|GAR|LT|SC|BD|BJ|LATA)\s+\d|\s(UN|UND|UNID|CX|KG|PCT|PC|PT|FD|FDO|DZ|GF|GFA|GAR|LT|SC|BD|BJ|LATA)\s*$/);
      if (corte > 2) desc = desc.slice(0, corte);
      desc = desc.replace(/\s+/g, ' ').trim();
      if (!/[A-Z]{3,}/.test(desc)) return;
      let qtd = 0, unit = 0, total = 0;
      const ok = (q, u, t) => q > 0 && u > 0 && Math.abs(q * u - t) <= Math.max(0.05, t * 0.012);
      // quantidade inteira solta antes da unidade ("6 GF", "12 UN") também conta
      const qSolta = (L.match(new RegExp('(?:^|\\s)(\\d{1,4}(?:[.,]\\d{1,4})?)\\s*(UN|UND|UNID|CX|KG|PCT|PC|PT|FD|FDO|DZ|GF|GFA|GAR|LT|SC|BD|BJ|LATA)\\b')) || [])[1];
      const vq = qSolta && !/,\d{2,4}$/.test(qSolta) ? [num(qSolta), ...vs] : vs;
      if (vq.length >= 3) {
        const [q, u, t] = vq.slice(-3);
        if (ok(q, u, t)) { qtd = q; unit = u; total = t; }
        // nota grande (DANFE): depois do total vêm colunas de imposto; procura o trio quantidade × preço = total
        for (let k = 2; k < vq.length && !qtd; k++) for (let i = 0; i < k - 1 && !qtd; i++) for (let j = i + 1; j < k && !qtd; j++) if (ok(vq[i], vq[j], vq[k])) { qtd = vq[i]; unit = vq[j]; total = vq[k]; }
      }
      if (!qtd && vs.length >= 2) {
        const [a, b] = vs.slice(-2);
        const mq = L.match(/(\d+(?:[.,]\d+)?)\s*(UN|UND|UNID|CX|KG|PCT|PC|PT|FD|FDO|DZ|GF|GFA|GAR|LT|SC|BD|BJ|LATA)\b/);
        const q = mq ? num(mq[1]) : 0;
        if (q && ok(q, a, b)) { qtd = q; unit = a; total = b; }
        else if (b > a && Math.abs(b / a - Math.round(b / a)) < 0.01) { qtd = Math.round(b / a); unit = a; total = b; }
        else if (a < b && a < 100 && (a % 1)) { qtd = a; total = b; unit = b / a; }
        else { qtd = 1; unit = b; total = b; }
      }
      if (!qtd && vs.length === 1) { qtd = 1; unit = vs[0]; total = vs[0]; }
      if (!total) return;
      const um = (L.match(UNID) || [])[1] || 'UN';
      // comprado por kg: o preço é por kg (1000 g), não importa o peso da linha
      const c = um === 'KG' ? { conteudo: 1000, tipo: 'g' } : (conteudoDe(desc) || conteudoDe(descInteira.replace(/\s\d+(?:[.,]\d+)?\s*X\s.*$/, '')));
      itens.push({ produto: desc, qtd, un: um === 'UND' || um === 'UNID' ? 'UN' : um === 'GFA' || um === 'GAR' ? 'GF' : um === 'FDO' ? 'FD' : um, preco: Math.round(unit * 100) / 100, total, conteudo: c ? c.conteudo : 0, tipo: c ? c.tipo : 'un' });
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
    if (score >= 0.5) return best;
    // marca/nome marcante (6+ letras) que aparece em um único item: liga (ex.: HEINEKEN → Heineken long neck)
    const fortes = td.filter((t) => t.length >= 6 && !/^(cerveja|bebida|garrafa|refrigerante|tahiti)$/.test(t));
    for (const f of fortes) { const achou = opcoes.filter(([, nome]) => tokens(nome).includes(f)); if (achou.length === 1) return achou[0][0]; }
    return '';
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
      <button class="ft-foto-btn" id="pcScan" style="margin:0!important;background:#ec4899;border:0;font-size:16px">📷 Escanear nota</button><input type="file" id="pcCam" accept="image/*" capture="environment" hidden>
      <label class="ft-foto-btn" style="margin:0!important;background:#9d174d">🖼️ Galeria<input type="file" id="pcArq" accept="image/*" multiple hidden></label>
    </div>
    <button class="sec" id="pcManual">✍️ Adicionar produto sem foto</button>
    <div id="pcResultado"></div>
    <div id="pcLeitura"></div>
    <div id="pcAcoes" hidden>
      <label>Fornecedor / número da nota<input id="pcNF" placeholder="ex.: Zumbi Atacado NF 1234"></label>
      <button id="pcAplicar" style="background:#15803d">✅ Aplicar na ficha técnica e no estoque</button>
      <p id="pcMsg"></p>
    </div>
    <div id="pcNotas" hidden></div>
    <h1 style="margin-top:26px">📋 Produtos</h1>
    <input id="pcBusca" placeholder="Buscar produto…" style="margin-top:4px">
    <div class="ft-card" id="pcDoses"></div>
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

  // lê uma foto: leitor do Android (rápido, com posição) ou o do navegador
  async function textoDaFoto(arq, aoProgredir) {
    const nat = leitorNativo();
    if (nat) { aoProgredir('Lendo a nota…'); const r = await nat.ler({ imagem: await paraBase64(arq, 2400) }); return linhasParaTexto(r.linhas) || r.texto || ''; }
    const r = await window.__barOCR(arq, (m) => { if (m.status === 'recognizing text') aoProgredir('Lendo… ' + Math.round(m.progress * 100) + '%'); }, 2400);
    return r.texto;
  }
  function mostrarLendo(t) { $('#pcResultado', painel).innerHTML = `<div class="ft-card" style="border:2px solid #ec4899"><b>📷 ${esc(t)}</b></div>`; }
  async function processarTextos(textos) {
    await carregarFontes();
    const itens = [];
    textos.forEach((t) => itens.push(...lerNota(t)));
    window.__barNotaTexto = textos.join('\n----\n');
    if (!itens.length) {
      $('#pcResultado', painel).innerHTML = `<div class="ft-card" style="border:2px solid #b45309"><b>❌ Não achei produtos com preço nesta nota.</b><p style="margin:6px 0 0">Tente de novo com a nota inteira, reta e com luz, ou adicione sem foto.</p><details><summary>Ver o texto que o app leu</summary><pre style="white-space:pre-wrap;font-size:12px">${esc(window.__barNotaTexto)}</pre></details></div>`;
      return;
    }
    itens.forEach(sugerir);
    await distribuir(itens);
  }
  // 📷 Escanear nota: scanner do Google (bordas, recorte, nitidez) quando existe; senão a câmera
  $('#pcScan', painel).onclick = async () => {
    const nat = leitorNativo();
    if (!nat || typeof nat.digitalizar !== 'function') { $('#pcCam', painel).click(); return; }
    let r;
    try { r = await nat.digitalizar({ paginas: 6 }); }
    catch (e) { const c = (e && (e.code || '')) + (e && e.message || ''); if (/CANCEL/i.test(c)) return; if (/INDISPON/i.test(c)) { $('#pcCam', painel).click(); return; } alert('Não consegui escanear: ' + (e.message || e)); return; }
    const pags = (r && r.paginas) || []; if (!pags.length) return;
    mostrarLendo('Montando a nota…');
    await processarTextos(pags.map((p) => linhasParaTexto(p.linhas) || p.texto || ''));
  };
  async function lerFotos(e) {
    const arquivos = [...e.target.files]; e.target.value = '';
    if (!arquivos.length) return;
    const textos = [];
    for (const [k, arq] of arquivos.entries()) {
      try { textos.push(await textoDaFoto(arq, (t) => mostrarLendo((arquivos.length > 1 ? 'Foto ' + (k + 1) + ' de ' + arquivos.length + ': ' : '') + t))); }
      catch (err) { alert('Não consegui ler esta foto: ' + (err.message || err)); }
    }
    if (textos.length) await processarTextos(textos);
  }
  $('#pcCam', painel).onchange = lerFotos;
  $('#pcArq', painel).onchange = lerFotos;
  $('#pcNF', painel).oninput = (e) => (nf = e.target.value);

  /* ---------- aplicar (distribuir) ---------- */
  // Guarda os preços na tabela, atualiza o custo da Ficha técnica e soma no Estoque.
  // Produto que não existe no Estoque vira item novo no grupo "Compras (notas)".
  let ultimaNota = null;
  // Cada nota lançada fica guardada (meta.notas do Caixa, vai para a nuvem) com o que ela mudou,
  // para poder corrigir ou desfazer depois sem mexer nas outras notas.
  async function aplicarItens(itens, criarNoEstoque) {
    const m = meta(), t = Date.now(), d = hoje();
    m.custo = m.custo || {}; m.tabPrecos = m.tabPrecos || { produtos: {}, alias: {} };
    const antes = { custo: {}, prod: {}, alias: {}, price: {} };
    const guarda = (obj, k, v) => { if (!(k in obj)) obj[k] = v === undefined ? null : JSON.parse(JSON.stringify(v)); };
    const est = { mov: {}, price: {}, pg: {}, items: {} };
    let novos = 0;
    itens.forEach((it, i) => {
      if (!it.estoque && criarNoEstoque) {
        const id = 'i_nf' + t.toString(36) + i;
        est.items[id] = { n: it.produto.slice(0, 60), g: 'Compras (notas)', base: 0, min: 0, bt: 0 };
        it.estoque = id; it.somar = true; novos++;
      }
      const chave = chaveNome(it.produto);
      if (it.ficha) { guarda(antes.custo, it.ficha, m.custo[it.ficha]); const c = custoFicha(it); m.custo[it.ficha] = { p: campo(c.p, c.p < 1 ? 4 : 2), v: c.v ? String(Math.round(c.v)) : '' }; }
      if (it.estoque && it.somar) {
        const id = 'nfp' + t.toString(36) + i;
        est.mov['m' + id] = { d: it.qtd, i: it.estoque, k: 'p', t: t + i };
        est.pg['p' + id] = { i: it.estoque, nf: nf || ('Nota ' + d.split('-').reverse().join('/')), q: it.qtd, t: t + i, u: it.qtd, v: campo(it.qtd * it.preco) };
      }
      if (it.estoque) { guarda(antes.price, it.estoque, (estoque.price || {})[it.estoque]); est.price[it.estoque] = Object.assign({}, (estoque.price || {})[it.estoque] || {}, { pu: campo(it.preco).replace(/,00$/, '') }); }
      guarda(antes.prod, chave, m.tabPrecos.produtos[chave]); guarda(antes.alias, chave, m.tabPrecos.alias[chave]);
      m.tabPrecos.produtos[chave] = { nome: it.produto, un: it.un, preco: it.preco, conteudo: it.conteudo, tipo: it.tipo, ficha: it.ficha || '', estoque: it.estoque || '', rende: it.rende || 1, data: d, nf: nf || '' };
      m.tabPrecos.alias[chave] = { ficha: it.ficha || '', estoque: it.estoque || '', conteudo: it.conteudo, tipo: it.tipo, rende: it.rende || 1, mlkg: it.mlkg || 0 };
    });
    const total = Math.round(itens.reduce((s, x) => s + x.qtd * x.preco, 0) * 100) / 100;
    const reg = { id: 'n' + t.toString(36), t, nf: nf || '', total, itens: itens.map((x) => ({ ...x })),
      est: { mov: Object.keys(est.mov), pg: Object.keys(est.pg), items: Object.keys(est.items) }, antes };
    m.notas = [reg, ...(m.notas || [])].slice(0, 20);
    localStorage.setItem('caixa-bar-meta', JSON.stringify(m));
    const temEst = ['mov', 'price', 'pg', 'items'].some((k) => Object.keys(est[k]).length);
    if (temEst) await window.__barImportar({ apps: { estoque: est } });
    ['f-caixa', 'f-estoque'].forEach((id) => { const f = document.getElementById(id); if (f && f.src) f.contentWindow.location.reload(); });
    ultimaNota = reg;
    return { n: itens.length, nFicha: itens.filter((x) => x.ficha).length, nEst: Object.keys(est.mov).length, novos, total };
  }
  let corrigindo = null; // nota que está sendo corrigida (volta a lançar com os valores novos)
  async function desfazerNota(editar, reg) {
    const u = reg || ultimaNota; if (!u) return;
    const m = meta(); m.custo = m.custo || {}; m.tabPrecos = m.tabPrecos || { produtos: {}, alias: {} };
    const volta = (obj, k, v) => { if (v === null || v === undefined) delete obj[k]; else obj[k] = v; };
    Object.entries(u.antes.custo || {}).forEach(([k, v]) => volta(m.custo, k, v));
    Object.entries(u.antes.prod || {}).forEach(([k, v]) => volta(m.tabPrecos.produtos, k, v));
    Object.entries(u.antes.alias || {}).forEach(([k, v]) => volta(m.tabPrecos.alias, k, v));
    m.notas = (m.notas || []).filter((x) => x.id !== u.id);
    localStorage.setItem('caixa-bar-meta', JSON.stringify(m));
    try {
      await window.__barApagar('estoque', 'mov', u.est.mov || []);
      await window.__barApagar('estoque', 'pg', u.est.pg || []);
      await window.__barApagar('estoque', 'items', u.est.items || []);
      const precoVolta = {}, precoApaga = [];
      Object.entries(u.antes.price || {}).forEach(([id, v]) => { if (v) precoVolta[id] = v; else if (!(u.est.items || []).includes(id)) precoApaga.push(id); });
      if (Object.keys(precoVolta).length) await window.__barImportar({ apps: { estoque: { price: precoVolta } } });
      if (precoApaga.length) await window.__barApagar('estoque', 'price', precoApaga);
    } catch (e) {}
    ['f-caixa', 'f-estoque'].forEach((id) => { const f = document.getElementById(id); if (f && f.src) f.contentWindow.location.reload(); });
    if (ultimaNota && ultimaNota.id === u.id) ultimaNota = null;
    await carregarFontes();
    if (editar) {
      rascunho = u.itens.map((x) => { const y = { ...x }; if ((u.est.items || []).includes(y.estoque)) { y.estoque = ''; y.somar = false; } return y; });
      corrigindo = u; nf = u.nf || ''; $('#pcNF', painel).value = nf; desenharLeitura();
      $('#pcAcoes', painel).hidden = false; $('#pcLeitura', painel).scrollIntoView({ behavior: 'smooth' });
    }
    $('#pcResultado', painel).innerHTML = `<div class="ft-card" style="border:2px solid #b45309"><b>${editar ? '✏️ Corrigindo a nota' : '↩️ Nota desfeita'}${u.nf ? ' (' + esc(u.nf) + ')' : ''}.</b>${editar ? ' Mude a quantidade, o preço ou o total pago de cada produto abaixo e toque em <b>✅ Aplicar</b>.' : ' O que ela tinha lançado foi tirado do estoque, da ficha técnica e da tabela.'}</div>`;
    desenharTabela(); desenharNotas();
  }
  // 🧾 notas lançadas: corrigir ou desfazer qualquer uma das últimas 20
  function desenharNotas() {
    const ns = meta().notas || [], box = $('#pcNotas', painel); if (!box) return;
    box.hidden = !ns.length;
    box.innerHTML = `<h1 style="margin-top:26px">🧾 Notas lançadas</h1><p>Toque em <b>✏️ Corrigir</b> para mudar quantidade, preço ou total de uma nota já lançada.</p>` + ns.map((n) => `<div class="ft-card"><div class="ft-r"><span><b>${esc(n.nf || 'Nota')}</b><small style="display:block;color:#667085">${new Date(n.t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${n.itens.length} produto(s)</small></span><b>${brl(n.total)}</b></div>
      <details><summary style="font-size:13px">Ver produtos</summary>${n.itens.map((x) => `<div class="ft-r" style="font-size:13px"><span>${esc(x.produto)}<small style="display:block;color:#667085">${campo(x.qtd, x.qtd % 1 ? 3 : 0)} ${esc(x.un)} × ${brl(x.preco)}</small></span><b>${brl(x.qtd * x.preco)}</b></div>`).join('')}</details>
      <div class="ft-chips" style="margin-top:8px"><button data-nc="${n.id}" style="background:#ede9fe;color:#4c1d95">✏️ Corrigir</button><button data-nd="${n.id}" style="background:#fee2e2;color:#991b1b">↩️ Desfazer</button></div></div>`).join('');
    box.querySelectorAll('[data-nc]').forEach((b) => (b.onclick = () => { const n = (meta().notas || []).find((x) => x.id === b.dataset.nc); if (n) desfazerNota(true, n); }));
    box.querySelectorAll('[data-nd]').forEach((b) => (b.onclick = () => { if (!b.dataset.s) { b.dataset.s = 1; b.textContent = 'Confirmar?'; setTimeout(() => { b.dataset.s = ''; b.textContent = '↩️ Desfazer'; }, 3000); return; } const n = (meta().notas || []).find((x) => x.id === b.dataset.nd); if (n) desfazerNota(false, n); }));
  }
  async function distribuir(itens) {
    mostrarLendo('Distribuindo: preços, ficha técnica e estoque…');
    try {
      const r = await aplicarItens(itens, true);
      await carregarFontes(); desenharTabela(); desenharNotas();
      $('#pcResultado', painel).innerHTML = `<div class="ft-card" style="border:2px solid #15803d">
        <b>✅ Nota lançada: ${r.n} produto(s) · ${brl(r.total)}</b>
        <p style="margin:6px 0 8px;font-size:13px">${r.nEst} compra(s) somada(s) no Estoque${r.novos ? ' (' + r.novos + ' item(ns) novo(s) no grupo “Compras (notas)”)' : ''} · ${r.nFicha} custo(s) da Ficha técnica atualizado(s) · preços guardados na tabela abaixo.</p>
        ${ultimaNota.itens.map((x) => `<div class="ft-r"><span>${esc(x.produto)}<small style="display:block;color:#667085">${campo(x.qtd, x.qtd % 1 ? 3 : 0)} ${esc(x.un)} × ${brl(x.preco)}${x.ficha ? ' · 🍸 ' + esc(x.ficha) : ''}${x.estoque ? ' · 📦 ' + esc(((estoque.items || {})[x.estoque] || {}).n || 'estoque') : ''}${doses(x) && x.un !== 'KG' ? '<br>' + doseTxt(x) : ''}</small></span><b>${brl(x.qtd * x.preco)}</b></div>`).join('')}
        <div class="ft-chips" style="margin-top:10px"><button id="pcCorrigir" style="background:#e5e7eb;color:#111">✏️ Corrigir</button><button id="pcDesfazer" style="background:#fee2e2;color:#991b1b">↩️ Desfazer nota</button></div>
        <details style="margin-top:8px"><summary style="font-size:13px">Ver o texto que o app leu</summary><pre style="white-space:pre-wrap;font-size:12px">${esc(window.__barNotaTexto || '')}</pre></details></div>`;
      $('#pcDesfazer', painel).onclick = () => desfazerNota(false);
      $('#pcCorrigir', painel).onclick = () => desfazerNota(true);
    } catch (err) { $('#pcResultado', painel).innerHTML = `<div class="ft-card"><b>Não consegui lançar: ${esc(err.message || err)}</b></div>`; }
  }
  window.__barNotaDistribuir = processarTextos; // usado nos testes

  // botão Aplicar (produtos adicionados à mão ou corrigidos)
  let armado = false;
  $('#pcAplicar', painel).onclick = async () => {
    const msg = $('#pcMsg', painel);
    const itens = rascunho.filter((x) => !x.lendo && x.produto && x.preco > 0);
    if (!itens.length) { msg.textContent = 'Nenhum produto com preço para aplicar.'; return; }
    if (!armado) { armado = true; setTimeout(() => (armado = false), 8000); msg.textContent = `Vou guardar ${itens.length} preço(s) e lançar na ficha técnica e no estoque. Toque em Aplicar de novo para confirmar.`; return; }
    armado = false; msg.textContent = 'Aplicando…';
    try {
      const r = await aplicarItens(itens, !!corrigindo); corrigindo = null;
      rascunho = []; nf = ''; $('#pcNF', painel).value = '';
      await carregarFontes(); desenharLeitura(); desenharTabela(); desenharNotas();
      msg.textContent = `✅ Pronto: ${r.n} preço(s) guardado(s), ${r.nFicha} ingrediente(s) da ficha técnica e ${r.nEst} compra(s) no estoque.`;
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
    {const gs = Object.values(tabela().produtos || {}).filter((p) => doses(p) && p.un !== 'KG' && (!busca || chaveNome(p.nome).includes(busca))).sort((a, b) => a.nome.localeCompare(b.nome));
     $('#pcDoses', painel).hidden = !gs.length;
     $('#pcDoses', painel).innerHTML = `<div class="ft-r" style="align-items:center"><b>🥃 Custo das doses</b><label style="display:flex;align-items:center;gap:6px;margin:0;font-size:13px">dose de<input id="pcDoseMl" inputmode="numeric" value="${doseMl()}" style="width:56px;text-align:center;padding:6px">ml</label></div>
       <div class="ft-r" style="font-size:12px;color:#667085;border-bottom:1px solid #e5e7eb;padding-bottom:4px"><span style="flex:2">Garrafa</span><span style="flex:1;text-align:right">Preço</span><span style="flex:1;text-align:right">Doses</span><span style="flex:1;text-align:right">Custo/dose</span></div>
       ${gs.map((p) => { const d = doses(p); return `<div class="ft-r" style="font-size:14px"><span style="flex:2">${esc(p.nome)}<small style="display:block;color:#667085">${campo(p.conteudo, 0)} ml</small></span><span style="flex:1;text-align:right">${brl(p.preco)}</span><span style="flex:1;text-align:right">${String(d.n).replace('.', ',')}</span><b style="flex:1;text-align:right">${brl(d.custo)}</b></div>`; }).join('')}`;
     const di = $('#pcDoseMl', painel); if (di) di.onchange = () => { const v = Math.round(num(di.value)); if (v > 0 && v <= 500) { const m = meta(); m.doseMl = v; localStorage.setItem('caixa-bar-meta', JSON.stringify(m)); const f = document.getElementById('f-caixa'); if (f && f.src) f.contentWindow.location.reload(); desenharTabela(); } };}
    $('#pcResumo', painel).innerHTML = `<div class="ft-r"><span>Produtos na tabela</span><b>${ps.length}</b></div><div class="ft-r ft-big"><span>Valor em estoque</span><b>${brl(valorTotal)}</b></div>`;
  }
  $('#pcBusca', painel).oninput = desenharTabela;

  // Aberto pela Ficha técnica (botão 📷 Foto da nota) ou ao abrir a aba
  window.__barPrecosAtualizar = async () => { await carregarFontes(); desenharLeitura(); desenharTabela(); desenharNotas(); };
  window.__barAbrirNota = () => {
    const b = document.querySelector('nav [data-tab=precos]'); if (b) b.click();
    $('#pcScan', painel).click();
  };
  window.__barNotaLer = lerNota; // usado nos testes
  desenharTabela(); desenharNotas();
})();
