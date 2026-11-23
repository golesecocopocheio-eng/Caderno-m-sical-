// Análise musical feita no próprio aparelho (sem internet, sem chave). Funções puras: rodam na página ou num Worker.
export const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const F = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const usaBemol = (r, maior) => (maior ? [5, 10, 3, 8, 1] : [0, 2, 5, 7, 10, 3]).includes(r);
export const nomeNota = (m) => N[m % 12] + (Math.floor(m / 12) - 1);
export const nivel = (c) => (c >= 0.7 ? 'alta' : c >= 0.4 ? 'média' : 'baixa');
const tick = () => new Promise((r) => setTimeout(r, 0));

// ---- andamento (BPM): ataques (sem o grave) + autocorrelação com pontuação por múltiplos do pulso
// O baixo sincopado fazia o 120 virar 80; olhar também os submúltiplos (colcheias) e o dobro do pulso resolve.
export function bpm(y, R) {
  const H = 256, W = 1024, n = Math.floor((y.length - W) / H); if (n < 96) return null;
  // ênfase nos ataques (tira o grave, que é o que confunde o ritmo): filtro de pré-ênfase
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) { let t = 0; for (let k = 1; k < W; k += 2) { const v = y[i * H + k] - 0.95 * y[i * H + k - 1]; t += v * v; } e[i] = Math.sqrt(t / (W / 2)); }
  const fl = new Float32Array(n); let mu = 0;
  for (let i = 1; i < n; i++) { fl[i] = Math.sqrt(Math.max(0, e[i] - e[i - 1])); mu += fl[i]; } mu /= n;
  for (let i = 0; i < n; i++) fl[i] = Math.max(0, fl[i] - mu);
  let a0 = 0; for (let i = 0; i < n; i++) a0 += fl[i] * fl[i]; if (a0 < 1e-9) return null;
  const fps = R / H, maxl = Math.min(n - 2, Math.ceil(fps * 60 / 60 * 4) + 2), ac = new Float32Array(maxl + 2);
  for (let l = 1; l <= maxl + 1; l++) { let t = 0; for (let i = l; i < n; i++) t += fl[i] * fl[i - l]; ac[l] = t / a0 * (n / (n - l)); }
  const at = (l) => { if (l < 1 || l > maxl) return 0; const a = Math.floor(l), f = l - a; return ac[a] * (1 - f) + ac[Math.min(a + 1, maxl + 1)] * f; };
  const L = (b) => 60 * fps / b; let best = -1, bb = 0;
  for (let b = 66; b <= 185; b += 0.5) {
    const l = L(b), s = at(l) + 0.6 * at(2 * l) + 0.4 * at(4 * l) + 0.5 * at(l / 2), w = Math.exp(-0.5 * Math.pow(Math.log2(b / 120) / 1.1, 2));
    if (s * w > best) { best = s * w; bb = b; }
  }
  // refina pelo pico de 4 pulsos (a precisão de um lag inteiro melhora 4 vezes)
  const pico = (l0) => { let pk = Math.round(l0), pv = -1; for (let l = Math.floor(l0 * 0.97); l <= Math.ceil(l0 * 1.03); l++) if (l >= 2 && l <= maxl && ac[l] > pv) { pv = ac[l]; pk = l; } const a = ac[pk - 1], b0 = ac[pk], c = ac[pk + 1], d = a - 2 * b0 + c; return { l: d < 0 ? pk + Math.max(-1, Math.min(1, 0.5 * (a - c) / d)) : pk, v: pv }; };
  const p1 = pico(L(bb)), p4 = 4 * L(bb) <= maxl ? pico(4 * L(bb)) : null, fr = p4 && p4.v > 0.3 * p1.v ? p4.l / 4 : p1.l, pv = p1.v, conf = Math.max(0, Math.min(1, pv / 0.35));
  if (conf < 0.05) return null; // sem pulso claro: melhor não chutar
  let v = 60 * fps / fr; while (v < 60) v *= 2; while (v > 200) v /= 2;
  return { bpm: Math.round(v), conf };
}

// ---- cromagrama (energia de cada nota C..B ao longo do tempo)
export async function cromagrama(y, R, prog) {
  const W = 4096, nf = Math.floor((y.length - W) / W); if (nf < 3) return null;
  const passo = Math.max(1, Math.ceil(nf / 500)), hann = new Float32Array(W); for (let i = 0; i < W; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (W - 1));
  const notas = []; for (let m = 36; m <= 83; m++) notas.push({ pc: m % 12, w: 2 * Math.PI * 440 * Math.pow(2, (m - 69) / 12) / R });
  const fr = [];
  for (let f = 0; f < nf; f += passo) {
    const o = f * W, c = new Float32Array(12); let en = 0;
    for (let i = 0; i < W; i += 4) { const v = y[o + i]; en += v * v; } en = Math.sqrt(en / (W / 4));
    if (en > 0.004) {
      for (const nt of notas) { const co = 2 * Math.cos(nt.w); let s1 = 0, s2 = 0; for (let i = 0; i < W; i += 2) { const s0 = y[o + i] * hann[i] + co * s1 - s2; s2 = s1; s1 = s0; } c[nt.pc] += Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - co * s1 * s2)); }
      let t = 0; for (let i = 0; i < 12; i++) { c[i] = Math.sqrt(c[i]); t += c[i]; } if (t > 0) for (let i = 0; i < 12; i++) c[i] /= t;
    } else en = 0;
    fr.push({ t: o / R, c, en });
    if (fr.length % 12 === 0) { prog && prog(f / nf); await tick(); }
  }
  return { fr, dt: W * passo / R };
}

// ---- tom (Krumhansl-Schmuckler)
const KM = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], Km = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const cor = (x, p) => { let mx = 0, mp = 0; for (let i = 0; i < 12; i++) { mx += x[i]; mp += p[i]; } mx /= 12; mp /= 12; let a = 0, b = 0, c = 0; for (let i = 0; i < 12; i++) { const u = x[i] - mx, v = p[i] - mp; a += u * v; b += u * u; c += v * v; } return b && c ? a / Math.sqrt(b * c) : 0; };
export function tom(fr) {
  const s = new Float32Array(12); fr.forEach((f) => { if (f.en) for (let i = 0; i < 12; i++) s[i] += f.c[i]; });
  const L = []; for (let r = 0; r < 12; r++) { const rot = (p) => p.map((_, i) => p[(i - r + 12) % 12]); L.push({ r, m: 'M', v: cor(s, rot(KM)) }); L.push({ r, m: 'm', v: cor(s, rot(Km)) }); }
  L.sort((a, b) => b.v - a.v); const a = L[0], b = L[1], bem = usaBemol(a.r, a.m === 'M');
  const nm = (x) => (usaBemol(x.r, x.m === 'M') ? F : N)[x.r] + (x.m === 'm' ? 'm' : '');
  return { r: a.r, modo: a.m, nome: nm(a), bemol: bem, conf: Math.max(0, Math.min(1, (a.v - 0.35) / 0.4 * 0.6 + (a.v - b.v) / 0.08 * 0.4)), alt: L.slice(1, 3).map(nm) };
}

// ---- acordes (tríades maiores e menores, ajustadas ao tom)
export function acordes(an, k, andamento) {
  const fr = an.fr; if (!fr.length) return [];
  const dia = new Set(), esc = k.modo === 'M' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10], q = k.modo === 'M' ? ['M', 'm', 'm', 'M', 'M', 'm', 'd'] : ['m', 'd', 'M', 'm', 'm', 'M', 'M'];
  esc.forEach((d, i) => { if (q[i] !== 'd') dia.add(((k.r + d) % 12) + q[i]); });
  const T = []; for (let r = 0; r < 12; r++) for (const m of ['M', 'm']) { const t = new Float32Array(12); t[r] = 1; t[(r + (m === 'M' ? 4 : 3)) % 12] = 0.85; t[(r + 7) % 12] = 0.9; T.push({ r, m, t }); }
  const span = Math.max(0.8, andamento ? 2 * 60 / andamento : 2), out = []; let acc = new Float32Array(12), n = 0, t0 = fr[0].t;
  const nomes = k.bemol ? F : N;
  const fecha = (t1) => {
    if (n) { let b = null, bs = -1; for (const x of T) { let d = 0, na = 0, nb = 0; for (let i = 0; i < 12; i++) { d += acc[i] * x.t[i]; na += acc[i] * acc[i]; nb += x.t[i] * x.t[i]; } let v = na ? d / Math.sqrt(na * nb) : 0; if (dia.has(x.r + x.m)) v *= 1.06; if (v > bs) { bs = v; b = x; } }
      out.push({ t: t0, nome: nomes[b.r] + (b.m === 'm' ? 'm' : ''), conf: Math.max(0, Math.min(1, (bs - 0.55) / 0.3)), mudo: false });
    } else out.push({ t: t0, nome: '—', conf: 0, mudo: true });
    acc = new Float32Array(12); n = 0; t0 = t1;
  };
  fr.forEach((f) => { if (f.t - t0 >= span) fecha(f.t); if (f.en) { n++; for (let i = 0; i < 12; i++) acc[i] += f.c[i]; } });
  fecha(fr[fr.length - 1].t);
  const m = []; out.forEach((c) => { const l = m[m.length - 1]; if (l && l.nome === c.nome) l.conf = (l.conf + c.conf) / 2; else m.push({ ...c }); });
  return m;
}

// ---- melodia (afinação por YIN, de 80 a 800 Hz: voz e instrumentos de uma nota só)
export async function notas(y, R, prog) {
  const W = 512, TMAX = Math.floor(R / 80), TMIN = Math.floor(R / 800), H = 512, nf = Math.min(Math.floor((y.length - W - TMAX) / H), Math.floor(R * 180 / H)); if (nf < 8) return null;
  const m = []; let voz = 0;
  for (let f = 0; f < nf; f++) {
    const o = f * H; let rms = 0; for (let i = 0; i < W; i += 2) rms += y[o + i] * y[o + i]; rms = Math.sqrt(rms / (W / 2)); let mid = 0;
    if (rms > 0.01) {
      const d = new Float32Array(TMAX + 1); for (let t = TMIN; t <= TMAX; t++) { let s = 0; for (let i = 0; i < W; i += 2) { const x = y[o + i] - y[o + i + t]; s += x * x; } d[t] = s; }
      let run = 0; const cm = new Float32Array(TMAX + 1); for (let t = 1; t <= TMAX; t++) { run += d[t]; cm[t] = run ? d[t] * t / run : 1; }
      let tau = 0; for (let t = TMIN; t < TMAX; t++) { if (cm[t] < 0.15) { while (t + 1 < TMAX && cm[t + 1] < cm[t]) t++; tau = t; break; } }
      if (tau) { const a = cm[tau - 1] || cm[tau], b = cm[tau], c = cm[tau + 1] || cm[tau], dd = a - 2 * b + c, ft = dd ? tau + 0.5 * (a - c) / dd : tau; mid = Math.round(69 + 12 * Math.log2(R / ft / 440)); voz++; }
    }
    m.push(mid); if (f % 60 === 0) { prog && prog(f / nf); await tick(); }
  }
  const sm = m.map((v, i) => { const w = [m[i - 1] || 0, v, m[i + 1] || 0].sort((a, b) => a - b); return w[1]; }), nt = []; let cur = 0, st = 0;
  const push = (a, b, v) => { if (v && b - a >= 3) nt.push({ t: a * H / R, d: (b - a) * H / R, midi: v }); };
  sm.forEach((v, i) => { if (v !== cur) { push(st, i, cur); cur = v; st = i; } }); push(st, sm.length, cur);
  return { notas: nt, voz: voz / nf };
}

// ---- tudo junto
export async function analisar({ mix, voz, R }, prog = () => {}) {
  const r = { dur: mix.length / R };
  prog('Andamento…', 0.05); r.bpm = bpm(mix, R);
  const cr = await cromagrama(mix, R, (v) => prog('Tom e acordes…', 0.1 + v * 0.55));
  if (cr) { r.tom = tom(cr.fr); r.acordes = acordes(cr, r.tom, r.bpm && r.bpm.bpm); }
  if (voz) { const p = await notas(voz.y, R, (v) => prog('Melodia…', 0.7 + v * 0.28)); r.melodia = p ? { ...p, fonte: voz.fonte } : null; }
  prog('Pronto', 1); return r;
}
