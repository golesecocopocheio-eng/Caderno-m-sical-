// Letra ao vivo: escreve o que você canta enquanto grava. Usa o reconhecimento de voz do aparelho (Google), que no celular
// pode precisar de internet. Se não houver, a gravação segue normal, sem texto.
const nativo = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SpeechRecognition) || null;
export const legendaDisponivel = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition || nativo());
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9áàâãéêíóôõúç ]/g, '').trim();

export function iniciarLegenda({ lang = 'pt-BR', aoTexto = () => {}, aoErro = () => {} } = {}) {
  const linhas = []; let ligado = true, parcial = '', fim = null;
  const empurra = (t) => { t = String(t || '').trim(); if (!t) return false; const u = linhas[linhas.length - 1]; if (u && (norm(u) === norm(t) || norm(t).startsWith(norm(u) + ' '))) { if (norm(t) !== norm(u)) linhas[linhas.length - 1] = t; else return false; } else linhas.push(t); return true; };
  const avisa = () => aoTexto(linhas.slice(), parcial);
  const P = nativo(), SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    let sr = null, feitos = new Set();
    const liga = () => {
      if (!ligado) return; sr = new SR(); sr.lang = lang; sr.continuous = true; sr.interimResults = true; feitos = new Set();
      sr.onresult = (e) => { let itm = ''; for (let i = 0; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) { if (!feitos.has(i)) { feitos.add(i); empurra(t); } } else if (i >= e.resultIndex) itm += t; } parcial = itm; avisa(); };
      sr.onerror = (e) => { if (e.error === 'no-speech' || e.error === 'aborted') return; ligado = false; aoErro(e.error === 'network' ? 'Para escrever a letra o celular precisa de internet. A gravação continua.' : e.error === 'audio-capture' ? 'O microfone está ocupado e não deu para escrever a letra junto. A gravação continua.' : 'Sem permissão para escrever a letra. A gravação continua.'); };
      sr.onend = () => { if (ligado) setTimeout(liga, 200); };
      try { sr.start(); } catch (e) { ligado = false; aoErro('Não deu para ligar a letra ao vivo. A gravação continua.'); }
    };
    liga(); fim = () => { ligado = false; try { sr.stop(); } catch (e) {} };
  } else if (P) {
    const hs = []; let vivo = '';
    const commit = () => { if (vivo) empurra(vivo); vivo = ''; parcial = ''; avisa(); };
    const vai = async () => { if (!ligado) return; try { await P.start({ language: lang, maxResults: 1, partialResults: true, popup: false }); } catch (e) { const m = String((e && e.message) || e); if (/permission|denied/i.test(m)) { ligado = false; aoErro('Sem permissão para escrever a letra. A gravação continua.'); } else if (ligado) setTimeout(vai, 700); } };
    (async () => { try { const a = await P.available(); if (!a || a.available === false) { ligado = false; return aoErro('Este celular não tem o reconhecimento de voz do Google. A gravação continua.'); } const pm = await P.requestPermissions(); if (pm && pm.speechRecognition === 'denied') { ligado = false; return aoErro('Sem permissão para escrever a letra. A gravação continua.'); }
      hs.push(P.addListener('partialResults', (e) => { const t = e && e.matches && e.matches[0]; if (!t) return; vivo = t; parcial = t; avisa(); }));
      hs.push(P.addListener('listeningState', (e) => { if (e && e.status === 'stopped') { commit(); if (ligado) setTimeout(vai, 250); } })); vai(); } catch (e) { ligado = false; aoErro('Não deu para ligar a letra ao vivo. A gravação continua.'); } })();
    fim = () => { ligado = false; commit(); try { P.stop(); } catch (x) {} hs.forEach((h) => { try { (h.then ? h.then((r) => r.remove()) : h.remove()); } catch (x) {} }); };
  } else { ligado = false; aoErro('Este aparelho não tem reconhecimento de voz. A gravação segue sem letra ao vivo.'); fim = () => {}; }
  return { parar() { if (parcial && !linhas.length) empurra(parcial); else if (parcial) empurra(parcial); fim(); return linhas.slice(); }, linhas: () => linhas.slice() };
}
