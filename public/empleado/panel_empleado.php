<?php
// ── Guardia de autenticación server-side ─────────────────────────
require_once dirname(__DIR__, 2) . "/includes/config.php";
require_once dirname(__DIR__, 2) . "/includes/db.php";
require_once dirname(__DIR__, 2) . "/includes/functions.php";
require_once dirname(__DIR__, 2) . "/includes/auth.php";

$_usuario = sesionActiva();
if (!$_usuario || !in_array($_usuario["rol"], ["administrador", "empleado"], true)) {
    header("Location: /acceso-denegado?area=empleado");
    exit;
}
unset($_usuario);
?>

<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Panel Empleado - Wooden House</title>
  <meta name="description" content="Panel de empleados de Wooden House. Gestión de pedidos, cotizaciones y citas del personal.">
  <meta name="robots" content="noindex, nofollow">


  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="../assets/<?= av('css/panel_empleado.css') ?>">
  <link rel="stylesheet" href="../assets/<?= av('css/animations.css') ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous" defer></script>
</head>

<body>
  <div class="header">
    <div class="header-left">
    <button class="menu-toggle" id="menuToggle" aria-label="Abrir menú" aria-expanded="false">
      <i class="fa-solid fa-bars"></i>
    </button>
    <div class="logo">
      <img src="/assets/img/logo-header.png" alt="Wooden House" style="height:80px;" class="panel-logo">
    </div>
  </div>

    <div class="header-right">
      <button class="icon-btn" id="notifBtn" aria-label="Notificaciones" title="Notificaciones">
        <i class="fa-solid fa-bell"></i>
        <span class="badge-dot" id="notifDot"></span>
      </button>


      <div class="user-info">
        <div class="user-avatar">JP</div>
        <span id="empNombreHeader">Cargando...</span>
        <button class="logout-btn" data-call="logout">Salir</button>
      </div>
    </div>
  </div>

  <div class="notif-panel" id="notifPanel">
    <div class="notif-head">
      <div class="notif-head-title">
        <i class="fa-solid fa-bell"></i>
        Notificaciones
      </div>
      <div class="notif-head-actions">
        <button class="btn btn-secondary btn-small" data-call="markAllNotifRead" title="Marcar todas como leídas"><i class="fa-solid fa-check-double"></i></button>
        <button class="btn btn-secondary btn-small" data-call="clearAllNotifs" title="Limpiar todo" style="color:var(--danger,#e57373);"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
    <div class="notif-body" id="notifBody"></div>
  </div>

  <div class="nav-links" id="navLinks">
    <button class="nav-close" id="navClose" aria-label="Cerrar menú">×</button>
    <div class="nav-title">Panel Empleado</div>

    <a href="#" data-section="dashboard" class="active"><i class="fa-solid fa-chart-bar"></i> Dashboard</a>
    <a href="#" data-section="pedidos"><i class="fa-solid fa-box"></i> Gestión de Pedidos</a>
    <a href="#" data-section="citas"><i class="fa-solid fa-calendar-days"></i> Citas Programadas</a>
    <a href="#" data-section="cotizaciones"><i class="fa-solid fa-briefcase"></i> Cotizaciones</a>
    <a href="#" data-section="seguridad"><i class="fa-solid fa-shield-halved"></i> Seguridad</a>
  </div>

  <div class="container">
    <aside class="sidebar" id="sidebarDesktop">
      <div class="sidebar-item active" data-section="dashboard">
        <span class="icon"><i class="fa-solid fa-chart-bar"></i></span>
        <span>Dashboard</span>
      </div>

      <div class="sidebar-section">GESTIÓN</div>

      <div class="sidebar-item" data-section="pedidos">
        <span class="icon"><i class="fa-solid fa-box"></i></span>
        <span>Gestión de Pedidos</span>
      </div>

      <div class="sidebar-item" data-section="citas">
        <span class="icon"><i class="fa-solid fa-calendar-days"></i></span>
        <span>Citas Programadas</span>
      </div>

      <div class="sidebar-item" data-section="cotizaciones">
        <span class="icon"><i class="fa-solid fa-briefcase"></i></span>
        <span>Cotizaciones</span>
      </div>

      <div class="sidebar-section">MI CUENTA</div>
      <div class="sidebar-item" data-section="seguridad">
        <span class="icon"><i class="fa-solid fa-shield-halved"></i></span>
        <span>Seguridad</span>
      </div>
    </aside>

    <main class="main-content">
      <!-- DASHBOARD -->
      <div id="dashboard-section" class="content-section">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Resumen general y calendario de actividades</p>

        <div class="row row-cols-2 row-cols-md-3 g-3 stats-grid">
          <div class="col">
            <div class="stat-card">
              <div class="stat-title">Pedidos Pendientes <span class="wh-help" data-tip="Pedidos en estado 'pendiente' o 'en producción' que requieren seguimiento. Haz clic para ir a Gestión de Pedidos.">?</span></div>
              <div class="stat-value" id="kpiPendientes">—</div>
              <div class="stat-subtitle">Requieren atención</div>
            </div>
          </div>
          <div class="col">
            <div class="stat-card">
              <div class="stat-title">Citas Hoy <span class="wh-help" data-tip="Citas agendadas para hoy. Incluye visitas a domicilio y citas de medición.">?</span></div>
              <div class="stat-value" id="kpiCitasHoy">—</div>
              <div class="stat-subtitle">Programadas para hoy</div>
            </div>
          </div>
          <div class="col">
            <div class="stat-card">
              <div class="stat-title">Cotizaciones Nuevas</div>
              <div class="stat-value" id="kpiCotNuevas">—</div>
              <div class="stat-subtitle">Sin atender</div>
            </div>
          </div>
        </div>

        <!-- Calendario embebido en dashboard -->
        <div class="section" style="margin-top:24px;">
          <div class="calendar-wrap">
            <div class="calendar-toolbar">
              <div class="cal-title" id="calTitle">—</div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;align-items:center;">
                <button class="btn btn-secondary" data-call="prevMonth">← Mes</button>
                <button class="btn btn-secondary" data-call="goToday">Hoy</button>
                <button class="btn btn-secondary" data-call="nextMonth">Mes →</button>
                <button class="btn btn-secondary" data-call="refrescarCalendarioEmp" title="Actualizar calendario" id="calRefreshBtn"><i class="fa-solid fa-arrows-rotate"></i></button>
                <button class="btn btn-primary" data-call="openAddEventModal">+ Evento</button>
              </div>
            </div>

            <div class="calendar-grid" id="calDow"></div>
            <div class="calendar-grid" id="calGrid"></div>

            <div class="row g-3 cal-side">
              <div class="col-md-8">
                <div class="cal-list">
                  <div class="cal-list-head" id="selectedDayTitle" style="display:flex;justify-content:space-between;align-items:center;">
                    <span>Eventos del día</span>
                    <button id="rutaDiaCal" class="btn btn-primary btn-small" style="display:none;" data-call="generarRutaDia" data-args='[]'>
                      <i class="fa-solid fa-route"></i> Ruta
                    </button>
                  </div>
                  <div class="cal-list-body" id="dayEventsList">
                    <div style="color: var(--muted);">Selecciona un día para ver eventos.</div>
                  </div>
                </div>
              </div>

              <div class="col-md-4">
                <div class="cal-list">
                  <div class="cal-list-head">Próximos (7 días)</div>
                  <div class="cal-list-body" id="nextEventsList">
                    <div style="color: var(--muted);">—</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PEDIDOS -->
      <div id="pedidos-section" class="content-section hidden">
        <h1 class="page-title">Gestión de Pedidos</h1>
        <p class="page-subtitle">Administra todos los pedidos asignados</p>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Pedidos</h2>
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
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Correo</th>
                    <th>Fecha de Entrega</th>
                    <th>Estado</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="pedidosTable">
                  <tr><td colspan="7" style="text-align:center;color:#888;padding:20px;">Cargando pedidos...</td></tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>

      <!-- CITAS -->
      <div id="citas-section" class="content-section hidden">
        <h1 class="page-title">Citas Programadas</h1>
        <p class="page-subtitle">Gestiona tus citas y reuniones</p>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Próximas Citas</h2>
            <button class="btn btn-primary btn-small" data-call="openModal" data-args='["nuevaCita"]'>+ Nueva cita</button>
          </div>

          <div class="table-container">
            <div style="overflow:auto;">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Cliente</th>
                    <th>ID Cliente</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colspan="8" style="text-align:center;color:#888;padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando citas...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      <!-- COTIZACIONES -->
      <div id="cotizaciones-section" class="content-section hidden">
        <h1 class="page-title">Cotizaciones</h1>
        <p class="page-subtitle">Gestiona cotizaciones y propuestas</p>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Cotizaciones Activas</h2>
            <button class="btn btn-primary btn-small" data-call="openModal" data-args='["nuevaCotizacion"]'>+ Nueva cotización</button>
          </div>

          <div class="table-container">
            <div style="overflow:auto;">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Cliente</th>
                    <th>ID Cliente</th>
                    <th>Modelo</th>
                    <th>Presupuesto</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colspan="7" style="text-align:center;color:#888;padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando cotizaciones...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      <!-- SEGURIDAD -->
      <div id="seguridad-section" class="content-section hidden">
        <h1 class="page-title"><i class="fa-solid fa-shield-halved"></i> Seguridad de Cuenta</h1>
        <p class="page-subtitle">Configura la verificación en dos pasos para proteger tu acceso</p>

        <div class="section">
          <div class="table-card" style="max-width:560px;">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
              <div id="seg-2fa-icono" style="font-size:36px;color:var(--muted);">
                <i class="fa-solid fa-lock-open"></i>
              </div>
              <div>
                <div style="font-weight:700;font-size:15px;color:var(--text);">Verificación en dos pasos</div>
                <div id="seg-2fa-estado-texto" style="font-size:13px;color:var(--muted);margin-top:3px;">Cargando estado...</div>
              </div>
              <span id="seg-2fa-badge" style="margin-left:auto;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:#2a2a2a;color:var(--muted);">—</span>
            </div>
            <p style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:20px;">
              Con 2FA activado necesitarás un código de 6 dígitos de tu app de autenticación cada vez que inicies sesión.
            </p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button id="seg-btn-activar" class="btn btn-primary" data-call="iniciarSetup2FA" style="display:none;">
                <i class="fa-solid fa-shield-halved"></i> Activar 2FA
              </button>
              <button id="seg-btn-desactivar" class="btn btn-danger" data-call="confirmarDesactivar2FA" style="display:none;">
                <i class="fa-solid fa-shield-xmark"></i> Desactivar 2FA
              </button>
            </div>
          </div>

          <div id="seg-setup-flow" style="display:none;max-width:560px;margin-top:16px;">
            <div class="table-card">
              <h3 style="font-size:14px;font-weight:700;color:var(--accent);margin-bottom:16px;">
                <i class="fa-solid fa-qrcode"></i> Configurar Autenticador
              </h3>
              <div style="display:flex;flex-direction:column;gap:20px;">
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">Paso 1 — Escanea el QR con Google Authenticator o Authy</div>
                  <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
                    <img id="seg-qr-canvas" src="" alt="Código QR" width="180" height="180"
                         style="border:3px solid #333;border-radius:8px;background:#fff;display:none;">
                    <div style="flex:1;min-width:180px;">
                      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">O ingresa el código manualmente:</div>
                      <code id="seg-secreto-texto" style="display:block;font-size:14px;letter-spacing:2px;background:#1a1a1a;border:1px solid #333;padding:10px 14px;border-radius:6px;word-break:break-all;color:var(--accent);font-family:monospace;">—</code>
                    </div>
                  </div>
                </div>
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">Paso 2 — Confirma con el código de 6 dígitos</div>
                  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                    <input id="seg-codigo-input" type="text" inputmode="numeric" autocomplete="one-time-code"
                      maxlength="6" placeholder="000 000" class="form-input"
                      style="width:140px;font-size:22px;letter-spacing:6px;text-align:center;font-family:monospace;">
                    <button class="btn btn-primary" data-call="confirmarActivar2FA">
                      <i class="fa-solid fa-check"></i> Verificar y Activar
                    </button>
                    <button class="btn btn-secondary" data-call="cancelarSetup2FA">Cancelar</button>
                  </div>
                  <div id="seg-setup-error" style="display:none;color:#e05;font-size:13px;margin-top:10px;padding:10px;background:#2a0a0a;border-radius:6px;"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="table-card" style="max-width:560px;margin-top:16px;border-left:3px solid var(--accent);">
            <div style="font-size:13px;color:var(--muted);line-height:1.7;">
              <strong style="color:var(--text);">Importante:</strong> Si pierdes acceso a tu app de autenticación,
              contacta al administrador para que desactive el 2FA de tu cuenta.
            </div>
          </div>
        </div>
      </div>

    </main>
  </div>

  <!-- ═══ MODAL: DETALLE PEDIDO (empleado) ══════════════════════ -->
  <div class="modal" id="empPedidoDetalleModal">
    <div class="modal-content" style="max-width:900px;width:min(900px,96vw);">
      <div class="modal-header" style="background:var(--accent);color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
        <h3 class="modal-title" style="color:#fff;">
          <i class="fa-solid fa-box"></i> Detalle del Pedido
          <span id="emp_ped_folio" style="font-weight:900;margin-left:8px;opacity:.85;"></span>
        </h3>
        <button class="modal-close" data-dismiss="empPedidoDetalleModal" style="color:#fff;">×</button>
      </div>
      <div id="emp_ped_body" style="overflow-x:auto;min-height:180px;">
        <div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-dismiss="empPedidoDetalleModal">Cerrar</button>
      </div>
    </div>
  </div>

  <!-- ═══ MODAL: DETALLE CITA (empleado) ═════════════════════════ -->
  <div class="modal" id="empCitaDetalleModal">
    <div class="modal-content" style="max-width:600px;">
      <div class="modal-header" style="background:#3d4d8b;color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
        <h3 class="modal-title" style="color:#fff;">
          <i class="fa-solid fa-calendar-days"></i> Detalle de Cita
          <span id="emp_cita_folio" style="font-weight:900;margin-left:8px;opacity:.85;"></span>
        </h3>
        <button class="modal-close" data-dismiss="empCitaDetalleModal" style="color:#fff;">×</button>
      </div>
      <div id="emp_cita_body" style="overflow-x:auto;">
        <div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;padding:12px 0 0;margin-top:4px;border-top:1px solid var(--border);">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-small" data-emp-cita-action="confirmar">✅ Confirmar</button>
          <button class="btn btn-secondary btn-small" data-emp-cita-action="completar">🏁 Completar</button>
        </div>
        <button class="btn btn-secondary" data-dismiss="empCitaDetalleModal">Cerrar</button>
      </div>
    </div>
  </div>

  <!-- ═══ MODAL: DETALLE COTIZACIÓN (empleado) ═══════════════════ -->
  <div class="modal" id="empCotDetalleModal">
    <div class="modal-content" style="max-width:650px;">
      <div class="modal-header" style="background:#1e5c22;color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
        <h3 class="modal-title" style="color:#fff;">
          <i class="fa-solid fa-briefcase"></i> Detalle de Cotización
          <span id="emp_cot_folio" style="font-weight:900;margin-left:8px;opacity:.85;"></span>
        </h3>
        <button class="modal-close" data-dismiss="empCotDetalleModal" style="color:#fff;">×</button>
      </div>
      <div id="emp_cot_body" style="overflow-x:auto;">
        <div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;padding:12px 0 0;margin-top:4px;border-top:1px solid var(--border);">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-small" data-emp-cot-estado="en_revision">📋 En Revisión</button>
          <button class="btn btn-secondary btn-small" data-emp-cot-estado="respondida">✅ Respondida</button>
        </div>
        <button class="btn btn-secondary" data-dismiss="empCotDetalleModal">Cerrar</button>
      </div>
    </div>
  </div>

  <!-- ═══ MODAL: RUTA DEL DÍA ═══════════════════════════════════ -->
  <div class="modal" id="rutaDiaModal">
    <div class="modal-content" style="max-width:620px;width:min(620px,96vw);">
      <div class="modal-header" style="background:#1a3a4a;color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
        <h3 class="modal-title" style="color:#fff;display:flex;align-items:center;gap:10px;">
          <i class="fa-solid fa-route"></i> Ruta del Día
          <span id="rutaDiaFechaLabel" style="font-size:13px;opacity:.75;font-weight:400;"></span>
        </h3>
        <button class="modal-close" data-dismiss="rutaDiaModal" style="color:#fff;">×</button>
      </div>
      <div id="rutaDiaBody" style="overflow-y:auto;min-height:120px;max-height:60vh;">
        <div style="text-align:center;padding:30px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>
      </div>
      <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <button class="btn btn-secondary" data-dismiss="rutaDiaModal">Cerrar</button>
        <button id="rutaDiaMapsBtn" class="btn btn-primary" style="display:none;">
          <i class="fa-solid fa-map-location-dot"></i> Abrir en Google Maps
        </button>
      </div>
    </div>
  </div>

  <!-- MODAL: Nueva cita -->
  <div class="modal" id="nuevaCita">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Nueva Cita</h3>
        <button class="modal-close" data-dismiss="nuevaCita">×</button>
      </div>
      <div class="form-group">
        <label class="form-label">Cliente</label>
        <input type="text" class="form-input" placeholder="Nombre" />
      </div>
      <div class="form-group">
        <label class="form-label">Fecha</label>
        <input type="date" class="form-input" />
      </div>
      <div class="form-group">
        <label class="form-label">Hora</label>
        <input type="time" class="form-input" />
      </div>
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select class="form-select">
          <option value="cita">Cita</option>
          <option value="inst">Instalación</option>
        </select>
      </div>
      <button class="btn btn-primary" style="width:100%;" data-call="saveCita">Agendar</button>
    </div>
  </div>

  <!-- MODAL: Nueva cotización -->
  <div class="modal" id="nuevaCotizacion">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Nueva Cotización</h3>
        <button class="modal-close" data-dismiss="nuevaCotizacion">×</button>
      </div>
      <div class="form-group">
        <label class="form-label">Cliente</label>
        <input type="text" class="form-input" placeholder="Nombre" />
      </div>
      <div class="form-group">
        <label class="form-label">Producto</label>
        <input type="text" class="form-input" placeholder="Descripción" />
      </div>
      <div class="form-group">
        <label class="form-label">Monto</label>
        <input type="number" class="form-input" placeholder="0.00" />
      </div>
      <button class="btn btn-primary" style="width:100%;" data-call="saveCotizacion">Crear</button>
    </div>
  </div>

  <!-- MODAL: Actualizar stock -->
  <div class="modal" id="stockModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Actualizar Stock</h3>
        <button class="modal-close" data-dismiss="stockModal">×</button>
      </div>

      <div class="form-group">
        <label class="form-label">ID</label>
        <input type="text" class="form-input" id="stockId" readonly />
      </div>

      <div class="form-group">
        <label class="form-label">Insumo</label>
        <input type="text" class="form-input" id="stockName" readonly />
      </div>

      <div class="form-group">
        <label class="form-label">Stock actual</label>
        <input type="number" class="form-input" id="stockCurrent" readonly />
      </div>

      <div class="form-group">
        <label class="form-label">Movimiento</label>
        <select class="form-select" id="stockMovement">
          <option value="entrada">Entrada (+)</option>
          <option value="salida">Salida (-)</option>
          <option value="ajuste">Ajuste (poner stock exacto)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Cantidad</label>
        <input type="number" class="form-input" id="stockQty" placeholder="Ej: 5" min="1" />
      </div>

      <div class="form-group">
        <label class="form-label">Motivo</label>
        <select class="form-select" id="stockReason">
          <option value="compra_proveedor">Compra proveedor</option>
          <option value="consumo_produccion">Consumo producción</option>
          <option value="merma">Merma / daño</option>
          <option value="devolucion">Devolución</option>
          <option value="ajuste_general">Ajuste general</option>
        </select>
      </div>

      <button class="btn btn-primary" style="width:100%;" data-call="applyStockChange">Guardar movimiento</button>
    </div>
  </div>

  <!-- MODAL: Agregar insumo -->
  <div class="modal" id="addItemModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Agregar Insumo</h3>
        <button class="modal-close" data-dismiss="addItemModal">×</button>
      </div>

      <div class="form-group">
        <label class="form-label">Nombre del insumo</label>
        <input type="text" class="form-input" id="newName" placeholder="Ej: Corredera telescópica 45cm" />
      </div>

      <div class="form-group">
        <label class="form-label">Categoría</label>
        <select class="form-select" id="newCategory">
          <option value="Tableros">Tableros</option>
          <option value="Herrajes">Herrajes</option>
          <option value="Tornillería">Tornillería</option>
          <option value="Acabados">Acabados</option>
          <option value="Adhesivos">Adhesivos</option>
          <option value="Herramientas">Herramientas</option>
          <option value="Otro">Otro</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Unidad</label>
        <input type="text" class="form-input" id="newUnit" placeholder="pieza, caja, litro, metro, hoja..." />
      </div>

      <div class="form-group">
        <label class="form-label">Stock inicial</label>
        <input type="number" class="form-input" id="newStock" min="0" value="0" />
      </div>

      <div class="form-group">
        <label class="form-label">Stock mínimo</label>
        <input type="number" class="form-input" id="newMin" min="0" value="0" />
      </div>

      <div class="form-group">
        <label class="form-label">Ubicación</label>
        <input type="text" class="form-input" id="newLocation" placeholder="Ej: Almacén A, Estante 2..." />
      </div>

      <div class="form-group">
        <label class="form-label">Proveedor</label>
        <input type="text" class="form-input" id="newSupplier" placeholder="Ej: Herrajes GDL" />
      </div>

      <div class="form-group">
        <label class="form-label">Costo unitario (aprox.)</label>
        <input type="number" class="form-input" id="newCost" placeholder="Ej: 12" min="0" />
      </div>

      <button class="btn btn-primary" style="width:100%;" data-call="addInventoryItem">Guardar insumo</button>
    </div>
  </div>

  <!-- MODAL: Agregar evento calendario -->
  <div class="modal" id="addEventModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Agregar Evento</h3>
        <button class="modal-close" data-dismiss="addEventModal">×</button>
      </div>

      <div class="form-group">
        <label class="form-label">Fecha</label>
        <input type="date" class="form-input" id="evDate">
      </div>

      <div class="form-group">
        <label class="form-label">Hora</label>
        <input type="time" class="form-input" id="evTime">
      </div>

      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select class="form-select" id="evType">
          <option value="cita">Cita</option>
          <option value="cot">Cotización</option>
          <option value="inst">Instalación</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Título</label>
        <input type="text" class="form-input" id="evTitle" placeholder="Ej: Cita con Ana Martínez">
      </div>

      <div class="form-group">
        <label class="form-label">Notas</label>
        <textarea class="form-textarea" id="evNotes" placeholder="Detalles opcionales..."></textarea>
      </div>

      <button class="btn btn-primary" style="width:100%;" data-call="saveCalendarEvent">Guardar evento</button>
    </div>
  </div>

  
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check-compat.js"></script>
  <script src="../assets/<?= av('js/firebase-config.js') ?>"></script>
  <script src="../assets/<?= av('js/panel_empleado.js') ?>"></script>
  <script src="../assets/<?= av('js/event-delegation.js') ?>"></script>
  <script src="../assets/<?= av('js/animations.js') ?>"></script>
</body>
</html>