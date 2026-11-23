import { $, aviso } from './util.js';
import { salvar, novoProjeto, adicionarFaixa } from '../dados/banco.js';
import { paraWav } from '../audio/wav.js';
import { gerar, lerAcordes, ESTILOS, INSTR, MIX } from '../banda/gerar.js';

export const LETRA_EXEMPLO = `[Verso 1]
Domingo cedo na estrada de terra
O sol levanta devagar no chão
Levo no peito a canção que me espera
E a saudade bate em meu coração

[Refrão]
Vem, vem, vem cantar comigo
Que a estrada é longa e o dia é bom
Vem, vem, vem que eu sou teu amigo
E a vida é feita de canção

[Verso 2]
O vento passa e conta uma história
De quem partiu e de quem ficou
Cada lembrança é um raio de glória
Que a luz da tarde no céu deixou

[Ponte]
E se a noite vier, deixa vir
Eu acendo a fé e sigo a sorrir`;

// Cria uma música de exemplo já pronta (letra, cifra, banda). Dá para apagar quando quiser.
export async function criarExemplo(aoProgresso = () => {}) {
  const p = novoProjeto('Exemplo — Estrada de Domingo');
  Object.assign(p, { bpm: 76, tom: 'A', modo: 'm', artista: 'Exemplo do app', exemplo: true, letra: LETRA_EXEMPLO, cifra: 'Am  F  C  G', notas: 'Música de exemplo para você ver o app funcionando. Pode mexer à vontade ou apagar.' });
  const prog = 'Am F C G';
  p.arranjo = { estilo: 'reggae', prog, secoes: [{ nome: 'Intro', compassos: 2, energia: 0 }, { nome: 'Verso', compassos: 4, energia: 1 }, { nome: 'Refrão', compassos: 4, energia: 2 }, { nome: 'Final', compassos: 2, energia: 0 }], instr: { bateria: true, baixo: true, violao: true, guitarra: false, teclado: true } };
  await salvar(p);
  const ac = lerAcordes(prog);
  const r = await gerar({ prog: ac.barras, secoes: p.arranjo.secoes.map((s) => ({ ...s, barras: null })), estilo: 'reggae', bpm: p.bpm, instr: p.arranjo.instr }, aoProgresso);
  for (const [k, v] of Object.entries(r.faixas)) await adicionarFaixa(p.id, paraWav(v.buf), { nome: INSTR.find((x) => x[0] === k)[1] + ' (banda ' + ESTILOS.reggae.nome + ')', inst: k, tipo: 'banda', vol: MIX[k].vol, pan: MIX[k].pan });
  return p;
}

// Telas de escolher música sem projetos: em vez de ficar vazio, oferece caminhos.
export function ligarVazio(ctx) {
  const v = document.querySelector('.vazio'); if (!v || v.querySelector('button') || document.querySelector('#ex-criar')) return;
  v.insertAdjacentHTML('beforeend', '<div class="lista" style="margin-top:10px"><button class="ouro" id="ex-criar">Ver uma música de exemplo pronta</button><button id="ex-novo">Criar um projeto em branco</button></div>');
  $('#ex-criar').onclick = async function () { this.disabled = true; this.textContent = 'Montando o exemplo…'; try { const p = await criarExemplo(); ctx.ir('/projeto/' + p.id); } catch (e) { aviso('Não consegui montar o exemplo.'); this.disabled = false; this.textContent = 'Tentar de novo'; } };
  $('#ex-novo').onclick = async () => { const p = await salvar(novoProjeto()); ctx.ir('/projeto/' + p.id); };
}
