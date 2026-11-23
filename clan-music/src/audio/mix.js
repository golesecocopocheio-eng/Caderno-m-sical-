// Motor do estúdio: toca várias faixas juntas e fecha a mixagem em WAV. O mesmo desenho de nós serve para ouvir e para exportar.
import { contexto, decodificar, paraWav } from './wav.js';
import { obterMidia } from '../dados/banco.js';

export async function carregar(projeto) {
  const out = [];
  for (const f of projeto.faixas || []) {
    if (!f.midiaId) continue; const m = await obterMidia(f.midiaId); if (!m || !m.blob) continue;
    try { out.push({ f, buf: await decodificar(m.blob) }); } catch (e) {}
  }
  return out;
}
export const audivel = (faixas) => { const solo = faixas.some((x) => x.f.solo); return (x) => !x.f.mute && (!solo || x.f.solo); };
export const duracao = (faixas) => faixas.reduce((m, x) => Math.max(m, (x.f.off || 0) / 1000 + x.buf.duration), 0);

// Monta os nós em qualquer contexto (ao vivo ou offline). Devolve controles para mexer sem parar.
export function montar(ac, faixas, mestre, de = 0) {
  const mg = ac.createGain(); mg.gain.value = mestre; mg.connect(ac.destination);
  const lim = ac.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.1;
  mg.disconnect(); mg.connect(lim); lim.connect(ac.destination);
  const ok = audivel(faixas), nos = new Map(), t0 = ac.currentTime + 0.05;
  faixas.forEach((x) => {
    const s = ac.createBufferSource(), g = ac.createGain(), p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    s.buffer = x.buf; g.gain.value = ok(x) ? (x.f.vol == null ? 1 : x.f.vol) : 0; s.connect(g); if (p) { p.pan.value = x.f.pan || 0; g.connect(p); p.connect(mg); } else g.connect(mg);
    const off = (x.f.off || 0) / 1000, ini = off - de;
    if (ini >= 0) s.start(t0 + ini); else if (-ini < x.buf.duration) s.start(t0, -ini);
    nos.set(x.f.id, { g, p, s });
  });
  return { nos, mg, t0, fim: () => nos.forEach((n) => { try { n.s.stop(); } catch (e) {} try { n.s.disconnect(); } catch (e) {} }) };
}
export function atualizar(m, faixas) {
  const ok = audivel(faixas);
  faixas.forEach((x) => { const n = m.nos.get(x.f.id); if (!n) return; n.g.gain.value = ok(x) ? (x.f.vol == null ? 1 : x.f.vol) : 0; if (n.p) n.p.pan.value = x.f.pan || 0; });
}
// Exporta tudo em WAV estéreo 44,1 kHz. Normalizar traz o pico para perto de 0 dB, sem distorcer.
export async function exportar(faixas, mestre, normalizar) {
  const len = Math.ceil((duracao(faixas) + 0.3) * 44100); if (len < 100) throw new Error('Nada para exportar.');
  const oc = new OfflineAudioContext(2, len, 44100), m = montar(oc, faixas, mestre, 0); void m;
  const buf = await oc.startRendering(); let pico = 0;
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pico) pico = v; } }
  if (normalizar && pico > 0.001) { const k = 0.89 / pico; for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } pico = 0.89; }
  return { blob: paraWav(buf), pico, dur: buf.duration };
}
