import { $, esc, aviso, quando, debounce } from './util.js';
import { listar, obter, salvar, apagar, novoProjeto, obterMidia } from '../dados/banco.js';
import { exportar, importarArquivo } from '../dados/backup.js';
import { lerCmbk, bancoAntigoExiste, lerBancoAntigo, separar, importar } from '../dados/importar-antigo.js';

const NOTAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// As 10 áreas do plano. "etapa" diz quando cada uma chega; só o que está pronto abre.
export const AREAS = [
  { id: 'gravar', n: 'Gravar voz', d: 'Cantar e cantarolar', etapa: 3 },
  { id: 'compor', n: 'Compositor', d: 'Ideias e versões da letra', etapa: 7 },
  { id: 'analise', n: 'Notas, acordes e BPM', d: 'Descobrir o que você tocou', etapa: 4 },
  { id: 'letras', n: 'Letras e sugestões', d: 'Rimas e caminhos', etapa: 7 },
  { id: 'banda', n: 'Minha Banda IA', d: 'Baixo, bateria, guitarra, violão e teclado', etapa: 6 },
  { id: 'arranjo', n: 'Arranjador', d: 'Estrutura da música', etapa: 6 },
  { id: 'estudio', n: 'Estúdio', d: 'Várias pistas juntas', etapa: 5 },
  { id: 'separar', n: 'Separar instrumentos', d: 'Voz e acompanhamento', etapa: 8 },
  { id: 'mix', n: 'Mixagem e exportar', d: 'Fechar e compartilhar', etapa: 5 },
  { id: 'biblioteca', n: 'Biblioteca', d: 'Seus projetos', etapa: 1 },
];

export async function inicio() {
  const l = await listar();
  return `<header class="topo"><div class="tela"><div class="marca"><i></i>Clan Music Studio</div>
    <p class="mute">Seu estúdio no celular. ${l.length ? `${l.length} projeto${l.length > 1 ? 's' : ''} salvo${l.length > 1 ? 's' : ''} aqui.` : 'Comece criando o primeiro projeto.'}</p>
    <button class="ouro cta" id="novo">Novo projeto</button>
    <p class="mute peq" style="margin-top:10px">Gravar a voz chega na próxima etapa. Por enquanto dá para criar projetos, escrever a letra e guardar tudo no celular.</p></div></header>
  <main class="tela"><h2 style="margin-top:4px">Áreas do estúdio</h2><div class="grade">
  ${AREAS.map((a) => { const pronto = a.etapa <= 1; return `<button class="area" data-area="${a.id}" ${pronto ? '' : 'aria-disabled="true"'}><span class="chip ${pronto ? 'ok' : ''}">${pronto ? 'Pronto' : 'Etapa ' + a.etapa}</span><b>${esc(a.n)}</b><small>${esc(a.d)}</small></button>`; }).join('')}
  </div></main>`;
}

export async function biblioteca() {
  const l = await listar();
  return `<main class="tela"><h1>Biblioteca</h1><p class="mute">Seus projetos, salvos neste celular.</p>
  <div class="linha" style="margin:14px 0"><button class="ouro" id="novo" style="flex:1">Novo projeto</button></div>
  ${l.length ? `<div class="lista">${l.map((p) => `<button class="item" data-abrir="${p.id}"><span class="tom">${esc(p.tom)}${p.modo === 'm' ? 'm' : ''}</span><span class="t"><b>${esc(p.titulo)}</b><small>${p.bpm} BPM · ${quando(p.atualizado)}</small></span></button>`).join('')}</div>`
    : '<div class="vazio"><p><b>Nenhum projeto ainda.</b></p><p>Toque em Novo projeto para começar.</p></div>'}</main>`;
}

export async function projeto(id) {
  const p = await obter(id);
  if (!p) return '<main class="tela"><div class="vazio"><p><b>Não achei esse projeto.</b></p><button id="voltar">Voltar para a biblioteca</button></div></main>';
  return `<main class="tela"><button id="voltar" style="min-height:44px">← Biblioteca</button>
  <label class="campo"><span>Título</span><input id="ti" value="${esc(p.titulo)}" maxlength="80"></label>
  <div class="duas"><label class="campo"><span>Andamento (BPM)</span><input id="bp" type="number" inputmode="numeric" min="40" max="220" value="${p.bpm}"></label>
  <label class="campo"><span>Tom</span><div class="duas"><select id="to">${NOTAS.map((n) => `<option ${n === p.tom ? 'selected' : ''}>${n}</option>`).join('')}</select><select id="mo"><option value="M" ${p.modo !== 'm' ? 'selected' : ''}>Maior</option><option value="m" ${p.modo === 'm' ? 'selected' : ''}>Menor</option></select></div></label></div>
  <label class="campo"><span>Artista</span><input id="ar" value="${esc(p.artista || '')}" maxlength="80"></label>
  <label class="campo"><span>Letra</span><textarea id="le" rows="10" placeholder="Escreva ou cole a letra aqui">${esc(p.letra)}</textarea></label>
  <label class="campo"><span>Cifra</span><textarea id="ci" rows="8" placeholder="Letra com acordes" style="font-family:JBMono,monospace;font-size:14px">${esc(p.cifra || '')}</textarea></label>
  ${p.ouvido ? `<label class="campo"><span>Rascunho (o que foi ouvido ao gravar)</span><textarea id="ou" rows="4">${esc(p.ouvido)}</textarea></label>` : ''}
  ${(p.faixas || []).length ? `<h2>Faixas (${p.faixas.length})</h2><div class="lista">${p.faixas.map((f) => `<div class="item"><span class="t"><b>${esc(f.name || f.nome || 'Faixa')}</b><small>${esc(f.inst || f.tipo || '')}</small><audio data-m="${esc(f.midiaId || '')}" controls preload="none" style="width:100%;margin-top:6px"></audio></span></div>`).join('')}</div>` : ''}
  <label class="campo"><span>Notas</span><textarea id="no" rows="4" placeholder="Ideias, acordes, referências">${esc(p.notas)}</textarea></label>
  <p class="mute peq" id="st">Tudo é salvo sozinho neste celular.</p>
  <div class="linha" style="margin-top:14px"><button class="perigo" id="ap">Apagar projeto</button></div></main>`;
}

export async function ajustes() {
  let uso = '';
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); uso = `${(e.usage / 1048576).toFixed(1)} MB usados de ${(e.quota / 1073741824).toFixed(1)} GB disponíveis.`; } } catch (e) {}
  return `<main class="tela"><h1>Ajustes</h1>
  <h2>Cópia de segurança</h2><p class="mute">Guarda todos os projetos em um arquivo. Restaurar só junta: não apaga nada que já está aqui.</p>
  <div class="lista"><button id="exp">Salvar cópia (Drive, WhatsApp, arquivos)</button><button id="imp">Restaurar de uma cópia</button></div>
  <input type="file" id="arq" hidden>
  <h2>Trazer músicas do Clan music antigo</h2><p class="mute">Copia as suas músicas para cá. O app antigo não é mexido. Por padrão vêm só as suas (autorais); as cifras de outros artistas ficam de fora, a menos que você marque.</p>
  <div class="lista"><button id="aold" hidden>Ler do Clan music deste aparelho</button><button id="aarq">Escolher a cópia do app antigo (.cmbk)</button></div>
  <input type="file" id="aarqi" hidden><div id="aprev"></div>
  <h2>Armazenamento</h2><p class="mute" id="uso">${esc(uso) || 'Sem informação de espaço neste aparelho.'}</p>
  <button id="per">Proteger contra limpeza automática</button>
  <h2>Instalar</h2><p class="mute" id="inst">${window.matchMedia('(display-mode: standalone)').matches ? 'Já está instalado.' : 'No Chrome: menu ⋮ e Instalar app.'}</p>
  <button id="ibt" hidden>Instalar o app</button>
  <h2>Sobre</h2><p class="mute">Clan Music Studio · versão de base (etapa 1). Funciona sem internet.</p></main>`;
}

export function ligar(tela, ctx) {
  const ir = ctx.ir;
  const novo = $('#novo'); if (novo) novo.onclick = async () => { const p = await salvar(novoProjeto()); ir('/projeto/' + p.id); };
  document.querySelectorAll('[data-abrir]').forEach((b) => (b.onclick = () => ir('/projeto/' + b.dataset.abrir)));
  document.querySelectorAll('[data-area]').forEach((b) => (b.onclick = () => {
    const a = AREAS.find((x) => x.id === b.dataset.area);
    if (a.id === 'biblioteca') return ir('/biblioteca');
    aviso(`${a.n} chega na etapa ${a.etapa} da reconstrução.`);
  }));
  const vo = $('#voltar'); if (vo) vo.onclick = () => ir('/biblioteca');
  if (tela === 'projeto') {
    const p = ctx.p; const st = $('#st');
    const gravar = debounce(async () => { p.titulo = $('#ti').value.trim() || 'Sem título'; p.bpm = Math.max(40, Math.min(220, +$('#bp').value || 90)); p.tom = $('#to').value; p.modo = $('#mo').value; p.artista = $('#ar').value.trim(); p.letra = $('#le').value; p.cifra = $('#ci').value; if ($('#ou')) p.ouvido = $('#ou').value; p.notas = $('#no').value; await salvar(p); st.textContent = 'Salvo.'; }, 600);
    ['#ti', '#bp', '#to', '#mo', '#ar', '#le', '#ci', '#ou', '#no'].filter((x) => $(x)).forEach((s) => { const e = $(s); e.oninput = e.onchange = () => { st.textContent = 'Salvando…'; gravar(); }; });
    document.querySelectorAll('audio[data-m]').forEach(async (a) => { const m = a.dataset.m && (await obterMidia(a.dataset.m)); if (m && m.blob) a.src = URL.createObjectURL(m.blob); else a.replaceWith(Object.assign(document.createElement('small'), { textContent: 'Áudio não encontrado.' })); });
    window.addEventListener('pagehide', () => gravar.agora(), { once: true });
    $('#voltar').onclick = async () => { gravar.agora(); setTimeout(() => ir('/biblioteca'), 80); };
    $('#ap').onclick = async () => { if (!confirm('Apagar "' + p.titulo + '"? Isso não dá para desfazer.')) return; await apagar(p.id); aviso('Projeto apagado.'); ir('/biblioteca'); };
  }
  if (tela === 'ajustes') {
    $('#exp').onclick = async () => { try { const r = await exportar(); if (r.via !== 'cancelado') aviso(r.n + ' projeto(s) salvos na cópia.'); } catch (e) { aviso('Não consegui gerar a cópia.'); } };
    $('#imp').onclick = () => $('#arq').click();
    $('#arq').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const r = await importarArquivo(f); aviso(r.novos || r.atualizados ? `${r.novos} novo(s), ${r.atualizados} atualizado(s).` : 'Nada novo na cópia: o app já tem tudo.'); } catch (x) { aviso(x.message); } };
    const prev = (songs) => {
      const { proprias, outros } = separar(songs), na = (l) => l.reduce((n, s) => n + (s.audios || []).filter((a) => a.blob).length, 0), box = $('#aprev');
      if (!songs.length) { box.innerHTML = '<p class="mute">Não achei músicas nessa cópia.</p>'; return; }
      box.innerHTML = `<div class="item" style="flex-direction:column;align-items:stretch;margin-top:10px"><b>${proprias.length} música${proprias.length === 1 ? '' : 's'} ${proprias.length === 1 ? 'autoral' : 'autorais'} (${na(proprias)} faixas de áudio)</b>
        ${outros.length ? `<label class="linha" style="margin-top:8px"><input type="checkbox" id="aout" style="width:24px;min-height:24px"> <span>Incluir também ${outros.length} de outros artistas (${na(outros)} faixas)</span></label>` : ''}
        <button class="ouro" id="aok" style="margin-top:10px">Importar</button></div>`;
      $('#aok').onclick = async () => { const b = $('#aok'); b.disabled = true; b.textContent = 'Importando…'; try { const r = await importar(proprias.concat($('#aout') && $('#aout').checked ? outros : [])); box.innerHTML = `<p><b>${r.novos} música(s) importada(s)</b>, ${r.faixas} faixa(s) de áudio.${r.jaTinha ? ' ' + r.jaTinha + ' já estavam aqui.' : ''}${r.semAudio ? ' ' + r.semAudio + ' faixa(s) sem áudio na cópia.' : ''}</p>`; aviso('Pronto. Veja na Biblioteca.'); } catch (x) { b.disabled = false; b.textContent = 'Importar'; aviso('Não consegui importar.'); } };
    };
    bancoAntigoExiste().then((ex) => { if (ex) { const b = $('#aold'); b.hidden = false; b.onclick = async () => { try { prev(await lerBancoAntigo()); } catch (e) { aviso('Não consegui ler o app antigo.'); } }; } });
    $('#aarq').onclick = () => $('#aarqi').click();
    $('#aarqi').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { prev(await lerCmbk(f)); } catch (x) { aviso('Esse arquivo não é uma cópia do Clan music antigo.'); } };
    $('#per').onclick = async () => { try { const ok = navigator.storage && (await navigator.storage.persist()); aviso(ok ? 'Armazenamento protegido.' : 'O aparelho não permitiu agora.'); } catch (e) { aviso('Não deu para pedir proteção.'); } };
    if (ctx.instalar) { const b = $('#ibt'); b.hidden = false; b.onclick = async () => { ctx.instalar.prompt(); await ctx.instalar.userChoice; ctx.instalar = null; b.hidden = true; }; }
  }
}
