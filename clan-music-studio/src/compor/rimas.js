// Rimas em português, sem internet: acha a sílaba tônica e compara do som tônico até o fim da palavra.
import { SM, SF, INF, ADJ, EXTRA } from './dic.js';
const V = 'aeiouáàâãéêíóôõúü';
const ehV = (c) => V.includes(c);
const SEM = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const DIPH = new Set(['ai', 'ei', 'oi', 'ui', 'au', 'eu', 'ou', 'iu', 'ãe', 'õe']);
const baixa = (w) => String(w || '').toLowerCase().replace(/[^a-záàâãéêíóôõúüç-]/g, '');

// grupos de vogais (núcleos de sílaba), com "qu"/"gu" + vogal sem contar o u
export function grupos(w) {
  const g = []; let i = 0;
  while (i < w.length) {
    if (!ehV(w[i])) { i++; continue; }
    if (w[i] === 'u' && i > 0 && 'qg'.includes(w[i - 1]) && i + 1 < w.length && ehV(w[i + 1])) { i++; continue; }
    let j = i + 1; while (j < w.length && ehV(w[j]) && (DIPH.has(w[j - 1] + w[j]) || (w[j - 1] === 'ã' && w[j] === 'o') || (w[j - 1] === 'õ' && w[j] === 'e'))) j++;
    g.push([i, j]); i = j;
  }
  return g;
}
export function tonica(w) {
  const g = grupos(w); if (!g.length) return -1;
  let k = g.findIndex(([a, b]) => /[áàâéêíóôú]/.test(w.slice(a, b))); if (k >= 0) return k;
  k = g.findIndex(([a, b]) => /[ãõ]/.test(w.slice(a, b))); if (k >= 0) return k;
  if (g.length === 1) return 0;
  const penult = /(a|e|o|as|es|os|am|em|ens)$/.test(w) && !/(ém|éns)$/.test(w);
  return penult ? g.length - 2 : g.length - 1;
}
export function chave(palavra) {
  const w = baixa(palavra).replace(/-/g, ''); if (!w) return '';
  const g = grupos(w), t = tonica(w); if (t < 0) return w;
  let k = w.slice(g[t][0]).replace(/ão|õe|ãe/g, (m) => ({ 'ão': 'aum', 'õe': 'oin', 'ãe': 'ain' }[m]));
  k = SEM(k).replace(/ss/g, 's').replace(/ç/g, 's'); if (k.length > 2 && k.endsWith('s')) k = k.slice(0, -1);
  return k;
}
const esqueleto = (k) => k.replace(/[^aeiou]/g, '').replace(/(.)\1+/g, '$1');

// sílabas poéticas: contam até a sílaba tônica da última palavra e unem vogal final + vogal inicial
export function silabas(linha) {
  const ps = String(linha).toLowerCase().split(/\s+/).map(baixa).filter(Boolean); if (!ps.length) return 0;
  let n = 0; ps.forEach((w, i) => { let c = grupos(w).length; if (i > 0) { const a = ps[i - 1], ult = a[a.length - 1], pri = w[0] === 'h' ? w[1] : w[0]; if (ehV(ult) && ehV(pri)) c = Math.max(0, c - 1); } n += c; });
  const u = ps[ps.length - 1], g = grupos(u), t = tonica(u); if (g.length && t >= 0) n -= g.length - 1 - t; return Math.max(1, n);
}

const TODAS = [...new Set([...SM, ...SF, ...INF, ...ADJ, ...EXTRA])];
const indice = (lista) => { const m = new Map(); lista.forEach((w) => { const k = chave(w); if (!k) return; if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(w)) m.get(k).push(w); }); return m; };
export const IDX = indice(TODAS);
export const palavrasDeTexto = (txt) => [...new Set(String(txt || '').toLowerCase().match(/[a-záàâãéêíóôõúüç]{3,}/g) || [])];

// extras: palavras da letra do próprio usuário (entram como "suas")
export function rimas(palavra, extras = []) {
  const w = baixa(palavra), k = chave(w); if (!k) return { chave: '', consoantes: [], toantes: [], suas: [] };
  const base = (IDX.get(k) || []).filter((x) => x !== w), esk = esqueleto(k);
  const suas = extras.filter((x) => x !== w && chave(x) === k && !base.includes(x));
  const toantes = TODAS.filter((x) => x !== w && chave(x) !== k && esqueleto(chave(x)) === esk && esk.length >= 1).slice(0, 40);
  return { chave: k, consoantes: base, toantes, suas };
}
export const rimam = (a, b) => { const x = chave(a), y = chave(b); return !!x && x === y && baixa(a) !== baixa(b); };
export const ultimaPalavra = (linha) => { const m = String(linha).match(/[A-Za-zÀ-ÿ]+(?=[^A-Za-zÀ-ÿ]*$)/); return m ? m[0].toLowerCase() : ''; };
