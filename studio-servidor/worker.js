/* Servidor do Clan music (Cloudflare Workers, plano gratuito).
 * Guarda a chave do Groq em segredo e faz a transcrição da letra cantada.
 * Variáveis (Settings > Variables and Secrets): GROQ_KEY (segredo) e APP_TOKEN (senha do app). */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'x-app-token, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    if (!env.APP_TOKEN || !env.GROQ_KEY) return json({ erro: 'Servidor sem configuração: falta GROQ_KEY ou APP_TOKEN.' }, 500);
    if (req.headers.get('x-app-token') !== env.APP_TOKEN) return json({ erro: 'Senha do app incorreta.' }, 401);
    if (url.pathname === '/ping') return json({ ok: true });
    if (url.pathname !== '/transcrever' || req.method !== 'POST') return json({ erro: 'Rota não existe.' }, 404);

    const entrada = await req.formData();
    const arq = entrada.get('file');
    if (!arq || typeof arq === 'string') return json({ erro: 'Faltou o áudio.' }, 400);
    if (arq.size > 24 * 1024 * 1024) return json({ erro: 'Áudio grande demais (máximo 24 MB).' }, 413);

    const f = new FormData();
    f.append('file', arq, 'audio.wav');
    f.append('model', 'whisper-large-v3-turbo');
    f.append('response_format', 'verbose_json');
    f.append('temperature', '0');
    const lang = entrada.get('language');
    if (lang && typeof lang === 'string') f.append('language', lang);

    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { authorization: 'Bearer ' + env.GROQ_KEY }, body: f,
    });
    const t = await r.text();
    if (!r.ok) return json({ erro: 'O serviço de transcrição recusou (' + r.status + ').', detalhe: t.slice(0, 300) }, 502);
    let d; try { d = JSON.parse(t); } catch (e) { return json({ erro: 'Resposta inesperada do serviço.' }, 502); }
    return json({
      texto: d.text || '', idioma: d.language || '', duracao: d.duration || 0,
      trechos: (d.segments || []).map((s) => ({ ini: s.start, fim: s.end, texto: (s.text || '').trim(), conf: s.avg_logprob, semFala: s.no_speech_prob })),
    });
  },
};
