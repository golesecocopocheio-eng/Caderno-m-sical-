/* Clã Speak · aba 🎓 Saber: cultura e dúvidas (literatura, artes, história, ciência…).
 * As respostas vêm da Wikipédia (API pública e gratuita, conteúdo CC BY-SA): busca a pergunta,
 * mostra o resumo do artigo mais relevante com imagem, lê em voz alta e mostra o mesmo artigo
 * em outro idioma para treinar leitura. */
(() => {
  'use strict';
  const C = window.ClaSpeak;
  if (!C) return;
  const $ = (s, r = document) => r.querySelector(s);
  const gato = C.gato('gatoSaber');
  const emo = (t) => window.ClaSpeakEmocao && window.ClaSpeakEmocao(t, $('#gatoSaber img'));

  const TEMAS = [
    { ico: '📚', nome: 'Literatura', itens: ['Machado de Assis', 'Dom Casmurro', 'William Shakespeare', 'Dom Quixote', 'Clarice Lispector', 'Fernando Pessoa', 'Carlos Drummond de Andrade'] },
    { ico: '🎨', nome: 'Artes', itens: ['Mona Lisa', 'Vincent van Gogh', 'Tarsila do Amaral', 'Frida Kahlo', 'Pablo Picasso', 'Michelangelo', 'Abaporu'] },
    { ico: '🏛️', nome: 'História', itens: ['Independência do Brasil', 'Revolução Francesa', 'Antigo Egito', 'Império Romano', 'Segunda Guerra Mundial', 'Grandes Navegações', 'Abolição da escravatura no Brasil'] },
    { ico: '🔬', nome: 'Ciência', itens: ['Sistema Solar', 'Albert Einstein', 'Ácido desoxirribonucleico', 'Fotossíntese', 'Marie Curie', 'Buraco negro', 'Isaac Newton'] },
    { ico: '🌍', nome: 'Geografia', itens: ['Floresta Amazônica', 'Rio Amazonas', 'Monte Everest', 'Saara', 'Oceano Pacífico', 'Cataratas do Iguaçu', 'Pantanal'] },
    { ico: '🎵', nome: 'Música', itens: ['Bossa nova', 'Reggae', 'Bob Marley', 'Samba', 'Ludwig van Beethoven', 'Tom Jobim', 'Wolfgang Amadeus Mozart'] },
    { ico: '🤔', nome: 'Filosofia', itens: ['Sócrates', 'Platão', 'Aristóteles', 'Ética', 'Lógica', 'René Descartes', 'Friedrich Nietzsche'] },
    { ico: '⚽', nome: 'Esportes', itens: ['Futebol', 'Pelé', 'Jogos Olímpicos', 'Copa do Mundo FIFA', 'Capoeira', 'Ayrton Senna', 'Marta (futebolista)'] }
  ];

  // Wikipédia no idioma da pessoa (zh-CN/zh-TW → zh)
  const wikiDe = (l) => C.codTrad(l).split('-')[0];
  let wiki = wikiDe(C.minhaLingua());
  const buscar = async (u, ms = 9000) => { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms); try { const r = await fetch(u, { signal: ctl.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(t); } };
  const api = (w, q) => buscar('https://' + w + '.wikipedia.org/w/api.php?' + q + '&format=json&origin=*');
  const resumo = (w, titulo) => buscar('https://' + w + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(titulo.replace(/ /g, '_')));

  // Tira palavras de pergunta para a busca achar o assunto ("Quem pintou a Mona Lisa?" → "pintou Mona Lisa")
  const limparPergunta = (q) => q.replace(/[?¿!¡.]/g, ' ')
    .replace(/^\s*(quem|o que|que|qual|quais|quando|onde|como|por que|porque|quanto|quantos|quantas|me fale sobre|fale sobre|explique|what|who|when|where|why|how|which|qué|quién|cuándo|dónde|cómo|por qué)\b/i, '')
    .replace(/\b(é|foi|era|são|eram|o|a|os|as|um|uma|de|do|da|dos|das|is|was|the|a|an|of|el|la|los|las)\b/gi, ' ').replace(/\s+/g, ' ').trim();

  // ---------- Mostrar um artigo ----------
  let atual = null; // { w, titulo, texto }
  const resp = $('#sbResp');
  function carregando(msg) {
    resp.hidden = false; $('#sbImg').hidden = true; $('#sbTitulo').textContent = '🔎 ' + msg; $('#sbDesc').textContent = '';
    $('#sbTexto').textContent = 'Procurando…'; $('#sbTexto').classList.add('carregando'); $('#sbVeja').textContent = '';
  }
  function mostrar(d, w, veja) {
    atual = { w, titulo: d.title, texto: d.extract || '' };
    $('#sbTitulo').textContent = d.title; $('#sbDesc').textContent = d.description || '';
    $('#sbTexto').classList.remove('carregando'); $('#sbTexto').textContent = d.extract || 'Sem resumo para este assunto.';
    const img = $('#sbImg'); if (d.thumbnail && d.thumbnail.source) { img.src = d.thumbnail.source; img.hidden = false; } else img.hidden = true;
    $('#sbMais').href = (d.content_urls && d.content_urls.mobile && d.content_urls.mobile.page) || ('https://' + w + '.wikipedia.org/wiki/' + encodeURIComponent(d.title));
    const vj = $('#sbVeja'); vj.innerHTML = '';
    if (veja && veja.length) {
      vj.append('Veja também: ');
      veja.forEach((t, i) => { const a = document.createElement('a'); a.href = '#'; a.textContent = t; a.onclick = (e) => { e.preventDefault(); abrirArtigo(t, w); }; vj.append(a); if (i < veja.length - 1) vj.append(' · '); });
    }
    resp.scrollIntoView({ behavior: 'smooth', block: 'start' });
    guardarHist(d.title, w);
    aposMostrar();
  }
  function falhou(msg) {
    $('#sbTexto').classList.remove('carregando'); $('#sbTitulo').textContent = '😿 Não achei';
    $('#sbTexto').textContent = msg || 'Não encontrei uma resposta. Tente com outras palavras.';
    gato.dizer('Não achei 😿 Tente perguntar de outro jeito'); emo('triste');
  }
  async function abrirArtigo(titulo, w = wiki) {
    carregando(titulo); gato.dizer('Deixa eu ver… 🔎');
    try {
      let d = await resumo(w, titulo);
      // assunto pronto em português e a pessoa lê outro idioma: vai para a Wikipédia dela
      if (w !== wiki) { const outro = await noOutroIdioma(titulo, w, wiki); if (outro) { d = outro; w = wiki; } }
      mostrar(d, w); gato.dizer('Achei! 📖 Toque em 🔊 para ouvir.'); emo('feliz');
    } catch (e) { falhou(e.name === 'AbortError' ? 'A internet está lenta. Tente de novo.' : null); }
  }
  async function perguntar(q) {
    q = (q || '').trim(); if (!q) { gato.dizer('Escreva ou fale uma pergunta 🎤'); return; }
    carregando(q); gato.dizer('Deixa eu procurar… 🔎'); emo('surpreso');
    try {
      let r = await api(wiki, 'action=query&list=search&srlimit=5&srsearch=' + encodeURIComponent(limparPergunta(q) || q));
      let lista = (r.query && r.query.search) || [];
      if (!lista.length) { r = await api(wiki, 'action=query&list=search&srlimit=5&srsearch=' + encodeURIComponent(q)); lista = (r.query && r.query.search) || []; }
      if (!lista.length) return falhou();
      const d = await resumo(wiki, lista[0].title);
      mostrar(d, wiki, lista.slice(1, 4).map((x) => x.title));
      gato.dizer('Achei a resposta! 📖'); emo('feliz');
    } catch (e) { falhou(e.name === 'AbortError' ? 'A internet está lenta. Tente de novo.' : 'Sem conexão com a Wikipédia agora. Verifique a internet.'); }
  }
  // O mesmo artigo em outra língua (pelos links entre idiomas da Wikipédia)
  async function noOutroIdioma(titulo, de, para) {
    const r = await api(de, 'action=query&prop=langlinks&lllimit=1&lllang=' + para + '&titles=' + encodeURIComponent(titulo));
    const pg = r.query && r.query.pages && Object.values(r.query.pages)[0];
    const t = pg && pg.langlinks && pg.langlinks[0] && pg.langlinks[0]['*'];
    return t ? resumo(para, t) : null;
  }

  // ---------- Botões ----------
  $('#sbPerguntar').onclick = () => perguntar($('#sbPergunta').value);
  $('#sbPergunta').addEventListener('keydown', (e) => { if (e.key === 'Enter') perguntar(e.target.value); });
  $('#sbMic').onclick = () => {
    if (C.ouvinte.ativo) { C.ouvinte.parar(); return; }
    const ok = C.ouvinte.iniciar(C.minhaLingua(), {
      parcial: (t) => { $('#sbPergunta').value = t; },
      final: (t) => { C.ouvinte.parar(); $('#sbPergunta').value = t; perguntar(t); },
      erro: (m) => gato.dizer(m),
      fim: () => { $('#sbMic').textContent = '🎤'; gato.ouvindo(false); }
    });
    if (ok) { $('#sbMic').textContent = '⏹'; gato.ouvindo(true); gato.dizer('Pode perguntar! 👂'); }
  };
  $('#sbSorte').onclick = async () => {
    carregando('Curiosidade'); gato.dizer('Vamos descobrir algo novo! 🎲');
    try { const d = await buscar('https://' + wiki + '.wikipedia.org/api/rest_v1/page/random/summary'); mostrar(d, wiki); emo('surpreso'); }
    catch (e) { falhou('Sem conexão com a Wikipédia agora.'); }
  };
  // Temas e assuntos prontos
  const temasEl = $('#sbTemas'), assuntos = $('#sbAssuntos');
  TEMAS.forEach((t, i) => {
    const b = document.createElement('button'); b.innerHTML = '<b>' + t.ico + '</b>' + t.nome;
    b.onclick = () => {
      const aberto = b.classList.contains('on');
      temasEl.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      if (aberto) { assuntos.hidden = true; return; }
      b.classList.add('on'); assuntos.hidden = false;
      assuntos.innerHTML = ''; TEMAS[i].itens.forEach((it) => { const a = document.createElement('button'); a.textContent = it.replace(/ \(.*\)$/, ''); a.onclick = () => abrirArtigo(it, 'pt'); assuntos.appendChild(a); });
      gato.dizer(t.ico + ' ' + t.nome + '! Escolha um assunto.'); gato.pular();
    };
    temasEl.appendChild(b);
  });
  // Ler / outro idioma / copiar

  C.preencher($('#sbLingua'), localStorage.getItem('trad-sb-lingua') || localStorage.getItem('trad-cv-lingua') || (C.minhaLingua().startsWith('en') ? 'es-ES' : 'en-US'));
  $('#sbLingua').onchange = () => { localStorage.setItem('trad-sb-lingua', $('#sbLingua').value); prepararVocab(); };
  $('#sbOutra').onclick = async () => {
    if (!atual) return;
    const para = wikiDe($('#sbLingua').value);
    if (para === atual.w) { gato.dizer('Já está nesse idioma 😉'); return; }
    gato.dizer('Buscando em ' + C.bandeira($('#sbLingua').value) + ' ' + C.nomeLingua($('#sbLingua').value) + '…');
    try {
      const d = await noOutroIdioma(atual.titulo, atual.w, para);
      if (d) { mostrar(d, para); gato.dizer('Agora é treinar a leitura! 📖 Toque em 🔊'); return; }
      // sem artigo nesse idioma: traduz o resumo
      const t = await C.traduzir(atual.texto, atual.w === wiki ? C.minhaLingua() : atual.w, $('#sbLingua').value);
      atual = { ...atual, w: para, texto: t }; $('#sbTexto').textContent = t; aposMostrar(); gato.dizer('Traduzi o resumo para você 🌍');
    } catch (e) { gato.dizer('Não consegui agora 😿'); }
  };
  $('#sbCopiar').onclick = () => { if (!atual) return; (navigator.clipboard ? navigator.clipboard.writeText(atual.titulo + '\n\n' + atual.texto) : Promise.reject()).then(() => gato.dizer('Copiado! 📋')).catch(() => prompt('Copie:', atual.texto)); };

  // Histórico
  function guardarHist(titulo, w) {
    let h = []; try { h = JSON.parse(localStorage.getItem('trad-sb-hist') || '[]'); } catch (e) {}
    h = [{ titulo, w }, ...h.filter((x) => x.titulo !== titulo)].slice(0, 10);
    localStorage.setItem('trad-sb-hist', JSON.stringify(h)); desenharHist();
  }
  function desenharHist() {
    let h = []; try { h = JSON.parse(localStorage.getItem('trad-sb-hist') || '[]'); } catch (e) {}
    const el = $('#sbHist'); el.innerHTML = h.length ? '' : '<p class="mu">Suas perguntas aparecem aqui.</p>';
    h.forEach((x) => { const d = document.createElement('div'); d.className = 'item'; d.textContent = '📖 ' + x.titulo; d.onclick = () => abrirArtigo(x.titulo, x.w); el.appendChild(d); });
  }
  desenharHist();
  // =================== Recursos de estudo do artigo ===================
  const langDe = (w) => (w === wiki ? C.minhaLingua() : ([...$('#sbLingua').options].map((o) => o.value).find((v) => wikiDe(v) === w) || w));
  const frasesDe = (t) => String(t || '').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  const palavrasDe = (t) => [...String(t).matchAll(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu)].map((m) => m[0]);
  function aposMostrar() { pararLeitura(); prepararVocab(); prepararQuiz(); atualizarFav(); }

  // ▶ Leitura guiada: lê frase por frase, destacando a que está sendo lida
  let lendo = false;
  function pararLeitura() {
    lendo = false; $('#sbOuvir').textContent = '▶ Leitura guiada';
    try { window.speechSynthesis && speechSynthesis.cancel(); const T = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech; T && T.stop && T.stop().catch(() => {}); } catch (e) {}
    $('#sbTexto').querySelectorAll('.lendo').forEach((x) => x.classList.remove('lendo'));
  }
  $('#sbOuvir').onclick = () => {
    if (!atual || !atual.texto) return;
    if (lendo) { pararLeitura(); return; }
    const fr = frasesDe(atual.texto); if (!fr.length) return;
    $('#sbTexto').innerHTML = fr.map((f) => '<span class="fr">' + C.esc(f) + '</span>').join(' ');
    const spans = $('#sbTexto').querySelectorAll('.fr'), lang = langDe(atual.w);
    lendo = true; $('#sbOuvir').textContent = '⏹ Parar'; gato.ouvindo(false); let i = 0;
    const prox = () => {
      spans.forEach((x) => x.classList.remove('lendo'));
      if (!lendo || i >= spans.length) { if (lendo) { pararLeitura(); gato.dizer('Fim da leitura! Que tal o 🧩 teste? 😺'); gato.pular(); } return; }
      spans[i].classList.add('lendo'); spans[i].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      C.falar(fr[i], lang, { sempre: true, vel: 0.95, aoTerminar: () => { i++; setTimeout(prox, 120); } });
    };
    prox();
  };

  // 📝 Vocabulário: palavras importantes do artigo traduzidas para o idioma estudado
  async function prepararVocab() {
    const card = $('#sbVocabCard'), box = $('#sbVocab'); card.hidden = true; box.innerHTML = '';
    if (!atual || !atual.texto) return;
    const origem = langDe(atual.w); let destino = $('#sbLingua').value;
    if (C.codTrad(destino) === C.codTrad(origem)) destino = C.minhaLingua();
    if (C.codTrad(destino) === C.codTrad(origem)) return;
    const frases = frasesDe(atual.texto), iniciais = new Set(frases.map((f) => (palavrasDe(f)[0] || '').toLowerCase()));
    const vistos = new Set(), lista = [];
    palavrasDe(atual.texto).forEach((w) => {
      const lw = w.toLowerCase();
      if (w.length < 6 || /\d/.test(w) || vistos.has(lw)) return;
      if (w[0] !== w[0].toLowerCase() && !iniciais.has(lw)) return; // nomes próprios ficam de fora
      vistos.add(lw); lista.push(lw);
    });
    const escolhidas = lista.sort((a, b) => b.length - a.length).slice(0, 8);
    if (!escolhidas.length) return;
    const trads = await C.traduzirVarias(escolhidas, origem, destino);
    $('#sbVocabLingua').textContent = '→ ' + C.bandeira(destino) + ' ' + C.nomeLingua(destino);
    escolhidas.forEach((w, i) => {
      const b = document.createElement('button'); b.innerHTML = C.esc(w) + '<small>' + C.esc(trads[i] || '') + ' 🔊</small>';
      b.onclick = () => C.falar(trads[i], destino, { sempre: true, vel: 0.9 }); box.appendChild(b);
    });
    card.hidden = false;
  }

  // 🧩 Teste: "complete a frase" com palavras do próprio texto
  let quiz = [], qi = 0, qAcertos = 0;
  function prepararQuiz() {
    const card = $('#sbQuizCard'); card.hidden = true; quiz = []; qi = 0; qAcertos = 0;
    if (!atual || !atual.texto) return;
    const frases = frasesDe(atual.texto).filter((f) => f.length >= 35 && f.length <= 280);
    const todas = palavrasDe(atual.texto);
    const tipo = (w, i) => (/^\d{3,4}$/.test(w) ? 'num' : i > 0 && w.length >= 4 && w[0] !== w[0].toLowerCase() ? 'nome' : w.length >= 6 && w[0] === w[0].toLowerCase() ? 'longa' : null);
    const grupos = { num: new Set(), nome: new Set(), longa: new Set() };
    frases.forEach((f) => palavrasDe(f).forEach((w, i) => { const t = tipo(w, i); if (t) grupos[t].add(w); }));
    frases.slice(0, 6).forEach((f) => {
      if (quiz.length >= 3) return;
      const ws = palavrasDe(f); let alvo = null, t = null;
      for (const pref of ['num', 'longa', 'nome']) { const k = ws.findIndex((w, i) => tipo(w, i) === pref); if (k >= 0) { alvo = ws[k]; t = pref; break; } }
      if (!alvo) return;
      const naFrase = new Set(ws.map((w) => w.toLowerCase()));
      let outras = [...grupos[t]].filter((w) => w.toLowerCase() !== alvo.toLowerCase() && !naFrase.has(w.toLowerCase()));
      if (t === 'num') { const n = Number(alvo); outras = outras.length >= 3 ? outras : [n - 10, n + 7, n - 23, n + 50].map(String); }
      if (outras.length < 3) outras = outras.concat([...grupos.longa].filter((w) => w !== alvo && !outras.includes(w) && !naFrase.has(w.toLowerCase())));
      outras = outras.sort(() => Math.random() - 0.5).slice(0, 3);
      if (outras.length < 2) return;
      quiz.push({ frase: f, alvo, ops: [alvo, ...outras].sort(() => Math.random() - 0.5) });
    });
    void todas;
    if (quiz.length) { card.hidden = false; mostrarPergunta(); }
  }
  function mostrarPergunta() {
    const q = quiz[qi]; if (!q) return;
    $('#sbQuizConta').textContent = (qi + 1) + ' / ' + quiz.length;
    const partes = q.frase.split(q.alvo);
    $('#sbQuizFrase').innerHTML = C.esc(partes[0]) + '<span class="lacuna">?</span>' + C.esc(partes.slice(1).join(q.alvo));
    const box = $('#sbQuizOps'); box.innerHTML = ''; let respondeu = false;
    q.ops.forEach((o) => {
      const b = document.createElement('button'); b.textContent = o;
      b.onclick = () => {
        if (respondeu) return; respondeu = true;
        const certo = o === q.alvo; $('#sbQuizFrase .lacuna').textContent = q.alvo;
        if (certo) { b.classList.add('certa'); qAcertos++; localStorage.setItem('trad-xp', Number(localStorage.getItem('trad-xp') || 0) + 3); C.miau(); gato.dizer('Acertou! +3 ⭐'); window.ClaSpeakEmocao && window.ClaSpeakEmocao('feliz', $('#gatoSaber img')); }
        else { b.classList.add('errada'); [...box.children].find((x) => x.textContent === q.alvo).classList.add('certa'); gato.dizer('Quase! A certa está em verde 💛'); window.ClaSpeakEmocao && window.ClaSpeakEmocao('triste', $('#gatoSaber img')); }
        setTimeout(() => {
          qi++;
          if (qi < quiz.length) mostrarPergunta();
          else {
            $('#sbQuizConta').textContent = ''; $('#sbQuizOps').innerHTML = '';
            $('#sbQuizFrase').innerHTML = '🎉 Você acertou <b>' + qAcertos + ' de ' + quiz.length + '</b>!' + (qAcertos === quiz.length ? ' Perfeito!' : '');
            if (qAcertos === quiz.length) { gato.dancar(2400, true); gato.confete(20); }
          }
        }, 1400);
      };
      box.appendChild(b);
    });
  }

  // ⭐ Artigos salvos
  const favs = () => { try { return JSON.parse(localStorage.getItem('trad-sb-favs') || '[]'); } catch (e) { return []; } };
  function atualizarFav() { const f = atual && favs().some((x) => x.titulo === atual.titulo && x.w === atual.w); $('#sbFav').textContent = f ? '★ Salvo' : '☆ Salvar'; $('#sbFav').classList.toggle('ligado', !!f); }
  function desenharFavs() {
    const l = favs(), el = $('#sbFavs'); $('#sbFavsCard').hidden = !l.length; el.innerHTML = '';
    l.forEach((x) => { const d = document.createElement('div'); d.className = 'item'; d.textContent = '⭐ ' + x.titulo; d.onclick = () => abrirArtigo(x.titulo, x.w); el.appendChild(d); });
  }
  $('#sbFav').onclick = () => {
    if (!atual) return;
    let l = favs(); const tem = l.some((x) => x.titulo === atual.titulo && x.w === atual.w);
    l = tem ? l.filter((x) => !(x.titulo === atual.titulo && x.w === atual.w)) : [{ titulo: atual.titulo, w: atual.w }, ...l].slice(0, 30);
    localStorage.setItem('trad-sb-favs', JSON.stringify(l)); atualizarFav(); desenharFavs();
    if (!tem) { gato.dizer('Guardei nos salvos! ⭐'); gato.pular(); }
  };
  desenharFavs();

  // 📅 Hoje na história (feed da Wikipédia)
  async function hojeNaHistoria() {
    const d = new Date(), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    const chaveH = 'trad-sb-hoje-' + wiki + mm + dd;
    let ev = null; try { ev = JSON.parse(localStorage.getItem(chaveH) || 'null'); } catch (e) {}
    if (!ev) {
      try {
        const r = await buscar('https://' + wiki + '.wikipedia.org/api/rest_v1/feed/onthisday/events/' + mm + '/' + dd);
        ev = (r.events || []).filter((e) => e.text && e.pages && e.pages.length).sort(() => Math.random() - 0.5).slice(0, 6)
          .sort((a, b) => b.year - a.year).map((e) => ({ ano: e.year, texto: e.text, titulo: e.pages[0].title }));
        localStorage.setItem(chaveH, JSON.stringify(ev));
      } catch (e) { return; }
    }
    if (!ev || !ev.length) return;
    $('#sbHojeData').textContent = d.toLocaleDateString(C.minhaLingua(), { day: 'numeric', month: 'long' });
    const el = $('#sbHoje'); el.innerHTML = '';
    ev.forEach((e) => { const it = document.createElement('div'); it.className = 'item'; it.innerHTML = '<b>' + e.ano + '</b>' + C.esc(e.texto); it.onclick = () => abrirArtigo(e.titulo, wiki); el.appendChild(it); });
    $('#sbHojeCard').hidden = false;
  }
  hojeNaHistoria();

  C.ganchosAba.saber = () => { wiki = wikiDe(C.minhaLingua()); setTimeout(() => { gato.dizer(['Pergunte o que quiser! 🎓', 'Que tal uma curiosidade? 🎲', 'Escolha um tema: arte, história, ciência… 📚'][Math.floor(Math.random() * 3)]); gato.pular(); }, 250); };
})();
