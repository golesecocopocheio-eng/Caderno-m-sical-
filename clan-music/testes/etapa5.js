// Teste da etapa 5: estúdio multipistas e exportação. Uso: node testes/etapa5.js <acordes.wav> <melodia.wav>
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..'), [wc, wm] = process.argv.slice(2);
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(raiz, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8156);
let mal = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) mal++; };
const wavInfo = (f) => { const b = fs.readFileSync(f); const n = b.readUInt32LE(40), ch = b.readUInt16LE(22), sr = b.readUInt32LE(24); let pico = 0; for (let o = 44; o + 1 < b.length; o += 2) pico = Math.max(pico, Math.abs(b.readInt16LE(o))); return { riff: b.toString('ascii', 0, 4), ch, sr, dur: n / (ch * 2 * sr), pico: pico / 32768 }; };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const erros = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => erros.push(e.message));
  await pg.goto('http://localhost:8156/'); await pg.waitForSelector('#novo'); await pg.click('#novo'); await pg.waitForSelector('#gnp'); await pg.click('#esp');
  await pg.waitForSelector('#gr'); ok(true, 'projeto sem áudio: convida a gravar'); await pg.click('#voltar'); await pg.waitForSelector('#gnp'); await pg.click('#gnp'); await pg.waitForSelector('#imp');
  for (const w of [wc, wm]) { const n = await pg.locator('#faixas .item').count(); const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#imp')]); await fc.setFiles(w); await pg.waitForFunction((n) => document.querySelectorAll('#faixas .item').length === n + 1, n); }
  const id = pg.url().split('/').pop(); await pg.goto('http://localhost:8156/#/estudio/' + id); await pg.waitForSelector('#pl');
  ok((await pg.locator('#tr [data-f]').count()) === 2, 'estúdio mostra as 2 faixas');
  await pg.click('#pl'); await pg.waitForTimeout(2200); const t1 = await pg.textContent('#tp'); ok(/0:0[1-3] \//.test(t1), 'tocar: relógio anda (' + t1 + ')');
  await pg.click('#pl'); const t2 = await pg.textContent('#tp'); await pg.waitForTimeout(800); ok(t2 === await pg.textContent('#tp'), 'pausar para o relógio');
  await pg.evaluate(() => { const s = document.querySelector('#sk'); s.value = 500; s.dispatchEvent(new Event('input')); }); await pg.waitForTimeout(200); ok(!/^0:00/.test(await pg.textContent('#tp')), 'buscar muda a posição: ' + await pg.textContent('#tp'));
  await pg.click('#pa'); ok(/^0:00/.test(await pg.textContent('#tp')), 'voltar ao início');
  // exportar mix completa (sem normalizar) e com solo
  await pg.uncheck('#nm'); await pg.evaluate(() => { const o = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { console.log('ANCHOR', this.download); return o.call(this); }; }); pg.on('console', (m) => /ANCHOR/.test(m.text()) && console.log(m.text()));
  const exp = async () => { const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click('#ex')]); const f = '/tmp/t/mix_' + Math.random().toString(36).slice(2) + '.wav'; await d.saveAs(f); return { f, nome: d.suggestedFilename() }; };
  const a = await exp(); console.log('nome', a.nome); const ia = wavInfo(a.f); ok(ia.riff === 'RIFF' && ia.ch === 2 && ia.sr === 44100 && ia.dur > 3, `WAV válido estéreo 44,1k, ${ia.dur.toFixed(1)}s, pico ${ia.pico.toFixed(2)} (${a.nome})`);
  await pg.waitForFunction(() => !document.querySelector('#ex').disabled);
  // mudo em uma faixa => pico muda; solo
  await pg.click('#tr [data-f]:nth-child(1) [data-m]'); await pg.click('#tr [data-f]:nth-child(2) [data-m]'); await pg.click('#ex'); await pg.waitForTimeout(1500); ok(/silenciadas/.test(await pg.textContent('#aviso')), 'tudo mudo: avisa em vez de exportar vazio');
  await pg.click('#tr [data-f]:nth-child(2) [data-m]'); const b2 = await exp(); const ib = wavInfo(b2.f); ok(ib.pico > 0.01 && Math.abs(ib.pico - ia.pico) > 0.01, `mutar uma faixa muda a mixagem (pico ${ia.pico.toFixed(2)} → ${ib.pico.toFixed(2)})`);
  await pg.waitForFunction(() => !document.querySelector('#ex').disabled);
  // atraso de 1 s aumenta duração
  await pg.click('#tr [data-f]:nth-child(1) [data-m]'); for (let i = 0; i < 10; i++) await pg.click('#tr [data-f]:nth-child(1) [data-o="100"]');
  ok(/\+1,0 s/.test(await pg.textContent('#tr [data-f]:nth-child(1) [data-ov]')), 'ajuste de posição +1,0 s');
  const c = await exp(); const ic = wavInfo(c.f); ok(ic.dur > ia.dur + 0.8, `faixa atrasada alonga a mixagem (${ia.dur.toFixed(1)}s → ${ic.dur.toFixed(1)}s)`);
  await pg.waitForFunction(() => !document.querySelector('#ex').disabled);
  // normalizar
  await pg.check('#nm'); const d2 = await exp(); const id2 = wavInfo(d2.f); ok(id2.pico > 0.85 && id2.pico < 0.93, 'normalizar leva o pico a ~0,89: ' + id2.pico.toFixed(2));
  // salvou no projeto
  await pg.waitForTimeout(700); await pg.goto('http://localhost:8156/#/estudio/' + id); await pg.waitForSelector('#pl'); ok(/\+1,0 s/.test(await pg.textContent('#tr [data-f]:nth-child(1) [data-ov]')), 'ajustes ficam salvos no projeto');
  const p = await pg.evaluate(async (id) => { const db = await new Promise((r) => { const q = indexedDB.open('clan-music-studio'); q.onsuccess = () => r(q.result); }); return new Promise((r) => { const q = db.transaction('projetos').objectStore('projetos').get(id); q.onsuccess = () => r(q.result); }); }, id);
  ok(p.faixas.length === 2 && p.faixas.every((f) => f.midiaId), 'faixas e áudios originais intactos');
  ok(erros.length === 0, 'sem erros de JS ' + erros.join('|'));
  await b.close(); srv.close(); console.log(mal ? mal + ' FALHA(S)' : 'TUDO OK'); process.exit(mal ? 1 : 0);
})();
