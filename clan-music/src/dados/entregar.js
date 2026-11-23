// Entrega um arquivo ao usuário: no app Android usa o compartilhar nativo; no navegador, compartilhar ou baixar.
const b64 = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(blob); });
export async function entregar(blob, nome, titulo) {
  const P = window.Capacitor && window.Capacitor.Plugins;
  if (P && P.Filesystem && P.Share) {
    try {
      const r = await P.Filesystem.writeFile({ path: nome, data: await b64(blob), directory: 'CACHE' });
      await P.Share.share({ title: titulo, url: r.uri, dialogTitle: titulo }); return 'compartilhar';
    } catch (e) { if (e && /cancel/i.test(String(e.message || e))) return 'cancelado'; }
  }
  const file = new File([blob], nome, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: titulo }); return 'compartilhar'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelado'; }
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  return 'baixar';
}
