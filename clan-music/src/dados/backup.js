// Cópia de segurança (.clanstudio): arquivo único com os projetos E os áudios.
// Formato: "CSTD" + tamanho do manifesto (4 bytes) + manifesto JSON + bytes dos áudios, um depois do outro.
// Restaurar só junta: nunca apaga nem troca o que é mais novo (o texto anterior vai para as versões).
import { listar, gravarBruto, obterMidia, salvarMidia } from './banco.js';

export async function montar() {
  const projetos = await listar(), partes = [];
  const man = projetos.map((p) => ({ ...p, faixas: [] }));
  for (let i = 0; i < projetos.length; i++) {
    for (const f of projetos[i].faixas || []) {
      const m = f.midiaId ? await obterMidia(f.midiaId) : null;
      if (m && m.blob) { man[i].faixas.push({ ...f, _m: { mime: m.blob.type || m.mime || '', size: m.blob.size } }); partes.push(m.blob); }
      else man[i].faixas.push({ ...f, midiaId: null });
    }
  }
  const txt = new TextEncoder().encode(JSON.stringify({ app: 'clan-music-studio', versao: 2, em: Date.now(), projetos: man }));
  const cab = new Uint8Array(8); cab.set([67, 83, 84, 68]); new DataView(cab.buffer).setUint32(4, txt.length, true);
  return { blob: new Blob([cab, txt, ...partes], { type: 'application/octet-stream' }), n: projetos.length, faixas: partes.length };
}

export async function exportar() {
  const { blob, n, faixas } = await montar();
  const nome = 'clan-music-studio-' + new Date().toISOString().slice(0, 10) + '.clanstudio';
  const file = new File([blob], nome, { type: 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Cópia do Clan Music Studio' }); return { nome, n, faixas, via: 'compartilhar' }; } catch (e) { if (e && e.name === 'AbortError') return { nome, n, faixas, via: 'cancelado' }; }
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  return { nome, n, faixas, via: 'baixar' };
}

async function ler(file) {
  const cab = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (String.fromCharCode(...cab.slice(0, 4)) === 'CSTD') {
    const ml = new DataView(cab.buffer).getUint32(4, true), man = JSON.parse(await file.slice(8, 8 + ml).text());
    let off = 8 + ml;
    for (const p of man.projetos) for (const f of p.faixas || []) if (f._m) { f.blob = file.slice(off, off + f._m.size, f._m.mime); off += f._m.size; delete f._m; }
    return man;
  }
  return JSON.parse(await file.text()); // formato antigo da etapa 1 (só texto)
}

export async function importarArquivo(file) {
  let d; try { d = await ler(file); } catch (e) { throw new Error('Esse arquivo não é uma cópia do Clan Music Studio.'); }
  if (!d || d.app !== 'clan-music-studio' || !Array.isArray(d.projetos)) throw new Error('Esse arquivo não é uma cópia do Clan Music Studio.');
  const atuais = new Map((await listar()).map((p) => [p.id, p]));
  let novos = 0, atualizados = 0;
  for (const p of d.projetos) {
    if (!p || !p.id) continue;
    const a = atuais.get(p.id);
    if (a && (p.atualizado || 0) <= (a.atualizado || 0)) continue;
    const faixas = [];
    for (const f of p.faixas || []) {
      const { blob, ...r } = f;
      if (blob && r.midiaId) await salvarMidia({ id: r.midiaId, blob, mime: blob.type });
      faixas.push(r);
    }
    const novo = { ...p, faixas };
    if (a) { novo.versoes = [...(a.versoes || []), { em: Date.now(), de: 'antes de restaurar', titulo: a.titulo, letra: a.letra, cifra: a.cifra, notas: a.notas }]; atualizados++; } else novos++;
    await gravarBruto(novo);
  }
  return { novos, atualizados };
}
