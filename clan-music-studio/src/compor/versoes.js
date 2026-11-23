// Histórico da letra. A letra original nunca é perdida: a primeira vez que o compositor abre um projeto, ela é guardada como "Original".
// Nenhuma versão é apagada. Restaurar ou desfazer sempre guarda antes o que estava na tela.
import { obter, salvar } from '../dados/banco.js';

const id = () => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const historico = (p) => p.historicoLetra || [];
const mesmo = (a, b) => String(a || '').replace(/\s+$/g, '') === String(b || '').replace(/\s+$/g, '');

// Garante o "Original" e registra edições manuais feitas fora do compositor. Devolve o projeto atualizado.
export async function preparar(projetoId) {
  const p = await obter(projetoId); if (!p) return null; const h = (p.historicoLetra = p.historicoLetra || []); let mudou = false;
  if (!h.some((v) => v.origem === 'original')) { h.push({ id: id(), em: Date.now(), origem: 'original', rotulo: 'Original', texto: p.letra || '' }); mudou = true; }
  else if (!mesmo(h[h.length - 1].texto, p.letra)) { h.push({ id: id(), em: Date.now(), origem: 'manual', rotulo: 'Edição sua (fora do compositor)', texto: p.letra || '' }); mudou = true; }
  if (mudou) await salvar(p); return p;
}
// Guarda o estado atual (se ainda não está no histórico) e troca a letra. Nada se perde.
export async function aplicar(projetoId, novoTexto, rotulo, origem = 'compositor') {
  const p = await preparar(projetoId); if (!p) throw new Error('Projeto não encontrado.');
  const h = p.historicoLetra; p.letra = novoTexto; h.push({ id: id(), em: Date.now(), origem, rotulo, texto: novoTexto }); await salvar(p); return p;
}
export const anexar = (atual, bloco) => (String(atual || '').replace(/\s+$/g, '') ? String(atual).replace(/\s+$/g, '') + '\n\n' : '') + bloco.trim() + '\n';
export async function adicionarAoFim(projetoId, bloco, rotulo) { const p = await preparar(projetoId); return aplicar(projetoId, anexar(p.letra, bloco), rotulo); }
// Volta para uma versão (a do histórico ou uma guardada ao restaurar backup). O que estava na tela vira uma versão nova.
export async function restaurar(projetoId, versaoId) {
  const p = await preparar(projetoId); if (!p) throw new Error('Projeto não encontrado.');
  const v = todas(p).find((x) => x.id === versaoId); if (!v) throw new Error('Versão não encontrada.');
  return aplicar(projetoId, v.texto, 'Voltou para: ' + v.rotulo, 'restaurar');
}
// Desfazer: volta ao texto da versão anterior à última (ou ao Original se só houver uma alteração)
export async function desfazer(projetoId) {
  const p = await preparar(projetoId); if (!p) throw new Error('Projeto não encontrado.');
  const h = p.historicoLetra; let i = h.length - 2; while (i >= 0 && mesmo(h[i].texto, p.letra)) i--;
  if (i < 0) return { p, feito: false };
  const alvo = h[i]; const q = await aplicar(projetoId, alvo.texto, 'Desfez para: ' + alvo.rotulo, 'restaurar'); return { p: q, feito: true, para: alvo };
}
// histórico do compositor + cópias guardadas pelo restaurar do backup (campo "versoes" do app)
export function todas(p) {
  const bk = (p.versoes || []).filter((v) => typeof v.letra === 'string').map((v, i) => ({ id: 'b' + i, em: v.em || 0, origem: 'backup', rotulo: 'Cópia guardada ' + (v.de || 'antes de restaurar'), texto: v.letra }));
  return [...historico(p), ...bk].sort((a, b) => b.em - a.em);
}
