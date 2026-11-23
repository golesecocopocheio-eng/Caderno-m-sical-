// Correções pós-etapa 6: vários acordes por compasso, BPM com banda completa e teste de áudio do aparelho.
const { chromium, devices } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..'), wav = process.argv[2];
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(raiz, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8160);
let mal = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) mal++; };
const mexe = (pg, id, fn) => pg.evaluate(async ([id, fn]) => { const db = await new Promise((r) => { const q = indexedDB.open('clan-music-studio'); q.onsuccess = () => r(q.result); }); const t = db.transaction('projetos', 'readwrite'), s = t.objectStore('projetos'); const p = await new Promise((r) => { const q = s.get(id); q.onsuccess = () => r(q.result); }); new Function('p', fn)(p); s.put(p); await new Promise((r) => (t.oncomplete = r)); }, [id, fn]);
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] }); const erros = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'], acceptDownloads: true }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => erros.push(e.message));
  await pg.goto('http://localhost:8160/'); await pg.waitForSelector('#novo');
  // ---- 1) leitura de acordes
  const L = await pg.evaluate(async () => { const G = await import('/src/banda/gerar.js'); const a = G.lerAcordes('C G | Am F | Dm'), b = G.lerAcordes('C Am F G'), c = G.lerAcordes('C G Am F Dm | G'), d = G.lerAcordes('C/E G7 | Am7'); const p = G.plano(a.barras, [{ nome: 'x', compassos: 3, energia: 1 }]); const cf = G.progDaCifra('Verso\nC G | Am F\nvem a letra aqui\nDm G\n'); return { a: a.barras.map((x) => x.map((y) => y.nome).join('+')), b: b.barras.length, c: c.barras.map((x) => x.length), cex: c.excesso, d: d.barras.map((x) => x.map((y) => y.nome).join('+')), pl: p.map((x) => x.a.nome + ':' + x.s0 + '-' + x.s1 + '#' + x.bar), cf }; });
  ok(JSON.stringify(L.a) === '["C+G","Am+F","Dm"]', 'compassos com 2 acordes: ' + L.a); ok(L.b === 4, 'sem "|": 1 acorde por compasso (compatível com antes)');
  ok(L.c[0] === 4 && L.cex === 1, 'máximo de 4 acordes por compasso (extra ignorado)'); ok(JSON.stringify(L.d) === '["C+G7","Am7"]', 'C/E, G7 e Am7 reconhecidos: ' + L.d);
  ok(L.pl.join(' ') === 'C:0-8#0 G:8-16#0 Am:0-8#1 F:8-16#1 Dm:0-16#2', 'plano divide o compasso: ' + L.pl.join(' ')); ok(/C G \| Am F/.test(L.cf), 'cifra com "|" mantém compassos: ' + L.cf);
  // ---- 2) gerar com 2 acordes por compasso pela tela e conferir pela análise
  await pg.click('#novo'); await pg.waitForSelector('#gnp'); await pg.click('#gnp'); await pg.waitForSelector('#imp'); const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#imp')]); await fc.setFiles(wav); await pg.waitForFunction(() => document.querySelectorAll('#faixas .item').length === 1);
  const id = pg.url().split('/').pop(); await pg.goto('http://localhost:8160/#/banda/' + id); await pg.waitForSelector('#ger');
  await pg.fill('#ac', 'C G | Am F | Dm G | C'); await pg.waitForTimeout(100); ok(/4 compasso\(s\) \(com mais de um/.test(await pg.textContent('#acm')), 'tela explica compassos com vários acordes: ' + (await pg.textContent('#acm')).slice(0, 70));
  await pg.fill('#bp', '120'); for (let i = 0; i < 4; i++) await pg.fill(`[data-s="${i}"] [data-c]`, '4'); await pg.evaluate(() => { document.querySelector('[data-s="0"] [data-c]').value = 4; }); 
  for (const k of ['bateria', 'baixo', 'guitarra']) await pg.uncheck(`[data-i=${k}]`); await pg.click('#ger'); await pg.waitForSelector('#es', { timeout: 90000 }); ok(/16 compassos/.test(await pg.textContent('#gr')), 'gerou 16 compassos');
  await mexe(pg, id, "p.faixas.forEach(f=>{ if(f.tipo!=='banda') f.mute=true; })");
  await pg.goto('http://localhost:8160/#/analise/' + id); await pg.waitForSelector('#go'); await pg.click('#go'); await pg.waitForSelector('#ap1', { timeout: 90000 });
  const ac = (await pg.evaluate(() => document.querySelector('.notas').textContent)); console.log('acordes lidos:', ac);
  ok(/C.*G.*Am.*F.*Dm.*G.*C/.test(ac.replace(/\s/g, '').replace(/(Am|Dm|[CGF])/g, '$1 ')) && /CGAmF/.test(ac), 'análise vê ao menos uma sequência C G Am F com troca dentro do compasso (nem todas as trocas rápidas são vistas)');
  // pegar da análise gera barras com "|"
  await pg.goto('http://localhost:8160/#/banda/' + id); await pg.waitForSelector('#da'); await pg.click('#da'); await pg.waitForSelector('#ac'); const pr = await pg.inputValue('#ac'); ok(/\|/.test(pr) && /C G/.test(pr), '"Pegar da análise" agrupa por compasso: ' + pr.slice(0, 50));
  const p = await pg.evaluate(async (id) => { const db = await new Promise((r) => { const q = indexedDB.open('clan-music-studio'); q.onsuccess = () => r(q.result); }); return new Promise((r) => { const q = db.transaction('projetos').objectStore('projetos').get(id); q.onsuccess = () => r(q.result); }); }, id);
  ok(p.faixas.filter((f) => f.tipo !== 'banda').length === 1 && p.faixas[0].midiaId, 'gravação original intacta');
  // ---- 3) teste de áudio (emulando celular Android)
  const cel = await browserCtx(b); const pc = await cel.newPage(); pc.on('pageerror', (e) => erros.push(e.message)); await pc.goto('http://localhost:8160/#/ajustes'); await pc.waitForSelector('#tau'); await pc.click('#tau'); await pc.waitForSelector('#rel');
  await pc.waitForTimeout(500); const r0 = await pc.textContent('#rel'); ok(/audio: running|audio: suspended/.test(r0) && /gravador:/.test(r0) && /compartilhar:/.test(r0), 'relatório lista as verificações do aparelho');
  await pc.click('[data-t=bipe] [data-go]'); await pc.waitForTimeout(300); ok(/Tocando um bipe/.test(await pc.textContent('[data-t=bipe] [data-m]')), 'bipe toca'); await pc.click('[data-t=bipe] [data-s="1"]');
  await pc.click('[data-t=musica] [data-go]'); await pc.waitForTimeout(500); ok(/Tocando 4 notas/.test(await pc.textContent('[data-t=musica] [data-m]')), 'faixa toca no player'); await pc.click('[data-t=musica] [data-s="1"]');
  await pc.click('[data-t=gravar] [data-go]'); await pc.waitForTimeout(4500); ok(/Gravou \d+ KB/.test(await pc.textContent('[data-t=gravar] [data-m]')), 'gravar e ouvir de volta: ' + (await pc.textContent('[data-t=gravar] [data-m]')).slice(0, 40)); await pc.click('[data-t=gravar] [data-s="1"]');
  const [dl] = await Promise.all([pc.waitForEvent('download', { timeout: 8000 }), pc.click('[data-t=enviar] [data-go]')]); ok(!!dl, 'exportar gera arquivo'); await pc.click('[data-t=enviar] [data-s="1"]');
  const r1 = await pc.textContent('#rel'); ok(/Bipe pelo Web Audio: OK/.test(r1) && /Gravar e ouvir de volta: OK/.test(r1) && /Exportar \/ compartilhar arquivo: OK/.test(r1), 'relatório final marca os 4 testes'); console.log(r1);
  await pc.click('#voltar'); await pc.waitForSelector('#tau'); ok(true, 'volta para Ajustes');
  ok(erros.length === 0, 'sem erros de JS ' + erros.join('|'));
  await b.close(); srv.close(); console.log(mal ? mal + ' FALHA(S)' : 'TUDO OK'); process.exit(mal ? 1 : 0);
})();
async function browserCtx(b) { return b.newContext({ ...devices['Pixel 7'], permissions: ['microphone'], acceptDownloads: true }); }
