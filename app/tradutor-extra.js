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
  const gTexto = C.gato('gatoTexto');
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
  const agendar = () => { clearTimeout(tmTx); tmTx = setTimeout(traduzTexto, 350); };
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
  // 🐱 GATINHO: bichinho virtual
  // =====================================================================
  const petFala = $('#gatoPet .fala'), petImg = $('#petImg'), petFoto = $('#petFoto');
  const petDizer = (t) => { petFala.textContent = t; petImg.classList.remove('pula'); void petImg.offsetWidth; petImg.classList.add('pula'); };
  const lim = (v) => Math.max(0, Math.min(100, v));
  let pet = ler('trad-pet', { feliz: 80, barriga: 70, energia: 80, t: Date.now(), dormindo: false, acess: '' });
  function passarTempo() { // o tempo passa mesmo com o app fechado
    const h = (Date.now() - pet.t) / 36e5;
    if (h > 0) {
      pet.barriga = lim(pet.barriga - 9 * h);
      pet.feliz = lim(pet.feliz - (pet.barriga < 30 ? 12 : 6) * h);
      pet.energia = lim(pet.energia + (pet.dormindo ? 30 : -5) * h);
      if (pet.dormindo && pet.energia >= 100) pet.dormindo = false;
      pet.t = Date.now();
    }
  }
  const salvarPet = () => { pet.t = Date.now(); gravar('trad-pet', pet); };
  const xp = () => Number(localStorage.getItem('trad-xp') || 0);
  const ACESS = [
    { e: '🎀', nome: 'Laço', preco: 0, cls: 'laco' }, { e: '🕶️', nome: 'Óculos', preco: 30, cls: 'oculos' },
    { e: '🎩', nome: 'Cartola', preco: 60, cls: '' }, { e: '👑', nome: 'Coroa', preco: 120, cls: '' }, { e: '🎓', nome: 'Formatura', preco: 200, cls: '' }
  ];
  function desenharPet() {
    passarTempo();
    $('#petFeliz').style.width = pet.feliz + '%'; $('#petFome').style.width = pet.barriga + '%'; $('#petEnergia').style.width = pet.energia + '%';
    petFoto.classList.toggle('dormindo', pet.dormindo);
    let zz = $('.zz', petFoto);
    if (pet.dormindo && !zz) { zz = document.createElement('span'); zz.className = 'zz'; zz.textContent = '💤'; petFoto.appendChild(zz); }
    if (!pet.dormindo && zz) zz.remove();
    const a = ACESS.find((x) => x.e === pet.acess);
    const ac = $('#petAcess'); ac.textContent = a ? a.e : ''; ac.className = 'acess ' + (a ? a.cls : '');
    $('#petDormir').textContent = pet.dormindo ? '☀️ Acordar' : '😴 Dormir';
    $('#petNivel').textContent = 'Nível ' + (1 + Math.floor(xp() / 50)) + ' · ⭐ ' + xp();
    const loja = $('#petLoja'); loja.innerHTML = '';
    ACESS.forEach((x) => {
      const b = document.createElement('button'), livre = xp() >= x.preco;
      b.innerHTML = (livre ? x.e : '🔒') + '<small>' + x.nome + (livre ? '' : ' · ' + x.preco + '⭐') + '</small>';
      b.classList.toggle('usando', pet.acess === x.e);
      b.onclick = () => {
        if (!livre) { petDizer('Faltam ' + (x.preco - xp()) + ' ⭐ para liberar: ' + x.e + ' ' + x.nome + '. Estude na aba 📚! 💪'); return; }
        pet.acess = pet.acess === x.e ? '' : x.e; pet.feliz = lim(pet.feliz + 5); salvarPet(); desenharPet();
        if (pet.acess) { C.miau(); petDizer('Fiquei lindo! ' + x.e + ' 😻'); }
      };
      loja.appendChild(b);
    });
  }
  function humor() {
    if (pet.dormindo) return 'Zzz… 💤 (toque em ☀️ Acordar)';
    if (pet.barriga < 30) return 'Estou com fome… 🍗 miau!';
    if (pet.energia < 20) return 'Que sono… 😴';
    if (pet.feliz < 35) return 'Brinca comigo? 🧶🥺';
    return sorteia(['Miau! Estou feliz! 😺', 'Prrr… gosto de você! 💛', 'Vamos estudar juntos? 📚', 'Me faz carinho? ✋']);
  }
  function soltar(emoji, cls = 'coracao') {
    const e = document.createElement('span'); e.className = cls; e.textContent = emoji;
    e.style.left = (35 + Math.random() * 30) + '%'; e.style.top = '45%';
    petFoto.parentElement.appendChild(e); setTimeout(() => e.remove(), 1500);
  }
  const acordado = () => { if (pet.dormindo) { petDizer('Zzz… estou dormindo 💤'); return false; } return true; };
  $('#petComer').onclick = () => {
    if (!acordado()) return;
    if (pet.barriga > 92) { petDizer('Tô cheio! 😹'); return; }
    pet.barriga = lim(pet.barriga + 30); pet.feliz = lim(pet.feliz + 5); salvarPet(); desenharPet();
    soltar('🍗'); soltar('🐟'); C.miau(); petDizer(sorteia(['Nham nham! 😋', 'Que delícia! 🐟', 'Obrigado! Miau! 😺']));
  };
  $('#petBrincar').onclick = () => {
    if (!acordado()) return;
    if (pet.energia < 15) { petDizer('Estou cansado demais… 😴'); return; }
    pet.feliz = lim(pet.feliz + 20); pet.energia = lim(pet.energia - 15); pet.barriga = lim(pet.barriga - 5); salvarPet(); desenharPet();
    soltar('🧶', 'novelo'); setTimeout(() => C.miau(), 500); dancaPet(1400, false); petDizer(sorteia(['Pega o novelo! 🧶', 'Wiii! Que divertido! 😸', 'De novo, de novo! 🎉']));
  };
  function carinho() {
    if (!acordado()) return;
    pet.feliz = lim(pet.feliz + 10); salvarPet(); desenharPet();
    soltar('❤️'); setTimeout(() => soltar('💛'), 200); setTimeout(() => soltar('🐾'), 400);
    C.ronrom(1.8); petDizer(sorteia(['Prrrrr… 💛', 'Ronrom ronrom… 😻', 'Mais carinho! 🥰']));
  }
  $('#petCarinho').onclick = carinho;
  // 💃 Dançar com música: a foto dança, o cartão vira festa e saem notinhas
  let dancaTm = null;
  function dancaPet(ms, festa) {
    clearTimeout(dancaTm); petImg.classList.add('dancaPet'); C.notasDe(petImg, ms);
    const card = petFoto.closest('.pet'); if (festa) { card.classList.add('festa'); C.musiquinha(); setTimeout(() => C.musiquinha(), 1300); }
    dancaTm = setTimeout(() => { petImg.classList.remove('dancaPet'); card.classList.remove('festa'); }, ms);
  }
  $('#petDancar').onclick = () => {
    if (!acordado()) return;
    if (pet.energia < 10) { petDizer('Estou sem energia para dançar… 😴'); return; }
    pet.feliz = lim(pet.feliz + 15); pet.energia = lim(pet.energia - 10); salvarPet(); desenharPet();
    dancaPet(2800, true); petDizer(['Olha meu passinho! 💃', 'Dança, gatinho, dança! 🎶', 'Uhuu! Festa! 🎉'][Math.floor(Math.random() * 3)]);
  };
  petImg.onclick = carinho;
  $('#petDormir').onclick = () => {
    pet.dormindo = !pet.dormindo; salvarPet(); desenharPet();
    petDizer(pet.dormindo ? 'Boa noite… 💤' : 'Bom dia! ☀️ Miau!'); if (!pet.dormindo) C.miau();
  };
  let petTm = null;
  C.ganchosAba.gato = () => { desenharPet(); petDizer(humor()); clearInterval(petTm); petTm = setInterval(() => { if ($('#gato').classList.contains('on')) desenharPet(); else clearInterval(petTm); }, 30000); mostrarMiau(); };

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
  C.ganchosAba.ajustes = () => { mostrarAjustes(); setTimeout(() => gAj.dizer('Aqui você deixa o app do seu jeito! ⚙️'), 200); };

  // Gatinho da tela inicial também comenta quando volta para ela
  C.ganchosAba.inicio = () => {};
})();
