// Traz as músicas do Clan music antigo como CÓPIA. O app antigo nunca é alterado nem lido para escrita.
import { listar, gravarBruto, salvarMidia } from './banco.js';

// Cópia (.cmbk) feita pelo botão "Salvar no Drive" do app antigo.
export async function lerCmbk(file) {
  const cab = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (String.fromCharCode(...cab.slice(0, 4)) === 'CMBK') {
    const ml = new DataView(cab.buffer).getUint32(4, true), man = JSON.parse(await file.slice(8, 8 + ml).text());
    let off = 8 + ml;
    man.songs.forEach((s) => (s.audios || []).forEach((a) => { a.blob = file.slice(off, off + a.size, a.mime); off += a.size; delete a.size; delete a.mime; }));
    return man.songs;
  }
  const j = JSON.parse(await file.text());
  if (!j || !Array.isArray(j.songs)) throw new Error('x');
  return j.songs.map((s) => ({ ...s, audios: (s.audios || []).map((a) => { const { data, ...r } = a; return { ...r, blob: data ? d2b(data) : null }; }) }));
}
function d2b(d) { const [h, b] = d.split(','), m = h.match(/:(.*?);/)[1], bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: m }); }

// Leitura direta do banco do app antigo (só funciona no Chrome, onde os dois apps dividem o mesmo endereço).
export async function bancoAntigoExiste() {
  try { if (!indexedDB.databases) return false; return (await indexedDB.databases()).some((d) => d.name === 'caderno'); } catch (e) { return false; }
}
export async function lerBancoAntigo() {
  const db = await new Promise((ok, erro) => { const r = indexedDB.open('caderno'); r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });
  try {
    if (!db.objectStoreNames.contains('s')) return [];
    const tx = db.transaction(['s', 'a'].filter((n) => db.objectStoreNames.contains(n)));
    const get = (st, k) => new Promise((ok) => { const q = tx.objectStore(st).get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); });
    const todas = await new Promise((ok) => { const q = tx.objectStore('s').getAll(); q.onsuccess = () => ok(q.result || []); q.onerror = () => ok([]); });
    for (const s of todas) { s.audios = s.audios || []; for (const a of s.audios) { if (!a.blob && db.objectStoreNames.contains('a')) { const x = await get('a', a.id); a.blob = x ? x.blob : null; } } }
    return todas;
  } finally { db.close(); }
}

export const separar = (songs) => ({ proprias: songs.filter((s) => !s.outro), outros: songs.filter((s) => s.outro) });

export async function importar(songs) {
  const ja = new Set((await listar()).map((p) => p.id));
  let novos = 0, jaTinha = 0, faixas = 0, semAudio = 0;
  for (const s of songs) {
    const id = 'a-' + s.id;
    if (ja.has(id)) { jaTinha++; continue; }
    const fx = [];
    for (const a of s.audios || []) {
      if (!a.blob || !a.blob.size) { semAudio++; continue; }
      const midiaId = 'm-' + a.id;
      await salvarMidia({ id: midiaId, blob: a.blob, mime: a.blob.type });
      const { blob, _p, id: aid, ...r } = a;
      fx.push({ ...r, id: aid, midiaId, mime: a.blob.type }); faixas++;
    }
    await gravarBruto({
      id, titulo: s.title || 'Sem título', artista: s.artist || '', tom: s.key || 'C', modo: s.mode === 'm' ? 'm' : 'M', bpm: s.bpm || 90, sig: s.sig || '4',
      cifra: s.cifra || '', letra: s.letra || '', ouvido: s.ouvido || '', notas: s.notas || '', fase: s.fase || '', outro: !!s.outro,
      criado: s.upd || Date.now(), atualizado: s.upd || Date.now(), faixas: fx, versoes: [], origem: 'clan-music-antigo',
    });
    novos++;
  }
  return { novos, jaTinha, faixas, semAudio };
}
