import { $, esc, aviso, debounce } from './util.js';
import { listar, obter, salvar, adicionarFaixa, removerFaixa } from '../dados/banco.js';
import { paraWav, mmss } from '../audio/wav.js';
import { gerar, lerAcordes, acordesDaCifra, ESTILOS, INSTR, ENERGIAS, MIX } from '../banda/gerar.js';

let ocupado = false;
export async function telaEscolher() {
  const l = await listar();
  return `<main class="tela"><h1>Minha Banda IA</h1><p class="mute">Escolha a música. A banda toca os acordes no estilo que você escolher e cada instrumento vira uma faixa.</p>
  ${l.length ? `<div class="lista" style="margin-top:12px">${l.map((p) => `<button class="item" data-bd="${p.id}"><span class="t"><b>${esc(p.titulo)}</b><small>${(p.faixas || []).length} faixa(s)</small></span></button>`).join('')}</div>` : '<div class="vazio"><p><b>Nenhum projeto ainda.</b></p><p>Crie um na tela inicial.</p></div>'}</main>`;
}
export async function telaBanda(id) {
  const p = await obter(id);
  if (!p) return '<main class="tela"><div class="vazio"><p><b>Não achei esse projeto.</b></p><button id="voltar">Voltar</button></div></main>';
  return `<main class="tela"><button id="voltar" style="min-height:44px">← ${esc(p.titulo)}</button><h1>Minha Banda IA</h1><div id="bd"></div></main>`;
}
export function ligarEscolher(ctx) { document.querySelectorAll('[data-bd]').forEach((b) => (b.onclick = () => ctx.ir('/banda/' + b.dataset.bd))); }

const padrao = (p) => {
  const an = p.analise && (p.analise.acordes || []).filter((c) => !c.mudo).map((c) => c.nome).filter((n, i, a) => n !== a[i - 1]).slice(0, 8), ci = acordesDaCifra(p.cifra);
  return { estilo: 'pop', prog: (ci.length ? ci : an && an.length ? an : ['C', 'Am', 'F', 'G']).join(' '), secoes: [{ nome: 'Intro', compassos: 2, energia: 0 }, { nome: 'Verso', compassos: 8, energia: 1 }, { nome: 'Refrão', compassos: 8, energia: 2 }, { nome: 'Final', compassos: 2, energia: 0 }], instr: { bateria: true, baixo: true, violao: true, guitarra: false, teclado: true } };
};
export async function ligarBanda(ctx, p) {
  $('#voltar').onclick = () => ctx.ir('/projeto/' + p.id);
  const A = { ...padrao(p), ...(p.arranjo || {}) }; let bpm = p.bpm || ESTILOS[A.estilo].bpm, manual = !!p.arranjo || (p.bpm && p.bpm !== 90);
  const grava = debounce(async () => { const q = await obter(p.id); if (!q) return; q.arranjo = A; q.bpm = bpm; await salvar(q); }, 400);
  const total = () => A.secoes.reduce((s, x) => s + Math.max(1, Math.min(32, x.compassos | 0)), 0);
  const desenha = () => {
    const ac = lerAcordes(A.prog), c = total();
    $('#bd').innerHTML = `<h2>Acordes (um por compasso)</h2><input id="ac" value="${esc(A.prog)}" aria-label="Acordes" autocapitalize="characters" style="width:100%">
    <p class="mute peq" id="acm">${ac.ruim.length ? 'Não reconheci: ' + esc(ac.ruim.join(' ')) + '. ' : ''}${ac.ok.length ? ac.ok.length + ' acorde(s) em sequência, repetidos até fechar cada seção.' : 'Escreva os acordes separados por espaço, como C Am F G.'}</p>
    <div class="duas" style="margin-top:6px"><button id="dc">Pegar da cifra</button><button id="da" ${p.analise ? '' : 'disabled'}>Pegar da análise</button></div>
    <h2>Estilo</h2><div class="duas">${Object.entries(ESTILOS).map(([k, v]) => `<button data-e="${k}" aria-pressed="${A.estilo === k}">${v.nome}</button>`).join('')}</div>
    <label class="linha" style="margin-top:10px"><span>Andamento</span><input type="number" id="bp" min="50" max="220" value="${bpm}" style="width:90px" aria-label="Andamento em BPM"><span class="mute">BPM</span></label>
    <h2>Instrumentos</h2><div class="lista">${INSTR.map(([k, n]) => `<label class="item linha"><input type="checkbox" data-i="${k}" ${A.instr[k] ? 'checked' : ''} style="width:24px;min-height:24px"> <span>${n}</span></label>`).join('')}</div>
    <h2>Estrutura da música</h2><div class="lista" id="sc">${A.secoes.map((s, i) => `<div class="item" style="flex-direction:column;align-items:stretch;gap:8px" data-s="${i}"><div style="display:flex;gap:8px"><input data-n value="${esc(s.nome)}" aria-label="Nome da seção" style="flex:1"><button data-x aria-label="Remover seção">✕</button></div>
      <div style="display:flex;gap:8px;align-items:center"><input type="number" data-c min="1" max="32" value="${s.compassos}" style="width:70px" aria-label="Compassos"><span class="mute">compassos</span><select data-en aria-label="Energia" style="margin-left:auto">${ENERGIAS.map((n, k) => `<option value="${k}" ${s.energia === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>`).join('')}</div>
    <button id="ns" style="margin-top:8px">+ Adicionar seção</button><p class="mute peq" id="tt">${c} compassos</p>
    <button class="ouro cta" id="ger" style="margin-top:12px">Gerar a banda</button><div id="gr"></div>`;
    liga();
  };
  const atualizaTt = () => { const bt = $('#bp'); const d = total() * 4 * 60 / (bpm || 100); $('#tt').textContent = total() + ' compassos · cerca de ' + mmss(d) + (total() >= 96 ? ' (limite de 96 compassos)' : ''); };
  function liga() {
    $('#ac').oninput = (e) => { A.prog = e.target.value; const ac = lerAcordes(A.prog); $('#acm').textContent = (ac.ruim.length ? 'Não reconheci: ' + ac.ruim.join(' ') + '. ' : '') + (ac.ok.length ? ac.ok.length + ' acorde(s) em sequência, repetidos até fechar cada seção.' : 'Escreva os acordes separados por espaço, como C Am F G.'); grava(); };
    $('#dc').onclick = () => { const l = acordesDaCifra(p.cifra); if (!l.length) return aviso('Não achei linhas de acordes na cifra.'); A.prog = l.join(' '); grava(); desenha(); };
    $('#da').onclick = () => { const l = (p.analise.acordes || []).filter((c) => !c.mudo).map((c) => c.nome).filter((n, i, a) => n !== a[i - 1]).slice(0, 16); if (!l.length) return aviso('A análise não achou acordes.'); A.prog = l.join(' '); grava(); desenha(); };
    document.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => { A.estilo = b.dataset.e; if (!manual) bpm = ESTILOS[A.estilo].bpm; grava(); desenha(); }));
    $('#bp').oninput = (e) => { bpm = Math.max(50, Math.min(220, +e.target.value || 100)); manual = true; atualizaTt(); grava(); };
    document.querySelectorAll('[data-i]').forEach((c) => (c.onchange = () => { A.instr[c.dataset.i] = c.checked; grava(); }));
    document.querySelectorAll('[data-s]').forEach((el) => { const s = A.secoes[+el.dataset.s];
      el.querySelector('[data-n]').oninput = (e) => { s.nome = e.target.value; grava(); };
      el.querySelector('[data-c]').oninput = (e) => { s.compassos = Math.max(1, Math.min(32, +e.target.value || 1)); atualizaTt(); grava(); };
      el.querySelector('[data-en]').onchange = (e) => { s.energia = +e.target.value; grava(); };
      el.querySelector('[data-x]').onclick = () => { if (A.secoes.length < 2) return aviso('Deixe ao menos uma seção.'); A.secoes.splice(+el.dataset.s, 1); grava(); desenha(); }; });
    $('#ns').onclick = () => { A.secoes.push({ nome: 'Seção ' + (A.secoes.length + 1), compassos: 4, energia: 1 }); grava(); desenha(); };
    $('#ger').onclick = rodar;
  }
  async function rodar() {
    if (ocupado) return; const ac = lerAcordes(A.prog); if (!ac.ok.length) return aviso('Escreva ao menos um acorde.'); if (!Object.values(A.instr).some(Boolean)) return aviso('Marque ao menos um instrumento.');
    ocupado = true; grava.agora(); const b = $('#ger'); b.disabled = true; b.textContent = 'Gerando…'; const gr = $('#gr'); gr.innerHTML = '<div class="barra"><i id="bi"></i></div><p class="mute peq" id="bt"></p>';
    try {
      const r = await gerar({ prog: ac.ok, secoes: A.secoes, estilo: A.estilo, bpm, instr: A.instr }, (t, v) => { const i = $('#bi'), x = $('#bt'); if (i) i.style.width = Math.round(v * 100) + '%'; if (x) x.textContent = t; });
      const q = await obter(p.id), velhas = (q.faixas || []).filter((f) => f.tipo === 'banda' && A.instr[f.inst]);
      for (const f of velhas) await removerFaixa(p.id, f.id);
      for (const [k, v] of Object.entries(r.faixas)) await adicionarFaixa(p.id, paraWav(v.buf), { nome: INSTR.find((x) => x[0] === k)[1] + ' (banda ' + ESTILOS[A.estilo].nome + ')', inst: k, tipo: 'banda', vol: MIX[k].vol, pan: MIX[k].pan });
      gr.innerHTML = `<p><b>Banda pronta: ${Object.keys(r.faixas).length} faixa(s), ${r.compassos} compassos (${mmss(r.dur)}).</b></p><p class="mute peq">${velhas.length ? 'As faixas geradas antes foram trocadas pelas novas. ' : ''}Suas gravações não foram mexidas. Dá para mudar volume e lado de cada uma no estúdio.</p><button class="ouro" id="es">Ouvir no estúdio</button>`; $('#es').onclick = () => ctx.ir('/estudio/' + p.id);
    } catch (e) { gr.innerHTML = `<p class="mute">${esc(e.message || 'Não consegui gerar a banda.')}</p>`; }
    ocupado = false; b.disabled = false; b.textContent = 'Gerar a banda';
  }
  desenha();
}
