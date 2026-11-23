import { separar } from './dsp.js';
self.onmessage = async (e) => {
  try { const r = await separar(e.data, (t, v) => self.postMessage({ tipo: 'prog', t, v })); self.postMessage({ tipo: 'fim', r }, r.faixas.flatMap((f) => f.canais.map((c) => c.buffer))); }
  catch (x) { self.postMessage({ tipo: 'erro', m: String((x && x.message) || x) }); }
};
