// Teste da etapa 2: importar do Clan music antigo. Uso: node testes/etapa2.js <pasta-com-musica/-e-novo/> <audio.wav>
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const raiz = process.argv[2], wav = process.argv[3];
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let u = q.url.split('?')[0]; if (u.endsWith('/')) u += 'index.html'; const f = path.join(raiz, u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8153);
let mal = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) mal++; };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const erros = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const pg = await ctx.newPage(); pg.on('pageerror', (e) => erros.push(e.message));
  // 1) cria músicas no app ANTIGO e gera a cópia .cmbk dele
  await pg.goto('http://localhost:8153/musica/'); await pg.waitForSelector('.hn');
  const b64 = fs.readFileSync(wav).toString('base64');
  const cmbk = await pg.evaluate(async (x) => {
    const bin = atob(x), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const mk = (id, t, ar, outro, aud) => ({ id, title: t, artist: ar, key: 'G', mode: 'm', cifra: 'G  Am\nOlha a vida', letra: 'Olha a vida', audios: aud ? [{ id: id + 'a', tipo: 'voz', inst: 'voz', name: 'Voz ' + t, blob: new Blob([u], { type: 'audio/wav' }), vol: 1 }] : [], upd: Date.now(), ouvido: '', notas: 'nota', bpm: 100, sig: '4', outro, fase: 'ideia' });
    [mk('s1', 'Minha canção', 'Eu', false, true), mk('s2', 'Outra minha', 'Eu', false, false), mk('s3', 'Garota de Ipanema', 'Tom Jobim', true, true)].forEach((s) => { songs.push(s); put(s); });
    await new Promise((r) => setTimeout(r, 800));
    const bl = buildBackup(), ab = new Uint8Array(await bl.arrayBuffer()); let o = ''; for (let i = 0; i < ab.length; i += 8192) o += String.fromCharCode(...ab.subarray(i, i + 8192)); return btoa(o);
  }, b64);
  fs.writeFileSync('/tmp/antigo.cmbk', Buffer.from(cmbk, 'base64')); ok(fs.statSync('/tmp/antigo.cmbk').size > 1000, 'cópia .cmbk do app antigo gerada');
  // 2) leitura direta (mesmo endereço, Chrome)
  await pg.goto('http://localhost:8153/novo/#/ajustes'); await pg.waitForSelector('#aarq'); await pg.waitForSelector('#aold:not([hidden])', { timeout: 5000 });
  await pg.click('#aold'); await pg.waitForSelector('#aok');
  ok(/2 músicas autorais \(1 faixas/.test(await pg.textContent('#aprev')) && (await pg.textContent('#aprev')).includes('1 de outros artistas'), 'prévia: 2 autorais (1 faixa); a de outro artista fica de fora: ' + (await pg.textContent('#aprev')).replace(/\s+/g, ' ').slice(0, 120));
  await pg.click('#aok'); await pg.waitForFunction(() => /importada/.test(document.querySelector('#aprev').textContent));
  await pg.click('[data-nav=biblioteca]'); await pg.waitForSelector('.item');
  ok((await pg.locator('.item').count()) === 2, 'só as 2 músicas autorais entraram na biblioteca');
  await pg.click('text=Minha canção'); await pg.waitForSelector('audio');
  const info = await pg.evaluate(async () => { const a = document.querySelector('audio'); await new Promise((r) => { a.preload = 'auto'; a.onloadedmetadata = r; setTimeout(r, 4000); a.load(); }); return { src: !!a.src, dur: a.duration, ar: document.querySelector('#ar').value, ci: document.querySelector('#ci').value, to: document.querySelector('#to').value, mo: document.querySelector('#mo').value, bp: document.querySelector('#bp').value }; });
  ok(info.src && info.dur > 1 && info.ar === 'Eu' && /Olha a vida/.test(info.ci) && info.to === 'G' && info.mo === 'm' && info.bp === '100', 'projeto importado com áudio tocável, cifra, tom e BPM: ' + JSON.stringify(info));
  // 3) importar de novo não duplica
  await pg.click('[data-nav=ajustes]'); await pg.click('#aold'); await pg.waitForSelector('#aok'); await pg.click('#aok'); await pg.waitForFunction(() => /já estavam/.test(document.querySelector('#aprev').textContent));
  await pg.click('[data-nav=biblioteca]'); await pg.waitForSelector('.item'); { const n = await pg.locator('.item').count(); ok(n === 2, 'importar de novo não duplica (' + n + ')'); }
  // 4) cópia do novo app leva o áudio junto e restaura
  await pg.click('[data-nav=ajustes]'); const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#exp')]); const cam = await dl.path(); ok(fs.statSync(cam).size > fs.statSync(wav).size, 'cópia do app novo inclui o áudio (' + fs.statSync(cam).size + ' bytes)');
  await pg.click('[data-nav=biblioteca]'); await pg.click('text=Minha canção'); await pg.waitForSelector('#ap'); pg.once('dialog', (d) => d.accept()); await pg.click('#ap'); await pg.waitForSelector('.item');
  await pg.click('[data-nav=ajustes]'); const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#imp')]); await fc.setFiles(cam); await pg.waitForFunction(() => /1 novo/.test(document.querySelector('#aviso').textContent));
  await pg.click('[data-nav=biblioteca]'); await pg.click('text=Minha canção'); await pg.waitForSelector('audio');
  ok(await pg.evaluate(async () => { const a = document.querySelector('audio'); await new Promise((r) => { a.preload = 'auto'; a.onloadedmetadata = r; setTimeout(r, 4000); a.load(); }); return a.duration > 1; }), 'restaurar a cópia traz o áudio de volta');
  // 5) caminho do APK: contexto limpo, só o arquivo .cmbk, com opção de incluir outros artistas
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } }); const p2 = await ctx2.newPage(); p2.on('pageerror', (e) => erros.push(e.message));
  await p2.goto('http://localhost:8153/novo/#/ajustes'); await p2.waitForSelector('#aarq'); ok(await p2.locator('#aold').isHidden(), 'sem app antigo no aparelho, só aparece a opção do arquivo');
  const [fc2] = await Promise.all([p2.waitForEvent('filechooser'), p2.click('#aarq')]); await fc2.setFiles('/tmp/antigo.cmbk'); await p2.waitForSelector('#aout');
  await p2.check('#aout'); await p2.click('#aok'); await p2.waitForFunction(() => /importada/.test(document.querySelector('#aprev').textContent));
  await p2.click('[data-nav=biblioteca]'); await p2.waitForSelector('.item'); ok((await p2.locator('.item').count()) === 3, 'marcando "incluir outros artistas" entram as 3');
  ok(erros.length === 0, 'sem erros ' + erros.join('|'));
  console.log(mal ? 'FALHAS' : 'TUDO OK'); await b.close(); srv.close(); process.exit(mal ? 1 : 0);
})();
