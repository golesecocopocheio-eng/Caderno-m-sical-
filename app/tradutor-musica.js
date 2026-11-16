/* Clã Speak · aba 🎤 Karaokê: vídeo do YouTube pelo player oficial incorporado (nada é baixado)
 * + letra colada pela pessoa, traduzida verso por verso, que anda junto com o vídeo como karaokê.
 * O tempo de cada verso é marcado tocando no botão (ou distribuído automaticamente) e fica
 * guardado para aquele vídeo. "Cantar junto" ouve a pessoa e dá estrelas para cada verso. */
(() => {
  'use strict';
  const C = window.ClaSpeak;
  if (!C) return;
  const $ = (s, r = document) => r.querySelector(s);
  const gato = C.gato('gatoKara');
  const emo = (t) => window.ClaSpeakEmocao && window.ClaSpeakEmocao(t, $('#gatoKara img'));
  const info = (t) => { $('#ytInfo').textContent = t; };

  // ---------- Idiomas ----------
  C.preencher($('#kIdioma'), localStorage.getItem('trad-k-idioma') || 'en-US');
  C.preencher($('#kTrad'), localStorage.getItem('trad-k-trad') || C.minhaLingua());

  // ---------- Player do YouTube ----------
  const idDo = (link) => { const m = String(link).trim().match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/) || String(link).trim().match(/^([A-Za-z0-9_-]{11})$/); return m ? m[1] : null; };
  let player = null, api = null, idAtual = null, A = null, B = null, loop = false, loopTm = null, vel = 1;
  const ok = () => player && player.getCurrentTime;
  function carregarApi() {
    if (api) return api;
    api = new Promise((res, err) => {
      if (window.YT && window.YT.Player) return res();
      window.onYouTubeIframeAPIReady = res;
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = err; document.head.appendChild(s);
      setTimeout(() => err(new Error('tempo')), 8000);
    });
    api.catch(() => { api = null; });
    return api;
  }
  function erroVideo(cod) {
    info((cod === 101 || cod === 150 || cod === 153)
      ? 'O dono deste vídeo não deixa tocar fora do YouTube. Abra no YouTube e use ◀ ▶ para acompanhar a letra aqui.'
      : 'Não consegui tocar este vídeo aqui.');
    $('#ytCtl').hidden = true; $('#ytFora').hidden = false;
  }
  async function abrir() {
    const id = idDo($('#ytLink').value);
    if (!id) { info('Cole um link do YouTube válido (ex.: https://youtu.be/…)'); return; }
    idAtual = id; localStorage.setItem('trad-yt-link', $('#ytLink').value.trim());
    $('#ytFora').href = 'https://www.youtube.com/watch?v=' + id; $('#ytFora').hidden = true;
    $('#ytBox').hidden = false; info('Carregando o vídeo…');
    carregarLetraSalva();
    try {
      await carregarApi();
      if (player && player.loadVideoById) { player.loadVideoById(id); player.setPlaybackRate(vel); $('#ytCtl').hidden = false; }
      else player = new YT.Player('ytPlayer', {
        videoId: id, host: 'https://www.youtube-nocookie.com',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
        events: { onReady: () => { info('Pronto! ▶ Toque play no vídeo e acompanhe a letra.'); $('#ytCtl').hidden = false; }, onError: (e) => erroVideo(e.data) }
      });
    } catch (e) {
      $('#ytBox').innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
      $('#ytCtl').hidden = true; $('#ytFora').hidden = false;
      info('Vídeo carregado sem os controles do app: use ◀ ▶ para acompanhar a letra.');
    }
  }
  $('#ytCarregar').onclick = abrir;
  $('#ytLink').addEventListener('keydown', (e) => { if (e.key === 'Enter') abrir(); });
  $('#ytVolta').onclick = () => { if (ok()) player.seekTo(Math.max(0, player.getCurrentTime() - 5), true); };
  $('#ytTocar').onclick = () => { if (ok()) (player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo()); };
  $('#ytVel').onclick = () => { if (!ok()) return; vel = vel === 1 ? 0.75 : vel === 0.75 ? 0.5 : 1; player.setPlaybackRate(vel); $('#ytVel').textContent = '🐢 ' + vel + '×'; gato.dizer(vel < 1 ? 'Mais devagar para treinar 🐢' : 'Velocidade normal ▶'); };
  const fmt = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  $('#ytA').onclick = () => { if (!ok()) return; A = player.getCurrentTime(); $('#ytA').textContent = 'A ' + fmt(A); $('#ytA').classList.add('ligado'); };
  $('#ytB').onclick = () => { if (!ok()) return; B = player.getCurrentTime(); $('#ytB').textContent = 'B ' + fmt(B); $('#ytB').classList.add('ligado'); };
  $('#ytLoop').onclick = () => {
    if (!ok()) return;
    if (A == null || B == null || B <= A) { info('Marque o começo (A) e o fim (B) do trecho enquanto o vídeo toca.'); return; }
    loop = !loop; $('#ytLoop').classList.toggle('ligado', loop); clearInterval(loopTm);
    if (loop) { player.seekTo(A, true); player.playVideo(); loopTm = setInterval(() => { if (player.getCurrentTime() >= B) player.seekTo(A, true); }, 200); gato.dizer('Repetindo o trecho 🔁'); }
  };

  // ---------- Letra ----------
  let versos = [], tempos = [], trads = [], atual = -1, manual = false;
  const chave = () => 'trad-k-' + (idAtual || 'sem-video');
  function guardar() { try { localStorage.setItem(chave(), JSON.stringify({ texto: $('#kTexto').value, tempos, idioma: $('#kIdioma').value })); } catch (e) {} }
  function carregarLetraSalva() {
    let d = null; try { d = JSON.parse(localStorage.getItem(chave()) || 'null'); } catch (e) {}
    if (d && d.texto) { $('#kTexto').value = d.texto; if (d.idioma) $('#kIdioma').value = d.idioma; usarLetra(d.tempos || []); gato.dizer('Achei a letra guardada deste vídeo! 🎤'); }
  }
  async function usarLetra(temposSalvos) {
    versos = $('#kTexto').value.split('\n').map((x) => x.trim()).filter(Boolean);
    if (!versos.length) { $('#kInfo').textContent = 'Cole a letra primeiro (um verso por linha).'; return; }
    tempos = Array.isArray(temposSalvos) && temposSalvos.length === versos.length ? temposSalvos : versos.map(() => null);
    atual = -1; desenhar();
    $('#kInfo').textContent = versos.length + ' versos. ' + (tempos.every((t) => t != null) ? '✓ Tempo marcado: a letra anda com o vídeo.' : 'Marque o tempo (⏱️) ou use ⚡ Automático. Sem isso, use ◀ ▶.');
    trads = versos.map(() => '…'); desenharTrads();
    trads = await C.traduzirVarias(versos, $('#kIdioma').value, $('#kTrad').value); desenharTrads();
    guardar();
  }
  function desenhar() {
    $('#kLinhas').innerHTML = versos.map((v, i) => '<div class="kl" data-i="' + i + '"><span class="st"></span><div class="o">' +
      v.split(/\s+/).map((w) => '<span>' + C.esc(w) + '</span>').join(' ') + '</div><div class="t"></div></div>').join('');
    $('#kLinhas').querySelectorAll('.kl').forEach((el) => { el.onclick = () => irVerso(Number(el.dataset.i), true); });
  }
  function desenharTrads() {
    const mesma = C.codTrad($('#kIdioma').value) === C.codTrad($('#kTrad').value);
    $('#kLinhas').querySelectorAll('.kl .t').forEach((el, i) => { el.textContent = mesma ? '' : (trads[i] || ''); });
  }
  $('#kSalvar').onclick = () => { usarLetra(); C.miau(); gato.dancar(1500); gato.dizer('Letra pronta! Bora cantar 🎤'); };
  $('#kIdioma').onchange = () => { localStorage.setItem('trad-k-idioma', $('#kIdioma').value); if (versos.length) usarLetra(tempos); };
  $('#kTrad').onchange = async () => { localStorage.setItem('trad-k-trad', $('#kTrad').value); if (versos.length) { trads = await C.traduzirVarias(versos, $('#kIdioma').value, $('#kTrad').value); desenharTrads(); } };

  // Verso atual: destaca, rola até ele e acende as palavras
  function irVerso(i, pulouNoVideo) {
    if (i < 0 || i >= versos.length) return;
    if (pulouNoVideo && ok() && tempos[i] != null) player.seekTo(Math.max(0, tempos[i] - 0.3), true);
    if (i === atual) return;
    const antes = atual; atual = i;
    $('#kLinhas').querySelectorAll('.kl').forEach((el, j) => { el.classList.toggle('on', j === i); el.classList.toggle('foi', j < i); if (j !== i) el.querySelectorAll('.lit').forEach((w) => w.classList.remove('lit')); });
    const el = $('#kLinhas .kl[data-i="' + i + '"]'); if (el) { const box = $('#kLinhas'); box.scrollTop = el.offsetTop - box.offsetTop - box.clientHeight / 2 + el.clientHeight / 2; }
    if (cantando) avaliarETrocar(antes, i);
  }
  function acender(frac) {
    const ws = $('#kLinhas .kl.on .o') ? $('#kLinhas .kl.on .o').children : [];
    const n = Math.ceil(Math.max(0, Math.min(1, frac)) * ws.length);
    for (let j = 0; j < ws.length; j++) ws[j].classList.toggle('lit', j < n);
  }
  // Anda junto com o vídeo
  setInterval(() => {
    if (!ok() || !versos.length || !$('#musica').classList.contains('on') || manual) return;
    if (!tempos.some((t) => t != null)) return;
    const t = player.getCurrentTime();
    let i = -1; tempos.forEach((tm, k) => { if (tm != null && tm <= t + 0.15) i = k; });
    if (i >= 0) {
      irVerso(i);
      const prox = tempos.slice(i + 1).find((x) => x != null) ?? (tempos[i] + 5);
      acender((t - tempos[i]) / Math.max(1, (prox - tempos[i]) * 0.85));
    }
  }, 120);
  $('#kProx').onclick = () => { manual = !ok() || !tempos.some((t) => t != null); irVerso(atual + 1, true); if (manual) acender(1); };
  $('#kAnt').onclick = () => { manual = !ok() || !tempos.some((t) => t != null); irVerso(Math.max(0, atual - 1), true); if (manual) acender(1); };

  // ⏱️ Marcar o tempo: com o vídeo tocando, toca no botão quando cada verso começa
  let marcando = -1;
  $('#kSinc').onclick = () => {
    if (!versos.length) { $('#kInfo').textContent = 'Cole a letra e toque em 💾 Usar esta letra primeiro.'; return; }
    if (!ok()) { $('#kInfo').textContent = 'Abra o vídeo aqui no app para marcar o tempo.'; return; }
    marcando = 0; tempos = versos.map(() => null); manual = false;
    player.seekTo(0, true); player.playVideo();
    $('#kMarcar').hidden = false; $('#kMarcar').textContent = '👆 Toque quando começar: “' + versos[0] + '”';
    gato.dizer('Toque no botão amarelo bem quando cada verso começar 👆');
  };
  $('#kMarcar').onclick = () => {
    if (marcando < 0 || !ok()) return;
    tempos[marcando] = player.getCurrentTime(); irVerso(marcando); acender(1);
    marcando++;
    if (marcando >= versos.length) {
      marcando = -1; $('#kMarcar').hidden = true; guardar();
      $('#kInfo').textContent = '✓ Tempo marcado! Agora a letra anda sozinha com o vídeo.';
      C.miau(); gato.dancar(2000, true); emo('feliz');
    } else $('#kMarcar').textContent = '👆 Próximo: “' + versos[marcando] + '”';
  };
  // ⚡ Automático: espalha os versos pela duração do vídeo (aproximado)
  $('#kAuto').onclick = () => {
    if (!versos.length) { $('#kInfo').textContent = 'Cole a letra e toque em 💾 Usar esta letra primeiro.'; return; }
    const dur = ok() && player.getDuration ? player.getDuration() : 0;
    if (!dur) { $('#kInfo').textContent = 'Abra o vídeo e dê play uma vez para eu saber a duração.'; return; }
    const ini = dur * 0.06, fim = dur * 0.94; tempos = versos.map((_, i) => ini + (fim - ini) * i / versos.length);
    manual = false; guardar();
    $('#kInfo').textContent = '⚡ Tempo aproximado. Para ficar certinho, use ⏱️ Marcar o tempo.';
    gato.dizer('Espalhei os versos pelo vídeo ⚡');
  };

  // ---------- 🎤 Cantar junto: ouve cada verso e dá estrelas ----------
  let cantando = false, ouvido = '', pontos = 0, versosCantados = 0;
  const normal = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  function parecido(a, b) {
    a = normal(a); b = normal(b); if (!a || !b) return 0;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
  }
  function avaliar(i) {
    if (i < 0 || !versos[i]) return;
    const n = ouvido ? parecido(ouvido, versos[i]) : 0, estrelas = n >= 0.85 ? 3 : n >= 0.6 ? 2 : n >= 0.35 ? 1 : 0;
    const el = $('#kLinhas .kl[data-i="' + i + '"] .st'); if (el) el.textContent = estrelas ? '⭐'.repeat(estrelas) : '·';
    pontos += estrelas; versosCantados++; $('#kPontos').textContent = '⭐ ' + pontos;
    $('#kCantou').textContent = ouvido ? '👂 Ouvi: “' + ouvido + '”' : '';
    if (estrelas === 3) { emo(Math.random() < 0.5 ? 'canta' : 'feliz'); gato.dizer('Perfeito! ⭐⭐⭐'); }
    else if (estrelas === 2) gato.dizer('Muito bem! ⭐⭐');
    else if (ouvido) { emo('triste'); gato.dizer('Quase! Tente o próximo 💪'); }
    ouvido = '';
  }
  function avaliarETrocar(antes) { avaliar(antes); }
  function ouvir() {
    C.ouvinte.iniciar($('#kIdioma').value, {
      parcial: (t) => { if (t) { ouvido = t; $('#kCantou').textContent = '🎤 ' + t; } },
      final: (t) => { ouvido = t; },
      erro: (m) => { pararCanto(); gato.dizer(m); },
      fim: () => { if (cantando) setTimeout(() => cantando && !C.ouvinte.ativo && ouvir(), 200); }
    });
  }
  function pararCanto() {
    cantando = false; $('#kCantar').classList.remove('ligado'); $('#kCantar').textContent = '🎤 Cantar junto';
    if (C.ouvinte.ativo) C.ouvinte.parar();
    if (versosCantados) gato.dizer('Você fez ' + pontos + ' ⭐ em ' + versosCantados + ' versos! 🎉');
  }
  $('#kCantar').onclick = () => {
    if (cantando) { avaliar(atual); pararCanto(); return; }
    if (!versos.length) { gato.dizer('Cole a letra primeiro 📝'); return; }
    if (!C.temVoz()) { gato.dizer('Este aparelho não reconhece voz 🙀'); return; }
    cantando = true; pontos = 0; versosCantados = 0; ouvido = ''; $('#kPontos').textContent = '⭐ 0';
    $('#kLinhas').querySelectorAll('.st').forEach((e) => { e.textContent = ''; });
    $('#kCantar').classList.add('ligado'); $('#kCantar').textContent = '⏹ Parar';
    gato.dizer(C.fone ? 'Cante junto! Estou ouvindo 👂🎤' : 'Cante junto! (com fone eu te ouço melhor 🎧)');
    if (ok() && player.getPlayerState() !== 1) player.playVideo();
    if (atual < 0) irVerso(0);
    ouvir();
  };

  // Sai da aba: pausa o vídeo e para de ouvir
  document.querySelectorAll('#abas button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.aba === 'musica') return;
    if (ok()) player.pauseVideo(); clearInterval(loopTm); loop = false; $('#ytLoop').classList.remove('ligado');
    if (cantando) pararCanto();
  }));
  C.ganchosAba.musica = () => setTimeout(() => { gato.dizer(versos.length ? 'Bora cantar? 🎤' : 'Cole o link da música e a letra: a gente canta junto! 🎤'); gato.pular(); }, 250);
  // O botão da aba Gatinho leva para cá
  const bt = $('#petSom'); if (bt) { bt.textContent = '🎤 Karaokê com o gatinho'; bt.onclick = () => C.mostrarTela('musica'); }

  // Volta o último vídeo usado
  const ult = localStorage.getItem('trad-yt-link'); if (ult) $('#ytLink').value = ult;
})();
