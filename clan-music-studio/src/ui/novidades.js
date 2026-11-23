const LINHAS = [
  ['Gravar a voz', 'Gravava e escrevia a letra ao vivo.', 'Grava com salvamento a cada trecho (se o celular fechar, a gravação volta), cantarolar, importar áudio, cortar sem perder o original e escrever a letra enquanto você canta.'],
  ['Descobrir BPM, tom e acordes', 'Você digitava.', 'Analisa o áudio e mostra BPM, tom, acordes e a melodia. Tem botões ÷2 e ×2 para quando o BPM sair dobrado ou pela metade.'],
  ['Minha Banda IA', 'Não tinha.', 'Bateria, baixo, violão, guitarra e teclado tocam os seus acordes em 7 estilos (reggae roots, afrobeat, samba, MPB, pop, balada, rock). Cada instrumento vira uma faixa.'],
  ['Compositor', 'Não tinha.', 'Cria e continua letras, sugere rimas, refrão, ponte, intro e final, propõe acordes e organiza a estrutura. Guarda a letra original e todas as versões, com desfazer.'],
  ['Estúdio', 'Mixer simples.', 'Várias faixas juntas com volume, lado, solo, mudo, ajuste de tempo de cada uma e exportação em WAV.'],
  ['Separar instrumentos', 'Não tinha.', 'Tira a voz do meio, isola graves, agudos, batida e harmonia. Sem internet.'],
  ['Funcionar sem internet', 'Dependia de internet para algumas coisas.', 'Tudo roda no próprio celular. Só a letra ao vivo pode pedir internet, porque usa o reconhecimento de voz do Android.'],
  ['Segurança dos dados', 'Dados no app antigo.', 'Copia suas músicas do app antigo sem mexer nele, cópia de segurança que só junta (nunca apaga) e proteção contra limpeza do celular.'],
];
const FALTA = [
  'Link direto para o Cifra Club e compartilhar no BandLab (estavam no app antigo).',
  'Transcrição por Groq (precisava de configuração sua; não vamos depender de serviço pago).',
  'Os instrumentos da banda são sintetizados: soam eletrônicos, não como gravados.',
  'O Compositor segue regras e um vocabulário próprio. Não é uma IA que escreve como gente; as sugestões são ponto de partida.',
  'Ainda não foi testado por mim em um celular de verdade. O seu teste é o que vale.',
];
export async function tela() {
  return `<main class="tela"><button id="voltar" style="min-height:44px">← Início</button><h1>O que mudou</h1>
  <p class="mute">O Clan Music antigo continua instalado e intacto. Este é um app novo, ao lado dele.</p>
  <div class="lista">${LINHAS.map(([t, a, n]) => `<div class="card"><b>${t}</b><p class="mute peq">Antes: ${a}</p><p>Agora: ${n}</p></div>`).join('')}</div>
  <h2>O que ainda não tem ou é limitado</h2><div class="card"><ul style="margin:0;padding-left:18px">${FALTA.map((x) => `<li>${x}</li>`).join('')}</ul></div>
  <h2>Trazer as músicas do app antigo</h2><p class="mute">Em Ajustes › Trazer músicas do Clan music antigo.</p><button class="ouro" id="aj">Ir para Ajustes</button></main>`;
}
export function ligar(ctx) { document.getElementById('voltar').onclick = () => ctx.ir('/inicio'); document.getElementById('aj').onclick = () => ctx.ir('/ajustes'); }
