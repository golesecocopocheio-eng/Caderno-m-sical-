export const $ = (s, r = document) => r.querySelector(s);
export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let tm;
export function aviso(msg) {
  const a = $('#aviso'); a.textContent = msg; a.classList.add('on');
  clearTimeout(tm); tm = setTimeout(() => a.classList.remove('on'), 3200);
}
export const quando = (ms) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
export const debounce = (fn, ms = 500) => { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.agora = (...a) => { clearTimeout(t); fn(...a); }; return f; };
