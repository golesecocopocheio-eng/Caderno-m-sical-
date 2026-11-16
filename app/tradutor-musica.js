/* Clã Speak · aba 🎶 Música: músicas de reggae originais (letra e batida do próprio app),
 * letra no estilo karaokê com tradução, o gatinho canta (voz do aparelho) e dança no palco,
 * fazendo um gesto a cada linha e miando quando a letra diz "miau". */
(() => {
  'use strict';
  const C = window.ClaSpeak;
  if (!C) return;
  const $ = (s, r = document) => r.querySelector(s);

  // Letras originais do Clã Speak. Cada linha dura 2 compassos (6 s); g = gesto do gatinho.
  const MUSICAS = [
    { nome: 'Miau Reggae', ico: '🐱', linhas: [
      ['Acordei cedo com o sol na janela', 'aceno'], ['Meu gorro colorido, a vida é tão bela', 'gira'],
      ['Mexe o rabinho, sente o balanço', 'danca'], ['No ritmo do reggae eu nunca me canso', 'pulo'],
      ['Miau, miau, good vibes no ar', 'miau'], ['Todo mundo junto pode dançar', 'aponta'],
      ['Miau, miau, paz e amor', 'miau'], ['O gatinho rasta canta com calor', 'coracao']] },
    { nome: 'Clã da Paz', ico: '☮️', linhas: [
      ['Fala comigo em qualquer idioma', 'aceno'], ['O gatinho traduz e a conversa ecoa', 'aponta'],
      ['Do Brasil ao Japão, da Jamaica ao Peru', 'gira'], ['Tem miau pra mim e tem miau pra tu', 'miau'],
      ['Somos o Clã, o Clã da Paz', 'pulo'], ['Uma só família, ninguém fica pra trás', 'coracao'],
      ['Levanta a patinha e canta comigo', 'aceno'], ['Quem fala outra língua também é amigo', 'coracao']] },
    { nome: 'Patinhas no Chão', ico: '🐾', linhas: [
      ['Uma patinha pra frente, outra pra trás', 'aponta'], ['Gira o corpinho e balança demais', 'gira'],
      ['O tambor faz bum, a guitarra faz tchá', 'pulo'], ['O gatinho rasta não para de dançar', 'danca'],
      ['Patinhas no chão, coração no céu', 'coracao'], ['Dança comigo debaixo do chapéu', 'aceno'],
      ['Miau no começo, miau no final', 'miau'], ['Essa festa de gato é sensacional', 'pulo']] }
  ];
  const BAR = 3000, INTRO = 1, POR_LINHA = 2, FIM = 1;

  const pista = $('#mPista'), ator = $('#mAtor'), vira = $('#mVira'), corpo = $('#mCorpo'), gesto = $('#mGesto'), balao = $('#mBalao');
  const linguaSel = $('#mLingua');
  C.preencher(linguaSel, localStorage.getItem('trad-m-lingua') || (C.minhaLingua().startsWith('pt') ? 'en-US' : C.minhaLingua()));

  // ---------- Gatinho no palco ----------
  let pos = 50;
  function irPara(p) { vira.classList.toggle('esq', p < pos); ator.style.transitionDuration = '1.2s'; ator.style.left = 'calc(' + p + '% - 32px)'; pos = p; }
  function golpe(cls, ms = 900) { // gesto de uma vez; a dança volta depois
    const dancava = corpo.classList.contains('danca');
    corpo.classList.remove('aceno', 'aponta', 'gira', 'pulo', 'batida', 'danca'); void corpo.offsetWidth; corpo.classList.add(cls);
    setTimeout(() => { corpo.classList.remove(cls); if (dancava && tocando) corpo.classList.add('danca'); }, ms);
  }
  function emoji(e) {
    gesto.textContent = e; const r = ator.getBoundingClientRect(), pr = pista.getBoundingClientRect();
    gesto.style.left = (r.left - pr.left + r.width * 0.75) + 'px'; gesto.style.top = (r.top - pr.top + 10) + 'px';
    gesto.classList.remove('on'); void gesto.offsetWidth; gesto.classList.add('on');
  }
  function dizer(t, ms = 1800) { balao.textContent = t; balao.classList.add('on'); clearTimeout(dizer.tm); dizer.tm = setTimeout(() => balao.classList.remove('on'), ms); }
  const GESTOS = {
    aceno: () => { golpe('aceno'); emoji('👋'); },
    aponta: () => { golpe('aponta'); emoji('👉'); },
    gira: () => { golpe('gira'); emoji('💫'); },
    pulo: () => { golpe('pulo', 800); emoji('⭐'); },
    danca: () => { emoji('🎶'); },
    coracao: () => { emoji('💛'); C.notasDe(corpo, 1500); },
    miau: () => { C.miau(); dizer('Miau! 😺'); emoji('🐾'); golpe('pulo', 800); }
  };
  ator.onclick = () => { C.miau(true); dizer('Miau! 🎶'); golpe('gira'); };

  // ---------- Letra ----------
  let atual = null, tocando = false, linhaAtual = 0, timers = [], pararSom = null, inicio = 0, traducoes = [];
  const letra = $('#mLetra');
  async function abrir(i) {
    parar();
    atual = MUSICAS[i]; linhaAtual = 0;
    document.querySelectorAll('#mLista button').forEach((b, k) => b.classList.toggle('on', k === i));
    $('#mTitulo').textContent = atual.ico + ' ' + atual.nome; $('#mProg').style.width = '0';
    letra.innerHTML = atual.linhas.map(([t], k) => '<div class="linha" data-k="' + k + '"><div class="orig">' +
      t.split(' ').map((w) => '<span>' + C.esc(w) + '</span>').join(' ') + '</div><div class="trad">…</div></div>').join('');
    await traduzirLetra();
  }
  async function traduzirLetra() {
    if (!atual) return;
    const m = atual;
    traducoes = await C.traduzirVarias(m.linhas.map((l) => l[0]), 'pt-BR', linguaSel.value);
    if (atual !== m) return;
    letra.querySelectorAll('.trad').forEach((el, k) => { el.textContent = C.codTrad(linguaSel.value) === 'pt' ? '' : traducoes[k]; });
  }
  linguaSel.onchange = () => { localStorage.setItem('trad-m-lingua', linguaSel.value); traduzirLetra(); dizer(C.bandeira(linguaSel.value) + ' ' + C.nomeLingua(linguaSel.value)); };

  function mostrarLinha(k) {
    linhaAtual = k;
    letra.querySelectorAll('.linha').forEach((el, j) => { el.classList.toggle('on', j === k); el.classList.toggle('foi', j < k); });
    const el = letra.querySelector('.linha[data-k="' + k + '"]'); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // as palavras acendem ao longo de ~4,5 s
    const ws = el.querySelectorAll('.orig span'); ws.forEach((w) => w.classList.remove('lit'));
    ws.forEach((w, j) => timers.push(setTimeout(() => w.classList.add('lit'), (j / ws.length) * 4500)));
    const [texto, g] = atual.linhas[k];
    (GESTOS[g] || GESTOS.danca)();
    if (/miau/i.test(texto) && g !== 'miau') setTimeout(() => C.miau(), 600);
    irPara(25 + Math.random() * 50);
  }

  // ---------- Tocar / pausar ----------
  function tocar() {
    if (!atual) { abrir(0).then(tocar); return; }
    if (!C.sons) { dizer('Ligue os sons nos ⚙️ Ajustes 🔇', 2500); return; }
    tocando = true; $('#mPlay').textContent = '⏸';
    const de = linhaAtual >= atual.linhas.length ? 0 : linhaAtual;
    const compassos = INTRO + (atual.linhas.length - de) * POR_LINHA + FIM;
    pararSom = C.reggae(compassos, () => { if (tocando) acabou(); });
    inicio = performance.now() + 50;
    corpo.classList.add('danca'); pista.classList.add('festa');
    dizer(de ? 'Continuando… 🎶' : '🎶 ' + atual.nome + '!', 2200);
    for (let k = de; k < atual.linhas.length; k++) timers.push(setTimeout(() => mostrarLinha(k), (INTRO + (k - de) * POR_LINHA) * BAR + 50));
    for (let b = 0; b < compassos; b++) timers.push(setTimeout(() => golpe('batida', 260), b * BAR + 1550)); // one drop
    const total = compassos * BAR, base = de / atual.linhas.length;
    timers.push(setInterval(() => { const f = Math.min(1, (performance.now() - inicio) / total); $('#mProg').style.width = ((base + (1 - base) * f) * 100) + '%'; }, 250));
  }
  function parar() {
    tocando = false; timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
    pararSom && pararSom(); pararSom = null;
    corpo.classList.remove('danca'); pista.classList.remove('festa'); $('#mPlay').textContent = '▶';
  }
  function acabou() {
    parar(); linhaAtual = atual.linhas.length; $('#mProg').style.width = '100%';
    letra.querySelectorAll('.linha').forEach((el) => { el.classList.remove('on'); el.classList.add('foi'); });
    C.miau(); dizer('Valeu! Miau! 🎉', 2500); golpe('gira');
  }
  $('#mPlay').onclick = () => (tocando ? parar() : tocar());

  // Lista de músicas
  MUSICAS.forEach((m, i) => {
    const b = document.createElement('button');
    b.innerHTML = m.ico + ' ' + C.esc(m.nome) + '<small>' + m.linhas.length + ' versos · reggae</small>';
    b.onclick = () => abrir(i).then(tocar);
    $('#mLista').appendChild(b);
  });

  // Sai da aba: para a música. Entra: o gatinho cumprimenta.
  document.querySelectorAll('#abas button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.aba !== 'musica' && tocando) parar(); }));
  C.ganchosAba.musica = () => { if (!atual) abrir(0); setTimeout(() => { dizer('Bora ouvir um reggae? 🎶'); golpe('aceno'); emoji('👋'); }, 300); };
  // O botão da aba Gatinho agora leva para cá
  const bt = $('#petSom'); if (bt) bt.onclick = () => C.mostrarTela('musica');
})();

/* ---------- 🎬 Treinar com YouTube (player oficial incorporado) ---------- */
(() => {
  'use strict';
  const C = window.ClaSpeak;
  if (!C) return;
  const $ = (s, r = document) => r.querySelector(s);
  const info = (t) => { $('#ytInfo').textContent = t; };
  const balao = (t) => { const b = $('#mBalao'); b.textContent = t; b.classList.add('on'); clearTimeout(balao.tm); balao.tm = setTimeout(() => b.classList.remove('on'), 2200); };
  C.preencher($('#ytDe'), localStorage.getItem('trad-yt-de') || 'en-US');
  $('#ytDe').onchange = () => { localStorage.setItem('trad-yt-de', $('#ytDe').value); traduzFrase(); };
  $('#ytLink').value = localStorage.getItem('trad-yt-link') || '';

  // Pega o código do vídeo de youtu.be/…, watch?v=…, /shorts/…, /embed/…
  function idDo(link) {
    const m = String(link).trim().match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/) || String(link).trim().match(/^([A-Za-z0-9_-]{11})$/);
    return m ? m[1] : null;
  }
  let player = null, api = null, idAtual = null, A = null, B = null, loop = false, loopTm = null, vel = 1;
  function carregarApi() {
    if (api) return api;
    api = new Promise((ok, err) => {
      if (window.YT && window.YT.Player) return ok();
      window.onYouTubeIframeAPIReady = ok;
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = err; document.head.appendChild(s);
      setTimeout(() => err(new Error('tempo')), 8000);
    });
    api.catch(() => { api = null; });
    return api;
  }
  function abrirFora() { return 'https://www.youtube.com/watch?v=' + idAtual; }
  function erroVideo(cod) {
    const msg = (cod === 101 || cod === 150 || cod === 153)
      ? 'Este vídeo não deixa tocar fora do YouTube (o dono bloqueou). Abra no YouTube e treine as frases aqui embaixo.'
      : 'Não consegui tocar este vídeo aqui.';
    info(msg); $('#ytCtl').hidden = true;
    const a = $('#ytBuscar'); a.href = abrirFora(); a.textContent = '▶ Abrir no YouTube';
  }
  async function abrir() {
    const id = idDo($('#ytLink').value);
    if (!id) { info('Cole um link do YouTube válido (ex.: https://youtu.be/…)'); return; }
    idAtual = id; localStorage.setItem('trad-yt-link', $('#ytLink').value.trim());
    $('#ytBox').hidden = false; info('Carregando o vídeo…');
    try {
      await carregarApi();
      if (player) { player.loadVideoById(id); player.setPlaybackRate(vel); }
      else player = new YT.Player('ytPlayer', {
        videoId: id, host: 'https://www.youtube-nocookie.com',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
        events: { onReady: () => { info('Pronto! Use ⏪, 🐢 e A/B + 🔁 para treinar um trecho.'); $('#ytCtl').hidden = false; }, onError: (e) => erroVideo(e.data) }
      });
      if (player && player.getIframe) { const f = player.getIframe(); f && f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin'); }
      $('#ytCtl').hidden = false;
      const a = $('#ytBuscar'); a.href = abrirFora(); a.textContent = '▶ Abrir no YouTube';
    } catch (e) {
      // sem a API: mostra o player simples do YouTube (sem os botões de treino)
      $('#ytBox').innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
      $('#ytCtl').hidden = true; info('Vídeo carregado (sem os botões de treino nesta conexão).');
    }
  }
  $('#ytCarregar').onclick = abrir;
  $('#ytLink').addEventListener('keydown', (e) => { if (e.key === 'Enter') abrir(); });

  const ok = () => player && player.getCurrentTime;
  $('#ytVolta').onclick = () => { if (ok()) player.seekTo(Math.max(0, player.getCurrentTime() - 5), true); };
  $('#ytTocar').onclick = () => { if (!ok()) return; player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo(); };
  $('#ytVel').onclick = () => { if (!ok()) return; vel = vel === 1 ? 0.75 : vel === 0.75 ? 0.5 : 1; player.setPlaybackRate(vel); $('#ytVel').textContent = '🐢 ' + vel + '×'; balao(vel < 1 ? 'Mais devagar 🐢' : 'Velocidade normal'); };
  const fmt = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  $('#ytA').onclick = () => { if (!ok()) return; A = player.getCurrentTime(); $('#ytA').textContent = 'A ' + fmt(A); $('#ytA').classList.add('ligado'); };
  $('#ytB').onclick = () => { if (!ok()) return; B = player.getCurrentTime(); $('#ytB').textContent = 'B ' + fmt(B); $('#ytB').classList.add('ligado'); };
  $('#ytLoop').onclick = () => {
    if (!ok()) return;
    if (A == null || B == null || B <= A) { info('Marque o começo (A) e o fim (B) do trecho enquanto o vídeo toca.'); return; }
    loop = !loop; $('#ytLoop').classList.toggle('ligado', loop); clearInterval(loopTm);
    if (loop) { player.seekTo(A, true); player.playVideo(); loopTm = setInterval(() => { if (player.getCurrentTime() >= B) player.seekTo(A, true); }, 200); balao('Repetindo o trecho 🔁'); }
  };

  // Frase que a pessoa ouviu: tradução, ouvir e repetir com conferência
  let tmF = null, tradF = '';
  async function traduzFrase() {
    const t = $('#ytFrase').value.trim(); const busca = $('#ytBuscar');
    if (!idAtual) busca.href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent((t || 'música para aprender ' + C.nomeLingua($('#ytDe').value)) + ' lyrics');
    if (!t) { $('#ytTrad').textContent = ''; tradF = ''; return; }
    tradF = await C.traduzir(t, $('#ytDe').value, C.minhaLingua());
    if ($('#ytFrase').value.trim() === t) $('#ytTrad').textContent = tradF;
  }
  $('#ytFrase').addEventListener('input', () => { clearTimeout(tmF); tmF = setTimeout(traduzFrase, 400); });
  traduzFrase();
  $('#ytOuvir').onclick = () => { const t = $('#ytFrase').value.trim(); if (t) { if (ok()) player.pauseVideo(); C.falar(t, $('#ytDe').value, { sempre: true, vel: 0.9 }); } };
  const normal = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  function parecido(a, b) {
    a = normal(a); b = normal(b); if (!a || !b) return 0;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
  }
  $('#ytRepetir').onclick = () => {
    const alvo = $('#ytFrase').value.trim(); if (!alvo) { balao('Escreva a frase primeiro ✍️'); return; }
    if (C.ouvinte.ativo) { C.ouvinte.parar(); return; }
    if (ok()) player.pauseVideo();
    const okM = C.ouvinte.iniciar($('#ytDe').value, {
      parcial: (t) => { $('#ytOuvi').textContent = '👂 ' + (t || 'Pode falar…'); },
      final: (t) => {
        C.ouvinte.parar(); const n = parecido(t, alvo);
        $('#ytOuvi').textContent = '👂 Ouvi: “' + t + '”';
        if (n >= 0.75) { C.miau(); balao(n > 0.92 ? 'Perfeito! 😺🎉' : 'Muito bem! 😺'); } else balao('Quase! Tente de novo 💪');
      },
      erro: (m) => balao(m),
      fim: () => { $('#ytRepetir').textContent = '🎤 Repetir'; }
    });
    if (okM) $('#ytRepetir').textContent = '⏹ Parar';
  };
  // Saiu da aba Música: pausa o vídeo
  document.querySelectorAll('#abas button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.aba !== 'musica' && ok()) { player.pauseVideo(); clearInterval(loopTm); loop = false; $('#ytLoop').classList.remove('ligado'); } }));
})();
