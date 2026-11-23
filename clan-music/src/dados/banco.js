// Projetos salvos no próprio celular (IndexedDB). Nada sai do aparelho.
const NOME = 'clan-music-studio', VERSAO = 2;
let abrindo = null;

function abrir() {
  if (abrindo) return abrindo;
  abrindo = new Promise((ok, erro) => {
    const r = indexedDB.open(NOME, VERSAO);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('projetos')) d.createObjectStore('projetos', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('midias')) d.createObjectStore('midias', { keyPath: 'id' }); // áudios dos projetos
      if (!d.objectStoreNames.contains('rascunhos')) d.createObjectStore('rascunhos', { keyPath: 'id' }); // pedaços de gravações em andamento (salvamento automático)
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { abrindo = null; erro(r.error); };
  });
  return abrindo;
}
const pedido = (r) => new Promise((ok, erro) => { r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });
async function loja(nome, modo = 'readonly') { return (await abrir()).transaction(nome, modo).objectStore(nome); }

export const novoId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function novoProjeto(titulo = '') {
  const t = Date.now();
  return { id: novoId(), titulo: titulo.trim() || 'Sem título', criado: t, atualizado: t, bpm: 90, tom: 'C', modo: 'M', artista: '', cifra: '', ouvido: '', letra: '', notas: '', faixas: [], versoes: [] };
}
export async function listar() {
  const l = await pedido((await loja('projetos')).getAll());
  return l.sort((a, b) => b.atualizado - a.atualizado);
}
export async function obter(id) { return pedido((await loja('projetos')).get(id)); }
export async function salvar(p) { p.atualizado = Date.now(); await pedido((await loja('projetos', 'readwrite')).put(p)); return p; }
export async function gravarBruto(p) { await pedido((await loja('projetos', 'readwrite')).put(p)); return p; }
export async function salvarMidia(m) { await pedido((await loja('midias', 'readwrite')).put(m)); return m; }
export async function obterMidia(id) { return pedido((await loja('midias')).get(id)); }
export async function apagar(id) {
  const p = await obter(id);
  if (p) for (const f of p.faixas || []) if (f.midiaId) await pedido((await loja('midias', 'readwrite')).delete(f.midiaId));
  await pedido((await loja('projetos', 'readwrite')).delete(id));
}
export async function contar() { return pedido((await loja('projetos')).count()); }

// ---- gravações em andamento: cada pedaço (1 s) é salvo na hora, para não perder nada se o app fechar
export async function salvarPedaco(rid, n, blob, meta) { await pedido((await loja('rascunhos', 'readwrite')).put({ id: rid + ':' + String(n).padStart(6, '0'), rid, n, blob, ...meta })); }
export async function pedacosPendentes() {
  const todos = await pedido((await loja('rascunhos')).getAll()), g = new Map();
  for (const x of todos) { if (!g.has(x.rid)) g.set(x.rid, []); g.get(x.rid).push(x); }
  return [...g.entries()].map(([rid, l]) => { l.sort((a, b) => a.n - b.n); return { rid, pedacos: l, projetoId: l[0].projetoId, inst: l[0].inst, mime: l[0].mime, em: l[0].em }; });
}
export async function apagarRascunho(rid) {
  const l = await pedido((await loja('rascunhos')).getAll());
  const st = await loja('rascunhos', 'readwrite');
  for (const x of l) if (x.rid === rid) await pedido(st.delete(x.id));
}
export async function adicionarFaixa(projetoId, blob, extra = {}) {
  const p = await obter(projetoId); if (!p) throw new Error('Projeto não encontrado.');
  const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), midiaId = 'm-' + id;
  await salvarMidia({ id: midiaId, blob, mime: blob.type });
  const f = { id, nome: 'Faixa', inst: 'voz', tipo: 'gravacao', vol: 1, mute: false, off: 0, ...extra, midiaId, mime: blob.type, criado: Date.now() };
  p.faixas = [...(p.faixas || []), f]; await salvar(p); return f;
}
export async function removerFaixa(projetoId, faixaId) {
  const p = await obter(projetoId); if (!p) return;
  const f = (p.faixas || []).find((x) => x.id === faixaId); if (!f) return;
  if (f.midiaId) await pedido((await loja('midias', 'readwrite')).delete(f.midiaId));
  p.faixas = p.faixas.filter((x) => x.id !== faixaId); await salvar(p);
}
