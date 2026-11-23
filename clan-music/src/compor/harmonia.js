// Progressões por estilo e seção, escritas em graus (I, vi, IV...) e convertidas para o tom escolhido.
import { N, F, usaBemol } from '../analise/dsp.js';

const GRAU = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 };
export function acordeDoGrau(tok, r, maior) {
  const m = /^([b#]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(maj7|7|6|9|dim|sus4)?$/.exec(tok); if (!m) return null;
  const up = m[2] === m[2].toUpperCase(), off = GRAU[m[2].toUpperCase()] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0), raiz = ((r + off) % 12 + 12) % 12;
  const nomes = usaBemol(r, maior) ? F : N; return nomes[raiz] + (up ? '' : 'm') + (m[3] || '');
}
// "I V | vi IV" => "C G | Am F"; sem "|" cada grau é um compasso
export const traduz = (txt, r, maior) => txt.split(/(\|)/).map((p) => (p === '|' ? '|' : p.trim().split(/\s+/).filter(Boolean).map((t) => acordeDoGrau(t, r, maior) || t).join(' '))).filter((x) => x !== '').join(' ');

export const SECOES = ['Intro', 'Verso', 'Refrão', 'Ponte', 'Final'];
const P = {
  pop: {
    M: { Intro: ['I V vi IV'], Verso: ['I V vi IV', 'I vi IV V', 'vi IV I V'], 'Refrão': ['vi IV I V', 'IV I V vi', 'I V vi IV'], Ponte: ['IV V iii vi', 'vi V IV V'], Final: ['IV I', 'IV V I'] },
    m: { Intro: ['i bVII bVI bVII'], Verso: ['i bVII bVI bVII', 'i bVI bIII bVII', 'i iv bVI V'], 'Refrão': ['bVI bVII i i', 'i bVI bIII bVII', 'bVI bVII bIII i'], Ponte: ['iv bVI V V', 'bVI bVII iv V'], Final: ['bVII i', 'iv V i'] },
  },
  balada: {
    M: { Intro: ['I iii IV V'], Verso: ['I iii IV V', 'I vi IV V', 'I V vi iii IV I IV V'], 'Refrão': ['IV V iii vi', 'IV I V vi', 'vi IV I V'], Ponte: ['ii V iii vi', 'IV iii ii V'], Final: ['IV V I I'] },
    m: { Intro: ['i bVI iv V'], Verso: ['i bVI iv V', 'i bIII bVII bVI', 'i iv bVII bIII'], 'Refrão': ['bVI bVII i i', 'iv bVII bIII bVI'], Ponte: ['iv V i bVI', 'bVI bVII V V'], Final: ['iv V i i'] },
  },
  rock: {
    M: { Intro: ['I bVII IV I'], Verso: ['I bVII IV I', 'I IV V IV', 'I V IV IV'], 'Refrão': ['IV V I I', 'I IV V V', 'bVII IV I I'], Ponte: ['vi IV V V', 'IV bVII I I'], Final: ['IV V I I'] },
    m: { Intro: ['i bVII bVI bVII'], Verso: ['i bVII bVI bVII', 'i bIII bVII IV', 'i iv bVII bIII'], 'Refrão': ['bVI bVII i i', 'bIII bVII i i'], Ponte: ['iv bVI bVII bVII', 'bVI bVII V V'], Final: ['bVII i', 'bVI bVII i i'] },
  },
  reggae: {
    M: { Intro: ['I IV I IV'], Verso: ['I IV I IV', 'I V IV V', 'I vi IV V'], 'Refrão': ['IV I V I', 'I IV V IV', 'vi IV V I'], Ponte: ['vi IV vi IV', 'IV V IV V'], Final: ['I IV I I'] },
    m: { Intro: ['i iv i iv'], Verso: ['i iv i v', 'i bVII bVI bVII', 'i bVI bVII i'], 'Refrão': ['iv i bVII i', 'bVI bVII i i', 'iv v i i'], Ponte: ['iv iv bVII bVII', 'bVI bVII bVI bVII'], Final: ['i iv i i'] },
  },
  afrobeat: {
    M: { Intro: ['I IV'], Verso: ['I IV', 'I I IV IV', 'ii V I IV'], 'Refrão': ['IV IV I I', 'I IV V IV', 'IV V I I'], Ponte: ['vi vi V V', 'ii ii V V'], Final: ['I IV'] },
    m: { Intro: ['i iv'], Verso: ['i iv', 'i i iv iv', 'i bVII i bVII'], 'Refrão': ['iv iv i i', 'bVI bVII i i'], Ponte: ['bVI bVI bVII bVII', 'iv iv V V'], Final: ['i iv'] },
  },
  samba: {
    M: { Intro: ['ii7 V7 | Imaj7 vi7'], Verso: ['ii7 V7 | Imaj7 vi7', 'Imaj7 vi7 | ii7 V7', 'vi7 II7 | ii7 V7 | Imaj7 Imaj7'], 'Refrão': ['IV V7 | iii7 vi7 | ii7 V7 | I I', 'I IV | ii7 V7 | I vi7 | ii7 V7'], Ponte: ['vi7 II7 | ii7 V7 | iii7 VI7 | ii7 V7', 'IV iv | I vi7 | ii7 V7 | I I'], Final: ['ii7 V7 | I I'] },
    m: { Intro: ['i iv7 | V7 i'], Verso: ['i iv7 | V7 i', 'i bVII7 | bVI V7', 'iv7 V7 | i i'], 'Refrão': ['bVI V7 | i iv7 | bVII7 bIII | V7 V7', 'iv7 V7 | i bVI | iv7 V7 | i i'], Ponte: ['bVI bVII | V7 V7', 'iv7 bVII7 | bIII bVI | V7 V7 | i i'], Final: ['iv7 V7 | i i'] },
  },
  mpb: {
    M: { Intro: ['Imaj7 vi7 | ii7 V7'], Verso: ['Imaj7 vi7 | ii7 V7', 'IVmaj7 iii7 | ii7 V7 | Imaj7 Imaj7', 'Imaj7 | IVmaj7 | iii7 vi7 | ii7 V7'], 'Refrão': ['IVmaj7 V7 | iii7 vi7 | ii7 V7 | Imaj7 Imaj7', 'vi7 ii7 | V7 Imaj7 | IVmaj7 iii7 | ii7 V7'], Ponte: ['vi7 II7 | ii7 V7 | iii7 VI7 | ii7 V7', 'IVmaj7 iv7 | iii7 VI7 | ii7 V7 | Imaj7 Imaj7'], Final: ['ii7 V7 | Imaj7 Imaj7'] },
    m: { Intro: ['i7 iv7 | bVII7 bIIImaj7'], Verso: ['i7 iv7 | bVII7 bIIImaj7', 'i7 | iv7 | bVI V7 | i7 i7'], 'Refrão': ['bVI bVII7 | bIIImaj7 bVImaj7 | iv7 V7 | i7 i7', 'iv7 bVII7 | bIIImaj7 bVI | iv7 V7 | i7 i7'], Ponte: ['bVImaj7 V7 | i7 iv7 | bVII7 bIIImaj7 | V7 V7'], Final: ['iv7 V7 | i7 i7'] },
  },
};
export const ESTILOS_HARM = Object.keys(P);
// devolve as opções de progressão (já no tom) para um tipo de seção
export function progressoes(estilo, secao, r, maior) {
  const e = P[estilo] || P.pop, t = e[maior ? 'M' : 'm'], l = t[secao] || t.Verso; return l.map((g) => ({ graus: g, acordes: traduz(g, r, maior) }));
}
// o que costuma vir depois de um acorde do tom (função harmônica simples)
const PROX = {
  M: { 0: [[5, 'IV', 'abre e respira'], [7, 'V', 'cria tensão'], [9, 'vi', 'toque mais triste'], [2, 'ii', 'prepara a volta']], 2: [[7, 'V', 'resolve o ii'], [5, 'IV', 'suaviza']], 4: [[9, 'vi', 'desce natural'], [5, 'IV', 'abre']], 5: [[7, 'V', 'sobe a tensão'], [0, 'I', 'volta ao começo'], [2, 'ii', 'prepara o V'], [9, 'vi', 'sentimental']], 7: [[0, 'I', 'resolve'], [9, 'vi', 'surpresa (engana o ouvido)'], [5, 'IV', 'estica a tensão']], 9: [[5, 'IV', 'o mais comum depois do vi'], [2, 'ii', 'caminho jazz/MPB'], [7, 'V', 'sobe'], [0, 'I', 'volta']], 11: [[0, 'I', 'resolve']] },
  m: { 0: [[10, 'bVII', 'estilo reggae e rock'], [5, 'iv', 'escurece'], [8, 'bVI', 'cresce'], [7, 'V', 'cria tensão (dominante)']], 2: [[7, 'V', 'resolve']], 3: [[10, 'bVII', 'sobe'], [8, 'bVI', 'abre'], [5, 'iv', 'volta ao grave']], 5: [[7, 'V', 'tensão'], [10, 'bVII', 'abre'], [0, 'i', 'volta']], 7: [[0, 'i', 'resolve'], [8, 'bVI', 'surpresa']], 8: [[10, 'bVII', 'sobe'], [7, 'V', 'tensão'], [3, 'bIII', 'abre']], 10: [[0, 'i', 'volta ao tom'], [3, 'bIII', 'abre'], [8, 'bVI', 'desce']] },
};
const RX = /^([A-G])([#b]?)(m(?!aj)|min|-)?/;
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function proximos(acorde, r, maior) {
  const m = RX.exec(String(acorde).trim()); if (!m) return { grau: null, opcoes: [] };
  const raiz = ((PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)) % 12 + 12) % 12, d = ((raiz - r) % 12 + 12) % 12, tab = PROX[maior ? 'M' : 'm'], l = tab[d];
  if (!l) return { grau: null, opcoes: [] };
  const nomes = usaBemol(r, maior) ? F : N;
  return { grau: d, opcoes: l.map(([s, g, why]) => { const mm = (maior ? [2, 4, 9] : [0, 5, 7]).includes(s) && g === g.toLowerCase(); return { nome: nomes[(r + s) % 12] + (g === g.toLowerCase() ? 'm' : ''), grau: g, porque: why }; }) };
}
export const rotuloEstilo = (k) => ({ pop: 'Pop', balada: 'Balada', rock: 'Rock', reggae: 'Reggae roots', afrobeat: 'Afrobeat', samba: 'Samba', mpb: 'MPB' }[k] || k);
