<?php
// ── Guardia de autenticación server-side ─────────────────────────
// Esto se hace ANTES de servir cualquier HTML
require_once dirname(__DIR__, 2) . "/includes/config.php";
require_once dirname(__DIR__, 2) . "/includes/db.php";
require_once dirname(__DIR__, 2) . "/includes/functions.php";
require_once dirname(__DIR__, 2) . "/includes/auth.php";

$_usuario = sesionActiva();
if (!$_usuario || $_usuario["rol"] !== "administrador") {
    header("Location: /acceso-denegado?area=admin");
    exit;
}
// No exponer datos de sesión en el HTML
unset($_usuario);
?>

<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Panel Administrador - Wooden House</title>
  <meta name="description" content="Panel de administración de Wooden House. Gestión de productos, pedidos, empleados y reportes.">
  <meta name="robots" content="noindex, nofollow">

  
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="../assets/css/panel_administrador.css">
  <link rel="stylesheet" href="../assets/css/animations.css">
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
      <img src="/assets/img/logo-header.png" alt="Wooden House" style="height:80px;">
    </div>
  </div>

    <div class="user-info">
      <button class="icon-btn" id="notifBtn" aria-label="Notificaciones" title="Notificaciones">
        <i class="fa-solid fa-bell"></i>
        <span class="badge-dot" id="notifDot"></span>
      </button>
      <div class="user-avatar">AD</div>
      <span>Administrador</span>
      <button class="logout-btn" data-call="logoutAdmin">Salir</button>
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

  <div class="nav-links" id="navLinks" aria-hidden="true">
    <div class="nav-title">
      Menú Admin
      <button class="nav-close" id="navClose" aria-label="Cerrar menú">×</button>
    </div>

    <a href="#" data-section="dashboard" class="active"><span class="icon"><i class="fa-solid fa-chart-bar"></i></span> Dashboard</a>

    <a href="#" data-section="pedidos"><span class="icon"><i class="fa-solid fa-box"></i></span> Todos los Pedidos</a>
    <a href="#" data-section="citas"><span class="icon"><i class="fa-solid fa-calendar-days"></i></span> Calendario de Citas</a>
    <a href="#" data-section="cotizaciones"><span class="icon"><i class="fa-solid fa-briefcase"></i></span> Cotizaciones</a>

    <a href="#" data-section="catalogo"><span class="icon"><i class="fa-solid fa-gear"></i></span> Gestionar Catálogo</a>
    <a href="#" data-section="empleados"><span class="icon"><i class="fa-solid fa-briefcase"></i></span> Gestionar Empleados</a>
    <a href="#" data-section="reportes"><span class="icon"><i class="fa-solid fa-chart-bar"></i></span> Reportes Avanzados</a>
    <a href="#" data-section="financiero"><span class="icon"><i class="fa-solid fa-tag"></i></span> Análisis Financiero</a>
    <a href="#" data-section="clientes"><span class="icon"><i class="fa-solid fa-users"></i></span> Clientes Registrados</a>
    <a href="#" data-section="ofertas"><span class="icon"><i class="fa-solid fa-tag"></i></span> Ofertas & Marketing</a>
  </div>

  <div class="container">
    <aside class="sidebar">
      <div class="sidebar-item active" data-section="dashboard">
        <span class="icon"><i class="fa-solid fa-chart-bar"></i></span><span>Dashboard</span>
      </div>

      <div class="sidebar-section">GESTIÓN</div>
      <div class="sidebar-item" data-section="pedidos"><span class="icon"><i class="fa-solid fa-box"></i></span><span>Todos los Pedidos</span></div>
      <div class="sidebar-item" data-section="citas"><span class="icon"><i class="fa-solid fa-calendar-days"></i></span><span>Calendario de Citas</span></div>
      <div class="sidebar-item" data-section="cotizaciones"><span class="icon"><i class="fa-solid fa-briefcase"></i></span><span>Cotizaciones</span></div>

      <div class="sidebar-section">ADMIN</div>
      <div class="sidebar-item" data-section="catalogo"><span class="icon"><i class="fa-solid fa-gear"></i></span><span>Gestionar Catálogo</span></div>
      <div class="sidebar-item" data-section="empleados"><span class="icon"><i class="fa-solid fa-briefcase"></i></span><span>Gestionar Empleados</span></div>
      <div class="sidebar-item" data-section="reportes"><span class="icon"><i class="fa-solid fa-chart-bar"></i></span><span>Reportes Avanzados</span></div>
      <div class="sidebar-item" data-section="financiero"><span class="icon"><i class="fa-solid fa-tag"></i></span><span>Análisis Financiero</span></div>

      <div class="sidebar-section">CLIENTES & MARKETING</div>
      <div class="sidebar-item" data-section="clientes"><span class="icon"><i class="fa-solid fa-users"></i></span><span>Clientes Registrados</span></div>
      <div class="sidebar-item" data-section="ofertas"><span class="icon"><i class="fa-solid fa-tag"></i></span><span>Ofertas & Marketing</span></div>

      <div class="sidebar-section">PRODUCCIÓN</div>
      <div class="sidebar-item" data-section="capacidad"><span class="icon"><i class="fa-solid fa-industry"></i></span><span>Capacidad del Taller</span></div>
    </aside>

    <main class="main-content">
      <!-- DASHBOARD -->
      <div id="dashboard-section" class="content-section">
        <h1 class="page-title">Dashboard Administrativo</h1>
        <p class="page-subtitle">Control total del sistema</p>

        <div class="row row-cols-2 row-cols-md-4 g-3 stats-grid">
          <div class="col">
            <div class="stat-card">
              <div class="stat-title">Ventas del Mes <span class="wh-help" data-tip="Total de ingresos por pedidos pagados en el mes actual (desde el día 1 hasta hoy).">?</span></div>
              <div class="stat-value" id="kpiVentasMes">$0</div>
              <div class="stat-subtitle" id="kpiVentasHint">—</div>
            </div>
          </div>
          <div class="col">
            <div class="stat-card">
              <div class="stat-title">Pedidos Totales <span class="wh-help" data-tip="Número total de pedidos registrados en el sistema (todos los estados: pendiente, en producción, entregado, etc.).">?</span></div>
              <div class="stat-value" id="kpiPedidos">0</div>
              <div class="stat-subtitle" id="kpiPedidosHint">—</div>
            </div>
          </div>
          <div class="col">
            <div class="stat-card">
              <div class="stat-title">Clientes Atendidos</div>
              <div class="stat-value" id="kpiClientes">0</div>
              <div class="stat-subtitle" id="kpiClientesHint">—</div>
            </div>
          </div>
          <div class="col">
            <div class="stat-card">
              <div class="stat-title">Productos en Catálogo</div>
              <div class="stat-value" id="kpiProductos">0</div>
              <div class="stat-subtitle" id="kpiStockLow">—</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Gráficas rápidas</h2>
            <div class="help">Basado en pedidos registrados en el sistema.</div>
          </div>

          <div class="row g-3 charts-grid">
            <div class="col-md-6">
              <div class="chart-card">
                <div class="chart-title">Ventas (últimos 7 días)</div>
                <canvas id="chartVentas" height="120" aria-label="Gráfica de ventas" role="img"></canvas>
                <div class="chart-meta" id="chartVentasMeta">—</div>
              </div>
            </div>

            <div class="col-md-6">
              <div class="chart-card">
                <div class="chart-title">Pedidos por estado</div>
                <canvas id="chartEstados" height="120" aria-label="Gráfica de pedidos por estado" role="img"></canvas>
                <div class="chart-meta" id="chartEstadosMeta">—</div>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-header"><h2 class="section-title">Acciones Rápidas</h2></div>
          <div class="row row-cols-2 row-cols-md-4 g-3 actions-grid">
            <div class="col">
              <div class="action-card h-100" data-section="pedidos">
                <div class="action-icon"><i class="fa-solid fa-cart-shopping"></i></div>
                <div class="action-title">Ver Pedidos</div>
                <div class="action-subtitle">Control total</div>
              </div>
            </div>
            <div class="col">
              <div class="action-card h-100" data-section="citas">
                <div class="action-icon"><i class="fa-solid fa-calendar-days"></i></div>
                <div class="action-title">Citas</div>
                <div class="action-subtitle">Agenda y calendario</div>
              </div>
            </div>
            <div class="col">
              <div class="action-card h-100" data-section="cotizaciones">
                <div class="action-icon"><i class="fa-solid fa-file-invoice-dollar"></i></div>
                <div class="action-title">Cotizaciones</div>
                <div class="action-subtitle">Solicitudes recibidas</div>
              </div>
            </div>
            <div class="col">
              <div class="action-card h-100" data-section="catalogo">
                <div class="action-icon"><i class="fa-solid fa-box"></i></div>
                <div class="action-title">Gestionar Catálogo</div>
                <div class="action-subtitle">Productos y servicios</div>
              </div>
            </div>
            <div class="col">
              <div class="action-card h-100" data-section="empleados">
                <div class="action-icon"><i class="fa-solid fa-users"></i></div>
                <div class="action-title">Empleados</div>
                <div class="action-subtitle">Usuarios y permisos</div>
              </div>
            </div>
            <div class="col">
              <div class="action-card h-100" data-section="clientes">
                <div class="action-icon"><i class="fa-solid fa-user-group"></i></div>
                <div class="action-title">Clientes</div>
                <div class="action-subtitle">Cuentas registradas</div>
              </div>
            </div>
            <div class="col">
              <div class="action-card h-100" data-section="ofertas">
                <div class="action-icon"><i class="fa-solid fa-tag"></i></div>
                <div class="action-title">Ofertas</div>
                <div class="action-subtitle">Promociones activas</div>
              </div>
            </div>
            <div class="col">
              <div class="action-card h-100" data-section="reportes">
                <div class="action-icon"><i class="fa-solid fa-chart-bar"></i></div>
                <div class="action-title">Reportes</div>
                <div class="action-subtitle">Exportar datos</div>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-header"><h2 class="section-title">Actividad Reciente</h2></div>
          <div id="actividadReciente" style="color:var(--muted); font-size:13px;">
            <i class="fa-solid fa-spinner fa-spin"></i> Cargando actividad...
          </div>
        </div>
      </div>

      <!-- PEDIDOS -->
      <div id="pedidos-section" class="content-section hidden">
        <h1 class="page-title">Gestión Total de Pedidos</h1>
        <p class="page-subtitle">Control completo de todos los pedidos</p>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Todos los Pedidos</h2>
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
                  <tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando pedidos...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      <!-- CITAS -->
      <div id="citas-section" class="content-section hidden">
        <h1 class="page-title">Calendario de Citas</h1>
        <p class="page-subtitle">Gestiona todas las citas programadas (vista calendario + lista)</p>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Agenda</h2>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-secondary" data-call="prevMonth"><i class="fa-solid fa-chevron-left"></i></button>
              <button class="btn btn-secondary" data-call="nextMonth"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
          </div>

          <div class="calendar-wrap">
            <div class="calendar-toolbar">
              <div class="cal-title" id="calTitle">Febrero 2026</div>
              <div style="color:var(--muted); font-size:12px;">Tip: toca un día para ver detalles</div>
            </div>

            <div class="calendar-grid" id="calendarDow">
              <div class="cal-dow">Lun</div><div class="cal-dow">Mar</div><div class="cal-dow">Mié</div>
              <div class="cal-dow">Jue</div><div class="cal-dow">Vie</div><div class="cal-dow">Sáb</div><div class="cal-dow">Dom</div>
            </div>

            <div class="calendar-grid" id="calendarGrid"></div>

            <div class="row g-3 cal-side">
              <div class="col-md-8">
                <div class="cal-list">
                  <div class="cal-list-head" id="dayHead">Citas del día</div>
                  <div class="cal-list-body" id="dayList">
                    <div class="cal-item">
                      <div class="t">Selecciona un día</div>
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

            <div class="table-container" style="margin-top:12px;">
              <div style="overflow:auto;">
                <table>
                  <thead>
                    <tr>
                      <th>Folio</th><th>Cliente</th><th>ID Cliente</th><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Estado</th><th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody id="citasTable">
                    <tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px;">
                      <i class="fa-solid fa-spinner fa-spin"></i> Cargando citas...
                    </td></tr>
                  </tbody>
                </table>
              </div>
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
            <button class="btn btn-secondary btn-small" data-call="cargarCotizacionesAPI">
              <i class="fa-solid fa-rotate-right"></i> Actualizar
            </button>
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
                    <i class="fa-solid fa-spinner fa-spin"></i> Cargando cotizaciones...
                  </td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- CATÁLOGO -->
      <div id="catalogo-section" class="content-section hidden">
        <h1 class="page-title">Gestionar Catálogo</h1>
        <p class="page-subtitle">Administra productos y servicios (basado en tu catálogo y detalle)</p>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Productos</h2>
            <div class="cat-toolbar">
              <button class="btn btn-primary" data-call="openProductoModal" data-args='["create"]'>+ Nuevo Producto</button>
              <button class="btn btn-ghost" data-call="toggleCatalogView">Cambiar vista: <span id="viewModeLabel">Tarjetas</span></button>
            </div>
          </div>

          <div class="table-filters" style="border:1px solid var(--border); border-radius:10px; margin-bottom:10px;">
            <div class="cat-search">
              <input class="form-input" id="catSearch" placeholder="Buscar por nombre, categoría..." data-oninput="renderCatalogo"/>
              <select class="form-select" id="catCategory" data-onchange="renderCatalogo" style="max-width:220px;">
                <option value="">Todas las categorías</option>
              </select>
              <select class="form-select" id="catStatus" data-onchange="renderCatalogo" style="max-width:200px;">
                <option value="">Todos</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </div>
          </div>

          <div id="catalogCards" class="cat-grid"></div>

          <div id="catalogTableWrap" class="table-container hidden">
            <div style="overflow:auto;">
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Estado</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="catalogTableBody"></tbody>
              </table>
            </div>
          </div>

          <p class="help" style="margin-top:10px;">
            Nota: “Imágenes” se capturan como lista (URLs/rutas) pero por ahora se muestran como placeholders (sin imágenes reales).
          </p>
        </div>
      </div>

      <!-- EMPLEADOS -->
      <div id="empleados-section" class="content-section hidden">
        <h1 class="page-title">Gestionar Empleados</h1>
        <p class="page-subtitle">Usuarios y permisos del sistema</p>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Personal</h2>
            <button class="btn btn-primary" data-call="abrirNuevoEmpleado">+ Nuevo Empleado</button>
          </div>

          <div class="table-container">
            <div style="overflow:auto;">
              <table>
                <thead>
                  <tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody id="empleadosTable">
                  <tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">Cargando empleados...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      <!-- REPORTES -->
      <div id="reportes-section" class="content-section hidden">
        <h1 class="page-title">Reportes Avanzados</h1>
        <p class="page-subtitle">Métricas de ventas, top productos, conversión de cotizaciones, análisis de citas. Exportable PDF/Excel (CSV).</p>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Controles</h2>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-secondary" data-call="exportReportXLSX"><i class="fa-solid fa-file-excel"></i> Exportar Excel (.xlsx)</button>
              <button class="btn btn-secondary" data-call="printReportPDF"><i class="fa-solid fa-file-pdf"></i> Exportar PDF</button>
            </div>
          </div>

          <div class="row g-3 report-grid">
            <div class="col-md-6">
              <div class="detail-side">
                <h4>Métricas</h4>
                <div class="kv"><span>Ventas del mes (MXN)</span><b id="repVentas">—</b></div>
                <div class="kv"><span>Pedidos del mes</span><b id="repOrdenes">—</b></div>
                <div class="kv"><span>Ticket promedio</span><b id="repTicket">—</b></div>
                <div class="kv"><span>Conversión cotizaciones</span><b id="repConv">—</b></div>
                <div class="kv"><span>Total cotizaciones respondidas</span><b id="repCotRespondidas">—</b></div>
              </div>
            </div>

            <div class="col-md-6">
              <div class="detail-side">
                <h4>Análisis de citas</h4>
                <div style="color:#ddd; font-size:12px;">
                  Mediciones <b id="repCitasMedicion" style="float:right;color:var(--accent);">—</b>
                  <div class="bar"><span id="barInst"></span></div>
                </div>
                <div style="color:#ddd; font-size:12px; margin-top:10px;">
                  Instalaciones <b id="repCitasInstalacion" style="float:right;color:var(--accent);">—</b>
                  <div class="bar"><span id="barCot"></span></div>
                </div>
                <div style="color:#ddd; font-size:12px; margin-top:10px;">
                  Otros <b id="repCitasOtros" style="float:right;color:var(--accent);">—</b>
                  <div class="bar"><span id="barCita"></span></div>
                </div>
                <small>Tipos de citas — datos reales de la base de datos</small>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Productos más vendidos</h2>
          </div>

          <div class="table-container">
            <div style="overflow:auto;">
              <table>
                <thead>
                  <tr><th>Producto</th><th>Unidades vendidas</th><th>Ingresos generados</th><th># Pedidos</th></tr>
                </thead>
                <tbody id="repTopBody"></tbody>
              </table>
            </div>
          </div>

          <p class="help" style="margin-top:10px;">
            PDF: se hace con “Imprimir” (tu navegador permite “Guardar como PDF”). Excel: CSV lo abre Excel directo.
          </p>
        </div>
      </div>

      <!-- FINANCIERO -->
      <div id="financiero-section" class="content-section hidden">
        <h1 class="page-title">Análisis Financiero</h1>
        <p class="page-subtitle">Ingresos, egresos y análisis detallado</p>

        <div class="row row-cols-2 row-cols-md-4 g-3 stats-grid">
          <div class="col"><div class="stat-card"><div class="stat-title">Ingresos del Mes</div><div class="stat-value">$156,800</div><div class="stat-subtitle">+18%</div></div></div>
          <div class="col"><div class="stat-card"><div class="stat-title">Egresos del Mes</div><div class="stat-value">$89,200</div><div class="stat-subtitle">-5%</div></div></div>
          <div class="col"><div class="stat-card"><div class="stat-title">Utilidad Neta</div><div class="stat-value">$67,600</div><div class="stat-subtitle">+23%</div></div></div>
          <div class="col"><div class="stat-card"><div class="stat-title">Margen de Utilidad</div><div class="stat-value">43%</div><div class="stat-subtitle">+2%</div></div></div>
        </div>
      </div>

      <!-- MODAL: PRODUCTO -->
      <div class="modal" id="productoModal">
        <div class="modal-content" style="max-width:700px;">
          <div class="modal-header">
            <h3 class="modal-title" id="productoModalTitle">Nuevo Producto</h3>
            <button class="modal-close" data-dismiss="productoModal">×</button>
          </div>

          <input type="hidden" id="p_mode" value="create"/>
          <input type="hidden" id="p_key" value=""/>

          <div class="row g-3 form-grid">
            <div class="col-md-6 form-group">
              <label class="form-label">Nombre del modelo *</label>
              <input type="text" class="form-input" id="p_nombre" placeholder="ej: Modelo Sevilla"/>
            </div>
            <div class="col-md-6 form-group">
              <label class="form-label">Categoría *</label>
              <select class="form-select" id="p_categoria">
                <option value="">Cargando...</option>
              </select>
            </div>
            <div class="col-md-6 form-group">
              <label class="form-label">Etiqueta / Badge</label>
              <select class="form-select" id="p_badge">
                <option value="">Ninguna</option>
                <option value="Nuevo">Nuevo</option>
                <option value="Popular">Popular</option>
                <option value="Oferta">Oferta</option>
                <option value="Mas vendido">Más vendido</option>
              </select>
            </div>
            <div class="col-md-6 form-group">
              <label class="form-label">Estado</label>
              <select class="form-select" id="p_estado">
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
            <div class="col-md-6 form-group">
              <label class="form-label">Precio del mueble (MXN) *</label>
              <input type="number" class="form-input" id="p_precio" step="0.01" min="1" placeholder="4900"/>
            </div>
          </div>

          <div class="form-group" style="margin-top:12px;">
            <label class="form-label">Descripción del producto *</label>
            <textarea class="form-textarea" id="p_descLarga" rows="3"
              placeholder="Descripción que se muestra en catálogo y detalle del producto."></textarea>
          </div>

          <div class="section" style="margin-top:16px;">
            <div class="section-header">
              <h2 class="section-title"><i class="fa-solid fa-ruler-combined"></i> Dimensiones y características</h2>
            </div>

            <div class="row g-3 form-grid" style="margin-top:10px;">
              <div class="col-md-6 form-group">
                <label class="form-label">Tipo de instalación *</label>
                <select class="form-select" id="p_tipo_instalacion">
                  <option value="A piso">A piso</option>
                  <option value="Flotado">Flotado</option>
                </select>
              </div>
              <div class="col-md-6 form-group">
                <label class="form-label">Largo (cm) *</label>
                <input type="text" class="form-input" id="p_largo" placeholder="ej: 80 cm"/>
              </div>
              <div class="col-md-6 form-group">
                <label class="form-label">Alto (cm) *</label>
                <input type="text" class="form-input" id="p_alto" placeholder="ej: 55 cm"/>
              </div>
              <div class="col-md-6 form-group">
                <label class="form-label">Fondo (cm) *</label>
                <input type="text" class="form-input" id="p_fondo" placeholder="ej: 50 cm"/>
              </div>
              <div class="col-md-6 form-group">
                <label class="form-label">Ovalín *</label>
                <input type="text" class="form-input" id="p_ovalin" placeholder="ej: Rectangular 60x40 cm"/>
              </div>
              <div class="col-md-6 form-group">
                <label class="form-label">Monomando *</label>
                <input type="text" class="form-input" id="p_monomando" placeholder="ej: 30 cm cromado"/>
              </div>
              <div class="col-12 form-group">
                <label class="form-label">Incluye</label>
                <input type="text" class="form-input" id="p_incluye" value="Céspol de PBC - Contra canasta" placeholder="ej: Céspol de PBC - Contra canasta"/>
              </div>
              <div class="col-12 form-group">
                <label class="form-label">Espejo opcional</label>
                <input type="text" class="form-input" id="p_espejo"
                  placeholder="ej: Rectangular 50x70 cm - LED/Touch 4mm - 3 intensidades - $1,300  (dejar vacío si no aplica)"/>
                <div class="help">Si no incluye espejo opcional, dejar en blanco o escribir 'No incluye'.</div>
              </div>
            </div>
          </div>

          <div class="section" style="margin-top:16px;">
            <div class="section-header">
              <h2 class="section-title"><i class="fa-solid fa-images"></i> Imágenes del producto</h2>
            </div>

            <div id="imgDropZone" style="
              border:2px dashed var(--border);
              border-radius:10px;
              padding:24px;
              text-align:center;
              cursor:pointer;
              transition:border-color .2s;
              margin-top:10px;
            " data-trigger-click="p_imgs_files">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size:28px;color:var(--accent);"></i>
              <p style="margin:8px 0 4px;font-weight:600;color:#ddd;">Arrastra imágenes aquí o haz clic para seleccionar</p>
              <p style="color:var(--muted);font-size:12px;">JPG, PNG, WEBP — cualquier tamaño (se optimizan automáticamente)</p>
            </div>

            <input type="file" id="p_imgs_files" multiple accept="image/*"
                   style="display:none" data-onchange-files="previewImages"/>

            <div id="imgUploadProgress" style="display:none;margin-top:12px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:12px;color:#ddd;" id="imgProgressLabel">Subiendo...</span>
                <span style="font-size:12px;color:var(--accent);" id="imgProgressPct">0%</span>
              </div>
              <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden;">
                <div id="imgProgressBar" style="height:100%;background:var(--accent);width:0%;transition:width .3s;"></div>
              </div>
            </div>

            <div id="imgPreviewGrid" style="
              display:grid;
              grid-template-columns:repeat(auto-fill,minmax(90px,1fr));
              gap:8px;
              margin-top:12px;
            "></div>

            <textarea id="p_imgs_urls" style="display:none;"></textarea>
            <div class="help" style="margin-top:8px;">La primera imagen será la principal en el catálogo. Puedes reordenar arrastrando.</div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:18px;">
            <button class="btn btn-secondary" data-dismiss="productoModal">Cancelar</button>
            <button class="btn btn-primary" id="btnGuardarProducto" data-call="saveProductoFull">
              <i class="fa-solid fa-floppy-disk"></i> Guardar
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL: DETALLE -->
      <div class="modal" id="productoDetalleModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title" id="detalleModalTitle">Detalle de producto</h3>
            <button class="modal-close" data-dismiss="productoDetalleModal">×</button>
          </div>

          <div id="detalleBody"></div>

          <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; margin-top:12px;">
            <button class="btn btn-secondary" data-dismiss="productoDetalleModal">Cerrar</button>
            <button class="btn btn-primary" data-call="detailEditFromModal">Editar este producto</button>
          </div>
        </div>
      </div>

      <!-- MODAL: NUEVO EMPLEADO -->
      <div class="modal" id="nuevoEmpleado">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title" id="empModalTitle">Nuevo Empleado</h3>
            <button class="modal-close" data-dismiss="nuevoEmpleado">×</button>
          </div>

          <input type="hidden" id="emp_mode" value="create">
          <input type="hidden" id="emp_id" value="">

          <div class="form-group">
            <label class="form-label">Nombre completo *</label>
            <input type="text" class="form-input" id="emp_nombre" placeholder="Juan Pérez López">
          </div>
          <div class="form-group">
            <label class="form-label">Correo electrónico *</label>
            <input type="email" class="form-input" id="emp_correo" placeholder="juan@woodenhouse.com">
            <div class="help">Se usará para iniciar sesión en el panel.</div>
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña *</label>
            <input type="password" class="form-input" id="emp_password" placeholder="Mínimo 6 caracteres"
                   autocomplete="new-password">
            <div class="help" id="emp_password_help">Mínimo 6 caracteres. Déjala en blanco al editar para no cambiarla.</div>
          </div>
          <div class="form-group">
            <label class="form-label">Rol *</label>
            <select class="form-select" id="emp_rol">
              <option value="empleado">Empleado</option>
              <option value="administrador">Administrador</option>
            </select>
          </div>

          <div id="emp_error" style="display:none;color:#e05;font-size:13px;margin-bottom:12px;padding:10px;background:#2a0a0a;border-radius:6px;"></div>

          <button class="btn btn-primary" style="width:100%;" id="emp_btn_guardar" data-call="guardarEmpleado">
            Crear Empleado
          </button>
        </div>
      </div>

      <!-- CAPACIDAD DEL TALLER -->
      <div id="capacidad-section" class="content-section hidden">
        <h1 class="page-title"><i class="fa-solid fa-industry"></i> Capacidad del Taller</h1>
        <p class="page-subtitle">Demanda de producción en tiempo real · Gestión de días bloqueados</p>

        <div class="row row-cols-2 row-cols-md-4 g-3 stats-grid" style="margin-bottom:24px;">
          <div class="col">
            <div class="stat-card">
              <div class="stat-title">Capacidad diaria</div>
              <div class="stat-value" id="capLimiteDia">—</div>
              <div class="stat-subtitle">máx. productos por día</div>
            </div>
          </div>
          <div class="col">
            <div class="stat-card">
              <div class="stat-title">Días llenos próximos</div>
              <div class="stat-value" id="capDiasLlenos" style="color:var(--danger);">—</div>
              <div class="stat-subtitle">en los próximos 30 días</div>
            </div>
          </div>
          <div class="col">
            <div class="stat-card">
              <div class="stat-title">Días bloqueados</div>
              <div class="stat-value" id="capDiasBloqueados" style="color:var(--warn);">—</div>
              <div class="stat-subtitle">festivos o cierre de taller</div>
            </div>
          </div>
          <div class="col">
            <div class="stat-card">
              <div class="stat-title">Próxima fecha libre</div>
              <div class="stat-value" id="capProximaLibre" style="font-size:16px;">—</div>
              <div class="stat-subtitle">primer día con espacio</div>
            </div>
          </div>
        </div>

        <div class="row g-4 align-items-start">

          <div class="col-lg-8">
          <div class="table-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
              <h3 style="color:var(--accent);font-size:15px;font-weight:800;">Carga del Taller — Próximos 30 días hábiles</h3>
              <button class="btn btn-sm btn-secondary" data-call="cargarCapacidad">
                <i class="fa-solid fa-rotate-right"></i> Actualizar
              </button>
            </div>

            <div style="display:flex;gap:14px;margin-bottom:16px;flex-wrap:wrap;">
              <span style="font-size:11px;display:flex;align-items:center;gap:5px;color:var(--muted2);">
                <span style="width:12px;height:12px;border-radius:3px;background:#4a8b5a;display:inline-block;"></span> Libre
              </span>
              <span style="font-size:11px;display:flex;align-items:center;gap:5px;color:var(--muted2);">
                <span style="width:12px;height:12px;border-radius:3px;background:#8b7355;display:inline-block;"></span> Moderado (40-79%)
              </span>
              <span style="font-size:11px;display:flex;align-items:center;gap:5px;color:var(--muted2);">
                <span style="width:12px;height:12px;border-radius:3px;background:#8b4a4a;display:inline-block;"></span> Lleno (≥80%)
              </span>
              <span style="font-size:11px;display:flex;align-items:center;gap:5px;color:var(--muted2);">
                <span style="width:12px;height:12px;border-radius:3px;background:#3c3c3c;border:2px solid #555;display:inline-block;"></span> Bloqueado
              </span>
            </div>

            <div id="capacidadGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;">
              <div style="color:var(--muted);text-align:center;padding:20px;grid-column:1/-1;">
                <i class="fa-solid fa-spinner fa-spin"></i> Cargando...
              </div>
            </div>
          </div>
          </div><!-- end col-lg-8 -->

          <div class="col-lg-4">
          <div class="table-card" style="position:sticky;top:20px;">
            <h3 style="color:var(--accent);font-size:15px;font-weight:800;margin-bottom:16px;">
              <i class="fa-solid fa-calendar-xmark"></i> Bloquear Día
            </h3>
            <p style="color:var(--muted);font-size:12px;margin-bottom:16px;line-height:1.5;">
              Los días bloqueados no aparecen como disponibles para los clientes en el checkout.
              Úsalos para festivos, vacaciones o cierre del taller.
            </p>
            <div style="display:flex;flex-direction:column;gap:12px;">
              <div>
                <label style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px;">Fecha a bloquear</label>
                <input type="date" id="capFechaBloquear" class="form-input"
                  min="<?= date('Y-m-d', strtotime('tomorrow')) ?>"
                  style="font-size:13px;">
              </div>
              <div>
                <label style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px;">Motivo</label>
                <input type="text" id="capMotivoBloquear" class="form-input"
                  placeholder="Ej: Día festivo, Vacaciones..."
                  style="font-size:13px;" maxlength="100">
              </div>
              <button class="btn btn-danger" data-call="bloquearDia" style="width:100%;">
                <i class="fa-solid fa-lock"></i> Bloquear este día
              </button>
            </div>

            <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
              <h4 style="color:var(--muted2);font-size:12px;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px;">
                Días bloqueados próximos
              </h4>
              <div id="listaBloqueados" style="display:flex;flex-direction:column;gap:6px;">
                <span style="color:var(--muted);font-size:12px;">Cargando...</span>
              </div>
            </div>
          </div>
          </div><!-- end col-lg-4 -->

        </div>
      </div>

      <!-- CLIENTES REGISTRADOS -->
      <div id="clientes-section" class="content-section hidden">
        <h1 class="page-title"><i class="fa-solid fa-users"></i> Clientes Registrados</h1>
        <p class="page-subtitle">Clientes con cuenta en la tienda, su historial y datos de contacto</p>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Lista de clientes</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <input class="form-input" id="clientesSearch" placeholder="Buscar nombre, correo, ciudad..." style="max-width:260px;font-size:13px;" data-oninput="cargarClientesAdmin">
              <button class="btn btn-secondary btn-small" data-call="cargarClientesAdmin">
                <i class="fa-solid fa-rotate-right"></i> Actualizar
              </button>
            </div>
          </div>

          <div class="row row-cols-2 g-3 stats-grid" style="margin-bottom:20px;" id="clientesStatsRow">
            <div class="col">
              <div class="stat-card">
                <div class="stat-title">Total clientes</div>
                <div class="stat-value" id="statTotalClientes">—</div>
              </div>
            </div>
            <div class="col">
              <div class="stat-card">
                <div class="stat-title">Con pedidos</div>
                <div class="stat-value" id="statClientesConPedidos">—</div>
              </div>
            </div>
          </div>

          <div class="table-container">
            <div style="overflow:auto;">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Teléfono</th>
                    <th>Ciudad</th>
                    <th>Pedidos</th>
                    <th>Total gastado</th>
                    <th>Registro</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="clientesAdminBody">
                  <tr><td colspan="9" style="text-align:center;padding:30px;color:var(--muted);">
                    <i class="fa-solid fa-spinner fa-spin"></i> Cargando clientes...
                  </td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div id="clientesPaginacion" style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap;"></div>
        </div>
      </div>

      <!-- MODAL: DETALLE CLIENTE -->
      <div class="modal" id="clienteDetalleModal">
        <div class="modal-content" style="max-width:700px;">
          <div class="modal-header" style="background:var(--accent);color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
            <h3 class="modal-title" style="color:#fff;"><i class="fa-solid fa-user-circle"></i> Perfil del Cliente</h3>
            <button class="modal-close" data-dismiss="clienteDetalleModal" style="color:#fff;">×</button>
          </div>
          <div id="clienteDetalleBody" style="max-height:70vh;overflow-y:auto;">
            <div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>
          </div>
          <div style="display:flex;justify-content:flex-end;padding:12px 0 0;border-top:1px solid var(--border);">
            <button class="btn btn-secondary" data-dismiss="clienteDetalleModal">Cerrar</button>
          </div>
        </div>
      </div>

      <!-- OFERTAS & MARKETING -->
      <div id="ofertas-section" class="content-section hidden">
        <h1 class="page-title"><i class="fa-solid fa-tag"></i> Ofertas & Marketing</h1>
        <p class="page-subtitle">Descuentos, promociones y códigos de cupón para tus clientes</p>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Campañas activas</h2>
            <button class="btn btn-primary" data-call="abrirOfertaModal" data-args='["create"]'>
              <i class="fa-solid fa-plus"></i> Nueva Oferta
            </button>
          </div>

          <div class="table-container">
            <div style="overflow:auto;">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Código</th>
                    <th>Vigencia</th>
                    <th>Usos</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="ofertasAdminBody">
                  <tr><td colspan="8" style="text-align:center;padding:30px;color:var(--muted);">
                    <i class="fa-solid fa-spinner fa-spin"></i> Cargando ofertas...
                  </td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="section" style="margin-top:16px;">
          <div class="section-header"><h2 class="section-title"><i class="fa-solid fa-lightbulb"></i> ¿Cómo funcionan los códigos?</h2></div>
          <div style="color:var(--muted);font-size:13px;line-height:1.7;">
            <p><strong style="color:var(--accent);">Porcentaje:</strong> Descuenta X% del total del pedido. Ej: VERANO20 = 20% off.</p>
            <p style="margin-top:6px;"><strong style="color:var(--accent);">Monto fijo:</strong> Descuenta $X del total. Ej: PROMO500 = $500 off.</p>
            <p style="margin-top:6px;"><strong style="color:var(--accent);">Envío gratis:</strong> Elimina el costo de envío ($500) en el checkout.</p>
            <p style="margin-top:10px;">Los clientes ingresan el código en el checkout antes de pagar. El descuento se aplica automaticamente.</p>
          </div>
        </div>
      </div>

      <!-- MODAL: CREAR/EDITAR OFERTA -->
      <div class="modal" id="ofertaModal">
        <div class="modal-content" style="max-width:560px;">
          <div class="modal-header">
            <h3 class="modal-title" id="ofertaModalTitle"><i class="fa-solid fa-tag"></i> Nueva Oferta</h3>
            <button class="modal-close" data-dismiss="ofertaModal">×</button>
          </div>

          <input type="hidden" id="of_id" value="">
          <input type="hidden" id="of_mode" value="create">

          <div class="row g-3 form-grid">
            <div class="col-12 form-group">
              <label class="form-label">Nombre de la oferta *</label>
              <input type="text" class="form-input" id="of_nombre" placeholder="Ej: Promoción de Verano 20%">
            </div>
            <div class="col-12 form-group">
              <label class="form-label">Descripción (visible al cliente)</label>
              <input type="text" class="form-input" id="of_descripcion" placeholder="Ej: 20% de descuento en todos los muebles">
            </div>
            <div class="col-md-6 form-group">
              <label class="form-label">Tipo de descuento *</label>
              <select class="form-select" id="of_tipo" data-onchange="actualizarValorLabel">
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="monto_fijo">Monto fijo ($)</option>
                <option value="envio_gratis">Envío gratis</option>
              </select>
            </div>
            <div class="col-md-6 form-group">
              <label class="form-label" id="of_valor_label">Valor (%) *</label>
              <input type="number" class="form-input" id="of_valor" min="0" step="0.01" placeholder="20">
            </div>
            <div class="col-md-6 form-group">
              <label class="form-label">Código de cupón (opcional)</label>
              <input type="text" class="form-input" id="of_codigo" placeholder="VERANO20" style="text-transform:uppercase;">
              <div class="help">Si no escribes código, la oferta no requiere cupón</div>
            </div>
            <div class="col-md-6 form-group">
              <label class="form-label">Usos máximos (dejar vacío = ilimitado)</label>
              <input type="number" class="form-input" id="of_usos_max" min="1" placeholder="100">
            </div>
            <div class="col-md-6 form-group">
              <label class="form-label">Fecha inicio</label>
              <input type="date" class="form-input" id="of_fecha_inicio">
            </div>
            <div class="col-md-6 form-group">
              <label class="form-label">Fecha fin</label>
              <input type="date" class="form-input" id="of_fecha_fin">
            </div>
            <div class="col-12 form-group" style="display:flex;align-items:center;gap:10px;">
              <input type="checkbox" id="of_activo" checked style="width:18px;height:18px;accent-color:var(--accent);">
              <label for="of_activo" class="form-label" style="margin:0;cursor:pointer;">Oferta activa (visible para clientes)</label>
            </div>
          </div>

          <div id="of_error" style="display:none;color:#e05;font-size:13px;margin-bottom:12px;padding:10px;background:#2a0a0a;border-radius:6px;"></div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:16px;">
            <button class="btn btn-secondary" data-dismiss="ofertaModal">Cancelar</button>
            <button class="btn btn-primary" id="of_btn_guardar" data-call="guardarOferta">
              <i class="fa-solid fa-floppy-disk"></i> Guardar Oferta
            </button>
          </div>
        </div>
      </div>

    </main>
  </div>


  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
          integrity="sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA=="
          crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js"></script>
  <script src="../assets/js/firebase-config.js"></script>
  <!-- ═══ MODAL: DETALLE PEDIDO (admin) ══════════════════════════ -->
  <div class="modal" id="adminPedidoDetalleModal">
    <div class="modal-content" style="max-width:750px;">
      <div class="modal-header" style="background:var(--accent);color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
        <h3 class="modal-title" style="color:#fff;">
          <i class="fa-solid fa-box"></i> Detalle del Pedido
          <span id="adm_ped_folio" style="font-weight:900;margin-left:8px;opacity:.85;"></span>
        </h3>
        <button class="modal-close" data-dismiss="adminPedidoDetalleModal" style="color:#fff;">×</button>
      </div>
      <div id="adm_ped_body" style="max-height:70vh;overflow-y:auto;overflow-x:hidden;">
        <div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;padding:12px 0 0;margin-top:4px;border-top:1px solid var(--border);">
        <button class="btn btn-secondary" data-dismiss="adminPedidoDetalleModal">Cerrar</button>
        <button class="btn btn-primary" id="adm_ped_edit_btn" data-dismiss="adminPedidoDetalleModal">
          <i class="fa-solid fa-pen"></i> Cambiar Estado
        </button>
      </div>
    </div>
  </div>

  <!-- ═══ MODAL: DETALLE CITA (admin) ════════════════════════════ -->
  <div class="modal" id="adminCitaDetalleModal">
    <div class="modal-content" style="max-width:600px;">
      <div class="modal-header" style="background:#3d4d8b;color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
        <h3 class="modal-title" style="color:#fff;">
          <i class="fa-solid fa-calendar-days"></i> Detalle de Cita
          <span id="adm_cita_folio" style="font-weight:900;margin-left:8px;opacity:.85;"></span>
        </h3>
        <button class="modal-close" data-dismiss="adminCitaDetalleModal" style="color:#fff;">×</button>
      </div>
      <div id="adm_cita_body" style="max-height:70vh;overflow-y:auto;overflow-x:hidden;">
        <div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;padding:12px 0 0;margin-top:4px;border-top:1px solid var(--border);">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-small" data-admin-cita-estado="confirmada">✅ Confirmar</button>
          <button class="btn btn-secondary btn-small" data-admin-cita-estado="completada">🏁 Completar</button>
          <button class="btn btn-danger btn-small"    data-admin-cita-estado="cancelada">❌ Cancelar</button>
        </div>
        <button class="btn btn-secondary" data-dismiss="adminCitaDetalleModal">Cerrar</button>
      </div>
    </div>
  </div>

  <!-- ═══ MODAL: DETALLE COTIZACIÓN (admin) ══════════════════════ -->
  <div class="modal" id="adminCotDetalleModal">
    <div class="modal-content" style="max-width:650px;">
      <div class="modal-header" style="background:#1e5c22;color:#fff;border-radius:8px 8px 0 0;margin:-18px -18px 16px;padding:16px 18px;">
        <h3 class="modal-title" style="color:#fff;">
          <i class="fa-solid fa-briefcase"></i> Detalle de Cotización
          <span id="adm_cot_folio" style="font-weight:900;margin-left:8px;opacity:.85;"></span>
        </h3>
        <button class="modal-close" data-dismiss="adminCotDetalleModal" style="color:#fff;">×</button>
      </div>
      <div id="adm_cot_body" style="max-height:70vh;overflow-y:auto;overflow-x:hidden;">
        <div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;padding:12px 0 0;margin-top:4px;border-top:1px solid var(--border);">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-small" data-admin-cot-estado="en_revision">📋 En Revisión</button>
          <button class="btn btn-secondary btn-small" data-admin-cot-estado="respondida">✅ Respondida</button>
          <button class="btn btn-secondary btn-small" data-admin-cot-estado="cerrada">🔒 Cerrar</button>
        </div>
        <button class="btn btn-secondary" data-dismiss="adminCotDetalleModal">Cerrar</button>
      </div>
    </div>
  </div>

  <script src="../assets/js/panel_administrador.js"></script>
  <script src="../assets/js/event-delegation.js"></script>
  <script src="../assets/js/animations.js"></script>
</body>
</html>