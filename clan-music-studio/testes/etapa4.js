// Teste da etapa 4: análise. Uso: node testes/etapa4.js <acordes.wav> <melodia.wav>
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..'), [wc, wm] = process.argv.slice(2);
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(raiz, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8155);
let mal = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) mal++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }); const erros = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => erros.push(e.message));
  await pg.goto('http://localhost:8155/'); await pg.waitForSelector('#novo'); await pg.click('#novo'); await pg.waitForSelector('#gnp');
  await pg.click('#anp'); await pg.waitForTimeout(600);
  ok(/ainda não tem áudio/.test(await pg.textContent('body')) || await pg.locator('#go').count() > 0, 'sem áudio: abre a análise');
  if (await pg.locator('#go').count()) { await pg.click('#go'); await pg.waitForTimeout(800); }
  ok(/não tem áudio/.test(await pg.textContent('#res')), 'projeto vazio: mensagem clara');
  await pg.click('#voltar'); await pg.waitForSelector('#gnp'); await pg.click('#gnp'); await pg.waitForSelector('#imp');
  for (const w of [wc, wm]) { const n = await pg.locator('#faixas .item').count(); const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#imp')]); await fc.setFiles(w); await pg.waitForFunction((n) => document.querySelectorAll('#faixas .item').length === n + 1, n); }
  const url = pg.url(); const id = url.split('/').pop();
  await pg.goto('http://localhost:8155/#/analise/' + id); await pg.waitForSelector('#go'); await pg.click('#go');
  await pg.waitForSelector('#ap1', { timeout: 60000 });
  const t = await pg.textContent('#res'); console.log(t.replace(/\s+/g, ' ').slice(0, 400));
  const bp = +(t.match(/(\d+) BPM/) || [])[1]; ok(bp >= 115 && bp <= 125 || (bp >= 57 && bp <= 63), 'BPM ~120: ' + bp);
  ok(/TomC/.test(t.replace(/\s/g,'')), 'tom C');
  const ac = await pg.evaluate(() => [...document.querySelectorAll('.notas')][0].textContent); console.log('acordes:', ac);
  ok(['C', 'Am', 'F', 'G'].every((x) => new RegExp('(^|[^A-Za-z#])' + x + '(?![a-z#])').test(ac) || ac.includes(x)), 'acordes C Am F G presentes');
  await pg.click('#bm'); ok(/60 BPM/.test(await pg.textContent('#bv')), 'botão ÷2 corrige andamento dobrado: ' + await pg.textContent('#bv')); await pg.click('#bd'); ok(/120 BPM/.test(await pg.textContent('#bv')), 'botão ×2 volta'); await pg.click('#bm');
  await pg.click('#ap1'); await pg.waitForTimeout(400); await pg.click('#ap2'); await pg.waitForTimeout(400); if (await pg.locator('#ap3:not([disabled])').count()) { await pg.click('#ap3'); await pg.waitForTimeout(400); }
  await pg.goto('http://localhost:8155/#/projeto/' + id); await pg.waitForSelector('#gnp');
  const p = await pg.evaluate(async (id) => { const db = await new Promise((r) => { const q = indexedDB.open('clan-music-studio'); q.onsuccess = () => r(q.result); }); return new Promise((r) => { const q = db.transaction('projetos').objectStore('projetos').get(id); q.onsuccess = () => r(q.result); }); }, id);
  ok(p.bpm >= 57 && p.tom, 'andamento e tom gravados no projeto: ' + p.bpm + ' ' + p.tom + ' ' + p.modo);
  ok(/Acordes sugeridos/.test(p.cifra || ''), 'acordes na cifra'); ok((p.faixas || []).length === 2, 'faixas intactas'); ok(!!p.analise, 'análise guardada no projeto');
  // fallback sem Worker
  const pg2 = await ctx.newPage(); await pg2.addInitScript(() => { delete window.Worker; }); pg2.on('pageerror', (e) => erros.push(e.message));
  await pg2.goto('http://localhost:8155/#/analise/' + id); await pg2.waitForSelector('#de', { timeout: 10000 }); await pg2.click('#de'); await pg2.waitForSelector('#ap1', { timeout: 60000 }); ok(/BPM/.test(await pg2.textContent('#res')), 'funciona sem Worker (alternativa)');
  ok(erros.length === 0, 'sem erros de JS ' + erros.join('|'));
  await b.close(); srv.close(); console.log(mal ? mal + ' FALHA(S)' : 'TUDO OK'); process.exit(mal ? 1 : 0);
})();
