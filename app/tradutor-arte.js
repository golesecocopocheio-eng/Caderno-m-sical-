/* Clã Speak — ilustrações e personalização das abas (visual corporativo).
   Insere um cabeçalho ilustrado (SVG de linha, sem imagens externas) no topo de cada aba
   e uma saudação com o nome da pessoa. Não altera nenhuma função existente. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const grad = (id, a, b) => '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>';

  // Cada ilustração: 160x120, traço fino, gradiente da cor da aba, detalhes animados por CSS.
  const ARTE = {
    inicio: (g) => grad(g, '#C4B5FD', '#7C3AED') +
      '<rect x="14" y="18" width="78" height="50" rx="12" fill="url(#' + g + ')" fill-opacity=".14" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<path d="M34 68v14l14-14" fill="none" stroke="url(#' + g + ')" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<text x="53" y="51" text-anchor="middle" font-size="24" font-weight="600" fill="#7C3AED" font-family="Inter,system-ui,sans-serif">Aa</text>' +
      '<rect x="70" y="50" width="76" height="48" rx="12" fill="#FFFFFF" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<path d="M126 98v12l-12-12" fill="#FFFFFF" stroke="url(#' + g + ')" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<g class="arOnda" stroke="#FACC15" stroke-width="3" stroke-linecap="round">' +
      '<line x1="88" y1="64" x2="88" y2="84"/><line x1="97" y1="64" x2="97" y2="84"/><line x1="106" y1="64" x2="106" y2="84"/><line x1="115" y1="64" x2="115" y2="84"/><line x1="124" y1="64" x2="124" y2="84"/><line x1="133" y1="64" x2="133" y2="84"/></g>' +
      '<circle class="arPisca" cx="146" cy="22" r="3" fill="#FACC15"/><circle class="arPisca d2" cx="8" cy="96" r="2" fill="#FACC15"/>',
    saber: (g) => grad(g, '#F9A8D4', '#DB2777') +
      '<path d="M80 40c-14-10-34-12-52-8v62c18-4 38-2 52 8 14-10 34-12 52-8V32c-18-4-38-2-52 8z" fill="url(#' + g + ')" fill-opacity=".1" stroke="url(#' + g + ')" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M80 40v62" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<g stroke="#F472B6" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"><path d="M40 50h28M40 60h24M40 70h28M40 80h18M92 50h28M92 60h22M92 70h28M92 80h20"/></g>' +
      '<g class="arGira"><circle cx="128" cy="22" r="10" fill="none" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<g stroke="url(#' + g + ')" stroke-width="1.6" stroke-linecap="round"><path d="M128 4v4M128 36v4M110 22h4M142 22h4M115 9l3 3M138 32l3 3M115 35l3-3M138 12l3-3"/></g></g>',
    estudo: (g) => grad(g, '#BAE6FD', '#0EA5E9') +
      '<rect x="40" y="30" width="80" height="56" rx="10" fill="#FFFFFF" stroke="#0EA5E9" stroke-opacity=".35" stroke-width="1.4" transform="rotate(-8 80 58)"/>' +
      '<rect x="36" y="34" width="84" height="58" rx="10" fill="#FFFFFF" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<path d="M50 52h40M50 62h28" stroke="url(#' + g + ')" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="102" cy="76" r="9" fill="url(#' + g + ')" fill-opacity=".18" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<path class="arCheck" d="M97.5 76l3 3 6-6" fill="none" stroke="#BAE6FD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="136" cy="30" r="14" fill="none" stroke="#26262B" stroke-width="3"/>' +
      '<circle class="arAnel" cx="136" cy="30" r="14" fill="none" stroke="url(#' + g + ')" stroke-width="3" stroke-linecap="round" stroke-dasharray="88" stroke-dashoffset="30" transform="rotate(-90 136 30)"/>',
    musica: (g) => grad(g, '#D8B4FE', '#A855F7') +
      '<rect x="62" y="14" width="28" height="48" rx="14" fill="url(#' + g + ')" fill-opacity=".14" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<path d="M52 50a24 24 0 0 0 48 0M76 74v18M64 92h24" fill="none" stroke="url(#' + g + ')" stroke-width="1.6" stroke-linecap="round"/>' +
      '<g class="arOnda lenta" stroke="#D8B4FE" stroke-width="3" stroke-linecap="round">' +
      '<line x1="14" y1="46" x2="14" y2="62"/><line x1="24" y1="46" x2="24" y2="62"/><line x1="34" y1="46" x2="34" y2="62"/>' +
      '<line x1="118" y1="46" x2="118" y2="62"/><line x1="128" y1="46" x2="128" y2="62"/><line x1="138" y1="46" x2="138" y2="62"/></g>' +
      '<path class="arFlutua" d="M132 22v-12l12-3v12" fill="none" stroke="#D8B4FE" stroke-width="1.6" stroke-linejoin="round"/><circle class="arFlutua" cx="129" cy="23" r="3" fill="#D8B4FE"/><circle class="arFlutua" cx="141" cy="20" r="3" fill="#D8B4FE"/>',
    conversa: (g) => grad(g, '#BFDBFE', '#3B82F6') +
      '<rect x="12" y="20" width="84" height="38" rx="12" fill="#FFFFFF" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<path d="M26 34h44M26 44h30" stroke="#3B82F6" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>' +
      '<rect x="62" y="68" width="86" height="34" rx="12" fill="url(#' + g + ')" fill-opacity=".16" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<g fill="#BFDBFE"><circle class="arPonto" cx="92" cy="85" r="3"/><circle class="arPonto d2" cx="105" cy="85" r="3"/><circle class="arPonto d3" cx="118" cy="85" r="3"/></g>' +
      '<circle cx="138" cy="28" r="12" fill="none" stroke="url(#' + g + ')" stroke-width="1.6"/><path d="M132 26h0M144 26h0" stroke="#BFDBFE" stroke-width="3" stroke-linecap="round"/><path d="M133 32q5 4 10 0" fill="none" stroke="#BFDBFE" stroke-width="1.6" stroke-linecap="round"/>',
    nuvem: (g) => grad(g, '#C4B5FD', '#7C3AED') +
      '<path d="M44 92a22 22 0 0 1-3-43.8A30 30 0 0 1 98 40a20 20 0 0 1-2 52z" fill="url(#' + g + ')" fill-opacity=".14" stroke="url(#' + g + ')" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<g class="arFlutua"><path d="M70 82V58M60 68l10-10 10 10" fill="none" stroke="#FACC15" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '<rect x="112" y="70" width="36" height="40" rx="6" fill="#FFFFFF" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<path d="M120 82h20M120 90h14" stroke="#A78BFA" stroke-width="1.6" stroke-linecap="round"/>' +
      '<circle cx="140" cy="100" r="7" fill="#FFFFFF" stroke="#FACC15" stroke-width="1.6"/><path class="arCheck" d="M137 100l2 2 4-4" fill="none" stroke="#FACC15" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle class="arPisca" cx="20" cy="30" r="2.5" fill="#FACC15"/><circle class="arPisca d2" cx="128" cy="24" r="2" fill="#FACC15"/>',
    ajustes: (g) => grad(g, '#C4B5FD', '#6D28D9') +
      '<defs><radialGradient id="' + g + 'p" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FCE7F3"/><stop offset=".5" stop-color="#F472B6"/><stop offset="1" stop-color="#9D174D"/></radialGradient>' +
      '<radialGradient id="' + g + 'a" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#BFDBFE"/><stop offset="1" stop-color="#3B82F6"/></radialGradient>' +
      '<radialGradient id="' + g + 'r" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#F5D0FE"/><stop offset="1" stop-color="#C026D3"/></radialGradient></defs>' +
      '<ellipse cx="80" cy="64" rx="70" ry="24" fill="none" stroke="url(#' + g + ')" stroke-opacity=".35" stroke-dasharray="3 5"/>' +
      '<g class="arOrbita"><circle cx="150" cy="64" r="4" fill="url(#' + g + 'a)"/></g>' +
      '<circle cx="80" cy="62" r="26" fill="url(#' + g + 'p)"/>' +
      '<path d="M58 56q22-8 44 0M56 66q24-6 48 2" stroke="#FEF3C7" stroke-opacity=".45" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="80" cy="64" rx="44" ry="10" fill="none" stroke="#F59E0B" stroke-width="3" transform="rotate(-14 80 64)" stroke-dasharray="70 40" stroke-dashoffset="-18"/>' +
      '<g class="arFlutua"><circle cx="134" cy="26" r="11" fill="url(#' + g + 'r)"/><circle cx="130" cy="22" r="2" fill="#fff" fill-opacity=".6"/></g>' +
      '<g class="arFlutua d2"><circle cx="22" cy="100" r="8" fill="url(#' + g + 'a)"/></g>' +
      '<g fill="#7C3AED"><path class="arPisca" d="M30 22l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path class="arPisca d2" d="M120 100l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="#F59E0B"/></g>' +
      '<circle class="arPisca" cx="54" cy="14" r="1.6" fill="#A78BFA"/><circle class="arPisca d2" cx="150" cy="96" r="1.6" fill="#A78BFA"/><circle class="arPisca" cx="8" cy="54" r="1.4" fill="#F59E0B"/>'
  };

  const TEXTOS = {
    inicio: { cor: '#8B5CF6', sobre: 'Tradução ao vivo', titulo: null, sub: 'Fale no seu idioma. A outra pessoa lê e ouve no dela, em tempo real.' },
    saber: { cor: '#DB2777', sobre: 'Cultura e conhecimento', titulo: 'O que você quer saber hoje?', sub: 'Pergunte sobre literatura, arte, história ou ciência e estude lendo.' },
    estudo: { cor: '#0EA5E9', sobre: 'Prática diária', titulo: 'Aprenda um pouco todo dia', sub: 'Frases por tema, pronúncia conferida pelo app e quiz rápido.' },
    musica: { cor: '#A855F7', sobre: 'Karaokê', titulo: 'Treine o idioma cantando', sub: 'Letra traduzida verso por verso, no ritmo do vídeo.' },
    conversa: { cor: '#3B82F6', sobre: 'Conversação', titulo: 'Pratique situações reais', sub: 'Responda falando ou digitando e receba nota a cada fala.' },
    nuvem: { cor: '#8B5CF6', sobre: 'Backup', titulo: 'Seus dados, sempre salvos', sub: 'Backup automático na nuvem. Baixe ou recupere tudo em outro celular com o seu código.' },
    ajustes: { cor: '#7C3AED', sobre: 'Preferências', titulo: 'Do seu jeito', sub: 'Motor de tradução, voz, captação e acessibilidade.' }
  };

  function saudacao() {
    const h = new Date().getHours();
    const nome = (localStorage.getItem('trad-nome') || '').trim().split(/\s+/)[0];
    const parte = h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    return parte + (nome ? ', ' + nome : '');
  }

  let n = 0;
  function criarHero(aba) {
    const t = TEXTOS[aba], g = 'arG' + (n++);
    const d = document.createElement('div');
    d.className = 'hero'; d.dataset.hero = aba;
    d.style.setProperty('--hc', t.cor);
    d.innerHTML =
      '<div class="heroTx"><span class="heroSobre">' + t.sobre + '</span>' +
      '<h2 class="heroTit">' + (t.titulo || saudacao()) + '</h2>' +
      '<p class="heroSub">' + t.sub + '</p></div>' +
      '<svg class="heroArte" viewBox="0 0 160 120" aria-hidden="true" xmlns="' + NS + '">' + ARTE[aba](g) + '</svg>';
    return d;
  }

  const ALVOS = { inicio: '#gatoInicio', saber: '#gatoSaber', estudo: '#gatoEstudo', musica: '#gatoKara', conversa: '#gatoConv', nuvem: '#gatoNuvem', ajustes: '#gatoAjustes' };
  Object.keys(ALVOS).forEach((aba) => {
    const st = document.querySelector(ALVOS[aba]);
    if (st && st.parentNode) st.parentNode.insertBefore(criarHero(aba), st);
  });

  // Saudação acompanha o nome digitado e a hora.
  const tituloInicio = document.querySelector('[data-hero="inicio"] .heroTit');
  const atualizar = () => { if (tituloInicio) tituloInicio.textContent = saudacao(); };
  const nomeEl = document.getElementById('nome');
  if (nomeEl) nomeEl.addEventListener('input', () => { localStorage.setItem('trad-nome', nomeEl.value.trim()); atualizar(); });
  setInterval(atualizar, 60000);

  // Cor da aba ativa na barra de baixo.
  const abas = document.getElementById('abas');
  function corAba() {
    const on = abas && abas.querySelector('button.on');
    const aba = on && on.dataset.aba;
    document.documentElement.style.setProperty('--aba', (TEXTOS[aba] || TEXTOS.inicio).cor);
  }
  if (abas) { abas.addEventListener('click', () => requestAnimationFrame(corAba)); corAba(); }
})();

/* Tela de abertura (capa): já vem no HTML (sem tela branca). Estrelas passando como numa
   viagem pelo espaço; no fim a capa "avança" para dentro do app. Toque para pular. */
(function () {
  'use strict';
  const c = document.getElementById('capa');
  if (!c) return;
  try { sessionStorage.setItem('trad-capa', '1'); } catch (e) {}
  const cv = document.getElementById('capaWarp'), x = cv && cv.getContext('2d');
  let fim = false, t0 = performance.now(), raf = 0;
  if (x) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = () => (cv.width = innerWidth * dpr, cv.height = innerHeight * dpr);
    W(); addEventListener('resize', W);
    const cores = ['255,255,255', '255,255,255', '249,168,212', '125,211,252', '196,181,253', '253,230,138'];
    const N = 260, est = [];
    const nova = (z) => ({ x: (Math.random() - .5) * 2, y: (Math.random() - .5) * 2, z: z || Math.random() * 1 + .05, c: cores[(Math.random() * cores.length) | 0] });
    for (let i = 0; i < N; i++) est.push(nova());
    let ult = t0;
    const passo = (agora) => {
      const dt = Math.min(50, agora - ult) / 1000; ult = agora;
      const tt = (agora - t0) / 1000;
      const vel = fim ? 3.2 : .18 + Math.min(1, tt / 1.6) * .55; // acelera; na saída, salto
      const w = cv.width, h = cv.height, cx = w / 2, cy = h * .42, k = Math.max(w, h) * .5;
      x.clearRect(0, 0, w, h);
      for (const s of est) {
        const z0 = s.z; s.z -= vel * dt;
        if (s.z <= .02) { Object.assign(s, nova(1.05)); continue; }
        const px = cx + s.x / s.z * k, py = cy + s.y / s.z * k, qx = cx + s.x / z0 * k, qy = cy + s.y / z0 * k;
        if (px < -50 || px > w + 50 || py < -50 || py > h + 50) { Object.assign(s, nova(1.05)); continue; }
        const a = Math.min(1, (1.1 - s.z) * 1.2);
        x.strokeStyle = 'rgba(' + s.c + ',' + a.toFixed(3) + ')';
        x.lineWidth = Math.max(.6, (1.2 - s.z) * 2.4) * dpr;
        x.lineCap = 'round';
        x.beginPath(); x.moveTo(qx, qy); x.lineTo(px, py); x.stroke();
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
  }
  const sair = () => {
    if (fim) return; fim = true;
    setTimeout(() => c.classList.add('sai'), 180);
    setTimeout(() => { cancelAnimationFrame(raf); c.remove(); }, 950);
  };
  c.addEventListener('click', sair);
  setTimeout(sair, 2400);
})();

/* Planetas e estrelas no fundo de todo o app (camada fixa atrás das telas) */
(function () {
  const d = document.createElement('div');
  d.className = 'cosmos'; d.setAttribute('aria-hidden', 'true');
  let est = '';
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 80; i++) {
    const g = r() < .15;
    const cor = ['#8B5CF6', '#C084FC', '#EC4899', '#38BDF8', '#FFFFFF', '#FFFFFF', '#F59E0B'][(r() * 7) | 0];
    est += '<i class="estrela' + (g ? ' grande' : '') + '" style="--c:' + cor + ';left:' + (r() * 100).toFixed(1) + '%;top:' + (r() * 100).toFixed(1) + '%;--t:' + (2 + r() * 3).toFixed(1) + 's;--d:-' + (r() * 4).toFixed(1) + 's;--s:' + (g ? 3 : r() < .5 ? 2 : 1.5) + 'px"></i>';
  }
  d.innerHTML = est +
    '<span class="planeta p1"><b></b></span><span class="planeta p2"></span><span class="planeta p3"></span>' +
    '<span class="planeta p4"><b></b></span><span class="planeta p5"></span><span class="planeta p6"></span>' +
    '<span class="cometa"></span><span class="cometa c2"></span>';
  document.body.insertBefore(d, document.body.firstChild);
})();

/* Frente a frente: planetas, estrelas e estrelas cadentes na faixa do meio */
(function () {
  const pista = document.getElementById('pista');
  if (!pista) return;
  const d = document.createElement('div');
  d.className = 'pistaCosmos'; d.setAttribute('aria-hidden', 'true');
  let est = '', s = 21; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cores = ['#FFFFFF', '#FFFFFF', '#F9A8D4', '#7DD3FC', '#C4B5FD', '#FDE68A'];
  for (let i = 0; i < 26; i++) est += '<i style="left:' + (r() * 100).toFixed(1) + '%;top:' + (r() * 100).toFixed(1) + '%;--c:' + cores[(r() * cores.length) | 0] + ';--d:-' + (r() * 3).toFixed(1) + 's;--s:' + (r() < .2 ? 2.6 : 1.5) + 'px"></i>';
  d.innerHTML = est +
    '<span class="pp pp1"><b></b></span><span class="pp pp2"></span><span class="pp pp3"></span><span class="pp pp4"></span>' +
    '<span class="cad c1"></span><span class="cad c2"></span><span class="cad c3"></span>';
  pista.insertBefore(d, pista.firstChild);
})();
