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
      await loadScript('vendor/firebase-firestore-compat.js');
      const fb = window.firebase;
      const app = fb.apps.length ? fb.app() : fb.initializeApp(cfg);
      const auth = app.auth();
      const fs = app.firestore();
      const emu = localStorage.getItem('bar-fb-emulador'); // só para testes
      if (emu) {
        const [host, fsPort, authPort] = emu.split(':');
        fs.useEmulator(host, Number(fsPort));
        auth.useEmulator('http://' + host + ':' + authPort, { disableWarnings: true });
      }
      fs.settings({ ignoreUndefinedProperties: true, merge: true });
      try { await fs.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* sem cache offline neste navegador */ }

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
      return { bar, user, dono: !!info && info.dono === user.uid };
    })();
    return core;
  }
  window.__barIniciarCore = iniciarCore;

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
    const doc = (ref) => ({
      id: ref.id,
      get: () => ref.get(),
      set: (v, o) => ref.set(copiar(v), copiar(o)),
      update: (v) => ref.update(copiar(v)),
      delete: () => ref.delete(),
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
        add: (v) => ref.add(copiar(v)).then(doc),
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
        async set(v, opt) { coll(c)[id] = opt && opt.merge ? { ...(coll(c)[id] || {}), ...clone(v) } : clone(v); persist(); },
        async update(v) { coll(c)[id] = { ...(coll(c)[id] || {}), ...clone(v) }; persist(); },
        async delete() { delete coll(c)[id]; persist(); },
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
          async add(v) { const id = newId(); coll(c)[id] = clone(v); persist(); return docRef(c, id); },
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

  window.claude = {
    async use(what) {
      const m = await escolher();
      if (what === 'db') return m.db;
      if (what === 'user') return m.usuario;
      return null;
    },
  };
})();
