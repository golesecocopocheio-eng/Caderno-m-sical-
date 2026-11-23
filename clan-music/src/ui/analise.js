import { $, esc, aviso } from './util.js';
import { listar, obter, salvar } from '../dados/banco.js';
import { rodar } from '../analise/analisar.js';
import { nivel, nomeNota, N } from '../analise/dsp.js';

export async function telaEscolher() {
  const l = (await listar()).filter((p) => (p.faixas || []).length);
  return `<main class="tela"><h1>Notas, acordes e BPM</h1><p class="mute">Descobre o andamento, o tom, os acordes e a melodia do que você gravou. Tudo é feito aqui no celular, sem internet.</p>
  ${l.length ? `<div class="lista" style="margin-top:12px">${l.map((p) => `<button class="item" data-an="${p.id}"><span class="t"><b>${esc(p.titulo)}</b><small>${p.faixas.length} faixa(s)</small></span></button>`).join('')}</div>` : '<div class="vazio"><p><b>Nenhum projeto com áudio.</b></p><p>Grave uma ideia ou importe um áudio primeiro.</p></div>'}</main>`;
}
export async function telaAnalise(id) {
  const p = await obter(id);
  if (!p) return '<main class="tela"><div class="vazio"><p><b>Não achei esse projeto.</b></p><button id="voltar">Voltar</button></div></main>';
  return `<main class="tela"><button id="voltar" style="min-height:44px">← ${esc(p.titulo)}</button><h1>Analisar</h1>
  <p class="mute">É uma estimativa: confira de ouvido e corrija o que errar. Nada é trocado sem você pedir.</p><div id="res">${p.analise ? '' : '<button class="ouro cta" id="go">Analisar este projeto</button>'}</div></main>`;
}
const barra = '<div class="barra"><i id="bi"></i></div><p class="mute peq" id="bt">Preparando…</p>';

function mostrar(p, r, ir) {
  const k = r.tom, ac = (r.acordes || []).filter((c) => !c.mudo), nt = (r.melodia && r.melodia.notas) || []; let bv = r.bpm ? r.bpm.bpm : 0;
  $('#res').innerHTML = `<div class="duas"><div class="card"><small class="mute">Andamento</small><b class="grande2" id="bv">${r.bpm ? r.bpm.bpm + ' BPM' : '—'}</b><small class="mute">${r.bpm ? 'confiança ' + nivel(r.bpm.conf) : 'não achei ritmo marcado'}</small>${r.bpm ? '<div style="display:flex;gap:6px;margin-top:6px"><button id="bm" aria-label="Metade do andamento" style="flex:1">÷2</button><button id="bd" aria-label="Dobro do andamento" style="flex:1">×2</button></div>' : ''}</div>
  <div class="card"><small class="mute">Tom</small><b class="grande2">${k ? esc(k.nome) : '—'}</b><small class="mute">${k ? 'confiança ' + nivel(k.conf) + (k.conf < 0.4 ? ' — confira' : '') : ''}</small></div></div>
  ${r.bpm ? '<p class="mute peq">Se o andamento parecer o dobro ou a metade do que você toca, use ÷2 ou ×2 antes de aplicar.</p>' : ''}
  ${k && k.alt.length ? `<p class="mute peq">Se não for esse, pode ser ${k.alt.map(esc).join(' ou ')}.</p>` : ''}
  <h2>Acordes prováveis</h2>${ac.length ? `<div class="notas">${ac.map((c) => `<span class="${c.conf < 0.4 ? 'fraco' : ''}">${esc(c.nome)}</span>`).join('')}</div><p class="mute peq">Em cinza: pouca confiança. Acordes com sétima ou extensões aparecem como o acorde simples mais próximo.</p>` : '<p class="mute">Não consegui identificar acordes com segurança.</p>'}
  <h2>Melodia (${r.melodia ? esc(r.melodia.fonte === 'voz' ? 'da pista de voz' : 'da mixagem') : '—'})</h2>${nt.length >= 3 ? `<div class="notas">${nt.slice(0, 64).map((n) => `<span>${nomeNota(n.midi)}</span>`).join('')}</div><p class="mute peq">${nt.length} notas.${r.melodia.voz < 0.3 ? ' Pouca voz detectada: confiança baixa.' : ''} Uma linha só, sem violão por cima, dá resultado melhor.</p>` : '<p class="mute">Não achei uma melodia clara. Grave a voz sozinha, perto do microfone.</p>'}
  <div class="lista" style="margin-top:16px"><button class="ouro" id="ap1" ${r.bpm || k ? '' : 'disabled'}>Usar andamento e tom no projeto</button><button id="ap2" ${ac.length ? '' : 'disabled'}>Adicionar acordes à cifra</button><button id="ap3" ${nt.length >= 3 ? '' : 'disabled'}>Adicionar melodia às notas</button><button id="de">Analisar de novo</button></div>`;
  const grava = async (fn, msg) => { const q = await obter(p.id); fn(q); await salvar(q); aviso(msg); };
  if (r.bpm) { const ajusta = (f) => { const n = Math.round(bv * f); if (n < 40 || n > 240) return aviso('Fora do limite (40 a 240 BPM).'); bv = n; $('#bv').textContent = bv + ' BPM'; }; $('#bm').onclick = () => ajusta(0.5); $('#bd').onclick = () => ajusta(2); }
  $('#ap1').onclick = () => grava((q) => { if (r.bpm) q.bpm = bv; if (k) { q.tom = N[k.r]; q.modo = k.modo; } }, 'Andamento e tom aplicados. Dá para mudar quando quiser.');
  $('#ap2').onclick = () => grava((q) => { q.cifra = (q.cifra ? q.cifra.replace(/\s+$/, '') + '\n\n' : '') + '[Acordes sugeridos pela análise — confira]\n' + ac.map((c) => c.nome).join('  '); }, 'Acordes adicionados no fim da cifra. Nada foi apagado.');
  $('#ap3').onclick = () => grava((q) => { q.notas = (q.notas ? q.notas.replace(/\s+$/, '') + '\n\n' : '') + 'Melodia (análise): ' + nt.slice(0, 64).map((n) => nomeNota(n.midi)).join(' '); }, 'Melodia adicionada às notas.');
  $('#de').onclick = () => rodarAgora(p, ir);
}
async function rodarAgora(p, ir) {
  $('#res').innerHTML = barra;
  try {
    const r = await rodar(p, (t, v) => { const i = $('#bi'), x = $('#bt'); if (i) i.style.width = Math.round(v * 100) + '%'; if (x) x.textContent = t; });
    const q = await obter(p.id); q.analise = { ...r, em: Date.now() }; await salvar(q); mostrar(q, q.analise, ir);
  } catch (e) { $('#res').innerHTML = `<p class="mute">${esc(e.message || 'Não consegui analisar este áudio.')}</p><button class="ouro" id="go">Tentar de novo</button>`; $('#go').onclick = () => rodarAgora(p, ir); }
}
export function ligarEscolher(ctx) { document.querySelectorAll('[data-an]').forEach((b) => (b.onclick = () => ctx.ir('/analise/' + b.dataset.an))); }
export async function ligarAnalise(ctx, p) {
  $('#voltar').onclick = () => ctx.ir('/projeto/' + p.id);
  if (p.analise) mostrar(p, p.analise, ctx.ir); else $('#go').onclick = () => rodarAgora(p, ctx.ir);
}
