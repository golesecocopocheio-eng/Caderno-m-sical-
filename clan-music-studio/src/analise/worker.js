// Roda a análise fora da tela, para o app não travar.
import { analisar } from './dsp.js';
self.onmessage = async (e) => {
  try { const r = await analisar(e.data, (t, v) => self.postMessage({ tipo: 'prog', t, v })); self.postMessage({ tipo: 'fim', r }); }
  catch (x) { self.postMessage({ tipo: 'erro', m: String(x && x.message || x) }); }
};
