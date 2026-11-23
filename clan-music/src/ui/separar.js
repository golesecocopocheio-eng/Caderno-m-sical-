import { $, esc, aviso } from './util.js';
import { listar, obter, obterMidia, adicionarFaixa } from '../dados/banco.js';
import { decodificar, paraWav, mmss } from '../audio/wav.js';
import { separar } from '../separar/dsp.js';

const SR = 22050, MAX = 300;
let ocupado = false;
export async function telaEscolher() {
  const l = (await listar()).filter((p) => (p.faixas || []).length);
  return `<main class="tela"><h1>Separar instrumentos</h1><p class="mute">Tire a voz do meio, deixe só os graves, ou separe batida e harmonia. Funciona no celular, sem internet.</p>
  ${l.length ? `<div class="lista" style="margin-top:12px">${l.map((p) => `<button class="item" data-sp="${p.id}"><span class="t"><b>${esc(p.titulo)}</b><small>${p.faixas.length} faixa(s)</small></span></button>`).join('')}</div>` : '<div class="vazio"><p><b>Nenhum projeto com áudio.</b></p><p>Grave ou importe uma música primeiro.</p><button class="ouro" id="irg">Gravar ou importar</button></div>'}</main>`;
}
export async function telaSeparar(id) {
  const p = await obter(id);
  if (!p) return '<main class="tela"><div class="vazio"><p><b>Não achei esse projeto.</b></p><button id="voltar">Voltar</button></div></main>';
  return `<main class="tela"><button id="voltar" style="min-height:44px">← ${esc(p.titulo)}</button><h1>Separar instrumentos</h1><div id="sp"></div></main>`;
}
export function ligarEscolher(ctx) { document.querySelectorAll('[data-sp]').forEach((b) => (b.onclick = () => ctx.ir('/separar/' + b.dataset.sp))); const g = $('#irg'); if (g) g.onclick = () => ctx.ir('/gravar'); }

async function rodar(dados, prog) {
  if (typeof Worker !== 'undefined') {
    try {
      return await new Promise((ok, erro) => {
        const w = new Worker(new URL('../separar/worker.js', import.meta.url), { type: 'module' });
        w.onmessage = (e) => { const d = e.data; if (d.tipo === 'prog') prog(d.t, d.v); else if (d.tipo === 'fim') { w.terminate(); ok(d.r); } else { w.terminate(); erro(new Error(d.m)); } };
        w.onerror = () => { w.terminate(); erro(new Error('worker')); };
        w.postMessage(dados, dados.canais.map((c) => c.buffer));
      });
    } catch (e) { if (e.message !== 'worker') throw e; }
  }
  return separar(dados, prog);
}
async function ler(m) {
  const b = await decodificar(m.blob); const n = Math.min(b.length, Math.round(MAX * b.sampleRate));
  const oc = new OfflineAudioContext(2, Math.max(1, Math.round(n * SR / b.sampleRate)), SR); const s = oc.createBufferSource(); s.buffer = b;
  s.connect(oc.destination); s.start(0); const r = await oc.startRendering();
  const canais = b.numberOfChannels > 1 ? [r.getChannelData(0).slice(), r.getChannelData(1).slice()] : [r.getChannelData(0).slice()];
  return { canais, sr: SR, cortou: b.duration > MAX, dur: b.duration };
}
function paraBuf(canais, sr) { const ctx = new OfflineAudioContext(canais.length, canais[0].length, sr), b = ctx.createBuffer(canais.length, canais[0].length, sr); canais.forEach((c, i) => b.getChannelData(i).set(c)); return b; }

export async function ligarSeparar(ctx, p) {
  $('#voltar').onclick = () => ctx.ir('/projeto/' + p.id);
  const box = $('#sp'); const fx = (p.faixas || []);
  if (!fx.length) { box.innerHTML = '<div class="vazio"><p><b>Sem áudio neste projeto.</b></p><button class="ouro" id="gr">Gravar ou importar</button></div>'; $('#gr').onclick = () => ctx.ir('/gravar/' + p.id); return; }
  box.innerHTML = `<label class="campo"><span>Qual faixa separar</span><select id="fa">${fx.map((f) => `<option value="${f.id}">${esc(f.nome || f.name || 'Faixa')}</option>`).join('')}</select></label>
  <h2>O que gerar</h2>
  <label class="linha"><input type="checkbox" id="o-c" checked style="width:24px;min-height:24px"> <span>Sem a voz do meio (deixa o acompanhamento)</span></label>
  <label class="linha"><input type="checkbox" id="o-g" checked style="width:24px;min-height:24px"> <span>Só os graves (baixo e bumbo)</span></label>
  <label class="linha"><input type="checkbox" id="o-a" style="width:24px;min-height:24px"> <span>Só os agudos (pratos e brilho)</span></label>
  <label class="linha"><input type="checkbox" id="o-p" checked style="width:24px;min-height:24px"> <span>Batida e harmonia separadas</span></label>
  <button class="ouro cta" id="go" style="margin-top:12px">Separar</button>
  <div id="pr" hidden style="margin-top:10px"><progress id="pg" max="1" value="0" style="width:100%"></progress><p class="mute peq" id="pt">Preparando…</p></div>
  <p class="mute peq">Isto não é inteligência artificial: separa pelo lugar de cada som no estéreo e pelo tipo de som. Funciona melhor em música estéreo gravada em estúdio; vozes e instrumentos no mesmo lugar não se separam por completo. A faixa original não é alterada; cada resultado vira uma faixa nova. Usa até ${MAX / 60} minutos do começo.</p><div id="res"></div>`;
  $('#go').onclick = async () => {
    if (ocupado) return; const o = { centro: $('#o-c').checked, graves: $('#o-g').checked, agudos: $('#o-a').checked, percussao: $('#o-p').checked };
    if (!Object.values(o).some(Boolean)) return aviso('Marque pelo menos uma opção.');
    ocupado = true; $('#go').disabled = true; $('#pr').hidden = false; const pg = $('#pg'), pt = $('#pt');
    try {
      const f = fx.find((x) => x.id === $('#fa').value), m = await obterMidia(f.midiaId);
      if (!m || !m.blob) throw new Error('Áudio não encontrado.');
      pt.textContent = 'Lendo o áudio…'; const d = await ler(m);
      const r = await rodar({ canais: d.canais, sr: d.sr, opcoes: o }, (t, v) => { pt.textContent = t; pg.value = v; });
      const novas = [];
      for (const x of r.faixas) { const b = paraBuf(x.canais, d.sr); novas.push(await adicionarFaixa(p.id, paraWav(b), { nome: (f.nome || 'Faixa') + ' — ' + x.nome, inst: x.id === 'graves' ? 'baixo' : x.id === 'perc' ? 'bateria' : (f.inst || 'voz'), tipo: 'separada', dur: b.duration, origem: f.id })); }
      $('#res').innerHTML = `<div class="card"><b>Pronto: ${novas.length} faixa(s) nova(s)</b>${r.aviso.map((a) => `<p class="mute">${esc(a)}</p>`).join('')}${d.cortou ? `<p class="mute">Só os primeiros ${MAX / 60} minutos foram usados.</p>` : ''}<p class="mute peq">A faixa original continua intacta. Abra o Estúdio para ouvir, silenciar e misturar.</p><button class="ouro" id="ve">Ouvir no Estúdio</button></div>`;
      $('#ve').onclick = () => ctx.ir('/estudio/' + p.id); aviso('Separação pronta.');
    } catch (e) { $('#res').innerHTML = `<div class="vazio"><p><b>Não consegui separar.</b></p><p>${esc(e.message || 'Tente outra faixa.')}</p></div>`; }
    ocupado = false; $('#go').disabled = false; $('#pr').hidden = true;
  };
}
