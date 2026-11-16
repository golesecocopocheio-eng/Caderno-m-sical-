/* Clã Speak (Tradutor ao Vivo): fala → texto → tradução → voz, entre celulares (sala) ou num celular só (frente a frente).
 * Reconhecimento e leitura em voz: Web Speech API do navegador (Chrome no Android, Safari no iPhone).
 * Tradução: serviço gratuito do Google Tradutor (sem chave), com o MyMemory como reserva.
 * Sala remota: Firestore do projeto (firebase-config.js), em salas/{codigo}. Sem Firebase, só entre abas. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);

  // ---------- Idiomas ----------
  const LINGUAS = [
    ['pt-BR', 'Português (Brasil)'], ['en-US', 'English'], ['es-ES', 'Español'], ['fr-FR', 'Français'],
    ['it-IT', 'Italiano'], ['de-DE', 'Deutsch'], ['nl-NL', 'Nederlands'], ['ru-RU', 'Русский'],
    ['uk-UA', 'Українська'], ['pl-PL', 'Polski'], ['tr-TR', 'Türkçe'], ['ar-SA', 'العربية'],
    ['he-IL', 'עברית'], ['hi-IN', 'हिन्दी'], ['ja-JP', '日本語'], ['ko-KR', '한국어'],
    ['zh-CN', '中文 (简体)'], ['zh-TW', '中文 (繁體)'], ['id-ID', 'Bahasa Indonesia'], ['vi-VN', 'Tiếng Việt'],
    ['th-TH', 'ไทย'], ['pt-PT', 'Português (Portugal)'], ['es-MX', 'Español (México)'], ['en-GB', 'English (UK)']
  ];
  const nomeLingua = (c) => (LINGUAS.find((l) => l[0] === c) || [c, c])[1];
  const bandeira = (c) => { const r = String(c).split('-')[1]; return r && r.length === 2 ? String.fromCodePoint(...[...r.toUpperCase()].map((ch) => 0x1F1E6 + ch.charCodeAt(0) - 65)) : '🌐'; };
  const codTrad = (c) => (/^zh-/.test(c) ? c : c.split('-')[0]);
  const preencher = (sel, valor) => {
    sel.innerHTML = LINGUAS.map(([c, n]) => `<option value="${c}">${bandeira(c)} ${n}</option>`).join('');
    sel.value = valor;
  };
  const linguaPadrao = () => {
    const n = navigator.language || 'pt-BR';
    return (LINGUAS.find((l) => l[0].toLowerCase() === n.toLowerCase()) ||
      LINGUAS.find((l) => l[0].split('-')[0] === n.split('-')[0]) || LINGUAS[0])[0];
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Tradução ----------
  // As traduções ficam guardadas no aparelho: a mesma frase sai na hora, até sem internet.
  const cache = new Map();
  try { Object.entries(JSON.parse(localStorage.getItem('trad-cache') || '{}')).forEach(([k, v]) => cache.set(k, v)); } catch (e) {}
  let salvarTm = null;
  const guardar = (k, v) => {
    cache.delete(k); cache.set(k, v);
    while (cache.size > 1500) cache.delete(cache.keys().next().value);
    clearTimeout(salvarTm);
    salvarTm = setTimeout(() => { try { localStorage.setItem('trad-cache', JSON.stringify(Object.fromEntries(cache))); } catch (e) {} }, 800);
  };
  // Cada serviço tem 3,5 s: se demorar, passa para o próximo
  const buscar = async (u, ms = 3500) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try { return await (await fetch(u, { signal: ctl.signal })).json(); } finally { clearTimeout(t); }
  };
  const emAndamento = new Map(); // a mesma frase pedida duas vezes ao mesmo tempo vira um pedido só
  async function traduzir(texto, de, para) {
    texto = (texto || '').trim();
    if (!texto) return '';
    const sl = codTrad(de), tl = codTrad(para);
    if (sl === tl) return texto;
    const k = sl + '|' + tl + '|' + texto;
    if (cache.has(k)) return cache.get(k);
    if (emAndamento.has(k)) return emAndamento.get(k);
    const p = (async () => {
      let r = '';
      try {
        const j = await buscar('https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=' + sl + '&tl=' + tl + '&q=' + encodeURIComponent(texto));
        r = (j[0] || []).map((x) => x[0]).join('');
      } catch (e) { /* tenta a reserva */ }
      if (!r) {
        try {
          const j = await buscar('https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=' + sl + '&tl=' + tl + '&q=' + encodeURIComponent(texto));
          const x = Array.isArray(j) ? j[0] : null;
          r = (Array.isArray(x) ? x[0] : x) || '';
        } catch (e) { /* tenta a próxima */ }
      }
      if (!r) {
        try {
          const j = await buscar('https://api.mymemory.translated.net/get?langpair=' + sl + '|' + tl + '&q=' + encodeURIComponent(texto.slice(0, 480)), 5000);
          r = (j.responseData && j.responseData.translatedText) || '';
        } catch (e) { /* sem internet */ }
      }
      if (!r) return '⚠️ (sem tradução: verifique a internet) ' + texto;
      guardar(k, r);
      return r;
    })();
    emAndamento.set(k, p);
    try { return await p; } finally { emAndamento.delete(k); }
  }
  // Várias frases num pedido só (uma por linha); se não der certo, traduz todas ao mesmo tempo
  async function traduzirVarias(lista, de, para) {
    const sl = codTrad(de), tl = codTrad(para);
    if (sl === tl) return lista.slice();
    const faltam = lista.filter((t) => !cache.has(sl + '|' + tl + '|' + t.trim()));
    if (faltam.length > 1) {
      try {
        const j = await buscar('https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=' + sl + '&tl=' + tl + '&q=' + encodeURIComponent(faltam.join('\n')), 5000);
        const partes = (j[0] || []).map((x) => x[0]).join('').split('\n').map((x) => x.trim());
        if (partes.length === faltam.length && partes.every(Boolean)) faltam.forEach((t, i) => guardar(sl + '|' + tl + '|' + t.trim(), partes[i]));
      } catch (e) { /* cai para uma por uma */ }
    }
    return Promise.all(lista.map((t) => traduzir(t, de, para)));
  }

  // ---------- App Android (APK) ----------
  // Dentro do APK a WebView não tem reconhecimento de voz nem leitura em voz alta:
  // usa os plugins nativos do Capacitor (SpeechRecognition e TextToSpeech).
  const NATIVO = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plugin = (n) => (NATIVO && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;

  // Imita a SpeechRecognition do navegador usando o plugin nativo. O Android ouve uma frase
  // por vez: quando ela termina, entrega o texto final e o ouvinte abre a próxima.
  let permissaoMic = null;
  class ReconhecimentoNativo {
    constructor() { this.lang = 'pt-BR'; this.ultimo = ''; this.acabou = false; this.handles = []; }
    _emitir(texto, final) { const r = [{ transcript: texto }]; r.isFinal = final; this.onresult && this.onresult({ resultIndex: 0, results: [r] }); }
    async start() {
      const P = plugin('SpeechRecognition');
      try {
        if (permissaoMic !== 'granted') {
          const st = await P.requestPermissions();
          permissaoMic = st.speechRecognition;
          if (permissaoMic !== 'granted') { this.onerror && this.onerror({ error: 'not-allowed' }); this._fim(); return; }
        }
        this.handles.push(await P.addListener('partialResults', (d) => {
          const t = (d.matches && d.matches[0]) || '';
          if (t && !this.acabou) { this.ultimo = t; this._emitir(t, false); if (this.parou) this._fim(); } // depois do "stopped", é o resultado final
        }));
        // "stopped" chega um instante antes do resultado final: espera no máximo 600 ms por ele
        this.handles.push(await P.addListener('listeningState', (d) => { if (d.status === 'stopped') { this.parou = true; setTimeout(() => this._fim(), 600); } }));
        const inicio = Date.now();
        // Silêncio ou erro não geram aviso no plugin: confere se ainda está ouvindo
        this.vigia = setInterval(() => {
          if (Date.now() - inicio < 1000) return;
          P.isListening().then((r) => { if (!r.listening) setTimeout(() => this._fim(), 300); }).catch(() => {});
        }, 500);
        await P.start({ language: this.lang, maxResults: 1, partialResults: true, popup: false });
      } catch (e) { this._fim(); }
    }
    _fim() {
      if (this.acabou) return;
      this.acabou = true;
      clearInterval(this.vigia);
      this.handles.forEach((h) => h.remove().catch(() => {}));
      if (this.ultimo.trim()) this._emitir(this.ultimo, true);
      this.onend && this.onend();
    }
    stop() { const P = plugin('SpeechRecognition'); P.stop().catch(() => {}); this._fim(); }
    abort() { this.ultimo = ''; this.stop(); }
  }

  // ---------- Voz: falar ----------
  let vozLigada = localStorage.getItem('trad-voz') !== '0';
  // Modo fone de ouvido: a tradução toca no fone e o microfone não a escuta, então não precisa pausar.
  let fone = localStorage.getItem('trad-fone') === '1';
  let velVoz = Number(localStorage.getItem('trad-vel')) || 1;
  let sons = localStorage.getItem('trad-sons') !== '0';
  const falando = { n: 0 };
  // Escolhe a voz mais natural do aparelho para o idioma (as "Natural"/"Google"/"Enhanced" soam melhor)
  function melhorVoz(lingua) {
    if (!window.speechSynthesis) return null;
    const vs = speechSynthesis.getVoices(), norm = (l) => l.replace('_', '-').toLowerCase(), alvo = lingua.toLowerCase(), base = alvo.split('-')[0];
    const nota = (v) => (norm(v.lang) === alvo ? 10 : norm(v.lang).startsWith(base) ? 5 : -99) +
      (/natural|neural/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 3 : 0) + (/enhanced|premium|plus/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
    let melhor = null, mn = -50;
    vs.forEach((v) => { const n = nota(v); if (n > mn) { mn = n; melhor = v; } });
    return melhor;
  }
  function falar(texto, lingua, opc = {}) {
    if ((!vozLigada && !opc.sempre) || !texto || texto.startsWith('⚠️')) return; // aviso de falha não é lido
    const vel = (opc.vel || 1) * velVoz;
    const TTS = plugin('TextToSpeech');
    if (TTS) {
      falando.n++;
      if (!fone) ouvinte.pausar(true);
      const fimN = () => { falando.n = Math.max(0, falando.n - 1); if (!falando.n && ouvinte.pausado) setTimeout(() => ouvinte.pausar(false), 250); };
      opc.aoComecar && opc.aoComecar();
      const fimN2 = () => { fimN(); opc.aoTerminar && opc.aoTerminar(); };
      TTS.speak({ text: texto, lang: lingua, rate: vel, queueStrategy: 1 }).then(fimN2, fimN2);
      return;
    }
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = lingua; u.rate = vel;
    const v = melhorVoz(lingua);
    try { if (v) u.voice = v; } catch (e) { /* voz recusada: usa a padrão do idioma */ }
    u.onstart = () => opc.aoComecar && opc.aoComecar();
    falando.n++;
    if (!fone) ouvinte.pausar(true); // sem fone, o microfone não pode ouvir a própria tradução
    const fim = () => { falando.n = Math.max(0, falando.n - 1); if (!falando.n && ouvinte.pausado) setTimeout(() => ouvinte.pausar(false), 250); };
    const fim2 = () => { fim(); opc.aoTerminar && opc.aoTerminar(); };
    u.onend = fim2; u.onerror = fim2;
    speechSynthesis.speak(u);
  }

  // ---------- Voz: ouvir ----------
  const SR = plugin('SpeechRecognition') ? ReconhecimentoNativo : (window.SpeechRecognition || window.webkitSpeechRecognition);
  const ouvinte = {
    rec: null, ativo: false, pausado: false, lingua: 'pt-BR', cb: null,
    iniciar(lingua, cb) {
      if (!SR) { alert('Este navegador não reconhece voz. Use o Chrome (Android) ou o Safari (iPhone), ou digite.'); return false; }
      this.parar();
      this.lingua = lingua; this.cb = cb; this.ativo = true;
      this._abrir();
      return true;
    },
    _abrir() {
      if (!this.ativo || this.pausado) return;
      const r = new SR();
      r.lang = this.lingua; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = (e) => {
        let parcial = '', teveFinal = false;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) { if (t.trim()) { teveFinal = true; this.cb.final(t.trim()); } }
          else parcial += t;
        }
        if (parcial.trim() || !teveFinal) this.cb.parcial(parcial.trim());
      };
      r.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          this.ativo = false; this.cb.erro && this.cb.erro('Permita o uso do microfone para falar.');
        }
      };
      r.onend = () => { if (this.rec === r) { this.rec = null; if (this.ativo && !this.pausado) setTimeout(() => this._abrir(), 60); else if (!this.ativo) this.cb && this.cb.fim && this.cb.fim(); } };
      this.rec = r;
      try { r.start(); } catch (e) { /* já iniciado */ }
    },
    pausar(sim) {
      this.pausado = sim;
      if (sim && this.rec) { const r = this.rec; this.rec = null; try { r.abort(); } catch (e) {} }
      else if (!sim) this._abrir();
    },
    parar() {
      const cb = this.cb;
      this.ativo = false;
      if (this.rec) { const r = this.rec; this.rec = null; try { r.stop(); } catch (e) {} }
      cb && cb.fim && cb.fim();
    }
  };

  // ---------- Gatinho mascote ----------
  let audio = null;
  const ctxAudio = () => (audio = audio || new (window.AudioContext || window.webkitAudioContext)());
  // Miado sintetizado com as vogais de um miado de verdade (m → i → a → u), diferente a cada vez
  function miauSintetico() {
    const ctx = ctxAudio(), t = ctx.currentTime;
    const k = 0.88 + Math.random() * 0.3, dur = 0.65 + Math.random() * 0.25;
    const src = ctx.createOscillator(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(470 * k, t);
    src.frequency.linearRampToValueAtTime(830 * k, t + dur * 0.35);
    src.frequency.linearRampToValueAtTime(540 * k, t + dur * 0.95);
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 6 + Math.random() * 2; lfoG.gain.value = 12;
    lfo.connect(lfoG); lfoG.connect(src.frequency);
    const mestre = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
    // formantes: [m, i, a, u]
    const forms = [[250, 330, 850, 380], [1200, 2300, 1450, 850], [2600, 2900, 2600, 2400]];
    const qs = [7, 11, 12], gs = [1, 0.55, 0.22], marcas = [0, 0.12, 0.42, 0.78];
    forms.forEach((fs, i) => {
      const bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.Q.value = qs[i]; g.gain.value = gs[i];
      fs.forEach((f, j) => (j ? bp.frequency.linearRampToValueAtTime(f, t + dur * marcas[j]) : bp.frequency.setValueAtTime(f, t)));
      src.connect(bp); bp.connect(g); g.connect(mestre);
    });
    mestre.gain.setValueAtTime(0.0001, t);
    mestre.gain.exponentialRampToValueAtTime(0.06, t + 0.04);
    mestre.gain.exponentialRampToValueAtTime(0.9, t + dur * 0.16);
    mestre.gain.setValueAtTime(0.9, t + dur * 0.7);
    mestre.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    mestre.connect(lp); lp.connect(ctx.destination);
    src.start(t); lfo.start(t); src.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }
  function miau(forcar) { // forcar = a pessoa tocou no gatinho (toca mesmo com os sons desligados)
    if (!sons && !forcar) return;
    try {
      const gravado = localStorage.getItem('trad-miau');
      if (gravado) { const a = new Audio(gravado); a.play().catch(() => miauSintetico()); return; }
      miauSintetico();
    } catch (e) { /* sem áudio */ }
  }
  function ronrom(seg = 1.6) { // ronronar: ruído grave pulsando
    if (!sons) return;
    try {
      const ctx = ctxAudio(), t = ctx.currentTime, n = ctx.sampleRate * seg, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      const g = ctx.createGain(), mod = ctx.createOscillator(), modG = ctx.createGain();
      mod.frequency.value = 24; modG.gain.value = 0.5; g.gain.value = 0.5; mod.connect(modG); modG.connect(g.gain);
      const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(1.2, t + 0.2); env.gain.setValueAtTime(1.2, t + seg - 0.3); env.gain.exponentialRampToValueAtTime(0.0001, t + seg);
      src.connect(lp); lp.connect(g); g.connect(env); env.connect(ctx.destination);
      src.start(t); mod.start(t); src.stop(t + seg); mod.stop(t + seg);
    } catch (e) {}
  }
  function bipe(subindo) { // aviso curto: microfone ligou (sobe) / desligou (desce)
    if (!sons) return;
    try {
      const ctx = ctxAudio(), t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(subindo ? 660 : 880, t); o.frequency.setValueAtTime(subindo ? 880 : 620, t + 0.07);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.16);
    } catch (e) {}
  }
  function plop() { // bolhinha de mensagem nova
    if (!sons) return;
    try {
      const ctx = ctxAudio(), t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(760, t); o.frequency.exponentialRampToValueAtTime(260, t + 0.1);
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.13);
    } catch (e) {}
  }
  const FRASES_GATO = ['Miau! 😺', 'Ronrom… 💛', 'Fale comigo em qualquer idioma! 🌍', 'Eu entendo 24 idiomas, sabia? 😼',
    'Toque no 🎤 e fale!', 'Estudar um pouquinho todo dia faz miau-ravilhas! 📚', 'Com fone de ouvido 🎧 a conversa flui sem pausas.',
    'Mande um emoji pra sala! 🎉', 'Prrr… carinho aceito! 🐾'];
  function gato(id) {
    const el = $('#' + id), img = $('img', el), fala = $('.fala', el);
    let tm = null;
    const g = {
      dizer(t, ms = 3800) {
        fala.textContent = t; el.classList.add('falando');
        img.classList.remove('pula'); void img.offsetWidth; img.classList.add('pula');
        clearTimeout(tm); if (el.classList.contains('mini')) tm = setTimeout(() => el.classList.remove('falando'), ms);
      },
      ouvindo(sim) { el.classList.toggle('ouvindo', sim); }
    };
    img.addEventListener('click', () => { miau(true); g.dizer(FRASES_GATO[Math.floor(Math.random() * FRASES_GATO.length)]); });
    return g;
  }
  const gatoInicio = gato('gatoInicio'), gatoSala = gato('gatoSala');
  const CORES = ['#facc15', '#fb923c', '#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#f87171', '#2dd4bf'];
  const corDe = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CORES[h % CORES.length]; };
  const avatar = (id, nome) => `<span class="avatar" style="background:${corDe(id)}">${esc((nome || '?').trim().charAt(0).toUpperCase() || '?')}</span>`;
  function voar(emoji) {
    const e = document.createElement('div'); e.className = 'voador'; e.textContent = emoji;
    e.style.left = (10 + Math.random() * 75) + 'vw'; document.body.appendChild(e);
    setTimeout(() => e.remove(), 2700);
  }

  // ---------- Transporte (nuvem ou abas do aparelho) ----------
  const uid = 'u' + Math.random().toString(36).slice(2, 10); // modo local: cada aba é uma pessoa
  const loadScript = (src) => new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = err; document.head.appendChild(s); });

  async function conectar(sala, eu, h) {
    const cfg = window.FIREBASE_CONFIG;
    if (cfg) {
      try { return await conectarFirebase(cfg, sala, eu, h); } catch (e) {
        console.warn('Firebase indisponível, usando só este aparelho', e);
        h.aviso(e && e.code === 'permission-denied'
          ? 'A nuvem recusou a sala: falta publicar no Firebase a regra das salas (firestore.rules). Por enquanto a sala funciona só entre abas deste aparelho.'
          : 'Sem conexão com a nuvem: a sala funciona só entre abas deste aparelho. Verifique a internet e entre de novo.');
      }
    }
    return conectarLocal(sala, eu, h);
  }

  // Carrega o Firebase e faz o login uma vez só (começa em segundo plano quando o app abre)
  let nuvemPronta = null;
  function preparaNuvem(cfg) {
    nuvemPronta = nuvemPronta || (async () => {
      await loadScript('vendor/firebase-app-compat.js');
      await loadScript('vendor/firebase-auth-compat.js');
      await loadScript('vendor/firebase-firestore-compat.js');
      const fb = window.firebase;
      const app = fb.apps.length ? fb.app() : fb.initializeApp(cfg);
      const auth = app.auth();
      const user = await new Promise((ok, err) => {
        const t = setTimeout(() => err(new Error('tempo esgotado')), 12000);
        const off = auth.onAuthStateChanged((u) => { if (u) { clearTimeout(t); off(); ok(u); } else auth.signInAnonymously().catch(err); });
      });
      return { app, user };
    })();
    nuvemPronta.catch(() => { nuvemPronta = null; }); // falhou: tenta de novo na próxima vez
    return nuvemPronta;
  }
  async function conectarFirebase(cfg, sala, eu, h) {
    const { app, user } = await preparaNuvem(cfg);
    // Cada aba é um participante: abas do mesmo navegador dividem o login anônimo do Firebase,
    // então o id da pessoa na sala é por aba (fica igual se a aba for recarregada).
    const meu = sessionStorage.getItem('trad-aba') || (() => { const u = user.uid.slice(0, 8) + '-' + Math.random().toString(36).slice(2, 8); sessionStorage.setItem('trad-aba', u); return u; })();
    const db = app.firestore();
    const base = db.collection('salas').doc(sala);
    const pessoa = base.collection('pessoas').doc(meu);
    const entrada = Date.now();
    // Sem internet o Firestore não responde nem dá erro: depois de 15 s desiste.
    await Promise.race([pessoa.set({ nome: eu.nome, lingua: eu.lingua, t: Date.now(), vivo: '' }),
      new Promise((_, err) => setTimeout(() => err(new Error('tempo esgotado')), 15000))]);
    const pulso = setInterval(() => pessoa.set({ nome: eu.nome, lingua: eu.lingua, t: Date.now() }, { merge: true }).catch(() => {}), 30000);
    const offs = [];
    offs.push(base.collection('falas').orderBy('t').limitToLast(60).onSnapshot((s) => {
      s.docChanges().forEach((c) => { if (c.type === 'added') { const d = c.doc.data(); h.fala({ ...d, id: c.doc.id, eu: d.uid === meu, nova: d.t >= entrada }); } });
    }, () => h.aviso('A nuvem recusou a sala: falta publicar no Firebase a regra das salas (firestore.rules).')));
    // Quem não dá sinal há 2 minutos (fechou o app sem sair) some da lista.
    let lista = [];
    const mostrar = () => { const agora = Date.now(); h.pessoas(lista.filter((p) => p.eu || agora - p.t < 120000)); };
    offs.push(base.collection('pessoas').onSnapshot((s) => { lista = s.docs.map((d) => ({ ...d.data(), uid: d.id, eu: d.id === meu })); mostrar(); }));
    const revisar = setInterval(mostrar, 30000);
    let ultimo = 0, pend = null, tm = null;
    const vivo = (texto) => {
      pend = texto;
      const ag = Date.now();
      if (ag - ultimo > 300) { ultimo = ag; pessoa.update({ vivo: texto }).catch(() => {}); pend = null; }
      else if (!tm) tm = setTimeout(() => { tm = null; if (pend !== null) { ultimo = Date.now(); pessoa.update({ vivo: pend }).catch(() => {}); pend = null; } }, 300);
    };
    return {
      nuvem: true,
      enviar: (texto) => { pend = null; pessoa.update({ vivo: '' }).catch(() => {}); return base.collection('falas').add({ uid: meu, nome: eu.nome, lingua: eu.lingua, texto, t: Date.now() }); },
      evento: (ev) => base.collection('falas').add({ ...ev, uid: meu, nome: eu.nome, lingua: eu.lingua, t: Date.now() }).catch(() => {}),
      vivo,
      sair: () => { clearInterval(pulso); clearInterval(revisar); offs.forEach((f) => f()); return pessoa.delete().catch(() => {}); }
    };
  }

  function conectarLocal(sala, eu, h) {
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('trad-' + sala) : null;
    const pessoas = new Map([[uid, { uid, nome: eu.nome, lingua: eu.lingua, vivo: '', t: Date.now(), eu: true }]]);
    const mostrar = () => h.pessoas([...pessoas.values()]);
    const anunciar = () => bc && bc.postMessage({ tipo: 'oi', p: { uid, nome: eu.nome, lingua: eu.lingua, vivo: '', t: Date.now() } });
    if (bc) bc.onmessage = ({ data: m }) => {
      if (m.tipo === 'oi') { const novo = !pessoas.has(m.p.uid); pessoas.set(m.p.uid, { ...m.p, eu: false }); if (novo) anunciar(); mostrar(); }
      if (m.tipo === 'tchau') { pessoas.delete(m.uid); mostrar(); }
      if (m.tipo === 'vivo' && pessoas.has(m.uid)) { pessoas.get(m.uid).vivo = m.texto; mostrar(); }
      if (m.tipo === 'fala') { if (!m.f.tipo && pessoas.has(m.f.uid)) { pessoas.get(m.f.uid).vivo = ''; mostrar(); } h.fala({ ...m.f, eu: false, nova: true }); }
    };
    anunciar(); mostrar();
    return {
      nuvem: false,
      enviar: (texto) => { const f = { id: uid + Date.now(), uid, nome: eu.nome, lingua: eu.lingua, texto, t: Date.now() }; bc && bc.postMessage({ tipo: 'fala', f }); h.fala({ ...f, eu: true, nova: true }); },
      evento: (ev) => { const f = { ...ev, id: uid + Date.now(), uid, nome: eu.nome, lingua: eu.lingua, t: Date.now() }; bc && bc.postMessage({ tipo: 'fala', f }); h.fala({ ...f, eu: true, nova: true }); },
      vivo: (texto) => bc && bc.postMessage({ tipo: 'vivo', uid, texto }),
      sair: () => { bc && (bc.postMessage({ tipo: 'tchau', uid }), bc.close()); }
    };
  }

  // ---------- Tela inicial ----------
  const params = new URLSearchParams(location.search);
  const nomeEl = $('#nome'), linguaEl = $('#lingua'), salaEl = $('#sala');
  nomeEl.value = localStorage.getItem('trad-nome') || '';
  preencher(linguaEl, localStorage.getItem('trad-lingua') || linguaPadrao());
  const novoCodigo = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  salaEl.value = (params.get('sala') || localStorage.getItem('trad-sala') || '').toUpperCase();
  if (!SR) $('#semVoz').hidden = false;
  if (!window.FIREBASE_CONFIG) $('#semNuvem').hidden = false;
  $('#novaSala').onclick = () => { salaEl.value = novoCodigo(); };
  const ganchosAba = {}; // aba → função chamada ao abrir (preenchidas pelas outras partes do app)
  const mostrarTela = (id) => {
    document.querySelectorAll('.tela,#f2f').forEach((t) => t.classList.toggle('on', t.id === id));
    const abas = $('#abas');
    abas.hidden = id === 'salaTela' || id === 'f2f';
    abas.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.aba === id));
    if (ganchosAba[id]) ganchosAba[id]();
  };

  // ---------- Sala ----------
  let conexao = null, eu = null;
  const msgs = $('#msgs');
  const vivos = new Map(); // uid → elemento da bolha "falando agora"

  const rolar = () => { msgs.scrollTop = msgs.scrollHeight; };
  let ultimaRecebida = null; // para o botão 🔁
  const porId = new Map(); // id da mensagem → { linha, reacoes: Map(emoji → Set(uid)) }
  const inserir = (el) => { const pos = [...msgs.children].find((x) => x.dataset.vivo); msgs.insertBefore(el, pos || null); rolar(); };
  function sistema(texto) { const d = document.createElement('div'); d.className = 'sistema'; d.textContent = texto; inserir(d); }
  function reagir(id, emoji) { if (conexao && conexao.evento && id) conexao.evento({ tipo: 'reacao', alvo: id, emoji }); }
  function mostrarReacoes(id) {
    const m = porId.get(id); if (!m) return;
    const txt = [...m.reacoes].filter(([, us]) => us.size).map(([e, us]) => e + (us.size > 1 ? us.size : '')).join(' ');
    $('.reacoes', m.linha).textContent = txt; m.linha.classList.toggle('reagiu', !!txt);
  }
  function evento(f) {
    if (f.tipo === 'emoji') {
      if (f.nova) { voar(f.emoji); if (!f.eu) gatoSala.dizer(`${f.nome} mandou ${f.emoji}`, 2500); }
    } else if (f.tipo === 'reacao') {
      const m = porId.get(f.alvo); if (!m) return;
      if (!m.reacoes.has(f.emoji)) m.reacoes.set(f.emoji, new Set());
      m.reacoes.get(f.emoji).add(f.uid); mostrarReacoes(f.alvo);
      if (f.nova) voar(f.emoji);
    }
  }
  function bolha(f) {
    if (f.tipo) return evento(f);
    const d = document.createElement('div');
    d.className = 'linha' + (f.eu ? ' eu' : '');
    const quem = f.eu ? 'Você' : esc(f.nome || 'Alguém') + ' · ' + bandeira(f.lingua) + ' ' + esc(nomeLingua(f.lingua));
    const mesma = codTrad(f.lingua) === codTrad(eu.lingua);
    d.innerHTML = avatar(f.uid, f.eu ? eu.nome : f.nome) + `<div class="msg"><div class="quem">${quem}</div><div class="tr">${esc(f.eu || mesma ? f.texto : '…')}</div>` +
      (f.eu || mesma ? '' : `<div class="orig">${esc(f.texto)}</div>`) +
      '<div class="acoes">' + (f.eu ? '' : '<button class="ouvir">🔊 ouvir</button><span class="eq"><i></i><i></i><i></i></span>') + '<button class="curtir" title="Curtir">❤️</button><button class="rir" title="Rir">😂</button><button class="copiar" title="Copiar">📋</button></div><div class="reacoes"></div></div>';
    if (f.id) porId.set(f.id, { linha: d, reacoes: new Map() });
    $('.curtir', d).onclick = () => reagir(f.id, '❤️');
    $('.rir', d).onclick = () => reagir(f.id, '😂');
    $('.copiar', d).onclick = () => { const t = $('.tr', d).textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => gatoSala.dizer('Copiei! 📋', 1500)).catch(() => prompt('Copie:', t)); };
    $('.msg', d).addEventListener('dblclick', () => reagir(f.id, '❤️'));
    inserir(d);
    if (!f.eu && f.nova) {
      plop();
      const img = $('#gatoSala img'); img.classList.remove('pula'); void img.offsetWidth; img.classList.add('pula');
      if (Math.random() < 0.3) gatoSala.dizer(/\?\s*$/.test(f.texto) ? 'Hmm, uma pergunta! 🤔 Responda no 🎤' : ['Que legal! 😺', 'Miau, entendi tudo! 🐾', 'Prrr… 💛', 'Conversa boa! 😸'][Math.floor(Math.random() * 4)], 2500);
    }
    const tr = $('.tr', d);
    const pronto = (f.eu || mesma) ? Promise.resolve(f.texto) : traduzir(f.texto, f.lingua, eu.lingua).then((t) => { tr.textContent = t; rolar(); return t; });
    const btn = $('.ouvir', d);
    const gImg = $('#gatoSala img');
    const lerEsta = (sempre) => pronto.then((t) => falar(t, eu.lingua, {
      sempre,
      aoComecar: () => { d.classList.add('tocando'); gImg.classList.add('cantando'); },
      aoTerminar: () => { d.classList.remove('tocando'); if (!msgs.querySelector('.linha.tocando')) gImg.classList.remove('cantando'); }
    }));
    if (btn) btn.onclick = () => lerEsta(true);
    if (!f.eu) ultimaRecebida = () => lerEsta(true);
    if (!f.eu && f.nova) lerEsta(false);
  }

  const vivoTimers = new Map();
  let presentes = null; // uid → nome (null até a primeira lista chegar)
  function atualizarPessoas(lista) {
    const outros = lista.filter((p) => !p.eu);
    $('#pessoas').innerHTML = outros.length
      ? outros.map((p) => avatar(p.uid, p.nome)).join('') + '<span>' + esc(outros.map((p) => p.nome + ' ' + bandeira(p.lingua)).join(', ')) + '</span>'
      : 'Ninguém mais na sala ainda — toque em Convidar';
    const agora = new Map(outros.map((p) => [p.uid, p.nome]));
    if (presentes) {
      for (const [id, nome] of agora) if (!presentes.has(id)) { sistema('🐾 ' + nome + ' entrou na sala'); if (vozLigada) miau(); gatoSala.dizer('Miau! Oi, ' + nome + '! 👋'); voar('🐾'); }
      for (const [id, nome] of presentes) if (!agora.has(id)) sistema('👋 ' + nome + ' saiu da sala');
    }
    presentes = agora;
    const ids = new Set();
    outros.forEach((p) => {
      if (!p.vivo) return;
      ids.add(p.uid);
      let el = vivos.get(p.uid);
      if (!el) {
        el = document.createElement('div'); el.className = 'linha vivo'; el.dataset.vivo = 1;
        el.innerHTML = avatar(p.uid, p.nome) + `<div class="msg"><div class="quem pontos">${esc(p.nome)} está falando</div><div class="tr"></div><div class="orig"></div></div>`;
        msgs.appendChild(el); vivos.set(p.uid, el);
      }
      $('.orig', el).textContent = p.vivo;
      clearTimeout(vivoTimers.get(p.uid));
      vivoTimers.set(p.uid, setTimeout(() => traduzir(p.vivo, p.lingua, eu.lingua).then((t) => { $('.tr', el).textContent = t; rolar(); }), 250));
      rolar();
    });
    for (const [id, el] of vivos) if (!ids.has(id)) { el.remove(); vivos.delete(id); clearTimeout(vivoTimers.get(id)); }
  }

  async function entrarSala() {
    const nome = nomeEl.value.trim();
    if (!nome) { nomeEl.focus(); alert('Digite seu nome.'); return; }
    const sala = (salaEl.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || novoCodigo());
    salaEl.value = sala;
    eu = { nome, lingua: linguaEl.value };
    localStorage.setItem('trad-nome', nome); localStorage.setItem('trad-lingua', eu.lingua); localStorage.setItem('trad-sala', sala);
    history.replaceState(null, '', '?sala=' + sala);
    $('#salaCod').textContent = sala;
    msgs.innerHTML = ''; vivos.clear(); porId.clear(); presentes = null; ultimaRecebida = null; $('#avisoSala').hidden = true;
    setTimeout(() => gatoSala.dizer('Miau! Bem-vindo à sala ' + sala + '. Convide alguém e fale no 🎤! 🐾', 5000), 600);
    $('#pessoas').textContent = 'Conectando…';
    mostrarTela('salaTela');
    $('#btVoz').textContent = vozLigada ? '🔊' : '🔇';
    try {
      conexao = await conectar(sala, eu, { fala: bolha, pessoas: atualizarPessoas, aviso: (t) => { const a = $('#avisoSala'); a.textContent = '⚠️ ' + t; a.hidden = false; } });
    } catch (e) { alert('Não foi possível entrar na sala: ' + e.message); mostrarTela('inicio'); }
  }

  function sairSala() {
    ouvinte.parar();
    conexao && conexao.sair();
    conexao = null;
    history.replaceState(null, '', location.pathname);
    $('#convite').hidden = true;
    mostrarTela('inicio');
  }

  const arrumar = (t) => { t = String(t || '').trim(); return t ? t.charAt(0).toLocaleUpperCase() + t.slice(1) : t; };
  function enviarTexto(t) { t = arrumar(t); if (t && conexao) conexao.enviar(t); }
  let segurar = localStorage.getItem('trad-segurar') === '1';
  const mic = $('#mic'), salaOnda = $('#salaOnda');
  let ondaTm = null;
  const ondaForte = (el) => { el.classList.add('forte'); clearTimeout(ondaTm); ondaTm = setTimeout(() => el.classList.remove('forte'), 400); };
  function ligarMicSala() {
    const ok = ouvinte.iniciar(eu.lingua, {
      parcial: (t) => { $('#digitar').placeholder = t || 'Ouvindo…'; if (t) ondaForte(salaOnda); conexao && conexao.vivo(t); },
      final: (t) => { enviarTexto(t); if (ouvinte.ativo) $('#digitar').placeholder = 'Ouvindo…'; },
      erro: (m) => alert(m),
      fim: () => { if (mic.classList.contains('on')) bipe(false); mic.classList.remove('on'); salaOnda.classList.remove('on'); gatoSala.ouvindo(false); $('#digitar').placeholder = 'Fale no microfone ou digite…'; conexao && conexao.vivo(''); }
    });
    if (ok) {
      bipe(true);
      mic.classList.add('on'); salaOnda.classList.add('on'); gatoSala.ouvindo(true);
      gatoSala.dizer(segurar ? 'Fale enquanto segura 👂 Solte para enviar.' : fone ? 'Estou ouvindo 👂 (modo fone: pode falar à vontade)' : 'Estou ouvindo… 👂', 2500);
      $('#digitar').placeholder = 'Ouvindo…';
    }
  }
  mic.onclick = () => { if (segurar) return; if (ouvinte.ativo) ouvinte.parar(); else ligarMicSala(); };
  // Segurar para falar: liga ao encostar e desliga ao soltar (envia o que ouviu)
  mic.addEventListener('pointerdown', (e) => { if (!segurar) return; e.preventDefault(); mic.setPointerCapture && mic.setPointerCapture(e.pointerId); if (!ouvinte.ativo) ligarMicSala(); });
  const soltar = () => { if (segurar && ouvinte.ativo) ouvinte.parar(); };
  mic.addEventListener('pointerup', soltar); mic.addEventListener('pointercancel', soltar);
  mic.addEventListener('contextmenu', (e) => e.preventDefault());
  $('#digitar').addEventListener('keydown', (e) => { if (e.key === 'Enter') { enviarTexto(e.target.value); e.target.value = ''; } });
  $('#entrar').onclick = entrarSala;
  $('#btSair').onclick = sairSala;
  $('#btVoz').onclick = () => { vozLigada = !vozLigada; localStorage.setItem('trad-voz', vozLigada ? '1' : '0'); $('#btVoz').textContent = vozLigada ? '🔊' : '🔇'; if (!vozLigada) { if (plugin('TextToSpeech')) plugin('TextToSpeech').stop().catch(() => {}); else if (window.speechSynthesis) speechSynthesis.cancel(); } };
  const linkSala = () => location.origin + location.pathname + '?sala=' + $('#salaCod').textContent;
  $('#btConvidar').onclick = () => {
    const box = $('#convite'); box.hidden = !box.hidden;
    if (box.hidden) return;
    if (NATIVO) { // no APK não há link (o app roda em https://localhost): convida pelo código
      $('#qrImg').innerHTML = '<div style="font-size:2.6rem;font-weight:800;letter-spacing:.2em;color:#0b0b0b">' + esc($('#salaCod').textContent) + '</div>';
      $('#qrLink').textContent = 'Peça para a outra pessoa abrir o app Clã Speak e entrar na sala com este código.';
      $('#btCopiar').textContent = 'Copiar código';
      return;
    }
    const L = linkSala();
    $('#qrLink').textContent = L;
    try { const qr = qrcode(0, 'M'); qr.addData(L); qr.make(); $('#qrImg').innerHTML = qr.createImgTag(6, 0); } catch (e) { $('#qrImg').textContent = ''; }
  };
  const copiado = (txt, volta) => { $('#btCopiar').textContent = 'Copiado ✓'; setTimeout(() => { $('#btCopiar').textContent = volta; }, 1500); };
  $('#btCompart').onclick = () => {
    const Sh = plugin('Share');
    if (Sh) return Sh.share({ title: 'Clã Speak', text: 'Entre na minha sala do Clã Speak. Código: ' + $('#salaCod').textContent, dialogTitle: 'Convidar para a sala' }).catch(() => {});
    if (navigator.share) return navigator.share({ title: 'Clã Speak', text: 'Entre na minha sala do Clã Speak: ' + $('#salaCod').textContent, url: linkSala() }).catch(() => {});
    $('#btCopiar').onclick();
  };
  $('#btCopiar').onclick = () => NATIVO
    ? navigator.clipboard.writeText($('#salaCod').textContent).then(() => copiado(0, 'Copiar código')).catch(() => prompt('Código da sala:', $('#salaCod').textContent))
    : navigator.clipboard.writeText(linkSala()).then(() => { $('#btCopiar').textContent = 'Copiado ✓'; setTimeout(() => { $('#btCopiar').textContent = 'Copiar link'; }, 1500); }).catch(() => prompt('Copie o link:', linkSala()));
  window.addEventListener('pagehide', () => { conexao && conexao.sair(); });
  // Voltou para a página pelo botão Voltar (cópia guardada pelo navegador): entra de novo na sala.
  window.addEventListener('pageshow', (e) => { if (e.persisted && $('#salaTela').classList.contains('on')) { conexao = null; entrarSala(); } });

  $('#btRepetir').onclick = () => { if (ultimaRecebida) ultimaRecebida(); else gatoSala.dizer('Ainda não chegou nenhuma mensagem para repetir 🐾', 2500); };
  // Emojis que voam para todos da sala
  ['👋', '😂', '❤️', '👍', '😮', '🐱', '🎉', '🙏'].forEach((e) => {
    const b = document.createElement('button'); b.textContent = e;
    b.onclick = () => { if (conexao && conexao.evento) conexao.evento({ tipo: 'emoji', emoji: e }); };
    $('#emojis').appendChild(b);
  });

  // ---------- Modo fone de ouvido ----------
  function definirFone(v) {
    fone = v; localStorage.setItem('trad-fone', v ? '1' : '0');
    $('#fone').checked = v; if ($('#ajFone')) $('#ajFone').checked = v;
    $('#btFone').classList.toggle('ligado', v);
    $('#f2fFone').classList.toggle('ligado', v);
    $('#f2fFone').innerHTML = '🎧<span> Fone' + (v ? ' ✓' : '') + '</span>';
  }
  definirFone(fone);
  $('#fone').onchange = (e) => { definirFone(e.target.checked); gatoInicio.dizer(e.target.checked ? '🎧 Modo fone ligado: falo no seu ouvido e continuo ouvindo você!' : 'Modo fone desligado: pauso o microfone enquanto leio a tradução.'); };
  $('#btFone').onclick = () => { definirFone(!fone); gatoSala.dizer(fone ? '🎧 Modo fone ligado!' : 'Modo fone desligado.', 2500); };

  // ---------- Abas de baixo ----------
  document.querySelectorAll('#abas button').forEach((b) => { b.onclick = () => { ouvinte.parar(); mostrarTela(b.dataset.aba); }; });
  ganchosAba.estudo = () => window.ClaSpeakEstudo && window.ClaSpeakEstudo.abrir();
  const nomeSalvo = localStorage.getItem('trad-nome');
  if (nomeSalvo) setTimeout(() => gatoInicio.dizer('Miau! Que bom te ver, ' + nomeSalvo + '! 😺'), 400);

  // Para a aba Estudar (tradutor-estudo.js)
  window.ClaSpeak = {
    traduzir, traduzirVarias, falar, melhorVoz, ronrom, plop, bandeira, mostrarTela, ganchosAba, definirFone, arrumar,
    get fone() { return fone; },
    get velVoz() { return velVoz; }, set velVoz(v) { velVoz = v; localStorage.setItem('trad-vel', v); },
    get sons() { return sons; }, set sons(v) { sons = v; localStorage.setItem('trad-sons', v ? '1' : '0'); },
    get vozLigada() { return vozLigada; }, set vozLigada(v) { vozLigada = v; localStorage.setItem('trad-voz', v ? '1' : '0'); },
    get segurar() { return segurar; }, set segurar(v) { segurar = v; localStorage.setItem('trad-segurar', v ? '1' : '0'); },
    cacheInfo: () => cache.size, limparCache: () => { cache.clear(); localStorage.removeItem('trad-cache'); }, ouvinte, miau, gato, LINGUAS, preencher, nomeLingua, codTrad, esc, linguaPadrao, minhaLingua: () => linguaEl.value, temVoz: () => !!SR };

  // ---------- Frente a frente ----------
  const lados = {};
  document.querySelectorAll('#f2f .lado').forEach((el) => { lados[el.dataset.lado] = { el, sel: $('select', el), txt: $('.texto', el), mic: $('.mic', el) }; });
  preencher(lados.a.sel, localStorage.getItem('trad-f2f-a') || linguaEl.value);
  preencher(lados.b.sel, localStorage.getItem('trad-f2f-b') || (linguaEl.value.startsWith('en') ? 'es-ES' : 'en-US'));
  Object.entries(lados).forEach(([k, l]) => {
    l.sel.onchange = () => localStorage.setItem('trad-f2f-' + k, l.sel.value);
    l.mic.onclick = () => {
      const outro = lados[k === 'a' ? 'b' : 'a'];
      if (ouvinte.ativo && l.mic.classList.contains('on')) { ouvinte.parar(); return; }
      ouvinte.parar();
      let tm = null;
      const ok = ouvinte.iniciar(l.sel.value, {
        parcial: (t) => {
          if (t) gatoOuveFala(k, t);
          l.txt.innerHTML = '<span class="p">' + esc(t || 'Ouvindo…') + '</span>';
          clearTimeout(tm);
          if (t) tm = setTimeout(() => traduzir(t, l.sel.value, outro.sel.value).then((r) => { outro.txt.innerHTML = '<span class="p">' + esc(r) + '</span>'; }), 250);
        },
        final: async (t) => {
          clearTimeout(tm);
          t = arrumar(t);
          l.txt.textContent = t;
          const r = await traduzir(t, l.sel.value, outro.sel.value);
          entregar(k, r);
          setTimeout(() => {
            outro.txt.textContent = r;
            pulaF2f();
            const para = k === 'a' ? 'b' : 'a';
            if (vozLigada && !r.startsWith('⚠️')) falar(r, outro.sel.value, { aoComecar: () => notas(para, true), aoTerminar: () => { notas(para, false); if (ouvinte.ativo) virarGato(k); } });
          }, 650);
        },
        erro: (m) => alert(m),
        fim: () => { l.mic.classList.remove('on'); f2fGato.classList.remove('escuta'); bipe(false); }
      });
      if (ok) { ultimaPalavras = 0; l.mic.classList.add('on'); virarGato(k); f2fGato.classList.add('escuta'); bipe(true); }
    };
  });
  $('#abrirF2f').onclick = () => { mostrarTela('f2f'); $('#f2fVoz').innerHTML = (vozLigada ? '🔊' : '🔇') + '<span> Voz</span>'; };
  $('#f2fVoz').onclick = () => { vozLigada = !vozLigada; localStorage.setItem('trad-voz', vozLigada ? '1' : '0'); $('#f2fVoz').innerHTML = (vozLigada ? '🔊' : '🔇') + '<span> Voz</span>'; };
  $('#f2fLimpar').onclick = () => { lados.a.txt.textContent = ''; lados.b.txt.textContent = ''; };
  $('#f2fFone').onclick = () => definirFone(!fone);
  const f2fGato = $('#f2fGato'), palco = $('#palco');
  const pulaF2f = () => { f2fGato.classList.remove('pula'); void f2fGato.offsetWidth; f2fGato.classList.add('pula'); };
  f2fGato.onclick = () => { miau(true); pulaF2f(); };
  // O gatinho olha para quem fala (lado "b" fica em cima, de cabeça para baixo)
  const virarGato = (lado) => f2fGato.classList.toggle('paraCima', lado === 'b');
  function soltarNoPalco(el, ms) { palco.appendChild(el); setTimeout(() => el.remove(), ms); }
  // A mensagem atravessa a tela de quem falou para quem ouve, deixando patinhas
  function entregar(de, texto) {
    const c = document.createElement('div'); c.className = 'carta ' + (de === 'a' ? 'sobe' : 'desce');
    c.textContent = '💬 ' + texto; soltarNoPalco(c, 1100);
    for (let i = 0; i < 5; i++) {
      const p = document.createElement('span'); p.className = 'pegada'; p.textContent = '🐾';
      const frac = de === 'a' ? 0.8 - i * 0.15 : 0.2 + i * 0.15;
      p.style.top = (frac * 100) + '%'; p.style.left = (i % 2 ? 56 : 40) + '%';
      p.style.transform = de === 'a' ? '' : 'rotate(180deg)'; p.style.animationDelay = (i * 0.14) + 's';
      soltarNoPalco(p, 1200 + i * 140);
    }
  }
  // Enquanto a pessoa fala: o gatinho balança a cabeça a cada palavra e ondinhas vão até ele
  let ultimaPalavras = 0, ultimaOnda = 0;
  function gatoOuveFala(lado, texto) {
    const n = (texto.trim().match(/\S+/g) || []).length;
    if (n === ultimaPalavras) return;
    ultimaPalavras = n;
    f2fGato.classList.remove('assente'); void f2fGato.offsetWidth; f2fGato.classList.add('assente');
    const ag = Date.now(); if (ag - ultimaOnda < 160) return; ultimaOnda = ag;
    const o = document.createElement('span'); o.className = 'onda2';
    o.textContent = ['🎶', '🎵', '💬', '🔉'][Math.floor(Math.random() * 4)];
    const meio = f2fGato.getBoundingClientRect(), y = meio.top + meio.height / 2;
    const deCima = lado === 'b', inicio = deCima ? y * 0.45 : y + (innerHeight - y) * 0.55;
    o.style.top = inicio + 'px'; if (deCima) o.style.transform = 'rotate(180deg)';
    o.style.setProperty('--dx', (Math.random() * 140 - 70) + 'px'); o.style.setProperty('--dy', (y - inicio) + 'px');
    soltarNoPalco(o, 850);
  }
  let notasTm = null;
  function notas(para, ligar) { // notinhas saindo do gatinho para quem está ouvindo
    clearInterval(notasTm);
    if (!ligar) { f2fGato.classList.remove('cantando'); return; }
    virarGato(para); f2fGato.classList.add('cantando');
    notasTm = setInterval(() => {
      const n = document.createElement('span'); n.className = 'nota' + (para === 'b' ? ' sobe' : '');
      n.textContent = ['🎵', '🎶', '♪', '🐾'][Math.floor(Math.random() * 4)];
      n.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
      soltarNoPalco(n, 1500);
    }, 260);
  }
  $('#f2fSair').onclick = () => { ouvinte.parar(); mostrarTela('inicio'); };

  // Adianta o que demora: a nuvem e a tradução já começam a se preparar com o app aberto
  const ocioso = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
  ocioso(() => { if (window.FIREBASE_CONFIG) preparaNuvem(window.FIREBASE_CONFIG).catch(() => {}); });

  // Link de convite: entra direto se já tiver nome salvo
  if (params.get('sala') && nomeEl.value) entrarSala();

  if (window.speechSynthesis) speechSynthesis.getVoices();
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
