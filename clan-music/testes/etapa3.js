// Teste da etapa 3: gravação. Uso: node testes/etapa3.js <audio.wav>
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..'), wav = process.argv[2];
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(raiz, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8154);
let mal = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) mal++; };
const dur = (pg) => pg.evaluate(async () => { const a = document.querySelector('#faixas audio'); await new Promise((r) => { a.preload = 'auto'; a.onloadedmetadata = r; setTimeout(r, 4000); a.load(); }); return a.duration; });
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }); const erros = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => erros.push(e.message));
  await pg.goto('http://localhost:8154/'); await pg.waitForSelector('#cantar');
  await pg.click('#cantar'); await pg.click('#ideia'); await pg.waitForSelector('#rec');
  await pg.waitForTimeout(1500); ok(await pg.evaluate(() => !document.querySelector('#rec').classList.contains('on')) && /0:00/.test(await pg.textContent('#tempo')), 'abre pronta mas NÃO grava sozinha');
  await pg.click('#rec'); await pg.waitForFunction(() => document.querySelector('#rec').classList.contains('on')); await pg.waitForTimeout(2600);
  ok(/0:0[2-4]/.test(await pg.textContent('#tempo')), 'temporizador anda: ' + await pg.textContent('#tempo'));
  ok(await pg.evaluate(() => { const c = document.querySelector('#onda'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n > 200; }), 'forma de onda ao vivo desenhada');
  await pg.waitForFunction(() => parseFloat(document.querySelector('#nv').style.width) > 0, null, { timeout: 4000 }); ok(true, 'indicador de volume mexe');
  await pg.click('#pau'); const t1 = await pg.textContent('#tempo'); await pg.waitForTimeout(1200); ok(t1 === await pg.textContent('#tempo') && /Continuar/.test(await pg.textContent('#pau')), 'pausar para o relógio'); await pg.click('#pau'); await pg.waitForTimeout(1200);
  await pg.click('#rec'); await pg.waitForSelector('#faixas audio', { timeout: 10000 });
  const d1 = await dur(pg); ok(d1 > 3 && d1 < 12, 'gravação salva como faixa tocável (' + d1.toFixed(1) + 's)');
  ok(await pg.evaluate(async () => { const db = await new Promise((r) => { const q = indexedDB.open('clan-music-studio'); q.onsuccess = () => r(q.result); }); const n = await new Promise((r) => { const q = db.transaction('rascunhos').objectStore('rascunhos').count(); q.onsuccess = () => r(q.result); }); return n === 0; }), 'rascunho temporário limpo depois de salvar');
  // modos
  await pg.click('[data-modo=cantarolar]'); await pg.click('#rec'); await pg.waitForTimeout(1800); await pg.click('#rec'); await pg.waitForFunction(() => document.querySelectorAll('#faixas .item').length === 2);
  ok(/Cantarolar 1/.test(await pg.textContent('#faixas')), 'modo cantarolar nomeia a faixa');
  // importar
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#imp')]); await fc.setFiles(wav); await pg.waitForFunction(() => document.querySelectorAll('#faixas .item').length === 3);
  ok(true, 'importar áudio existente');
  // cortar: original mantida
  await pg.click('[data-cortar]'); await pg.waitForSelector('#sv'); await pg.evaluate(() => { const c0 = document.querySelector('#c0'), c1 = document.querySelector('#c1'); c0.value = 1; c0.dispatchEvent(new Event('input')); c1.value = 2.5; c1.dispatchEvent(new Event('input')); });
  await pg.click('#sv'); await pg.waitForFunction(() => document.querySelectorAll('#faixas .item').length === 4);
  const txt = await pg.textContent('#faixas'); ok(/\(corte\)/.test(txt) && (await pg.locator('#faixas .item').count()) === 4, 'corte cria faixa nova e mantém a original');
  const dc = await pg.evaluate(async () => { const a = [...document.querySelectorAll('#faixas audio')].find((x) => true); const els = [...document.querySelectorAll('#faixas .item')]; const it = els.find((e) => /corte/.test(e.textContent)); const au = it.querySelector('audio'); await new Promise((r) => { au.preload = 'auto'; au.onloadedmetadata = r; setTimeout(r, 4000); au.load(); }); return au.duration; });
  ok(dc > 1.3 && dc < 1.7, 'corte tem a duração escolhida (' + dc.toFixed(2) + 's)');
  // apagar pede confirmação
  pg.once('dialog', (d) => d.dismiss()); await pg.click('[data-apagar]'); ok((await pg.locator('#faixas .item').count()) === 4, 'apagar pede confirmação (cancelar mantém)');
  // interrupção: fechar no meio da gravação e recuperar
  await pg.click('#voltar'); await pg.waitForSelector('#gnp'); await pg.click('#gnp'); await pg.waitForSelector('#rec'); await pg.click('#rec'); await pg.waitForTimeout(3300);
  await pg.reload(); await pg.waitForSelector('#rec'); await pg.waitForSelector('[data-rec]', { timeout: 8000 }); ok(true, 'app fechado no meio: aparece "Gravação interrompida"');
  await pg.click('[data-rec]'); await pg.waitForSelector('#gnp'); await pg.click('#gnp'); await pg.waitForSelector('#faixas .item');
  ok(/Gravação recuperada/.test(await pg.textContent('#faixas')), 'gravação interrompida recuperada'); const dr = await pg.evaluate(async () => { const it = [...document.querySelectorAll('#faixas .item')].find((e) => /recuperada/.test(e.textContent)); const au = it.querySelector('audio'); await new Promise((r) => { au.preload = 'auto'; au.onloadedmetadata = r; setTimeout(r, 4000); au.load(); }); return au.duration; }); ok(dr >= 2, 'a recuperada tem o que foi gravado (' + dr.toFixed(1) + 's)');
  // sair no meio da gravação salva
  await pg.click('#rec'); await pg.waitForTimeout(2200); await pg.evaluate(() => { location.hash = '#/biblioteca'; }); await pg.waitForSelector('.item'); await pg.waitForTimeout(800);
  await pg.click('.item'); await pg.waitForSelector('#gnp'); await pg.click('#gnp'); await pg.waitForSelector('#faixas .item'); const nf = await pg.locator('#faixas .item').count(); ok(nf === 6, 'trocar de tela gravando salva o que já foi gravado (' + nf + ' faixas)');
  // permissão negada
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 } }); const p2 = await c2.newPage(); await p2.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })); });
  await p2.goto('http://localhost:8154/#/gravar'); await p2.waitForSelector('#ideia'); await p2.click('#ideia'); await p2.waitForSelector('#rec'); await p2.click('#rec'); await p2.waitForFunction(() => /bloqueado/.test(document.querySelector('#msg').textContent));
  ok(await p2.evaluate(() => !document.querySelector('#rec').classList.contains('on')), 'microfone negado: explica como liberar e não trava');
  ok(erros.length === 0, 'sem erros ' + erros.join('|'));
  console.log(mal ? 'FALHAS' : 'TUDO OK'); await b.close(); srv.close(); process.exit(mal ? 1 : 0);
})();
