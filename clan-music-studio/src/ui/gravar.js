import { $, esc, aviso } from './util.js';
import { Gravador, erroAmigavel } from '../audio/gravador.js';
import { decodificar, picos, paraWav, mmss } from '../audio/wav.js';
import { listar, obter, salvar, novoProjeto, obterMidia, adicionarFaixa, removerFaixa, salvarPedaco, pedacosPendentes, apagarRascunho } from '../dados/banco.js';

const MODOS = [['voz', 'Cantar'], ['cantarolar', 'Cantarolar'], ['violao', 'Violão'], ['instrumento', 'Instrumento']];
const NOME = { voz: 'Voz', cantarolar: 'Cantarolar', violao: 'Violão', instrumento: 'Instrumento' };
let rec = null, fila = Promise.resolve(), modo = 'voz', rid = null, barras = [], ultimo = 0;

export const gravando = () => !!(rec && rec.estado !== 'parado');

// ---------- tela para escolher onde gravar ----------
export async function telaEscolher() {
  const l = await listar();
  return `<main class="tela"><h1>Gravar</h1><p class="mute">Cante, cantarole ou toque. A gravação só começa quando você tocar em Gravar.</p>
  <div id="pend"></div><button class="ouro cta" id="ideia">Cantar uma ideia</button>
  ${l.length ? `<h2>Ou gravar em um projeto</h2><div class="lista">${l.slice(0, 12).map((p) => `<button class="item" data-gp="${p.id}"><span class="t"><b>${esc(p.titulo)}</b><small>${(p.faixas || []).length} faixa(s)</small></span></button>`).join('')}</div>` : ''}</main>`;
}
export function ligarEscolher(ctx) {
  $('#ideia').onclick = async () => {
    const d = new Date(), p = novoProjeto('Ideia ' + d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    p.fase = 'ideia'; await salvar(p); ctx.ir('/gravar/' + p.id);
  };
  document.querySelectorAll('[data-gp]').forEach((b) => (b.onclick = () => ctx.ir('/gravar/' + b.dataset.gp)));
  pendentes($('#pend'), ctx);
}

// ---------- tela de gravação ----------
export async function telaGravar(id) {
  const p = await obter(id);
  if (!p) return '<main class="tela"><div class="vazio"><p><b>Não achei esse projeto.</b></p><button id="voltar">Voltar</button></div></main>';
  return `<main class="tela"><button id="voltar" style="min-height:44px">← ${esc(p.titulo)}</button>
  <div id="pend"></div>
  <div class="chips" role="radiogroup" aria-label="O que você vai gravar">${MODOS.map(([k, t]) => `<button role="radio" data-modo="${k}" class="${k === modo ? 'on' : ''}" aria-checked="${k === modo}">${t}</button>`).join('')}</div>
  <canvas id="onda" aria-label="Forma de onda ao vivo"></canvas>
  <div class="tempo" id="tempo">0:00</div>
  <div class="medidor" aria-hidden="true"><i id="nv"></i></div><p class="peq mute" id="alerta" style="min-height:20px;text-align:center"></p>
  <div class="gcontrole"><button id="pau" disabled>Pausar</button><button id="rec" class="grande" aria-label="Gravar"><span></span></button><button id="imp">Importar áudio</button></div>
  <p class="mute peq" id="msg" style="text-align:center">Toque no botão vermelho para gravar.</p>
  <input type="file" id="impf" accept="audio/*" multiple hidden>
  <h2>Gravações deste projeto</h2><div class="lista" id="faixas"></div></main>`;
}

function desenharOnda() {
  const c = $('#onda'); if (!c) return; const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
  const g = c.getContext('2d'), w = c.width, h = c.height; g.clearRect(0, 0, w, h);
  const larg = 3 * dpr, gap = 2 * dpr, n = Math.floor(w / (larg + gap)), v = barras.slice(-n);
  g.fillStyle = '#F5C242'; v.forEach((a, i) => { const bh = Math.max(2 * dpr, a * h * .95); g.globalAlpha = .45 + .55 * (i / v.length); g.fillRect(w - (v.length - i) * (larg + gap), (h - bh) / 2, larg, bh); }); g.globalAlpha = 1;
}

async function listarFaixas(p, ctx) {
  const box = $('#faixas'); if (!box) return;
  const cur = await obter(p.id); const fx = (cur && cur.faixas) || [];
  box.innerHTML = fx.length ? fx.slice().reverse().map((f) => `<div class="item" style="flex-direction:column;align-items:stretch"><span class="t"><b>${esc(f.nome)}</b><small>${esc(NOME[f.inst] || f.inst || '')}${f.dur ? ' · ' + mmss(f.dur) : ''}${f.tipo === 'corte' ? ' · corte' : ''}</small></span>
    <audio data-m="${esc(f.midiaId)}" controls preload="none" style="width:100%"></audio><div class="linha"><button data-cortar="${f.id}">Cortar</button><button class="perigo" data-apagar="${f.id}">Apagar</button></div></div>`).join('') : '<p class="mute">Nenhuma gravação ainda.</p>';
  box.querySelectorAll('audio[data-m]').forEach(async (a) => { const m = await obterMidia(a.dataset.m); if (m && m.blob) a.src = URL.createObjectURL(m.blob); });
  box.querySelectorAll('[data-cortar]').forEach((b) => (b.onclick = () => cortar(p, fx.find((x) => x.id === b.dataset.cortar), () => listarFaixas(p, ctx))));
  box.querySelectorAll('[data-apagar]').forEach((b) => (b.onclick = async () => { const f = fx.find((x) => x.id === b.dataset.apagar); if (!confirm('Apagar "' + f.nome + '"? Isso não dá para desfazer.')) return; await removerFaixa(p.id, f.id); aviso('Faixa apagada.'); listarFaixas(p, ctx); }));
}

// O MediaRecorder entrega um arquivo sem duração certa (a barra do player fica quebrada). Convertemos para WAV: duração exata e abre em qualquer lugar.
async function finalizar(blob, durFallback) {
  try { const b = await decodificar(blob); return { blob: paraWav(b), dur: b.duration }; } catch (e) { return { blob, dur: durFallback }; }
}
const proximoNome = async (pid, inst) => { const p = await obter(pid); return NOME[inst] + ' ' + (((p.faixas || []).filter((f) => f.inst === inst).length) + 1); };

export function ligarGravar(ctx, p) {
  $('#voltar').onclick = () => ctx.ir('/projeto/' + p.id);
  const rb = $('#rec'), pb = $('#pau'), msg = $('#msg'), tempo = $('#tempo');
  document.querySelectorAll('[data-modo]').forEach((b) => (b.onclick = () => { if (gravando()) return aviso('Pare a gravação para trocar.'); modo = b.dataset.modo; document.querySelectorAll('[data-modo]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); }));
  const estado = (e) => { rb.classList.toggle('on', e !== 'parado'); rb.setAttribute('aria-label', e === 'parado' ? 'Gravar' : 'Parar'); pb.disabled = e === 'parado'; pb.textContent = e === 'pausado' ? 'Continuar' : 'Pausar'; };
  const terminar = async (aviso2) => {
    if (!rec) return; const g = rec, r = rid; rec = null; estado('parado');
    const cru = await g.parar(); await fila;
    if (cru.blob.size < 200) { await apagarRascunho(r); msg.textContent = 'Não gravou nada. Tente de novo.'; return; }
    msg.textContent = 'Salvando…'; const { blob, dur } = await finalizar(cru.blob, cru.dur);
    const f = await adicionarFaixa(p.id, blob, { nome: await proximoNome(p.id, modo), inst: modo, tipo: 'gravacao', dur });
    await apagarRascunho(r); msg.textContent = (aviso2 || 'Gravação salva.') + ' ' + mmss(dur); aviso('Gravação salva em "' + f.nome + '".'); tempo.textContent = '0:00'; listarFaixas(p, ctx);
  };
  rb.onclick = async () => {
    if (rec) return terminar();
    try {
      barras = []; rid = 'r' + Date.now().toString(36); const inst = modo;
      rec = new Gravador({
        nivel: ({ pico, rms, seg, estado: e }) => { tempo.textContent = mmss(seg); $('#nv').style.width = Math.min(100, Math.round(rms * 400)) + '%'; const a = $('#alerta'); a.textContent = pico > .98 ? 'Muito alto: afaste um pouco do microfone.' : (e === 'gravando' && rms < .004 && seg > 3 ? 'Quase sem som: aproxime do microfone.' : ''); const t = performance.now(); if (t - ultimo > 50 && e === 'gravando') { ultimo = t; barras.push(Math.min(1, rms * 5)); } desenharOnda(); },
        pedaco: (b, n) => { fila = fila.then(() => salvarPedaco(rid, n, b, { projetoId: p.id, inst, mime: b.type, em: Date.now() })).catch(() => {}); },
        erro: (m) => { aviso(m); terminar('Gravação interrompida, mas guardada.'); },
      });
      await rec.iniciar(); estado('gravando'); msg.textContent = 'Gravando… cada trecho é salvo na hora.';
    } catch (e) { rec = null; estado('parado'); msg.textContent = erroAmigavel(e); aviso(erroAmigavel(e)); }
  };
  pb.onclick = () => { if (!rec) return; if (rec.estado === 'gravando') { rec.pausar(); estado('pausado'); msg.textContent = 'Pausado.'; } else { rec.continuar(); estado('gravando'); msg.textContent = 'Gravando…'; } };
  $('#imp').onclick = () => $('#impf').click();
  $('#impf').onchange = async (e) => {
    const fs = [...e.target.files]; e.target.value = ''; let n = 0;
    for (const f of fs) { if (!/^audio\//.test(f.type) && !/\.(wav|mp3|m4a|aac|ogg|opus|webm|flac)$/i.test(f.name)) continue; let dur = 0; try { dur = (await decodificar(f)).duration; } catch (x) { aviso('Não consegui ler "' + f.name + '".'); continue; }
      await adicionarFaixa(p.id, f, { nome: f.name.replace(/\.[^.]+$/, '').slice(0, 60), inst: modo, tipo: 'arquivo', dur }); n++; }
    if (n) { aviso(n + ' áudio(s) importado(s). O arquivo original foi mantido.'); listarFaixas(p, ctx); }
  };
  pendentes($('#pend'), ctx); listarFaixas(p, ctx); desenharOnda();
}

// Sair da tela ou fechar o app no meio da gravação: salva o que já foi gravado.
export async function sair() { if (rec) { const g = rec, r = rid; rec = null; try { const cru = await g.parar(); await fila; const { blob, dur } = await finalizar(cru.blob, cru.dur); const pend = (await pedacosPendentes()).find((x) => x.rid === r); if (pend && blob.size > 200) { await adicionarFaixa(pend.projetoId, blob, { nome: 'Gravação ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), inst: pend.inst || 'voz', tipo: 'gravacao', dur }); await apagarRascunho(r); aviso('Gravação salva.'); } } catch (e) {} } }

// ---------- recuperar gravação interrompida ----------
export async function pendentes(box, ctx) {
  if (!box) return; const l = (await pedacosPendentes()).filter((x) => !(rec && x.rid === rid));
  if (!l.length) { box.innerHTML = ''; return; }
  box.innerHTML = l.map((x) => `<div class="item" style="flex-direction:column;align-items:stretch;border-color:var(--ouro);margin-bottom:10px"><b>Gravação interrompida (${mmss(x.pedacos.length)})</b><small class="mute">O app foi fechado no meio. Dá para recuperar o que foi gravado.</small><div class="linha"><button class="ouro" data-rec="${x.rid}">Recuperar</button><button class="perigo" data-desc="${x.rid}">Descartar</button></div></div>`).join('');
  box.querySelectorAll('[data-rec]').forEach((b) => (b.onclick = async () => {
    const x = l.find((y) => y.rid === b.dataset.rec); const blob = new Blob(x.pedacos.map((q) => q.blob), { type: x.mime || x.pedacos[0].blob.type });
    let pid = x.projetoId; if (!(await obter(pid))) { const np = novoProjeto('Gravação recuperada'); await salvar(np); pid = np.id; }
    const fin = await finalizar(blob, x.pedacos.length);
    await adicionarFaixa(pid, fin.blob, { nome: 'Gravação recuperada', inst: x.inst || 'voz', tipo: 'gravacao', dur: fin.dur }); await apagarRascunho(x.rid); aviso('Gravação recuperada.'); ctx.ir('/projeto/' + pid);
  }));
  box.querySelectorAll('[data-desc]').forEach((b) => (b.onclick = async () => { if (!confirm('Descartar essa gravação interrompida? Isso não dá para desfazer.')) return; await apagarRascunho(b.dataset.desc); pendentes(box, ctx); }));
}

// ---------- cortar início e fim (cria faixa nova, mantém a original) ----------
async function cortar(p, f, depois) {
  const m = await obterMidia(f.midiaId); if (!m) return aviso('Áudio não encontrado.');
  let buf; try { buf = await decodificar(m.blob); } catch (e) { return aviso('Não consegui abrir esse áudio para cortar.'); }
  const sh = document.createElement('div'); sh.className = 'folha'; const d = buf.duration, pk = picos(buf, 160);
  sh.innerHTML = `<div class="tela"><div class="linha"><h2 style="flex:1;margin:0">Cortar "${esc(f.nome)}"</h2><button id="cx">Fechar</button></div>
  <p class="mute peq">Arraste para escolher o começo e o fim. A gravação original continua guardada; o corte vira uma faixa nova.</p>
  <canvas id="cv" style="width:100%;height:110px;background:var(--card);border-radius:14px"></canvas>
  <label class="campo"><span>Começo: <b id="l0">0:00.0</b></span><input type="range" id="c0" min="0" max="${d}" step="0.01" value="0"></label>
  <label class="campo"><span>Fim: <b id="l1">${d.toFixed(1)}s</b></span><input type="range" id="c1" min="0" max="${d}" step="0.01" value="${d}"></label>
  <div class="linha"><button id="ouv">Ouvir trecho</button><button class="ouro" id="sv" style="flex:1">Salvar corte como faixa nova</button></div></div>`;
  document.body.appendChild(sh);
  const cv = $('#cv', sh), au = new Audio(URL.createObjectURL(m.blob)); let a = 0, z = d;
  const pintar = () => { const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); const g = cv.getContext('2d'), w = cv.width, h = cv.height, bw = w / pk.length;
    pk.forEach((v, i) => { const t = (i / pk.length) * d, dentro = t >= a && t <= z; g.fillStyle = dentro ? '#F5C242' : '#4a4636'; const bh = Math.max(2, v * h * .95); g.fillRect(i * bw, (h - bh) / 2, Math.max(1, bw - 1), bh); }); };
  const mover = () => { a = Math.min(+$('#c0', sh).value, +$('#c1', sh).value - .05); z = Math.max(+$('#c1', sh).value, a + .05); $('#l0', sh).textContent = a.toFixed(1) + 's'; $('#l1', sh).textContent = z.toFixed(1) + 's'; pintar(); };
  $('#c0', sh).oninput = $('#c1', sh).oninput = mover; setTimeout(mover, 0);
  $('#ouv', sh).onclick = () => { au.pause(); au.currentTime = a; au.play(); const t = setInterval(() => { if (au.paused || au.currentTime >= z) { au.pause(); clearInterval(t); } }, 40); };
  const fechar = () => { au.pause(); sh.remove(); };
  $('#cx', sh).onclick = fechar;
  $('#sv', sh).onclick = async () => { const w = paraWav(buf, a, z); await adicionarFaixa(p.id, w, { nome: f.nome + ' (corte)', inst: f.inst, tipo: 'corte', dur: z - a, origem: f.id }); aviso('Corte salvo. A original foi mantida.'); fechar(); depois(); };
}
