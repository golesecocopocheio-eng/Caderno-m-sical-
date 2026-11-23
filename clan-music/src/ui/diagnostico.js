// Teste de áudio no aparelho: ouvir, gravar e compartilhar. Feito para rodar no celular e gerar um relatório curto.
import { $, esc, aviso } from './util.js';
import { contexto, paraWav } from '../audio/wav.js';
import { entregar } from '../dados/entregar.js';

const R = { auto: {}, passos: {} };
const sim = (k, ok) => { R.passos[k] = ok; relat(); };
function tomWav(freqs, seg = 0.7) { const sr = 22050, n = Math.round(sr * seg * freqs.length), b = new OfflineAudioContext(1, 1, sr).createBuffer(1, n, sr), d = b.getChannelData(0); freqs.forEach((f, k) => { const a = k * Math.round(sr * seg); for (let i = 0; i < sr * seg; i++) { const e = Math.min(1, i / 300, (sr * seg - i) / 600); d[a + i] = 0.4 * e * Math.sin(2 * Math.PI * f * i / sr); } }); return paraWav(b); }
async function checar() {
  const a = {}; a.aparelho = navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90); a.app = window.Capacitor ? 'app instalado (APK)' : 'navegador';
  try { const c = contexto(); a.audio = c.state; a.taxa = c.sampleRate + ' Hz'; a.latencia = c.baseLatency != null ? Math.round(c.baseLatency * 1000) + ' ms' : 'n/d'; } catch (e) { a.audio = 'erro: ' + e.message; }
  a.mic = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? 'disponível' : 'indisponível';
  a.gravador = typeof MediaRecorder === 'undefined' ? 'indisponível' : ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].filter((t) => MediaRecorder.isTypeSupported(t)).join(', ') || 'sem formato';
  const P = (window.Capacitor && window.Capacitor.Plugins) || {}; a.compartilhar = P.Share && P.Filesystem ? 'nativo' : navigator.canShare ? 'do navegador' : 'só baixar arquivo';
  a.worker = typeof Worker !== 'undefined' ? 'sim' : 'não'; a.offline = 'serviceWorker' in navigator ? 'sim' : 'não'; return a;
}
const NOMES = { bipe: 'Bipe pelo Web Audio', musica: 'Faixa tocando no player', gravar: 'Gravar e ouvir de volta', enviar: 'Exportar / compartilhar arquivo' };
function relat() {
  const t = 'Clan Music Studio — teste de áudio\n' + Object.entries(R.auto).map(([k, v]) => k + ': ' + v).join('\n') + '\n' + Object.entries(NOMES).map(([k, n]) => n + ': ' + (R.passos[k] === undefined ? 'não testado' : R.passos[k] ? 'OK' : 'FALHOU')).join('\n');
  const el = $('#rel'); if (el) el.textContent = t; return t;
}
export async function tela() {
  return `<main class="tela"><button id="voltar" style="min-height:44px">← Ajustes</button><h1>Testar o áudio do aparelho</h1><p class="mute">Faça cada teste com o volume do celular ligado e depois toque no relatório para copiar e me mandar.</p>
  <div class="lista" id="tst">${Object.entries(NOMES).map(([k, n], i) => `<div class="item" style="flex-direction:column;align-items:stretch;gap:8px" data-t="${k}"><b>${i + 1}. ${n}</b><div class="duas"><button class="ouro" data-go>${k === 'gravar' ? 'Gravar 3 s' : k === 'enviar' ? 'Exportar teste' : 'Tocar'}</button><div style="display:flex;gap:6px"><button data-s="1" style="flex:1" aria-label="Funcionou">Funcionou</button><button data-s="0" style="flex:1" aria-label="Não funcionou">Não</button></div></div><p class="mute peq" data-m></p></div>`).join('')}</div>
  <h2>Relatório</h2><pre id="rel" class="card" style="white-space:pre-wrap;font-size:13px"></pre><button id="cp" class="ouro">Copiar relatório</button></main>`;
}
export async function ligar(ctx) {
  $('#voltar').onclick = () => ctx.ir('/ajustes'); R.auto = await checar(); R.passos = {}; relat();
  const m = (k, t) => { $(`[data-t=${k}] [data-m]`).textContent = t; };
  document.querySelectorAll('[data-t]').forEach((el) => el.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { sim(el.dataset.t, b.dataset.s === '1'); m(el.dataset.t, b.dataset.s === '1' ? 'Marcado: funcionou.' : 'Marcado: não funcionou.'); })));
  $('[data-t=bipe] [data-go]').onclick = async () => { try { const c = contexto(); if (c.state !== 'running') await c.resume(); const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 440; g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(0.3, c.currentTime + 0.05); g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.8); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.85); m('bipe', 'Tocando um bipe (estado do áudio: ' + c.state + '). Você ouviu?'); R.auto.audio = c.state; relat(); } catch (e) { m('bipe', 'Erro: ' + e.message); sim('bipe', false); } };
  $('[data-t=musica] [data-go]').onclick = async () => { try { const a = new Audio(URL.createObjectURL(tomWav([262, 330, 392, 523]))); await a.play(); m('musica', 'Tocando 4 notas (dó, mi, sol, dó). Você ouviu?'); } catch (e) { m('musica', 'O player não tocou: ' + (e.name || e.message)); sim('musica', false); } };
  $('[data-t=gravar] [data-go]').onclick = async () => {
    let st; try { st = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { m('gravar', 'Sem permissão do microfone: ' + (e.name || '')); return sim('gravar', false); }
    const mr = new MediaRecorder(st), ps = []; mr.ondataavailable = (e) => ps.push(e.data); mr.onstop = async () => { st.getTracks().forEach((t) => t.stop()); const b = new Blob(ps, { type: mr.mimeType }); m('gravar', `Gravou ${(b.size / 1024).toFixed(0)} KB. Tocando de volta: você ouviu a sua voz?`); try { await new Audio(URL.createObjectURL(b)).play(); } catch (e) { m('gravar', 'Gravou, mas não tocou de volta: ' + (e.name || '')); sim('gravar', false); } };
    mr.start(); m('gravar', 'Gravando… fale por 3 segundos.'); setTimeout(() => mr.state !== 'inactive' && mr.stop(), 3000);
  };
  $('[data-t=enviar] [data-go]').onclick = async () => { try { const v = await entregar(tomWav([440, 554]), 'teste-clan-music.wav', 'Teste do Clan Music Studio'); m('enviar', v === 'cancelado' ? 'Você cancelou.' : v === 'baixar' ? 'Arquivo baixado. Confira nos downloads.' : 'Abriu o compartilhar. Conseguiu enviar?'); } catch (e) { m('enviar', 'Erro: ' + (e.message || e)); sim('enviar', false); } };
  $('#cp').onclick = async () => { const t = relat(); try { await navigator.clipboard.writeText(t); aviso('Relatório copiado.'); } catch (e) { aviso('Não deu para copiar. Tire um print do relatório.'); } };
}
