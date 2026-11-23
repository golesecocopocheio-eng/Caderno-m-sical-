// Prepara o áudio do projeto (mistura de todas as faixas, em 11025 Hz mono) e chama a análise.
import { obterMidia } from '../dados/banco.js';
import { decodificar } from '../audio/wav.js';
import { analisar } from './dsp.js';

const R = 11025;
async function mono(buf, vol) {
  const oc = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * R)), R), s = oc.createBufferSource(), g = oc.createGain();
  s.buffer = buf; g.gain.value = vol; s.connect(g); g.connect(oc.destination); s.start(); return (await oc.startRendering()).getChannelData(0);
}
export async function preparar(projeto, aoProgredir) {
  const fx = (projeto.faixas || []).filter((f) => !f.mute && f.midiaId); if (!fx.length) throw new Error('Esse projeto ainda não tem áudio. Grave ou importe uma faixa.');
  const partes = []; let i = 0;
  for (const f of fx) {
    aoProgredir && aoProgredir('Lendo as faixas…', 0.02 + 0.03 * (i++ / fx.length));
    const m = await obterMidia(f.midiaId); if (!m || !m.blob) continue;
    try { const b = await decodificar(m.blob); partes.push({ f, y: await mono(b, f.vol == null ? 1 : f.vol), off: Math.max(0, Math.round((f.off || 0) / 1000 * R)) }); } catch (e) {}
  }
  if (!partes.length) throw new Error('Não consegui ler o áudio deste projeto.');
  const len = Math.min(R * 600, Math.max(...partes.map((p) => p.off + p.y.length))), mix = new Float32Array(len);
  partes.forEach((p) => { for (let k = 0; k < p.y.length && p.off + k < len; k++) mix[p.off + k] += p.y[k]; });
  const vozes = partes.filter((p) => p.f.inst === 'voz' || p.f.inst === 'cantarolar');
  let voz = null;
  if (vozes.length) { const l = Math.min(len, Math.max(...vozes.map((p) => p.off + p.y.length))), y = new Float32Array(l); vozes.forEach((p) => { for (let k = 0; k < p.y.length && p.off + k < l; k++) y[p.off + k] += p.y[k]; }); voz = { y, fonte: 'voz' }; }
  else voz = { y: mix, fonte: 'mixagem' };
  return { mix, voz, R };
}
export async function rodar(projeto, aoProgredir) {
  const dados = await preparar(projeto, aoProgredir);
  if (typeof Worker === 'undefined') return analisar(dados, aoProgredir);
  return new Promise((ok, erro) => {
    let w; try { w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }); } catch (e) { return analisar(dados, aoProgredir).then(ok, erro); }
    const copia = { mix: dados.mix.slice(), voz: { y: dados.voz.fonte === 'voz' ? dados.voz.y.slice() : null, fonte: dados.voz.fonte }, R };
    if (!copia.voz.y) copia.voz.y = copia.mix; // mesma fonte
    w.onmessage = (e) => { const d = e.data; if (d.tipo === 'prog') aoProgredir && aoProgredir(d.t, d.v); else if (d.tipo === 'fim') { w.terminate(); ok(d.r); } else { w.terminate(); erro(new Error(d.m)); } };
    w.onerror = () => { w.terminate(); analisar(dados, aoProgredir).then(ok, erro); }; // se o Worker não rodar, faz na própria página
    w.postMessage(copia);
  });
}
