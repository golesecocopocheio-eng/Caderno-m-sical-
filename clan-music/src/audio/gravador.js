// Gravação pelo microfone. Sem filtros automáticos (eco, ruído e ganho) para não estragar voz e instrumento.
export const melhorMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';

export function erroAmigavel(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'O microfone está bloqueado. Libere a permissão do microfone para este app (nas configurações do Android ou no cadeado do Chrome) e tente de novo.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Não achei nenhum microfone neste aparelho.';
  if (n === 'NotReadableError' || n === 'AbortError') return 'O microfone está sendo usado por outro app. Feche o outro app e tente de novo.';
  return 'Não consegui ligar o microfone.';
}

export class Gravador {
  constructor(cb) { this.cb = cb; this.t = 0; this.t0 = 0; this.estado = 'parado'; this.n = 0; this.partes = []; }
  async iniciar() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) throw Object.assign(new Error('x'), { name: 'NotFoundError' });
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    const C = window.AudioContext || window.webkitAudioContext; this.ac = new C(); if (this.ac.state === 'suspended') await this.ac.resume();
    this.an = this.ac.createAnalyser(); this.an.fftSize = 1024; this.ac.createMediaStreamSource(this.stream).connect(this.an); this.buf = new Float32Array(this.an.fftSize);
    this.mime = melhorMime();
    this.mr = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime, audioBitsPerSecond: 128000 } : undefined);
    this.mr.ondataavailable = (e) => { if (e.data && e.data.size) { this.partes.push(e.data); this.cb.pedaco && this.cb.pedaco(e.data, this.n++); } };
    this.mr.onerror = () => this.cb.erro && this.cb.erro('A gravação foi interrompida. O que já foi gravado está guardado.');
    this.stream.getAudioTracks().forEach((t) => (t.onended = () => this.cb.erro && this.cb.erro('O microfone foi desligado. O que já foi gravado está guardado.')));
    this.mr.start(1000); this.estado = 'gravando'; this.t0 = performance.now(); this.t = 0;
    try { this.trava = navigator.wakeLock && (await navigator.wakeLock.request('screen')); } catch (e) {}
    this.laco();
  }
  duracao() { return this.estado === 'gravando' ? this.t + (performance.now() - this.t0) / 1000 : this.t; }
  laco() {
    const f = () => { if (!this.an) return; this.an.getFloatTimeDomainData(this.buf); let pico = 0, soma = 0; for (let i = 0; i < this.buf.length; i++) { const v = Math.abs(this.buf[i]); if (v > pico) pico = v; soma += v * v; }
      this.cb.nivel && this.cb.nivel({ pico, rms: Math.sqrt(soma / this.buf.length), seg: this.duracao(), estado: this.estado }); this.raf = requestAnimationFrame(f); };
    f();
  }
  pausar() { if (this.estado !== 'gravando') return; this.t += (performance.now() - this.t0) / 1000; this.mr.pause(); this.estado = 'pausado'; }
  continuar() { if (this.estado !== 'pausado') return; this.mr.resume(); this.t0 = performance.now(); this.estado = 'gravando'; }
  parar() {
    return new Promise((ok) => {
      const dur = this.duracao(); if (this.estado === 'gravando') this.t = dur; this.estado = 'parado';
      const fim = () => { const blob = new Blob(this.partes, { type: this.mime || (this.partes[0] && this.partes[0].type) || 'audio/webm' }); this.limpar(); ok({ blob, dur }); };
      if (this.mr.state === 'inactive') return fim();
      this.mr.onstop = fim; try { this.mr.stop(); } catch (e) { fim(); }
    });
  }
  limpar() { cancelAnimationFrame(this.raf); this.an = null; try { this.stream && this.stream.getTracks().forEach((t) => t.stop()); } catch (e) {} try { this.ac && this.ac.close(); } catch (e) {} try { this.trava && this.trava.release(); } catch (e) {} }
}
