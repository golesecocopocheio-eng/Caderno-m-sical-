/* Clã Speak · emoções do gatinho: feliz, canta (melodia de miados), dança, assustado, triste,
 * apaixonado, surpreso, tonto, bravo e sono. Cada uma tem animação, emoji e som próprio.
 * Gestos: 1 toque (feliz/canta/surpreso ou o de sempre), 3 toques rápidos (susto),
 * segurar (carinho → apaixonado), chacoalhar o celular (tonto/assustado). */
(() => {
  'use strict';
  const C = window.ClaSpeak;
  if (!C) return;
  const $ = (s, r = document) => r.querySelector(s);

  // Onde está cada gatinho: [o que recebe o toque, o que se mexe]
  const GATOS = [
    ['#gatoInicio img'], ['#gatoTexto img'], ['#gatoEstudo img'], ['#gatoAjustes img'], ['#gatoSala img'],
    ['#ator', '#corpo'], ['#mAtor', '#mCorpo'], ['#petImg'], ['.gatoCaixa']
  ];
  const alvoDe = (el) => { for (const [toque, anim] of GATOS) { const t = el.closest(toque); if (t) return anim ? $(anim) : t; } return null; };
  const visivel = () => { // o gatinho principal da tela aberta
    const tela = document.querySelector('.tela.on,#f2f.on'); if (!tela) return null;
    const mapa = { inicio: '#gatoInicio img', texto: '#gatoTexto img', estudo: '#gatoEstudo img', ajustes: '#gatoAjustes img', salaTela: '#gatoSala img', f2f: '#corpo', musica: '#mCorpo', gato: '#petImg' };
    return mapa[tela.id] ? $(mapa[tela.id]) : null;
  };

  // ---------- Sons ----------
  const v = (o) => C.miauVoz(o);
  function chiado(seg = 0.5) { // "hhhh" de gato bravo
    if (!C.sons) return;
    try {
      const ctx = C.ctxAudio(), t = ctx.currentTime, n = ctx.sampleRate * seg, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b;
      bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.8;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + seg);
      s.connect(bp); bp.connect(g); g.connect(ctx.destination); s.start(t); s.stop(t + seg);
    } catch (e) {}
  }
  const MELODIAS = [[1, 1.26, 1.5, 1.26, 1.68, 1.5, 1], [1.5, 1.33, 1.26, 1.12, 1, 1.26, 1.5], [1, 1, 1.5, 1.5, 1.68, 1.68, 1.5]];
  const EMOCOES = {
    feliz: { ms: 900, emoji: ['😸', '✨'], som: () => { v({ forma: 'curto', alt: 1.1 }); v({ forma: 'curto', alt: 1.25, quando: 0.18 }); } },
    canta: { ms: 2400, emoji: ['🎵', '🎶', '🎵'], som: () => { const m = MELODIAS[Math.floor(Math.random() * MELODIAS.length)]; m.forEach((a, i) => v({ forma: 'curto', alt: a, dur: 0.26, quando: i * 0.3 })); } },
    assustado: { ms: 1100, emoji: ['😱', '💦', '❗'], som: () => { v({ forma: 'assustado', alt: 1.1 }); setTimeout(() => chiado(0.35), 380); } },
    triste: { ms: 1800, emoji: ['😿', '💧'], som: () => v({ forma: 'triste' }) },
    apaixonado: { ms: 2200, emoji: ['😻', '💕', '💖', '💕'], som: () => C.ronrom(2) },
    surpreso: { ms: 800, emoji: ['😮', '❗'], som: () => v({ forma: 'curto', alt: 1.35 }) },
    tonto: { ms: 1500, emoji: ['😵', '💫', '⭐'], som: () => v({ forma: 'triste', alt: 1.2, dur: 0.7 }) },
    bravo: { ms: 1200, emoji: ['😾', '💢'], som: () => chiado(0.6) },
    sono: { ms: 2200, emoji: ['😴', '💤'], som: () => v({ forma: 'triste', alt: 0.8, dur: 1.2 }) }
  };
  function soltarEmojis(el, lista) {
    const r = el.getBoundingClientRect();
    lista.forEach((e, i) => setTimeout(() => {
      const s = document.createElement('span'); s.className = 'emoBadge'; s.textContent = e;
      s.style.left = (r.left + r.width * (0.55 + Math.random() * 0.35)) + 'px'; s.style.top = (r.top + r.height * 0.1) + 'px';
      document.body.appendChild(s); setTimeout(() => s.remove(), 1500);
    }, i * 180));
  }
  // Mostra a emoção num gatinho (el = elemento que se mexe; sem el = o gatinho da tela aberta)
  function emocao(tipo, el) {
    el = el || visivel(); const e = EMOCOES[tipo]; if (!el || !e || !el.offsetParent) return;
    const cls = 'emo-' + tipo;
    Object.keys(EMOCOES).forEach((k) => el.classList.remove('emo-' + k)); void el.offsetWidth;
    el.classList.add(cls); clearTimeout(el._emoTm); el._emoTm = setTimeout(() => el.classList.remove(cls), e.ms);
    soltarEmojis(el, e.emoji); try { e.som(); } catch (x) {}
  }
  window.ClaSpeakEmocao = emocao;

  // ---------- Gestos ----------
  const SELETOR = GATOS.map((g) => g[0]).join(',');
  let toques = [], segurarTm = null, segurou = false;
  document.addEventListener('pointerdown', (ev) => {
    const t = ev.target.closest && ev.target.closest(SELETOR); if (!t) return;
    segurou = false; clearTimeout(segurarTm);
    segurarTm = setTimeout(() => { segurou = true; emocao('apaixonado', alvoDe(t)); }, 650);
  }, true);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => document.addEventListener(n, () => clearTimeout(segurarTm), true));
  // capture: decide antes das ações normais do toque
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest && ev.target.closest(SELETOR); if (!t) return;
    const alvo = alvoDe(t);
    if (segurou) { segurou = false; ev.stopImmediatePropagation(); return; }
    const agora = Date.now(); toques = toques.filter((x) => agora - x < 900); toques.push(agora);
    if (toques.length >= 3) { toques = []; ev.stopImmediatePropagation(); emocao(Math.random() < 0.7 ? 'assustado' : 'bravo', alvo); return; }
    if (toques.length === 1 && Math.random() < 0.55) { ev.stopImmediatePropagation(); emocao(['feliz', 'canta', 'canta', 'surpreso'][Math.floor(Math.random() * 4)], alvo); }
    else if (toques.length === 2) ev.stopImmediatePropagation();
  }, true);

  // Chacoalhar o celular
  let ultimoChacoalho = 0, ultAcc = null;
  window.addEventListener('devicemotion', (e) => {
    const a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
    if (ultAcc) {
      const delta = Math.abs(a.x - ultAcc.x) + Math.abs(a.y - ultAcc.y) + Math.abs(a.z - ultAcc.z);
      if (delta > 32 && Date.now() - ultimoChacoalho > 2500) { ultimoChacoalho = Date.now(); emocao(Math.random() < 0.5 ? 'tonto' : 'assustado'); }
    }
    ultAcc = { x: a.x, y: a.y, z: a.z };
  });

  // Sono: 45 s sem mexer no app, o gatinho da tela boceja
  let parado = Date.now();
  ['pointerdown', 'keydown'].forEach((n) => document.addEventListener(n, () => { parado = Date.now(); }, true));
  setInterval(() => { if (Date.now() - parado > 45000 && !document.hidden) { parado = Date.now() - 20000; emocao('sono'); } }, 5000);
})();
