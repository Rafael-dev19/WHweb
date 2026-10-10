<?php
// ── Guardia de autenticación server-side ─────────────────────────
require_once dirname(__DIR__, 2) . "/includes/config.php";
require_once dirname(__DIR__, 2) . "/includes/db.php";
require_once dirname(__DIR__, 2) . "/includes/functions.php";
require_once dirname(__DIR__, 2) . "/includes/auth.php";

$_usuario = sesionActiva();
if (!$_usuario || $_usuario["rol"] !== "empleado") {
    header("Location: /acceso-denegado?area=empleado");
    exit;
}
// El area (taller/instalacion) distingue corte-y-armado de entrega-e-
// instalación — el resto de datos de sesión no se expone en el HTML.
$_rolPanel = $_usuario["rol"];
$_area     = $_usuario["area"] ?? null;
unset($_usuario);
?>

<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Panel Empleado - Wooden House</title>
  <!-- PWA: requerido para que iOS permita notificaciones push al agregar el
       panel a la pantalla de inicio (Safari no las soporta en pestaña normal). -->
  <link rel="manifest" href="/empleado/manifest.json">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="WH Panel">
  <link rel="apple-touch-icon" href="/assets/img/logo-icon-maskable.png">
  <meta name="description" content="Panel de empleados de Wooden House. Gestión de pedidos, cotizaciones y citas del personal.">
  <meta name="robots" content="noindex, nofollow">


  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="../assets/<?= av('css/panel_empleado.css') ?>">
  <link rel="stylesheet" href="../assets/<?= av('css/animations.css') ?>">
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous" defer></script>
</head>

<body>
  <script>window.WH_ROL = <?= json_encode($_rolPanel) ?>; window.WH_AREA = <?= json_encode($_area) ?>;</script>
  <div class="header">
    <div class="header-left">
    <button class="menu-toggle" id="menuToggle" aria-label="Abrir menú" aria-expanded="false">
      <i data-lucide="menu"></i>
    </button>
    <div class="logo">
      <img src="/assets/img/logo-header.png" alt="Wooden House" style="height:80px;" class="panel-logo">
    </div>
  </div>

    <div class="header-right">
      <button class="icon-btn" id="notifBtn" aria-label="Notificaciones" title="Notificaciones">
        <i data-lucide="bell"></i>
        <span class="badge-dot" id="notifDot"></span>
      </button>


      <div class="user-info">
        <div class="user-avatar" id="userAvatar">—</div>
        <span id="empNombreHeader">Cargando...</span>
        <button class="logout-btn" data-call="logout">Salir</button>
      </div>
    </div>
  </div>

  <div class="notif-panel" id="notifPanel">
    <div class="notif-head">
      <div class="notif-head-title">
        <i data-lucide="bell"></i>
        Notificaciones
      </div>
      <div class="notif-head-actions">
        <a class="btn btn-secondary btn-small" href="/notificaciones-push.php" title="Activar o desactivar notificaciones push en este dispositivo"><i data-lucide="smartphone"></i></a>
        <button class="btn btn-secondary btn-small" data-call="markAllNotifRead" title="Marcar todas como leídas"><i data-lucide="check-check"></i></button>
        <button class="btn btn-secondary btn-small" data-call="clearAllNotifs" title="Limpiar todo" style="color:var(--danger,#e57373);"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
    <div class="notif-body" id="notifBody"></div>
  </div>

  <div class="nav-links" id="navLinks">
    <button class="nav-close" id="navClose" aria-label="Cerrar menú">×</button>
    <div class="nav-title">Panel Empleado</div>

    <a href="#" data-section="dashboard" class="active"><i data-lucide="chart-column"></i> Dashboard</a>
    <a href="#" data-section="pedidos"><i data-lucide="box"></i> Gestión de Pedidos</a>
  </div>

  <div class="container">
    <aside class="sidebar" id="sidebarDesktop">
      <div class="sidebar-item active" data-section="dashboard">
        <span class="icon"><i data-lucide="chart-column"></i></span>
        <span>Dashboard</span>
      </div>

      <div class="sidebar-section">GESTIÓN</div>

      <div class="sidebar-item" data-section="pedidos">
        <span class="icon"><i data-lucide="box"></i></span>
        <span>Gestión de Pedidos</span>
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
                <button class="btn btn-secondary" data-call="refrescarCalendarioEmp" title="Actualizar calendario" id="calRefreshBtn"><i data-lucide="refresh-cw"></i></button>
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
                      <i data-lucide="route"></i> Ruta
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
              <?php if ($_area === 'taller'): ?>
              <button class="filter-btn active" data-filter="mia"><i data-lucide="hammer"></i> Mi etapa (taller)</button>
              <button class="filter-btn" data-filter="all">Todos</button>
              <?php elseif ($_area === 'instalacion'): ?>
              <button class="filter-btn active" data-filter="mia"><i data-lucide="truck"></i> Mi etapa (instalación)</button>
              <button class="filter-btn" data-filter="all">Todos</button>
              <?php else: ?>
              <button class="filter-btn active" data-filter="all">Todos</button>
              <?php endif; ?>
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

    </main>
  </div>

  <!-- ═══ MODAL: DETALLE PEDIDO (empleado) ══════════════════════ -->
  <div class="modal" id="empPedidoDetalleModal">
    <div class="modal-content" style="max-width:900px;width:min(900px,96vw);">
      <div class="modal-header" style="background:var(--accent);color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
        <h3 class="modal-title" style="color:#fff;">
          <i data-lucide="box"></i> Detalle del Pedido
          <span id="emp_ped_folio" style="font-weight:900;margin-left:8px;opacity:.85;"></span>
        </h3>
        <button class="modal-close" data-dismiss="empPedidoDetalleModal" style="color:#fff;">×</button>
      </div>
      <div id="emp_ped_body" style="overflow-x:auto;min-height:180px;">
        <div style="text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>
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
          <i data-lucide="calendar"></i> Detalle de Cita
          <span id="emp_cita_folio" style="font-weight:900;margin-left:8px;opacity:.85;"></span>
        </h3>
        <button class="modal-close" data-dismiss="empCitaDetalleModal" style="color:#fff;">×</button>
      </div>
      <div id="emp_cita_body" style="overflow-x:auto;">
        <div style="text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>
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
          <i data-lucide="briefcase"></i> Detalle de Cotización
          <span id="emp_cot_folio" style="font-weight:900;margin-left:8px;opacity:.85;"></span>
        </h3>
        <button class="modal-close" data-dismiss="empCotDetalleModal" style="color:#fff;">×</button>
      </div>
      <div id="emp_cot_body" style="overflow-x:auto;">
        <div style="text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>
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
          <i data-lucide="route"></i> Ruta del Día
          <span id="rutaDiaFechaLabel" style="font-size:13px;opacity:.75;font-weight:400;"></span>
        </h3>
        <button class="modal-close" data-dismiss="rutaDiaModal" style="color:#fff;">×</button>
      </div>
      <div id="rutaDiaBody" style="overflow-y:auto;min-height:120px;max-height:60vh;">
        <div style="text-align:center;padding:30px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>
      </div>
      <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <button class="btn btn-secondary" data-dismiss="rutaDiaModal">Cerrar</button>
        <button id="rutaDiaMapsBtn" class="btn btn-primary" style="display:none;">
          <i data-lucide="map-pinned"></i> Abrir en Google Maps
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
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check-compat.js"></script>
  <script src="../assets/<?= av('js/theme-toggle.js') ?>"></script>
  <script src="../assets/<?= av('js/firebase-config.js') ?>"></script>
  <script src="../assets/<?= av('js/panel_empleado.js') ?>"></script>
  <script src="../assets/<?= av('js/event-delegation.js') ?>"></script>
  <script src="../assets/<?= av('js/animations.js') ?>"></script>
  <script src="../assets/<?= av('js/push-notifications.js') ?>"></script>
  <script>initPushForegroundListener();</script>
</body>
</html>