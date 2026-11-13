/* Ferramentas (dentro da aba ⚙️ Ajustes do Bar Conect)
 *
 * Para a dona do bar ajustar o app sozinha:
 * - Abas: mostrar, esconder e mudar a ordem das abas da barra de baixo.
 * - Cores do app: tema da faixa do topo, da barra de abas e dos botões.
 * - Apresentação de abertura: ligar/desligar e velocidade.
 * - Fichas técnicas: abrir e voltar às fichas originais.
 * - Editor avançado: ver e consertar qualquer dado (Caixa, Portaria, Estoque) com backup
 *   automático antes de salvar.
 * - Manutenção: recarregar, limpar a cópia offline, espaço usado.
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const aj = document.getElementById('f-ajustes');
  if (!aj) return;
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lerJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const recarregarAbas = (ids) => ids.forEach((id) => { const f = document.getElementById('f-' + id); if (f && f.src) f.contentWindow.location.reload(); });
  async function ehDono() { try { const c = await window.__barIniciarCore(); return !c || c.dono; } catch (e) { return true; } }

  /* ---------------- abas ---------------- */
  const ABAS = [['caixa', '🍸 Caixa'], ['portaria', '🚪 Portaria'], ['estoque', '📦 Estoque'], ['precos', '💲 Preços'], ['foto', '📸 Foto'], ['backup', '💾 Backup']];
  const cfgAbas = () => { const c = lerJSON('bar-abas', {}); const ordem = (c.ordem || []).filter((id) => ABAS.some((a) => a[0] === id)); ABAS.forEach(([id]) => { if (!ordem.includes(id)) ordem.push(id); }); return { ordem, ocultas: c.ocultas || [] }; };
  function aplicarAbas() {
    const c = cfgAbas(), nav = document.getElementById('nav');
    const vis = c.ordem.filter((id) => !c.ocultas.includes(id));
    c.ordem.forEach((id, i) => { const b = nav.querySelector(`[data-tab="${id}"]`); if (b) { b.style.order = i; b.style.display = c.ocultas.includes(id) ? 'none' : ''; } });
    const a = nav.querySelector('[data-tab="ajustes"]'); if (a) a.style.order = 99;
    nav.style.gridTemplateColumns = `repeat(${vis.length + 1},1fr)`;
    const atual = localStorage.getItem('bar-aba');
    if (atual && c.ocultas.includes(atual)) { const b = nav.querySelector(`[data-tab="${vis[0] || 'ajustes'}"]`); if (b) b.click(); }
  }

  /* ---------------- temas ---------------- */
  const TEMAS = {
    roxo: { nome: 'Roxo', a: '#12051f', b: '#2e0a52', c: '#4c1d95', d: '#7c3aed', n: '#1e0b36' },
    azul: { nome: 'Azul-noite', a: '#020617', b: '#0c1e4a', c: '#1e3a8a', d: '#2563eb', n: '#0b1532' },
    verde: { nome: 'Verde-garrafa', a: '#021a12', b: '#064e3b', c: '#065f46', d: '#059669', n: '#04281d' },
    vinho: { nome: 'Vinho', a: '#1a0509', b: '#4c0519', c: '#881337', d: '#be123c', n: '#2a0810' },
    grafite: { nome: 'Grafite', a: '#0a0a0a', b: '#1f2937', c: '#374151', d: '#4b5563', n: '#111827' },
  };
  function aplicarTema() {
    const t = TEMAS[localStorage.getItem('bar-tema')] || TEMAS.roxo;
    let st = document.getElementById('estiloTema');
    if (!st) { st = document.createElement('style'); st.id = 'estiloTema'; document.head.appendChild(st); }
    st.textContent = `html,body{background:${t.a}!important}
      .marca{background:linear-gradient(100deg,${t.a} 0%,${t.b} 55%,${t.c} 100%)!important}
      nav{background:linear-gradient(180deg,${t.n},${t.a})!important}
      .painel button:not(.sec):not(.ft-x){background:linear-gradient(135deg,${t.d},${t.c})!important}
      #intro{background:radial-gradient(circle at 50% 38%,${t.d} 0%,${t.b} 46%,${t.a} 100%)!important}`;
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t.a;
  }

  /* ---------------- tela ---------------- */
  const box = document.createElement('div');
  box.id = 'ferramentas';
  box.innerHTML = `
    <h1 style="margin-top:26px">🛠️ Ferramentas</h1>
    <p>Ajuste o app do seu jeito. Tudo fica salvo neste aparelho.</p>

    <details class="ft-card fr-g"><summary>🧭 Abas da barra de baixo</summary>
      <p style="margin:8px 0">Esconda as abas que não usa e mude a ordem com as setas. A aba Ajustes fica sempre no fim.</p>
      <div id="frAbas"></div></details>

    <details class="ft-card fr-g"><summary>🎨 Cores do app</summary>
      <div id="frTemas" class="fr-temas"></div></details>

    <details class="ft-card fr-g"><summary>🎬 Apresentação de abertura</summary>
      <div class="ft-chips" id="frIntroOn" style="margin-top:10px"><button data-v="1">Ligada</button><button data-v="0">Desligada</button></div>
      <label>Velocidade</label>
      <div class="ft-chips" id="frIntroV" style="grid-template-columns:1fr 1fr 1fr"><button data-v="0.6">Rápida</button><button data-v="1">Normal</button><button data-v="1.4">Longa</button></div>
      <button class="sec" id="frIntroVer">▶️ Ver a apresentação agora</button></details>

    <details class="ft-card fr-g"><summary>🍸 Fichas técnicas</summary>
      <p style="margin:8px 0">Crie, edite e apague fichas na própria Ficha técnica (Caixa → Ficha técnica).</p>
      <button id="frFichas">Abrir fichas técnicas</button>
      <button class="sec" id="frFichasPadrao">↩️ Voltar às fichas originais</button>
      <p id="frFichasMsg"></p></details>

    <details class="ft-card fr-g"><summary>🧰 Editor avançado (consertar dados)</summary>
      <p style="margin:8px 0">Veja e corrija qualquer dado do app. Antes de salvar, o app guarda um <b>backup automático</b> (os últimos 3), que você pode restaurar aqui.</p>
      <label>O que editar</label><select id="frArea"></select>
      <div id="frSub"></div>
      <textarea id="frTxt" rows="12" spellcheck="false" style="font:12.5px/1.45 ui-monospace,Menlo,monospace"></textarea>
      <button id="frSalvar">💾 Salvar alterações</button>
      <button class="sec" id="frAuto">↩️ Restaurar backup automático</button>
      <p id="frMsg"></p></details>

    <details class="ft-card fr-g"><summary>🧹 Manutenção</summary>
      <p id="frEspaco" style="margin:8px 0"></p>
      <button class="sec" id="frRecarregar">🔄 Recarregar o app</button>
      <button class="sec" id="frCache">🧽 Limpar a cópia offline (não apaga dados)</button>
      <p id="frManMsg"></p></details>`;
  aj.appendChild(box);

  // abas
  function desenharAbas() {
    const c = cfgAbas();
    $('#frAbas').innerHTML = c.ordem.map((id, i) => {
      const nome = (ABAS.find((a) => a[0] === id) || [])[1];
      return `<div class="fr-aba"><label class="pc-check"><input type="checkbox" data-a="${id}"${c.ocultas.includes(id) ? '' : ' checked'}> ${esc(nome)}</label>
        <span><button class="sec fr-s" data-up="${i}"${i ? '' : ' disabled'}>↑</button><button class="sec fr-s" data-dn="${i}"${i < c.ordem.length - 1 ? '' : ' disabled'}>↓</button></span></div>`;
    }).join('');
  }
  $('#frAbas').addEventListener('click', (e) => {
    const c = cfgAbas(), up = e.target.dataset.up, dn = e.target.dataset.dn;
    if (up === undefined && dn === undefined) return;
    const i = +(up ?? dn), j = up !== undefined ? i - 1 : i + 1;
    [c.ordem[i], c.ordem[j]] = [c.ordem[j], c.ordem[i]];
    localStorage.setItem('bar-abas', JSON.stringify(c)); aplicarAbas(); desenharAbas();
  });
  $('#frAbas').addEventListener('change', (e) => {
    const id = e.target.dataset.a; if (!id) return;
    const c = cfgAbas();
    c.ocultas = e.target.checked ? c.ocultas.filter((x) => x !== id) : [...new Set([...c.ocultas, id])];
    if (c.ocultas.length >= ABAS.length) { e.target.checked = true; return; }
    localStorage.setItem('bar-abas', JSON.stringify(c)); aplicarAbas();
  });

  // temas
  function desenharTemas() {
    const atual = localStorage.getItem('bar-tema') || 'roxo';
    $('#frTemas').innerHTML = Object.entries(TEMAS).map(([id, t]) => `<button data-t="${id}" class="fr-tema${id === atual ? ' on' : ''}" style="background:linear-gradient(135deg,${t.d},${t.a})!important">${esc(t.nome)}</button>`).join('');
  }
  $('#frTemas').addEventListener('click', (e) => { const t = e.target.dataset.t; if (!t) return; localStorage.setItem('bar-tema', t); aplicarTema(); desenharTemas(); });

  // apresentação
  const cfgIntro = () => lerJSON('bar-intro', { on: 1, v: 1 });
  function desenharIntro() {
    const c = cfgIntro();
    box.querySelectorAll('#frIntroOn [data-v]').forEach((b) => b.classList.toggle('on', +b.dataset.v === +c.on));
    box.querySelectorAll('#frIntroV [data-v]').forEach((b) => b.classList.toggle('on', +b.dataset.v === +c.v));
  }
  $('#frIntroOn').onclick = (e) => { const v = e.target.dataset.v; if (v === undefined) return; const c = cfgIntro(); c.on = +v; localStorage.setItem('bar-intro', JSON.stringify(c)); desenharIntro(); };
  $('#frIntroV').onclick = (e) => { const v = e.target.dataset.v; if (v === undefined) return; const c = cfgIntro(); c.v = +v; localStorage.setItem('bar-intro', JSON.stringify(c)); desenharIntro(); };
  $('#frIntroVer').onclick = () => { sessionStorage.setItem('bar-intro-forcar', '1'); location.reload(); };

  // fichas
  const caixaW = () => { try { return document.getElementById('f-caixa').contentWindow; } catch (e) { return null; } };
  $('#frFichas').onclick = () => { document.querySelector('nav [data-tab="caixa"]').click(); const w = caixaW(); if (w && w.__cxAbrirFichas) w.__cxAbrirFichas(); };
  let armF = false;
  $('#frFichasPadrao').onclick = () => {
    const msg = $('#frFichasMsg');
    if (!armF) { armF = true; setTimeout(() => (armF = false), 6000); msg.textContent = 'Isso apaga as fichas que você criou ou editou e volta às 12 originais. Toque de novo para confirmar.'; return; }
    armF = false; const w = caixaW();
    if (w && w.__cxFichasPadrao) { w.__cxFichasPadrao(); msg.textContent = '✅ Fichas originais de volta.'; } else msg.textContent = 'Abra a aba Caixa uma vez e tente de novo.';
  };

  /* ---------------- editor avançado ---------------- */
  const AREAS = [
    ['cx-dias', 'Caixa · fechamentos de um mês'],
    ['cx-meta', 'Caixa · configurações (equipe, fornecedores, custos, fichas…)'],
    ['portaria', 'Portaria'],
    ['estoque', 'Estoque'],
  ];
  const COLS = { portaria: ['entradas', 'log', 'config'], estoque: ['items', 'mov', 'price', 'pg', 'meta'] };
  $('#frArea').innerHTML = AREAS.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join('');
  let alvo = null; // {tipo, chave, original}
  async function desenharSub() {
    const a = $('#frArea').value, sub = $('#frSub');
    if (a === 'cx-dias') {
      const meses = [...new Set(Object.keys(lerJSON('caixa-bar', {})).map((k) => k.slice(0, 7)))].sort().reverse();
      sub.innerHTML = `<label>Mês</label><select id="frChave">${meses.map((m) => `<option value="${m}">${m.split('-').reverse().join('/')}</option>`).join('')}</select>`;
    } else if (a === 'cx-meta') {
      const ks = Object.keys(lerJSON('caixa-bar-meta', {})).sort();
      sub.innerHTML = `<label>Item</label><select id="frChave">${ks.map((k) => `<option>${esc(k)}</option>`).join('')}</select>`;
    } else {
      sub.innerHTML = `<label>Parte</label><select id="frChave">${COLS[a].map((k) => `<option>${k}</option>`).join('')}</select>`;
    }
    $('#frChave').onchange = carregar;
    await carregar();
  }
  async function carregar() {
    const a = $('#frArea').value, k = ($('#frChave') || {}).value;
    let dados = {};
    if (!k) { $('#frTxt').value = ''; alvo = null; return; }
    if (a === 'cx-dias') { const d = lerJSON('caixa-bar', {}); Object.keys(d).filter((x) => x.slice(0, 7) === k).sort().forEach((x) => (dados[x] = d[x])); }
    else if (a === 'cx-meta') dados = lerJSON('caixa-bar-meta', {})[k];
    else { const b = await window.__barExportar(); dados = ((b.apps[a] || {})[k]) || {}; }
    alvo = { a, k, original: dados };
    $('#frTxt').value = JSON.stringify(dados, null, 1);
    $('#frMsg').textContent = '';
  }
  $('#frArea').onchange = desenharSub;
  async function backupAuto() {
    const b = await window.__barExportar();
    const lista = lerJSON('bar-backup-auto', []);
    lista.unshift({ t: Date.now(), b });
    try { localStorage.setItem('bar-backup-auto', JSON.stringify(lista.slice(0, 3))); } catch (e) { localStorage.setItem('bar-backup-auto', JSON.stringify(lista.slice(0, 1))); }
  }
  let armS = false;
  $('#frSalvar').onclick = async () => {
    const msg = $('#frMsg');
    if (!alvo) { msg.textContent = 'Escolha o que editar.'; return; }
    if (!(await ehDono())) { msg.textContent = 'Somente o dono pode salvar no editor avançado.'; return; }
    let novo;
    try { novo = JSON.parse($('#frTxt').value); } catch (e) { msg.textContent = '❌ O texto tem um erro de formato (' + e.message + '). Nada foi salvo.'; return; }
    if (!armS) { armS = true; setTimeout(() => (armS = false), 6000); msg.textContent = 'Vou salvar a alteração (com backup automático antes). Toque em Salvar de novo para confirmar.'; return; }
    armS = false; msg.textContent = 'Salvando…';
    try {
      await backupAuto();
      const { a, k, original } = alvo;
      if (a === 'cx-dias') {
        if (typeof novo !== 'object' || Array.isArray(novo)) throw new Error('os fechamentos devem ser um objeto { "AAAA-MM-DD": {...} }');
        const d = lerJSON('caixa-bar', {});
        Object.keys(d).filter((x) => x.slice(0, 7) === k).forEach((x) => delete d[x]);
        Object.assign(d, novo);
        localStorage.setItem('caixa-bar', JSON.stringify(d)); recarregarAbas(['caixa']);
      } else if (a === 'cx-meta') {
        const m = lerJSON('caixa-bar-meta', {}); m[k] = novo;
        localStorage.setItem('caixa-bar-meta', JSON.stringify(m)); recarregarAbas(['caixa']);
      } else {
        if (typeof novo !== 'object' || Array.isArray(novo)) throw new Error('esta parte deve ser um objeto { "id": {...} }');
        const removidos = Object.keys(original || {}).filter((id) => !(id in novo));
        await window.__barImportar({ apps: { [a]: { [k]: novo } } });
        if (removidos.length) await window.__barApagar(a, k, removidos);
        recarregarAbas([a]);
      }
      alvo.original = novo;
      msg.textContent = '✅ Salvo. Se algo der errado, use "Restaurar backup automático".';
    } catch (e) { msg.textContent = '❌ Não salvei: ' + (e.message || e); }
  };
  let armR = false;
  $('#frAuto').onclick = async () => {
    const msg = $('#frMsg'), lista = lerJSON('bar-backup-auto', []);
    if (!lista.length) { msg.textContent = 'Ainda não há backup automático (ele é feito antes de cada salvamento no editor).'; return; }
    if (!(await ehDono())) { msg.textContent = 'Somente o dono pode restaurar.'; return; }
    const ult = lista[0];
    if (!armR) { armR = true; setTimeout(() => (armR = false), 6000); msg.textContent = 'Restaurar o backup automático de ' + new Date(ult.t).toLocaleString('pt-BR') + '? Toque de novo para confirmar.'; return; }
    armR = false;
    try {
      const cx = ult.b.apps.caixa || {}, days = {}, meta = {};
      Object.values(cx.cxdays || {}).forEach((m) => { try { Object.assign(days, JSON.parse(m.j)); } catch (e) {} });
      Object.entries(cx.cxmeta || {}).forEach(([k, v]) => { try { meta[k] = JSON.parse(v.j); } catch (e) {} });
      localStorage.setItem('caixa-bar', JSON.stringify(days)); localStorage.setItem('caixa-bar-meta', JSON.stringify(meta));
      const resto = { portaria: ult.b.apps.portaria || {}, estoque: ult.b.apps.estoque || {} };
      await window.__barImportar({ apps: resto });
      // apaga o que foi criado depois do backup
      const agora = await window.__barExportar();
      for (const app of ['portaria', 'estoque']) for (const col of COLS[app]) {
        const extra = Object.keys((agora.apps[app] || {})[col] || {}).filter((id) => !((resto[app] || {})[col] || {})[id]);
        if (extra.length) await window.__barApagar(app, col, extra);
      }
      recarregarAbas(['caixa', 'portaria', 'estoque']); await carregar();
      msg.textContent = '✅ Backup automático restaurado.';
    } catch (e) { msg.textContent = '❌ Não consegui restaurar: ' + (e.message || e); }
  };

  /* ---------------- manutenção ---------------- */
  function espaco() {
    let t = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); t += (k.length + (localStorage.getItem(k) || '').length) * 2; }
    $('#frEspaco').textContent = 'Espaço usado pelos dados neste aparelho: ' + (t / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' MB (o limite costuma ser 5 a 10 MB).';
  }
  $('#frRecarregar').onclick = () => location.reload();
  $('#frCache').onclick = async () => {
    try {
      if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
      if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
      $('#frManMsg').textContent = '✅ Cópia offline limpa. O app vai baixar tudo de novo na próxima abertura.';
    } catch (e) { $('#frManMsg').textContent = 'Não consegui limpar: ' + (e.message || e); }
  };

  // ao abrir Ajustes, atualiza as telas das ferramentas
  window.__barFerramentasAtualizar = () => { desenharAbas(); desenharTemas(); desenharIntro(); espaco(); desenharSub(); };
  aplicarAbas(); aplicarTema();
})();
