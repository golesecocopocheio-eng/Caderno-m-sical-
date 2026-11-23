// Minha Banda IA: gera baixo, bateria, violão, guitarra e teclado a partir dos acordes, do estilo e da estrutura.
// Tudo é sintetizado aqui no aparelho (sem internet, sem biblioteca de sons). Soa como instrumento eletrônico, não como músico de estúdio.
export const SR = 32000;
export const ESTILOS = { pop: { nome: 'Pop', bpm: 100 }, balada: { nome: 'Balada', bpm: 70 }, rock: { nome: 'Rock', bpm: 120 }, reggae: { nome: 'Reggae', bpm: 76 } };
export const INSTR = [['bateria', 'Bateria'], ['baixo', 'Baixo'], ['violao', 'Violão'], ['guitarra', 'Guitarra'], ['teclado', 'Teclado']];
export const MIX = { bateria: { vol: 0.85, pan: 0 }, baixo: { vol: 0.9, pan: 0 }, violao: { vol: 0.6, pan: 0.3 }, guitarra: { vol: 0.5, pan: -0.4 }, teclado: { vol: 0.45, pan: 0.4 } };
export const ENERGIAS = ['Suave', 'Normal', 'Forte'];

// ---- acordes
const RX = /^([A-G])([#b]?)(m(?!aj)|min|-)?(maj7|M7|7|sus4|dim|aug|6|9)?(\/[A-G][#b]?)?$/;
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function acorde(t) {
  const m = RX.exec(String(t).trim()); if (!m) return null;
  let r = PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); r = (r + 12) % 12;
  return { nome: m[1] + m[2] + (m[3] ? 'm' : '') + (m[4] || ''), r, menor: !!m[3], ext: m[4] || '' };
}
// Sem "|": cada acorde é um compasso. Com "|": o que está entre as barras é um compasso e pode ter 2, 3 ou 4 acordes (C G | Am F).
export function lerAcordes(txt) {
  const ok = [], ruim = [], t = String(txt || ''), barras = [];
  const tok = (x) => x.split(/[\s,;]+/).filter(Boolean).forEach((w) => { const a = acorde(w); if (a) ok.push(a); else ruim.push(w); });
  if (t.includes('|')) t.split('|').forEach((seg) => { const i0 = ok.length; tok(seg); const cs = ok.slice(i0, i0 + 4); if (cs.length) barras.push(cs); });
  else { tok(t); ok.forEach((a) => barras.push([a])); }
  return { ok, ruim, barras, excesso: t.includes('|') ? ok.length - barras.reduce((n, b) => n + b.length, 0) : 0 };
}
// Pega só as linhas da cifra feitas inteiramente de acordes. Se houver "|", mantém os compassos com vários acordes.
export function progDaCifra(cifra) {
  const bars = []; let multi = false;
  String(cifra || '').split(/\r?\n/).forEach((l) => {
    const tk = l.split(/\s+/).filter(Boolean); if (!tk.length || !tk.every((t) => t === '|' || acorde(t))) return;
    if (l.includes('|')) l.split('|').forEach((seg) => { const cs = seg.split(/\s+/).filter((t) => acorde(t)).map((t) => acorde(t).nome); if (cs.length) { bars.push(cs); if (cs.length > 1) multi = true; } });
    else tk.forEach((t) => bars.push([acorde(t).nome]));
  });
  const b = multi ? bars : bars.filter((x, i) => !(i && x[0] === bars[i - 1][0])), f = b.slice(0, 32);
  return multi ? f.map((x) => x.join(' ')).join(' | ') : f.map((x) => x[0]).join(' ');
}
// Da análise: agrupa os acordes por compasso usando o andamento (vários por compasso quando mudam).
export function progDaAnalise(an, bpm) {
  const ac = ((an && an.acordes) || []).filter((c) => !c.mudo); if (!ac.length) return '';
  if (!bpm) return ac.map((c) => c.nome).filter((n, i, a) => n !== a[i - 1]).slice(0, 16).join(' ');
  const cb = 4 * 60 / bpm, bars = [];
  ac.forEach((c) => { const k = Math.floor((c.t + 0.15 * cb) / cb); (bars[k] = bars[k] || []); if (bars[k][bars[k].length - 1] !== c.nome) bars[k].push(c.nome); });
  const cheio = []; let ult = null; for (let i = 0; i < bars.length; i++) { const b = bars[i] || (ult ? [ult] : null); if (b) { cheio.push(b.slice(0, 4)); ult = b[b.length - 1]; } }
  const multi = cheio.some((b) => b.length > 1), f = cheio.slice(0, 16);
  return multi ? f.map((x) => x.join(' ')).join(' | ') : f.map((x) => x[0]).filter((n, i, a) => n !== a[i - 1]).join(' ');
}
const terca = (a) => (a.ext === 'sus4' ? 5 : a.menor || a.ext === 'dim' ? 3 : 4);
const quinta = (a) => (a.ext === 'dim' ? 6 : a.ext === 'aug' ? 8 : 7);
const extras = (a) => ({ '7': [10], maj7: [11], M7: [11], '6': [9], '9': [10, 14], dim: [], aug: [], sus4: [] }[a.ext] || []);

// ---- plano: um acorde por compasso, repetindo a progressão até preencher cada seção
// Cada item é um pedaço de compasso: um acorde tocando dos passos s0 a s1 (de 16). Compasso com 1 acorde = 1 pedaço.
export function plano(barras, secoes) {
  const L = barras.length ? barras : [[acorde('C')]], out = []; let nb = 0;
  secoes.forEach((s) => { const n = Math.max(1, Math.min(32, s.compassos | 0)); for (let i = 0; i < n; i++, nb++) { const cs = L[i % L.length], k = cs.length; for (let j = 0; j < k; j++) out.push({ a: cs[j], s0: Math.round(j * 16 / k), s1: Math.round((j + 1) * 16 / k), bar: nb, en: s.energia == null ? 1 : s.energia, ini: i === 0 && j === 0, fim: i === n - 1 && j === k - 1, sec: s.nome }); } });
  return out.filter((x) => x.bar < 96);
}

const rngDe = (seed) => { let a = seed >>> 0 || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const escala = [0.6, 0.85, 1];

// ---- sons
function ruido(ac, seg) { const b = ac.createBuffer(1, Math.ceil(SR * seg), SR), d = b.getChannelData(0); let a = 12345; for (let i = 0; i < d.length; i++) { a = (a * 1103515245 + 12345) & 0x7fffffff; d[i] = a / 0x3fffffff - 1; } return b; }
function env(g, t, v, atk, fim) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, Math.max(t + atk + 0.01, fim)); }
const cacheKS = new Map();
function ks(ac, midi, dec) {
  const k = midi + '/' + dec; if (cacheKS.has(k)) return cacheKS.get(k);
  const f = 440 * Math.pow(2, (midi - 69) / 12), N = Math.max(2, Math.round(SR / f)), len = SR * 2, b = ac.createBuffer(1, len, SR), d = b.getChannelData(0), line = new Float32Array(N); let a = midi * 7919 + 1;
  for (let i = 0; i < N; i++) { a = (a * 1103515245 + 12345) & 0x7fffffff; line[i] = a / 0x3fffffff - 1; }
  let p = 0; for (let i = 0; i < len; i++) { const x = line[p], y = line[(p + 1) % N]; d[i] = x; line[p] = dec * 0.5 * (x + y); p = (p + 1) % N; }
  cacheKS.set(k, b); return b;
}
const curva = (k) => { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; };

// ---- vozes (acordes em MIDI)
const raizGrave = (a, base) => base + ((a.r - base % 12 + 12) % 12);
function vozGuitar(a) { const R = raizGrave(a, 40), t = terca(a), q = quinta(a); const v = [R, R + q, R + 12, R + 12 + t, R + 12 + q]; extras(a).forEach((e) => v.push(R + 12 + (e % 12))); return v.sort((x, y) => x - y).slice(0, 6); }
function vozTeclas(a) { const R = 60 + a.r - (a.r > 6 ? 12 : 0), t = terca(a), q = quinta(a); const v = [R, R + t, R + q]; extras(a).forEach((e) => v.push(R + e)); return v; }

// ---- padrões por estilo (16 passos por compasso)
const P = {
  pop: { K: 'x.......x.x.....', S: '....x.......x...', H: 'x.x.x.x.x.x.x.x.', bx: [[0, 'r', 3], [6, 'r', 2], [8, 'f', 2], [10, 'r', 2], [14, 'o', 2]], vi: [[0, 'd'], [4, 'd', 0.6], [6, 'u', 0.7], [10, 'u', 0.7], [12, 'd']], gi: 'ac8', te: 'pad' },
  balada: { K: 'x.........x.....', S: '........x.......', H: 'x...x...x...x...', bx: [[0, 'r', 8], [8, 'f', 6]], vi: 'arp', gi: 'pad', te: 'pad' },
  rock: { K: 'x.......x.x.....', S: '....x.......x...', H: 'x.x.x.x.x.x.x.x.', bx: [0, 2, 4, 6, 8, 10, 12, 14].map((s) => [s, 'r', 2]), vi: [[0, 'd'], [2, 'd', 0.7], [4, 'd'], [6, 'u', 0.7], [8, 'd'], [10, 'd', 0.7], [12, 'd'], [14, 'u', 0.7]], gi: 'pot', te: 'pad' },
  reggae: { K: '........x.......', R: '........x.......', H: 'x.x.x.x.x.x.x.x.', bx: [[0, 'r', 3], [6, 'f', 2], [8, 'r', 4], [14, 'r', 2]], vi: [[2, 'u', 0.9], [6, 'u', 0.9], [10, 'u', 0.9], [14, 'u', 0.9]], gi: 'ska', te: 'bol' },
};

// ---- um instrumento por vez
function bateria(ac, pl, st, sp, rng) {
  const p = P[st], nb = ruido(ac, 1.5), bar = 16 * sp;
  const hat = (t, v, d) => { const s = ac.createBufferSource(), h = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = nb; h.type = 'highpass'; h.frequency.value = 7000; env(g, t, v * 0.35, 0.002, t + d); s.connect(h); h.connect(g); g.connect(ac.destination); s.start(t); s.stop(t + d + 0.05); };
  const kick = (t, v) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); env(g, t, v, 0.003, t + 0.32); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.4); };
  const snare = (t, v, rim) => { const s = ac.createBufferSource(), h = ac.createBiquadFilter(), g = ac.createGain(), o = ac.createOscillator(), g2 = ac.createGain(); s.buffer = nb; h.type = rim ? 'bandpass' : 'highpass'; h.frequency.value = rim ? 1800 : 1500; env(g, t, v * (rim ? 0.5 : 0.55), 0.001, t + (rim ? 0.05 : 0.2)); s.connect(h); h.connect(g); g.connect(ac.destination); s.start(t); s.stop(t + 0.3); o.type = 'triangle'; o.frequency.value = rim ? 900 : 190; env(g2, t, v * 0.35, 0.001, t + (rim ? 0.04 : 0.12)); o.connect(g2); g2.connect(ac.destination); o.start(t); o.stop(t + 0.25); };
  const crash = (t, v) => { const s = ac.createBufferSource(), h = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = nb; h.type = 'highpass'; h.frequency.value = 5000; env(g, t, v * 0.3, 0.002, t + 1.3); s.connect(h); h.connect(g); g.connect(ac.destination); s.start(t); s.stop(t + 1.4); };
  pl.forEach((b, i) => {
    const t0 = 0.1 + b.bar * bar, e = escala[b.en];
    for (let s = b.s0; s < b.s1; s++) {
      const t = t0 + s * sp + (rng() - 0.5) * 0.008, v = e * (0.85 + 0.3 * rng()), enchim = b.fim && b.en > 0 && st !== 'reggae' && s >= 12 && 'x.xx'[s - 12] === 'x';
      if (p.K[s] === 'x') kick(t, v * 0.9);
      if (b.en > 0 && !enchim && p.S && p.S[s] === 'x') snare(t, v, false);
      if (b.en > 0 && p.R && p.R[s] === 'x') snare(t, v, true);
      if (enchim) snare(t, v * (0.6 + (s - 12) * 0.12), false);
      if (p.H[s] === 'x') hat(t, v * (st === 'reggae' && s % 4 === 2 ? 1.1 : 0.8) * (b.en === 0 ? 0.7 : 1), s % 8 === 6 && b.en === 2 ? 0.12 : 0.04);
    }
    if (b.ini && b.en === 2 && b.bar > 0) crash(t0, escala[2]);
  });
}
function baixo(ac, pl, st, sp, rng) {
  const bar = 16 * sp;
  pl.forEach((b, i) => {
    const R = 33 + ((b.a.r - 9 + 12) % 12), e = escala[b.en];
    P[st].bx.filter(([s]) => s >= b.s0 && s < b.s1).forEach(([s, tp, d0]) => {
      const d = Math.min(d0, b.s1 - s), m = tp === 'r' ? R : tp === 'f' ? R + 7 : R + 12, f = 440 * Math.pow(2, (m - 69) / 12), t = 0.1 + b.bar * bar + s * sp + (rng() - 0.5) * 0.008, fim = t + d * sp * 0.95;
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain(), g2 = ac.createGain();
      o1.type = 'sine'; o1.frequency.value = f; o2.type = 'sawtooth'; o2.frequency.value = f; g2.gain.value = 0.25; lp.type = 'lowpass'; lp.frequency.value = 520;
      env(g, t, e * (0.8 + 0.2 * rng()) * 0.8, 0.008, fim); o1.connect(g); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(ac.destination); o1.start(t); o2.start(t); o1.stop(fim + 0.05); o2.stop(fim + 0.05);
    });
  });
}
function cordas(ac, pl, st, sp, rng, quem) {
  const bar = 16 * sp, ck = curva(quem === 'guitarra' ? 6 : 1.5);
  const nota = (m, t, dur, v, dec, dist, lpf) => {
    const s = ac.createBufferSource(), g = ac.createGain(), lp = ac.createBiquadFilter(); s.buffer = ks(ac, m, dec); lp.type = 'lowpass'; lp.frequency.value = lpf; let fim = t + dur;
    env(g, t, v, 0.002, fim); s.connect(lp);
    if (dist) { const w = ac.createWaveShaper(); w.curve = ck; lp.connect(w); w.connect(g); } else lp.connect(g);
    g.connect(ac.destination); s.start(t); s.stop(fim + 0.05);
  };
  pl.forEach((b, i) => {
    const t0 = 0.1 + b.bar * bar, e = escala[b.en], dentro = (s) => s >= b.s0 && s < b.s1, vz = vozGuitar(b.a), tipo = quem === 'violao' ? P[st].vi : P[st].gi;
    const acorde = (s, dir, vel, dur, dec, dist, lpf, n = 99) => { const nt = dir === 'u' ? vz.slice(-4).reverse() : vz; nt.slice(0, n).forEach((m, k) => nota(m, t0 + s * sp + k * 0.011 + (rng() - 0.5) * 0.008, dur, e * vel * (0.85 + 0.3 * rng()) * (quem === 'guitarra' ? 0.25 : 0.32), dec, dist, lpf)); };
    if (quem === 'violao') {
      if (tipo === 'arp') { [0, 2, 4, 6, 8, 10, 12, 14].forEach((s, k) => dentro(s) && nota(vz[[0, 1, 2, 3, 2, 1, 2, 3][k]], t0 + s * sp + (rng() - 0.5) * 0.008, sp * 6, e * (0.2 + 0.1 * rng()), 0.998, false, 5000)); }
      else tipo.filter(([s]) => dentro(s)).forEach(([s, d, v = 1]) => acorde(s, d, v, st === 'reggae' ? sp * 1.5 : sp * 3, 0.997, false, 5000));
    } else {
      const R = raizGrave(b.a, 40), pot = [R, R + 7, R + 12];
      const pw = (s, dur, v, dec = 0.996, dist = true, lpf = 2500) => pot.forEach((m, k) => nota(m, t0 + s * sp + k * 0.006 + (rng() - 0.5) * 0.008, dur, e * v * (0.85 + 0.3 * rng()) * 0.3, dec, dist, lpf));
      if (tipo === 'pot') [0, 2, 4, 6, 8, 10, 12, 14].filter(dentro).forEach((s) => pw(s, sp * 1.6, s % 4 === 0 ? 1 : 0.8));
      else if (tipo === 'ac8') [0, 4, 8, 12].filter(dentro).forEach((s) => pw(s, sp * 3.5, 0.9, 0.997, true, 3000));
      else if (tipo === 'pad') pw(b.s0, sp * (b.s1 - b.s0 - 0.5), 0.7, 0.9985, false, 2200);
      else if (tipo === 'ska') [6, 14].filter(dentro).forEach((s) => acorde(s, 'u', 0.9, sp * 1.2, 0.996, false, 3500));
    }
  });
}
function teclado(ac, pl, st, sp, rng) {
  const bar = 16 * sp, onda = ac.createPeriodicWave(new Float32Array([0, 1, 0.45, 0.2, 0.1, 0.05]), new Float32Array(6));
  pl.forEach((b, i) => {
    const t0 = 0.1 + b.bar * bar, e = escala[b.en], vz = vozTeclas(b.a), tipo = P[st].te;
    const toca = (s, dur, v, atk, lpf) => vz.forEach((m) => {
      const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter(), f = 440 * Math.pow(2, (m - 69) / 12), t = t0 + s * sp + (rng() - 0.5) * 0.006, fim = t + dur;
      o.setPeriodicWave(onda); o.frequency.value = f; o.detune.value = (rng() - 0.5) * 8; lp.type = 'lowpass'; lp.frequency.value = lpf;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(e * v * 0.16, t + atk); g.gain.setValueAtTime(e * v * 0.16, Math.max(t + atk, fim - 0.08)); g.gain.linearRampToValueAtTime(0.0001, fim);
      o.connect(lp); lp.connect(g); g.connect(ac.destination); o.start(t); o.stop(fim + 0.05);
    });
    if (tipo === 'pad') toca(b.s0, sp * (b.s1 - b.s0 - 0.5), 0.8, st === 'balada' ? 0.12 : 0.04, 2400);
    else [2, 6, 10, 14].filter((s) => s >= b.s0 && s < b.s1).forEach((s) => toca(s, sp * 1.4, 0.85, 0.005, 3000));
  });
}
const FN = { bateria, baixo, violao: (a, p, s, d, r) => cordas(a, p, s, d, r, 'violao'), guitarra: (a, p, s, d, r) => cordas(a, p, s, d, r, 'guitarra'), teclado };

// ---- gera um WAV por instrumento (mono, 32 kHz)
export async function gerar({ prog, secoes, estilo, bpm, instr, seed = 7 }, aoProgredir = () => {}) {
  if (!P[estilo]) throw new Error('Estilo desconhecido.');
  const pl = plano(prog, secoes); if (!pl.length) throw new Error('Defina ao menos uma seção.'); const nb = pl[pl.length - 1].bar + 1;
  bpm = Math.max(50, Math.min(220, bpm | 0 || 100)); const sp = 60 / bpm / 4, dur = 0.1 + nb * 16 * sp + 2.2, out = {};
  const nomes = INSTR.map((x) => x[0]).filter((k) => instr[k]);
  for (let i = 0; i < nomes.length; i++) {
    const k = nomes[i]; aoProgredir(INSTR.find((x) => x[0] === k)[1] + '…', i / nomes.length);
    const oc = new OfflineAudioContext(1, Math.ceil(dur * SR), SR); FN[k](oc, pl, estilo, sp, rngDe(seed * 31 + i * 101));
    const buf = await oc.startRendering(), d = buf.getChannelData(0); let pico = 0; for (let j = 0; j < d.length; j++) { const v = Math.abs(d[j]); if (v > pico) pico = v; }
    if (pico > 0.0005) { const kf = 0.8 / pico; for (let j = 0; j < d.length; j++) d[j] *= kf; }
    out[k] = { buf, pico };
  }
  aoProgredir('Pronto', 1); return { faixas: out, compassos: nb, dur: nb * 16 * sp };
}
