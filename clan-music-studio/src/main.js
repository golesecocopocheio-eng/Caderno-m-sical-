import { $ } from './ui/util.js';
import { inicio, biblioteca, projeto, ajustes, ligar } from './ui/telas.js';
import { obter } from './dados/banco.js';
import { telaEscolher, ligarEscolher, telaGravar, ligarGravar, sair as sairGravacao } from './ui/gravar.js';

const IC = {
  inicio: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/></svg>',
  lib: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  aj: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.3 3h-4l-.3 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.3 2.7h4l.3-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>',
};
const ctx = { ir: (r) => { location.hash = '#' + r; }, p: null, instalar: null };
if (window.Capacitor) document.documentElement.style.setProperty('--satmin', '30px');

async function desenhar() {
  await sairGravacao();
  const rota = (location.hash || '#/inicio').slice(1).split('/').filter(Boolean);
  const nome = rota[0] || 'inicio';
  let html, aba = nome;
  try {
    if (nome === 'biblioteca') html = await biblioteca();
    else if (nome === 'projeto') { ctx.p = await obter(rota[1]); html = await projeto(rota[1]); aba = 'biblioteca'; }
    else if (nome === 'gravar') { aba = 'gravar'; if (rota[1]) { ctx.p = await obter(rota[1]); html = await telaGravar(rota[1]); } else html = await telaEscolher(); }
    else if (nome === 'ajustes') html = await ajustes();
    else { html = await inicio(); aba = 'inicio'; }
  } catch (e) {
    html = '<main class="tela"><div class="vazio"><p><b>Não consegui abrir os dados deste aparelho.</b></p><p>Feche e abra o app. Se continuar, avise.</p></div></main>';
  }
  $('#app').innerHTML = html + `<nav class="baixo" aria-label="Navegação">${[['inicio', 'Início', IC.inicio], ['gravar', 'Gravar', IC.mic], ['biblioteca', 'Biblioteca', IC.lib], ['ajustes', 'Ajustes', IC.aj]].map(([id, t, i]) => `<button data-nav="${id}" class="${aba === id ? 'on' : ''}" ${aba === id ? 'aria-current="page"' : ''}>${i}${t}</button>`).join('')}</nav>`;
  document.querySelectorAll('[data-nav]').forEach((b) => (b.onclick = () => ctx.ir('/' + b.dataset.nav)));
  if (nome === 'gravar') { if (rota[1] && ctx.p) ligarGravar(ctx, ctx.p); else if (!rota[1]) ligarEscolher(ctx); else { const v = $('#voltar'); if (v) v.onclick = () => ctx.ir('/gravar'); } }
  else ligar(nome === 'projeto' ? 'projeto' : nome, ctx);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', desenhar);
window.addEventListener('pagehide', () => { sairGravacao(); });
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ctx.instalar = e; if (location.hash === '#/ajustes') desenhar(); });
desenhar();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
