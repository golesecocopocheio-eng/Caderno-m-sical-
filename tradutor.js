/* Tradutor ao Vivo: fala → texto → tradução → voz, entre celulares (sala) ou num celular só (frente a frente).
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

  // ---------- Voz: falar ----------
  let vozLigada = localStorage.getItem('trad-voz') !== '0';
  const falando = { n: 0 };
  function falar(texto, lingua) {
    if (!vozLigada || !window.speechSynthesis || !texto) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = lingua;
    const vs = speechSynthesis.getVoices();
    const v = vs.find((x) => x.lang.replace('_', '-') === lingua) || vs.find((x) => x.lang.startsWith(lingua.split('-')[0]));
    if (v) u.voice = v;
    falando.n++;
    ouvinte.pausar(true); // o microfone não pode ouvir a própria tradução
    const fim = () => { falando.n = Math.max(0, falando.n - 1); if (!falando.n) setTimeout(() => ouvinte.pausar(false), 250); };
    u.onend = fim; u.onerror = fim;
    speechSynthesis.speak(u);
  }

  // ---------- Voz: ouvir ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
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

  // ---------- Transporte (nuvem ou abas do aparelho) ----------
  const uid = 'u' + Math.random().toString(36).slice(2, 10); // modo local: cada aba é uma pessoa
  const loadScript = (src) => new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = err; document.head.appendChild(s); });

  async function conectar(sala, eu, h) {
    const cfg = window.FIREBASE_CONFIG;
    if (cfg) {
      try { return await conectarFirebase(cfg, sala, eu, h); } catch (e) { console.warn('Firebase indisponível, usando só este aparelho', e); h.aviso && h.aviso('Sem conexão com a nuvem: a sala funciona só neste aparelho.'); }
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
    const meu = user.uid;
    const db = app.firestore();
    const base = db.collection('salas').doc(sala);
    const pessoa = base.collection('pessoas').doc(meu);
    const entrada = Date.now();
    await pessoa.set({ nome: eu.nome, lingua: eu.lingua, t: Date.now(), vivo: '' });
    const pulso = setInterval(() => pessoa.update({ t: Date.now() }).catch(() => {}), 30000);
    const offs = [];
    offs.push(base.collection('falas').orderBy('t').limitToLast(60).onSnapshot((s) => {
      s.docChanges().forEach((c) => { if (c.type === 'added') { const d = c.doc.data(); h.fala({ ...d, id: c.doc.id, eu: d.uid === meu, nova: d.t >= entrada }); } });
    }, (e) => h.aviso && h.aviso('Sem permissão na nuvem (publique as regras do firestore.rules).')));
    offs.push(base.collection('pessoas').onSnapshot((s) => {
      const agora = Date.now();
      h.pessoas(s.docs.map((d) => ({ ...d.data(), uid: d.id, eu: d.id === meu })).filter((p) => agora - p.t < 120000));
    }));
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
      vivo,
      sair: () => { clearInterval(pulso); offs.forEach((f) => f()); return pessoa.delete().catch(() => {}); }
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
      if (m.tipo === 'fala') { if (pessoas.has(m.f.uid)) pessoas.get(m.f.uid).vivo = ''; mostrar(); h.fala({ ...m.f, eu: false, nova: true }); }
    };
    anunciar(); mostrar();
    return {
      nuvem: false,
      enviar: (texto) => { const f = { id: uid + Date.now(), uid, nome: eu.nome, lingua: eu.lingua, texto, t: Date.now() }; bc && bc.postMessage({ tipo: 'fala', f }); h.fala({ ...f, eu: true, nova: true }); },
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
  function bolha(f) {
    const d = document.createElement('div');
    d.className = 'msg' + (f.eu ? ' eu' : '');
    const quem = f.eu ? 'Você' : esc(f.nome || 'Alguém') + ' · ' + esc(nomeLingua(f.lingua));
    const mesma = codTrad(f.lingua) === codTrad(eu.lingua);
    d.innerHTML = `<div class="quem">${quem}</div><div class="tr">${esc(f.eu || mesma ? f.texto : '…')}</div>` +
      (f.eu || mesma ? '' : `<div class="orig">${esc(f.texto)}</div>`) +
      (f.eu ? '' : '<button class="ouvir">🔊 ouvir</button>');
    const pos = [...msgs.children].find((x) => x.dataset.vivo);
    msgs.insertBefore(d, pos || null);
    rolar();
    const tr = $('.tr', d);
    const pronto = (f.eu || mesma) ? Promise.resolve(f.texto) : traduzir(f.texto, f.lingua, eu.lingua).then((t) => { tr.textContent = t; rolar(); return t; });
    const btn = $('.ouvir', d);
    if (btn) btn.onclick = () => { const v = vozLigada; vozLigada = true; pronto.then((t) => { falar(t, eu.lingua); vozLigada = v; }); };
    if (!f.eu && f.nova) pronto.then((t) => falar(t, eu.lingua));
  }

  const vivoTimers = new Map();
  function atualizarPessoas(lista) {
    const outros = lista.filter((p) => !p.eu);
    $('#pessoas').textContent = outros.length ? 'Na sala: ' + outros.map((p) => p.nome + ' (' + nomeLingua(p.lingua) + ')').join(', ') : 'Ninguém mais na sala ainda — toque em Convidar';
    const ids = new Set();
    outros.forEach((p) => {
      if (!p.vivo) return;
      ids.add(p.uid);
      let el = vivos.get(p.uid);
      if (!el) {
        el = document.createElement('div'); el.className = 'msg vivo'; el.dataset.vivo = 1;
        el.innerHTML = `<div class="quem">${esc(p.nome)} está falando…</div><div class="tr"></div><div class="orig"></div>`;
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
    msgs.innerHTML = ''; vivos.clear();
    $('#pessoas').textContent = 'Conectando…';
    mostrarTela('salaTela');
    $('#btVoz').textContent = vozLigada ? '🔊' : '🔇';
    try {
      conexao = await conectar(sala, eu, { fala: bolha, pessoas: atualizarPessoas, aviso: (t) => { $('#pessoas').textContent = t; } });
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
      fim: () => { mic.classList.remove('on'); $('#digitar').placeholder = 'Fale no microfone ou digite…'; conexao && conexao.vivo(''); }
    });
    if (ok) { mic.classList.add('on'); $('#digitar').placeholder = 'Ouvindo…'; }
  };
  $('#digitar').addEventListener('keydown', (e) => { if (e.key === 'Enter') { enviarTexto(e.target.value); e.target.value = ''; } });
  $('#entrar').onclick = entrarSala;
  $('#btSair').onclick = sairSala;
  $('#btVoz').onclick = () => { vozLigada = !vozLigada; localStorage.setItem('trad-voz', vozLigada ? '1' : '0'); $('#btVoz').textContent = vozLigada ? '🔊' : '🔇'; if (!vozLigada && window.speechSynthesis) speechSynthesis.cancel(); };
  const linkSala = () => location.origin + location.pathname + '?sala=' + $('#salaCod').textContent;
  $('#btConvidar').onclick = () => {
    const box = $('#convite'); box.hidden = !box.hidden;
    if (box.hidden) return;
    const L = linkSala();
    $('#qrLink').textContent = L;
    try { const qr = qrcode(0, 'M'); qr.addData(L); qr.make(); $('#qrImg').innerHTML = qr.createImgTag(6, 0); } catch (e) { $('#qrImg').textContent = ''; }
  };
  $('#btCopiar').onclick = () => navigator.clipboard.writeText(linkSala()).then(() => { $('#btCopiar').textContent = 'Copiado ✓'; setTimeout(() => { $('#btCopiar').textContent = 'Copiar link'; }, 1500); }).catch(() => prompt('Copie o link:', linkSala()));
  $('#btCompart').onclick = () => navigator.share ? navigator.share({ title: 'Clã Speak', text: 'Entre na minha sala de tradução: ' + $('#salaCod').textContent, url: linkSala() }).catch(() => {}) : $('#btCopiar').onclick();
  window.addEventListener('pagehide', () => { conexao && conexao.sair(); });

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
  $('#f2fSair').onclick = () => { ouvinte.parar(); mostrarTela('inicio'); };

  // Link de convite: entra direto se já tiver nome salvo
  if (params.get('sala') && nomeEl.value) entrarSala();

  if (window.speechSynthesis) speechSynthesis.getVoices();
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
