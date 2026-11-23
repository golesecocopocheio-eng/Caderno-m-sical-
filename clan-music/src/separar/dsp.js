// Separação de instrumentos no aparelho, sem IA e sem internet.
//  - Centro × laterais: em música estéreo a voz e o baixo costumam estar no centro; tirar o centro deixa o acompanhamento.
//  - Percussão × harmônicos: ataques (bateria) são tirados do que sustenta (violão, teclado, voz) olhando o espectrograma.
//  - Graves / agudos: filtros.
// É aproximado. Para separar com qualidade de estúdio seria preciso um modelo de IA grande (não incluído).
const PI2 = Math.PI * 2;

// ---- filtros (biquad Butterworth em cascata = 24 dB/oitava)
function biquad(tipo, f, R, q = Math.SQRT1_2) {
  const w = PI2 * f / R, c = Math.cos(w), a = Math.sin(w) / (2 * q); let b0, b1, b2;
  if (tipo === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  const a0 = 1 + a; return [b0 / a0, b1 / a0, b2 / a0, -2 * c / a0, (1 - a) / a0];
}
function aplica(x, co) { const [b0, b1, b2, a1, a2] = co, y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = x[i], o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o; } return y; }
export const passaBaixa = (x, f, R) => aplica(aplica(x, biquad('lp', f, R)), biquad('lp', f, R));
export const passaAlta = (x, f, R) => aplica(aplica(x, biquad('hp', f, R)), biquad('hp', f, R));

// ---- centro × laterais (precisa de 2 canais diferentes)
export function estereoReal(L, R) { let d = 0, s = 0; for (let i = 0; i < L.length; i += 7) { const a = L[i] - R[i]; d += a * a; s += L[i] * L[i] + R[i] * R[i]; } return s > 0 && d / s > 0.002; }
export function centro(L, R, sr, corte = 150) {
  const n = L.length, mid = new Float32Array(n); for (let i = 0; i < n; i++) mid[i] = 0.5 * (L[i] + R[i]);
  const lp = passaBaixa(mid, corte, sr), c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = mid[i] - lp[i]; // complemento exato: sem erro de fase ao subtrair
  const aL = new Float32Array(n), aR = new Float32Array(n);
  for (let i = 0; i < n; i++) { aL[i] = L[i] - c[i]; aR[i] = R[i] - c[i]; } // o grave do centro (baixo, bumbo) continua no acompanhamento
  return { centro: c, acompL: aL, acompR: aR };
}

// ---- FFT radix-2
function fft(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) { const ang = (inv ? PI2 : -PI2) / len, wr = Math.cos(ang), wi = Math.sin(ang); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
const N = 1024, H = 256, B = N / 2 + 1, win = (() => { const w = new Float32Array(N); for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(PI2 * i / N); return w; })();

// um trecho curto: devolve { harm, perc } do mesmo tamanho
function hpssTrecho(x, tempoLargura, freqLargura) {
  const len = x.length, nf = Math.max(1, Math.ceil((len + N) / H)), pad = new Float32Array((nf - 1) * H + N); pad.set(x, N / 2 | 0);
  const re = new Float32Array(nf * B), im = new Float32Array(nf * B), mag = new Float32Array(nf * B), r = new Float32Array(N), i2 = new Float32Array(N);
  for (let f = 0; f < nf; f++) { for (let k = 0; k < N; k++) { r[k] = pad[f * H + k] * win[k]; i2[k] = 0; } fft(r, i2, false); for (let b = 0; b < B; b++) { re[f * B + b] = r[b]; im[f * B + b] = i2[b]; mag[f * B + b] = Math.hypot(r[b], i2[b]); } }
  // médias móveis: no tempo (realça o que sustenta) e na frequência (realça ataques)
  const Hm = new Float32Array(nf * B), Pm = new Float32Array(nf * B), tw = tempoLargura >> 1, fw = freqLargura >> 1;
  for (let b = 0; b < B; b++) { let s = 0, c = 0; const q = []; for (let f = 0; f < Math.min(nf, tw + 1); f++) { s += mag[f * B + b]; c++; } for (let f = 0; f < nf; f++) { Hm[f * B + b] = s / c; const add = f + tw + 1, sub = f - tw; if (add < nf) { s += mag[add * B + b]; c++; } if (sub >= 0) { s -= mag[sub * B + b]; c--; } } }
  for (let f = 0; f < nf; f++) { const o = f * B; let s = 0, c = 0; for (let b = 0; b < Math.min(B, fw + 1); b++) { s += mag[o + b]; c++; } for (let b = 0; b < B; b++) { Pm[o + b] = s / c; const add = b + fw + 1, sub = b - fw; if (add < B) { s += mag[o + add]; c++; } if (sub >= 0) { s -= mag[o + sub]; c--; } } }
  const oh = new Float32Array(pad.length), op = new Float32Array(pad.length), norm = new Float32Array(pad.length);
  for (let f = 0; f < nf; f++) {
    for (const quem of [0, 1]) {
      for (let b = 0; b < B; b++) { const h = Hm[f * B + b], p = Pm[f * B + b], hh = h * h, pp = p * p, m = quem === 0 ? hh / (hh + pp + 1e-12) : pp / (hh + pp + 1e-12); r[b] = re[f * B + b] * m; i2[b] = im[f * B + b] * m; }
      for (let b = 1; b < N / 2; b++) { r[N - b] = r[b]; i2[N - b] = -i2[b]; } fft(r, i2, true); const sai = quem === 0 ? oh : op;
      for (let k = 0; k < N; k++) sai[f * H + k] += r[k] * win[k];
    }
    for (let k = 0; k < N; k++) norm[f * H + k] += win[k] * win[k];
  }
  const harm = new Float32Array(len), perc = new Float32Array(len), off = N / 2 | 0;
  for (let i = 0; i < len; i++) { const d = norm[i + off] || 1; harm[i] = oh[i + off] / d; perc[i] = op[i + off] / d; }
  return { harm, perc };
}
// música inteira em trechos de 20 s (com 1 s de contexto de cada lado) para não gastar memória
export async function hpss(x, sr, prog = () => {}, { tempoSeg = 0.35, freqHz = 400 } = {}) {
  const len = x.length, T = Math.round(20 * sr), C = Math.round(1 * sr), harm = new Float32Array(len), perc = new Float32Array(len), tw = Math.max(3, Math.round(tempoSeg * sr / H)) | 1, fw = Math.max(3, Math.round(freqHz / (sr / N))) | 1;
  for (let a = 0; a < len; a += T) { const ini = Math.max(0, a - C), fim = Math.min(len, a + T + C), r = hpssTrecho(x.subarray(ini, fim), tw, fw), de = a - ini, ate = Math.min(len, a + T) - a; harm.set(r.harm.subarray(de, de + ate), a); perc.set(r.perc.subarray(de, de + ate), a); prog(Math.min(1, (a + T) / len)); await new Promise((ok) => setTimeout(ok, 0)); }
  return { harm, perc };
}

// ---- tudo junto. canais: [L] ou [L,R]; opcoes: o que gerar
export async function separar({ canais, sr, opcoes }, prog = () => {}) {
  const L = canais[0], R = canais[1] || canais[0], mono = canais.length < 2 || !estereoReal(L, R), out = [], aviso = [];
  const mix = new Float32Array(L.length); for (let i = 0; i < L.length; i++) mix[i] = 0.5 * (L[i] + R[i]);
  if (opcoes.centro) {
    if (mono) aviso.push('Este áudio é mono (ou os dois lados são iguais): não dá para separar voz do acompanhamento pelo centro.');
    else { prog('Separando o centro…', 0.05); const r = centro(L, R, sr); out.push({ id: 'acomp', nome: 'sem a voz do centro (acompanhamento)', canais: [r.acompL, r.acompR] }, { id: 'centro', nome: 'centro (voz e o que está no meio)', canais: [r.centro] }); }
  }
  if (opcoes.graves) { prog('Graves…', 0.12); out.push({ id: 'graves', nome: 'graves (baixo e bumbo)', canais: [passaBaixa(mix, 180, sr)] }); }
  if (opcoes.agudos) { prog('Agudos…', 0.16); out.push({ id: 'agudos', nome: 'agudos (pratos e brilho)', canais: [passaAlta(mix, 5000, sr)] }); }
  if (opcoes.percussao) { const r = await hpss(mix, sr, (v) => prog('Percussão e harmônicos…', 0.2 + v * 0.78)); out.push({ id: 'perc', nome: 'percussão (bateria e ataques)', canais: [r.perc] }, { id: 'harm', nome: 'harmônicos (violão, teclado, voz)', canais: [r.harm] }); }
  prog('Pronto', 1); return { faixas: out, aviso, mono };
}
