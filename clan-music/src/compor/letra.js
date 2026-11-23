// Sugestões de letra por regras (offline, grátis). Não é IA de linguagem: combina modelos de verso, rimas e o vocabulário do tema.
// Tudo é sugestão: nada entra na letra sem o usuário pedir.
import { SM, SF, INF, ADJ, TEMAS, MOD, IMAGENS } from './dic.js';
import { chave, silabas, rimam, ultimaPalavra, palavrasDeTexto } from './rimas.js';

export const ESQUEMAS = { AABB: 'AABB (pares)', ABAB: 'ABAB (alternado)', ABCB: 'ABCB (só 2º e 4º rimam)' };
export const rng = (seed) => { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pick = (a, r) => a[Math.floor(r() * a.length)];
const emb = (a, r) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const ucf = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const art = (w, g) => ({ o: (g === 'f' ? 'a ' : 'o ') + w, em: (g === 'f' ? 'na ' : 'no ') + w, de: (g === 'f' ? 'da ' : 'do ') + w, com: (g === 'f' ? 'com a ' : 'com o ') + w });
const ENTR = [...SM.map((p) => ({ p, t: 'n', g: 'm' })), ...SF.filter((p) => !SM.includes(p)).map((p) => ({ p, t: 'n', g: 'f' })), ...INF.map((p) => ({ p, t: 'v' })), ...ADJ.map((p) => ({ p, t: 'a' }))];
function linhaCom(e, r, usados) {
  const ms = e.t === 'n' ? MOD.n : MOD[e.t], ord = emb(ms.map((_, i) => i), r);
  for (const i of ord) { if (usados.has(e.t + i) && ord.length > 2 && usados.size < ms.length) continue; usados.add(e.t + i); const t = ms[i]; const s = ucf(e.t === 'n' ? (() => { const a = art(e.p, e.g), f = t.toString(); const out = t(a); return out; })() : t(e.p)); return s; }
  return ucf(ms[0](e.t === 'n' ? art(e.p, e.g) : e.p));
}
const peso = (e, tema) => (TEMAS[tema] && TEMAS[tema].p.includes(e.p) ? 5 : 1);
function grupoRima(tema, r, fora = new Set()) {
  const m = new Map(); ENTR.forEach((e) => { const k = chave(e.p); if (!k || fora.has(k)) return; if (!m.has(k)) m.set(k, []); m.get(k).push(e); });
  const gs = [...m.entries()].filter(([, l]) => l.length >= 2), pond = []; gs.forEach(([k, l]) => { const s = l.reduce((n, e) => n + peso(e, tema), 0); for (let i = 0; i < Math.min(20, s); i++) pond.push(k); });
  const k = pond.length ? pick(pond, r) : gs[0][0], l = m.get(k).slice().sort((a, b) => peso(b, tema) - peso(a, tema) + (r() - 0.5) * 3); return { k, l };
}
function parLinhas(g, r, usados) { const a = g.l[0], b = g.l.find((e) => e.p !== a.p) || g.l[1]; g.l.sort(() => r() - 0.5); return [linhaCom(a, r, usados), linhaCom(b, r, usados)]; }
const ok = (l) => { const n = silabas(l); return n >= 5 && n <= 11; };

// quatro versos (ou mais) no esquema pedido
export function versos({ tema = 'amor', esquema = 'AABB', seed = 1, n = 4 } = {}) {
  const r = rng(seed); const usados = new Set(); let tent = 0, saida = [];
  while (tent++ < 40) {
    const fora = new Set(), g1 = grupoRima(tema, r, fora); fora.add(g1.k); const g2 = grupoRima(tema, r, fora), p1 = parLinhas(g1, r, usados), p2 = parLinhas(g2, r, usados);
    let l;
    if (esquema === 'ABAB') l = [p1[0], p2[0], p1[1], p2[1]];
    else if (esquema === 'ABCB') { const livre = (k) => linhaCom(pick(ENTR, r), r, usados); l = [livre(), p2[0], livre(), p2[1]]; }
    else l = [...p1, ...p2];
    if (l.every(ok) && new Set(l).size === l.length) { saida = l; break; }
  }
  return saida.slice(0, n);
}
export function refrao({ tema = 'amor', seed = 1 } = {}) {
  const r = rng(seed * 7 + 3); let l = [];
  for (let t = 0; t < 40; t++) {
    const usados = new Set(), h = linhaCom(pick(ENTR.filter((e) => peso(e, tema) > 1 && e.t !== 'a'), r), r, usados), g = grupoRima(tema, r, new Set([chave(ultimaPalavra(h))])), p = parLinhas(g, r, usados);
    l = [h, p[0], h, p[1]]; if (ok(h) && ok(p[0]) && ok(p[1]) && p[0] !== p[1]) break;
  }
  return l;
}
export function ponte({ tema = 'amor', seed = 1 } = {}) {
  const l = versos({ tema, esquema: 'ABCB', seed: seed * 5 + 11, n: 4 }).slice(0, 4); if (l[0]) l[0] = 'Mas ' + l[0].charAt(0).toLowerCase() + l[0].slice(1); return l;
}
export function intro({ tema = 'amor', seed = 1 } = {}) {
  const r = rng(seed * 3 + 1), im = IMAGENS[tema] || IMAGENS.amor; return ['(instrumental — 4 compassos)', pick(im, r)];
}
export function final({ tema = 'amor', seed = 1, refraoLinhas = null } = {}) {
  const r = rng(seed * 11 + 5), base = (refraoLinhas && refraoLinhas.length ? refraoLinhas : refrao({ tema, seed })), ult = base.slice(-2);
  const g = grupoRima(tema, r, new Set()), p = parLinhas(g, r, new Set());
  return ['(repete o refrão)', ...ult, ...p.slice(0, 1)];
}
const BLOCO = { Intro: intro, Verso: versos, 'Refrão': refrao, Ponte: ponte, Final: final };
export const TIPOS = Object.keys(BLOCO);
export const tipoDe = (nome) => { const n = String(nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return n.startsWith('intro') ? 'Intro' : n.startsWith('verso') ? 'Verso' : n.startsWith('refrao') || n.startsWith('coro') ? 'Refrão' : n.startsWith('ponte') ? 'Ponte' : n.startsWith('final') || n.startsWith('outro') ? 'Final' : null; };
export function bloco(nome, opts = {}) { const t = tipoDe(nome); if (!t) return versos(opts); return BLOCO[t](opts); }
export const textoBloco = (nome, linhas) => '[' + nome + ']\n' + linhas.join('\n');

// ---- continuar uma letra existente
export function temaDe(letra) {
  const ps = new Set(palavrasDeTexto(letra)); let best = 'amor', bn = 0; for (const [k, t] of Object.entries(TEMAS)) { const n = t.p.filter((w) => ps.has(w)).length; if (n > bn) { bn = n; best = k; } } return best;
}
export const linhasDe = (txt) => String(txt || '').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !/^\[.*\]$/.test(s) && !/^\(.*\)$/.test(s));
// outras: [{titulo, letra}] das demais músicas do usuário
export function continuar(letra, outras = [], { tema, seed = 1 } = {}) {
  const ls = linhasDe(letra), tm = tema || temaDe(letra), r = rng(seed * 13 + 7);
  if (!ls.length) return { tema: tm, rimando: [], novos: versos({ tema: tm, esquema: 'AABB', seed }), seus: [], ultima: '' };
  const ult = ls[ls.length - 1], w = ultimaPalavra(ult), k = chave(w), rimando = [], usados = new Set();
  const cand = ENTR.filter((e) => chave(e.p) === k && e.p !== w); emb(cand, r).slice(0, 6).forEach((e) => { const l = linhaCom(e, r, usados); if (ok(l)) rimando.push(l); });
  const seus = []; outras.forEach((o) => linhasDe(o.letra).forEach((l) => { const u = ultimaPalavra(l); if (u && rimam(u, w) && !ls.includes(l) && seus.length < 6) seus.push({ linha: l, de: o.titulo }); }));
  const novos = versos({ tema: tm, esquema: 'AABB', seed: seed + 3 });
  return { tema: tm, ultima: ult, rimando, novos, seus };
}
