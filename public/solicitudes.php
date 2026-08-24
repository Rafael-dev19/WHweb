<?php
require_once dirname(__DIR__) . '/includes/config.php';

// ── Guarda de acceso: solicitudes requiere sesión activa y correo verificado ──
if (empty($_SESSION['cliente_id'])) {
    $_SESSION['_flash'] = ['msg' => 'Debes iniciar sesión para acceder a las solicitudes.'];
    header('Location: /inicio');
    exit;
}
if (empty($_SESSION['cliente_email_verified'])) {
    $_SESSION['_flash'] = ['msg' => 'Debes verificar tu correo electrónico antes de realizar solicitudes. Revisa tu bandeja de entrada.'];
    header('Location: /inicio');
    exit;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Solicitudes - Wooden House</title>
  <meta name="description" content="Solicita una cotización personalizada o agenda una visita técnica con Wooden House. Asesoría gratuita para tu proyecto de muebles a medida.">
  
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="./assets/<?= av('css/variables.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/solicitudes.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/theme-toggle.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/animations.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/modal-auth.css') ?>">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous" defer></script>
</head>
<body>

  <div class="header-nav">
    <div class="logo">
      <a href="/inicio" aria-label="Wooden House – ir al inicio" style="display:block;line-height:0;">
        <img src="/assets/img/logo-header.png" alt="Wooden House" style="height:80px;">
      </a>
    </div>

    <div class="nav-links" id="navLinks">
      <a href="/inicio" title="Volver al inicio">Inicio</a>
      <a href="/catalogo" title="Ver todos los muebles y precios">Catálogo</a>
      <a href="/seguimiento" title="Consulta el estado de tu pedido, cita o cotización">Seguimiento</a>
      <a href="/carrito" class="cart-icon" aria-label="Ver carrito" title="Ver mi carrito de compras">
        <i class="fa-solid fa-cart-shopping"></i> <span class="cart-badge" id="cartCount">0</span>
      </a>
      <button class="btn-cuenta-nav" title="Iniciar sesión o ver mi cuenta">
        <i class="fa-solid fa-user"></i> Iniciar sesión
      </button>
    </div>
  </div>

  <main id="contenido-principal">
  <div class="container">
    <h1 class="page-title"><i class="fa-solid fa-clipboard-list"></i> Centro de Solicitudes</h1>
    <p class="page-subtitle">
      ¿No sabes qué opción elegir? Usa la guía rápida de abajo.
    </p>

    <div id="alertMessage" class="alert"></div>

    <!-- ── Decisor visual: ¿qué necesitas hoy? ───────────────────── -->
    <div class="sol-decision-grid wh-reveal">
      <div class="sol-decision-card sol-decision-card--cot" data-tab-goto="cotizacion">
        <div class="sol-dec-icon"><i class="fa-solid fa-file-invoice-dollar"></i></div>
        <div class="sol-dec-info">
          <strong>Ya sé lo que quiero</strong>
          <span>Tengo medidas o ideas y quiero un precio</span>
        </div>
        <div class="sol-dec-badge">Cotización →</div>
        <div class="sol-dec-detail">
          <i class="fa-solid fa-clock"></i> Respuesta en 24 horas por correo
        </div>
      </div>
      <div class="sol-decision-card sol-decision-card--cita" data-tab-goto="cita">
        <div class="sol-dec-icon"><i class="fa-solid fa-house-chimney-user"></i></div>
        <div class="sol-dec-info">
          <strong>Necesito asesoría presencial</strong>
          <span>Quiero que vayan a medir y aconsejarme a mi domicilio</span>
        </div>
        <div class="sol-dec-badge">Agendar Cita →</div>
        <div class="sol-dec-detail">
          <i class="fa-solid fa-location-dot"></i> Vamos a tu domicilio · ZMG
        </div>
      </div>
    </div>

    <!-- TAB 1: COTIZACIÓN -->
    <div id="tab-cotizacion" class="tab-content active">
      <div class="info-box">
        <h4><i class="fa-solid fa-file-invoice-dollar"></i> Cotizador rápido — respuesta en 24 horas</h4>
        <p><strong>¿Cuándo usar esta opción?</strong> Cuando quieres una idea rápida de tu proyecto antes de comprometerte.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fa-solid fa-check" style="color:#8b7355;"></i> No requiere visita</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fa-solid fa-check" style="color:#8b7355;"></i> Respuesta en 24 hrs</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fa-solid fa-check" style="color:#8b7355;"></i> Sin compromiso</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fa-solid fa-check" style="color:#8b7355;"></i> 100% gratis</div>
        </div>
        <p style="margin-top:12px;font-size:13px;color:#e0b060;background:#3a2f1a;border-radius:8px;padding:10px 12px;">
          <i class="fa-solid fa-triangle-exclamation"></i> <strong>Este cotizador es solo un estimado rápido, no un precio final.</strong>
          Si necesitas la información ya, envíala así. Si la quieres exacta, genera tu cotización y espera nuestra respuesta:
          el jefe la revisará, te la responderá por correo y agendaremos una visita para confirmar medidas y darte un precio real.
        </p>
      </div>

      <form id="formCotizacion" autocomplete="off">
        <!-- ANTI-BOT: Campo trampa oculto - los bots llenarán esto, los humanos no -->
        <div style="position:absolute;left:-9999px;top:-9999px;opacity:0;height:0;overflow:hidden;" aria-hidden="true">
          <label>No llenar este campo <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        </div>
        <div class="form-section">
          <h2 class="section-title"><i class="fa-solid fa-phone"></i> Información de Contacto</h2>
          <div class="row g-3">
            <div class="col-12 form-group">
              <label>Nombre Completo <span class="required">*</span></label>
              <input type="text" name="nombre" placeholder="Ej: Juan Pérez López" required maxlength="100" autocomplete="name" spellcheck="false">
            </div>
            <div class="col-md-6 form-group">
              <label>Teléfono <span class="required">*</span></label>
              <input type="tel" name="telefono" placeholder="33 1234 5678" autocomplete="tel" required maxlength="20">
              <div class="help-text">Usaremos este número para contactarte</div>
            </div>
            <div class="col-md-6 form-group">
              <label>Correo Electrónico <span class="required">*</span></label>
              <input type="email" name="email" placeholder="correo@ejemplo.com" autocomplete="email" required maxlength="150">
              <div class="help-text">Te enviaremos la cotización detallada aquí</div>
            </div>
            <div class="col-md-6 form-group">
              <label>Confirmar Correo Electrónico <span class="required">*</span></label>
              <input type="email" name="emailConfirm" placeholder="correo@ejemplo.com" required maxlength="150" autocomplete="off" autocorrect="off" spellcheck="false">
              <div class="help-text">Escribe tu correo nuevamente para confirmarlo</div>
            </div>
            <div class="col-12 form-group">
              <div class="wh-info-box" style="margin-bottom:10px;">
                <i class="fa-solid fa-location-dot"></i>
                <span>Busca tu dirección y confirma la ubicación en el mapa — así llegamos exacto el día de la visita o instalación.</span>
              </div>
              <div id="cotMapPickerContainer" class="form-group"></div>
              <div style="text-align:right;margin-top:-4px;margin-bottom:4px;">
                <button type="button" id="cotBtnSkipMapa"
                  style="background:none;border:none;color:var(--muted,#888);font-size:12px;cursor:pointer;text-decoration:underline;padding:0;">
                  Ingresar dirección manualmente
                </button>
              </div>
              <input type="hidden" name="direccion" id="cotDireccion">
              <input type="hidden" name="colonia"   id="cotColonia">
              <input type="hidden" name="ciudad"    id="cotCiudad">
              <input type="hidden" name="municipio" id="cotMunicipio">
              <input type="hidden" name="cp"        id="cotCP">
              <input type="hidden" name="lat"       id="cotLat">
              <input type="hidden" name="lng"       id="cotLng">
              <div id="cotDireccionDetalleEdit" style="display:none;margin-top:6px;">
                <p style="font-size:12px;color:var(--muted);margin-bottom:8px;"><i class="fa-solid fa-pen-to-square"></i> Ingresa o corrige tu dirección:</p>
                <div class="row g-2">
                  <div class="col-md-8 form-group" style="margin-bottom:8px;">
                    <label style="font-size:12px;">Calle y número</label>
                    <input type="text" id="cotDireccionEdit" placeholder="Calle y número" style="font-size:13px;">
                  </div>
                  <div class="col-md-4 form-group" style="margin-bottom:8px;">
                    <label style="font-size:12px;">CP</label>
                    <input type="text" id="cotCPEdit" placeholder="45000" maxlength="5" style="font-size:13px;">
                  </div>
                </div>
                <div class="row g-2">
                  <div class="col-md-4 form-group" style="margin-bottom:8px;">
                    <label style="font-size:12px;">Colonia</label>
                    <input type="text" id="cotColoniaEdit" placeholder="Colonia" style="font-size:13px;">
                  </div>
                  <div class="col-md-4 form-group" style="margin-bottom:8px;">
                    <label style="font-size:12px;">Ciudad</label>
                    <input type="text" id="cotCiudadEdit" placeholder="Ciudad" style="font-size:13px;">
                  </div>
                  <div class="col-md-4 form-group" style="margin-bottom:8px;">
                    <label style="font-size:12px;">Municipio</label>
                    <input type="text" id="cotMunicipioEdit" placeholder="Municipio" style="font-size:13px;">
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="form-section">
          <h2 class="section-title"><i class="fa-solid fa-ruler-combined"></i> Especificaciones del Proyecto</h2>
          <div class="row g-3">
            <div class="col-md-6 form-group">
              <label>Tipo de proyecto <span class="required">*</span></label>
              <select name="tipoMueble" required>
                <option value="">Selecciona una opción</option>
                <option value="cocina">Cocina</option>
                <option value="closet">Closet</option>
                <option value="lavamanos">Lavamanos</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div class="col-12 form-group">
              <label>Medidas del espacio (aproximadas)
                <span class="wh-help" data-tip="Ancho (x) = de izquierda a derecha. Alto (y) = de piso a techo. Fondo (z) = qué tan profundo entra hacia la pared. No necesitan ser exactas.">?</span>
              </label>
              <div class="row g-2">
                <div class="col-4 form-group" style="margin-bottom:0;">
                  <label style="font-size:12px;">Ancho — x (m)</label>
                  <input type="number" name="anchoEspacio" min="0" step="0.01" placeholder="Ej: 2.50" style="font-size:13px;">
                </div>
                <div class="col-4 form-group" style="margin-bottom:0;">
                  <label style="font-size:12px;">Alto — y (m)</label>
                  <input type="number" name="altoEspacio" min="0" step="0.01" placeholder="Ej: 2.40" style="font-size:13px;">
                </div>
                <div class="col-4 form-group" style="margin-bottom:0;">
                  <label style="font-size:12px;">Fondo — z (m)</label>
                  <input type="number" name="fondoEspacio" min="0" step="0.01" placeholder="Ej: 0.60" style="font-size:13px;">
                </div>
              </div>
              <div class="help-text">x = ancho del espacio, y = altura (piso a techo), z = qué tan hondo entra hacia la pared. Aproximadas está bien.</div>
            </div>

            <div class="col-12 form-group">
              <label>Descripción — ¿cómo te imaginas tu proyecto? <span class="required">*</span></label>
              <textarea name="descripcion" placeholder="Describe tu proyecto: estilo, colores, materiales, funcionalidades (cajones, puertas, iluminación), etc." required maxlength="1000"></textarea>
              <div class="help-text">Entre más detalles proporciones, más precisa será la cotización</div>
            </div>

            <div class="col-md-6 form-group">
              <label>Fotos del espacio
                <span class="wh-help" data-tip="Fotos de dónde va tu proyecto — nos ayudan muchísimo a darte una idea más precisa.">?</span>
              </label>
              <input type="file" name="fotosEspacio" id="cotFotosEspacio" accept="image/jpeg,image/jpg,image/png,image/webp" multiple>
              <div class="help-text">Opcional pero muy recomendado. Solo imágenes (jpg, png, webp), máx. 5.</div>
            </div>

            <div class="col-md-6 form-group">
              <label>Boceto o imagen de referencia (opcional)</label>
              <input type="file" name="boceto" id="cotBoceto" accept="image/jpeg,image/jpg,image/png,image/webp" multiple>
              <div class="help-text">Si tienes una imagen de Pinterest, un dibujo, o algo similar a lo que buscas.</div>
            </div>

            <div class="col-md-6 form-group">
              <label>Tiempo estimado de necesidad
                <span class="wh-help" data-tip="Indícanos si tienes urgencia. Si necesitas el mueble antes de un mes, lo priorizamos en el taller.">?</span>
              </label>
              <select name="urgencia">
                <option value="">Selecciona un plazo</option>
                <option value="urgente">Menos de 1 mes</option>
                <option value="1-3meses">1 a 3 meses</option>
                <option value="flexible">Sin prisa, evaluando opciones</option>
              </select>
            </div>
          </div>
        </div>

        <div class="info-box success">
          <h4><i class="fa-solid fa-circle-check"></i> Asesoría personalizada en 24 horas</h4>
          <p>Revisaremos tu solicitud y nos pondremos en contacto contigo dentro de las próximas 24 horas con una cotización personalizada.</p>
        </div>

        <button type="submit" class="btn-submit"><i class="fa-solid fa-clipboard-list"></i> Solicitar Asesoría y Cotización</button>
      </form>
      <div class="tab-nav-bottom">
        <a href="/inicio" class="btn-tab-nav btn-tab-back"><i class="fa-solid fa-arrow-left"></i> Volver al inicio</a>
        <button type="button" class="btn-tab-nav btn-tab-next" data-tab-goto="cita">Agendar Cita <i class="fa-solid fa-arrow-right"></i></button>
      </div>
    </div>

    <!-- TAB 2: AGENDAR CITA -->
    <div id="tab-cita" class="tab-content">
      <div class="info-box" style="border-left-color:#5b9aad;">
        <h4 style="color:#7ec4d8;"><i class="fa-solid fa-house-chimney-user"></i> Visita a tu domicilio — asesoría completa en persona</h4>
        <p><strong>¿Cuándo usar esta opción?</strong> Cuando prefieres que vayamos a tu casa a medir, evaluar el espacio y darte recomendaciones de diseño en persona.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fa-solid fa-check" style="color:#5b9aad;"></i> Medición profesional</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fa-solid fa-check" style="color:#5b9aad;"></i> Asesoría en persona</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fa-solid fa-check" style="color:#5b9aad;"></i> Evaluación del espacio</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fa-solid fa-check" style="color:#5b9aad;"></i> Cotización después</div>
        </div>
        <p style="margin-top:10px;font-size:13px;color:#888;"><i class="fa-solid fa-location-dot"></i> Atendemos toda la Zona Metropolitana de Guadalajara (ZMG).</p>
      </div>

      <form id="formCita" autocomplete="off">
        <!-- ANTI-BOT: Campo trampa oculto - los bots llenarán esto, los humanos no -->
        <div style="position:absolute;left:-9999px;top:-9999px;opacity:0;height:0;overflow:hidden;" aria-hidden="true">
          <label>No llenar este campo <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        </div>
        <div class="form-section">
          <h2 class="section-title"><i class="fa-solid fa-user"></i> Información de Contacto</h2>
          <div class="row g-3">
            <div class="col-md-6 form-group">
              <label>Nombre Completo <span class="required">*</span></label>
              <input type="text" name="nombre" placeholder="Ej: Juan Pérez" required maxlength="100" autocomplete="name" spellcheck="false">
            </div>
            <div class="col-md-6 form-group">
              <label>Teléfono <span class="required">*</span></label>
              <input type="tel" name="telefono" placeholder="33 1234 5678" autocomplete="tel" required maxlength="20">
            </div>
            <div class="col-md-6 form-group">
              <label>Correo Electrónico <span class="required">*</span></label>
              <input type="email" name="email" placeholder="correo@ejemplo.com" autocomplete="email" required maxlength="150">
            </div>
            <div class="col-md-6 form-group">
              <label>Confirmar Correo Electrónico <span class="required">*</span></label>
              <input type="email" name="emailConfirm" placeholder="correo@ejemplo.com" required maxlength="150" autocomplete="off" autocorrect="off" spellcheck="false">
              <div class="help-text">Escribe tu correo nuevamente para confirmarlo</div>
            </div>

            <div class="col-12 form-group">
              <label>Dirección <span class="required">*</span></label>
              <input type="text" name="direccion" placeholder="Calle y número" maxlength="255" autocomplete="street-address" required>
              <div class="help-text">Requerida para la visita a domicilio</div>
            </div>
            <div class="col-md-6 form-group">
              <label>Colonia</label>
              <input type="text" name="colonia" placeholder="Ej: Col. Providencia" maxlength="120" autocomplete="address-line2">
            </div>
            <div class="col-md-6 form-group">
              <label>Municipio / Alcaldía</label>
              <input type="text" name="municipio" placeholder="Ej: Zapopan" maxlength="100">
            </div>
            <div class="col-md-6 form-group">
              <label>Ciudad</label>
              <input type="text" name="ciudad" placeholder="Ej: Guadalajara" maxlength="100" autocomplete="address-level2">
            </div>
            <div class="col-md-6 form-group">
              <label>Código Postal</label>
              <input type="text" name="cp" placeholder="Ej: 44100" maxlength="10" autocomplete="postal-code">
            </div>
          </div>
        </div>

        <div class="form-section">
          <h2 class="section-title"><i class="fa-solid fa-calendar-days"></i> Fecha y Hora</h2>
          <div class="row g-3">
            <div class="col-md-6 form-group">
              <label>Fecha Preferida <span class="required">*</span>
                <span class="wh-help" data-tip="Elige el día que más te convenga. Solo aparecen días hábiles (lunes a viernes). Si necesitas fin de semana, contáctanos directamente.">?</span>
              </label>
              <input type="date" name="fecha" id="fechaCita" required data-onchange="cargarSlotsDisponibles">
            </div>

            <div class="col-12 form-group">
              <label>Horarios Disponibles <span class="required">*</span>
                <span class="wh-help" data-tip="Los horarios en verde están disponibles. Los grises ya fueron reservados por otros clientes. Selecciona uno para agendarlo.">?</span>
              </label>
              <div class="time-slots" id="timeSlots">
                <div style="color:var(--muted,#888);font-size:14px;padding:10px;grid-column:1/-1;">
                  Selecciona una fecha para ver horarios disponibles
                </div>
              </div>
              <div class="help-text">Los horarios en gris ya están ocupados para esa fecha</div>
            </div>
          </div>
        </div>

        <div class="info-box success">
          <h4><i class="fa-solid fa-circle-check"></i> Confirmación y Preparación</h4>
          <p>Recibirás confirmación inmediata por correo electrónico.</p>
        </div>

        <div class="info-box warning">
          <h4><i class="fa-solid fa-clipboard-list"></i> Después de la Visita</h4>
          <p>En 2-3 días hábiles recibirás: cotización, renders 3D, especificaciones, y timeline.</p>
        </div>

        <button type="submit" class="btn-submit"><i class="fa-solid fa-calendar-days"></i> Agendar Visita Técnica</button>
      </form>
      <div class="tab-nav-bottom">
        <button type="button" class="btn-tab-nav btn-tab-back" data-tab-goto="cotizacion"><i class="fa-solid fa-arrow-left"></i> Cotización</button>
        <a href="/seguimiento" class="btn-tab-nav btn-tab-next">Ver Seguimiento <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>&copy; <?= date('Y') ?> Wooden House. Todos los derechos reservados.</p>
    <p style="margin-top: 10px;">Muebles de madera a medida en Guadalajara, Jalisco</p>
    <p style="margin-top: 10px; font-size: 14px;">
      <a href="mailto:<?= SITE_EMAIL ?>" style="color: #8b7355;"><?= SITE_EMAIL ?></a> |
      <a href="tel:<?= sitePhoneDigits() ?>" style="color: #8b7355;"><?= SITE_PHONE ?></a>
    </p>
    <p style="margin-top:8px; font-size:12px;">
      <a href="/terminos" style="color:#8b7355; text-decoration:none;">Términos y Condiciones</a>
      &nbsp;·&nbsp;
      <a href="/privacidad" style="color:#8b7355; text-decoration:none;">Aviso de Privacidad</a>
    </p>
  </div>

  </main>

  <nav class="mobile-bottom-nav" aria-label="Navegación rápida">
    <div class="mobile-bottom-nav-inner">
      <a href="/catalogo" class="mbn-item"><i class="fa-solid fa-store"></i><span>Catálogo</span></a>
      <a href="/solicitudes" class="mbn-item mbn-item--active"><i class="fa-solid fa-file-invoice"></i><span>Solicitar</span></a>
      <a href="/seguimiento" class="mbn-item"><i class="fa-solid fa-magnifying-glass"></i><span>Seguimiento</span></a>
      <a href="/carrito" class="mbn-item"><span class="mbn-icon-wrap"><i class="fa-solid fa-cart-shopping"></i><span class="mbn-cart-badge"></span></span><span>Carrito</span></a>
      <button class="mbn-item" data-auth-action="openMenuMovil"><i class="fa-solid fa-user"></i><span>Mi cuenta</span></button>
    </div>
  </nav>

  <script src="./assets/<?= av('js/theme-toggle.js') ?>"></script>
<script src="./assets/<?= av('js/firebase-config.js') ?>"></script>
  <script src="./assets/<?= av('js/modal-auth.js') ?>"></script>
  <script src="./assets/<?= av('js/maps-picker.js') ?>"></script>
  <script src="./assets/<?= av('js/solicitudes.js') ?>"></script>
  <script src="./assets/<?= av('js/event-delegation.js') ?>"></script>
  <script src="./assets/<?= av('js/animations.js') ?>"></script>
  <?php if (defined('GOOGLE_MAPS_API_KEY') && GOOGLE_MAPS_API_KEY): ?>
  <script src="https://maps.googleapis.com/maps/api/js?key=<?= htmlspecialchars(GOOGLE_MAPS_API_KEY) ?>&libraries=places&callback=initMapsPickerReady&loading=async" async defer></script>
  <?php endif; ?>
</body>
</html>