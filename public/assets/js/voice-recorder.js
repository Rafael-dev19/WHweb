// voice-recorder.js — grabador de notas de voz reutilizable (MediaRecorder),
// usado por el modal "Crear pedido" (pedido-manual.js) y por el cotizador al
// responder una cotización (panel_administrador.js). Requiere un botón de
// grabar/detener, un span de tiempo transcurrido, una zona que se oculta al
// terminar, una vista previa con <audio> y un botón de borrar — todos por id.
//
// Uso:
//   const grabador = crearGrabadorAudio({
//     btnGrabarId: 'pm_btn_grabar', tiempoId: 'pm_audio_tiempo',
//     zonaId: 'pm_audio_zona', previewId: 'pm_audio_preview',
//     playerId: 'pm_audio_player', btnBorrarId: null, // null = sin botón propio, se llama borrar() a mano
//   });
//   grabador.tieneBlob() / grabador.getBlob() / grabador.borrar()

function crearGrabadorAudio({ btnGrabarId, tiempoId, zonaId, previewId, playerId, btnBorrarId }) {
  let mediaRecorder = null;
  let chunks   = [];
  let stream   = null;
  let timer    = null;
  let segundos = 0;
  let blob     = null;

  function _tiempoEl()  { return document.getElementById(tiempoId); }
  function _btnEl()     { return document.getElementById(btnGrabarId); }

  function _actualizarTiempo() {
    const el = _tiempoEl();
    if (!el) return;
    const m = String(Math.floor(segundos / 60)).padStart(2, '0');
    const s = String(segundos % 60).padStart(2, '0');
    el.textContent = `● ${m}:${s}`;
    segundos++;
  }

  async function toggle() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showNotification('Este navegador no soporta grabar audio.', 'error');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      showNotification('No se pudo acceder al micrófono. Revisa los permisos del navegador.', 'error');
      return;
    }
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
      clearInterval(timer);
      timer = null;

      blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });

      const zona = document.getElementById(zonaId);
      const preview = document.getElementById(previewId);
      if (zona) zona.style.display = 'none';
      if (preview) preview.style.display = 'block';
      const player = document.getElementById(playerId);
      if (player) player.src = URL.createObjectURL(blob);
    };
    mediaRecorder.start();

    segundos = 0;
    const btn = _btnEl();
    if (btn) {
      btn.innerHTML = '<i data-lucide="square"></i> Detener grabación';
      window.lucide?.createIcons();
    }
    const tiempo = _tiempoEl();
    if (tiempo) tiempo.style.display = 'inline';
    _actualizarTiempo();
    timer = setInterval(_actualizarTiempo, 1000);
  }

  function borrar() {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    clearInterval(timer);
    timer = null;
    blob = null;
    chunks = [];

    const zona = document.getElementById(zonaId);
    const preview = document.getElementById(previewId);
    const btn = _btnEl();
    const tiempo = _tiempoEl();
    if (zona) zona.style.display = 'block';
    if (preview) preview.style.display = 'none';
    if (btn) { btn.innerHTML = '<i data-lucide="mic"></i> Grabar nota de voz'; window.lucide?.createIcons(); }
    if (tiempo) { tiempo.style.display = 'none'; tiempo.textContent = '● 00:00'; }
  }

  document.getElementById(btnGrabarId)?.addEventListener('click', toggle);
  if (btnBorrarId) document.getElementById(btnBorrarId)?.addEventListener('click', borrar);

  return {
    getBlob: () => blob,
    tieneBlob: () => !!blob,
    borrar,
  };
}

window.crearGrabadorAudio = crearGrabadorAudio;
