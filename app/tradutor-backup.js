/* Clã Speak — backup automático na nuvem (Firestore: copias/{codigo}).
   Salva sozinho os dados do app (favoritos, histórico, pontos, letras, ajustes) e permite
   baixar o backup ou restaurá-lo em outro aparelho com o código de backup.
   Nunca envia a chave da API nem o cache de traduções. */
(function () {
  'use strict';
  const C = window.ClaSpeak;
  const $ = (s) => document.querySelector(s);
  if (!C || !$('#cardBackup')) return;

  const FORA = /^trad-(api-key|cache|capa|aba|miau|bk-|sb-hoje-)/; // nunca vão para o backup
  const LIMITE = 900 * 1024; // documento do Firestore aceita até 1 MB
  const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function novoCodigo() {
    const v = new Uint32Array(12); crypto.getRandomValues(v);
    const c = Array.from(v, (n) => ALFA[n % ALFA.length]).join('');
    return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8);
  }
  const normalizar = (t) => (t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formatar = (t) => { const c = normalizar(t); return c.length === 12 ? c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8) : null; };
  const codigo = () => { let c = localStorage.getItem('trad-bk-codigo'); if (!c) { c = novoCodigo(); localStorage.setItem('trad-bk-codigo', c); } return c; };

  function coletar() {
    const dados = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('trad-') && !FORA.test(k)) dados[k] = localStorage.getItem(k);
    }
    return dados;
  }
  function hash(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + t.length; }
  const comTempo = (p, ms) => Promise.race([p, new Promise((_, e) => setTimeout(() => e(new Error('tempo esgotado')), ms))]);

  async function doc(cod) {
    const { app } = await C.nuvem();
    return app.firestore().collection('copias').doc(normalizar(cod));
  }

  // ---------- interface ----------
  const st = $('#bkStatus'), auto = $('#bkAuto'), rest = $('#bkRestMsg');
  const quando = (t) => { const d = new Date(t), hoje = new Date().toDateString() === d.toDateString(); return (hoje ? 'hoje' : d.toLocaleDateString('pt-BR')) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  function status(txt, tipo) { st.textContent = txt; st.className = 'mu' + (tipo ? ' ' + tipo : ''); }
  function mostrar() {
    $('#bkCodigo').value = codigo();
    auto.checked = localStorage.getItem('trad-bk-auto') !== '0';
    const ult = +localStorage.getItem('trad-bk-ult') || 0;
    if (ult) status('Último backup na nuvem: ' + quando(ult) + (auto.checked ? ' · automático ligado' : ' · automático desligado'), 'ok');
    else status(auto.checked ? 'O primeiro backup automático será feito em instantes.' : 'Backup automático desligado.');
  }
  function erroNuvem(e) {
    if (e && e.code === 'permission-denied') return 'A nuvem recusou o backup: falta publicar no Firebase a regra "copias" (firestore.rules).';
    if (e && e.message === 'sem-config') return 'A nuvem não está configurada neste app.';
    return 'Sem conexão com a nuvem agora. O app tenta de novo sozinho.';
  }

  // ---------- enviar ----------
  let enviando = false;
  async function enviar(forcar) {
    if (enviando) return false;
    const dados = coletar(), texto = JSON.stringify(dados), h = hash(texto);
    if (!forcar && h === localStorage.getItem('trad-bk-hash')) return false;
    if (texto.length > LIMITE) { status('O backup passou de 900 KB (muitas letras do Karaokê). Use "Baixar backup" para guardar o arquivo.', 'erro'); return false; }
    enviando = true;
    if (forcar) status('Salvando na nuvem…');
    try {
      const d = await doc(codigo());
      const t = Date.now();
      await comTempo(d.set({ app: 'claspeak', v: 1, t, n: Object.keys(dados).length, dados: texto }), 15000);
      localStorage.setItem('trad-bk-hash', h); localStorage.setItem('trad-bk-ult', String(t));
      mostrar();
      return true;
    } catch (e) {
      status(erroNuvem(e), 'erro');
      return false;
    } finally { enviando = false; }
  }

  // Automático: confere a cada minuto, ao sair do app e ao abrir os Ajustes
  const autoLigado = () => localStorage.getItem('trad-bk-auto') !== '0';
  setInterval(() => { if (autoLigado() && navigator.onLine !== false) enviar(false); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.hidden && autoLigado()) enviar(false); });
  setTimeout(() => { if (autoLigado()) enviar(false); }, 8000);

  auto.onchange = () => { localStorage.setItem('trad-bk-auto', auto.checked ? '1' : '0'); mostrar(); if (auto.checked) enviar(false); };
  $('#bkAgora').onclick = () => enviar(true).then((ok) => { if (ok) status('Backup salvo na nuvem ' + quando(Date.now()) + '.', 'ok'); });
  $('#bkCopiar').onclick = () => {
    const c = codigo();
    (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(() => {
      $('#bkCopiar').textContent = 'Copiado'; setTimeout(() => { $('#bkCopiar').textContent = 'Copiar'; }, 1500);
    }).catch(() => prompt('Seu código de backup:', c));
  };

  // ---------- baixar ----------
  $('#bkBaixar').onclick = async () => {
    const pacote = JSON.stringify({ app: 'claspeak', v: 1, t: Date.now(), codigo: codigo(), dados: coletar() }, null, 1);
    const nome = 'claspeak-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    const Sh = C.plugin && C.plugin('Share');
    try {
      if (!Sh && navigator.canShare && navigator.share) {
        const f = new File([pacote], nome, { type: 'application/json' });
        if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: 'Backup do Clã Speak' }); return; }
      }
      if (Sh) { await Sh.share({ title: 'Backup do Clã Speak', text: pacote, dialogTitle: 'Guardar backup (Drive, e-mail, WhatsApp)' }); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([pacote], { type: 'application/json' })); a.download = nome;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      status('Arquivo ' + nome + ' baixado.', 'ok');
    } catch (e) { /* cancelado */ }
  };

  // ---------- restaurar ----------
  let pendente = null;
  function aplicar(dados, cod) {
    Object.keys(dados).forEach((k) => { if (k.startsWith('trad-') && !FORA.test(k)) localStorage.setItem(k, dados[k]); });
    if (cod) localStorage.setItem('trad-bk-codigo', cod);
    localStorage.removeItem('trad-bk-hash');
    rest.textContent = 'Backup restaurado. Reabrindo o app…';
    setTimeout(() => location.reload(), 900);
  }
  function confirmar(dados, t, cod, origem) {
    const n = Object.keys(dados).length;
    if (!n) { rest.textContent = 'Esse backup está vazio.'; return; }
    if (pendente && pendente.origem === origem) { pendente = null; aplicar(dados, cod); return; }
    pendente = { origem };
    setTimeout(() => { if (pendente && pendente.origem === origem) pendente = null; }, 8000);
    rest.textContent = 'Backup de ' + quando(t) + ' com ' + n + ' itens. Ele substitui os dados deste aparelho. Toque de novo para confirmar.';
  }
  $('#bkPuxar').onclick = async () => {
    const cod = formatar($('#bkOutro').value);
    if (!cod) { rest.textContent = 'O código tem 12 letras e números (ex.: K7P2-QX4M-9ABC).'; return; }
    if (pendente && pendente.origem === 'nuvem:' + cod && pendente.dados) { const p = pendente; confirmar(p.dados, p.t, cod, p.origem); return; }
    rest.textContent = 'Buscando na nuvem…';
    try {
      const d = await doc(cod);
      const snap = await comTempo(d.get(), 15000);
      if (!snap.exists) { rest.textContent = 'Nenhum backup encontrado com esse código.'; return; }
      const v = snap.data(), dados = JSON.parse(v.dados || '{}');
      confirmar(dados, v.t, cod, 'nuvem:' + cod);
      if (pendente) Object.assign(pendente, { dados, t: v.t });
    } catch (e) { rest.textContent = erroNuvem(e); }
  };
  $('#bkArquivoBt').onclick = () => $('#bkArquivo').click();
  $('#bkArquivo').onchange = async (ev) => {
    const f = ev.target.files && ev.target.files[0]; ev.target.value = '';
    if (!f) return;
    try {
      const p = JSON.parse(await f.text());
      if (!p || p.app !== 'claspeak' || typeof p.dados !== 'object') throw new Error('formato');
      pendente = null; confirmar(p.dados, p.t, null, 'arquivo');
      $('#bkArquivoBt').onclick = () => confirmar(p.dados, p.t, null, 'arquivo');
      $('#bkArquivoBt').textContent = 'Confirmar restauração do arquivo';
    } catch (e) { rest.textContent = 'Esse arquivo não é um backup do Clã Speak.'; }
  };

  // Ao abrir os Ajustes, atualiza a tela e faz o backup se algo mudou
  const antes = C.ganchosAba.ajustes;
  C.ganchosAba.ajustes = function () { if (antes) antes.apply(this, arguments); mostrar(); if (autoLigado()) enviar(false); };
  mostrar();
  window.ClaSpeakBackup = { enviar, coletar, codigo };
})();
