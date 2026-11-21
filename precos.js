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
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.split('.').join(''); // "1.000" (ml) é mil, não 1
    const n = Number(s);
    return isNaN(n) ? 0 : n;
  };
  const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const brlFino = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: Math.abs(n) < 0.1 && n ? 4 : 2, maximumFractionDigits: Math.abs(n) < 0.1 && n ? 4 : 2 });
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
  const NAO_DOSE = /cerveja|chopp|refri|refrigerante|agua|água|suco|energ|tonica|tônica|lata|long\s*neck|\bln\b|soda|xarope|leite|vinho|espumante|prosecco|champagne|cidra/i;
  const doses = (p) => p.tipo === 'ml' && p.conteudo >= 375 && !(p.pack > 1) && !['LATA', 'LN', 'PCT', 'CX', 'FD'].includes(p.un) && !NAO_DOSE.test(p.nome || p.produto || '') ? { n: Math.floor(p.conteudo / doseMl() * 10) / 10, custo: p.preco * doseMl() / p.conteudo } : null;
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
      // tira os rótulos das colunas quando vêm na mesma linha ("QTD 5 VL UNIT 10,00 VL TOTAL 50,00")
      let L = semAcento(linha).toUpperCase().replace(/\b(QTDE?\.?|QUANT\.?|QUANTIDADE|V(?:A)?L(?:OR)?\.?\s*UNIT(?:ARIO)?\.?|V(?:A)?L(?:OR)?\.?\s*TOTAL|PRECO\s*UNIT(?:ARIO)?\.?|R\$)\s*:?/g, ' ').replace(/\s=\s/g, ' ').trim();
      if (L.length < 6 || PULAR.test(L)) return;
      let vs = (L.match(VALOR) || []).map(num);
      // leitor trocou a vírgula por ponto ou o preço veio sem centavos ("5 GF 10.00 50.00", "5 UN 10 50"):
      // só aceita se achar quantidade × preço = total
      if (vs.length < 2) {
        const ns = (L.replace(/\b\d+(?:[.,]\d+)?\s*(ML|L|LT|LTS|LITRO|LITROS|G|GR|KG|CL|MM|CM)\b/g, ' ').match(/(?:^|\s)\d{1,6}(?:\.\d{2})?(?=\s|$|[A-Z])/g) || []).map((x) => Number(x.trim()));
        for (let k = ns.length - 1; k >= 2 && vs.length < 2; k--) for (let j = k - 1; j >= 1 && vs.length < 2; j--) for (let i = j - 1; i >= 0 && vs.length < 2; i--) {
          const q = ns[i], u = ns[j], t = ns[k];
          if (q > 0 && q < 1000 && u > 0 && Math.abs(q * u - t) <= Math.max(0.05, t * 0.012) && t > u) vs = [q, u, t];
        }
        if (vs.length === 3) { const [q, u, t] = vs; vs = [u, t]; L = L.replace(new RegExp('(^|\\s)' + String(q).replace('.', '\\.') + '(\\s*(UN|UND|UNID|CX|KG|PCT|PC|PT|FD|FDO|DZ|GF|GFA|GAR|LT|SC|BD|BJ|LATA)\\b)?(?=\\s|$)'), '$1' + q + ' ' + ((L.match(UNID) || [])[1] || 'UN') + ' '); }
        else if (!vs.length) return;
      }
      if (!vs.length) return;
      // descrição: começa no primeiro texto com letras, até o primeiro número longo (NCM) ou valor
      // tira o número do item e o código de barras (EAN) do começo
      let desc = L.replace(/^\s*(\d{1,4}\s+)?(\d{6,14}\s+)?(\d{4}\.\d{2}\.\d{2}\s+)?/, '').replace(/\s\d{4}\.\d{2}\.\d{2}\b/, '');
      const descInteira = desc;
      const corte = desc.search(/\s\d{6,}\s|\s\d+,\d{2,4}\b|\s\d+(?:[.,]\d+)?\s+(UN|UND|UNID|CX|KG|PCT|PC|PT|FD|FDO|DZ|GF|GFA|GAR|LT|SC|BD|BJ|LATA)\b|\s(UN|UND|UNID|CX|KG|PCT|PC|PT|FD|FDO|DZ|GF|GFA|GAR|LT|SC|BD|BJ|LATA)\s+\d|\s(UN|UND|UNID|CX|KG|PCT|PC|PT|FD|FDO|DZ|GF|GFA|GAR|LT|SC|BD|BJ|LATA)\s*$/);
      if (corte > 2) desc = desc.slice(0, corte);
      desc = desc.replace(/\s+/g, ' ').trim().replace(/\s+\d{1,4}\s*(UN|UND|X)?\b.*$/, (m) => /\d\s*(ML|L|G|KG)\b/.test(m) ? m : '').replace(/\s+(X|R\$?)$/, '').trim();
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
  let corrigindo = null; // nota que está sendo corrigida: só muda de verdade quando tocar em Aplicar
  const meta = () => lerJSON('caixa-bar-meta');
  // grava e recarrega o Caixa, que manda a mudança para a nuvem
  // o Caixa (ficha técnica) relê os preços e recalcula as receitas na hora, sem sair da tela; manda para a nuvem
  const avisarCaixa = () => { const f = document.getElementById('f-caixa'); if (!f || !f.src) return; try { if (f.contentWindow.__cxMetaAtualizada) { f.contentWindow.__cxMetaAtualizada(); return; } } catch (e) {} f.contentWindow.location.reload(); };
  const salvarMeta = (m) => { localStorage.setItem('caixa-bar-meta', JSON.stringify(m)); avisarCaixa(); };
  const tabela = () => meta().tabPrecos || { produtos: {}, alias: {} };
  // palavras que não identificam o produto (o tipo da bebida); o que sobra é a marca/nome
  const GENERICO = /^(whisky|whiskey|uisque|vodka|gin|rum|licor|cachaca|aguardente|tequila|conhaque|cerveja|chopp|vinho|tinto|branco|rose|seco|suave|demi|sec|brut|refrigerante|refri|agua|mineral|tonica|lata|long|neck|garrafa|pet|vidro|espumante|aperitivo|bebida|dose|com|sem|gas|original|tradicional|zero|pack|caixa|fardo|unid|und)$/;
  const marca = (s) => tokens(s).filter((t) => !GENERICO.test(t) && !/^\d/.test(t));
  const parecido = (a, b) => a === b || (a.length > 4 && b.length > 4 && (a.startsWith(b.slice(0, 5)) || b.startsWith(a.slice(0, 5))));
  // produto da tabela que é o mesmo da linha da nota (mesma marca e mesmo tamanho); '' se é novo
  function produtoDaTabela(nome) {
    const tp = tabela(), k = chaveNome(nome), ps = tp.produtos || {};
    if (ps[k]) return k;
    const a = (tp.alias || {})[k]; if (a && a.prod && ps[a.prod]) return a.prod;
    const tn = tokens(nome), mn = marca(nome), cn = conteudoDe(nome);
    let best = '', score = 0;
    Object.entries(ps).forEach(([kk, p]) => {
      const tp2 = tokens(p.nome), mp = marca(p.nome);
      const ok = mp.length ? mp.every((t) => tn.some((d) => parecido(d, t))) && mn.some((t) => mp.some((d) => parecido(d, t)))
        : tp2.length && tp2.every((t) => tn.some((d) => parecido(d, t))) && tn.every((t) => tp2.some((d) => parecido(d, t)));
      if (!ok) return;
      // tamanho diferente (750 ml × 1 litro) é outro produto
      const ml = p.pack > 1 ? p.mlUn : p.conteudo;
      if (cn && ml && p.un !== 'KG' && Math.abs((cn.conteudo / (p.pack > 1 && cn.conteudo > ml * 1.5 ? p.pack : 1)) - ml) > ml * 0.06) return;
      const sc = mp.length * 2 + tp2.filter((t) => tn.some((d) => parecido(d, t))).length;
      if (sc > score) { score = sc; best = kk; }
    });
    return best;
  }
  window.__barNotaProduto = produtoDaTabela; // usado nos testes
  // ingrediente da ficha técnica: "vodka" serve para qualquer vodka; "licor 43" só para Licor 43
  function fichaPara(nome) {
    const nw = chaveNome(nome).split(' '), tn = tokens(nome);
    let best = '', tam = 0;
    Object.keys(ingredientes).forEach((k) => {
      if (/\(dose\)|^completar|^finalizar|^tintura|^redu[cç]|^suco|^xarope|^syrup|^espuma/.test(k)) return;
      const w = chaveNome(k).split(' ').filter((x) => x.length >= 2 && !GENERICO.test(x) && !/^(de|da|do|com|ou|e)$/.test(x));
      const g = tokens(k);
      const ok = w.length ? w.every((x) => nw.some((d) => d === x || parecido(d, x))) && g.every((x) => tn.some((d) => parecido(d, x))) : g.length && g.every((x) => tn.some((d) => parecido(d, x)));
      if (ok && k.length > tam) { tam = k.length; best = k; }
    });
    return best;
  }
  function sugerir(it) {
    const tp = tabela();
    it.tab = produtoDaTabela(it.produto);
    if (it.tab) { // já existe: usa o que está cadastrado (embalagem, ml, ficha, estoque) e só atualiza preço e quantidade
      const p = tp.produtos[it.tab], al = (tp.alias || {})[it.tab] || {};
      it.ficha = p.ficha || ''; it.estoque = p.estoque || melhor(p.nome, Object.entries(estoque.items || {}).map(([id, v]) => [id, v.n]), false);
      it.conteudo = p.conteudo; it.tipo = p.tipo; it.rende = p.rende || 1; it.mlkg = p.mlkg || al.mlkg || mlkgPadrao(p.ficha || p.nome);
      it.somar = !!it.estoque; it.novo = false;
      return;
    }
    it.novo = true;
    const alias = tp.alias[chaveNome(it.produto)];
    const opF = Object.keys(ingredientes).map((k) => [k, k]);
    const opE = Object.entries(estoque.items || {}).map(([id, v]) => [id, v.n]);
    it.ficha = alias ? alias.ficha : fichaPara(it.produto);
    // produto novo: só liga a um item do estoque com a mesma marca (LICOR ARAQUE não vira Licor 43)
    it.estoque = alias ? alias.estoque : (() => { const tn = tokens(it.produto), mn = marca(it.produto); const o = opE.filter(([, n]) => { const mp = marca(n); return mp.length && mp.every((t) => tn.some((d) => parecido(d, t))) && mn.some((t) => mp.some((d) => parecido(d, t))); }); return o.length === 1 ? o[0][0] : ''; })();
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
      <button class="sec" id="pcCancelar" hidden>✖ Cancelar correção (a nota fica como estava)</button>
      <p id="pcMsg"></p>
    </div>
    <div id="pcNotas" hidden></div>
    <h1 style="margin-top:26px">📋 Produtos</h1>
    <input id="pcBusca" placeholder="Buscar produto…" style="margin-top:4px">
    <div class="ft-chips" id="pcAtalhos" style="margin:8px 0 4px">${[['pcDoses', '🥃 Doses'], ['pcUnid', '🍺 Unidades'], ['pcIns', '🍋 Insumos'], ['pcTabela', '📋 Todos']].map(([id, t]) => `<button type="button" data-ir="${id}" style="background:#f5f3ff!important;color:#5b21b6!important;box-shadow:none!important;padding:8px 12px!important;font-size:13px!important;margin:0!important">${t}</button>`).join('')}</div>
    <div class="ft-card" id="pcRep" hidden style="border:2px solid #f59e0b"></div>
    <div class="ft-card" id="pcDoses"></div>
    <div class="ft-card" id="pcUnid"></div>
    <div class="ft-card" id="pcIns"></div>
    <div class="ft-card ft-tot" id="pcResumo"></div>
    <div id="pcTabela"></div>
    <div class="ft-card" id="pcRel" style="margin-top:22px"></div>`;

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
          <label>Conteúdo por ${esc(it.un)}<input inputmode="decimal" data-k="conteudo" value="${it.conteudo ? String(Math.round(it.conteudo)) : ''}" placeholder="ex.: 750"></label>
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
    $('#pcCancelar', painel).hidden = !corrigindo;
    guardarRascunho();
  }
  // a nota aberta (lida ou em correção) fica guardada no celular: se o app fechar ou recarregar, volta igual
  const RK = 'bar-precos-rascunho';
  function guardarRascunho() {
    try {
      const its = rascunho.filter((x) => !x.lendo);
      if (its.length) localStorage.setItem(RK, JSON.stringify({ itens: its.map((x) => { const y = { ...x }; delete y.mini; return y; }), corrigindo: corrigindo ? corrigindo.id : '', nf }));
      else localStorage.removeItem(RK);
    } catch (e) {}
  }
  // Como o ingrediente entra no custo das receitas (meta.custo do Caixa):
  // p = preço por unidade usada na receita; v = ml dessa unidade (só para ingredientes em ml).
  // ingrediente da receita contado em gotas/dash (bitter, tabasco) comprado em garrafa com ml
  const porGotas = (it) => ingredientes[it.ficha] === 'un' && it.tipo === 'ml' && it.conteudo > 0 && !['KG', 'DZ'].includes(it.un) && !(it.pack > 1);
  const GOTA_ML = () => num(lerJSON('caixa-bar-meta').gotaMl) || 0.05, DASH_ML = () => num(lerJSON('caixa-bar-meta').dashMl) || 0.8;
  function custoFicha(it) {
    if (porGotas(it)) return { p: it.preco, v: it.conteudo, g: 1, m: it.usoMed || 'gota', q: it.usoQtd || 3 };
    const u = ingredientes[it.ficha], r = it.rende || 1;
    if (it.un === 'KG' || it.un === 'DZ') return u === 'ml' ? { p: it.preco / r, v: (it.un === 'KG' ? it.mlkg || 1000 : it.conteudo || 0) / r } : { p: it.preco / r };
    if (u === 'ml') return { p: it.preco, v: it.conteudo || 0 };
    return { p: it.preco / r };
  }
  const custoGravar = (c) => Object.assign({ p: campo(c.p, c.p < 1 ? 4 : 2), v: c.v ? String(Math.round(c.v)) : '' }, c.g ? { g: '1', m: c.m, q: String(c.q) } : {});
  function custoReceita(it) {
    if (porGotas(it)) { const pm = it.preco / it.conteudo; return brlFino(pm * GOTA_ML()) + ' por gota · ' + brlFino(pm * DASH_ML()) + ' por dash'; }
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
      atualizarRodape(box, it); guardarRascunho(); return;
    }
    it[k] = e.target.type === 'checkbox' ? e.target.checked : ['qtd', 'preco', 'conteudo', 'rende', 'mlkg'].includes(k) ? num(e.target.value) : e.target.value;
    if (k === 'preco' || k === 'qtd') { const tp = box.querySelector('[data-k="totalPago"]'); if (tp && document.activeElement !== tp) tp.value = campo(it.qtd * it.preco); }
    if (['ficha', 'estoque', 'un', 'somar'].includes(k)) setTimeout(desenharLeitura, 0); else { atualizarRodape(box, it); guardarRascunho(); }
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
  $('#pcNF', painel).oninput = (e) => { nf = e.target.value; guardarRascunho(); };

  /* ---------- aplicar (distribuir) ---------- */
  // Guarda os preços na tabela, atualiza o custo da Ficha técnica e soma no Estoque.
  // Produto que não existe no Estoque vira item novo no grupo "Compras (notas)".
  let ultimaNota = null;
  // Cada nota lançada fica guardada (meta.notas do Caixa, vai para a nuvem) com o que ela mudou,
  // para poder corrigir ou desfazer depois sem mexer nas outras notas.
  // grupo do estoque para um produto novo, igual aos que já existem (licor junto com os licores...)
  const GRUPOS = [[/licor|aperitivo|campari|aperol|vermute|jager|amaretto|cointreau|arak|araque|fernet|bitter|cynar|martini/, 'licor', 'Licores e aperitivos'],
    [/whisk|uisque|vodka|\bgin\b|\brum\b|cacha|tequila|conhaque|aguardente|bourbon|destil/, 'destil', 'Destilados'],
    [/vinho|espumante|prosecco|champagne|cidra/, 'vinho', 'Vinhos e espumantes'],
    [/cerveja|chopp|heineken|brahma|skol|stella|budweiser|corona|amstel|original|spaten|eisenbahn/, 'cerveja', 'Cervejas'],
    [/refri|coca|guarana|agua|tonica|soda|suco|energ|red bull|monster|sprite|fanta|schweppes/, 'refri', 'Refrigerantes e mixers'],
    [/limao|laranja|abacaxi|maracuja|gengibre|hortel|manjeric|capim|morango|frutas?/, 'fruta', 'Frutas e ervas']];
  function grupoPara(nome) {
    const n = chaveNome(nome), gs = [...new Set(Object.values(estoque.items || {}).map((x) => x.g).filter(Boolean))];
    const r = GRUPOS.find(([re]) => re.test(n));
    if (!r) return gs.find((g) => /outros/i.test(g)) || 'Outros insumos';
    return gs.find((g) => chaveNome(g).includes(r[1])) || r[2];
  }
  async function aplicarItens(itens, criarNoEstoque, itensDaNota) {
    const m = meta(), t = Date.now(), d = hoje();
    m.custo = m.custo || {}; m.tabPrecos = m.tabPrecos || { produtos: {}, alias: {} };
    const antes = { custo: {}, prod: {}, alias: {}, price: {} };
    const guarda = (obj, k, v) => { if (!(k in obj)) obj[k] = v === undefined ? null : JSON.parse(JSON.stringify(v)); };
    const est = { mov: {}, price: {}, pg: {}, items: {} };
    let novos = 0;
    itens.forEach((it, i) => {
      const base = it.tab && m.tabPrecos.produtos[it.tab] ? m.tabPrecos.produtos[it.tab] : null;
      // pack cadastrado e nota em unidades: o preço guardado continua sendo o do pack
      if (base && base.pack > 1 && !['PCT', 'CX', 'FD'].includes(it.un)) { it.precoTab = Math.round(it.preco * base.pack * 100) / 100; }
      if (!it.estoque && criarNoEstoque) {
        const id = 'i_nf' + t.toString(36) + i;
        est.items[id] = { n: (base ? base.nome : it.produto).slice(0, 60), g: grupoPara(base ? base.nome : it.produto), base: 0, min: 0, bt: 0 };
        it.estoque = id; it.somar = true; novos++;
      }
      const chave = base ? it.tab : chaveNome(it.produto);
      const prod = base ? Object.assign({}, base, { preco: it.precoTab || it.preco, estoque: base.estoque || it.estoque || '', data: d, nf: nf || '' })
        : { nome: it.produto, un: it.un === 'UN' && it.tipo === 'ml' && it.conteudo >= 375 ? 'GF' : it.un, preco: it.preco, conteudo: it.conteudo, tipo: it.tipo, ficha: it.ficha || '', estoque: it.estoque || '', rende: it.rende || 1, data: d, nf: nf || '' };
      if (it.ficha) { guarda(antes.custo, it.ficha, m.custo[it.ficha]); const c = custoFicha(base ? Object.assign({}, prod, { mlkg: prod.mlkg || it.mlkg }) : it); m.custo[it.ficha] = custoGravar(c); }
      if (it.estoque && it.somar) {
        const id = 'nfp' + t.toString(36) + i;
        est.mov['m' + id] = { d: it.qtd, i: it.estoque, k: 'p', t: t + i };
        est.pg['p' + id] = { i: it.estoque, nf: nf || ('Nota ' + d.split('-').reverse().join('/')), q: it.qtd, t: t + i, u: it.qtd, v: campo(it.qtd * it.preco) };
      }
      if (it.estoque) { guarda(antes.price, it.estoque, (estoque.price || {})[it.estoque]); est.price[it.estoque] = Object.assign({}, (estoque.price || {})[it.estoque] || {}, { pu: campo(it.preco).replace(/,00$/, '') }); }
      guarda(antes.prod, chave, m.tabPrecos.produtos[chave]); guarda(antes.alias, chave, m.tabPrecos.alias[chave]);
      m.tabPrecos.produtos[chave] = prod;
      m.tabPrecos.alias[chave] = Object.assign({}, m.tabPrecos.alias[chave] || {}, { ficha: prod.ficha || '', estoque: prod.estoque || '', conteudo: prod.conteudo, tipo: prod.tipo, rende: prod.rende || 1, mlkg: prod.mlkg || it.mlkg || 0 });
      // o nome como vem na nota aponta para o produto: a próxima nota já acha direto
      const kn = chaveNome(it.produto);
      if (kn !== chave) { guarda(antes.alias, kn, m.tabPrecos.alias[kn]); m.tabPrecos.alias[kn] = Object.assign({}, m.tabPrecos.alias[chave], { prod: chave }); }
    });
    const total = Math.round(itens.reduce((s, x) => s + x.qtd * x.preco, 0) * 100) / 100;
    const reg = { id: 'n' + t.toString(36), t, nf: nf || '', total, itens: itens.map((x) => ({ ...x })),
      est: { mov: Object.keys(est.mov), pg: Object.keys(est.pg), items: Object.keys(est.items).concat((itensDaNota || []).filter((id) => itens.some((x) => x.estoque === id))) }, antes };
    m.notas = [reg, ...(m.notas || [])].slice(0, 20);
    localStorage.setItem('caixa-bar-meta', JSON.stringify(m));
    const temEst = ['mov', 'price', 'pg', 'items'].some((k) => Object.keys(est[k]).length);
    if (temEst) await window.__barImportar({ apps: { estoque: est } });
    avisarCaixa(); { const f = document.getElementById('f-estoque'); if (f && f.src) f.contentWindow.location.reload(); }
    ultimaNota = reg;
    return { n: itens.length, nFicha: itens.filter((x) => x.ficha).length, nEst: Object.keys(est.mov).length, novos, total };
  }
  // tira do estoque, da ficha técnica e da tabela o que a nota lançou, e tira a nota da lista
  async function reverterNota(u, manterItens) {
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
      if (!manterItens) await window.__barApagar('estoque', 'items', u.est.items || []);
      const precoVolta = {}, precoApaga = [];
      Object.entries(u.antes.price || {}).forEach(([id, v]) => { if (v) precoVolta[id] = v; else if (!(u.est.items || []).includes(id)) precoApaga.push(id); else if (!manterItens) precoApaga.push(id); });
      if (Object.keys(precoVolta).length) await window.__barImportar({ apps: { estoque: { price: precoVolta } } });
      if (precoApaga.length) await window.__barApagar('estoque', 'price', precoApaga);
    } catch (e) {}
    if (ultimaNota && ultimaNota.id === u.id) ultimaNota = null;
  }
  // quantidade, valor de cada um e total (ex.: 5 GF × R$ 10,00 = R$ 50,00)
  const linhaQVT = (x) => `Qtd <b>${campo(x.qtd, x.qtd % 1 ? 3 : 0)} ${esc(x.un)}</b> · Valor un. <b>${brl(x.preco)}</b> · Total <b>${brl(x.qtd * x.preco)}</b>${x.total && Math.abs(x.total - x.qtd * x.preco) > 0.05 ? ' ⚠️ na nota ' + brl(x.total) : ''}`;
  const nomeNota = (n) => n.nf || 'Nota de ' + new Date(n.t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  // ✏️ Corrigir: abre os produtos da nota no topo para mudar. Nada muda até tocar em ✅ Aplicar.
  async function abrirCorrecao(u) {
    await carregarFontes();
    rascunho = u.itens.map((x) => ({ ...x }));
    corrigindo = u; nf = u.nf || ''; $('#pcNF', painel).value = nf; $('#pcMsg', painel).textContent = '';
    desenharLeitura();
    $('#pcResultado', painel).innerHTML = `<div class="ft-card" style="border:2px solid #7c3aed"><b>✏️ Corrigindo: ${esc(nomeNota(u))}</b><br>Mude a quantidade, o preço ou o total pago de cada produto abaixo e toque em <b>✅ Aplicar</b>. Até lá, a nota continua lançada como estava.</div>`;
    painel.scrollIntoView({ block: 'start' }); $('#pcResultado', painel).scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  async function desfazerNota(editar, reg) {
    const u = reg || ultimaNota; if (!u) return;
    if (editar) return abrirCorrecao(u);
    await reverterNota(u);
    avisarCaixa(); { const f = document.getElementById('f-estoque'); if (f && f.src) f.contentWindow.location.reload(); }
    await carregarFontes();
    $('#pcResultado', painel).innerHTML = `<div class="ft-card" style="border:2px solid #b45309"><b>↩️ Nota desfeita: ${esc(nomeNota(u))}.</b> O que ela tinha lançado foi tirado do estoque, da ficha técnica e da tabela.</div>`;
    desenharTabela(); desenharNotas();
  }
  // 🧾 notas lançadas: corrigir ou desfazer qualquer uma das últimas 20
  function desenharNotas() {
    const ns = meta().notas || [], box = $('#pcNotas', painel); if (!box) return;
    box.hidden = !ns.length;
    box.innerHTML = `<h1 style="margin-top:26px">🧾 Notas lançadas</h1><p>Toque em <b>✏️ Corrigir</b> para mudar quantidade, preço ou total de uma nota já lançada.</p>` + ns.map((n) => `<div class="ft-card"><div class="ft-r"><span><b>${esc(nomeNota(n))}</b><small style="display:block;color:#667085">${new Date(n.t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${n.itens.length} produto(s)</small></span><b>${brl(n.total)}</b></div>
      <details><summary style="font-size:13px">Ver produtos</summary>${n.itens.map((x) => `<div class="ft-r" style="font-size:13px"><span>${esc(x.produto)}<small style="display:block;color:#667085">${linhaQVT(x)}</small></span><b>${brl(x.qtd * x.preco)}</b></div>`).join('')}</details>
      <div class="ft-chips" style="margin-top:8px"><button data-nc="${n.id}" style="background:#ede9fe!important;color:#4c1d95!important;box-shadow:none!important">✏️ Corrigir</button><button data-nd="${n.id}" style="background:#fee2e2!important;color:#991b1b!important;box-shadow:none!important">↩️ Desfazer</button><button data-nx="${n.id}" style="background:#f3f4f6!important;color:#374151!important;box-shadow:none!important">🗑️ Excluir</button></div></div>`).join('') + `<p style="font-size:12.5px;color:#667085">↩️ Desfazer tira a nota do estoque e da tabela. 🗑️ Excluir só tira a nota desta lista (o que ela lançou continua).</p>`;
    box.querySelectorAll('[data-nc]').forEach((b) => (b.onclick = () => { const n = (meta().notas || []).find((x) => x.id === b.dataset.nc); if (n) desfazerNota(true, n); }));
    box.querySelectorAll('[data-nx]').forEach((b) => (b.onclick = () => { if (!b.dataset.s) { b.dataset.s = 1; b.textContent = 'Confirmar?'; setTimeout(() => { b.dataset.s = ''; b.textContent = '🗑️ Excluir'; }, 3000); return; } const m = meta(); m.notas = (m.notas || []).filter((x) => x.id !== b.dataset.nx); salvarMeta(m); if (corrigindo && corrigindo.id === b.dataset.nx) corrigindo = null; desenharNotas(); }));
    box.querySelectorAll('[data-nd]').forEach((b) => (b.onclick = () => { if (!b.dataset.s) { b.dataset.s = 1; b.textContent = 'Confirmar?'; setTimeout(() => { b.dataset.s = ''; b.textContent = '↩️ Desfazer'; }, 3000); return; } const n = (meta().notas || []).find((x) => x.id === b.dataset.nd); if (n) desfazerNota(false, n); }));
  }
  // Foto da nota: o que já está na tabela só atualiza o preço e soma a quantidade no estoque
  // (sem mexer no nome, embalagem, ml, ficha técnica). O que é novo abre embaixo para conferir e adicionar.
  async function distribuir(itens) {
    mostrarLendo('Atualizando preços e estoque…');
    try {
      const velhos = itens.filter((x) => x.tab), novos = itens.filter((x) => !x.tab);
      const tp0 = tabela().produtos || {};
      const antesQ = {}, antesP = {};
      velhos.forEach((x) => { antesP[x.tab] = (tp0[x.tab] || {}).preco; if (x.estoque && !(x.estoque in antesQ)) antesQ[x.estoque] = qtdEstoque(x.estoque); });
      let html = '';
      if (velhos.length) {
        const r = await aplicarItens(velhos, false);
        await carregarFontes();
        const tp = tabela().produtos || {};
        const vistos = {};
        html += `<div class="ft-card" style="border:2px solid #15803d">
          <b>✅ ${velhos.length} produto(s) atualizado(s) · ${brl(r.total)}</b>
          <p style="margin:6px 0 8px;font-size:13px">Preço novo na tabela, no 📦 Estoque e na 🍸 Ficha técnica. O cadastro de cada um (nome, garrafa, ml) não mudou.</p>
          ${velhos.map((x) => { const p = tp[x.tab] || {}, q0 = antesQ[x.estoque], primeiro = x.estoque && !vistos[x.estoque]; if (x.estoque) vistos[x.estoque] = 1; const q1 = x.estoque ? qtdEstoque(x.estoque) : null; const pa = antesP[x.tab];
            return `<div class="ft-r"><span><b style="font-weight:700">${esc(p.nome || x.produto)}</b><small style="display:block;color:#667085">${linhaQVT(x)}<br>💲 Preço: ${pa && Math.abs(pa - p.preco) > 0.004 ? brl(pa) + ' → <b>' + brl(p.preco) + '</b>' : '<b>' + brl(p.preco) + '</b> (igual)'}${x.estoque ? '<br>📦 Estoque: ' + (primeiro && q0 !== null && q1 !== null ? campo(q0, q0 % 1 ? 2 : 0) + ' + ' + campo(x.qtd, x.qtd % 1 ? 3 : 0) + ' = <b>' + campo(q1, q1 % 1 ? 2 : 0) + '</b>' : '+ ' + campo(x.qtd, x.qtd % 1 ? 3 : 0)) : '<br>📦 Sem item no estoque: abra ✏️ Editar para ligar'}${doses(p) ? '<br>' + doseTxt(p) : ''}</small></span><b>${brl(x.qtd * x.preco)}</b></div>`; }).join('')}
          <div class="ft-chips" style="margin-top:10px"><button id="pcCorrigir" style="background:#ede9fe!important;color:#4c1d95!important;box-shadow:none!important">✏️ Corrigir</button><button id="pcDesfazer" style="background:#fee2e2!important;color:#991b1b!important;box-shadow:none!important">↩️ Desfazer</button></div></div>`;
      }
      if (novos.length) {
        rascunho = novos; corrigindo = null; desenharLeitura();
        html += `<div class="ft-card" style="border:2px solid #7c3aed"><b>🆕 ${novos.length} produto(s) novo(s) nesta nota</b><p style="margin:6px 0 0;font-size:13px">Ainda não estão na tabela. Confira abaixo (nome, quantidade, preço, ml), tire com ✕ o que não for bebida/insumo e toque em <b>✅ Aplicar</b> para adicionar. Cada um entra no estoque no grupo certo (licor com os licores…).</p></div>`;
      }
      html += `<details style="margin-top:8px"><summary style="font-size:13px">Ver o texto que o app leu</summary><pre style="white-space:pre-wrap;font-size:12px">${esc(window.__barNotaTexto || '')}</pre></details>`;
      $('#pcResultado', painel).innerHTML = html;
      desenharTabela(); desenharNotas();
      if (velhos.length) { const vn = ultimaNota; $('#pcDesfazer', painel).onclick = () => desfazerNota(false, vn); $('#pcCorrigir', painel).onclick = () => desfazerNota(true, vn); }
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
      const corr = corrigindo && (meta().notas || []).find((x) => x.id === corrigindo.id);
      if (corr) await reverterNota(corr, true);
      const r = await aplicarItens(itens, true, corr ? corr.est.items || [] : []); corrigindo = null;
      rascunho = []; nf = ''; $('#pcNF', painel).value = ''; $('#pcResultado', painel).innerHTML = '';
      await carregarFontes(); desenharLeitura(); desenharTabela(); desenharNotas();
      msg.textContent = `✅ Pronto: ${r.n} preço(s) guardado(s), ${r.nFicha} ingrediente(s) da ficha técnica e ${r.nEst} compra(s) no estoque.`;
      $('#pcAcoes', painel).hidden = false;
    } catch (err) { msg.textContent = 'Não consegui aplicar: ' + (err.message || err); }
  };

  $('#pcCancelar', painel).onclick = () => { corrigindo = null; rascunho = []; nf = ''; $('#pcNF', painel).value = ''; $('#pcMsg', painel).textContent = ''; $('#pcResultado', painel).innerHTML = ''; desenharLeitura(); };

  /* ---------- tabela de produtos ---------- */
  function qtdEstoque(id) {
    const it = (estoque.items || {})[id]; if (!it) return null;
    let q = num(it.base);
    Object.values(estoque.mov || {}).forEach((m) => { if (m.i === id && (m.t || 0) > (it.bt || 0)) q += Number(m.d) || 0; });
    return q;
  }
  function desenharTabela() {
    const busca = chaveNome($('#pcBusca', painel).value);
    const ps = Object.entries(tabela().produtos || {}).map(([k, p]) => Object.assign({}, p, { _k: k })).filter((p) => !busca || chaveNome(p.nome).includes(busca)).sort((a, b) => a.nome.localeCompare(b.nome));
    let valorTotal = 0;
    const linhas = ps.map((p) => {
      const q = p.estoque ? qtdEstoque(p.estoque) : null;
      const valor = q !== null ? q * p.preco : null;
      if (valor) valorTotal += valor;
      const porMedida = [p.pack > 1 ? brl(p.preco / p.pack) + ' cada unidade' : '', p.conteudo ? (p.tipo === 'g' ? brl(p.preco / p.conteudo * 1000) + '/kg' : p.tipo === 'ml' ? brl(p.preco / p.conteudo * 1000) + '/litro' + (doses(p) ? ' · <span style="font-weight:700">dose ' + doseMl() + ' ml ' + brl(doses(p).custo) + '</span>' : '') : brl(p.preco / p.conteudo) + '/un') : ''].filter(Boolean).join(' · ');
      return `<div class="hs"><div><b>${esc(p.nome)}</b><small><span style="color:#5b21b6;font-weight:700">${brl(p.preco)}</span> · ${nomeEmb(p.un)}${p.pack > 1 ? ' com ' + p.pack + ' × ' + inteiro(p.mlUn) + ' ml' : p.conteudo && p.un !== 'KG' ? ' de ' + inteiro(p.conteudo) + ' ' + (p.tipo === 'un' ? 'un' : p.tipo) : ''}${porMedida ? ' · ' + porMedida : ''} · ${esc(p.data.split('-').reverse().join('/'))}${p.nf ? ' · ' + esc(p.nf) : ''}${p.ficha ? '<br>🍸 ' + esc(p.ficha) : ''}${q !== null ? '<br>📦 Estoque: ' + campo(q, q % 1 ? 2 : 0) + ' · valor ' + brl(valor) : ''}</small></div><div style="display:flex;flex-direction:column;gap:6px"><button data-pe="${esc(p._k)}" style="background:#7c3aed!important;color:#fff!important;box-shadow:none!important;padding:9px 14px!important;font-size:14px!important">✏️ Editar</button><button data-px="${esc(p._k)}" style="background:#fff1f0!important;color:#b42318!important;box-shadow:none!important;padding:7px 14px!important;font-size:13px!important">🗑️ Excluir</button></div></div>`;
    }).join('');
    $('#pcTabela', painel).innerHTML = linhas || '<p>Nenhum produto ainda. Tire foto de uma nota de compra.</p>';
    {const gs = Object.values(tabela().produtos || {}).filter((p) => doses(p) && p.un !== 'KG' && (!busca || chaveNome(p.nome).includes(busca))).sort((a, b) => a.nome.localeCompare(b.nome));
     $('#pcDoses', painel).hidden = !gs.length;
     $('#pcDoses', painel).innerHTML = `<div class="ft-r" style="align-items:center"><b>🥃 Custo das doses</b><label style="display:flex;align-items:center;gap:6px;margin:0;font-size:13px">dose de<input id="pcDoseMl" inputmode="numeric" value="${doseMl()}" style="width:56px;text-align:center;padding:6px">ml</label></div>
       <div class="ft-r" style="font-size:12px;color:#667085;border-bottom:1px solid #e5e7eb;padding-bottom:4px"><span style="flex:2">Garrafa</span><span style="flex:1;text-align:right">Preço</span><span style="flex:1;text-align:right">Doses</span><span style="flex:1;text-align:right">Custo/dose</span></div>
       ${gs.map((p) => { const d = doses(p); return `<div class="ft-r" style="font-size:14px"><span style="flex:2">${esc(p.nome)}<small style="display:block;color:#667085">${campo(p.conteudo, 0)} ml</small></span><span style="flex:1;text-align:right">${brl(p.preco)}</span><span style="flex:1;text-align:right">${String(d.n).replace('.', ',')}</span><b style="flex:1;text-align:right">${brl(d.custo)}</b></div>`; }).join('')}`;
     const di = $('#pcDoseMl', painel); if (di) di.onchange = () => { const v = Math.round(num(di.value)); if (v > 0 && v <= 500) { const m = meta(); m.doseMl = v; localStorage.setItem('caixa-bar-meta', JSON.stringify(m)); avisarCaixa(); desenharTabela(); } };}
    desenharCustos(busca);
    desenharRepetidos(); desenharRelatorio(valorTotal);
    ligarEditar();
    $('#pcResumo', painel).innerHTML = `<div class="ft-r"><span>Produtos na tabela</span><b>${ps.length}</b></div><div class="ft-r ft-big"><span>Valor em estoque</span><b>${brl(valorTotal)}</b></div>`;
  }
  $('#pcBusca', painel).oninput = desenharTabela;

  /* ---------- 🧹 produtos repetidos: o mesmo produto cadastrado duas vezes (ex.: "Campari 998ml" e "CAMPARI 998 ML") ---------- */
  const nomeLimpo = (n) => chaveNome(n).replace(/(\d)\s+(ml|l|lt|g|kg)\b/g, '$1$2');
  function mesmoProduto(a, b) {
    if (nomeLimpo(a.nome) === nomeLimpo(b.nome)) return true;
    const ma = marca(a.nome), mb = marca(b.nome);
    if (!ma.length || !mb.length) return false;
    const cobre = (x, y) => x.every((t) => y.some((d) => parecido(d, t)));
    if (!(cobre(ma, mb) || cobre(mb, ma))) return false;
    const ta = tokens(a.nome).filter((t) => GENERICO.test(t)), tb = tokens(b.nome).filter((t) => GENERICO.test(t));
    if (ta.length && tb.length && !ta.some((t) => tb.includes(t))) return false; // "vodka x" e "gin x" são diferentes
    const mla = a.pack > 1 ? a.mlUn : a.conteudo, mlb = b.pack > 1 ? b.mlUn : b.conteudo;
    if (mla && mlb && a.un !== 'KG' && b.un !== 'KG' && Math.abs(mla - mlb) > Math.max(mla, mlb) * 0.06) return false;
    return true;
  }
  function gruposRepetidos() {
    const ps = Object.entries(tabela().produtos || {}), feitos = new Set(), grupos = [];
    ps.forEach(([k, p]) => {
      if (feitos.has(k)) return;
      const g = ps.filter(([k2, p2]) => k2 !== k && !feitos.has(k2) && mesmoProduto(p, p2)).map(([k2]) => k2);
      if (g.length) { g.unshift(k); g.forEach((x) => feitos.add(x)); grupos.push(g); }
    });
    return grupos;
  }
  const quando = (p) => p.editado || Date.parse(p.data || '') || 0;
  function juntarRepetidos() {
    const m = meta(), tp = m.tabPrecos, gs = gruposRepetidos(); let tirados = 0;
    gs.forEach((g) => {
      const ps = g.map((k) => [k, tp.produtos[k]]);
      // fica o mais completo (ligado à ficha/estoque, com ml); o preço é o mais recente
      ps.sort((a, b) => ((b[1].ficha ? 2 : 0) + (b[1].estoque ? 2 : 0) + (b[1].conteudo ? 1 : 0)) - ((a[1].ficha ? 2 : 0) + (a[1].estoque ? 2 : 0) + (a[1].conteudo ? 1 : 0)) || quando(b[1]) - quando(a[1]));
      const [kf, pf] = ps[0], recente = ps.slice().sort((a, b) => quando(b[1]) - quando(a[1]))[0][1];
      const fica = Object.assign({}, pf, { preco: recente.preco, data: recente.data, nf: recente.nf || pf.nf, ficha: pf.ficha || (ps.find((x) => x[1].ficha) || [, {}])[1].ficha || '', estoque: pf.estoque || (ps.find((x) => x[1].estoque) || [, {}])[1].estoque || '' });
      tp.produtos[kf] = fica;
      ps.slice(1).forEach(([k]) => { delete tp.produtos[k]; tp.alias = tp.alias || {}; tp.alias[k] = Object.assign({}, tp.alias[k] || {}, { prod: kf }); tirados++; });
    });
    salvarMeta(m);
    return tirados;
  }
  function desenharRepetidos() {
    const box = $('#pcRep', painel), gs = gruposRepetidos(), tp = tabela().produtos || {};
    box.hidden = !gs.length; if (!gs.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<b>🧹 ${gs.length} produto(s) repetido(s)</b><p style="margin:4px 0 8px;font-size:13px;color:#667085">O mesmo produto está cadastrado mais de uma vez. Juntar deixa um só, com o preço mais recente e as ligações com a ficha técnica e o estoque.</p>` +
      gs.map((g) => `<div style="font-size:13.5px;padding:6px 0;border-top:1px solid #f1e3c4">${g.map((k) => `<div>• ${esc(tp[k].nome)} <span style="color:#667085">${brl(tp[k].preco)} · ${esc((tp[k].data || '').split('-').reverse().join('/'))}</span></div>`).join('')}</div>`).join('') +
      `<button type="button" id="pcJuntar" style="margin-top:10px;background:#b45309!important;color:#fff!important;box-shadow:none!important">🧹 Juntar repetidos</button>`;
    $('#pcJuntar', box).onclick = (e) => {
      const b = e.target; if (!b.dataset.s) { b.dataset.s = 1; b.textContent = 'Toque de novo para juntar'; setTimeout(() => { b.dataset.s = ''; b.textContent = '🧹 Juntar repetidos'; }, 3000); return; }
      const n = juntarRepetidos(); desenharTabela();
      $('#pcResultado', painel).innerHTML = `<div class="ft-card" style="border:2px solid #15803d"><b>✅ ${n} cadastro(s) repetido(s) tirado(s).</b> Ficou um de cada; as próximas notas já atualizam o que ficou.</div>`;
    };
  }

  /* ---------- 📊 relatório da aba (compras, gastos por grupo, preços que mudaram) ---------- */
  function desenharRelatorio(valorTotal) {
    const box = $('#pcRel', painel), ns = meta().notas || [], tp = tabela().produtos || {};
    const mes = hoje().slice(0, 7), d0 = new Date(); d0.setDate(1); d0.setMonth(d0.getMonth() - 1);
    const mesAnt = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0');
    const mesDe = (n) => { const d = new Date(n.t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
    const doMes = ns.filter((n) => mesDe(n) === mes), doAnt = ns.filter((n) => mesDe(n) === mesAnt);
    const soma = (l) => l.reduce((s, n) => s + (n.total || 0), 0);
    // gastos por grupo (licores, destilados, cervejas, frutas...)
    const porGrupo = {};
    doMes.forEach((n) => (n.itens || []).forEach((x) => { const nome = x.tab && tp[x.tab] ? tp[x.tab].nome : x.produto, g = grupoPara(nome); porGrupo[g] = (porGrupo[g] || 0) + x.qtd * x.preco; }));
    // preços que mudaram nas notas
    const mud = [];
    ns.forEach((n) => (n.itens || []).forEach((x) => {
      const k = x.tab || chaveNome(x.produto), a = ((n.antes || {}).prod || {})[k];
      const novo = x.precoTab || x.preco;
      if (a && a.preco && Math.abs(a.preco - novo) > 0.004 && !mud.some((y) => y.k === k)) mud.push({ k, nome: (tp[k] || a).nome || x.produto, de: a.preco, para: novo, t: n.t });
    }));
    const semLig = Object.values(tp).filter((p) => !p.estoque).length, semFicha = Object.values(tp).filter((p) => !p.ficha && !ehInsumo(p)).length;
    const nomeMes = (m) => new Date(m + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const mesCurto = (m) => new Date(m + '-15').toLocaleDateString('pt-BR', { month: 'long' });
    const gs = Object.entries(porGrupo).sort((a, b) => b[1] - a[1]);
    const totG = gs.reduce((s, x) => s + x[1], 0) || 1;
    const sM = soma(doMes), sA = soma(doAnt), dif = sA ? (sM - sA) / sA * 100 : null;
    const pct = (n) => (n > 0 ? '+' : '') + n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
    const CORES = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#8b5cf6'];
    const icone = (g) => /licor/i.test(g) ? '🍸' : /destil/i.test(g) ? '🥃' : /vinho/i.test(g) ? '🍷' : /cerveja/i.test(g) ? '🍺' : /refri|mixer/i.test(g) ? '🥤' : /fruta|erva/i.test(g) ? '🍋' : '📦';
    box.innerHTML = `<style>
      #pcRel{padding:16px}
      .rl-cab{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
      .rl-cab b{font-size:18px}.rl-cab span{font-size:12.5px;color:#667085;background:#f2f4f7;padding:4px 10px;border-radius:999px}
      .rl-kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .rl-k{border-radius:16px;padding:12px;background:#f8f7ff;border:1px solid #ece9fe}
      .rl-k small{display:block;font-size:12px;color:#667085;margin-bottom:4px}
      .rl-k b{display:block;font-size:19px;letter-spacing:-.3px}
      .rl-k i{font-style:normal;font-size:12px;font-weight:700}
      .rl-k.dest{grid-column:1/-1;background:linear-gradient(135deg,#7c3aed,#a855f7);border:0;color:#fff}
      .rl-k.dest small{color:#ede9fe}.rl-k.dest b{font-size:26px}
      .rl-sec{margin:18px 0 8px;font-size:13px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#5b21b6}
      .rl-bar{margin:9px 0}
      .rl-bar .t{display:flex;justify-content:space-between;font-size:14px;margin-bottom:5px}
      .rl-bar .t b{font-weight:700}.rl-bar .t small{color:#667085;font-weight:400;margin-left:6px}
      .rl-bar .f{height:9px;border-radius:99px;background:#f2f4f7;overflow:hidden}
      .rl-bar .f span{display:block;height:100%;border-radius:99px}
      .rl-pr{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #f2f4f7}
      .rl-pr:first-of-type{border-top:0}
      .rl-pr .n{flex:1;min-width:0;font-size:14px}.rl-pr .n small{display:block;color:#667085;font-size:12px}
      .rl-pr .v{text-align:right;font-size:13px;color:#667085;white-space:nowrap}.rl-pr .v b{display:block;font-size:15px;color:#161826}
      .rl-tag{font-size:12px;font-weight:800;padding:4px 8px;border-radius:999px;white-space:nowrap}
      .rl-up{background:#fee4e2;color:#b42318}.rl-down{background:#dcfae6;color:#067647}
      .rl-av{display:flex;gap:8px;align-items:flex-start;margin-top:14px;padding:10px 12px;border-radius:12px;background:#fffaeb;color:#93370d;font-size:13px}
      .rl-vazio{color:#667085;font-size:13.5px;padding:6px 0}
      #pcRel .rl-bt{display:block;width:100%;margin-top:16px!important;padding:14px!important;border-radius:14px!important;background:#161826!important;color:#fff!important;box-shadow:none!important;font-size:15px!important}
      @media (prefers-color-scheme:dark){.rl-k{background:#221d38;border-color:#2f2850}.rl-cab span,.rl-bar .f{background:#2c2e40}.rl-pr{border-color:#2c2e40}.rl-pr .v b{color:#eef0f6}.rl-av{background:#3a2a10;color:#fcd9a6}#pcRel .rl-bt{background:#7c3aed!important}}
    </style>
    <div class="rl-cab"><b>📊 Relatório</b><span>${esc(new Date().toLocaleDateString('pt-BR'))}</span></div>
    <div class="rl-kpis">
      <div class="rl-k dest"><small>Compras em ${esc(nomeMes(mes))}</small><b>${brl(sM)}</b><small style="margin:4px 0 0">${doMes.length} nota(s) lançada(s)</small></div>
      <div class="rl-k"><small>${esc(mesCurto(mesAnt))} (mês passado)</small><b>${brl(sA)}</b>${dif !== null ? `<i style="color:${dif > 0 ? '#b42318' : '#067647'}">${dif > 0 ? '▲' : '▼'} ${pct(dif)} este mês</i>` : '<i style="color:#667085">sem notas</i>'}</div>
      <div class="rl-k"><small>Valor em estoque</small><b>${brl(valorTotal)}</b><i style="color:#667085">${Object.keys(tp).length} produto(s)</i></div>
    </div>
    <div class="rl-sec">Gastos do mês por grupo</div>
    ${gs.length ? gs.map(([g, v], i) => `<div class="rl-bar"><div class="t"><span>${icone(g)} ${esc(g)}</span><b>${brl(v)}<small>${Math.round(v / totG * 100)}%</small></b></div><div class="f"><span style="width:${Math.max(3, v / totG * 100)}%;background:${CORES[i % CORES.length]}"></span></div></div>`).join('') : '<div class="rl-vazio">Nenhuma nota lançada este mês.</div>'}
    <div class="rl-sec">Preços que mudaram</div>
    ${mud.length ? mud.slice(0, 15).map((y) => { const p = (y.para - y.de) / y.de * 100; return `<div class="rl-pr"><div class="n">${esc(y.nome)}<small>${new Date(y.t).toLocaleDateString('pt-BR')}</small></div><div class="v">${brl(y.de)}<b>${brl(y.para)}</b></div><span class="rl-tag ${p > 0 ? 'rl-up' : 'rl-down'}">${p > 0 ? '▲' : '▼'} ${pct(p)}</span></div>`; }).join('') : '<div class="rl-vazio">Nenhum preço mudou nas últimas notas.</div>'}
    ${semLig || semFicha ? `<div class="rl-av"><span>⚠️</span><span>${semLig ? '<b>' + semLig + '</b> produto(s) sem item no estoque' : ''}${semLig && semFicha ? '<br>' : ''}${semFicha ? '<b>' + semFicha + '</b> bebida(s) sem ingrediente da ficha técnica' : ''}<br><small>Abra ✏️ Editar no produto para ligar.</small></span></div>` : ''}
    <button type="button" class="rl-bt" id="pcRelCopiar">📤 Enviar / copiar relatório</button>`;
    $('#pcRelCopiar', box).onclick = async () => {
      const txt = ['📊 RELATÓRIO DE COMPRAS E PREÇOS — ' + new Date().toLocaleDateString('pt-BR'), '',
        'Compras em ' + nomeMes(mes) + ': ' + brl(soma(doMes)) + ' (' + doMes.length + ' nota(s))', doAnt.length ? 'Mês anterior: ' + brl(soma(doAnt)) : '',
        'Valor em estoque: ' + brl(valorTotal), 'Produtos na tabela: ' + Object.keys(tp).length,
        gs.length ? '\nGASTOS DO MÊS POR GRUPO\n' + gs.map(([g, v]) => '• ' + g + ': ' + brl(v)).join('\n') : '',
        mud.length ? '\nPREÇOS QUE MUDARAM\n' + mud.slice(0, 15).map((y) => '• ' + y.nome + ': ' + brl(y.de) + ' → ' + brl(y.para)).join('\n') : '',
        '\nPRODUTOS\n' + Object.values(tp).sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => '• ' + p.nome + ': ' + brl(p.preco) + ' (' + nomeEmb(p.un) + (p.pack > 1 ? ' ' + p.pack + 'x' + inteiro(p.mlUn) + ' ml' : p.conteudo && p.un !== 'KG' ? ' ' + inteiro(p.conteudo) + ' ' + p.tipo : '') + ')' + (doses(p) ? ' · dose ' + brl(doses(p).custo) : '')).join('\n')].filter(Boolean).join('\n');
      try { if (navigator.share) { await navigator.share({ text: txt }); return; } } catch (e) {}
      try { await navigator.clipboard.writeText(txt); $('#pcRelCopiar', box).textContent = '✅ Relatório copiado'; } catch (e) { prompt('Copie o relatório:', txt); }
    };
  }
  painel.querySelectorAll('[data-ir]').forEach((b) => (b.onclick = () => { const e = $('#' + b.dataset.ir, painel); if (e && !e.hidden) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));

  /* ---------- 🍺 custo por unidade (cerveja, vinho, água, refri, packs) e 🍋 insumos (limão, açúcar...) ---------- */
  const ehInsumo = (p) => p.un === 'KG' || p.un === 'DZ' || p.tipo === 'g' || (p.tipo !== 'ml' && !(p.pack > 1));
  function custoUso(p) { // custo de cada uso na receita
    if (p.ficha && porGotas(p)) { const me = p.usoMed || 'gota', q = p.usoQtd || 3, pm = p.preco / p.conteudo; return { txt: inteiro(p.conteudo) + ' ml · usa ' + (me === 'dash' ? 'dash' : 'gotas'), v: q * (me === 'dash' ? DASH_ML() : GOTA_ML()) * pm, por: q + ' ' + (me === 'dash' ? 'dash' : 'gotas') }; }
    if (p.un === 'KG') {
      if (p.usoKg === 'un' || (!p.usoKg && p.ficha && ingredientes[p.ficha] === 'un')) { const r = p.rende || rendePadrao(p.ficha || p.nome); return { txt: 'rende ' + inteiro(r) + ' un', v: p.preco / r, por: 'cada' }; }
      if (p.usoKg === 'ml' || (p.ficha && ingredientes[p.ficha] === 'ml') || (!p.usoKg && /limao|laranja|maracuja|abacaxi/.test(chaveNome(p.nome)))) { const ml = p.mlkg || mlkgPadrao(p.ficha || p.nome); return { txt: 'rende ' + inteiro(ml) + ' ml', v: p.preco / ml * 30, por: '30 ml' }; }
      return { txt: '1 kg', v: p.preco / 1000 * 100, por: '100 g' };
    }
    if (p.un === 'DZ') return { txt: '12 un', v: p.preco / 12, por: 'cada' };
    if (p.tipo === 'g' && p.conteudo) return { txt: inteiro(p.conteudo) + ' g', v: p.preco / p.conteudo * 100, por: '100 g' };
    const r = p.rende > 1 ? p.rende : p.conteudo > 1 && p.tipo === 'un' ? p.conteudo : 1;
    return { txt: r > 1 ? inteiro(r) + ' un' : '1 un', v: p.preco / r, por: 'cada' };
  }
  // 🍋 Insumos da ficha técnica (frutas, açúcares, ervas, especiarias...), organizados por grupo.
  // Chá, xarope, calda, redução e suco feitos no bar ficam só na ficha técnica (não entram aqui).
  const PREPARO = /^(cha\b|xarope|syrup|calda|redu|tintura|espuma|infus|cordial|shrub|oleo|suco|completar|finalizar|mix\b|pure\b|polpa caseira)|\(dose\)/;
  const BEBIDA = /\b(gin|vodka|rum|whisk\w*|cachaca|licor|vinho|cerveja|tonica|soda|espumante|aperol|campari|vermute|jagermeister|amaretto|cointreau|tequila|conhaque|agua|refri\w*)\b/;
  const GRUPOS_INS = [
    ['🍋 Frutas', /limao|laranja|maracuja|abacaxi|morango|caju|maca\b|uva|kiwi|manga|melancia|coco|framboesa|amora|mirtilo|cereja|pessego|tangerina|mexerica|grapefruit|toranja|siciliano|desidratad|fruta|carambola|goiaba|acerola|pitaya|lichia|kumquat|jabuticaba/],
    ['🌿 Ervas e flores', /manjeric|capim|hortel|\bmenta|alecrim|tomilho|salvia|lavanda|flor|hibisco|erva|folha|louro|coentro|basil|camomila|rosa\b/],
    ['🌶️ Especiarias', /canela|cravo|anis|pimenta|cardamomo|noz.moscada|gengibre|sal\b|curcuma|acafrao|baunilha|tabasco|zimbro|cumaru|pimentao|paprica|semente|fava|especiar|tonka/],
    ['🍬 Açúcares e doces', /acucar|mascavo|rapadura|mel\b|melado|leite condensado|halls|chocolate|cacau|doce|bala|caramelo|glucose|demerara/],
    ['🥚 Outros insumos', /ovo|clara|gelo|bitter|angostura|cafe|leite|creme|nata|chantilly|manteiga|azeitona|cebola|pepino|tomate|sal grosso|aquafaba|gomo|casca/]];
  const grupoIns = (k) => { const n = semAcento(k).toLowerCase(); if (PREPARO.test(n) || BEBIDA.test(n)) return null; const g = GRUPOS_INS.find(([, re]) => re.test(n)); return g ? g[0] : null; };
  const maiuscula = (t) => String(t).charAt(0).toUpperCase() + String(t).slice(1);
  // como se compra cada insumo novo (para já abrir o editor certo)
  const unPadrao = (k) => { const n = semAcento(k).toLowerCase(); return /ovo|clara/.test(n) ? 'DZ' : /limao|laranja|maracuja|abacaxi|morango|acucar|mascavo|gengibre|caju|tangerina|manga|uva|kiwi/.test(n) && !/desidratad/.test(n) ? 'KG' : 'UN'; };
  const cab = (t) => `<div class="ft-r" style="font-size:12px;color:#667085;border-bottom:1px solid #e5e7eb;padding-bottom:4px">${t}</div>`;
  function desenharInsumos(todos, busca) {
    const bi = $('#pcIns', painel), r = htmlInsumos(todos, busca);
    bi.hidden = !r.n; bi.innerHTML = r.html; ligarInsumos(bi);
  }
  function novoInsumo(k) {
    if (document.getElementById('pcModal')) return;
    const nome = maiuscula(k), f = (meta().custo || {})[k];
    // bitter, tabasco: garrafinha em ml, usada em gotas/dash
    const gotinha = /bitter|angostura|peychaud|tabasco|molho ingles|worcester/.test(semAcento(k).toLowerCase());
    const un = gotinha ? 'GF' : unPadrao(k);
    const ml = gotinha ? (f && f.g && num(f.v)) || (/tabasco/.test(semAcento(k).toLowerCase()) ? 60 : 200) : un === 'KG' ? 1000 : ingredientes[k] === 'ml' && f && num(f.v) ? num(f.v) : 0;
    abrirEditor(chaveNome(nome), { nome, un, preco: f ? num(f.p) : 0, conteudo: ml, tipo: un === 'KG' ? 'g' : gotinha || ingredientes[k] === 'ml' ? 'ml' : 'un', ficha: k, estoque: '', rende: 1, usoMed: f && f.m || 'gota', usoQtd: f && num(f.q) || 3, data: hoje(), nf: '' });
  }
  function ligarInsumos(box) {
    box.querySelectorAll('[data-pi]').forEach((r) => (r.onclick = () => novoInsumo(r.dataset.pi)));
    box.querySelectorAll('[data-pe]').forEach((r) => (r.onclick = (e) => { e.preventDefault(); if (!document.getElementById('pcModal')) abrirEditor(r.dataset.pe); }));
  }
  // a mesma lista para a tela 🍋 Insumos da Ficha técnica (aba Caixa)
  window.__barInsumos = () => {
    try { const w = document.getElementById('f-caixa').contentWindow; ingredientes = (w.__cxIngredientes && w.__cxIngredientes()) || ingredientes; } catch (e) {}
    const todos = Object.entries(tabela().produtos || {}).map(([k, p]) => Object.assign({}, p, { _k: k }));
    const r = htmlInsumos(todos, '');
    const corpo = r.html.replace(/<div class="ft-r"><b>🍋 Insumos<\/b>[\s\S]*?<\/p>/, ''); // a tela da ficha já tem o título
    return { n: r.n, html: `<style>.ft-r{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:7px 0}.ft-r small{font-size:12.5px}.pc-gt:first-of-type{margin-top:0}</style>` + corpo };
  };
  window.__barLigarInsumos = ligarInsumos;
  function htmlInsumos(todos, busca) {
    const grupos = {};
    const usados = new Set();
    const custo = meta().custo || {};
    Object.keys(ingredientes).forEach((k) => {
      const g = grupoIns(k); if (!g) return;
      if (busca && !chaveNome(k).includes(busca)) return;
      const ps = todos.filter((p) => p.ficha === k);
      ps.forEach((p) => usados.add(p._k));
      (grupos[g] = grupos[g] || []).push({ k, ps });
    });
    // produtos de insumo da tabela que não estão em nenhuma receita (ex.: gelo)
    todos.filter((p) => ehInsumo(p) && !usados.has(p._k)).forEach((p) => { const g = grupoIns(p.nome) || '🥚 Outros insumos'; (grupos[g] = grupos[g] || []).push({ k: '', ps: [p] }); });
    const ordem = GRUPOS_INS.map((x) => x[0]).filter((g) => grupos[g] && grupos[g].length);
    const usoTxt = (k) => (ingredientes[k] === 'ml' ? 'usa em ml' : ingredientes[k] === 'un' ? 'usa por unidade' : '');
    const linhaIns = ({ k, ps }) => {
      if (ps.length) return ps.map((p) => { const c = custoUso(p); return `<div class="ft-r pc-lin" data-pe="${esc(p._k)}" style="font-size:14px;cursor:pointer"><span style="flex:2">${esc(k ? maiuscula(k) : p.nome)}<small style="display:block;color:#667085">${esc(k && chaveNome(p.nome) !== chaveNome(k) ? p.nome + ' · ' : '')}${nomeEmb(p.un)} · ${c.txt}</small></span><span style="flex:1;text-align:right">${brl(p.preco)}</span><b style="flex:1;text-align:right">${brlFino(c.v)}<small style="display:block;font-weight:400;color:#667085">${c.por}</small></b></div>`; }).join('');
      const f = custo[k], pf = f ? num(f.p) : 0;
      const ja = pf && f.g && num(f.v) ? `<span style="flex:1;text-align:right">${brl(pf)}</span><b style="flex:1;text-align:right">${brlFino((num(f.q) || 3) * (f.m === 'dash' ? DASH_ML() : GOTA_ML()) * pf / num(f.v))}<small style="display:block;font-weight:400;color:#667085">${num(f.q) || 3} ${f.m === 'dash' ? 'dash' : 'gotas'}</small></b>`
        : pf ? `<span style="flex:1;text-align:right">${brl(pf)}</span><b style="flex:1;text-align:right">${ingredientes[k] === 'ml' && num(f.v) ? brlFino(pf / num(f.v)) + '<small style="display:block;font-weight:400;color:#667085">por ml</small>' : brlFino(pf) + '<small style="display:block;font-weight:400;color:#667085">cada</small>'}</b>`
        : `<span style="flex:2;text-align:right"><span class="pc-add">➕ Colocar preço</span></span>`;
      return `<div class="ft-r pc-lin" data-pi="${esc(k)}" style="font-size:14px;cursor:pointer"><span style="flex:2">${esc(maiuscula(k))}<small style="display:block;color:#667085">${pf ? 'preço da ficha técnica · ' : 'sem preço · '}${usoTxt(k)}</small></span>${ja}</div>`;
    };
    return { n: ordem.length, html: `<style>.pc-add{display:inline-block;padding:5px 10px;border-radius:999px;background:#f5f3ff;color:#5b21b6;font-weight:700;font-size:12.5px}.pc-gt{margin:12px 0 2px;font-weight:800;font-size:14px;color:#5b21b6}</style>
      <div class="ft-r"><b>🍋 Insumos</b><small style="color:#667085">toque para editar</small></div>
      <p style="margin:2px 0 6px;font-size:12.5px;color:#667085">Tudo o que as receitas usam. Chá, xarope e calda feitos no bar ficam só na ficha técnica. O preço colocado aqui já atualiza as receitas.</p>` +
      ordem.map((g) => `<div class="pc-gt">${g}</div>` + cab('<span style="flex:2">Insumo</span><span style="flex:1;text-align:right">Compra</span><span style="flex:1;text-align:right">Custo do uso</span>') + grupos[g].sort((a, b) => (a.k || a.ps[0].nome).localeCompare(b.k || b.ps[0].nome)).map(linhaIns).join('')).join('') };
  }
  function desenharCustos(busca) {
    const todos = Object.entries(tabela().produtos || {}).map(([k, p]) => Object.assign({}, p, { _k: k })).filter((p) => !busca || chaveNome(p.nome).includes(busca)).sort((a, b) => a.nome.localeCompare(b.nome));
    const linha = (p, cols) => `<div class="ft-r pc-lin" data-pe="${esc(p._k)}" style="font-size:14px;cursor:pointer">${cols}</div>`;
    // 🍺 unidade: tudo em ml que não é dose (cerveja, vinho, água, refri, lata, long neck, pack)
    const us = todos.filter((p) => p.tipo === 'ml' && p.un !== 'KG' && !doses(p) && !(p.ficha && porGotas(p)));
    const bu = $('#pcUnid', painel); bu.hidden = !us.length;
    bu.innerHTML = `<div class="ft-r"><b>🍺 Custo por unidade</b><small style="color:#667085">toque para editar</small></div>` + cab('<span style="flex:2">Produto</span><span style="flex:1;text-align:right">Compra</span><span style="flex:1;text-align:right">Por unidade</span>') +
      us.map((p) => { const n = p.pack > 1 ? p.pack : 1, ml = n > 1 ? p.mlUn || p.conteudo / n : p.conteudo; return linha(p, `<span style="flex:2">${esc(p.nome)}<small style="display:block;color:#667085">${n > 1 ? nomeEmb(p.un) + ' ' + n + ' × ' + inteiro(ml) + ' ml' : nomeEmb(p.un) + (ml ? ' ' + inteiro(ml) + ' ml' : '')}</small></span><span style="flex:1;text-align:right">${brl(p.preco)}</span><b style="flex:1;text-align:right">${brl(p.preco / n)}</b>`); }).join('');
    desenharInsumos(todos, busca);
  }

  /* ---------- ✏️ editar um produto da tabela: janela própria (não fecha quando a tabela redesenha) ---------- */
  let editando = null;
  const notaDoProduto = (k) => { const p = (tabela().produtos || {})[k] || {}; return (meta().notas || []).find((n) => (n.itens || []).some((x) => chaveNome(x.produto) === k || (p.estoque && x.estoque === p.estoque) || (p.ficha && x.ficha === p.ficha && chaveNome(x.produto).split(' ')[0] === k.split(' ')[0]))); };
  // embalagens: código guardado (igual ao da nota) → nome
  const EMB = [['GF', '🍾 Garrafa'], ['LATA', '🥫 Lata'], ['LN', '🍺 Long neck'], ['PCT', '📦 Pack'], ['CX', '📦 Caixa'], ['FD', '📦 Fardo'], ['UN', '🔹 Unidade'], ['KG', '⚖️ Kg'], ['DZ', '🥚 Dúzia']];
  const EMB_PACK = ['PCT', 'CX', 'FD'];
  const nomeEmb = (u) => ((EMB.find((e) => e[0] === u) || [])[1] || u || 'Unidade').replace(/^\S+\s/, '');
  const inteiro = (n) => (n ? String(Math.round(n * 100) / 100).replace('.', ',') : '');
  function resumoEditor(d) {
    if (!(d.preco > 0)) return 'Coloque o preço.';
    const pack = EMB_PACK.includes(d.un) && d.pack > 1;
    const ml = pack ? d.pack * d.mlUn : d.ml;
    const partes = [`<b>${d.un === 'KG' ? '1 kg' : d.un === 'DZ' ? '1 dúzia' : nomeEmb(d.un)}${d.un === 'KG' || d.un === 'DZ' ? '' : pack ? ' com ' + d.pack + ' × ' + inteiro(d.mlUn) + ' ' + d.tipo : d.ml ? ' de ' + inteiro(d.ml) + ' ' + d.tipo : ''}</b> por <b>${brl(d.preco)}</b>`];
    if (pack) partes.push(`cada unidade sai <b>${brl(d.preco / d.pack)}</b>`);
    if (ml > 0 && d.tipo === 'ml') {
      partes.push(`${brl(d.preco / ml * 1000)} por litro`);
      if (!pack && ml >= 375 && !NAO_DOSE.test(d.nome)) partes.push(`🥃 ${String(Math.floor(ml / doseMl() * 10) / 10).replace('.', ',')} doses de ${doseMl()} ml · <b>${brl(d.preco * doseMl() / ml)} por dose</b>`);
    }
    if (ml > 0 && d.tipo === 'ml' && !pack && d.ficha && ingredientes[d.ficha] === 'un' && !['KG', 'DZ'].includes(d.un)) {
      const pm = d.preco / ml, gotas = Math.round(ml / GOTA_ML()), dashes = Math.round(ml / DASH_ML());
      const q = d.usoQtd || 3, me = d.usoMed || 'gota', um = me === 'dash' ? DASH_ML() : GOTA_ML();
      return partes.slice(0, 1).concat([`💧 ${inteiro(ml)} ml ≈ ${gotas.toLocaleString('pt-BR')} gotas ou ${dashes} dash`, `1 gota = <b>${brlFino(pm * GOTA_ML())}</b> · 1 dash = <b>${brlFino(pm * DASH_ML())}</b>`, `🍸 ${q} ${me === 'dash' ? 'dash' : 'gotas'} no coquetel = <b>${brlFino(q * um * pm)}</b>`]).join('<br>');
    }
    if (d.un === 'KG') {
      if (d.uso === 'ml' && d.mlkg > 0) partes.push(`rende ${inteiro(d.mlkg)} ml de suco · <b>${brlFino(d.preco / d.mlkg)} por ml</b> · 30 ml = ${brl(d.preco / d.mlkg * 30)}`);
      else if (d.uso === 'un' && d.rendeUn > 0) partes.push(`rende ${inteiro(d.rendeUn)} unidades · <b>${brl(d.preco / d.rendeUn)} cada</b>`);
      else partes.push(`<b>${brl(d.preco / 10)} por 100 g</b>`);
    } else if (d.un === 'DZ') partes.push(`<b>${brl(d.preco / 12)} cada unidade</b>`);
    else if (ml > 0 && d.tipo === 'g') partes.push(`${brl(d.preco / ml * 1000)} por kg`);
    return partes.join('<br>');
  }
  function abrirEditor(k, novoP) {
    const ehNovo = !(tabela().produtos || {})[k] && !!novoP;
    const p = (tabela().produtos || {})[k] || novoP; if (!p) return;
    editando = k;
    const n = notaDoProduto(k);
    const pack = EMB_PACK.includes(p.un) && p.pack > 1;
    const d = { nome: p.nome, un: p.un === 'UND' ? 'UN' : p.un || 'UN', preco: p.preco, tipo: p.tipo === 'g' ? 'g' : 'ml', pack: p.pack || 0, mlUn: p.mlUn || (pack ? p.conteudo / p.pack : 0), ml: pack ? 0 : p.conteudo || 0 };
    const opF = Object.keys(ingredientes).sort().map((x) => [x, x + (ingredientes[x] === 'ml' ? ' (ml)' : '')]);
    const opE = Object.entries(estoque.items || {}).sort((a, b) => a[1].n.localeCompare(b[1].n)).map(([id, v]) => [id, v.n]);
    // sem vínculo: sugere o ingrediente da ficha e o item do estoque pelo nome
    const sugF = p.ficha ? '' : fichaPara(p.nome) || '';
    const sugE = p.estoque ? '' : melhor(p.nome, Object.entries(estoque.items || {}).map(([id, v]) => [id, v.n]), false) || '';
    d.usoMed = p.usoMed || 'gota'; d.usoQtd = p.usoQtd || 3; d.ficha = p.ficha || sugF;
    d.uso = p.usoKg || ((p.ficha || sugF) && ingredientes[p.ficha || sugF] === 'un' ? 'un' : (p.ficha || sugF) && ingredientes[p.ficha || sugF] === 'ml' ? 'ml' : /limao|laranja|maracuja|abacaxi/.test(chaveNome(p.nome)) ? 'ml' : 'g');
    d.mlkg = p.mlkg || (d.uso === 'ml' ? mlkgPadrao(p.ficha || sugF || p.nome) : 0);
    d.rendeUn = d.uso === 'un' ? p.rende > 1 ? p.rende : rendePadrao(p.ficha || sugF || p.nome) : 0;
    let fundo = document.getElementById('pcModal');
    if (!fundo) { fundo = document.createElement('div'); fundo.id = 'pcModal'; document.body.appendChild(fundo); }
    fundo.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,10,30,.55);display:flex;align-items:flex-end;justify-content:center';
    const chips = [60, 100, 200, 350, 473, 600, 700, 750, 900, 1000];
    fundo.innerHTML = `<div class="pc-modal" role="dialog" aria-modal="true">
      <style>
        .pc-modal{background:#fff;color:#161826;width:100%;max-width:520px;max-height:92vh;overflow:auto;border-radius:20px 20px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(0,0,0,.25);font-size:15px}
        .pc-modal h2{margin:0 0 4px;font-size:18px}.pc-modal .sub{color:#667085;font-size:13px;margin:0 0 12px}
        .pc-modal label{display:block;font-size:13px;font-weight:600;color:#475467;margin:12px 0 6px}
        .pc-modal input,.pc-modal select{width:100%;box-sizing:border-box;font-size:16px;padding:11px 12px;border:1.5px solid #d0d5dd;border-radius:12px;background:#fff;color:#161826}
        .pc-modal input:focus,.pc-modal select:focus{outline:none;border-color:#7c3aed;box-shadow:0 0 0 3px #ede9fe}
        .pc-emb{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .pc-emb button,.pc-ml button{all:unset;box-sizing:border-box;text-align:center;padding:10px 4px;border:1.5px solid #d0d5dd;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;background:#fff;color:#344054}
        .pc-emb button.on,.pc-ml button.on{border-color:#7c3aed;background:#f5f3ff;color:#5b21b6}
        .pc-ml{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.pc-ml button{padding:7px 10px;font-size:13px}
        .pc-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .pc-res{margin-top:14px;padding:12px;border-radius:14px;background:#f5f3ff;border:1px solid #ddd6fe;font-size:14px;line-height:1.5}
        .pc-bt{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
        .pc-bt button{all:unset;box-sizing:border-box;text-align:center;padding:14px;border-radius:14px;font-weight:700;font-size:16px;cursor:pointer}
        .pc-bt .pc-sv{background:#15803d;color:#fff}.pc-bt .pc-cc{background:#eef0f4;color:#161826}
        .pc-lk{all:unset;display:block;text-align:center;margin-top:12px;padding:10px;font-size:14px;font-weight:600;color:#5b21b6;cursor:pointer}
        .pc-del{color:#b42318}
        @media (prefers-color-scheme:dark){.pc-modal{background:#1a1b27;color:#eef0f6}.pc-modal input,.pc-modal select,.pc-emb button,.pc-ml button{background:#11121b;color:#eef0f6;border-color:#2c2e40}.pc-modal label{color:#aab0c4}.pc-res{background:#241c3d;border-color:#3b2f63}.pc-bt .pc-cc{background:#2c2e40;color:#eef0f6}}
      </style>
      <h2>${ehNovo ? '➕ Preço de ' + esc(p.nome) : '✏️ Editar produto'}</h2><p class="sub">${n ? 'Veio da nota ' + esc(nomeNota(n)) + '. ' : ''}O novo preço vale para o custo das receitas, a dose e o estoque.</p>
      <label>Nome</label><input id="peNome" value="${esc(p.nome)}">
      <label>Como você compra</label>
      <div class="pc-emb">${EMB.map(([v, t]) => `<button type="button" data-emb="${v}"${v === d.un ? ' class="on"' : ''}>${t}</button>`).join('')}</div>
      <div class="pc-2">
        <div><label id="pePrecoL">Preço</label><input id="pePreco" inputmode="decimal" value="${p.preco ? campo(p.preco) : ''}" placeholder="0,00"></div>
        <div id="pePackBox"><label>Unidades no pack</label><input id="pePack" inputmode="numeric" value="${d.pack || ''}" placeholder="ex.: 12"></div>
      </div>
      <div id="peMlBox">
        <label id="peMlL">Quantos ml</label>
        <div class="pc-2"><input id="peMl" inputmode="numeric" placeholder="ex.: 750"><select id="peTipo"><option value="ml">ml</option><option value="g">gramas</option></select></div>
        <div class="pc-ml">${chips.map((c) => `<button type="button" data-ml="${c}">${c === 1000 ? '1 litro' : c + ' ml'}</button>`).join('')}</div>
      </div>
      <div id="peRendeBox">
        <label id="peRendeL">Quanto rende</label>
        <div class="pc-2"><input id="peRende" inputmode="decimal" placeholder="ex.: 400"><select id="peUso"><option value="ml">ml de suco por kg</option><option value="un">unidades por kg</option><option value="g">uso em gramas</option></select></div>
      </div>
      <div id="peGotaBox" style="display:none">
        <label>💧 Na receita usa</label>
        <div class="pc-2"><select id="peMed"><option value="gota">💧 gotas</option><option value="dash">🥄 dash</option></select><input id="peUsoQ" inputmode="numeric" placeholder="3"></div>
        <small style="display:block;color:#667085;margin-top:4px">1 gota ≈ ${String(GOTA_ML()).replace('.', ',')} ml · 1 dash ≈ ${String(DASH_ML()).replace('.', ',')} ml. O número é quantas vão no coquetel quando a receita só diz "finalizar com…". Se a receita diz "2 dash" ou "3 gotas", usa o que está escrito.</small>
      </div>
      <div class="pc-res" id="peRes"></div>
      <label>🍸 Ingrediente da ficha técnica${!p.ficha && sugF ? ' <small style="color:#7c3aed">(sugerido)</small>' : ''}</label><select id="peFicha">${opcoes(opF, p.ficha || sugF)}</select>
      <label>📦 Item do estoque${!p.estoque && sugE ? ' <small style="color:#7c3aed">(sugerido)</small>' : ''}</label><select id="peEst">${opcoes(opE, p.estoque || sugE)}</select>
      <p class="sub" style="margin-top:8px">Ao salvar, o preço vai direto para o 📦 Estoque e para o custo da 🍸 Ficha técnica.</p>
      <div class="pc-bt"><button type="button" class="pc-cc" id="peCancelar">Cancelar</button><button type="button" class="pc-sv" id="peSalvar">💾 Salvar</button></div>
      ${n ? '<button type="button" class="pc-lk" id="peNota">🧾 Corrigir a quantidade na nota</button>' : ''}
      ${ehNovo ? '' : '<button type="button" class="pc-lk pc-del" id="peApagar">🗑️ Excluir este produto</button>'}
    </div>`;
    const $m = (s) => fundo.querySelector(s);
    $m('#peTipo').value = d.tipo;
    const atualizar = () => {
      const pk = EMB_PACK.includes(d.un);
      $m('#pePackBox').style.display = pk ? '' : 'none';
      $m('#peMlBox').style.display = d.un === 'KG' || d.un === 'DZ' ? 'none' : '';
      $m('#peRendeBox').style.display = d.un === 'KG' ? '' : 'none';
      d.ficha = $m('#peFicha') ? $m('#peFicha').value : d.ficha;
      $m('#peGotaBox').style.display = ingredientes[d.ficha] === 'un' && d.tipo === 'ml' && !['KG', 'DZ'].includes(d.un) && !EMB_PACK.includes(d.un) ? '' : 'none';
      $m('#peMed').value = d.usoMed; $m('#peUsoQ').value = d.usoQtd;
      $m('#peUso').value = d.uso; $m('#peRende').style.display = d.uso === 'g' ? 'none' : '';
      $m('#peRende').value = d.uso === 'ml' ? inteiro(d.mlkg) : d.uso === 'un' ? inteiro(d.rendeUn) : '';
      $m('#peRendeL').textContent = d.uso === 'ml' ? 'Quanto rende de suco (ml por kg)' : d.uso === 'un' ? 'Quantas unidades vêm em 1 kg' : 'Usado em gramas na receita';
      $m('#pePrecoL').textContent = 'Preço ' + (d.un === 'KG' ? 'do kg' : d.un === 'DZ' ? 'da dúzia' : 'de 1 ' + nomeEmb(d.un).toLowerCase());
      $m('#peMlL').textContent = pk ? 'Quantos ml cada unidade do pack' : 'Quantos ml tem ' + (d.un === 'GF' ? 'a garrafa' : d.un === 'LATA' ? 'a lata' : d.un === 'LN' ? 'a long neck' : 'cada unidade');
      const v = pk ? d.mlUn : d.ml; $m('#peMl').value = v ? inteiro(v) : '';
      fundo.querySelectorAll('[data-emb]').forEach((b) => b.classList.toggle('on', b.dataset.emb === d.un));
      fundo.querySelectorAll('[data-ml]').forEach((b) => b.classList.toggle('on', +b.dataset.ml === v));
      d.nome = $m('#peNome').value;
      $m('#peRes').innerHTML = resumoEditor(d);
    };
    const lerMl = () => { const v = num($m('#peMl').value); if (EMB_PACK.includes(d.un)) d.mlUn = v; else d.ml = v; };
    fundo.querySelectorAll('[data-emb]').forEach((b) => (b.onclick = () => {
      const era = EMB_PACK.includes(d.un), vai = EMB_PACK.includes(b.dataset.emb);
      if (!era && vai && !d.mlUn) d.mlUn = d.ml; if (era && !vai && !d.ml) d.ml = d.mlUn;
      d.un = b.dataset.emb; atualizar();
    }));
    fundo.querySelectorAll('[data-ml]').forEach((b) => (b.onclick = () => { $m('#peMl').value = b.dataset.ml; lerMl(); atualizar(); }));
    $m('#peMl').oninput = () => { lerMl(); fundo.querySelectorAll('[data-ml]').forEach((b) => b.classList.toggle('on', +b.dataset.ml === num($m('#peMl').value))); d.nome = $m('#peNome').value; $m('#peRes').innerHTML = resumoEditor(d); };
    $m('#pePreco').oninput = () => { d.preco = num($m('#pePreco').value); $m('#peRes').innerHTML = resumoEditor(d); };
    $m('#pePack').oninput = () => { d.pack = Math.round(num($m('#pePack').value)); $m('#peRes').innerHTML = resumoEditor(d); };
    $m('#peMed').onchange = () => { d.usoMed = $m('#peMed').value; $m('#peRes').innerHTML = resumoEditor(d); };
    $m('#peUsoQ').oninput = () => { d.usoQtd = num($m('#peUsoQ').value) || 3; $m('#peRes').innerHTML = resumoEditor(d); };
    $m('#peFicha').onchange = () => atualizar();
    $m('#peUso').onchange = () => { d.uso = $m('#peUso').value; if (d.uso === 'ml' && !d.mlkg) d.mlkg = mlkgPadrao(d.nome); if (d.uso === 'un' && !d.rendeUn) d.rendeUn = rendePadrao(d.nome); atualizar(); };
    $m('#peRende').oninput = () => { const v = num($m('#peRende').value); if (d.uso === 'ml') d.mlkg = v; else d.rendeUn = v; $m('#peRes').innerHTML = resumoEditor(d); };
    $m('#peTipo').onchange = () => { d.tipo = $m('#peTipo').value; $m('#peRes').innerHTML = resumoEditor(d); };
    $m('#peNome').oninput = () => { d.nome = $m('#peNome').value; $m('#peRes').innerHTML = resumoEditor(d); };
    const fechar = () => { editando = null; fundo.remove(); document.removeEventListener('keydown', esc_); };
    const esc_ = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc_);
    fundo.onclick = (e) => { if (e.target === fundo) fechar(); };
    $m('#peCancelar').onclick = fechar;
    const nb = $m('#peNota'); if (nb) nb.onclick = () => { fechar(); if (n) desfazerNota(true, n); };
    if ($m('#peApagar')) $m('#peApagar').onclick = (e) => {
      const b = e.target; if (!b.dataset.s) { b.dataset.s = 1; b.textContent = 'Toque de novo para excluir'; setTimeout(() => { b.dataset.s = ''; b.textContent = '🗑️ Excluir este produto'; }, 3000); return; }
      const m = meta(); if (m.tabPrecos) { delete m.tabPrecos.produtos[k]; delete (m.tabPrecos.alias || {})[k]; }
      salvarMeta(m); fechar(); desenharTabela();
    };
    $m('#peSalvar').onclick = async () => {
      lerMl(); d.preco = num($m('#pePreco').value); d.pack = Math.round(num($m('#pePack').value)); d.tipo = $m('#peTipo').value;
      if (!(d.preco > 0)) { $m('#pePreco').focus(); $m('#peRes').innerHTML = '⚠️ Coloque o preço.'; return; }
      const pk = EMB_PACK.includes(d.un) && d.pack > 1;
      const m = meta(); m.tabPrecos = m.tabPrecos || { produtos: {}, alias: {} }; m.tabPrecos.alias = m.tabPrecos.alias || {};
      const p0 = m.tabPrecos.produtos[k] || (novoP ? Object.assign({}, novoP) : null); if (!p0) { fechar(); return; }
      const nome = $m('#peNome').value.trim() || p0.nome;
      const conteudo = d.un === 'KG' ? 1000 : pk ? d.pack * d.mlUn : d.ml;
      const novo = Object.assign({}, p0, { nome, preco: Math.round(d.preco * 100) / 100, un: d.un, conteudo: conteudo || 0, tipo: d.un === 'KG' ? 'g' : conteudo ? d.tipo : 'un', pack: pk ? d.pack : 0, mlUn: pk ? d.mlUn : 0, ficha: $m('#peFicha').value, estoque: $m('#peEst').value, data: hoje(), editado: Date.now() });
      if (pk && novo.ficha && ingredientes[novo.ficha] === 'un') novo.rende = d.pack;
      if (d.un === 'KG') { novo.usoKg = d.uso; novo.mlkg = d.uso === 'ml' ? d.mlkg : 0; novo.rende = d.uso === 'un' ? d.rendeUn || 1 : 1; }
      if (d.un === 'DZ') novo.rende = 12;
      if (porGotas(novo)) { novo.usoMed = d.usoMed || 'gota'; novo.usoQtd = d.usoQtd || 3; } else { delete novo.usoMed; delete novo.usoQtd; }
      const nk = chaveNome(nome) || k;
      if (nk !== k) { delete m.tabPrecos.produtos[k]; if (!m.tabPrecos.alias[nk]) m.tabPrecos.alias[nk] = m.tabPrecos.alias[k]; }
      m.tabPrecos.produtos[nk] = novo;
      // a próxima nota com este produto já vem com a embalagem e os ml certos
      [k, nk].forEach((x) => { m.tabPrecos.alias[x] = Object.assign({}, m.tabPrecos.alias[x] || {}, { ficha: novo.ficha, estoque: novo.estoque, conteudo: novo.conteudo, tipo: novo.tipo, rende: novo.rende || 1, mlkg: novo.mlkg || (m.tabPrecos.alias[x] || {}).mlkg || 0 }); });
      if (novo.ficha) { m.custo = m.custo || {}; const c = custoFicha({ ...novo, mlkg: novo.mlkg || (m.tabPrecos.alias[nk] || {}).mlkg || mlkgPadrao(novo.ficha) }); m.custo[novo.ficha] = custoGravar(c); }
      salvarMeta(m);
      fechar(); desenharTabela();
      $('#pcResultado', painel).innerHTML = `<div class="ft-card" style="border:2px solid #15803d"><b>✅ ${esc(nome)} salvo</b><br>${resumoEditor({ ...d, nome })}</div>`;
      $('#pcResultado', painel).scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (novo.estoque && window.__barImportar) { const pr = {}; pr[novo.estoque] = Object.assign({}, (estoque.price || {})[novo.estoque] || {}, { pu: campo(novo.preco).replace(/,00$/, '') }); try { await window.__barImportar({ apps: { estoque: { price: pr } } }); const fe = document.getElementById('f-estoque'); if (fe && fe.src) fe.contentWindow.location.reload(); } catch (e) {} }
    };
    atualizar();
    setTimeout(() => $m('#pePreco').focus({ preventScroll: true }), 50);
  }
  function ligarEditar() {
    painel.querySelectorAll('[data-pe]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); if (!document.getElementById('pcModal')) abrirEditor(b.dataset.pe); }));
    painel.querySelectorAll('[data-px]').forEach((b) => (b.onclick = () => {
      if (!b.dataset.s) { b.dataset.s = 1; b.textContent = 'Confirmar?'; setTimeout(() => { b.dataset.s = ''; b.textContent = '🗑️ Excluir'; }, 3000); return; }
      const m = meta(); if (m.tabPrecos) { delete m.tabPrecos.produtos[b.dataset.px]; delete (m.tabPrecos.alias || {})[b.dataset.px]; }
      salvarMeta(m); desenharTabela();
    }));
  }

  // Aberto pela Ficha técnica (botão 📷 Foto da nota) ou ao abrir a aba
  window.__barPrecosAtualizar = async () => { await carregarFontes(); desenharLeitura(); desenharTabela(); desenharNotas(); };
  window.__barAbrirNota = () => {
    const b = document.querySelector('nav [data-tab=precos]'); if (b) b.click();
    $('#pcScan', painel).click();
  };
  window.__barNotaLer = lerNota; // usado nos testes
  try {
    const g = JSON.parse(localStorage.getItem(RK) || 'null');
    if (g && g.itens && g.itens.length) {
      rascunho = g.itens; nf = g.nf || ''; $('#pcNF', painel).value = nf;
      corrigindo = g.corrigindo ? (meta().notas || []).find((x) => x.id === g.corrigindo) || null : null;
      carregarFontes().then(() => { desenharLeitura(); $('#pcResultado', painel).innerHTML = `<div class="ft-card" style="border:2px solid #7c3aed"><b>${corrigindo ? '✏️ Corrigindo: ' + esc(nomeNota(corrigindo)) : '🧾 Nota em aberto'}</b><br>Continue de onde parou e toque em <b>✅ Aplicar</b>.</div>`; }).catch(() => {});
    }
  } catch (e) {}
  desenharTabela(); desenharNotas();
})();
