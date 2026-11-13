/* Fechamento por foto (aba 📸 Foto do Bar Conect)
 *
 * - Lê as fotos dos comprovantes de fechamento das maquininhas sem internet (Tesseract, em
 *   vendor/ocr) e separa os valores: Crédito + Débito = Cartão; Pix + QR Code = Pix.
 * - Dinheiro é digitado à mão, com calculadora (soma várias notas).
 * - Soma todas as fotos da operação, monta o relatório e preenche o fechamento do dia no
 *   Caixa (Bar ou Portaria), sem apagar os outros campos do dia.
 * Os valores lidos sempre podem ser corrigidos antes de aplicar.
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const painel = $('#f-foto');
  if (!painel) return;

  /* ---------- números ---------- */
  const num = (s) => {
    s = String(s ?? '').trim().replace(/[R$\s]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return isNaN(n) ? 0 : n;
  };
  const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const campo = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const soma = (txt) => String(txt || '').split(/[+\n;\s]+/).map(num).reduce((a, b) => a + b, 0);
  const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- leitura do comprovante ---------- */
  const CATS = [
    ['qr', /QR\s*-?\s*CODE|QRCODE|\bQR\b/],
    ['pix', /\bPIX\b/],
    ['debito', /DEBITO/],
    ['credito', /CREDITO/],
  ];
  const DINHEIRO_RE = /(\d{1,3}(?:[.\s]\d{3})+,\d{2}|\d+,\d{2})/g;
  function lerComprovante(texto) {
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const achados = { credito: [], debito: [], pix: [], qr: [] };
    let totalLido = 0;
    const valores = (l) => (norm(l).match(DINHEIRO_RE) || []).map((v) => num(v.replace(/\s/g, '.')));
    linhas.forEach((linha, i) => {
      const L = norm(linha);
      const cat = (CATS.find(([, re]) => re.test(L)) || [])[0];
      let vs = valores(linha);
      if (!cat) {
        if (/\bTOTAL\b/.test(L) && vs.length && !/ESTORN|CANCEL|TAXA|LIQUID/.test(L)) totalLido = Math.max(totalLido, vs[vs.length - 1]);
        return;
      }
      if (/ESTORN|CANCEL|TAXA|TARIFA/.test(L)) return;
      if (!vs.length && linhas[i + 1] && !CATS.some(([, re]) => re.test(norm(linhas[i + 1])))) vs = valores(linhas[i + 1]);
      if (!vs.length) return;
      achados[cat].push({ v: vs[vs.length - 1], total: /\bTOTAL\b/.test(L) });
    });
    const escolher = (lista) => {
      if (!lista.length) return 0;
      const tot = lista.filter((x) => x.total);
      if (tot.length) return tot[tot.length - 1].v;
      // linha de resumo que é a soma das outras (ex.: VISA + MASTER e depois CRÉDITO)
      const s = lista.reduce((a, x) => a + x.v, 0);
      const resumo = lista.find((x) => Math.abs(x.v * 2 - s) < 0.011);
      if (lista.length > 2 && resumo) return resumo.v;
      if (lista.length === 2 && Math.abs(lista[0].v - lista[1].v) < 0.011) return lista[0].v;
      return s;
    };
    return {
      credito: escolher(achados.credito), debito: escolher(achados.debito),
      pix: escolher(achados.pix), qr: escolher(achados.qr), totalLido,
    };
  }

  /* ---------- OCR (carregado só quando precisa) ---------- */
  let worker = null;
  const abs = (p) => new URL(p, location.href).href;
  function carregarScript(src) {
    return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('não carregou ' + src)); document.head.appendChild(s); });
  }
  let progresso = () => {};
  async function obterWorker() {
    if (worker) return worker;
    if (!window.Tesseract) await carregarScript('vendor/ocr/tesseract.min.js');
    worker = await window.Tesseract.createWorker('por', 1, {
      workerPath: abs('vendor/ocr/worker.min.js'), corePath: abs('vendor/ocr/'), langPath: abs('vendor/ocr/lang'),
      gzip: true, logger: (m) => progresso(m),
    });
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    return worker;
  }
  // diminui e passa para tons de cinza (mais rápido e lê melhor)
  async function prepararImagem(arquivo) {
    const url = URL.createObjectURL(arquivo);
    const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const max = 1800, k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const y = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; const v = y > 165 ? 255 : y < 90 ? 0 : y; p[i] = p[i + 1] = p[i + 2] = v; }
    g.putImageData(d, 0, 0);
    const t = document.createElement('canvas'), kt = 160 / Math.max(c.width, c.height); t.width = Math.round(c.width * kt); t.height = Math.round(c.height * kt);
    t.getContext('2d').drawImage(img, 0, 0, t.width, t.height);
    URL.revokeObjectURL(url);
    return { canvas: c, miniatura: t.toDataURL('image/jpeg', 0.7) };
  }

  /* ---------- estado (guardado por data + destino, sem as fotos grandes) ---------- */
  let data = hoje(), destino = 'bar';
  const chave = () => 'bar-foto:' + data + ':' + destino;
  let estado = { fotos: [], dinheiro: '' };
  const carregar = () => { try { estado = JSON.parse(localStorage.getItem(chave())) || { fotos: [], dinheiro: '' }; } catch (e) { estado = { fotos: [], dinheiro: '' }; } };
  const salvar = () => { try { localStorage.setItem(chave(), JSON.stringify(estado)); } catch (e) {} };

  const totais = () => {
    const t = { credito: 0, debito: 0, pix: 0, qr: 0 };
    estado.fotos.forEach((f) => Object.keys(t).forEach((k) => (t[k] += num(f[k]))));
    t.cartao = t.credito + t.debito; t.pixTotal = t.pix + t.qr; t.dinheiro = soma(estado.dinheiro);
    t.total = t.cartao + t.pixTotal + t.dinheiro;
    return t;
  };

  /* ---------- tela ---------- */
  painel.innerHTML = `
    <h1>📸 Fechamento por foto</h1>
    <p>Tire foto dos comprovantes de fechamento das maquininhas. O app lê os valores e separa: <b>Crédito + Débito = Cartão</b> e <b>Pix + QR Code = Pix</b>. O dinheiro você digita.</p>
    <div class="ft-linha"><label>Dia do fechamento<input type="date" id="ftData"></label></div>
    <div class="ft-chips" id="ftDestino"><button data-d="bar">🍸 Bar</button><button data-d="portaria">🚪 Portaria</button></div>
    <div class="ft-chips" style="margin-top:16px">
      <label class="ft-foto-btn" style="margin:0!important">📷 Tirar foto<input type="file" id="ftCam" accept="image/*" capture="environment" hidden></label>
      <label class="ft-foto-btn" style="margin:0!important;background:#4c1d95">🖼️ Galeria<input type="file" id="ftArq" accept="image/*" multiple hidden></label>
    </div>
    <button class="sec" id="ftManual">✍️ Lançar sem foto</button>
    <div id="ftFotos"></div>
    <div class="ft-card"><b>💵 Dinheiro (manual)</b>
      <p style="margin:4px 0 8px">Calculadora: digite os valores separados por + ou um por linha.</p>
      <textarea id="ftDin" rows="3" placeholder="ex.: 50 + 20 + 108,50"></textarea>
      <div class="ft-r"><span>Total em dinheiro</span><b id="ftDinT">R$ 0,00</b></div></div>
    <div class="ft-card ft-tot" id="ftTotais"></div>
    <button id="ftAplicar">✅ Aplicar no fechamento do Caixa</button>
    <button class="sec" id="ftCopiar">📋 Copiar relatório</button>
    <p id="ftMsg"></p>
    <textarea id="ftRel" rows="8" readonly hidden></textarea>`;

  const campos = [['credito', 'Crédito'], ['debito', 'Débito'], ['pix', 'Pix'], ['qr', 'QR Code']];
  function desenharFotos() {
    $('#ftFotos', painel).innerHTML = estado.fotos.map((f, i) => `
      <div class="ft-card" data-i="${i}">
        <div class="ft-cab">${f.mini ? `<img src="${f.mini}" alt="">` : '<span class="ft-sem">✍️</span>'}
          <div><b>${f.mini ? 'Foto ' + (i + 1) : 'Lançamento ' + (i + 1)}</b><small>${esc(f.status || '')}</small></div>
          <button class="ft-x" data-x="${i}" aria-label="Remover">✕</button></div>
        <div class="ft-grid">${campos.map(([k, n]) => `<label>${n}<input inputmode="decimal" data-k="${k}" value="${f[k] ? campo(f[k]) : ''}" placeholder="0,00"></label>`).join('')}</div>
        ${f.totalLido ? `<small class="ft-ok">Total lido na foto: ${brl(f.totalLido)}${Math.abs(f.totalLido - (num(f.credito) + num(f.debito) + num(f.pix) + num(f.qr))) > 0.01 ? ' · ⚠️ confira os valores' : ' · ✔ bate'}</small>` : ''}
        ${f.texto ? `<details><summary>Ver texto lido</summary><pre>${esc(f.texto)}</pre></details>` : ''}
      </div>`).join('');
    desenharTotais();
  }
  function desenharTotais() {
    const t = totais();
    $('#ftDinT', painel).textContent = brl(t.dinheiro);
    $('#ftTotais', painel).innerHTML = `
      <div class="ft-r"><span>💳 Cartão <small>(crédito ${brl(t.credito)} + débito ${brl(t.debito)})</small></span><b>${brl(t.cartao)}</b></div>
      <div class="ft-r"><span>⚡ Pix <small>(Pix ${brl(t.pix)} + QR Code ${brl(t.qr)})</small></span><b>${brl(t.pixTotal)}</b></div>
      <div class="ft-r"><span>💵 Dinheiro</span><b>${brl(t.dinheiro)}</b></div>
      <div class="ft-r ft-big"><span>Total ${destino === 'bar' ? 'do bar' : 'da portaria'}</span><b>${brl(t.total)}</b></div>`;
  }
  function trocar() {
    carregar();
    $('#ftData', painel).value = data;
    painel.querySelectorAll('#ftDestino [data-d]').forEach((b) => b.classList.toggle('on', b.dataset.d === destino));
    $('#ftDin', painel).value = estado.dinheiro || '';
    $('#ftMsg', painel).textContent = '';
    $('#ftRel', painel).hidden = true;
    desenharFotos();
  }

  $('#ftData', painel).onchange = (e) => { data = e.target.value || hoje(); trocar(); };
  painel.querySelectorAll('#ftDestino [data-d]').forEach((b) => (b.onclick = () => { destino = b.dataset.d; trocar(); }));
  $('#ftDin', painel).oninput = (e) => { estado.dinheiro = e.target.value; salvar(); desenharTotais(); };
  $('#ftManual', painel).onclick = () => { estado.fotos.push({ credito: 0, debito: 0, pix: 0, qr: 0, status: 'Digite os valores' }); salvar(); desenharFotos(); };
  $('#ftFotos', painel).addEventListener('input', (e) => {
    const k = e.target.dataset.k, i = +e.target.closest('[data-i]').dataset.i;
    if (!k) return;
    estado.fotos[i][k] = num(e.target.value); salvar(); desenharTotais();
  });
  $('#ftFotos', painel).addEventListener('click', (e) => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    if (!x.dataset.arm) { x.dataset.arm = '1'; x.textContent = 'Remover?'; setTimeout(() => { x.dataset.arm = ''; x.textContent = '✕'; }, 3000); return; }
    estado.fotos.splice(+x.dataset.x, 1); salvar(); desenharFotos();
  });

  const lerArquivos = async (e) => {
    const arquivos = [...e.target.files]; e.target.value = '';
    for (const arq of arquivos) {
      const f = { credito: 0, debito: 0, pix: 0, qr: 0, status: 'Preparando a foto…' };
      estado.fotos.push(f); desenharFotos();
      try {
        const { canvas, miniatura } = await prepararImagem(arq);
        f.mini = miniatura; f.status = 'Lendo a foto… (a primeira vez demora um pouco)'; desenharFotos();
        progresso = (m) => { if (m.status === 'recognizing text') { f.status = 'Lendo a foto… ' + Math.round(m.progress * 100) + '%'; const el = painel.querySelector(`[data-i="${estado.fotos.indexOf(f)}"] small`); if (el) el.textContent = f.status; } };
        const w = await obterWorker();
        const r = await w.recognize(canvas);
        f.texto = r.data.text;
        Object.assign(f, lerComprovante(f.texto));
        const achou = f.credito || f.debito || f.pix || f.qr;
        f.status = achou ? 'Valores lidos. Confira e corrija se precisar.' : 'Não achei Crédito, Débito, Pix ou QR Code. Digite os valores.';
      } catch (err) {
        f.status = 'Não consegui ler esta foto (' + (err.message || err) + '). Digite os valores.';
      }
      salvar(); desenharFotos();
    }
  };

  $('#ftArq', painel).onchange = lerArquivos;
  $('#ftCam', painel).onchange = lerArquivos;

  function relatorio() {
    const t = totais(), dt = data.split('-').reverse().join('/');
    const L = ['*FECHAMENTO ' + (destino === 'bar' ? 'DO BAR' : 'DA PORTARIA') + ' - ' + dt + '*', ''];
    estado.fotos.forEach((f, i) => L.push((f.mini ? 'Foto ' : 'Lançamento ') + (i + 1) + ': Crédito ' + brl(f.credito) + ' · Débito ' + brl(f.debito) + ' · Pix ' + brl(f.pix) + ' · QR Code ' + brl(f.qr)));
    if (estado.fotos.length) L.push('');
    L.push('*CARTÃO* (crédito + débito): ' + brl(t.cartao));
    L.push('*PIX* (Pix + QR Code): ' + brl(t.pixTotal));
    L.push('*DINHEIRO*: ' + brl(t.dinheiro));
    L.push('_Total_: ' + brl(t.total));
    return L.join('\n');
  }
  $('#ftCopiar', painel).onclick = async () => {
    const txt = relatorio(), el = $('#ftRel', painel);
    el.hidden = false; el.value = txt;
    try { await navigator.clipboard.writeText(txt); $('#ftMsg', painel).textContent = '✅ Relatório copiado. Cole no WhatsApp.'; }
    catch (e) { el.select(); try { document.execCommand('copy'); $('#ftMsg', painel).textContent = '✅ Relatório copiado.'; } catch (x) { $('#ftMsg', painel).textContent = 'Copie o relatório abaixo.'; } }
  };

  // Aplica no fechamento do dia: Bar → bd/bc/bp; Portaria → pd/pc/pp. Os outros campos do dia ficam como estão.
  let armado = false;
  $('#ftAplicar', painel).onclick = () => {
    const t = totais(), msg = $('#ftMsg', painel);
    const k = destino === 'bar' ? { d: 'bd', c: 'bc', p: 'bp' } : { d: 'pd', c: 'pc', p: 'pp' };
    let days = {};
    try { days = JSON.parse(localStorage.getItem('caixa-bar')) || {}; } catch (e) {}
    const dia = days[data] || {};
    const novo = { [k.d]: campo(t.dinheiro), [k.c]: campo(t.cartao), [k.p]: campo(t.pixTotal) };
    if (!armado) {
      armado = true;
      const nome = { d: 'Dinheiro', c: 'Cartão', p: 'Pix' };
      msg.textContent = 'Vou gravar no fechamento de ' + data.split('-').reverse().join('/') + ' (' + (destino === 'bar' ? 'Bar' : 'Portaria') + '): '
        + Object.entries(k).map(([a, c]) => nome[a] + ' ' + (dia[c] ? 'R$ ' + dia[c] : 'vazio') + ' → R$ ' + novo[c]).join(' · ')
        + '. Toque em Aplicar de novo para confirmar.';
      setTimeout(() => (armado = false), 8000);
      return;
    }
    armado = false;
    days[data] = Object.assign({}, dia, novo);
    localStorage.setItem('caixa-bar', JSON.stringify(days));
    const f = document.getElementById('f-caixa');
    if (f && f.src) f.contentWindow.location.reload();
    msg.textContent = '✅ Aplicado no fechamento de ' + data.split('-').reverse().join('/') + '. Abra a aba Caixa para conferir.';
  };

  window.__barFotoLer = lerComprovante; // usado nos testes
  trocar();
})();
