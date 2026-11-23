import { $, esc, aviso, debounce } from './util.js';
import { listar, obter, salvar } from '../dados/banco.js';
import { contexto, mmss } from '../audio/wav.js';
import { carregar, montar, atualizar, duracao, exportar } from '../audio/mix.js';
import { entregar } from '../dados/entregar.js';

let E = null; // estado do estúdio aberto
export function sair() { if (E) { parar(); E = null; } }
function parar() { if (!E) return; if (E.m) { E.m.fim(); E.m = null; } cancelAnimationFrame(E.raf); E.tocando = false; const b = $('#pl'); if (b) b.textContent = '▶ Tocar'; }

export async function telaEscolher() {
  const l = (await listar()).filter((p) => (p.faixas || []).length);
  return `<main class="tela"><h1>Estúdio</h1><p class="mute">Ouça todas as faixas juntas, ajuste volume e posição de cada uma e feche a mixagem.</p>
  ${l.length ? `<div class="lista" style="margin-top:12px">${l.map((p) => `<button class="item" data-es="${p.id}"><span class="t"><b>${esc(p.titulo)}</b><small>${p.faixas.length} faixa(s)</small></span></button>`).join('')}</div>` : '<div class="vazio"><p><b>Nenhum projeto com faixas.</b></p><p>Grave uma ideia ou importe um áudio primeiro.</p></div>'}</main>`;
}
export async function telaEstudio(id) {
  const p = await obter(id);
  if (!p) return '<main class="tela"><div class="vazio"><p><b>Não achei esse projeto.</b></p><button id="voltar">Voltar</button></div></main>';
  return `<main class="tela"><button id="voltar" style="min-height:44px">← ${esc(p.titulo)}</button><h1>Estúdio</h1><div id="est"><p class="mute">Carregando as faixas…</p></div></main>`;
}
export function ligarEscolher(ctx) { document.querySelectorAll('[data-es]').forEach((b) => (b.onclick = () => ctx.ir('/estudio/' + b.dataset.es))); }

const fmtOff = (ms) => (ms >= 0 ? '+' : '−') + (Math.abs(ms) / 1000).toFixed(1).replace('.', ',') + ' s';
export async function ligarEstudio(ctx, p) {
  sair(); $('#voltar').onclick = () => ctx.ir('/projeto/' + p.id);
  const fx = await carregar(p); const box = $('#est');
  if (!fx.length) { box.innerHTML = '<div class="vazio"><p><b>Este projeto não tem áudio para tocar.</b></p><button class="ouro" id="gr">Gravar uma faixa</button></div>'; $('#gr').onclick = () => ctx.ir('/gravar/' + p.id); return; }
  E = { p, fx, mestre: 1, pos: 0, tocando: false, m: null, t0: 0, raf: 0 };
  const grava = debounce(async () => { const q = await obter(p.id); if (!q) return; q.faixas = q.faixas.map((f) => { const x = E && E.fx.find((y) => y.f.id === f.id); return x ? { ...f, vol: x.f.vol, pan: x.f.pan || 0, mute: !!x.f.mute, solo: !!x.f.solo, off: x.f.off || 0 } : f; }); await salvar(q); }, 400);
  const total = () => Math.max(1, duracao(E.fx));
  box.innerHTML = `<div class="card" style="flex-direction:row;align-items:center;gap:10px"><button class="ouro" id="pl" style="min-width:120px">▶ Tocar</button><button id="pa" aria-label="Voltar ao início">⏮</button><b id="tp" style="margin-left:auto">0:00 / ${mmss(total())}</b></div>
  <input type="range" id="sk" min="0" max="1000" value="0" aria-label="Posição" style="width:100%;margin:10px 0">
  <label class="linha"><span>Volume geral</span><input type="range" id="mv" min="0" max="150" value="100" aria-label="Volume geral"></label>
  <h2>Faixas (${fx.length})</h2><div class="lista" id="tr">${fx.map((x) => `<div class="item" style="flex-direction:column;align-items:stretch;gap:8px" data-f="${x.f.id}"><div style="display:flex;gap:8px;align-items:center"><span class="t"><b>${esc(x.f.name || x.f.nome || 'Faixa')}</b><small>${esc(x.f.inst || '')} · ${mmss(x.buf.duration)}</small></span><button data-m aria-pressed="${!!x.f.mute}" style="margin-left:auto;min-width:48px" aria-label="Silenciar">M</button><button data-s aria-pressed="${!!x.f.solo}" style="min-width:48px" aria-label="Solo">S</button></div>
    <label class="linha"><span>Volume</span><input type="range" data-v min="0" max="150" value="${Math.round((x.f.vol == null ? 1 : x.f.vol) * 100)}" aria-label="Volume da faixa"></label>
    <label class="linha"><span>Lado</span><input type="range" data-p min="-100" max="100" value="${Math.round((x.f.pan || 0) * 100)}" aria-label="Esquerda e direita"></label>
    <div style="display:flex;gap:8px;align-items:center"><span class="mute peq">Começa em</span><button data-o="-100" aria-label="Adiantar 0,1 segundo">−0,1</button><b data-ov style="min-width:70px;text-align:center">${fmtOff(x.f.off || 0)}</b><button data-o="100" aria-label="Atrasar 0,1 segundo">+0,1</button></div></div>`).join('')}</div>
  <h2>Fechar a mixagem</h2><label class="linha"><input type="checkbox" id="nm" checked style="width:24px;min-height:24px"> <span>Normalizar o volume final</span></label>
  <button class="ouro cta" id="ex" style="margin-top:10px">Exportar mixagem (WAV)</button><p class="mute peq" id="exm">O arquivo sai em WAV, sem perda de qualidade. As faixas originais não são alteradas.</p>`;
  const tempo = () => { if (!E) return 0; if (!E.tocando) return E.pos; return Math.min(total(), E.pos + (contexto().currentTime - E.t0)); };
  const pinta = () => { if (!E) return; const t = tempo(); $('#tp').textContent = mmss(t) + ' / ' + mmss(total()); $('#sk').value = Math.round(t / total() * 1000); if (E.tocando) { if (t >= total()) { E.pos = 0; parar(); $('#tp').textContent = '0:00 / ' + mmss(total()); $('#sk').value = 0; return; } E.raf = requestAnimationFrame(pinta); } };
  const tocar = async (de) => { const ac = contexto(); if (ac.state === 'suspended') await ac.resume(); if (E.m) E.m.fim(); E.m = montar(ac, E.fx, E.mestre, de); E.pos = de; E.t0 = E.m.t0; E.tocando = true; $('#pl').textContent = '⏸ Pausar'; cancelAnimationFrame(E.raf); pinta(); };
  $('#pl').onclick = async () => { if (E.tocando) { E.pos = tempo(); parar(); } else await tocar(E.pos >= total() ? 0 : E.pos); };
  $('#pa').onclick = async () => { const t = E.tocando; parar(); E.pos = 0; $('#sk').value = 0; $('#tp').textContent = '0:00 / ' + mmss(total()); if (t) await tocar(0); };
  $('#sk').oninput = async () => { const t = +$('#sk').value / 1000 * total(), tc = E.tocando; if (tc) parar(); E.pos = t; $('#tp').textContent = mmss(t) + ' / ' + mmss(total()); if (tc) await tocar(t); };
  $('#mv').oninput = () => { E.mestre = +$('#mv').value / 100; if (E.m) E.m.mg.gain.value = E.mestre; };
  const refl = () => { if (E.m) atualizar(E.m, E.fx); };
  box.querySelectorAll('[data-f]').forEach((el) => {
    const x = E.fx.find((y) => y.f.id === el.dataset.f);
    el.querySelector('[data-v]').oninput = (e) => { x.f.vol = +e.target.value / 100; refl(); grava(); };
    el.querySelector('[data-p]').oninput = (e) => { x.f.pan = +e.target.value / 100; refl(); grava(); };
    el.querySelector('[data-m]').onclick = (e) => { x.f.mute = !x.f.mute; e.currentTarget.setAttribute('aria-pressed', x.f.mute); refl(); grava(); };
    el.querySelector('[data-s]').onclick = (e) => { x.f.solo = !x.f.solo; e.currentTarget.setAttribute('aria-pressed', x.f.solo); refl(); grava(); };
    el.querySelectorAll('[data-o]').forEach((b) => (b.onclick = async () => { x.f.off = Math.max(0, (x.f.off || 0) + +b.dataset.o); el.querySelector('[data-ov]').textContent = fmtOff(x.f.off); grava(); const tc = E.tocando; if (tc) { const t = tempo(); parar(); await tocar(t); } $('#tp').textContent = mmss(tempo()) + ' / ' + mmss(total()); }));
  });
  $('#ex').onclick = async () => {
    const b = $('#ex'); b.disabled = true; b.textContent = 'Fechando a mixagem…'; grava.agora(); const tc = E.tocando; if (tc) { E.pos = tempo(); parar(); }
    try {
      if (!E.fx.some((x) => !x.f.mute && (!E.fx.some((y) => y.f.solo) || x.f.solo))) throw new Error('Todas as faixas estão silenciadas.');
      const r = await exportar(E.fx, E.mestre, $('#nm').checked), nome = (p.titulo || 'musica').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-') + '-mix.wav';
      const via = await entregar(r.blob, nome, p.titulo || 'Mixagem'); if (via === 'cancelado') aviso('Cancelado.'); else { $('#exm').textContent = `Pronto: ${nome} (${mmss(r.dur)}, ${(r.blob.size / 1048576).toFixed(1).replace('.', ',')} MB).`; aviso(via === 'baixar' ? 'Mixagem baixada.' : 'Mixagem pronta para compartilhar.'); }
    } catch (e) { aviso(e.message || 'Não consegui exportar.'); }
    b.disabled = false; b.textContent = 'Exportar mixagem (WAV)';
  };
}
