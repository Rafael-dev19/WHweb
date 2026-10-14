-- ================================================================
-- Wooden House — Esquema MySQL/MariaDB
-- BD: wooden_house · utf8mb4 / utf8mb4_unicode_ci
--
-- Estado consolidado al 2026-10-14 (versión 2.5.x): incluye todas las
-- migraciones aplicadas hasta hoy, la última es
-- migracion_2026_10d_fotos_modelo.sql (varias fotos por modelo fuera de
-- catálogo).
--
-- USO: solo para crear una base NUEVA (desarrollo local, servidor nuevo).
--   mysql -u root -p < database/schema.sql
-- ¡Borra y vuelve a crear todas las tablas! En una base con datos reales
-- (producción) nunca se corre este archivo: los cambios nuevos van en un
-- archivo aparte database/migracion_AAAA_MM*.sql con solo los ALTER.
--
-- Después de crearla:
--   · datos de ejemplo (opcional): database/seed.sql
--   · el primer usuario jefe se da de alta con su firebase_uid (ver README)
-- ================================================================
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS wooden_house
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE wooden_house;

-- ================================================================
-- Re-ejecución: borra todo (sin revisar llaves foráneas mientras tanto)
-- ================================================================
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notificaciones_personal;
DROP TABLE IF EXISTS dispositivos_push;
DROP TABLE IF EXISTS auditoria_seguridad_personal;
DROP TABLE IF EXISTS invitaciones_personal;
DROP TABLE IF EXISTS cotizacion_imagenes;
DROP TABLE IF EXISTS cotizacion_respuesta_items;
DROP TABLE IF EXISTS cotizador_items_catalogo;
DROP TABLE IF EXISTS cotizaciones;
DROP TABLE IF EXISTS citas;
DROP TABLE IF EXISTS pedido_imagenes_diseno;
DROP TABLE IF EXISTS pedido_adjuntos;
DROP TABLE IF EXISTS pagos;
DROP TABLE IF EXISTS detalle_pedido;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS carritos_guardados;
DROP TABLE IF EXISTS ofertas;
DROP TABLE IF EXISTS producto_medidas;
DROP TABLE IF EXISTS especificaciones_producto;
DROP TABLE IF EXISTS imagenes_producto;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS usuarios_personal;
DROP TABLE IF EXISTS capacidad_produccion;
DROP TABLE IF EXISTS dias_bloqueados;
SET FOREIGN_KEY_CHECKS = 1;


-- ================================================================
-- 1) PERSONAL INTERNO
-- ================================================================

-- Personal del taller. La autenticación vive en Firebase Auth; aquí solo el
-- vínculo (firebase_uid), el rol y el área.
--   jefe          → todo, incluidos montos
--   ventas        → pedidos, cotizaciones, cobros (ve montos)
--   administrador → soporte técnico: catálogo, personal (NO ve montos, NO recibe push)
--   disenador     → diseña pedidos y sube el .skp + carpeta de cortes del CNC
--   empleado      → area 'taller' (fabrica) o 'instalacion' (entrega/instala)
-- sesiones_revocadas_desde: tokens emitidos antes de esa fecha se rechazan.
CREATE TABLE usuarios_personal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firebase_uid VARCHAR(128) NOT NULL UNIQUE,
  nombre_completo VARCHAR(120) NOT NULL,
  correo VARCHAR(150) NOT NULL UNIQUE,
  rol ENUM('jefe','administrador','empleado','disenador','ventas') NOT NULL DEFAULT 'empleado',
  area ENUM('taller','instalacion') NULL DEFAULT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  sesiones_revocadas_desde TIMESTAMP NULL DEFAULT NULL,

  INDEX idx_rol (rol),
  INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invitaciones por correo: el invitado crea su contraseña en /invitacion.php.
CREATE TABLE invitaciones_personal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(64) NOT NULL UNIQUE,
  correo VARCHAR(255) NOT NULL,
  nombre_completo VARCHAR(255) NOT NULL,
  rol ENUM('jefe','administrador','empleado','disenador','ventas') NOT NULL DEFAULT 'empleado',
  area ENUM('taller','instalacion') NULL DEFAULT NULL,
  creada_por INT NOT NULL,
  expira_en DATETIME NOT NULL,
  usada_en DATETIME NULL DEFAULT NULL,

  INDEX idx_token (token),
  INDEX idx_correo (correo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bitácora de acciones sensibles sobre cuentas del personal.
CREATE TABLE auditoria_seguridad_personal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_afectado_id INT NOT NULL,
  ejecutado_por_id INT NOT NULL,
  accion ENUM('reset_2fa','revocar_sesiones','activar_cuenta','desactivar_cuenta') NOT NULL,
  detalle VARCHAR(255) NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_afectado (usuario_afectado_id),
  CONSTRAINT fk_auditoria_afectado FOREIGN KEY (usuario_afectado_id)
    REFERENCES usuarios_personal(id) ON DELETE CASCADE,
  CONSTRAINT fk_auditoria_ejecutor FOREIGN KEY (ejecutado_por_id)
    REFERENCES usuarios_personal(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dispositivos con notificaciones push (Firebase Cloud Messaging). Un token
-- es de UN dispositivo: si otra persona inicia sesión ahí, se reasigna.
CREATE TABLE dispositivos_push (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_personal_id INT NOT NULL,
  fcm_token VARCHAR(255) NOT NULL UNIQUE,
  user_agent VARCHAR(255) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultima_actividad TIMESTAMP NULL DEFAULT NULL,

  INDEX idx_usuario (usuario_personal_id),
  CONSTRAINT fk_dispositivo_push_usuario FOREIGN KEY (usuario_personal_id)
    REFERENCES usuarios_personal(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Campanita de cada panel: una fila POR PERSONA (cada quien ve solo lo suyo
-- y marca como leído lo suyo). Ver notificarPanel() en includes/notifications.php.
CREATE TABLE notificaciones_personal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_personal_id INT NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  mensaje VARCHAR(500) NOT NULL,
  url VARCHAR(200) NULL,
  leida TINYINT(1) NOT NULL DEFAULT 0,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_usuario_leida (usuario_personal_id, leida, fecha),
  CONSTRAINT fk_notif_personal_usuario FOREIGN KEY (usuario_personal_id)
    REFERENCES usuarios_personal(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- 2) CLIENTES (cuenta en el sitio, también con Firebase Auth)
-- ================================================================
CREATE TABLE clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firebase_uid VARCHAR(128) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  correo VARCHAR(150) NOT NULL UNIQUE,
  telefono VARCHAR(30) NULL,
  direccion VARCHAR(255) NULL,
  colonia VARCHAR(120) NULL,
  municipio VARCHAR(100) NULL,
  ciudad VARCHAR(100) NULL,
  cp VARCHAR(10) NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  sesiones_revocadas_desde TIMESTAMP NULL DEFAULT NULL,

  INDEX idx_correo (correo),
  INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- 3) CATÁLOGO
-- ================================================================
CREATE TABLE categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  descripcion TEXT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,

  INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- precio_base = el "desde" (el ancho más barato de producto_medidas).
CREATE TABLE productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categoria_id INT NOT NULL,
  nombre VARCHAR(180) NOT NULL,
  descripcion TEXT NULL,
  precio_base DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  stock_disponible INT NOT NULL DEFAULT 999,
  etiqueta VARCHAR(40) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_categoria (categoria_id),
  INDEX idx_activo (activo),
  INDEX idx_etiqueta (etiqueta),
  CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id)
    REFERENCES categorias(id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fotos del producto (Firebase Storage, carpeta productos/).
CREATE TABLE imagenes_producto (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  url_imagen VARCHAR(350) NOT NULL,
  es_principal TINYINT(1) NOT NULL DEFAULT 0,
  orden INT NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_producto (producto_id),
  INDEX idx_imagen_principal (producto_id, es_principal),
  CONSTRAINT fk_imagenes_producto FOREIGN KEY (producto_id)
    REFERENCES productos(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE especificaciones_producto (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  clave VARCHAR(80) NOT NULL,
  valor VARCHAR(255) NOT NULL,

  UNIQUE KEY uq_especificacion_clave (producto_id, clave),
  INDEX idx_producto (producto_id),
  CONSTRAINT fk_especificaciones_producto FOREIGN KEY (producto_id)
    REFERENCES productos(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catálogo de baño 2026: precio por ancho del mueble (60 a 120 cm).
-- Cocinas y clósets no tienen precio de catálogo: van por cotización.
CREATE TABLE producto_medidas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  ancho_cm SMALLINT NOT NULL,
  precio DECIMAL(10,2) NOT NULL,

  UNIQUE KEY uq_producto_ancho (producto_id, ancho_cm),
  CONSTRAINT fk_medidas_producto FOREIGN KEY (producto_id)
    REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Promociones / cupones.
CREATE TABLE ofertas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT NULL,
  tipo ENUM('porcentaje','monto_fijo','envio_gratis') NOT NULL DEFAULT 'porcentaje',
  valor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  codigo VARCHAR(30) NULL UNIQUE,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_inicio DATE NULL,
  fecha_fin DATE NULL,
  usos_maximos INT NULL,
  usos_actuales INT NOT NULL DEFAULT 0,
  aplica_a ENUM('todos','categoria','producto') NOT NULL DEFAULT 'todos',
  referencia_id INT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_activo (activo),
  INDEX idx_codigo (codigo),
  INDEX idx_fechas (fecha_inicio, fecha_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Carrito guardado del cliente (para retomarlo en otro dispositivo).
CREATE TABLE carritos_guardados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NULL,
  session_token VARCHAR(64) NOT NULL UNIQUE,
  items JSON NOT NULL,
  total_estimado DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  num_productos INT NOT NULL DEFAULT 0,
  fecha_guardado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_cliente (cliente_id),
  INDEX idx_session (session_token),
  INDEX idx_fecha (fecha_guardado),
  CONSTRAINT fk_carrito_cliente FOREIGN KEY (cliente_id)
    REFERENCES clientes(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- 4) PEDIDOS
-- ================================================================

-- Pedido del sitio (carrito) o cargado a mano desde el panel (jefe/ventas/
-- diseñador). Flujo de estado:
--   pendiente → anticipo_pagado / pagado → listo_para_produccion (diseñador)
--   → en_produccion (taller) → alistando_pedido → en_camino_instalacion
--   → finalizado   (o cancelado)
-- tipo_pago: 'anticipo' si queda saldo por cobrar al entregar.
-- telefonos_secundarios: JSON ["33…","33…"]. direccion_envio puede ser un
-- link de Google Maps pegado (pedidos manuales).
-- mensaje_disenador: descripción para el diseñador / mensaje de vuelta.
CREATE TABLE pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_pedido VARCHAR(30) NOT NULL UNIQUE,
  token_seguimiento VARCHAR(32) NOT NULL UNIQUE,
  tipo_proyecto ENUM('bano','cocina','closet') NOT NULL DEFAULT 'bano',
  cliente_id INT NULL,
  disenador_id INT NULL,
  nombre_cliente VARCHAR(120) NOT NULL,
  correo_cliente VARCHAR(150) NOT NULL,
  telefono_cliente VARCHAR(30) NULL,
  telefonos_secundarios TEXT NULL,
  tipo_entrega ENUM('recoger','envio') NOT NULL DEFAULT 'envio',
  direccion_envio VARCHAR(255) NULL,
  colonia_envio VARCHAR(120) NULL,
  ciudad_envio VARCHAR(100) NULL,
  municipio_envio VARCHAR(100) NULL,
  cp_envio VARCHAR(10) NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  incluye_instalacion TINYINT(1) NOT NULL DEFAULT 0,
  fecha_estimada DATE NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  costo_envio DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  costo_instalacion DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  descuento DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tipo_pago ENUM('completo','anticipo') NOT NULL DEFAULT 'completo',
  monto_pagado DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estado ENUM('pendiente','anticipo_pagado','pagado','listo_para_produccion','en_produccion',
              'alistando_pedido','en_camino_instalacion','finalizado','cancelado')
    NOT NULL DEFAULT 'pendiente',
  notas TEXT NULL,
  mensaje_disenador TEXT NULL,
  notificacion_enviada TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_estado (estado),
  INDEX idx_correo (correo_cliente),
  INDEX idx_fecha_estimada (fecha_estimada),
  INDEX idx_fecha_creacion (fecha_creacion),
  INDEX idx_pedidos_cliente (cliente_id),
  CONSTRAINT fk_pedidos_cliente FOREIGN KEY (cliente_id)
    REFERENCES clientes(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_pedidos_disenador FOREIGN KEY (disenador_id)
    REFERENCES usuarios_personal(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Muebles del pedido. producto_id NULL = modelo fuera de catálogo o línea
-- a la medida (cocina/clóset, partida cotizada). cantidad con decimales
-- para partidas en ml/m2.
--   ancho_cm, cubierta (mdf/cuarzo/granito/marmol), color, info_extra
--   ovalin / monomando: código del catálogo de accesorios o 'No lleva'
--   adicionales: texto con los nombres elegidos
--   imagen_referencia: 1ª foto del modelo que trajo el cliente
--   imagenes_referencia: JSON con TODAS sus fotos (hasta 10)
CREATE TABLE detalle_pedido (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  producto_id INT NULL,
  nombre_producto VARCHAR(180) NOT NULL,
  medidas_personalizadas TEXT NULL,
  ancho_cm SMALLINT NULL,
  cubierta VARCHAR(20) NULL,
  color VARCHAR(80) NULL,
  ovalin VARCHAR(40) NULL,
  monomando VARCHAR(40) NULL,
  adicionales VARCHAR(255) NULL,
  info_extra TEXT NULL,
  imagen_referencia VARCHAR(500) NULL,
  imagenes_referencia TEXT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  cantidad DECIMAL(10,3) NOT NULL DEFAULT 1.000,
  unidad VARCHAR(30) NOT NULL DEFAULT 'pza',
  total_linea DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_pedido (pedido_id),
  INDEX idx_producto (producto_id),
  CONSTRAINT fk_detalle_pedido_pedido FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_detalle_pedido_producto FOREIGN KEY (producto_id)
    REFERENCES productos(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pagos: en línea (Stripe/PayPal) o manuales que registra ventas/jefe
-- (efectivo, transferencia, terminal) — registrado_por = quién lo capturó.
CREATE TABLE pagos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  metodo ENUM('stripe','paypal','tarjeta','transferencia','efectivo','terminal') NOT NULL DEFAULT 'stripe',
  proveedor VARCHAR(20) GENERATED ALWAYS AS (CASE metodo WHEN 'paypal' THEN 'paypal' ELSE 'stripe' END) STORED,
  id_transaccion_proveedor VARCHAR(120) NULL,
  referencia_externa VARCHAR(120) NULL,
  estado ENUM('pendiente','aprobado','fallido','reembolsado','cancelado') NOT NULL DEFAULT 'pendiente',
  registrado_por INT NULL,
  monto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  moneda VARCHAR(10) NOT NULL DEFAULT 'MXN',
  payload_proveedor JSON NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_pedido (pedido_id),
  INDEX idx_estado (estado),
  INDEX idx_proveedor (proveedor),
  INDEX idx_ref_ext (referencia_externa),
  CONSTRAINT fk_pagos_pedido FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fotos de referencia y notas de voz del pedido (lo que pidió el cliente),
-- para el diseñador. Firebase Storage, carpeta pedidos/<id>/adjuntos/.
CREATE TABLE pedido_adjuntos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  tipo ENUM('foto','audio') NOT NULL,
  url VARCHAR(350) NOT NULL,
  subido_por INT NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_pedido (pedido_id),
  CONSTRAINT fk_pedido_adjunto_pedido FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pedido_adjunto_subido_por FOREIGN KEY (subido_por)
    REFERENCES usuarios_personal(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Entregables del diseñador (Firebase Storage, proyectos/pedidos/<id>/…):
--   skp      → proyecto de SketchUp (obligatorio)
--   vcarve   → archivos de corte del CNC (.nc/.tap/.dxf), agrupados por
--              carpeta en 'grupo' (ej. "BAÑOS5__10-53-04"); el taller los
--              baja sueltos o en .zip (api/pedidos.php?action=descargar_diseno)
--   sketchup → render en imagen (opcional)
CREATE TABLE pedido_imagenes_diseno (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  url_imagen VARCHAR(350) NOT NULL,
  tipo ENUM('sketchup','vcarve','skp','otro') NOT NULL DEFAULT 'otro',
  grupo VARCHAR(80) NULL DEFAULT NULL,
  subido_por INT NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_pedido (pedido_id),
  CONSTRAINT fk_pedido_img_pedido FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pedido_img_subido_por FOREIGN KEY (subido_por)
    REFERENCES usuarios_personal(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- 5) CITAS Y COTIZACIONES
-- ================================================================

-- Citas de medición/instalación que agenda el cliente.
CREATE TABLE citas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_cita VARCHAR(30) NOT NULL UNIQUE,
  cliente_id INT NULL,
  nombre_cliente VARCHAR(120) NOT NULL,
  correo_cliente VARCHAR(150) NOT NULL,
  telefono_cliente VARCHAR(30) NULL,
  direccion VARCHAR(255) NOT NULL,
  colonia VARCHAR(120) NULL,
  municipio VARCHAR(100) NULL,
  ciudad VARCHAR(100) NULL,
  cp VARCHAR(10) NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  fecha_cita DATE NOT NULL,
  rango_horario VARCHAR(20) NULL,
  tipo ENUM('medicion','instalacion','otro') NOT NULL DEFAULT 'medicion',
  estado ENUM('nueva','confirmada','completada','cancelada') NOT NULL DEFAULT 'nueva',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_estado (estado),
  INDEX idx_fecha_cita (fecha_cita),
  INDEX idx_tipo (tipo),
  CONSTRAINT fk_citas_cliente FOREIGN KEY (cliente_id)
    REFERENCES clientes(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Solicitudes de cotización (cocinas, clósets, muebles especiales). El
-- jefe/ventas responde con partidas, PDF y nota de voz; si el cliente la
-- acepta se convierte en pedido (pedido_id).
CREATE TABLE cotizaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_cotizacion VARCHAR(30) NOT NULL UNIQUE,
  cita_id INT NULL,
  cliente_id INT NULL,
  pedido_id INT NULL,
  nombre_cliente VARCHAR(120) NOT NULL,
  correo_cliente VARCHAR(150) NOT NULL,
  telefono_cliente VARCHAR(30) NULL,
  direccion VARCHAR(255) NULL,
  colonia VARCHAR(120) NULL,
  municipio VARCHAR(100) NULL,
  ciudad VARCHAR(100) NULL,
  cp VARCHAR(10) NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  modelo_mueble VARCHAR(80) NULL,
  tipo_mueble VARCHAR(40) NULL,
  descripcion_solicitud TEXT NOT NULL,
  tiene_medidas TINYINT(1) NOT NULL DEFAULT 0,
  medidas TEXT NULL,
  ancho_espacio DECIMAL(6,2) NULL,
  alto_espacio DECIMAL(6,2) NULL,
  fondo_espacio DECIMAL(6,2) NULL,
  rango_presupuesto VARCHAR(60) NULL,
  requiere_instalacion TINYINT(1) NOT NULL DEFAULT 0,
  precio_cotizado DECIMAL(10,2) NULL,
  descripcion_respuesta TEXT NULL,
  pdf_url VARCHAR(350) NULL,
  audio_respuesta_url VARCHAR(350) NULL,
  fecha_entrega_estimada DATE NULL,
  fecha_visita DATE NULL,
  hora_visita VARCHAR(20) NULL,
  token_seguimiento VARCHAR(64) NULL UNIQUE,
  estado ENUM('nueva','en_revision','respondida','aceptada','en_produccion','lista',
              'entregada','cancelada','convertida_a_pedido') NOT NULL DEFAULT 'nueva',
  confirmada_por_cliente TINYINT(1) NOT NULL DEFAULT 0,
  fecha_confirmacion TIMESTAMP NULL DEFAULT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_estado (estado),
  INDEX idx_correo (correo_cliente),
  INDEX idx_fecha (fecha_creacion),
  CONSTRAINT fk_cotizaciones_cita FOREIGN KEY (cita_id)
    REFERENCES citas(id) ON DELETE SET NULL,
  CONSTRAINT fk_cotizaciones_cliente FOREIGN KEY (cliente_id)
    REFERENCES clientes(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_cotizaciones_pedido FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conceptos frecuentes del cotizador (precio sugerido editable).
CREATE TABLE cotizador_items_catalogo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(60) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  unidad VARCHAR(30) NOT NULL DEFAULT 'pza',
  precio_unitario_default DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  orden INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO cotizador_items_catalogo (clave, nombre, unidad, precio_unitario_default, orden) VALUES
 ('hoja', 'Hoja de material', 'pza', 0, 1),
 ('bisagra', 'Bisagra', 'pza', 0, 2),
 ('corredera_normal', 'Corredera normal', 'pza', 0, 3),
 ('corredera_oculta', 'Corredera oculta', 'pza', 0, 4),
 ('brazo', 'Brazo', 'pza', 0, 5),
 ('enchape_m2', 'Enchape', 'm2', 0, 6),
 ('piedra_ml', 'Piedra (metro lineal)', 'ml', 0, 7);

-- Partidas de cada respuesta (copia: si luego cambia el precio sugerido,
-- las cotizaciones ya respondidas no se alteran).
CREATE TABLE cotizacion_respuesta_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cotizacion_id INT NOT NULL,
  clave_item VARCHAR(60) NOT NULL,
  nombre_item VARCHAR(120) NOT NULL,
  cantidad DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  unidad VARCHAR(30) NOT NULL DEFAULT 'pza',
  precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  subtotal DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(cantidad * precio_unitario, 2)) STORED,
  orden INT NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_cotizacion (cotizacion_id),
  CONSTRAINT fk_cotizacion_item FOREIGN KEY (cotizacion_id)
    REFERENCES cotizaciones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fotos de la cotización: las del cliente (espacio/boceto) y la propuesta.
CREATE TABLE cotizacion_imagenes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cotizacion_id INT NOT NULL,
  tipo ENUM('cliente_espacio','cliente_boceto','jefe_propuesta') NOT NULL,
  url_imagen VARCHAR(350) NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_cotizacion (cotizacion_id),
  CONSTRAINT fk_cotizacion_imagen FOREIGN KEY (cotizacion_id)
    REFERENCES cotizaciones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- 6) CALENDARIO DE PRODUCCIÓN
-- ================================================================

-- Capacidad semanal del taller (se puede bloquear una semana completa).
CREATE TABLE capacidad_produccion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  semana_inicio DATE NOT NULL UNIQUE,
  slots_produccion INT NOT NULL DEFAULT 3,
  slots_entrega INT NOT NULL DEFAULT 5,
  bloqueado TINYINT(1) NOT NULL DEFAULT 0,
  motivo_bloqueo VARCHAR(150) NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_semana (semana_inicio),
  INDEX idx_bloqueado (bloqueado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Días no hábiles: el carrito no ofrece esas fechas de entrega.
CREATE TABLE dias_bloqueados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  motivo VARCHAR(150) NOT NULL DEFAULT 'Día no hábil',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
