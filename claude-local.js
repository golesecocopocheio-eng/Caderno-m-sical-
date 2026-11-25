/* Banco de dados do aplicativo do bar, para rodar fora do claude.ai.
 *
 * Faz o papel de claude.use("db") e claude.use("user") nos projetos originais
 * (Caixa bar, Portaria do Bar e Estoque do Bar), sem mudar nada neles.
 *
 * - Com o Firebase configurado (firebase-config.js) e um código do bar escolhido,
 *   os dados ficam no Firebase e sincronizam ao vivo entre os celulares.
 * - Sem isso, os dados ficam salvos só no próprio aparelho (localStorage).
 * - Dentro do claude.ai este arquivo não faz nada.
 */
(function () {
  if (typeof window.claude !== 'undefined') return;

  const APP = (location.pathname.split('/').pop() || 'index').replace(/\.html?$/, '');
  const codigo = () => (localStorage.getItem('bar-codigo') || '').trim();
  const nome = () => (localStorage.getItem('bar-nome') || '').trim();

  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => fail(new Error('Não carregou ' + src));
      document.head.appendChild(s);
    });
  }

  /* ---------------- Histórico de alterações ----------------
   * Cada gravação (criar, mudar ou apagar) guarda uma cópia do documento como ficou (ou, ao
   * apagar, como era antes), com data, hora e quem fez. Com o Firebase ligado, o histórico fica
   * na nuvem (bares/{codigo}/historico); sem ele, fica neste aparelho (últimas alterações). */
  const HIST_KEY = 'bar-historico';
  const HIST_MAX = 400, HIST_BYTES = 1500000;
  function histLocal(entrada) {
    let h = [];
    try { h = JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch (e) {}
    const ult = [...h].reverse().find((x) => x.app === entrada.app && x.col === entrada.col && x.id === entrada.id);
    if (ult && ult.op === entrada.op && ult.dados === entrada.dados) return;
    h.push(entrada);
    while (h.length > HIST_MAX) h.shift();
    let txt = JSON.stringify(h);
    while (txt.length > HIST_BYTES && h.length > 1) { h.shift(); txt = JSON.stringify(h); }
    try { localStorage.setItem(HIST_KEY, txt); } catch (e) {}
  }
  const quem = () => nome() || 'Este aparelho';


  /* ---------------- Realtime Database com cara de Firestore ----------------
   * O Firestore pede cartão em alguns projetos; o Realtime Database é grátis sem cartão.
   * Este adaptador oferece as mesmas funções que o app usa do Firestore (collection, doc,
   * where, orderBy, limit, get, set, update, delete, add, onSnapshot, batch).
   * Cada documento fica em <caminho>/_d como texto JSON (assim nada se perde), e os campos
   * "noite" e "t" ficam ao lado para as buscas rápidas no servidor. */
  function fsDoRtdb(rdb) {
    const IDX = ['noite', 't'];
    const ler = (v) => { try { return v && typeof v._d === 'string' ? JSON.parse(v._d) : undefined; } catch (e) { return undefined; } };
    const gravar = (dados) => {
      const o = { _d: JSON.stringify(dados ?? {}) };
      IDX.forEach((k) => { const x = dados && dados[k]; o[k] = (typeof x === 'string' || typeof x === 'number') ? x : null; });
      return o;
    };
    const docSnap = (id, dados) => ({ id, exists: dados !== undefined, data: () => (dados === undefined ? undefined : JSON.parse(JSON.stringify(dados))) });
    const qSnap = (lista) => ({ docs: lista, size: lista.length, empty: !lista.length, forEach: (f) => lista.forEach(f) });
    const fs = {};
    function docRef(colPath, colId, id) {
      const path = colPath + '/' + id;
      const ref = rdb.ref(path);
      const d = {
        id, path, firestore: fs, parent: { id: colId, path: colPath },
        collection: (n) => colRef(path + '/' + n, n),
        get: async () => docSnap(id, ler((await ref.once('value')).val())),
        set: async (v, o) => {
          let dados = JSON.parse(JSON.stringify(v ?? {}));
          if (o && o.merge) { const atual = ler((await ref.once('value')).val()); if (atual) dados = Object.assign(atual, dados); }
          await ref.update(gravar(dados));
        },
        update: async (v) => { const atual = ler((await ref.once('value')).val()) || {}; await ref.update(gravar(Object.assign(atual, JSON.parse(JSON.stringify(v ?? {}))))); },
        delete: () => ref.remove(),
        onSnapshot: (cb, err) => {
          const h = (s) => cb(docSnap(id, ler(s.val())));
          ref.on('value', h, (e) => err && err(e));
          return () => ref.off('value', h);
        },
      };
      return d;
    }
    function colRef(colPath, colId, filtros = [], ordem = null, lim = null) {
      const base = rdb.ref(colPath);
      const montar = () => {
        let q = base;
        const f = filtros.find(([c, op]) => op === '==' && IDX.includes(c));
        if (f) q = q.orderByChild(f[0]).equalTo(f[2]);
        else if (ordem && IDX.includes(ordem[0]) && lim) q = ordem[1] === 'desc' ? q.orderByChild(ordem[0]).limitToLast(lim) : q.orderByChild(ordem[0]).limitToFirst(lim);
        return q;
      };
      const comparar = (a, op, b) => op === '==' ? a === b : op === '!=' ? a !== b : op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : op === '>=' ? a >= b : op === 'in' ? (b || []).includes(a) : true;
      const resultado = (val) => {
        let lista = [];
        Object.entries(val || {}).forEach(([id, v]) => { const dados = ler(v); if (dados !== undefined) lista.push([id, dados]); });
        lista = lista.filter(([, x]) => filtros.every(([c, op, b]) => comparar(x[c], op, b)));
        if (ordem) { const [c, dir] = ordem; lista.sort((a, b) => { const p = a[1][c], q = b[1][c]; const r = p < q ? -1 : p > q ? 1 : 0; return dir === 'desc' ? -r : r; }); }
        if (lim) lista = lista.slice(0, lim);
        return qSnap(lista.map(([id, x]) => docSnap(id, x)));
      };
      return {
        id: colId, path: colPath,
        doc: (id) => docRef(colPath, colId, id || base.push().key),
        add: async (v) => { const r = docRef(colPath, colId, base.push().key); await r.set(v); return r; },
        where: (c, op, v) => colRef(colPath, colId, [...filtros, [c, op, v]], ordem, lim),
        orderBy: (c, dir) => colRef(colPath, colId, filtros, [c, dir || 'asc'], lim),
        limit: (n) => colRef(colPath, colId, filtros, ordem, n),
        get: async () => resultado((await montar().once('value')).val()),
        onSnapshot: (cb, err) => {
          const q = montar(), h = (s) => cb(resultado(s.val()));
          q.on('value', h, (e) => err && err(e));
          return () => q.off('value', h);
        },
      };
    }
    fs.collection = (n) => colRef(n, n);
    fs.batch = () => {
      const mudancas = {};
      return {
        set: (r, v) => { const g = gravar(JSON.parse(JSON.stringify(v ?? {}))); Object.entries(g).forEach(([k, x]) => { mudancas[r.path + '/' + k] = x; }); },
        commit: () => rdb.ref().update(mudancas),
      };
    };
    return fs;
  }

  /* ---------------- Modo nuvem (Firebase) ---------------- */
  // A conexão (login e dono do bar) é feita uma única vez, na tela principal do app,
  // e as abas (Caixa, Portaria, Estoque) usam essa mesma conexão. Assim o aparelho
  // tem uma só identidade, mesmo com as três abas abrindo ao mesmo tempo.
  let core = null;
  function iniciarCore() {
    if (core) return core;
    core = (async () => {
      if (typeof window.FIREBASE_CONFIG === 'undefined') await loadScript('firebase-config.js');
      const cfg = window.FIREBASE_CONFIG;
      if (!cfg || !codigo()) return null;
      await loadScript('vendor/firebase-app-compat.js');
      await loadScript('vendor/firebase-auth-compat.js');
      // Com databaseURL usa o Realtime Database (grátis, sem cartão); sem ele, o Firestore.
      const rt = !!cfg.databaseURL;
      await loadScript(rt ? 'vendor/firebase-database-compat.js' : 'vendor/firebase-firestore-compat.js');
      const fb = window.firebase;
      const app = fb.apps.length ? fb.app() : fb.initializeApp(cfg);
      const auth = app.auth();
      const emu = localStorage.getItem('bar-fb-emulador'); // só para testes: host:portaBanco:portaAuth
      let fs;
      if (rt) {
        const rdb = app.database();
        if (emu) { const [host, dbPort, authPort] = emu.split(':'); rdb.useEmulator(host, Number(dbPort)); auth.useEmulator('http://' + host + ':' + authPort, { disableWarnings: true }); }
        fs = fsDoRtdb(rdb);
      } else {
        fs = app.firestore();
        if (emu) {
          const [host, fsPort, authPort] = emu.split(':');
          fs.useEmulator(host, Number(fsPort));
          auth.useEmulator('http://' + host + ':' + authPort, { disableWarnings: true });
        }
        fs.settings({ ignoreUndefinedProperties: true, merge: true });
        try { await fs.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* sem cache offline neste navegador */ }
      }

      const user = await new Promise((ok) => {
        const off = auth.onAuthStateChanged((u) => {
          if (u) { off(); ok(u); } else auth.signInAnonymously().catch(() => {});
        });
      });

      const bar = fs.collection('bares').doc(codigo());
      let info = null;
      try {
        const snap = await bar.get();
        if (snap.exists) info = snap.data();
        else { info = { dono: user.uid, criado: Date.now() }; await bar.set(info); }
      } catch (e) {
        try { const snap = await bar.get(); info = snap.exists ? snap.data() : null; } catch (e2) {}
      }
      if (nome()) bar.collection('pessoas').doc(user.uid).set({ nome: nome(), t: Date.now() }).catch(() => {});
      // Dono: quem criou o código do bar OU quem liberou este celular com o PIN do dono
      // (bares/{codigo}/acesso/donos: { pin: hash, uids: [...] }).
      let acesso = {};
      try { const a = await bar.collection('acesso').doc('donos').get(); if (a.exists) acesso = a.data() || {}; } catch (e) {}
      let liberado = false;
      try { const d = await bar.collection('donos').doc(user.uid).get(); liberado = d.exists; } catch (e) {}
      const dono = (!!info && info.dono === user.uid) || liberado || (Array.isArray(acesso.uids) && acesso.uids.includes(user.uid));
      // Uma vez por bar: sobe para a nuvem o que a Portaria e o Estoque já tinham guardado só
      // neste celular. Não apaga nada; registros com o mesmo id são substituídos. Valores e
      // configurações só sobem do celular do dono. Do celular da equipe sobem só as entradas e
      // saídas da Portaria lançadas nele (marcadas como dele), porque é só isso que a equipe pode gravar.
      const MIG = 'bar-migrado:' + codigo();
      if (!localStorage.getItem(MIG)) {
        try {
          let lote = fs.batch(); let n = 0;
          for (const app of (dono ? ['portaria', 'estoque'] : ['portaria'])) {
            let local = {};
            try { local = JSON.parse(localStorage.getItem('app-bar-db:' + app + '.html')) || {}; } catch (e) {}
            for (const [col, docs] of Object.entries(local)) {
              if (!dono && !['entradas', 'saidas', 'log'].includes(col)) continue;
              for (const [id, v0] of Object.entries(docs || {})) { const v = dono ? v0 : { ...v0, u: user.uid }; lote.set(bar.collection(app + '_' + col).doc(id), v); if (++n === 400) { await lote.commit(); lote = fs.batch(); n = 0; } }
            }
          }
          if (n) await lote.commit();
          localStorage.setItem(MIG, String(Date.now()));
        } catch (e) { /* tenta de novo na próxima abertura */ }
      }
      return { bar, user, dono, info, acesso };
    })();
    return core;
  }
  window.__barIniciarCore = iniciarCore;

  /* 👑 Dono do bar pelo PIN (Ajustes). O PIN fica guardado só como código embaralhado (hash). */
  const hashPin = async (pin) => {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codigo() + '|' + String(pin).trim()));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  };
  window.__barDono = {
    // temPin: true/false para o dono; null para a equipe (ela não pode ver se existe PIN).
    async estado() { const c = await iniciarCore().catch(() => null); if (!c) return { nuvem: false, dono: true }; return { nuvem: true, dono: c.dono, temPin: c.dono ? !!(c.acesso && c.acesso.pin) : null }; },
    async virar(pin) {
      const c = await iniciarCore(); if (!c) throw new Error('a nuvem não está ligada');
      if (!/^\d{4,8}$/.test(String(pin).trim())) throw new Error('o PIN precisa ter de 4 a 8 números');
      const h = await hashPin(pin);
      if (c.dono) {
        // Dono cria ou troca o PIN. Só o dono lê e grava este documento.
        const ref = c.bar.collection('acesso').doc('donos'); const s = await ref.get(); const a = s.exists ? (s.data() || {}) : {};
        const uids = [...new Set([...(a.uids || []), c.user.uid, ...(c.info && c.info.dono ? [c.info.dono] : [])])];
        await ref.set({ pin: h, uids, t: Date.now() });
        return { novoPin: !a.pin || a.pin !== h };
      }
      // Equipe: o banco só aceita se o PIN for igual ao do dono (conferido nas regras do Firebase).
      try { await c.bar.collection('donos').doc(c.user.uid).set({ pin: h, nome: nome() || '', t: Date.now() }); }
      catch (e) { throw new Error('PIN errado (ou o dono ainda não criou o PIN)'); }
      return { novoPin: false };
    },
  };

  async function iniciarNuvem() {
    let c = null;
    let pai = null;
    try { pai = window.parent !== window && window.parent.__barIniciarCore; } catch (e) {}
    c = await (pai ? pai() : iniciarCore());
    if (!c) return null;
    const { bar, user, dono } = c;
    // O Firebase roda na tela principal; os dados criados nesta aba são copiados para lá
    // antes de gravar, senão o Firebase não os reconhece como objetos simples.
    const copiar = pai ? (v) => (v === undefined ? v : window.parent.structuredClone(v)) : (v) => v;
    const colNome = (ref) => ref.parent.id.slice(APP.length + 1);
    const hist = (ref, op, dados) => {
      let j = JSON.stringify(dados ?? null); if (j && j.length > 40000) j = JSON.stringify('(registro grande: foto)'); // fotos não vão para o histórico
      const e = { app: APP, col: colNome(ref), id: ref.id, op, dados: j, quem: quem(), uid: user.uid, t: Date.now() };
      bar.collection('historico').add(copiar(e)).catch(() => {});
    };
    const depois = (ref, op) => ref.get().then((s) => hist(ref, op, s.exists ? s.data() : null)).catch(() => {});
    const doc = (ref) => ({
      id: ref.id,
      get: () => ref.get(),
      set: (v, o) => ref.set(copiar(v), copiar(o)).then((r) => { if (o && o.merge) depois(ref, 'set'); else hist(ref, 'set', v); return r; }),
      update: (v) => ref.update(copiar(v)).then((r) => { depois(ref, 'update'); return r; }),
      delete: async () => { let antes = null; try { const s = await ref.get(); antes = s.exists ? s.data() : null; } catch (e) {} await ref.delete(); hist(ref, 'delete', antes); },
      onSnapshot: (...a) => ref.onSnapshot(...a),
    });
    const query = (q) => ({
      where: (...a) => query(q.where(...a)),
      orderBy: (...a) => query(q.orderBy(...a)),
      limit: (n) => query(q.limit(n)),
      get: () => q.get(),
      onSnapshot: (...a) => q.onSnapshot(...a),
    });
    const col = (n) => {
      const ref = bar.collection(APP + '_' + n);
      return Object.assign(query(ref), {
        doc: (id) => doc(id ? ref.doc(id) : ref.doc()),
        add: (v) => ref.add(copiar(v)).then((r) => { hist(r, 'add', v); return doc(r); }),
      });
    };
    const db = {
      collection: (n) => col(n),
      doc: (path) => { const [n, id] = path.split('/'); return col(n).doc(id); },
    };
    const usuario = {
      isOwner: async () => dono,
      id: async () => user.uid,
      canEdit: () => dono,
      can: () => true,
      profiles: async (ids) => {
        const out = {};
        await Promise.all(ids.map(async (i) => {
          try { const s = await bar.collection('pessoas').doc(i).get(); out[i] = { name: (s.exists && s.data().nome) || 'Alguém' }; }
          catch (e) { out[i] = { name: 'Alguém' }; }
        }));
        return out;
      },
    };
    return { db, usuario };
  }

  /* ---------------- Modo local (só neste aparelho) ---------------- */
  function bancoLocal() {
    const KEY = 'app-bar-db:' + location.pathname.split('/').pop();
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    let data = load();
    const listeners = new Set();
    const notify = () => listeners.forEach((l) => { try { l(); } catch (e) {} });
    const persist = () => { localStorage.setItem(KEY, JSON.stringify(data)); notify(); };
    window.addEventListener('storage', (e) => { if (e.key === KEY) { data = load(); notify(); } });
    const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    const coll = (name) => (data[name] = data[name] || {});
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const APPL = KEY.slice('app-bar-db:'.length).replace(/\.html?$/, '');
    const registrar = (c, id, op, dados) => histLocal({ app: APPL, col: c, id, op, dados: (() => { const j = JSON.stringify(dados ?? null); return j && j.length > 40000 ? JSON.stringify('(registro grande: foto)') : j; })(), quem: quem(), t: Date.now() });
    const docSnap = (c, id) => {
      const v = (data[c] || {})[id];
      return { id, exists: v !== undefined, data: () => (v === undefined ? undefined : clone(v)) };
    };
    const listen = (compute, cb) => {
      const fn = () => cb(compute());
      listeners.add(fn);
      setTimeout(fn, 0);
      return () => listeners.delete(fn);
    };
    const OPS = {
      '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b,
      '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
    };
    function docRef(c, id) {
      return {
        id,
        async get() { return docSnap(c, id); },
        async set(v, opt) { coll(c)[id] = opt && opt.merge ? { ...(coll(c)[id] || {}), ...clone(v) } : clone(v); persist(); registrar(c, id, 'set', coll(c)[id]); },
        async update(v) { coll(c)[id] = { ...(coll(c)[id] || {}), ...clone(v) }; persist(); registrar(c, id, 'update', coll(c)[id]); },
        async delete() { const antes = (data[c] || {})[id]; delete coll(c)[id]; persist(); registrar(c, id, 'delete', antes); },
        onSnapshot(cb) { return listen(() => docSnap(c, id), cb); },
      };
    }
    function query(c, filters = [], lim = Infinity, order = null) {
      const run = () => {
        let docs = Object.keys(data[c] || {}).map((id) => docSnap(c, id))
          .filter((d) => filters.every(([f, op, v]) => (OPS[op] || OPS['=='])(d.data()[f], v)));
        if (order) {
          const [f, dir] = order;
          docs.sort((a, b) => (a.data()[f] > b.data()[f] ? 1 : a.data()[f] < b.data()[f] ? -1 : 0) * (dir === 'desc' ? -1 : 1));
        }
        docs = docs.slice(0, lim);
        return { docs, size: docs.length, empty: !docs.length, forEach: (f) => docs.forEach(f) };
      };
      return {
        where: (f, op, v) => query(c, [...filters, [f, op, v]], lim, order),
        orderBy: (f, dir) => query(c, filters, lim, [f, dir]),
        limit: (n) => query(c, filters, n, order),
        async get() { return run(); },
        onSnapshot(cb) { return listen(run, cb); },
      };
    }
    return {
      collection(c) {
        return Object.assign(query(c), {
          doc: (id) => docRef(c, id || newId()),
          async add(v) { const id = newId(); coll(c)[id] = clone(v); persist(); registrar(c, id, 'add', coll(c)[id]); return docRef(c, id); },
        });
      },
      doc(path) { const [c, id] = path.split('/'); return docRef(c, id); },
    };
  }
  let local = null;
  const usuarioLocal = {
    isOwner: async () => true,
    id: async () => 'este-aparelho',
    canEdit: () => true,
    can: () => true,
    profiles: async (ids) => Object.fromEntries(ids.map((i) => [i, { name: 'Este aparelho' }])),
  };

  async function escolher() {
    try {
      const n = await iniciarNuvem();
      if (n) return n;
    } catch (e) {
      console.warn('Firebase indisponível, usando dados só deste aparelho:', e);
    }
    local = local || bancoLocal();
    return { db: local, usuario: usuarioLocal };
  }

  /* ---------------- Importar dados (aba Ajustes) ----------------
   * dados = { apps: { caixa: { cxdays: { id: {...} } }, portaria: {...}, estoque: {...} } }
   * Grava cada documento no banco que a aba usa: no Firebase (se estiver ligado)
   * ou no banco deste aparelho. Documentos com o mesmo id são substituídos. */
  window.__barImportar = async function (dados) {
    const apps = (dados && dados.apps) || {};
    let total = 0;
    const c = await iniciarCore().catch(() => null);
    if (c) {
      let lote = c.bar.firestore.batch();
      let n = 0;
      for (const [app, cols] of Object.entries(apps)) {
        for (const [col, docs] of Object.entries(cols)) {
          for (const [id, v] of Object.entries(docs)) {
            lote.set(c.bar.collection(app + '_' + col).doc(id), v);
            total++;
            if (++n === 400) { await lote.commit(); lote = c.bar.firestore.batch(); n = 0; }
          }
        }
      }
      if (n) await lote.commit();
      return { total, onde: 'nuvem' };
    }
    for (const [app, cols] of Object.entries(apps)) {
      const KEY = 'app-bar-db:' + app + '.html';
      let atual = {};
      try { atual = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
      for (const [col, docs] of Object.entries(cols)) {
        atual[col] = atual[col] || {};
        for (const [id, v] of Object.entries(docs)) { atual[col][id] = v; total++; }
      }
      localStorage.setItem(KEY, JSON.stringify(atual));
    }
    return { total, onde: 'aparelho' };
  };

  /* ---------------- Apagar registros (Ferramentas → editor avançado) ---------------- */
  window.__barApagar = async function (app, col, ids) {
    if (!ids || !ids.length) return 0;
    const c = await iniciarCore().catch(() => null);
    if (c) {
      for (const id of ids) await c.bar.collection(app + '_' + col).doc(id).delete();
      return ids.length;
    }
    const KEY = 'app-bar-db:' + app + '.html';
    let atual = {};
    try { atual = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    ids.forEach((id) => { if (atual[col]) delete atual[col][id]; });
    localStorage.setItem(KEY, JSON.stringify(atual));
    return ids.length;
  };

  /* ---------------- Exportar tudo (aba Backup) ----------------
   * Junta Caixa, Portaria e Estoque no mesmo formato que __barImportar aceita.
   * O Caixa vem do próprio celular (é onde ele grava primeiro); Portaria e Estoque vêm
   * do Firebase, se estiver ligado, ou do banco deste aparelho. */
  const COLECOES = { portaria: ['entradas', 'log', 'config', 'saidas'], estoque: ['items', 'mov', 'meta', 'price', 'pg', 'cont'], cardapio: ['itens', 'vendas', 'config'] };
  // Totais da portaria de uma noite (para o fechamento do Caixa puxar sozinho): dinheiro, pix, cartão
  window.__barPortariaNoite = async function (noite) {
    const c = await iniciarCore().catch(() => null);
    let ents = [];
    if (c) { const s = await c.bar.collection('portaria_entradas').where('noite', '==', noite).get(); ents = s.docs.map((d) => d.data()); }
    else { let local = {}; try { local = JSON.parse(localStorage.getItem('app-bar-db:portaria.html')) || {}; } catch (e) {} ents = Object.values(local.entradas || {}).filter((e) => e.noite === noite); }
    const t = { dinheiro: 0, pix: 0, cartao: 0 }; let cort = 0;
    ents.forEach((e) => { const v = Math.round((Number(e.valor) || 0) * 100); if (e.pg in t) t[e.pg] += v; else if (e.pg === 'cortesia') cort++; });
    return { n: ents.length, pd: t.dinheiro / 100, pp: t.pix / 100, pc: t.cartao / 100, cort, mp: ents.filter((e) => e.mp).length };
  };
  window.__barExportar = async function () {
    const apps = {};
    const t = Date.now();
    let days = {}, meta = {};
    try { days = JSON.parse(localStorage.getItem('caixa-bar') || '{}'); } catch (e) {}
    try { meta = JSON.parse(localStorage.getItem('caixa-bar-meta') || '{}'); } catch (e) {}
    const cxdays = {}, cxmeta = {};
    Object.keys(days).forEach((k) => { const m = k.slice(0, 7); (cxdays[m] = cxdays[m] || {})[k] = days[k]; });
    Object.keys(cxdays).forEach((m) => { cxdays[m] = { j: JSON.stringify(cxdays[m]), t }; });
    Object.keys(meta).forEach((k) => { const j = JSON.stringify(meta[k]); if (j !== undefined) cxmeta[k] = { j, t }; });
    apps.caixa = { cxdays, cxmeta };
    const c = await iniciarCore().catch(() => null);
    for (const [app, cols] of Object.entries(COLECOES)) {
      apps[app] = {};
      if (c) {
        for (const col of cols) {
          const s = await c.bar.collection(app + '_' + col).get();
          apps[app][col] = {};
          s.docs.forEach((d) => { apps[app][col][d.id] = d.data(); });
        }
      } else {
        let local = {};
        try { local = JSON.parse(localStorage.getItem('app-bar-db:' + app + '.html')) || {}; } catch (e) {}
        cols.forEach((col) => { apps[app][col] = local[col] || {}; });
      }
    }
    return { tipo: 'bar-backup', versao: 1, criado: new Date().toISOString(), apps };
  };

  window.__barHistorico = async function (limite = 200) {
    const c = await iniciarCore().catch(() => null);
    if (c) {
      const s = await c.bar.collection('historico').orderBy('t', 'desc').limit(limite).get();
      return { onde: 'nuvem', dono: c.dono, itens: s.docs.map((d) => ({ hid: d.id, ...d.data() })) };
    }
    let h = [];
    try { h = JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch (e) {}
    return { onde: 'aparelho', dono: true, itens: h.slice(-limite).reverse().map((x, i) => ({ hid: 'l' + i, ...x })) };
  };

  window.claude = {
    async use(what) {
      const m = await escolher();
      if (what === 'db') return m.db;
      if (what === 'user') return m.usuario;
      return null;
    },
  };
})();
