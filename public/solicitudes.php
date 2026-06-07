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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solicitudes - Wooden House</title>
  <meta name="description" content="Solicita una cotización personalizada o agenda una visita técnica con Wooden House. Asesoría gratuita para tu proyecto de muebles a medida.">
  
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="./assets/css/variables.css">
  <link rel="stylesheet" href="./assets/css/solicitudes.css?v=3">
  <link rel="stylesheet" href="./assets/css/animations.css">
  <link rel="stylesheet" href="./assets/css/modal-auth.css?v=4">
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
      <div class="sol-decision-card sol-decision-card--seg" data-tab-goto="seguimiento">
        <div class="sol-dec-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
        <div class="sol-dec-info">
          <strong>Ya envié una solicitud</strong>
          <span>Quiero ver el estado de mi pedido, cita o cotización</span>
        </div>
        <div class="sol-dec-badge">Ver estado →</div>
        <div class="sol-dec-detail">
          <i class="fa-solid fa-hashtag"></i> Busca por folio WH-, CIT- o COT-
        </div>
      </div>
    </div>

    <div class="tab-navigation" style="margin-top:24px;">
      <button class="tab-btn active" data-tab="cotizacion">
        <span class="tab-icon"><i class="fa-solid fa-file-invoice-dollar"></i></span>
        <span>Cotización</span>
      </button>
      <button class="tab-btn" data-tab="cita">
        <span class="tab-icon"><i class="fa-solid fa-house-chimney-user"></i></span>
        <span>Visita a domicilio</span>
      </button>
      <button class="tab-btn" data-tab="seguimiento">
        <span class="tab-icon"><i class="fa-solid fa-magnifying-glass"></i></span>
        <span>Seguimiento</span>
      </button>
    </div>

    <!-- TAB 1: COTIZACIÓN -->
    <div id="tab-cotizacion" class="tab-content active">
      <div class="info-box">
        <h4><i class="fa-solid fa-file-invoice-dollar"></i> Cotización en línea — respuesta en 24 horas</h4>
        <p><strong>¿Cuándo usar esta opción?</strong> Cuando ya tienes una idea del mueble que necesitas y quieres saber el precio antes de comprometerte.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fa-solid fa-check" style="color:#8b7355;"></i> No requiere visita</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fa-solid fa-check" style="color:#8b7355;"></i> Cotización detallada</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fa-solid fa-check" style="color:#8b7355;"></i> Respuesta en 24 hrs</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fa-solid fa-check" style="color:#8b7355;"></i> Sin compromiso</div>
        </div>
        <p style="margin-top:10px;font-size:13px;color:#888;"><i class="fa-solid fa-circle-info"></i> Si no tienes medidas exactas, no te preocupes — indícalas aproximadas y nuestro equipo te orientará.</p>
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
              <label>Dirección</label>
              <input type="text" name="direccion" placeholder="Calle y número" maxlength="255" autocomplete="street-address">
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
              <div class="help-text">Nos ayuda a calcular costos de envío/instalación</div>
            </div>
            <div class="col-md-6 form-group">
              <label>Código Postal</label>
              <input type="text" name="cp" placeholder="Ej: 44100" maxlength="10" autocomplete="postal-code">
            </div>
          </div>
        </div>

        <div class="form-section">
          <h2 class="section-title"><i class="fa-solid fa-ruler-combined"></i> Especificaciones del Proyecto</h2>
          <div class="row g-3">
            <div class="col-md-6 form-group">
              <label>Modelo de Mueble <span class="required">*</span>
                <span class="wh-help" data-tip="Si no estás seguro del modelo, selecciona 'Diseño Personalizado' y descríbelo en el campo de descripción. Puedes ver los modelos en nuestro catálogo.">?</span>
              </label>
              <select name="modeloMueble" required>
                <option value="">Selecciona una opción</option>
                <option value="sevilla">Modelo Sevilla</option>
                <option value="roma">Modelo Roma</option>
                <option value="edinburgo">Modelo Edinburgo</option>
                <option value="singapur">Modelo Singapur</option>
                <option value="sydney">Modelo Sydney</option>
                <option value="palermo">Modelo Palermo</option>
                <option value="budapest">Modelo Budapest</option>
                <option value="quebec">Modelo Quebec</option>
                <option value="toronto">Modelo Toronto</option>
                <option value="amsterdam">Modelo Amsterdam</option>
                <option value="oslo">Mueble Oslo</option>
                <option value="paris">Muebles Paris</option>
                <option value="tokio">Mueble Tokio</option>
                <option value="personalizado">Diseño Personalizado</option>
              </select>
            </div>

            <div class="col-md-6 form-group">
              <label>¿Tienes las medidas?
                <span class="wh-help" data-tip="Si tienes medidas aproximadas también puedes indicarlas — no necesitan ser exactas para obtener una cotización inicial.">?</span>
              </label>
              <select name="tieneMedidas" id="tieneMedidas">
                <option value="si">Sí, tengo las medidas</option>
                <option value="aproximadas">Tengo medidas aproximadas</option>
              </select>
            </div>

            <div class="col-12 form-group" id="medidasField">
              <label>Medidas del Mueble</label>
              <input type="text" name="medidas" placeholder="Ej: Ancho 2.5m x Alto 2.4m x Profundidad 0.6m" maxlength="300">
              <div class="help-text">Proporciona las medidas disponibles (alto, ancho, profundidad)</div>
            </div>

            <div class="col-12 form-group">
              <label>Descripción y Características Deseadas <span class="required">*</span></label>
              <textarea name="descripcion" placeholder="Describe tu proyecto: estilo, colores, materiales, funcionalidades (cajones, puertas, iluminación), etc." required maxlength="1000"></textarea>
              <div class="help-text">Entre más detalles proporciones, más precisa será la cotización</div>
            </div>

            <div class="col-md-6 form-group">
              <label>Presupuesto Estimado
                <span class="wh-help" data-tip="Es opcional y confidencial. Nos permite enfocar la propuesta en opciones que se ajusten a tu inversión sin mostrarte alternativas fuera de rango.">?</span>
              </label>
              <select name="presupuesto">
                <option value="">Selecciona un rango</option>
                <option value="5-20">$5,000 - $20,000</option>
                <option value="20-50">$20,000 - $50,000</option>
                <option value="50+">Más de $50,000</option>
              </select>
              <div class="help-text">Opcional: Nos ayuda a orientar mejor la propuesta</div>
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

            <div class="col-md-6 form-group">
              <label>¿Necesitas instalación?</label>
              <select name="instalacion">
                <option value="">Selecciona una opción</option>
                <option value="si">Sí, requiero instalación</option>
                <option value="no">No requiero instalación</option>
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
        <button type="button" class="btn-tab-nav btn-tab-next" data-tab-goto="seguimiento">Seguimiento <i class="fa-solid fa-arrow-right"></i></button>
      </div>
    </div>

    <!-- TAB 3: SEGUIMIENTO -->
    <div id="tab-seguimiento" class="tab-content">
      <div class="tracking-section">

        <div class="tracking-header">
          <div class="tracking-icon-circle">
            <i class="fa-solid fa-magnifying-glass"></i>
          </div>
          <h2 class="tracking-title">Consultar Estado de Solicitud</h2>
          <p class="tracking-subtitle">
            Ingresa el número de tu pedido, cotización o cita para ver su estado en tiempo real
          </p>
        </div>

        <div class="tracking-search-box">
          <div class="tracking-input-wrap">
            <i class="fa-solid fa-hashtag tracking-search-icon"></i>
            <input type="text" id="trackingNumber"
              placeholder="WH-2026-000001 · CIT-2026-000001 · COT-2026-000001"
              maxlength="25" autocomplete="off" autocapitalize="characters">
          </div>
          <button class="btn-track" data-call="trackOrder">
            <i class="fa-solid fa-search"></i> Buscar
          </button>
        </div>

        <div class="tracking-types-row">
          <div class="tracking-type-chip">
            <i class="fa-solid fa-box" style="color:#8b7355;"></i>
            <span><strong>WH-</strong> Pedido</span>
          </div>
          <div class="tracking-type-chip">
            <i class="fa-solid fa-calendar-days" style="color:#5b9aad;"></i>
            <span><strong>CIT-</strong> Cita</span>
          </div>
          <div class="tracking-type-chip">
            <i class="fa-solid fa-briefcase" style="color:#6aad7a;"></i>
            <span><strong>COT-</strong> Cotización</span>
          </div>
        </div>

        <div class="tracking-hint-box">
          <i class="fa-solid fa-envelope-open-text" style="color:#8b7355;font-size:20px;flex-shrink:0;"></i>
          <div>
            <strong style="color:#e0e0e0;">¿Dónde encuentro mi número?</strong>
            <p style="color:#a0a0a0;margin:4px 0 0;font-size:13px;">
              Te lo enviamos automáticamente por correo al registrar tu pedido, cita o cotización.
            </p>
          </div>
        </div>

        <!-- Resultado dinámico — lo llena trackOrder() desde el JS -->
        <div id="trackingResult"></div>

      </div>
      <div class="tab-nav-bottom">
        <button type="button" class="btn-tab-nav btn-tab-back" data-tab-goto="cita"><i class="fa-solid fa-arrow-left"></i> Agendar Cita</button>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>&copy; 2026 Wooden House. Todos los derechos reservados.</p>
    <p style="margin-top: 10px;">Muebles de madera a medida en Guadalajara, Jalisco</p>
    <p style="margin-top: 10px; font-size: 14px;">
      <a href="mailto:ventas@muebleswh.com" style="color: #8b7355;">ventas@muebleswh.com</a> |
      <a href="tel:3317054017" style="color: #8b7355;">33 1705 4017</a>
    </p>
    <p style="margin-top:8px; font-size:12px;">
      <a href="/terminos" style="color:#8b7355; text-decoration:none;">Términos y Condiciones</a>
      &nbsp;·&nbsp;
      <a href="/terminos#privacidad" style="color:#8b7355; text-decoration:none;">Aviso de Privacidad</a>
    </p>
  </div>

  <nav class="mobile-bottom-nav" aria-label="Navegación rápida">
    <div class="mobile-bottom-nav-inner">
      <a href="/inicio" class="mbn-item"><i class="fa-solid fa-house"></i><span>Inicio</span></a>
      <a href="/catalogo" class="mbn-item"><i class="fa-solid fa-store"></i><span>Catálogo</span></a>
      <a href="/solicitudes" class="mbn-item mbn-item--active"><i class="fa-solid fa-file-invoice"></i><span>Cotización</span></a>
      <a href="/carrito" class="mbn-item"><span class="mbn-icon-wrap"><i class="fa-solid fa-cart-shopping"></i><span class="mbn-cart-badge"></span></span><span>Carrito</span></a>
      <button class="mbn-item" data-auth-action="openMenuMovil"><i class="fa-solid fa-user"></i><span>Mi cuenta</span></button>
    </div>
  </nav>

  </main>
  <script src="./assets/js/firebase-config.js"></script>
  <script src="./assets/js/modal-auth.js?v=9"></script>
  <script src="./assets/js/solicitudes.js"></script>
  <script src="./assets/js/event-delegation.js"></script>
  <script src="./assets/js/animations.js"></script>
</body>
</html>