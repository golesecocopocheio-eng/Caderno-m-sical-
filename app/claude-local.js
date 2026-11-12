/* Banco de dados local para rodar fora do claude.ai.
 * Imita a parte de claude.use("db") / claude.use("user") usada pelos projetos,
 * guardando tudo no próprio aparelho (localStorage). Não muda nada no projeto original:
 * se o Claude estiver disponível, este arquivo não faz nada. */
(function () {
  if (typeof window.claude !== 'undefined') return;
  const KEY = 'app-bar-db:' + location.pathname.split('/').pop();
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  let data = load();
  const listeners = new Set();
  const persist = () => { localStorage.setItem(KEY, JSON.stringify(data)); notify(); };
  const notify = () => listeners.forEach((l) => { try { l(); } catch (e) {} });
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

  const db = {
    collection(c) {
      return Object.assign(query(c), {
        doc: (id) => docRef(c, id || newId()),
        async add(v) { const id = newId(); coll(c)[id] = clone(v); persist(); return docRef(c, id); },
      });
    },
    doc(path) { const [c, id] = path.split('/'); return docRef(c, id); },
  };

  window.claude = {
    async use(what) {
      if (what === 'db') return db;
      if (what === 'user') return { isOwner: async () => true };
      return null;
    },
  };
})();
