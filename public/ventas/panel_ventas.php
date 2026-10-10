<?php
// ── Guardia de autenticación server-side ─────────────────────────
// Esto se hace ANTES de servir cualquier HTML
require_once dirname(__DIR__, 2) . "/includes/config.php";
require_once dirname(__DIR__, 2) . "/includes/db.php";
require_once dirname(__DIR__, 2) . "/includes/functions.php";
require_once dirname(__DIR__, 2) . "/includes/auth.php";

$_usuario = sesionActiva();
if (!$_usuario || $_usuario["rol"] !== "ventas") {
    header("Location: /acceso-denegado?area=ventas");
    exit;
}
unset($_usuario);
?>

<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
  <title>Panel Ventas - Wooden House</title>
  <!-- PWA: requerido para que iOS permita notificaciones push al agregar el
       panel a la pantalla de inicio (Safari no las soporta en pestaña normal). -->
  <link rel="manifest" href="/admin/manifest.json">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="WH Panel">
  <link rel="apple-touch-icon" href="/assets/img/logo-icon-maskable.png">
  <meta name="description" content="Panel de ventas de Wooden House. Pedidos, cotizaciones y agenda de citas.">
  <meta name="robots" content="noindex, nofollow">


  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="../assets/<?= av('css/panel_ventas.css') ?>">
  <link rel="stylesheet" href="../assets/<?= av('css/animations.css') ?>">
  <script src="/assets/vendor/lucide-1.55.0.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous" defer></script>
</head>

<body>
  <script nonce="<?= cspNonce() ?>">window.WH_ES_JEFE = false; window.WH_ROL = "ventas"; window.WH_VISTA_COMPLETA = false;</script>
  <div class="header">
    <div class="header-left">
    <button class="menu-toggle" id="menuToggle" aria-label="Abrir menú" aria-expanded="false">
      <i data-lucide="menu"></i>
    </button>
    <div class="logo">
      <img src="/assets/img/logo-header.png" alt="Wooden House" style="height:80px;" class="panel-logo">
    </div>
  </div>

    <div class="user-info">
      <button class="icon-btn" id="notifBtn" aria-label="Notificaciones" title="Notificaciones">
        <i data-lucide="bell"></i>
        <span class="badge-dot" id="notifDot"></span>
      </button>
      <div class="user-avatar" id="userAvatar">—</div>
      <span id="userNombreHeader">Cargando…</span>
      <button class="logout-btn" data-call="logoutAdmin">Salir</button>
    </div>
  </div>

  <div class="notif-panel" id="notifPanel">
    <div class="notif-head">
      <div class="notif-head-title">
        <i data-lucide="bell"></i>
        Notificaciones
      </div>
      <div class="notif-head-actions">
        <button class="btn btn-secondary btn-small" data-call="markAllNotifRead" title="Marcar todas como leídas"><i data-lucide="check-check"></i></button>
        <button class="btn btn-secondary btn-small" data-call="clearAllNotifs" title="Limpiar todo" style="color:var(--danger,#e57373);"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
    <div class="notif-body" id="notifBody"></div>
  </div>

  <div class="nav-links" id="navLinks" aria-hidden="true">
    <div class="nav-title">
      Menú Ventas
      <button class="nav-close" id="navClose" aria-label="Cerrar menú">×</button>
    </div>

    <a href="#" data-section="pedidos" class="active"><span class="icon"><i data-lucide="box"></i></span> Todos los Pedidos</a>
    <a href="#" data-section="citas"><span class="icon"><i data-lucide="calendar"></i></span> Calendario de Citas</a>
    <a href="#" data-section="cotizaciones"><span class="icon"><i data-lucide="briefcase"></i></span> Cotizaciones</a>
  </div>

  <div class="container">
    <aside class="sidebar">
      <div class="sidebar-section">GESTIÓN</div>
      <div class="sidebar-item active" data-section="pedidos"><span class="icon"><i data-lucide="box"></i></span><span>Todos los Pedidos</span></div>
      <div class="sidebar-item" data-section="citas"><span class="icon"><i data-lucide="calendar"></i></span><span>Calendario de Citas</span></div>
      <div class="sidebar-item" data-section="cotizaciones"><span class="icon"><i data-lucide="briefcase"></i></span><span>Cotizaciones</span></div>
    </aside>

    <main class="main-content">
      <!-- PEDIDOS -->
      <div id="pedidos-section" class="content-section">
        <h1 class="page-title">Gestión Total de Pedidos</h1>
        <p class="page-subtitle">Control completo de todos los pedidos</p>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Todos los Pedidos</h2>
            <button class="btn btn-primary" data-call="abrirModalCrearPedido"><i data-lucide="package-plus"></i> Crear pedido</button>
          </div>

          <div class="table-container">
            <div class="table-filters">
              <button class="filter-btn active" data-filter="all">Todos</button>
              <button class="filter-btn" data-filter="pending">Pendientes</button>
              <button class="filter-btn" data-filter="progress">En Proceso</button>
              <button class="filter-btn" data-filter="completed">Completados</button>
            </div>
            <div style="overflow:auto;">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Cliente</th>
                    <th>Correo</th>
                    <th>Fecha de Entrega</th>
                    <th>Estado</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="pedidosTable">
                  <tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px;"><i class="wh-icon-spin" data-lucide="loader-circle"></i> Cargando pedidos...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      <!-- CITAS / AGENDA — visible para los 3 roles de este panel (jefe,
           administrador, ventas); gestionar (editar/cancelar/agendar) sigue
           limitado a jefe/administrador/ventas del lado del servidor. -->
      <div id="citas-section" class="content-section hidden">
        <h1 class="page-title">Citas Programadas</h1>
        <p class="page-subtitle">Calendario visual y listado de todas las citas</p>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title"><i data-lucide="calendar"></i> Agenda del Mes</h2>
            <div style="display:flex; gap:8px; flex-wrap:wrap;align-items:center;">
              <button class="btn btn-secondary" data-call="prevMonth"><i data-lucide="chevron-left"></i></button>
              <button class="btn btn-secondary" data-call="nextMonth"><i data-lucide="chevron-right"></i></button>
              <button class="btn btn-secondary" data-call="refrescarCalendarioAdmin" title="Actualizar calendario" id="admCalRefreshBtn"><i data-lucide="refresh-cw"></i></button>
            </div>
          </div>

          <div class="calendar-wrap">
            <div class="calendar-toolbar">
              <div class="cal-title" id="calTitle">Cargando...</div>
              <div style="color:var(--muted); font-size:12px;">Toca un día para ver detalles</div>
            </div>

            <div class="calendar-grid" id="calendarDow">
              <div class="cal-dow">Lun</div><div class="cal-dow">Mar</div><div class="cal-dow">Mié</div>
              <div class="cal-dow">Jue</div><div class="cal-dow">Vie</div><div class="cal-dow">Sáb</div><div class="cal-dow">Dom</div>
            </div>

            <div class="calendar-grid" id="calendarGrid"></div>

            <div class="row g-3 cal-side">
              <div class="col-md-8">
                <div class="cal-list">
                  <div class="cal-list-head" id="dayHead" style="display:flex;justify-content:space-between;align-items:center;">
                    <span id="dayHeadLabel">Selecciona un día</span>
                    <button id="admRutaDiaBtn" class="btn btn-primary btn-small" style="display:none;" data-call="generarRutaDiaAdmin" data-args='[]'>
                      <i data-lucide="route"></i> Ruta
                    </button>
                  </div>
                  <div class="cal-list-body" id="dayList">
                    <div class="cal-item">
                      <div class="t">Toca un día del calendario</div>
                      <div class="m">Aquí verás las citas y asignaciones.</div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="cal-list">
                  <div class="cal-list-head">Próximas (vista rápida)</div>
                  <div class="cal-list-body" id="nextList"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Todas las Citas</h2>
            <button class="btn btn-secondary btn-small" data-call="cargarCitasCalendarioAPI">
              <i data-lucide="rotate-cw"></i> Actualizar
            </button>
          </div>

          <div class="table-container">
            <div style="overflow:auto;">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th><th>Cliente</th><th>ID Cliente</th><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Estado</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="citasTable">
                  <tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px;">
                    <i class="wh-icon-spin" data-lucide="loader-circle"></i> Cargando citas...
                  </td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- COTIZACIONES -->
      <div id="cotizaciones-section" class="content-section hidden">
        <h1 class="page-title">Gestión de Cotizaciones</h1>
        <p class="page-subtitle">Todas las solicitudes de cotización recibidas</p>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Cotizaciones</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-primary btn-small" data-call="abrirNuevaCotizacion">
                <i data-lucide="plus"></i> Crear cotización
              </button>
              <button class="btn btn-secondary btn-small" data-call="abrirCatalogoCotizador">
                <i data-lucide="tags"></i> Catálogo de precios
              </button>
              <button class="btn btn-secondary btn-small" data-call="cargarCotizacionesAPI">
                <i data-lucide="rotate-cw"></i> Actualizar
              </button>
            </div>
          </div>

          <div class="table-container">
            <div style="overflow:auto;">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Cliente</th>
                    <th>ID Cliente</th>
                    <th>Correo</th>
                    <th>Modelo de Mueble</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="cotizacionesAdminBody">
                  <tr><td colspan="8" style="text-align:center;padding:30px;color:var(--muted);">
                    <i class="wh-icon-spin" data-lucide="loader-circle"></i> Cargando cotizaciones...
                  </td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL: RUTA DEL DÍA (Admin) -->
      <div class="modal" id="admRutaDiaModal">
        <div class="modal-content" style="max-width:620px;width:min(620px,96vw);">
          <div class="modal-header" style="background:#1a3a4a;color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
            <h3 class="modal-title" style="color:#fff;display:flex;align-items:center;gap:10px;">
              <i data-lucide="route"></i> Ruta del Día
              <span id="admRutaDiaFechaLabel" style="font-size:13px;opacity:.75;font-weight:400;"></span>
            </h3>
            <button class="modal-close" data-dismiss="admRutaDiaModal" style="color:#fff;">×</button>
          </div>
          <div id="admRutaDiaBody" style="overflow-y:auto;min-height:120px;max-height:60vh;">
            <div style="text-align:center;padding:30px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>
          </div>
          <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <button class="btn btn-secondary" data-dismiss="admRutaDiaModal">Cerrar</button>
            <button id="admRutaDiaMapsBtn" class="btn btn-primary" style="display:none;">
              <i data-lucide="map-pinned"></i> Abrir en Google Maps
            </button>
          </div>
        </div>
      </div>

  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check-compat.js"></script>
  <script src="../assets/<?= av('js/theme-toggle.js') ?>"></script>
  <script src="../assets/<?= av('js/firebase-config.js') ?>"></script>
  <!-- ═══ MODAL: DETALLE PEDIDO (admin) ══════════════════════════ -->
  <div class="modal" id="adminPedidoDetalleModal">
    <div class="modal-content" style="max-width:900px;width:min(900px,96vw);">
      <div class="modal-header" style="background:var(--accent);color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
        <h3 class="modal-title" style="color:#fff;">
          <i data-lucide="box"></i> Detalle del Pedido
          <span id="adm_ped_folio" style="font-weight:900;margin-left:8px;opacity:.85;"></span>
        </h3>
        <button class="modal-close" data-dismiss="adminPedidoDetalleModal" style="color:#fff;">×</button>
      </div>
      <div id="adm_ped_body" style="overflow-x:auto;min-height:180px;">
        <div style="text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-dismiss="adminPedidoDetalleModal">Cerrar</button>
      </div>
    </div>
  </div>

  <?php include dirname(__DIR__) . '/_modal_pedido_manual.php'; ?>
  <?php include dirname(__DIR__) . '/_modal_cotizacion_manual.php'; ?>

  <!-- ═══ MODAL: DETALLE CITA (admin) ════════════════════════════ -->
  <div class="modal" id="adminCitaDetalleModal">
    <div class="modal-content" style="max-width:600px;">
      <div class="modal-header" style="background:#3d4d8b;color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
        <h3 class="modal-title" style="color:#fff;">
          <i data-lucide="calendar"></i> Detalle de Cita
          <span id="adm_cita_folio" style="font-weight:900;margin-left:8px;opacity:.85;"></span>
        </h3>
        <button class="modal-close" data-dismiss="adminCitaDetalleModal" style="color:#fff;">×</button>
      </div>
      <div id="adm_cita_body" style="overflow-x:auto;">
        <div style="text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;padding:12px 0 0;margin-top:4px;border-top:1px solid var(--border);">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-small" data-admin-cita-estado="confirmada">✅ Confirmar</button>
          <button class="btn btn-secondary btn-small" data-admin-cita-estado="completada">🏁 Completar</button>
          <button class="btn btn-danger btn-small"    data-admin-cita-estado="cancelada">❌ Cancelar</button>
          <button class="btn btn-primary btn-small" data-call="generarCotizacionDesdeCita">
            <i data-lucide="receipt"></i> Generar cotización
          </button>
        </div>
        <button class="btn btn-secondary" data-dismiss="adminCitaDetalleModal">Cerrar</button>
      </div>
    </div>
  </div>

  <!-- ═══ MODAL: CATÁLOGO DE PRECIOS DEL COTIZADOR (admin) ════════ -->
  <div class="modal" id="catalogoCotizadorModal">
    <div class="modal-content" style="max-width:640px;">
      <div class="modal-header" style="background:#8b7355;color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
        <h3 class="modal-title" style="color:#fff;"><i data-lucide="tags"></i> Catálogo de precios del cotizador</h3>
        <button class="modal-close" data-dismiss="catalogoCotizadorModal" style="color:#fff;">×</button>
      </div>
      <p style="color:var(--muted);font-size:12px;margin:0 0 12px;">
        Configura aquí el precio de cada partida una sola vez. Al cotizar, solo capturas cantidades y el total se calcula solo (los precios siguen siendo editables en cada cotización si hace falta un ajuste puntual).
      </p>
      <div id="catalogoCotizadorBody">
        <div style="text-align:center;padding:30px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>
      </div>
      <div style="border-top:1px solid var(--border);margin-top:14px;padding-top:14px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Agregar partida nueva</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <input type="text" id="catNombreNuevo" placeholder="Nombre (ej: Jaladera)" style="flex:1 1 140px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:13px;">
          <input type="text" id="catUnidadNuevo" placeholder="Unidad (pza, m2, ml…)" value="pza" style="width:110px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:13px;">
          <input type="number" id="catPrecioNuevo" placeholder="Precio" min="0" step="0.01" style="width:100px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:13px;">
          <button class="btn btn-primary btn-small" data-call="agregarPartidaCatalogoNueva"><i data-lucide="plus"></i> Agregar</button>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;padding:12px 0 0;">
        <button class="btn btn-secondary" data-dismiss="catalogoCotizadorModal">Cerrar</button>
      </div>
    </div>
  </div>

  <!-- ═══ MODAL: DETALLE COTIZACIÓN + COTIZADOR (admin) ═══════════ -->
  <div class="modal" id="adminCotDetalleModal">
    <div class="modal-content" style="max-width:1180px;width:min(1180px,97vw);">
      <div class="modal-header" style="background:#1e5c22;color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
        <h3 class="modal-title" style="color:#fff;">
          <i data-lucide="briefcase"></i> Detalle de Cotización
          <span id="adm_cot_folio" style="font-weight:900;margin-left:8px;opacity:.85;"></span>
        </h3>
        <button class="modal-close" data-dismiss="adminCotDetalleModal" style="color:#fff;">×</button>
      </div>
      <div id="adm_cot_body" style="overflow-x:auto;">
        <div style="text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;align-items:center;padding:12px 0 0;margin-top:4px;border-top:1px solid var(--border);">
        <button class="btn btn-secondary" data-dismiss="adminCotDetalleModal">Cerrar</button>
      </div>
    </div>
  </div>

  <script src="../assets/<?= av('js/metodo-cobro.js') ?>"></script>

  <script src="../assets/<?= av('js/panel_ventas.js') ?>"></script>
  <script src="../assets/<?= av('js/voice-recorder.js') ?>"></script>
  <script src="../assets/<?= av('js/pedido-manual.js') ?>"></script>
  <script src="../assets/<?= av('js/event-delegation.js') ?>"></script>
  <script src="../assets/<?= av('js/animations.js') ?>"></script>
  <script src="../assets/<?= av('js/sse-notificaciones.js') ?>"></script>
</body>
</html>