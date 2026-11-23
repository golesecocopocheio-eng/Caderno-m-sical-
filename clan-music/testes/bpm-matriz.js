// Gera a banda completa em vários estilos e andamentos e confere se a análise acerta o BPM. Uso: node testes/bpm-matriz.js
const NOVOS = !!process.env.NOVOS;
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(raiz, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8158);
const PROGS = ['C Am F G', 'Am F C G', 'C G | Am F | Dm G | C'];
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage(); await pg.goto('http://localhost:8158/');
  const res = await pg.evaluate(async ([PROGS, NOVOS]) => {
    const G = await import('/src/banda/gerar.js'), D = await import('/src/analise/dsp.js'), out = [];
    const secoes = [{ nome: 'A', compassos: 4, energia: 1 }, { nome: 'B', compassos: 4, energia: 2 }, { nome: 'C', compassos: 4, energia: 0 }];
    for (const est of NOVOS ? ['afrobeat', 'samba', 'mpb'] : ['pop', 'balada', 'rock', 'reggae']) for (const bpm of NOVOS ? [70, 90, 110, 130] : [70, 80, 90, 100, 110, 120, 130, 140]) for (let pi = 0; pi < (NOVOS ? 2 : 3); pi++) {
      const r = await G.gerar({ prog: G.lerAcordes(PROGS[pi]).barras, secoes, estilo: est, bpm, instr: { bateria: true, baixo: true, violao: true, guitarra: true, teclado: true } });
      const n = Math.ceil(r.dur * 11025), oc = new OfflineAudioContext(1, n, 11025); Object.values(r.faixas).forEach((x) => { const s = oc.createBufferSource(), g = oc.createGain(); s.buffer = x.buf; g.gain.value = 0.5; s.connect(g); g.connect(oc.destination); s.start(0); });
      const y = (await oc.startRendering()).getChannelData(0), v = D.bpm(y, 11025); out.push({ est, bpm, pi, got: v && v.bpm });
    }
    return out;
  }, [PROGS, NOVOS]);
  let ok = 0, fa = []; res.forEach((r) => { if (r.got && Math.abs(r.got - r.bpm) <= 3) ok++; else fa.push(`${r.est} ${r.bpm} (prog ${r.pi}) -> ${r.got}`); });
  console.log(`${ok}/${res.length} certos (±3 BPM)`); fa.forEach((x) => console.log('  erro:', x));
  await b.close(); srv.close(); process.exit(ok / res.length >= 0.95 ? 0 : 1);
})();
