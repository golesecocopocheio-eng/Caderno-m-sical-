/* Clã Speak · abas Texto (tradutor de texto), Gatinho (bichinho virtual + miado gravado) e Ajustes. */
(() => {
  'use strict';
  const C = window.ClaSpeak;
  if (!C) return;
  const $ = (s, r = document) => r.querySelector(s);
  const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? padrao : v; } catch (e) { return padrao; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const sorteia = (l) => l[Math.floor(Math.random() * l.length)];

  // =====================================================================
  // ✍️ TEXTO: traduz enquanto digita, ditado, favoritas e recentes
  // =====================================================================
  const gTexto = C.gatoInicio; // o tradutor de texto agora fica na aba Traduzir
  const de = $('#txDe'), para = $('#txPara'), ent = $('#txEntrada'), saida = $('#txSaida');
  C.preencher(de, localStorage.getItem('trad-tx-de') || C.minhaLingua());
  C.preencher(para, localStorage.getItem('trad-tx-para') || (C.minhaLingua().startsWith('en') ? 'pt-BR' : 'en-US'));
  let tmTx = null, tmHist = null, ultimaTrad = '', ultDanca = 0;
  async function traduzTexto() {
    const t = ent.value.trim();
    if (!t) { saida.textContent = ''; ultimaTrad = ''; return; }
    saida.style.opacity = '.5';
    const r = await C.traduzir(t, de.value, para.value);
    if (ent.value.trim() !== t) return; // já mudou
    saida.textContent = r; saida.style.opacity = '1'; ultimaTrad = r;
    if (Date.now() - ultDanca > 4000) { ultDanca = Date.now(); gTexto.dancar(1200); }
    clearTimeout(tmHist); tmHist = setTimeout(() => guardarHist(t, r), 1500);
  }
  const agendar = () => { clearTimeout(tmTx); tmTx = setTimeout(traduzTexto, C.motor.ativo ? 1100 : 350); };
  ent.addEventListener('input', agendar);
  de.onchange = () => { localStorage.setItem('trad-tx-de', de.value); agendar(); };
  para.onchange = () => { localStorage.setItem('trad-tx-para', para.value); agendar(); gTexto.dizer('Agora em ' + C.bandeira(para.value) + ' ' + C.nomeLingua(para.value) + '!'); };
  $('#txTroca').onclick = () => {
    const a = de.value; de.value = para.value; para.value = a;
    localStorage.setItem('trad-tx-de', de.value); localStorage.setItem('trad-tx-para', para.value);
    if (ultimaTrad) ent.value = ultimaTrad;
    traduzTexto();
  };
  $('#txLimpar').onclick = () => { ent.value = ''; saida.textContent = ''; ultimaTrad = ''; ent.focus(); };
  $('#txOuvir').onclick = () => { if (ultimaTrad) C.falar(ultimaTrad, para.value, { sempre: true }); else gTexto.dizer('Escreva algo primeiro! ✍️'); };
  $('#txCopiar').onclick = () => {
    if (!ultimaTrad) return;
    (navigator.clipboard ? navigator.clipboard.writeText(ultimaTrad) : Promise.reject()).then(() => gTexto.dizer('Copiado! 📋')).catch(() => prompt('Copie:', ultimaTrad));
  };

  // Ditado: fala no idioma de origem e o texto vai aparecendo
  const ditar = $('#txDitar'), txOnda = $('#txOnda');
  ditar.onclick = () => {
    if (C.ouvinte.ativo) { C.ouvinte.parar(); return; }
    const base = ent.value ? ent.value.replace(/\s*$/, ' ') : '';
    let feito = base;
    const ok = C.ouvinte.iniciar(de.value, {
      parcial: (t) => { ent.value = feito + t; if (t) { txOnda.classList.add('forte'); setTimeout(() => txOnda.classList.remove('forte'), 400); } },
      final: (t) => { feito = (feito + C.arrumar(t)).replace(/\s*$/, ' '); ent.value = feito; traduzTexto(); },
      erro: (m) => gTexto.dizer(m),
      fim: () => { ditar.textContent = '🎤 Ditar'; txOnda.classList.remove('on'); gTexto.ouvindo(false); }
    });
    if (ok) { ditar.textContent = '⏹ Parar'; txOnda.classList.add('on'); gTexto.ouvindo(true); gTexto.dizer('Pode falar em ' + C.nomeLingua(de.value) + '! 👂'); }
  };

  // Recentes e favoritas
  function item(reg, onRemover) {
    const d = document.createElement('div'); d.className = 'item';
    d.innerHTML = '<small>' + C.bandeira(reg.de) + ' → ' + C.bandeira(reg.para) + ' ' + C.esc(reg.orig) + '</small>' + C.esc(reg.trad);
    d.onclick = () => { de.value = reg.de; para.value = reg.para; ent.value = reg.orig; saida.textContent = reg.trad; ultimaTrad = reg.trad; window.scrollTo(0, 0); $('#texto .rolavel').scrollTop = 0; };
    if (onRemover) {
      const x = document.createElement('button'); x.textContent = '✖'; x.className = 'sec'; x.style.cssText = 'float:right;padding:2px 8px;margin-left:6px';
      x.onclick = (e) => { e.stopPropagation(); onRemover(); }; d.prepend(x);
    }
    return d;
  }
  function mostrarListas() {
    const hist = ler('trad-hist', []), favs = ler('trad-favs', []);
    const h = $('#txHist'); h.innerHTML = ''; hist.forEach((r) => h.appendChild(item(r)));
    const f = $('#txFavs'); f.innerHTML = '';
    favs.forEach((r, i) => f.appendChild(item(r, () => { const l = ler('trad-favs', []); l.splice(i, 1); gravar('trad-favs', l); mostrarListas(); })));
    $('#txFavsVazio').hidden = favs.length > 0;
  }
  function guardarHist(orig, trad) {
    const l = ler('trad-hist', []).filter((r) => !(r.orig === orig && r.para === para.value));
    l.unshift({ de: de.value, para: para.value, orig, trad });
    gravar('trad-hist', l.slice(0, 20)); mostrarListas();
  }
  $('#txFav').onclick = () => {
    const orig = ent.value.trim(); if (!orig || !ultimaTrad) return;
    const l = ler('trad-favs', []);
    if (!l.some((r) => r.orig === orig && r.para === para.value)) l.unshift({ de: de.value, para: para.value, orig, trad: ultimaTrad });
    gravar('trad-favs', l.slice(0, 50)); mostrarListas(); C.miau(); gTexto.pular(); gTexto.dizer('Guardei nas favoritas! ⭐');
  };
  mostrarListas();
  C.ganchosAba.texto = () => {
    if (!localStorage.getItem('trad-tx-de')) { de.value = C.minhaLingua(); para.value = C.minhaLingua().startsWith('en') ? 'pt-BR' : 'en-US'; }
    mostrarListas(); setTimeout(() => gTexto.dizer(sorteia(['Escreva que eu traduzo na hora! ✍️', 'Pode ditar no 🎤 também!', 'Toque em ⇄ para inverter os idiomas.'])), 300); };

  // =====================================================================
  // 🎙️ Miado de verdade (fica nos Ajustes)
  // =====================================================================
  function petDizer(t) { gAj.dizer(t); }
  // Miado de verdade: gravar ou escolher um áudio
  const MAX = 700 * 1024;
  function mostrarMiau() { $('#miauInfo').textContent = localStorage.getItem('trad-miau') ? '✅ Usando o miado gravado.' : 'Usando o miado padrão do app.'; }
  function guardarMiau(blob) {
    if (blob.size > MAX) { petDizer('Esse áudio é grande demais 🙀 Use um de até 5 segundos.'); return; }
    const fr = new FileReader();
    fr.onload = () => {
      try { localStorage.setItem('trad-miau', fr.result); mostrarMiau(); C.miau(true); petDizer('Esse é meu miado agora! 😻'); }
      catch (e) { petDizer('Não coube na memória do app 🙀 Tente um áudio menor.'); }
    };
    fr.readAsDataURL(blob);
  }
  let gravador = null;
  $('#miauGravar').onclick = async () => {
    const bt = $('#miauGravar');
    if (gravador) { gravador.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { petDizer('Aqui não dá para gravar 🙀 Use 📁 Escolher áudio.'); return; }
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
      const partes = []; gravador = new MediaRecorder(st);
      gravador.ondataavailable = (e) => e.data.size && partes.push(e.data);
      gravador.onstop = () => { st.getTracks().forEach((t) => t.stop()); gravador = null; bt.textContent = '⏺ Gravar'; guardarMiau(new Blob(partes, { type: partes[0] ? partes[0].type : 'audio/webm' })); };
      gravador.start(); bt.textContent = '⏹ Parar';
      petDizer('Gravando! Faça seu gato miar 🎙️ (até 4 s)');
      setTimeout(() => gravador && gravador.state === 'recording' && gravador.stop(), 4000);
    } catch (e) { gravador = null; petDizer('Não consegui usar o microfone 🙀 Use 📁 Escolher áudio.'); }
  };
  $('#miauArquivo').onclick = () => $('#miauInput').click();
  $('#miauInput').onchange = (e) => { const f = e.target.files[0]; if (f) guardarMiau(f); e.target.value = ''; };
  $('#miauTestar').onclick = () => C.miau(true);
  $('#miauPadrao').onclick = () => { localStorage.removeItem('trad-miau'); mostrarMiau(); C.miau(true); petDizer('Voltei ao miado padrão! 😺'); };

  // =====================================================================
  // ⚙️ AJUSTES
  // =====================================================================
  const gAj = C.gato('gatoAjustes');
  if (localStorage.getItem('trad-grande') === '1') document.body.classList.add('grande');
  function mostrarAjustes() {
    $('#ajSegurar').checked = C.segurar; $('#ajFone').checked = C.fone;
    $('#ajVel').value = C.velVoz; $('#ajVelTx').textContent = Number(C.velVoz).toFixed(1) + '×';
    $('#ajVoz').checked = C.vozLigada; $('#ajSons').checked = C.sons;
    $('#ajGrande').checked = document.body.classList.contains('grande');
    $('#ajCacheTx').textContent = C.cacheInfo() + ' traduções guardadas no aparelho (deixam o app mais rápido).';
  }
  $('#ajSegurar').onchange = (e) => { C.segurar = e.target.checked; gAj.dizer(e.target.checked ? 'Agora é segurar o 🎤 para falar e soltar para enviar!' : 'Agora é tocar no 🎤 para ligar e desligar.'); };
  $('#ajFone').onchange = (e) => { C.definirFone(e.target.checked); gAj.dizer(e.target.checked ? '🎧 Modo fone ligado!' : 'Modo fone desligado.'); };
  $('#ajVel').oninput = (e) => { C.velVoz = Number(e.target.value); $('#ajVelTx').textContent = Number(e.target.value).toFixed(1) + '×'; };
  $('#ajVoz').onchange = (e) => { C.vozLigada = e.target.checked; $('#btVoz').textContent = e.target.checked ? '🔊' : '🔇'; };
  $('#ajSons').onchange = (e) => { C.sons = e.target.checked; if (e.target.checked) { C.miau(); gAj.dancar(1500, true); } gAj.dizer(e.target.checked ? 'Miau! Sons ligados 🔊' : 'Shhh… sons desligados 🤫'); };
  $('#ajGrande').onchange = (e) => { document.body.classList.toggle('grande', e.target.checked); localStorage.setItem('trad-grande', e.target.checked ? '1' : '0'); };
  $('#ajTestar').onclick = async () => { const t = await C.traduzir('Olá! Eu sou o gatinho do Clã Speak.', 'pt-BR', C.minhaLingua()); C.falar(t, C.minhaLingua(), { sempre: true }); };
  $('#ajLimpar').onclick = () => { if (confirm('Apagar as traduções guardadas? (o app fica um pouco mais lento até guardar de novo)')) { C.limparCache(); mostrarAjustes(); gAj.dizer('Pronto, limpei! 🧹'); } };
  // Motor de tradução (Padrão / Executivo)
  function mostrarMotor() {
    $('#ajMotor').value = C.motor.tipo; $('#ajChave').value = C.motor.chave;
    $('#ajSetor').value = C.motor.setor; $('#ajRegistro').value = C.motor.registro;
    $('#ajExecutivo').hidden = C.motor.tipo !== 'executivo';
    $('#ajMotorStatus').textContent = C.motor.tipo === 'executivo' ? (C.motor.chave ? 'Modo Executivo ativo.' : 'Informe a chave da API para ativar o Modo Executivo.') : '';
  }
  $('#ajMotor').onchange = (e) => { localStorage.setItem('trad-motor', e.target.value); mostrarMotor(); };
  $('#ajChave').onchange = (e) => { localStorage.setItem('trad-api-key', e.target.value.trim()); mostrarMotor(); };
  $('#ajVerChave').onclick = () => { const i = $('#ajChave'); i.type = i.type === 'password' ? 'text' : 'password'; $('#ajVerChave').textContent = i.type === 'password' ? 'Mostrar' : 'Ocultar'; };
  $('#ajSetor').onchange = (e) => localStorage.setItem('trad-setor', e.target.value);
  $('#ajRegistro').onchange = (e) => localStorage.setItem('trad-registro', e.target.value);
  $('#ajTestarMotor').onclick = async () => {
    localStorage.setItem('trad-api-key', $('#ajChave').value.trim());
    if (!C.motor.chave) { $('#ajMotorStatus').textContent = 'Informe a chave da API.'; return; }
    $('#ajMotorStatus').textContent = 'Testando…';
    try { const r = await C.testarExecutivo('O relatório trimestral foi aprovado pela diretoria.'); $('#ajMotorStatus').textContent = 'Conexão OK. Exemplo: ' + r; }
    catch (e) { $('#ajMotorStatus').textContent = 'Falha na conexão: ' + ((e && (e.status ? e.status + ' ' : '') + (e.message || '')) || 'erro desconhecido') + '. Confira a chave e a internet.'; }
  };
  mostrarMotor();
  // ----- Rapidez para fechar a frase + diagnóstico de voz (tempos reais) -----
  const ajResp = $('#ajResposta');
  if (ajResp) { ajResp.value = localStorage.getItem('trad-resposta') || 'equilibrada'; ajResp.onchange = () => localStorage.setItem('trad-resposta', ajResp.value); }
  const seg = (ms) => (ms == null ? '—' : (ms / 1000).toFixed(2).replace('.', ',') + ' s');
  function mostrarDiag() {
    const M = C.vozCtl.medidas, res = $('#diagResumo'), lista = $('#diagLista');
    if (!res) return;
    if (!M.length) { res.textContent = 'Ainda não há medidas. Use o frente a frente e volte aqui.'; lista.innerHTML = ''; return; }
    const media = (k) => { const v = M.map((m) => m[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    res.innerHTML = M.length + ' frases · média: tradução <b>' + seg(media('traducao')) + '</b> · da frase fechada até a voz <b>' + seg(media('total')) + '</b>';
    lista.innerHTML = '<div class="cab"><span>Fala</span><span>Tradução</span><span>Até a voz</span><span>Voz</span></div>' +
      M.slice(-8).reverse().map((m) => '<div><span>' + seg(m.fala) + '</span><span>' + seg(m.traducao) + '</span><span>' + seg(m.total) + '</span><span>' + seg(m.voz) + '</span></div>').join('');
  }
  const diagL = $('#diagLimpar'); if (diagL) diagL.onclick = () => { C.vozCtl.limparMedidas(); mostrarDiag(); };
  C.ganchosAba.ajustes = () => { mostrarMotor(); mostrarAjustes(); mostrarMiau(); mostrarDiag(); setTimeout(() => gAj.dizer('Aqui você deixa o app do seu jeito! ⚙️'), 200); };

  // Gatinho da tela inicial também comenta quando volta para ela
  C.ganchosAba.inicio = () => {};
})();
