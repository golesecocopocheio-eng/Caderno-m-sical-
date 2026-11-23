// Projetos salvos no próprio celular (IndexedDB). Nada sai do aparelho.
const NOME = 'clan-music-studio', VERSAO = 1;
let abrindo = null;

function abrir() {
  if (abrindo) return abrindo;
  abrindo = new Promise((ok, erro) => {
    const r = indexedDB.open(NOME, VERSAO);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('projetos')) d.createObjectStore('projetos', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('midias')) d.createObjectStore('midias', { keyPath: 'id' }); // áudios (etapa 3 em diante)
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
  return { id: novoId(), titulo: titulo.trim() || 'Sem título', criado: t, atualizado: t, bpm: 90, tom: 'C', modo: 'M', letra: '', notas: '', faixas: [], versoes: [] };
}
export async function listar() {
  const l = await pedido((await loja('projetos')).getAll());
  return l.sort((a, b) => b.atualizado - a.atualizado);
}
export async function obter(id) { return pedido((await loja('projetos')).get(id)); }
export async function salvar(p) { p.atualizado = Date.now(); await pedido((await loja('projetos', 'readwrite')).put(p)); return p; }
export async function gravarBruto(p) { await pedido((await loja('projetos', 'readwrite')).put(p)); return p; }
export async function apagar(id) { await pedido((await loja('projetos', 'readwrite')).delete(id)); }
export async function contar() { return pedido((await loja('projetos')).count()); }
