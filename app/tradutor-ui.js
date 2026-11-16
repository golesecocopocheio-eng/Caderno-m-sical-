/* Clã Speak · camada de interface corporativa.
 * Troca os emojis da interface (botões, títulos, rótulos, abas) por ícones de traço (SVG 1.75px)
 * e remove os emojis decorativos. O conteúdo (mensagens, traduções, letras, artigos) não é tocado. */
(() => {
  'use strict';
  const P = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    som: '<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    mudo: '<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="m22 9-6 6M16 9l6 6"/>',
    fone: '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    auto: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    limpar: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    fechar: '<path d="M18 6 6 18M6 6l12 12"/>',
    copiar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    estrela: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    sortear: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    voltar: '<path d="M11 19 4 12l7-7M20 19l-7-7 7-7"/>',
    tocar: '<path d="M7 4v16l13-8z"/>',
    tocarPausar: '<path d="M5 5v14l8-7zM16 5v14M20 5v14"/>',
    esq: '<path d="m15 18-6-6 6-6"/>',
    parar: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    gravar: '<circle cx="12" cy="12" r="6"/>',
    pasta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    salvar: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v6h8M7 21v-7h10v7"/>',
    tempo: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M10 2h4"/>',
    raio: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    globo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    falar: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    coracao: '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z"/>',
    sorriso: '<circle cx="12" cy="12" r="9"/><path d="M8 14a4.5 4.5 0 0 0 8 0M9 9.5h.01M15 9.5h.01"/>',
    cartoes: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 2h12a2 2 0 0 1 2 2v12"/>',
    quiz: '<path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
    devagar: '<path d="M12 13V8M5 18a9 9 0 1 1 14 0z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    escrever: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    livro: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5zM4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    capelo: '<path d="m22 10-10-5-10 5 10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5M22 10v6"/>',
    conversa: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    traduzir: '<path d="M4 5h8M8 3v2M6 5c0 4 2 7 6 9M10 5c-1 4-3 7-6 9M13 21l4-10 4 10M14.5 17h5"/>',
    lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    ok: '<path d="m5 12 5 5L20 7"/>',
    aviso: '<path d="M12 3 2 21h20zM12 10v5M12 18h.01"/>'
  };
  // emoji → ícone (os que não estão aqui são só removidos da interface)
  const MAPA = {
    '🎤': 'mic', '🎙️': 'mic', '🔊': 'som', '🔉': 'som', '🔇': 'mudo', '🎧': 'fone', '🔄': 'auto', '🔁': 'auto',
    '🧹': 'limpar', '✖': 'fechar', '✖️': 'fechar', '❌': 'fechar', '📋': 'copiar', '⭐': 'estrela', '★': 'estrela', '☆': 'estrela',
    '🔎': 'buscar', '🔍': 'buscar', '🎲': 'sortear', '⏪': 'voltar', '▶': 'tocar', '▶️': 'tocar', '⏯': 'tocarPausar', '⏯️': 'tocarPausar',
    '◀': 'esq', '◀️': 'esq', '⏹': 'parar', '⏹️': 'parar', '■': 'parar', '⏺': 'gravar', '⏺️': 'gravar', '📁': 'pasta', '💾': 'salvar',
    '⏱': 'tempo', '⏱️': 'tempo', '⚡': 'raio', '🌍': 'globo', '🌐': 'globo', '🗣': 'falar', '🗣️': 'falar', '❤️': 'coracao', '❤': 'coracao',
    '😂': 'sorriso', '🃏': 'cartoes', '🧩': 'quiz', '🐢': 'devagar', '🔗': 'link', '✍️': 'escrever', '✍': 'escrever', '📖': 'livro',
    '📚': 'livro', '🎓': 'capelo', '💬': 'conversa', '⚙️': 'ajustes', '⚙': 'ajustes', '📝': 'escrever', '👤': 'usuario', '✓': 'ok', '⚠️': 'aviso', '⚠': 'aviso'
  };
  const svg = (n) => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + P[n] + '</svg>';
  const RE = /(\p{Extended_Pictographic}|[★☆✓■])(️|‍\p{Extended_Pictographic})*/gu;
  // Onde mexer (interface) e onde nunca mexer (conteúdo)
  const UI = 'button, header, label, summary, .abas, .estado, .mu, .card > b, .chave, .dica, .vez, #pessoas, .sistema, .botaoLink, .aviso, .status, .cvTopo, .mic, .temas, .sbChips, .cvCenas, #kPontos, #xpTotal, #xpSeq, #cvPontos, .flash .mu, #estTitulo';
  const CONTEUDO = '.msg .tr, .msg .orig, .msg .quem, .reacoes, .emojis button:not(#btRepetir), .kl, .cvM .tx, .cvM .tr, .cvSug, .resultado, .sbTexto, .escrita, select, option, textarea, input, .lista, .sbVocab, .opcoes, #sbHoje, #sbVeja, .sbCab, #estMinha, #estAlvo, #estQuizAlvo, #estOuvi, #kCantou, .sbQuizFrase, .hist';
  function limparNo(no) {
    const el = no.parentElement; if (!el || el.closest(CONTEUDO) || !el.closest(UI)) return;
    const t = no.data; RE.lastIndex = 0; if (!RE.test(t)) return;
    RE.lastIndex = 0;
    const partes = []; let ult = 0, m;
    while ((m = RE.exec(t))) { partes.push(t.slice(ult, m.index)); const nome = MAPA[m[0]] || MAPA[m[0].replace(/️/g, '')]; partes.push(nome ? { ic: nome } : ''); ult = m.index + m[0].length; }
    partes.push(t.slice(ult));
    if (!partes.some((x) => typeof x === 'object')) { no.data = partes.join('').replace(/^\s+/, (s) => (el.childNodes[0] === no ? '' : s)); return; }
    const frag = document.createDocumentFragment();
    partes.forEach((x) => { if (typeof x === 'object') { const s = document.createElement('span'); s.className = 'icw'; s.innerHTML = svg(x.ic); frag.appendChild(s); } else if (x) frag.appendChild(document.createTextNode(x)); });
    no.replaceWith(frag);
  }
  function varrer(raiz) {
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT); const nos = [];
    while (w.nextNode()) nos.push(w.currentNode);
    nos.forEach(limparNo);
  }
  let pend = new Set(), agendado = false;
  const obs = new MutationObserver((ms) => {
    ms.forEach((m) => { if (m.type === 'characterData') pend.add(m.target.parentElement); else m.addedNodes.forEach((n) => pend.add(n.nodeType === 3 ? n.parentElement : n)); });
    if (!agendado) { agendado = true; requestAnimationFrame(() => { agendado = false; const lista = [...pend]; pend = new Set(); lista.forEach((n) => n && n.isConnected && varrer(n)); }); }
  });
  varrer(document.body);
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.ClaSpeakIcone = svg;
})();
