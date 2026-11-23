// Cópia de segurança em um arquivo .clanstudio (JSON). Restaurar só junta: nunca apaga nem troca o que é mais novo.
import { listar, gravarBruto } from './banco.js';

export async function exportar() {
  const projetos = await listar();
  const arq = { app: 'clan-music-studio', versao: 1, em: Date.now(), projetos };
  const blob = new Blob([JSON.stringify(arq)], { type: 'application/json' });
  const nome = 'clan-music-studio-' + new Date().toISOString().slice(0, 10) + '.clanstudio';
  const file = new File([blob], nome, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Cópia do Clan Music Studio' }); return { nome, n: projetos.length, via: 'compartilhar' }; } catch (e) { if (e && e.name === 'AbortError') return { nome, n: projetos.length, via: 'cancelado' }; }
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  return { nome, n: projetos.length, via: 'baixar' };
}

export async function importarTexto(texto) {
  let d; try { d = JSON.parse(texto); } catch (e) { throw new Error('Esse arquivo não é uma cópia do Clan Music Studio.'); }
  if (!d || d.app !== 'clan-music-studio' || !Array.isArray(d.projetos)) throw new Error('Esse arquivo não é uma cópia do Clan Music Studio.');
  const atuais = new Map((await listar()).map((p) => [p.id, p]));
  let novos = 0, atualizados = 0;
  for (const p of d.projetos) {
    if (!p || !p.id) continue;
    const a = atuais.get(p.id);
    if (!a) { await gravarBruto({ ...p }); novos++; }
    else if ((p.atualizado || 0) > (a.atualizado || 0)) { await gravarBruto({ ...a, versoes: [...(a.versoes || []), { em: Date.now(), de: 'antes de restaurar', titulo: a.titulo, letra: a.letra, notas: a.notas }], ...p }); atualizados++; }
  }
  return { novos, atualizados };
}
