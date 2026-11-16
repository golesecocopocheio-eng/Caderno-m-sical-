/* Clã Speak · aba 💬 Conversar: prática de conversação com o gatinho em situações reais.
 * Os diálogos são escritos em português e traduzidos na hora para o idioma praticado.
 * O gatinho fala (texto + voz), a pessoa responde falando ou digitando; o app compara com as
 * respostas possíveis, dá estrelas e segue a conversa. No fim, um resumo com a pontuação. */
(() => {
  'use strict';
  const C = window.ClaSpeak;
  if (!C) return;
  const $ = (s, r = document) => r.querySelector(s);
  const emo = (t) => window.ClaSpeakEmocao && window.ClaSpeakEmocao(t, $('#gatoConv img'));

  // [fala do gatinho, [respostas possíveis]]
  const CENAS = [
    { id: 'cafe', ico: '☕', nome: 'Cafeteria', desc: 'Pedir e pagar', falas: [
      ['Olá! Bem-vindo. O que você gostaria de pedir?', ['Eu gostaria de um café, por favor.', 'Um suco de laranja, por favor.', 'Posso ver o cardápio?']],
      ['Claro! Para comer aqui ou para levar?', ['Para comer aqui.', 'Para levar, por favor.']],
      ['Mais alguma coisa?', ['Não, obrigado.', 'Sim, um pedaço de bolo.', 'Quanto custa?']],
      ['São dez reais. Como você vai pagar?', ['Com cartão.', 'Em dinheiro.', 'Posso pagar com o celular?']],
      ['Obrigado! Tenha um ótimo dia!', ['Obrigado, você também!', 'Tchau, até logo!']]] },
    { id: 'aeroporto', ico: '✈️', nome: 'Aeroporto', desc: 'Imigração e viagem', falas: [
      ['Bom dia! Posso ver o seu passaporte, por favor?', ['Claro, aqui está.', 'Um momento, por favor.']],
      ['Qual é o motivo da sua viagem?', ['Estou de férias.', 'Vim a trabalho.', 'Vou visitar minha família.']],
      ['Quantos dias você vai ficar?', ['Vou ficar uma semana.', 'Dez dias.', 'Duas semanas.']],
      ['Onde você vai se hospedar?', ['Em um hotel no centro.', 'Na casa de um amigo.']],
      ['Tudo certo. Boa viagem!', ['Muito obrigado!', 'Obrigado, tenha um bom dia!']]] },
    { id: 'hotel', ico: '🏨', nome: 'Hotel', desc: 'Check-in e pedidos', falas: [
      ['Boa noite! Você tem uma reserva?', ['Sim, tenho uma reserva.', 'Não, vocês têm um quarto livre?']],
      ['Por quantas noites?', ['Três noites.', 'Só uma noite.']],
      ['O café da manhã está incluído. Precisa de mais alguma coisa?', ['Qual é a senha do wi-fi?', 'A que horas é o café da manhã?', 'Não, obrigado.']],
      ['Aqui está a sua chave. Quarto duzentos e quatro.', ['Obrigado!', 'Onde fica o elevador?']]] },
    { id: 'compras', ico: '🛍️', nome: 'Compras', desc: 'Loja de roupas', falas: [
      ['Oi! Posso ajudar?', ['Só estou olhando, obrigado.', 'Estou procurando uma camiseta.', 'Quanto custa isto?']],
      ['Qual tamanho você usa?', ['Médio.', 'Pequeno.', 'Grande.']],
      ['Quer experimentar?', ['Sim, onde fica o provador?', 'Não, vou levar assim.']],
      ['Ficou ótimo! Vai levar?', ['Sim, vou levar.', 'Tem desconto?', 'Vou pensar, obrigado.']]] },
    { id: 'amigos', ico: '🤝', nome: 'Fazer amigos', desc: 'Primeira conversa', falas: [
      ['Oi! Tudo bem? Qual é o seu nome?', ['Oi! Meu nome é Ana.', 'Tudo bem! Eu sou o Pedro.']],
      ['Prazer! De onde você é?', ['Eu sou do Brasil.', 'Eu sou de Portugal.']],
      ['Que legal! O que você gosta de fazer?', ['Eu gosto de música.', 'Eu gosto de viajar.', 'Eu adoro gatos!']],
      ['Eu também! Vamos tomar um café um dia desses?', ['Claro, vamos sim!', 'Boa ideia!']]] },
    { id: 'entrevista', ico: '💼', nome: 'Entrevista', desc: 'Emprego', falas: [
      ['Bom dia! Fale um pouco sobre você.', ['Eu sou organizado e gosto de aprender.', 'Eu tenho cinco anos de experiência.']],
      ['Por que você quer trabalhar aqui?', ['Porque eu admiro a empresa.', 'Eu quero crescer profissionalmente.']],
      ['Quais são os seus pontos fortes?', ['Eu trabalho bem em equipe.', 'Eu sou pontual e dedicado.']],
      ['Você tem alguma pergunta?', ['Qual é o horário de trabalho?', 'Quando eu começo?', 'Não, obrigado.']],
      ['Obrigado! Entraremos em contato.', ['Obrigado pela oportunidade!']]] }
  ];

  const lingua = $('#cvLingua');
  C.preencher(lingua, localStorage.getItem('trad-cv-lingua') || (C.minhaLingua().startsWith('en') ? 'es-ES' : 'en-US'));
  let mostrarTrad = localStorage.getItem('trad-cv-trad') !== '0';
  const atualizarTradBt = () => { $('#cvTradBt').classList.toggle('ligado', mostrarTrad); $('#cvChat').classList.toggle('semTrad', !mostrarTrad); };
  atualizarTradBt();
  $('#cvTradBt').onclick = () => { mostrarTrad = !mostrarTrad; localStorage.setItem('trad-cv-trad', mostrarTrad ? '1' : '0'); atualizarTradBt(); };
  lingua.onchange = () => { localStorage.setItem('trad-cv-lingua', lingua.value); if (cena) comecar(cena); };

  // ---------- Comparação ----------
  const normal = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  function parecido(a, b) {
    a = normal(a); b = normal(b); if (!a || !b) return 0;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
  }

  // ---------- Telas ----------
  const feitos = () => { try { return JSON.parse(localStorage.getItem('trad-cv-feitos') || '{}'); } catch (e) { return {}; } };
  function mostrarCenas() {
    $('#cvInicio').hidden = false; $('#cvChat').hidden = true; $('#cvSug').hidden = true; $('#cvBarra').hidden = true;
    $('#cvProg').style.width = '0'; cena = null; C.ouvinte.parar();
    const f = feitos();
    $('#cvCenas').innerHTML = CENAS.map((c, i) => '<button data-i="' + i + '"><b>' + c.ico + '</b><span>' + c.nome + '</span><small>' + c.desc + '</small>' +
      (f[c.id] ? '<small class="feito">✓ melhor: ' + '⭐'.repeat(Math.min(3, Math.round(f[c.id]))) + '</small>' : '') + '</button>').join('');
    $('#cvCenas').querySelectorAll('button').forEach((b) => { b.onclick = () => comecar(CENAS[Number(b.dataset.i)]); });
  }
  $('#cvTemas').onclick = mostrarCenas;

  let cena = null, falas = [], passo = 0, tentativas = 0, estrelas = [], tradMinha = [];
  const chat = $('#cvChat'), rolar = () => { const r = $('#cvRolar'); r.scrollTop = r.scrollHeight; };
  const avatar = '<img class="av" src="icons/gato-rosto.png" alt="">';
  function bolhaGato(tx, tr) {
    const d = document.createElement('div'); d.className = 'cvM';
    d.innerHTML = avatar + '<div class="bal"><div class="tx"></div><div class="tr"></div></div>';
    $('.tx', d).textContent = tx; $('.tr', d).textContent = tr || '';
    const b = document.createElement('button'); b.textContent = '🔊'; b.title = 'Ouvir'; b.onclick = () => C.falar(tx, lingua.value, { sempre: true, vel: 0.9 });
    $('.tx', d).appendChild(b); chat.appendChild(d); rolar(); return d;
  }
  function bolhaEu(tx, nota) {
    const d = document.createElement('div'); d.className = 'cvM eu';
    d.innerHTML = '<div class="bal"><div class="tx"></div>' + (nota ? '<div class="cvNota"></div>' : '') + '</div>';
    $('.tx', d).textContent = tx; if (nota) $('.cvNota', d).textContent = nota;
    chat.appendChild(d); rolar(); return d;
  }
  async function comecar(c) {
    cena = c; passo = 0; estrelas = []; tentativas = 0;
    $('#cvInicio').hidden = true; chat.hidden = false; chat.innerHTML = ''; $('#cvBarra').hidden = false;
    const carregando = bolhaGato('…', ''); carregando.classList.add('digitando');
    // traduz todas as falas e respostas de uma vez (no idioma praticado e no da pessoa)
    const textos = []; c.falas.forEach(([g, rs]) => { textos.push(g, ...rs); });
    const [alvo, minha] = await Promise.all([C.traduzirVarias(textos, 'pt-BR', lingua.value), C.traduzirVarias(textos, 'pt-BR', C.minhaLingua())]);
    if (cena !== c) return;
    let k = 0; falas = c.falas.map(([, rs]) => { const g = { tx: alvo[k], tr: minha[k] }; k++; const r = rs.map(() => { const o = { tx: alvo[k], tr: minha[k] }; k++; return o; }); return { g, r }; });
    carregando.remove();
    const intro = document.createElement('div'); intro.className = 'mu'; intro.style.textAlign = 'center';
    intro.textContent = c.ico + ' ' + c.nome + ' · praticando ' + C.bandeira(lingua.value) + ' ' + C.nomeLingua(lingua.value);
    chat.appendChild(intro);
    falaDoGato();
  }
  function falaDoGato() {
    $('#cvProg').style.width = (passo / falas.length * 100) + '%';
    const f = falas[passo]; if (!f) return terminar();
    const dig = bolhaGato('digitando…', ''); dig.classList.add('digitando');
    setTimeout(() => {
      dig.remove(); bolhaGato(f.g.tx, f.g.tr);
      C.falar(f.g.tx, lingua.value, { sempre: true, vel: 0.92 });
      sugestoes(f.r); tentativas = 0;
    }, 700);
  }
  function sugestoes(rs) {
    const box = $('#cvSug'); box.hidden = false;
    box.innerHTML = '<span class="rot">💡 Você pode dizer:</span>' + rs.map((r, i) => '<button data-i="' + i + '">' + C.esc(r.tx) + (mostrarTrad ? '<small>' + C.esc(r.tr) + '</small>' : '') + '</button>').join('');
    box.querySelectorAll('button').forEach((b) => { b.onclick = () => C.falar(rs[Number(b.dataset.i)].tx, lingua.value, { sempre: true, vel: 0.85 }); });
  }
  function responder(txt) {
    txt = C.arrumar(txt); if (!txt || !cena || !falas[passo]) return;
    const rs = falas[passo].r;
    let melhor = 0, qual = rs[0]; rs.forEach((r) => { const n = parecido(txt, r.tx); if (n > melhor) { melhor = n; qual = r; } });
    tentativas++;
    if (melhor >= 0.55 || tentativas >= 3) {
      const e = melhor >= 0.85 ? 3 : melhor >= 0.7 ? 2 : melhor >= 0.55 ? 1 : 0;
      estrelas.push(e);
      bolhaEu(txt, (e ? '⭐'.repeat(e) : '💡') + (e < 3 ? ' Melhor dizer: “' + qual.tx + '”' : ' Perfeito!'));
      $('#cvPontos').textContent = '⭐ ' + estrelas.reduce((a, b) => a + b, 0);
      if (e === 3) { C.miau(); emo('feliz'); } else if (e === 0) emo('surpreso');
      passo++; $('#cvSug').hidden = true; setTimeout(falaDoGato, 900);
    } else {
      bolhaEu(txt, '🤔 Não entendi bem. Tente de novo ou toque numa sugestão para ouvir.');
      emo('surpreso');
    }
  }
  function terminar() {
    $('#cvProg').style.width = '100%'; $('#cvSug').hidden = true; $('#cvBarra').hidden = true; C.ouvinte.parar();
    const total = estrelas.reduce((a, b) => a + b, 0), max = falas.length * 3, media = total / falas.length;
    const f = feitos(); f[cena.id] = Math.max(f[cena.id] || 0, media); localStorage.setItem('trad-cv-feitos', JSON.stringify(f));
    localStorage.setItem('trad-xp', Number(localStorage.getItem('trad-xp') || 0) + total);
    const d = document.createElement('div'); d.className = 'cvFim';
    d.innerHTML = '<div class="grande">' + total + ' / ' + max + ' ⭐</div><p>' + (media >= 2.5 ? 'Incrível! Você conversou como um nativo! 🎉' : media >= 1.5 ? 'Muito bem! Mais um pouco e fica perfeito 💪' : 'Bom começo! Pratique de novo 🐾') + '</p>' +
      '<div class="botoes"><button id="cvDeNovo">🔁 Praticar de novo</button><button class="sec" id="cvOutro">☰ Outra situação</button></div>';
    chat.appendChild(d); rolar();
    $('#cvDeNovo').onclick = () => comecar(cena); $('#cvOutro').onclick = mostrarCenas;
    C.miau(); emo(media >= 2 ? 'canta' : 'feliz');
  }

  // ---------- Responder ----------
  $('#cvTexto').addEventListener('keydown', (e) => { if (e.key === 'Enter') { responder(e.target.value); e.target.value = ''; } });
  const mic = $('#cvMic'), onda = $('#cvOnda');
  mic.onclick = () => {
    if (C.ouvinte.ativo) { C.ouvinte.parar(); return; }
    const okM = C.ouvinte.iniciar(lingua.value, {
      parcial: (t) => { $('#cvTexto').placeholder = t || 'Ouvindo…'; if (t) { onda.classList.add('forte'); setTimeout(() => onda.classList.remove('forte'), 300); } },
      final: (t) => { C.ouvinte.parar(); responder(t); },
      erro: (m) => alert(m),
      fim: () => { mic.classList.remove('on'); onda.classList.remove('on'); $('#cvTexto').placeholder = 'Responda aqui ou toque no 🎤…'; }
    });
    if (okM) { mic.classList.add('on'); onda.classList.add('on'); $('#cvTexto').placeholder = 'Ouvindo… fale em ' + C.nomeLingua(lingua.value); }
  };

  C.ganchosAba.conversa = () => { if (!cena) mostrarCenas(); };
  document.querySelectorAll('#abas button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.aba !== 'conversa' && C.ouvinte.ativo) C.ouvinte.parar(); }));
  mostrarCenas();
})();
