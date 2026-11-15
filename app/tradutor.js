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
  const codTrad = (c) => (/^zh-/.test(c) ? c : c.split('-')[0]);
  const preencher = (sel, valor) => {
    sel.innerHTML = LINGUAS.map(([c, n]) => `<option value="${c}">${n}</option>`).join('');
    sel.value = valor;
  };
  const linguaPadrao = () => {
    const n = navigator.language || 'pt-BR';
    return (LINGUAS.find((l) => l[0].toLowerCase() === n.toLowerCase()) ||
      LINGUAS.find((l) => l[0].split('-')[0] === n.split('-')[0]) || LINGUAS[0])[0];
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Tradução ----------
  const cache = new Map();
  async function traduzir(texto, de, para) {
    texto = (texto || '').trim();
    if (!texto) return '';
    const sl = codTrad(de), tl = codTrad(para);
    if (sl === tl) return texto;
    const k = sl + '|' + tl + '|' + texto;
    if (cache.has(k)) return cache.get(k);
    let r = '';
    try {
      const u = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=' + sl + '&tl=' + tl + '&q=' + encodeURIComponent(texto);
      const j = await (await fetch(u)).json();
      r = (j[0] || []).map((p) => p[0]).join('');
    } catch (e) { /* tenta a reserva */ }
    if (!r) {
      try {
        const u = 'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=' + sl + '&tl=' + tl + '&q=' + encodeURIComponent(texto);
        const j = await (await fetch(u)).json();
        const x = Array.isArray(j) ? j[0] : null;
        r = (Array.isArray(x) ? x[0] : x) || '';
      } catch (e) { /* tenta a próxima */ }
    }
    if (!r) {
      try {
        const u = 'https://api.mymemory.translated.net/get?langpair=' + sl + '|' + tl + '&q=' + encodeURIComponent(texto.slice(0, 480));
        const j = await (await fetch(u)).json();
        r = (j.responseData && j.responseData.translatedText) || '';
      } catch (e) { /* sem internet */ }
    }
    if (!r) return '⚠️ (sem tradução: verifique a internet) ' + texto;
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    cache.set(k, r);
    return r;
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
          if (t && !this.acabou) { this.ultimo = t; this._emitir(t, false); }
        }));
        // "stopped" chega antes do resultado final: espera um pouco por ele
        this.handles.push(await P.addListener('listeningState', (d) => { if (d.status === 'stopped') setTimeout(() => this._fim(), 700); }));
        const inicio = Date.now();
        // Silêncio ou erro não geram aviso no plugin: confere se ainda está ouvindo
        this.vigia = setInterval(() => {
          if (Date.now() - inicio < 1500) return;
          P.isListening().then((r) => { if (!r.listening) setTimeout(() => this._fim(), 500); }).catch(() => {});
        }, 1000);
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
  const falando = { n: 0 };
  function falar(texto, lingua, opc = {}) {
    if ((!vozLigada && !opc.sempre) || !texto) return;
    const vel = opc.vel || 1.0;
    const TTS = plugin('TextToSpeech');
    if (TTS) {
      falando.n++;
      if (!fone) ouvinte.pausar(true);
      const fimN = () => { falando.n = Math.max(0, falando.n - 1); if (!falando.n && ouvinte.pausado) setTimeout(() => ouvinte.pausar(false), 250); };
      TTS.speak({ text: texto, lang: lingua, rate: vel, queueStrategy: 1 }).then(fimN, fimN);
      return;
    }
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = lingua; u.rate = vel;
    const vs = speechSynthesis.getVoices();
    const v = vs.find((x) => x.lang.replace('_', '-') === lingua) || vs.find((x) => x.lang.startsWith(lingua.split('-')[0]));
    if (v) u.voice = v;
    falando.n++;
    if (!fone) ouvinte.pausar(true); // sem fone, o microfone não pode ouvir a própria tradução
    const fim = () => { falando.n = Math.max(0, falando.n - 1); if (!falando.n && ouvinte.pausado) setTimeout(() => ouvinte.pausar(false), 250); };
    u.onend = fim; u.onerror = fim;
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
      r.onend = () => { if (this.rec === r) { this.rec = null; if (this.ativo && !this.pausado) setTimeout(() => this._abrir(), 150); else if (!this.ativo) this.cb && this.cb.fim && this.cb.fim(); } };
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
  function miau() { // miado curtinho feito com o som do próprio aparelho
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime, o = audio.createOscillator(), f = audio.createBiquadFilter(), g = audio.createGain();
      o.type = 'sawtooth'; f.type = 'bandpass'; f.Q.value = 4;
      o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(880, t + 0.16); o.frequency.linearRampToValueAtTime(560, t + 0.55);
      f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(2000, t + 0.18); f.frequency.linearRampToValueAtTime(700, t + 0.55);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.05); g.gain.setValueAtTime(0.35, t + 0.38); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(f); f.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.62);
    } catch (e) { /* sem áudio */ }
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
    img.addEventListener('click', () => { miau(); g.dizer(FRASES_GATO[Math.floor(Math.random() * FRASES_GATO.length)]); });
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

  async function conectarFirebase(cfg, sala, eu, h) {
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
      if (ag - ultimo > 500) { ultimo = ag; pessoa.update({ vivo: texto }).catch(() => {}); pend = null; }
      else if (!tm) tm = setTimeout(() => { tm = null; if (pend !== null) { ultimo = Date.now(); pessoa.update({ vivo: pend }).catch(() => {}); pend = null; } }, 500);
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
  const mostrarTela = (id) => { document.querySelectorAll('.tela,#f2f').forEach((t) => t.classList.toggle('on', t.id === id)); };

  // ---------- Sala ----------
  let conexao = null, eu = null;
  const msgs = $('#msgs');
  const vivos = new Map(); // uid → elemento da bolha "falando agora"

  const rolar = () => { msgs.scrollTop = msgs.scrollHeight; };
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
    const quem = f.eu ? 'Você' : esc(f.nome || 'Alguém') + ' · ' + esc(nomeLingua(f.lingua));
    const mesma = codTrad(f.lingua) === codTrad(eu.lingua);
    d.innerHTML = avatar(f.uid, f.eu ? eu.nome : f.nome) + `<div class="msg"><div class="quem">${quem}</div><div class="tr">${esc(f.eu || mesma ? f.texto : '…')}</div>` +
      (f.eu || mesma ? '' : `<div class="orig">${esc(f.texto)}</div>`) +
      '<div class="acoes">' + (f.eu ? '' : '<button class="ouvir">🔊 ouvir</button>') + '<button class="curtir" title="Curtir">❤️</button><button class="rir" title="Rir">😂</button></div><div class="reacoes"></div></div>';
    if (f.id) porId.set(f.id, { linha: d, reacoes: new Map() });
    $('.curtir', d).onclick = () => reagir(f.id, '❤️');
    $('.rir', d).onclick = () => reagir(f.id, '😂');
    $('.msg', d).addEventListener('dblclick', () => reagir(f.id, '❤️'));
    inserir(d);
    if (!f.eu && f.nova) { const img = $('#gatoSala img'); img.classList.remove('pula'); void img.offsetWidth; img.classList.add('pula'); }
    const tr = $('.tr', d);
    const pronto = (f.eu || mesma) ? Promise.resolve(f.texto) : traduzir(f.texto, f.lingua, eu.lingua).then((t) => { tr.textContent = t; rolar(); return t; });
    const btn = $('.ouvir', d);
    if (btn) btn.onclick = () => { const v = vozLigada; vozLigada = true; pronto.then((t) => { falar(t, eu.lingua); vozLigada = v; }); };
    if (!f.eu && f.nova) pronto.then((t) => falar(t, eu.lingua));
  }

  const vivoTimers = new Map();
  let presentes = null; // uid → nome (null até a primeira lista chegar)
  function atualizarPessoas(lista) {
    const outros = lista.filter((p) => !p.eu);
    $('#pessoas').innerHTML = outros.length
      ? outros.map((p) => avatar(p.uid, p.nome)).join('') + '<span>' + esc(outros.map((p) => p.nome + ' (' + nomeLingua(p.lingua) + ')').join(', ')) + '</span>'
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
      vivoTimers.set(p.uid, setTimeout(() => traduzir(p.vivo, p.lingua, eu.lingua).then((t) => { $('.tr', el).textContent = t; rolar(); }), 500));
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
    msgs.innerHTML = ''; vivos.clear(); porId.clear(); presentes = null; $('#avisoSala').hidden = true;
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

  function enviarTexto(t) { t = t.trim(); if (t && conexao) conexao.enviar(t); }
  const mic = $('#mic');
  mic.onclick = () => {
    if (ouvinte.ativo) { ouvinte.parar(); return; }
    const ok = ouvinte.iniciar(eu.lingua, {
      parcial: (t) => { $('#digitar').placeholder = t || 'Ouvindo…'; conexao && conexao.vivo(t); },
      final: (t) => { enviarTexto(t); $('#digitar').placeholder = 'Ouvindo…'; },
      erro: (m) => alert(m),
      fim: () => { mic.classList.remove('on'); gatoSala.ouvindo(false); $('#digitar').placeholder = 'Fale no microfone ou digite…'; conexao && conexao.vivo(''); }
    });
    if (ok) { mic.classList.add('on'); gatoSala.ouvindo(true); gatoSala.dizer(fone ? 'Estou ouvindo 👂 (modo fone: pode falar à vontade)' : 'Estou ouvindo… 👂', 2500); $('#digitar').placeholder = 'Ouvindo…'; }
  };
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

  // Emojis que voam para todos da sala
  ['👋', '😂', '❤️', '👍', '😮', '🐱', '🎉', '🙏'].forEach((e) => {
    const b = document.createElement('button'); b.textContent = e;
    b.onclick = () => { if (conexao && conexao.evento) conexao.evento({ tipo: 'emoji', emoji: e }); };
    $('#emojis').appendChild(b);
  });

  // ---------- Modo fone de ouvido ----------
  function definirFone(v) {
    fone = v; localStorage.setItem('trad-fone', v ? '1' : '0');
    $('#fone').checked = v;
    $('#btFone').classList.toggle('ligado', v);
    $('#f2fFone').classList.toggle('ligado', v);
    $('#f2fFone').textContent = '🎧 Fone: ' + (v ? 'sim' : 'não');
  }
  definirFone(fone);
  $('#fone').onchange = (e) => { definirFone(e.target.checked); gatoInicio.dizer(e.target.checked ? '🎧 Modo fone ligado: falo no seu ouvido e continuo ouvindo você!' : 'Modo fone desligado: pauso o microfone enquanto leio a tradução.'); };
  $('#btFone').onclick = () => { definirFone(!fone); gatoSala.dizer(fone ? '🎧 Modo fone ligado!' : 'Modo fone desligado.', 2500); };

  // ---------- Abas de baixo ----------
  document.querySelectorAll('.abas button').forEach((b) => { b.onclick = () => { ouvinte.parar(); mostrarTela(b.dataset.aba); if (b.dataset.aba === 'estudo' && window.ClaSpeakEstudo) window.ClaSpeakEstudo.abrir(); }; });
  const nomeSalvo = localStorage.getItem('trad-nome');
  if (nomeSalvo) setTimeout(() => gatoInicio.dizer('Miau! Que bom te ver, ' + nomeSalvo + '! 😺'), 400);

  // Para a aba Estudar (tradutor-estudo.js)
  window.ClaSpeak = { traduzir, falar, ouvinte, miau, gato, LINGUAS, preencher, nomeLingua, codTrad, esc, linguaPadrao, minhaLingua: () => linguaEl.value, temVoz: () => !!SR };

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
          l.txt.innerHTML = '<span class="p">' + esc(t || 'Ouvindo…') + '</span>';
          clearTimeout(tm);
          if (t) tm = setTimeout(() => traduzir(t, l.sel.value, outro.sel.value).then((r) => { outro.txt.innerHTML = '<span class="p">' + esc(r) + '</span>'; }), 500);
        },
        final: async (t) => {
          clearTimeout(tm);
          l.txt.textContent = t;
          const r = await traduzir(t, l.sel.value, outro.sel.value);
          outro.txt.textContent = r;
          falar(r, outro.sel.value);
        },
        erro: (m) => alert(m),
        fim: () => l.mic.classList.remove('on')
      });
      if (ok) l.mic.classList.add('on');
    };
  });
  $('#abrirF2f').onclick = () => { mostrarTela('f2f'); $('#f2fVoz').textContent = '🔊 Voz: ' + (vozLigada ? 'ligada' : 'desligada'); };
  $('#f2fVoz').onclick = () => { vozLigada = !vozLigada; localStorage.setItem('trad-voz', vozLigada ? '1' : '0'); $('#f2fVoz').textContent = '🔊 Voz: ' + (vozLigada ? 'ligada' : 'desligada'); };
  $('#f2fLimpar').onclick = () => { lados.a.txt.textContent = ''; lados.b.txt.textContent = ''; };
  $('#f2fFone').onclick = () => definirFone(!fone);
  $('#f2fSair').onclick = () => { ouvinte.parar(); mostrarTela('inicio'); };

  // Link de convite: entra direto se já tiver nome salvo
  if (params.get('sala') && nomeEl.value) entrarSala();

  if (window.speechSynthesis) speechSynthesis.getVoices();
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
