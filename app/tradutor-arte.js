/* Clã Speak — ilustrações e personalização das abas (visual corporativo).
   Insere um cabeçalho ilustrado (SVG de linha, sem imagens externas) no topo de cada aba
   e uma saudação com o nome da pessoa. Não altera nenhuma função existente. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const grad = (id, a, b) => '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>';

  // Cada ilustração: 160x120, traço fino, gradiente da cor da aba, detalhes animados por CSS.
  const ARTE = {
    inicio: (g) => grad(g, '#9AA3F0', '#5E6AD2') +
      '<rect x="14" y="18" width="78" height="50" rx="12" fill="url(#' + g + ')" fill-opacity=".14" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<path d="M34 68v14l14-14" fill="none" stroke="url(#' + g + ')" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<text x="53" y="51" text-anchor="middle" font-size="24" font-weight="600" fill="#C9CEFA" font-family="Inter,system-ui,sans-serif">Aa</text>' +
      '<rect x="70" y="50" width="76" height="48" rx="12" fill="#111113" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<path d="M126 98v12l-12-12" fill="#111113" stroke="url(#' + g + ')" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<g class="arOnda" stroke="#9AA3F0" stroke-width="3" stroke-linecap="round">' +
      '<line x1="88" y1="64" x2="88" y2="84"/><line x1="97" y1="64" x2="97" y2="84"/><line x1="106" y1="64" x2="106" y2="84"/><line x1="115" y1="64" x2="115" y2="84"/><line x1="124" y1="64" x2="124" y2="84"/><line x1="133" y1="64" x2="133" y2="84"/></g>' +
      '<circle class="arPisca" cx="146" cy="22" r="3" fill="#7C85E0"/><circle class="arPisca d2" cx="8" cy="96" r="2" fill="#7C85E0"/>',
    saber: (g) => grad(g, '#F5C77E', '#D9893B') +
      '<path d="M80 40c-14-10-34-12-52-8v62c18-4 38-2 52 8 14-10 34-12 52-8V32c-18-4-38-2-52 8z" fill="url(#' + g + ')" fill-opacity=".1" stroke="url(#' + g + ')" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M80 40v62" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<g stroke="#D9A867" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"><path d="M40 50h28M40 60h24M40 70h28M40 80h18M92 50h28M92 60h22M92 70h28M92 80h20"/></g>' +
      '<g class="arGira"><circle cx="128" cy="22" r="10" fill="none" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<g stroke="url(#' + g + ')" stroke-width="1.6" stroke-linecap="round"><path d="M128 4v4M128 36v4M110 22h4M142 22h4M115 9l3 3M138 32l3 3M115 35l3-3M138 12l3-3"/></g></g>',
    estudo: (g) => grad(g, '#7FD8C4', '#2F9E86') +
      '<rect x="40" y="30" width="80" height="56" rx="10" fill="#111113" stroke="#2F9E86" stroke-opacity=".35" stroke-width="1.4" transform="rotate(-8 80 58)"/>' +
      '<rect x="36" y="34" width="84" height="58" rx="10" fill="#111113" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<path d="M50 52h40M50 62h28" stroke="url(#' + g + ')" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="102" cy="76" r="9" fill="url(#' + g + ')" fill-opacity=".18" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<path class="arCheck" d="M97.5 76l3 3 6-6" fill="none" stroke="#7FD8C4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="136" cy="30" r="14" fill="none" stroke="#26262B" stroke-width="3"/>' +
      '<circle class="arAnel" cx="136" cy="30" r="14" fill="none" stroke="url(#' + g + ')" stroke-width="3" stroke-linecap="round" stroke-dasharray="88" stroke-dashoffset="30" transform="rotate(-90 136 30)"/>',
    musica: (g) => grad(g, '#E79BD0', '#B4509A') +
      '<rect x="62" y="14" width="28" height="48" rx="14" fill="url(#' + g + ')" fill-opacity=".14" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<path d="M52 50a24 24 0 0 0 48 0M76 74v18M64 92h24" fill="none" stroke="url(#' + g + ')" stroke-width="1.6" stroke-linecap="round"/>' +
      '<g class="arOnda lenta" stroke="#E79BD0" stroke-width="3" stroke-linecap="round">' +
      '<line x1="14" y1="46" x2="14" y2="62"/><line x1="24" y1="46" x2="24" y2="62"/><line x1="34" y1="46" x2="34" y2="62"/>' +
      '<line x1="118" y1="46" x2="118" y2="62"/><line x1="128" y1="46" x2="128" y2="62"/><line x1="138" y1="46" x2="138" y2="62"/></g>' +
      '<path class="arFlutua" d="M132 22v-12l12-3v12" fill="none" stroke="#E79BD0" stroke-width="1.6" stroke-linejoin="round"/><circle class="arFlutua" cx="129" cy="23" r="3" fill="#E79BD0"/><circle class="arFlutua" cx="141" cy="20" r="3" fill="#E79BD0"/>',
    conversa: (g) => grad(g, '#86C5F5', '#3D8BD9') +
      '<rect x="12" y="20" width="84" height="38" rx="12" fill="#111113" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<path d="M26 34h44M26 44h30" stroke="#3D8BD9" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>' +
      '<rect x="62" y="68" width="86" height="34" rx="12" fill="url(#' + g + ')" fill-opacity=".16" stroke="url(#' + g + ')" stroke-width="1.6"/>' +
      '<g fill="#86C5F5"><circle class="arPonto" cx="92" cy="85" r="3"/><circle class="arPonto d2" cx="105" cy="85" r="3"/><circle class="arPonto d3" cx="118" cy="85" r="3"/></g>' +
      '<circle cx="138" cy="28" r="12" fill="none" stroke="url(#' + g + ')" stroke-width="1.6"/><path d="M132 26h0M144 26h0" stroke="#86C5F5" stroke-width="3" stroke-linecap="round"/><path d="M133 32q5 4 10 0" fill="none" stroke="#86C5F5" stroke-width="1.6" stroke-linecap="round"/>',
    ajustes: (g) => grad(g, '#B9BCC8', '#6B6F80') +
      '<g stroke="url(#' + g + ')" stroke-width="1.6" stroke-linecap="round"><path d="M24 34h112M24 60h112M24 86h112" stroke-opacity=".5"/></g>' +
      '<g class="arSlide"><circle cx="60" cy="34" r="8" fill="#111113" stroke="url(#' + g + ')" stroke-width="1.6"/></g>' +
      '<g class="arSlide d2"><circle cx="104" cy="60" r="8" fill="#111113" stroke="#7C85E0" stroke-width="1.6"/></g>' +
      '<g class="arSlide d3"><circle cx="78" cy="86" r="8" fill="#111113" stroke="url(#' + g + ')" stroke-width="1.6"/></g>'
  };

  const TEXTOS = {
    inicio: { cor: '#5E6AD2', sobre: 'Tradução ao vivo', titulo: null, sub: 'Fale no seu idioma. A outra pessoa lê e ouve no dela, em tempo real.' },
    saber: { cor: '#D9893B', sobre: 'Cultura e conhecimento', titulo: 'O que você quer saber hoje?', sub: 'Pergunte sobre literatura, arte, história ou ciência e estude lendo.' },
    estudo: { cor: '#2F9E86', sobre: 'Prática diária', titulo: 'Aprenda um pouco todo dia', sub: 'Frases por tema, pronúncia conferida pelo app e quiz rápido.' },
    musica: { cor: '#B4509A', sobre: 'Karaokê', titulo: 'Treine o idioma cantando', sub: 'Letra traduzida verso por verso, no ritmo do vídeo.' },
    conversa: { cor: '#3D8BD9', sobre: 'Conversação', titulo: 'Pratique situações reais', sub: 'Responda falando ou digitando e receba nota a cada fala.' },
    ajustes: { cor: '#8B8D98', sobre: 'Preferências', titulo: 'Do seu jeito', sub: 'Motor de tradução, voz, captação e acessibilidade.' }
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

  const ALVOS = { inicio: '#gatoInicio', saber: '#gatoSaber', estudo: '#gatoEstudo', musica: '#gatoKara', conversa: '#gatoConv', ajustes: '#gatoAjustes' };
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
