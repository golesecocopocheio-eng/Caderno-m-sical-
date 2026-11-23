// Teste da etapa 6: Minha Banda IA. Uso: node testes/etapa6.js <audio.wav>
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..'), wav = process.argv[2];
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(raiz, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8157);
let mal = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) mal++; };
const lerP = (pg, id) => pg.evaluate(async (id) => { const db = await new Promise((r) => { const q = indexedDB.open('clan-music-studio'); q.onsuccess = () => r(q.result); }); return new Promise((r) => { const q = db.transaction('projetos').objectStore('projetos').get(id); q.onsuccess = () => r(q.result); }); }, id);
(async () => {
  const b = await chromium.launch(); const erros = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => erros.push(e.message));
  await pg.goto('http://localhost:8157/'); await pg.waitForSelector('#novo'); await pg.click('#novo'); await pg.waitForSelector('#gnp');
  // uma gravação do usuário que NÃO pode ser tocada
  await pg.click('#gnp'); await pg.waitForSelector('#imp'); const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#imp')]); await fc.setFiles(wav); await pg.waitForFunction(() => document.querySelectorAll('#faixas .item').length === 1);
  const id = pg.url().split('/').pop();
  await pg.goto('http://localhost:8157/#/banda/' + id); await pg.waitForSelector('#ger');
  ok((await pg.inputValue('#ac')) === 'C Am F G', 'acordes padrão C Am F G');
  await pg.fill('#ac', 'C Am F X9 G'); await pg.waitForTimeout(100); ok(/Não reconheci: X9/.test(await pg.textContent('#acm')), 'avisa acorde não reconhecido');
  await pg.fill('#ac', 'C Am F G'); await pg.click('[data-e=reggae]'); await pg.waitForSelector('#ger'); ok((await pg.inputValue('#bp')) === '76', 'estilo muda o andamento padrão (76)');
  await pg.fill('#bp', '120'); await pg.click('[data-e=pop]'); ok((await pg.inputValue('#bp')) === '120', 'andamento digitado não é sobrescrito pelo estilo');
  await pg.check('[data-i=guitarra]'); // 5 instrumentos
  // seções: 2+4+4 = 10 compassos de 2 s = 20 s
  await pg.evaluate(() => {}); const ns = await pg.locator('[data-s]').count(); ok(ns === 4, '4 seções padrão');
  for (let i = 0; i < 4; i++) { await pg.fill(`[data-s="${i}"] [data-c]`, '4'); }
  await pg.click('#ger'); await pg.waitForSelector('#es', { timeout: 90000 });
  ok(/5 faixa\(s\), 16 compassos/.test(await pg.textContent('#gr')), 'banda pronta: ' + (await pg.textContent('#gr')).slice(0, 60));
  let p = await lerP(pg, id); ok(p.faixas.length === 6, '1 gravação + 5 da banda'); ok(p.faixas[0].tipo !== 'banda' && p.faixas[0].midiaId, 'gravação do usuário intacta');
  ok(['bateria', 'baixo', 'violao', 'guitarra', 'teclado'].every((k) => p.faixas.some((f) => f.inst === k && f.tipo === 'banda')), 'um instrumento por faixa');
  // gerar de novo troca só as da banda
  await pg.click('#ger'); await pg.waitForSelector('#es', { timeout: 90000 }); p = await lerP(pg, id); ok(p.faixas.length === 6 && p.faixas[0].tipo !== 'banda', 'gerar de novo troca só as faixas da banda');
  ok(p.arranjo && p.arranjo.estilo === 'pop' && p.bpm === 120, 'arranjo e andamento salvos no projeto');
  // a música gerada é reconhecida pela análise do app (acordes e andamento)
  p.faixas.filter((f) => f.tipo === 'banda' && !['baixo', 'violao', 'teclado'].includes(f.inst)).length; 
  await pg.evaluate(async (id) => { const db = await new Promise((r) => { const q = indexedDB.open('clan-music-studio'); q.onsuccess = () => r(q.result); }); const t = db.transaction('projetos', 'readwrite'), s = t.objectStore('projetos'); const p = await new Promise((r) => { const q = s.get(id); q.onsuccess = () => r(q.result); }); p.faixas.forEach((f) => { if (f.tipo !== 'banda') f.mute = true; else if (f.inst === 'guitarra') f.mute = true; }); s.put(p); await new Promise((r) => (t.oncomplete = r)); }, id);
  await pg.goto('http://localhost:8157/#/analise/' + id); await pg.waitForSelector('#go'); await pg.click('#go'); await pg.waitForSelector('#ap1', { timeout: 90000 });
  const t = await pg.textContent('#res'), bp = +(t.match(/(\d+) BPM/) || [])[1], ac = await pg.evaluate(() => document.querySelector('.notas').textContent);
  console.log(t.replace(/\s+/g, ' ').slice(0, 160), '| acordes:', ac);
  ok(/Tom(C|Am)/.test(t.replace(/\s/g, '')), 'análise acha o tom C/Am da banda (' + t.replace(/\s/g, '').match(/Tom\w+?confian/)[0] + ')'); ok(['C', 'Am', 'F', 'G'].every((x) => ac.includes(x)), 'análise acha C Am F G tocados pela banda');
  // andamento: só a bateria
  await pg.evaluate(async (id) => { const db = await new Promise((r) => { const q = indexedDB.open('clan-music-studio'); q.onsuccess = () => r(q.result); }); const t = db.transaction('projetos', 'readwrite'), s = t.objectStore('projetos'); const p = await new Promise((r) => { const q = s.get(id); q.onsuccess = () => r(q.result); }); p.faixas.forEach((f) => { f.mute = f.inst !== 'bateria'; }); delete p.analise; s.put(p); await new Promise((r) => (t.oncomplete = r)); }, id);
  await pg.goto('http://localhost:8157/#/inicio'); await pg.waitForSelector('#novo'); await pg.goto('http://localhost:8157/#/analise/' + id); await pg.waitForSelector('#go'); await pg.click('#go'); await pg.waitForSelector('#ap1', { timeout: 90000 });
  const bd = +((await pg.textContent('#res')).match(/(\d+) BPM/) || [])[1]; ok(bd >= 115 && bd <= 125 || (bd >= 57 && bd <= 63), 'análise acha o andamento da bateria (' + bd + ')');
  // só bateria: andamento
  await pg.goto('http://localhost:8157/#/banda/' + id); await pg.waitForSelector('#ger'); for (const k of ['baixo', 'violao', 'teclado', 'guitarra']) await pg.uncheck(`[data-i=${k}]`); await pg.click('#ger'); await pg.waitForSelector('#es', { timeout: 60000 });
  p = await lerP(pg, id); ok(p.faixas.filter((f) => f.tipo === 'banda').length === 5, 'desmarcar não apaga o que já existia'); 
  ok(erros.length === 0, 'sem erros de JS ' + erros.join('|'));
  await b.close(); srv.close(); console.log(mal ? mal + ' FALHA(S)' : 'TUDO OK'); process.exit(mal ? 1 : 0);
})();
