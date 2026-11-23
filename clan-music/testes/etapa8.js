// Teste da etapa 8 + app completo: separar, exemplo, início, novidades, letra ao vivo. Uso: node testes/etapa8.js
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const raiz = path.join(__dirname, '..');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(raiz, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8158);
let mal = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) mal++; };
// WAV estéreo sintético: voz 440 no centro, 330 só à esquerda, 523 só à direita, baixo 80 no centro
function wav() { const sr = 22050, n = sr * 6, b = Buffer.alloc(44 + n * 4); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { const t = i / sr, v = 0.3 * Math.sin(2 * Math.PI * 440 * t), l = 0.25 * Math.sin(2 * Math.PI * 330 * t), r = 0.25 * Math.sin(2 * Math.PI * 523 * t), ba = 0.3 * Math.sin(2 * Math.PI * 80 * t); b.writeInt16LE(Math.round((v + l + ba) * 32767), 44 + i * 4); b.writeInt16LE(Math.round((v + r + ba) * 32767), 46 + i * 4); }
  const f = path.join(os.tmpdir(), 'st8.wav'); fs.writeFileSync(f, b); return f; }
(async () => {
  const b = await chromium.launch(); const erros = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addInitScript(() => {
    window.SpeechRecognition = class { constructor() { setTimeout(() => {}, 0); } start() { setTimeout(() => { this.onresult && this.onresult({ resultIndex: 0, results: Object.assign([Object.assign([{ transcript: 'domingo cedo na estrada' }], { isFinal: true })], {}) }); }, 300); } stop() { this.onend && this.onend(); } };
  });
  const pg = await ctx.newPage(); pg.on('pageerror', (e) => erros.push(e.message));
  await pg.goto('http://localhost:8158/'); await pg.waitForSelector('#ex-criar');
  ok(/Comece por aqui/.test(await pg.textContent('main')), 'início vazio mostra "Comece por aqui"');
  ok((await pg.locator('.area').count()) === 10, '10 áreas no início');
  await pg.click('#ex-criar'); await pg.waitForURL(/#\/projeto\//, { timeout: 120000 }); const id = pg.url().split('/').pop();
  ok(/Estrada de Domingo/.test(await pg.inputValue('#ti')), 'exemplo criado com título');
  ok(/\[Refrão\]/.test(await pg.inputValue('#le')) && (await pg.inputValue('#ci')).includes('Am'), 'exemplo tem letra e cifra');
  ok((await pg.locator('audio[data-m]').count()) >= 4, 'exemplo tem faixas de banda: ' + (await pg.locator('audio[data-m]').count()));
  // áreas abrem direto com a música
  await pg.goto('http://localhost:8158/#/inicio'); await pg.waitForSelector('.area');
  await pg.click('[data-area=letras]'); await pg.waitForSelector('[data-cp]'); await pg.click('[data-cp]'); await pg.waitForSelector('[data-ab=rimas][aria-pressed=true]'); ok(true, 'Letras e sugestões abre na aba Rimas');
  await pg.goto('http://localhost:8158/#/inicio'); await pg.click('[data-area=arranjo]'); await pg.click('[data-cp]'); await pg.waitForSelector('[data-ab=estrutura][aria-pressed=true]'); ok(true, 'Arranjador abre na aba Estrutura');
  // separar
  await pg.goto('http://localhost:8158/#/inicio'); await pg.click('[data-area=separar]'); await pg.waitForSelector('[data-sp]'); await pg.click('[data-sp]'); await pg.waitForSelector('#go');
  await pg.goto('http://localhost:8158/#/projeto/' + id); await pg.click('#gnp'); await pg.waitForSelector('#imp'); const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#imp')]); await fc.setFiles(wav()); await pg.waitForFunction(() => /st8/i.test(document.body.innerText), null, { timeout: 30000 });
  await pg.goto('http://localhost:8158/#/separar/' + id); await pg.waitForSelector('#go');
  const val = await pg.evaluate(() => { const o = [...document.querySelectorAll('#fa option')].find((x) => /st8/i.test(x.textContent)); return o ? o.value : null; }); ok(!!val, 'faixa importada aparece na lista'); await pg.selectOption('#fa', val);
  await pg.check('#o-a'); await pg.click('#go'); await pg.waitForSelector('#ve', { timeout: 120000 });
  const dados = await pg.evaluate(async (id) => { const db = await new Promise((r) => { const q = indexedDB.open('clan-music-studio'); q.onsuccess = () => r(q.result); }); const get = (s, k) => new Promise((r) => { const q = db.transaction(s).objectStore(s).get(k); q.onsuccess = () => r(q.result); }); const p = await get('projetos', id); const sep = p.faixas.filter((f) => f.tipo === 'separada'); const out = {}; for (const f of sep) { const m = await get('midias', f.midiaId); const buf = await new AudioContext().decodeAudioData(await m.blob.arrayBuffer()); const rms = (d, fr, sr) => { let re = 0, im = 0; const N = Math.min(d.length, sr * 3); for (let i = 0; i < N; i++) { const a = 2 * Math.PI * fr * i / sr; re += d[i] * Math.cos(a); im += d[i] * Math.sin(a); } return 2 * Math.hypot(re, im) / N; }; const d = buf.getChannelData(0), sr = buf.sampleRate; out[f.nome] = { 440: rms(d, 440, sr), 330: rms(d, 330, sr), 80: rms(d, 80, sr), n: buf.numberOfChannels }; } return { n: sep.length, out, orig: p.faixas.filter((f) => f.tipo !== 'separada' && f.tipo !== 'banda').length }; }, id);
  ok(dados.n >= 4, 'separação criou faixas novas: ' + dados.n); ok(dados.orig >= 1, 'faixa original continua');
  const sem = Object.entries(dados.out).find(([k]) => /acompanhamento/.test(k)); const cen = Object.entries(dados.out).find(([k]) => /centro \(voz/.test(k)); const gr = Object.entries(dados.out).find(([k]) => /graves/.test(k));
  ok(sem && sem[1][440] < 0.3 * 0.1, 'sem a voz: 440 Hz caiu mais de 20 dB (' + (sem && (20 * Math.log10(sem[1][440] / 0.3)).toFixed(1)) + ' dB)'); ok(sem && sem[1][330] > 0.1, 'sem a voz: instrumento do lado continua');
  ok(gr && gr[1][80] > 0.2 && gr[1][330] < 0.03, 'graves mantém baixo e corta o resto');
  // novidades e ajustes
  await pg.goto('http://localhost:8158/#/novidades'); await pg.waitForSelector('h1'); ok(/Minha Banda IA/.test(await pg.textContent('main')) && /ainda não tem/.test(await pg.textContent('main')), 'tela "O que mudou" com limites honestos');
  // letra ao vivo (web, simulada)
  await pg.goto('http://localhost:8158/#/projeto/' + id); await pg.click('#gnp'); await pg.waitForSelector('#leg-on'); ok(await pg.isChecked('#leg-on'), 'opção de letra ao vivo ligada');
  // biblioteca vazia ganha exemplo? (projetos existem, então só confere sem erros)
  ok(erros.length === 0, 'sem erros de página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close(); srv.close(); console.log(mal ? mal + ' FALHA(S)' : 'TUDO OK'); process.exit(mal ? 1 : 0);
})();
