import { $, esc, aviso, debounce } from './util.js';
import { listar, obter, salvar } from '../dados/banco.js';
import { preparar, adicionarAoFim, restaurar, desfazer, todas, historico } from '../compor/versoes.js';
import { versos, refrao, ponte, intro, final, bloco, textoBloco, tipoDe, continuar, ESQUEMAS, temaDe, linhasDe } from '../compor/letra.js';
import { rimas, palavrasDeTexto, ultimaPalavra } from '../compor/rimas.js';
import { TEMAS } from '../compor/dic.js';
import { progressoes, proximos, SECOES, rotuloEstilo } from '../compor/harmonia.js';
import { ESTILOS, ENERGIAS } from '../banda/gerar.js';
import { N, F, usaBemol } from '../analise/dsp.js';

let aba = 'letra', seed = 1;
const ABAS = [['letra', 'Letra'], ['rimas', 'Rimas'], ['estrutura', 'Estrutura'], ['harmonia', 'Harmonia'], ['versoes', 'Versões']];
const PRESET = [['Intro', 4, 0], ['Verso', 8, 1], ['Refrão', 8, 2], ['Verso', 8, 1], ['Refrão', 8, 2], ['Ponte', 4, 1], ['Refrão', 8, 2], ['Final', 4, 0]];
const NOTAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const raizDe = (p) => Math.max(0, NOTAS.indexOf(p.tom || 'C'));

export async function telaEscolher() {
  const l = await listar();
  return `<main class="tela"><h1>Compositor</h1><p class="mute">Escolha a música para compor. Sua letra original fica sempre guardada.</p>
  ${l.length ? `<div class="lista" style="margin-top:12px">${l.map((p) => `<button class="item" data-cp="${p.id}"><span class="t"><b>${esc(p.titulo)}</b><small>${linhasDe(p.letra).length} linha(s) de letra</small></span></button>`).join('')}</div>` : '<div class="vazio"><p><b>Nenhum projeto ainda.</b></p><p>Crie um na tela inicial.</p></div>'}</main>`;
}
export async function telaCompor(id) {
  const p = await obter(id);
  if (!p) return '<main class="tela"><div class="vazio"><p><b>Não achei esse projeto.</b></p><button id="voltar">Voltar</button></div></main>';
  return `<main class="tela"><button id="voltar" style="min-height:44px">← ${esc(p.titulo)}</button><h1>Compositor</h1><p class="mute peq">Nada é trocado na sua letra sem você pedir, e tudo fica no histórico. As sugestões vêm de regras e vocabulário do próprio app (sem internet): são ponto de partida, não texto pronto.</p><div id="cp"><p class="mute">Carregando…</p></div></main>`;
}
export function ligarEscolher(ctx) { document.querySelectorAll('[data-cp]').forEach((b) => (b.onclick = () => ctx.ir('/compor/' + b.dataset.cp + (ctx.q && ctx.q.aba ? '?aba=' + ctx.q.aba : '')))); }

export async function ligarCompor(ctx, p0) {
  $('#voltar').onclick = () => ctx.ir('/projeto/' + p0.id);
  aba = ['letra', 'rimas', 'estrutura', 'harmonia', 'versoes'].includes(ctx.q && ctx.q.aba) ? ctx.q.aba : 'letra'; let p = await preparar(p0.id); const id = p.id; let C = { estilo: 'pop', tema: null, esquema: 'AABB', rascunho: '', ...(p.compo || {}) };
  const recarrega = async () => { p = await obter(id); return p; };
  const salvaC = debounce(async () => { const q = await obter(id); if (!q) return; q.compo = C; await salvar(q); }, 400);
  const mexe = async (fn) => { const q = await obter(id); fn(q); await salvar(q); p = q; return q; };
  const outras = async () => (await listar()).filter((x) => x.id !== id).map((x) => ({ titulo: x.titulo, letra: x.letra }));
  const tema = () => C.tema || temaDe(p.letra);
  const arranjo = () => { if (!p.arranjo) p.arranjo = { estilo: C.estilo, prog: progressoes(C.estilo, 'Verso', raizDe(p), p.modo !== 'm')[0].acordes, secoes: PRESET.map(([n, c, e]) => ({ nome: n, compassos: c, energia: e })), instr: { bateria: true, baixo: true, violao: true, guitarra: false, teclado: true } }; return p.arranjo; };
  const gravaArranjo = () => mexe((q) => { q.arranjo = p.arranjo; });

  const raspa = (txt) => { const el = $('#rasc'); if (!el) return; el.value = (el.value.replace(/\s+$/, '') ? el.value.replace(/\s+$/, '') + '\n\n' : '') + txt; C.rascunho = el.value; salvaC(); el.scrollIntoView({ block: 'nearest' }); aviso('No rascunho. Ainda não foi para a letra.'); };
  const card = (titulo, linhas, extra = '') => `<div class="item" style="flex-direction:column;align-items:stretch;gap:8px"><b>${esc(titulo)}</b><pre style="white-space:pre-wrap;margin:0;font:inherit">${esc(linhas.join('\n'))}</pre>${extra}<button data-ras="${esc(linhas.join('\n'))}">Pôr no rascunho</button></div>`;

  async function desenha() {
    await recarrega(); const t = tema(), maior = p.modo !== 'm', r = raizDe(p);
    $('#cp').innerHTML = `<div class="duas" role="tablist" style="margin-bottom:10px">${ABAS.map(([k, n]) => `<button role="tab" data-ab="${k}" aria-pressed="${aba === k}">${n}</button>`).join('')}</div>
    <div class="duas"><label class="campo"><span>Estilo</span><select id="est">${Object.entries(ESTILOS).map(([k, v]) => `<option value="${k}" ${C.estilo === k ? 'selected' : ''}>${v.nome}</option>`).join('')}</select></label>
    <label class="campo"><span>Tema</span><select id="tem">${Object.entries(TEMAS).map(([k, v]) => `<option value="${k}" ${t === k ? 'selected' : ''}>${v.nome}</option>`).join('')}</select></label></div>
    <div id="aba"></div>
    <h2>Rascunho</h2><textarea id="rasc" rows="6" placeholder="As sugestões que você escolher aparecem aqui. Edite à vontade; só vai para a letra quando você tocar em Adicionar.">${esc(C.rascunho || '')}</textarea>
    <div class="duas" style="margin-top:6px"><button class="ouro" id="addl">Adicionar ao fim da letra</button><button id="limp">Limpar rascunho</button></div>`;
    document.querySelectorAll('[data-ab]').forEach((b) => (b.onclick = () => { aba = b.dataset.ab; desenha(); }));
    $('#est').onchange = async (e) => { C.estilo = e.target.value; salvaC(); const a = p.arranjo; if (a) { a.estilo = C.estilo; await gravaArranjo(); } desenha(); };
    $('#tem').onchange = (e) => { C.tema = e.target.value; salvaC(); desenha(); };
    $('#rasc').oninput = (e) => { C.rascunho = e.target.value; salvaC(); };
    $('#limp').onclick = () => { if (!C.rascunho) return; if (!confirm('Limpar o rascunho? A sua letra não é afetada.')) return; C.rascunho = ''; $('#rasc').value = ''; salvaC(); };
    $('#addl').onclick = async () => { const txt = $('#rasc').value.trim(); if (!txt) return aviso('O rascunho está vazio.'); await adicionarAoFim(id, txt, 'Adicionado do rascunho'); C.rascunho = ''; salvaC.agora(); aviso('Adicionado ao fim da letra. Dá para desfazer em Versões.'); desenha(); };
    await ({ letra: abaLetra, rimas: abaRimas, estrutura: abaEstrutura, harmonia: abaHarmonia, versoes: abaVersoes }[aba])(t, maior, r);
    document.querySelectorAll('[data-ras]').forEach((b) => (b.onclick = () => raspa(b.dataset.ras)));
  }

  // ---------- Letra
  async function abaLetra(t) {
    const nl = linhasDe(p.letra).length;
    $('#aba').innerHTML = `<h2>Letra</h2><p class="mute peq">${nl ? 'Sua letra tem ' + nl + ' linha(s).' : 'Sua letra está vazia.'}</p>
    <label class="campo"><span>Esquema de rimas</span><select id="esq">${Object.entries(ESQUEMAS).map(([k, v]) => `<option value="${k}" ${C.esquema === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="duas" style="margin-top:8px"><button class="ouro" id="cont">Continuar a letra</button><button id="sug">Versos novos</button><button id="bref">Refrão</button><button id="bpon">Ponte</button><button id="bint">Introdução</button><button id="bfin">Final</button></div><div id="res" class="lista" style="margin-top:10px"></div>`;
    $('#esq').onchange = (e) => { C.esquema = e.target.value; salvaC(); };
    const mostra = (html) => { $('#res').innerHTML = html; document.querySelectorAll('#res [data-ras]').forEach((b) => (b.onclick = () => raspa(b.dataset.ras))); };
    const lr = () => { const q = p.letra && linhasDe(p.letra).length ? refraoDaLetra(p.letra) : null; return q; };
    $('#cont').onclick = async () => { seed++; const c = continuar(p.letra, await outras(), { tema: t, seed });
      mostra((c.ultima ? `<p class="mute peq">Última linha: “${esc(c.ultima)}”. Próximas linhas que rimam com ela:</p>` : '') + c.rimando.map((l) => card('Rima com o fim da sua última linha', [l])).join('') + (c.novos.length ? card('Dois versos novos (rima nova)', c.novos) : '') + c.seus.map((s) => card('Verso seu que rima, de “' + s.de + '”', [s.linha])).join('') + (!c.rimando.length && !c.seus.length && c.ultima ? '<p class="mute">Não achei rimas para essa palavra. Tente a aba Rimas.</p>' : '')); };
    $('#sug').onclick = () => { seed++; mostra([0, 1, 2].map((i) => card('Versos ' + (i + 1), versos({ tema: t, esquema: C.esquema, seed: seed * 3 + i }))).join('')); };
    $('#bref').onclick = () => { seed++; mostra([0, 1, 2].map((i) => card('Refrão ' + (i + 1), refrao({ tema: t, seed: seed * 3 + i }))).join('')); };
    $('#bpon').onclick = () => { seed++; mostra([0, 1].map((i) => card('Ponte ' + (i + 1), ponte({ tema: t, seed: seed * 3 + i }))).join('')); };
    $('#bint').onclick = () => { seed++; mostra([0, 1].map((i) => card('Introdução ' + (i + 1), intro({ tema: t, seed: seed * 3 + i }))).join('')); };
    $('#bfin').onclick = () => { seed++; mostra([0, 1].map((i) => card('Final ' + (i + 1), final({ tema: t, seed: seed * 3 + i, refraoLinhas: lr() }))).join('')); };
  }
  const refraoDaLetra = (txt) => { const m = /\[Refr[aã]o[^\]]*\]\n([\s\S]*?)(?:\n\s*\n|\n\[|$)/i.exec(txt); return m ? m[1].trim().split('\n').filter(Boolean) : null; };

  // ---------- Rimas
  async function abaRimas() {
    const ult = ultimaPalavra(linhasDe(p.letra).slice(-1)[0] || '') || '';
    $('#aba').innerHTML = `<h2>Rimas</h2><div style="display:flex;gap:8px"><input id="pal" value="${esc(ult)}" placeholder="Digite uma palavra" aria-label="Palavra" style="flex:1" autocapitalize="none"><button class="ouro" id="rb">Buscar</button></div><div id="rr"></div>`;
    const busca = async () => {
      const w = $('#pal').value.trim().toLowerCase(); if (!w) return;
      const minhas = []; palavrasDeTexto(p.letra).forEach((x) => minhas.push(x)); (await outras()).forEach((o) => palavrasDeTexto(o.letra).forEach((x) => minhas.push(x)));
      const R = rimas(w, [...new Set(minhas)]), chip = (l) => l.map((x) => `<button data-w="${esc(x)}" style="min-height:44px;margin:3px">${esc(x)}</button>`).join('');
      $('#rr').innerHTML = !R.chave ? '<p class="mute">Digite uma palavra.</p>' : `<p class="mute peq">Rimas com “${esc(w)}” (som final: -${esc(R.chave)}). Toque na palavra para pôr no rascunho.</p>${R.suas.length ? '<h3>Palavras das suas letras</h3>' + chip(R.suas) : ''}<h3>Rimas perfeitas</h3>${R.consoantes.length ? chip(R.consoantes) : '<p class="mute">Nenhuma no vocabulário do app.</p>'}<h3>Rimas aproximadas (mesmas vogais)</h3>${R.toantes.length ? chip(R.toantes) : '<p class="mute">Nenhuma.</p>'}`;
      document.querySelectorAll('#rr [data-w]').forEach((b) => (b.onclick = () => { const el = $('#rasc'); el.value = (el.value ? el.value.replace(/[ \t]+$/, '') + (el.value.endsWith('\n') ? '' : ' ') : '') + b.dataset.w; C.rascunho = el.value; salvaC(); aviso('“' + b.dataset.w + '” no rascunho.'); }));
    };
    $('#rb').onclick = busca; $('#pal').onkeydown = (e) => { if (e.key === 'Enter') busca(); }; if (ult) busca();
  }

  // ---------- Estrutura
  async function abaEstrutura(t, maior, r) {
    const a = arranjo(); const prog = (s) => s.prog || (tipoDe(s.nome) && progressoes(C.estilo, tipoDe(s.nome), r, maior)[0].acordes) || a.prog;
    $('#aba').innerHTML = `<h2>Estrutura da música</h2><p class="mute peq">É a mesma estrutura da Minha Banda: o que você mudar aqui vale lá.</p><div class="lista" id="sc">${a.secoes.map((s, i) => `<div class="item" style="flex-direction:column;align-items:stretch;gap:8px" data-s="${i}"><div style="display:flex;gap:6px"><input data-n value="${esc(s.nome)}" aria-label="Nome da seção" style="flex:1"><button data-up aria-label="Subir" ${i ? '' : 'disabled'}>↑</button><button data-dn aria-label="Descer" ${i < a.secoes.length - 1 ? '' : 'disabled'}>↓</button><button data-x aria-label="Remover seção">✕</button></div>
      <div style="display:flex;gap:8px;align-items:center"><input type="number" data-c min="1" max="32" value="${s.compassos}" style="width:70px" aria-label="Compassos"><span class="mute">compassos</span><select data-en aria-label="Energia" style="margin-left:auto">${ENERGIAS.map((n, k) => `<option value="${k}" ${s.energia === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <p class="mute peq">Acordes: <b>${esc(prog(s))}</b></p><button data-g>Gerar texto desta seção</button></div>`).join('')}</div>
    <div class="duas" style="margin-top:8px"><button id="ns">+ Seção</button><button id="padr">Estrutura completa</button></div>
    <button class="ouro cta" id="todo" style="margin-top:8px">Gerar rascunho da música toda</button><button id="paraBanda" style="width:100%;margin-top:8px">Ir para a Minha Banda</button>`;
    document.querySelectorAll('#sc [data-s]').forEach((el) => { const i = +el.dataset.s, s = a.secoes[i];
      el.querySelector('[data-n]').onchange = async (e) => { s.nome = e.target.value || s.nome; await gravaArranjo(); };
      el.querySelector('[data-c]').onchange = async (e) => { s.compassos = Math.max(1, Math.min(32, +e.target.value || 1)); await gravaArranjo(); };
      el.querySelector('[data-en]').onchange = async (e) => { s.energia = +e.target.value; await gravaArranjo(); };
      el.querySelector('[data-up]').onclick = async () => { [a.secoes[i - 1], a.secoes[i]] = [a.secoes[i], a.secoes[i - 1]]; await gravaArranjo(); desenha(); };
      el.querySelector('[data-dn]').onclick = async () => { [a.secoes[i + 1], a.secoes[i]] = [a.secoes[i], a.secoes[i + 1]]; await gravaArranjo(); desenha(); };
      el.querySelector('[data-x]').onclick = async () => { if (a.secoes.length < 2) return aviso('Deixe ao menos uma seção.'); a.secoes.splice(i, 1); await gravaArranjo(); desenha(); };
      el.querySelector('[data-g]').onclick = () => { seed++; raspa(textoBloco(s.nome, bloco(s.nome, { tema: t, seed: seed * 5 + i, refraoLinhas: refraoDaLetra(p.letra) }))); };
    });
    $('#ns').onclick = async () => { a.secoes.push({ nome: 'Verso', compassos: 8, energia: 1 }); await gravaArranjo(); desenha(); };
    $('#padr').onclick = async () => { if (a.secoes.length > 1 && !confirm('Trocar a estrutura atual pela estrutura completa (Intro, Verso, Refrão, Verso, Refrão, Ponte, Refrão, Final)? Você pode editar depois.')) return; a.secoes = PRESET.map(([n, c, e]) => ({ nome: n, compassos: c, energia: e })); await gravaArranjo(); desenha(); };
    $('#todo').onclick = () => { seed++; const ref = refrao({ tema: t, seed: seed * 7 }); let nv = 0; const out = a.secoes.map((s, i) => { const ty = tipoDe(s.nome); let l; if (ty === 'Refrão') l = ref; else if (ty === 'Verso') l = versos({ tema: t, esquema: C.esquema, seed: seed * 11 + ++nv }); else l = bloco(s.nome, { tema: t, seed: seed * 5 + i, refraoLinhas: ref }); return textoBloco(s.nome, l); }); raspa(out.join('\n\n')); };
    $('#paraBanda').onclick = () => ctx.ir('/banda/' + id);
  }

  // ---------- Harmonia
  async function abaHarmonia(t, maior, r) {
    const nomes = usaBemol(r, maior) ? F : N;
    $('#aba').innerHTML = `<h2>Harmonia</h2><div class="duas"><label class="campo"><span>Tom</span><select id="tom">${NOTAS.map((n) => `<option ${p.tom === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label class="campo"><span>Modo</span><select id="mod"><option value="M" ${maior ? 'selected' : ''}>Maior</option><option value="m" ${maior ? '' : 'selected'}>Menor</option></select></label></div>
    <p class="mute peq">Progressões de ${esc(rotuloEstilo(C.estilo))} em ${esc(nomes[r] + (maior ? '' : 'm'))}. “Usar” aplica na estrutura da Minha Banda; “Cifra” acrescenta no fim da sua cifra (nada é apagado).</p>
    ${SECOES.map((sec) => `<h3>${sec}</h3><div class="lista">${progressoes(C.estilo, sec, r, maior).map((o, i) => `<div class="item" style="flex-direction:column;align-items:stretch;gap:6px"><b>${esc(o.acordes)}</b><span class="mute peq">${esc(o.graus)}</span><div class="duas"><button data-us="${sec}|${i}">Usar</button><button data-ci="${sec}|${i}">Cifra</button></div></div>`).join('')}</div>`).join('')}
    <h3>Qual acorde vem depois?</h3><div style="display:flex;gap:8px"><input id="a1" placeholder="Ex.: G" aria-label="Acorde atual" style="flex:1" autocapitalize="characters"><button id="a2">Ver</button></div><div id="ar"></div>`;
    $('#tom').onchange = async (e) => { await mexe((q) => { q.tom = e.target.value; }); desenha(); };
    $('#mod').onchange = async (e) => { await mexe((q) => { q.modo = e.target.value; }); desenha(); };
    document.querySelectorAll('[data-us]').forEach((b) => (b.onclick = async () => { const [sec, i] = b.dataset.us.split('|'), o = progressoes(C.estilo, sec, r, maior)[+i], a = arranjo(); a.estilo = C.estilo; let n = 0; a.secoes.forEach((s) => { if (tipoDe(s.nome) === sec) { s.prog = o.acordes; n++; } }); if (sec === 'Verso') a.prog = o.acordes; await gravaArranjo(); aviso(n ? sec + ': acordes aplicados em ' + n + ' seção(ões) da banda.' : 'Não há seção “' + sec + '” na estrutura. Adicione em Estrutura.'); }));
    document.querySelectorAll('[data-ci]').forEach((b) => (b.onclick = async () => { const [sec, i] = b.dataset.ci.split('|'), o = progressoes(C.estilo, sec, r, maior)[+i]; await mexe((q) => { q.cifra = (q.cifra ? q.cifra.replace(/\s+$/, '') + '\n\n' : '') + '[' + sec + ']\n' + o.acordes; }); aviso('Acordes no fim da cifra.'); }));
    $('#a2').onclick = () => { const x = proximos($('#a1').value, r, maior); $('#ar').innerHTML = x.opcoes.length ? `<div class="lista" style="margin-top:8px">${x.opcoes.map((o) => `<div class="item"><span class="t"><b>${esc(o.nome)}</b> <small>(${esc(o.grau)})</small><small>${esc(o.porque)}</small></span></div>`).join('')}</div>` : '<p class="mute">Não é um acorde do tom escolhido, ou não reconheci. Tente um acorde simples, como C, Am ou G.</p>'; };
  }

  // ---------- Versões
  async function abaVersoes() {
    const vs = todas(p), at = (txt) => String(txt || '').replace(/\s+$/g, '') === String(p.letra || '').replace(/\s+$/g, '');
    $('#aba').innerHTML = `<h2>Versões da letra</h2><p class="mute peq">A versão original é protegida e nunca é apagada. Voltar para uma versão guarda antes a que estava na tela.</p><button class="ouro" id="desf" style="width:100%">Desfazer última alteração</button><div class="lista" style="margin-top:10px">${vs.map((v) => `<div class="item" style="flex-direction:column;align-items:stretch;gap:6px"><b>${v.origem === 'original' ? '🔒 ' : ''}${esc(v.rotulo)}${at(v.texto) ? ' — atual' : ''}</b><small class="mute">${v.em ? new Date(v.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''} · ${linhasDe(v.texto).length} linha(s)</small><details><summary>Ver texto</summary><pre style="white-space:pre-wrap;font:inherit">${esc(v.texto || '(vazio)')}</pre></details>${at(v.texto) ? '' : `<button data-rv="${v.id}">Voltar para esta versão</button>`}</div>`).join('')}</div>`;
    $('#desf').onclick = async () => { const x = await desfazer(id); aviso(x.feito ? 'Desfeito: voltou para “' + x.para.rotulo + '”.' : 'Não há nada para desfazer.'); desenha(); };
    document.querySelectorAll('[data-rv]').forEach((b) => (b.onclick = async () => { if (!confirm('Voltar para esta versão? A letra atual fica guardada no histórico.')) return; await restaurar(id, b.dataset.rv); aviso('Pronto. A letra anterior ficou guardada no histórico.'); desenha(); }));
  }
  desenha();
}
