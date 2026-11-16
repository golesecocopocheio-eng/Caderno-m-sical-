/* Clã Speak · aba Estudar: frases por tema com áudio, treino de pronúncia pelo microfone e quiz.
 * As frases-base são em português e são traduzidas na hora para o idioma do aluno e o idioma estudado.
 * Pontos (⭐) e dias seguidos de estudo (🔥) ficam guardados no aparelho. */
(() => {
  'use strict';
  const C = window.ClaSpeak;
  if (!C) return;
  const $ = (s, r = document) => r.querySelector(s);

  const TEMAS = [
    { ico: '👋', nome: 'Saudações', frases: ['Olá!', 'Bom dia!', 'Boa noite!', 'Como você está?', 'Estou bem, obrigado.', 'Qual é o seu nome?', 'Meu nome é Ana.', 'Prazer em conhecer você.', 'Até logo!', 'Muito obrigado!'] },
    { ico: '💬', nome: 'Conversa', frases: ['De onde você é?', 'Eu sou do Brasil.', 'Você fala português?', 'Eu estou aprendendo.', 'Pode falar mais devagar?', 'Não entendi.', 'Pode repetir, por favor?', 'O que significa isso?', 'Como se diz isso?', 'Eu gosto muito daqui.'] },
    { ico: '✈️', nome: 'Viagem', frases: ['Onde fica o banheiro?', 'Onde fica a estação de trem?', 'Quanto custa a passagem?', 'Eu preciso de um táxi.', 'Onde fica o hotel?', 'Que horas sai o ônibus?', 'Estou perdido.', 'Pode me ajudar?', 'O aeroporto fica longe?', 'Eu tenho uma reserva.'] },
    { ico: '🍽️', nome: 'Restaurante', frases: ['Uma mesa para dois, por favor.', 'Posso ver o cardápio?', 'Eu quero uma água.', 'A conta, por favor.', 'Estava delicioso!', 'Eu sou vegetariano.', 'O que você recomenda?', 'Sem gelo, por favor.', 'Aceita cartão?', 'Um café, por favor.'] },
    { ico: '🛍️', nome: 'Compras', frases: ['Quanto custa isto?', 'Está muito caro.', 'Tem um tamanho maior?', 'Posso experimentar?', 'Vou levar este.', 'Tem desconto?', 'Onde fica o caixa?', 'Só estou olhando, obrigado.', 'Aceita dinheiro?', 'Pode embrulhar para presente?'] },
    { ico: '🔢', nome: 'Números', frases: ['um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'] },
    { ico: '🚑', nome: 'Emergência', frases: ['Socorro!', 'Chame uma ambulância!', 'Eu preciso de um médico.', 'Onde fica o hospital?', 'Chame a polícia!', 'Eu perdi meu passaporte.', 'Estou com dor.', 'Sou alérgico a amendoim.', 'Onde fica a farmácia?', 'É uma emergência!'] },
    { ico: '💼', nome: 'Trabalho', frases: ['Tenho uma reunião às dez.', 'Pode me enviar o relatório?', 'Qual é o prazo?', 'Vamos agendar uma chamada.', 'Preciso de mais informações.', 'O projeto está atrasado.', 'Obrigado pelo retorno.', 'Concordo com a proposta.'] }
  ];

  const gato = C.gato('gatoEstudo');
  const linguaEl = $('#estLingua');
  const padraoAlvo = () => (C.minhaLingua().startsWith('en') ? 'es-ES' : 'en-US');
  C.preencher(linguaEl, localStorage.getItem('trad-est-lingua') || padraoAlvo());
  linguaEl.onchange = () => {
    localStorage.setItem('trad-est-lingua', linguaEl.value);
    gato.dizer('Boa escolha! Vamos de ' + C.nomeLingua(linguaEl.value) + '! 🎉');
  };

  // ---------- Pontos e dias seguidos ----------
  const hoje = () => new Date().toISOString().slice(0, 10);
  let xp = Number(localStorage.getItem('trad-xp') || 0);
  let dias = Number(localStorage.getItem('trad-dias') || 0);
  function mostrarPontos() { $('#xpTotal').textContent = '⭐ ' + xp; $('#xpSeq').textContent = '🔥 ' + dias; }
  function ganhar(n) {
    xp += n; localStorage.setItem('trad-xp', xp);
    const ult = localStorage.getItem('trad-dia'), h = hoje();
    if (ult !== h) {
      const ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      dias = ult === ontem ? dias + 1 : 1;
      localStorage.setItem('trad-dia', h); localStorage.setItem('trad-dias', dias);
      if (dias > 1) setTimeout(() => gato.dizer('🔥 ' + dias + ' dias seguidos estudando! Miau-ravilha!'), 1500);
    }
    mostrarPontos();
  }
  mostrarPontos();

  // ---------- Comparar o que a pessoa falou ----------
  const normal = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  function parecido(a, b) {
    a = normal(a); b = normal(b);
    if (!a || !b) return 0;
    const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return 1 - d[m][n] / Math.max(m, n);
  }

  // ---------- Temas ----------
  const temasEl = $('#temas');
  TEMAS.forEach((t, i) => {
    const b = document.createElement('button');
    b.innerHTML = '<b>' + t.ico + '</b>' + C.esc(t.nome);
    b.onclick = () => abrirTema(i);
    temasEl.appendChild(b);
  });

  let tema = null, itens = [], pos = 0, modo = 'cartao', alvoLingua = 'en-US';
  async function abrirTema(i) {
    alvoLingua = linguaEl.value;
    const minha = C.minhaLingua();
    if (C.codTrad(alvoLingua) === C.codTrad(minha)) { gato.dizer('Escolha um idioma diferente do seu para estudar! 😉'); return; }
    tema = TEMAS[i];
    $('#estTemas').hidden = true; $('#estCartoes').hidden = false;
    $('#estTitulo').textContent = tema.ico + ' ' + tema.nome + ' · ' + C.nomeLingua(alvoLingua);
    $('#estMinha').textContent = 'Traduzindo as frases…'; $('#estAlvo').textContent = '';
    // tudo num pedido só por idioma (e na hora, se já foi traduzido antes)
    const atual = tema;
    const [minhas, alvos] = await Promise.all([C.traduzirVarias(tema.frases, 'pt-BR', minha), C.traduzirVarias(tema.frases, 'pt-BR', alvoLingua)]);
    if (tema !== atual) return; // trocou de tema no meio
    itens = tema.frases.map((pt, k) => ({ pt, minha: minhas[k], alvo: alvos[k] }));
    pos = 0; modo = 'cartao';
    mostrar();
    gato.dizer('Toque em 🔊 para ouvir e em 🎤 para repetir. Você consegue! 💪'); gato.dancar(2000, true); combo = 0;
  }

  function mostrar() {
    if (!itens.length) return;
    const it = itens[pos];
    $('#estConta').textContent = (pos + 1) + ' / ' + itens.length;
    $('#estProg').style.width = ((pos + 1) / itens.length * 100) + '%';
    $('#estModoCartao').hidden = modo !== 'cartao';
    $('#estModoQuiz').hidden = modo !== 'quiz';
    $('#estTroca').textContent = modo === 'cartao' ? '🧩 Quiz' : '🃏 Cartões';
    $('#estOuvi').textContent = '';
    if (modo === 'cartao') {
      $('#estMinha').textContent = it.minha;
      const alvo = $('#estAlvo'); alvo.textContent = it.alvo; alvo.classList.add('oculto');
    } else {
      $('#estQuizAlvo').textContent = it.alvo;
      const certas = it.minha;
      const outras = itens.filter((x) => x !== it).sort(() => Math.random() - 0.5).slice(0, 3).map((x) => x.minha);
      const ops = [certas, ...outras].sort(() => Math.random() - 0.5);
      const box = $('#estOpcoes'); box.innerHTML = '';
      let respondeu = false;
      ops.forEach((o) => {
        const b = document.createElement('button'); b.textContent = o;
        b.onclick = () => {
          if (respondeu) return; respondeu = true;
          if (o === certas) { b.classList.add('certa'); acertou(5, 'Acertou! +5 ⭐ 😺'); setTimeout(proximo, 1400); }
          else {
            b.classList.add('errada');
            [...box.children].find((x) => x.textContent === certas).classList.add('certa');
            errou('Quase! A certa está em verde. Vamos para a próxima 💛');
          }
        };
        box.appendChild(b);
      });
      ouvirAlvo();
    }
  }
  // o gatinho dança enquanto a frase é falada
  const ouvirAlvo = (vel = 0.95) => {
    const it = itens[pos]; if (!it) return;
    C.falar(it.alvo, alvoLingua, { sempre: true, vel, aoComecar: () => gato.dancando(true), aoTerminar: () => gato.dancando(false) });
  };
  // combo: acertos seguidos deixam a festa maior
  let combo = 0;
  function acertou(pontos, frase) {
    combo++; ganhar(pontos); C.miau();
    if (combo >= 3) {
      const c = document.createElement('div'); c.className = 'combo'; c.textContent = '🔥 Combo x' + combo + '!';
      document.body.appendChild(c); setTimeout(() => c.remove(), 1350);
      gato.dancar(2600, true); gato.confete(combo >= 5 ? 28 : 18);
      if (combo === 5 && window.ClaSpeakEmocao) setTimeout(() => window.ClaSpeakEmocao('canta', document.querySelector('#gatoEstudo img')), 2700);
      gato.dizer(frase + ' 🔥 ' + combo + ' seguidos!');
    } else { gato.dancar(1700); gato.confete(8); gato.dizer(frase); }
  }
  function errou(frase) { combo = 0; gato.nao(); gato.dizer(frase); setTimeout(() => window.ClaSpeakEmocao && window.ClaSpeakEmocao('triste', document.querySelector('#gatoEstudo img')), 700); }
  function proximo() { pos = (pos + 1) % itens.length; if (pos === 0) { ganhar(10); gato.dizer('🎉 Você terminou o tema! +10 ⭐ Miau!'); C.miau(); gato.dancar(3600, true); gato.confete(30); } else gato.pular(); mostrar(); }

  $('#estAlvo').onclick = () => $('#estAlvo').classList.remove('oculto');
  $('#estOuvir').onclick = () => { $('#estAlvo').classList.remove('oculto'); ouvirAlvo(); };
  $('#estDevagar').onclick = () => { $('#estAlvo').classList.remove('oculto'); ouvirAlvo(0.6); };
  $('#estQuizOuvir').onclick = () => ouvirAlvo();
  $('#estProx').onclick = () => { C.ouvinte.parar(); proximo(); };
  $('#estAnt').onclick = () => { C.ouvinte.parar(); pos = (pos - 1 + itens.length) % itens.length; gato.pular(); mostrar(); };
  $('#estTroca').onclick = () => { C.ouvinte.parar(); modo = modo === 'cartao' ? 'quiz' : 'cartao'; mostrar(); };
  $('#estVoltar').onclick = () => { C.ouvinte.parar(); tema = null; $('#estCartoes').hidden = true; $('#estTemas').hidden = false; gato.dizer('Qual tema agora? 📚'); };

  const falarBtn = $('#estFalar');
  falarBtn.onclick = () => {
    if (C.ouvinte.ativo) { C.ouvinte.parar(); return; }
    if (!C.temVoz()) { gato.dizer('Seu navegador não reconhece voz. Use o Chrome (Android) ou o Safari (iPhone). 🙀'); return; }
    const it = itens[pos];
    const ok = C.ouvinte.iniciar(alvoLingua, {
      parcial: (t) => { $('#estOuvi').textContent = t ? '👂 ' + t : '👂 Ouvindo…'; },
      final: (t) => {
        C.ouvinte.parar();
        const nota = parecido(t, it.alvo);
        $('#estOuvi').textContent = '👂 Ouvi: “' + t + '”';
        $('#estAlvo').classList.remove('oculto');
        if (nota >= 0.75) acertou(10, (nota > 0.92 ? 'Perfeito! ' : 'Muito bem! ') + '+10 ⭐ 😺');
        else if (nota >= 0.5) errou('Quase lá! Ouça de novo e repita 💪');
        else errou('Hmm, não entendi bem. Toque em 🐢 e tente de novo! 🐾');
      },
      erro: (m) => gato.dizer(m),
      fim: () => { falarBtn.classList.remove('ligado'); falarBtn.textContent = '🎤 Repetir'; gato.ouvindo(false); }
    });
    if (ok) { falarBtn.textContent = '⏹ Parar'; gato.ouvindo(true); $('#estOuvi').textContent = '👂 Pode falar…'; }
  };

  window.ClaSpeakEstudo = {
    abrir() { mostrarPontos(); setTimeout(() => gato.pular(), 250); if (!tema) gato.dizer(xp ? 'Miau! Você já tem ' + xp + ' ⭐. Vamos estudar mais? 📚' : 'Vamos aprender juntos? Escolha o idioma e um tema! 📚'); }
  };
})();
