// Decodificar, desenhar picos e cortar áudio. O arquivo original nunca é alterado: o corte vira uma faixa nova.
let ac = null;
export const contexto = () => { if (!ac) { const C = window.AudioContext || window.webkitAudioContext; ac = new C(); } return ac; };
export async function decodificar(blob) { return contexto().decodeAudioData(await blob.arrayBuffer()); }
export function picos(buf, n) {
  const d = buf.getChannelData(0), p = new Float32Array(n), t = Math.max(1, Math.floor(d.length / n));
  for (let i = 0; i < n; i++) { let m = 0; const a = i * t; for (let k = 0; k < t && a + k < d.length; k += 4) { const v = Math.abs(d[a + k]); if (v > m) m = v; } p[i] = m; }
  return p;
}
export function paraWav(buf, t0 = 0, t1 = buf.duration) {
  const sr = buf.sampleRate, a = Math.max(0, Math.round(t0 * sr)), z = Math.min(buf.length, Math.round(t1 * sr)), n = Math.max(1, z - a), ch = Math.min(2, buf.numberOfChannels);
  const ab = new ArrayBuffer(44 + n * ch * 2), v = new DataView(ab), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * ch * 2, true);
  const dd = []; for (let c = 0; c < ch; c++) dd.push(buf.getChannelData(c));
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const x = Math.max(-1, Math.min(1, dd[c][a + i])); v.setInt16(o, x < 0 ? x * 32768 : x * 32767, true); o += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}
export const mmss = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
