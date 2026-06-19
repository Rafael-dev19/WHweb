-- =========================
-- Wooden House - MySQL Schema SIMPLIFICADO
-- BD: wooden_house
-- Versión: E-commerce (sin módulo de inventario completo)
-- =========================
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS wooden_house
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE wooden_house;

-- =========================
-- Re-ejecución segura (borra tablas en orden correcto)
-- =========================
DROP TABLE IF EXISTS pagos;
DROP TABLE IF EXISTS detalle_pedido;
DROP TABLE IF EXISTS pedidos;

DROP TABLE IF EXISTS citas;
DROP TABLE IF EXISTS cotizaciones;

DROP TABLE IF EXISTS especificaciones_producto;
DROP TABLE IF EXISTS imagenes_producto;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS categorias;

DROP TABLE IF EXISTS usuarios_personal;

-- =========================
-- 1) Personal interno (roles)
-- Auth real en Firebase Auth, aquí solo vínculo (firebase_uid) y rol
-- =========================
CREATE TABLE usuarios_personal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firebase_uid VARCHAR(128) NOT NULL UNIQUE,
  nombre_completo VARCHAR(120) NOT NULL,
  correo VARCHAR(150) NOT NULL UNIQUE,
  rol ENUM('administrador','empleado') NOT NULL DEFAULT 'empleado',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  -- Seguridad: revocación de sesiones y 2FA TOTP
  sesiones_revocadas_desde TIMESTAMP NULL DEFAULT NULL,
  totp_secreto VARCHAR(64) NULL DEFAULT NULL,
  totp_activo TINYINT(1) NOT NULL DEFAULT 0,

  INDEX idx_rol (rol),
  INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 2) Catálogo
-- =========================
CREATE TABLE categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  descripcion TEXT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  
  INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categoria_id INT NOT NULL,
  nombre VARCHAR(180) NOT NULL,
  descripcion TEXT NULL,
  precio_base DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  stock_disponible INT NOT NULL DEFAULT 999, -- Fabricación bajo pedido (no aplica stock real)
  etiqueta VARCHAR(40) NULL,  -- 'Nuevo', 'Más vendido', 'Oferta'
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_productos_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
    
  INDEX idx_categoria (categoria_id),
  INDEX idx_activo (activo),
  INDEX idx_etiqueta (etiqueta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE imagenes_producto (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  url_imagen VARCHAR(350) NOT NULL,  -- URL Firebase Storage
  es_principal TINYINT(1) NOT NULL DEFAULT 0,
  orden INT NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_imagenes_producto
    FOREIGN KEY (producto_id) REFERENCES productos(id)
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
    
  INDEX idx_producto (producto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE especificaciones_producto (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  clave VARCHAR(80) NOT NULL,     -- 'dimensiones', 'material', 'acabado'
  valor VARCHAR(255) NOT NULL,

  CONSTRAINT fk_especificaciones_producto
    FOREIGN KEY (producto_id) REFERENCES productos(id)
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
    
  INDEX idx_producto (producto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 3) Cotizaciones y Citas
-- =========================
CREATE TABLE cotizaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_cotizacion VARCHAR(30) NOT NULL UNIQUE,

  nombre_cliente VARCHAR(120) NOT NULL,
  correo_cliente VARCHAR(150) NOT NULL,
  telefono_cliente VARCHAR(30) NULL,

  -- Dirección de entrega/referencia (opcional en cotizaciones)
  direccion  VARCHAR(255) NULL,
  colonia    VARCHAR(120) NULL,
  municipio  VARCHAR(100) NULL,
  ciudad     VARCHAR(100) NULL,
  cp         VARCHAR(10)  NULL,

  modelo_mueble VARCHAR(80) NULL,
  descripcion_solicitud TEXT NOT NULL,
  tiene_medidas TINYINT(1) NOT NULL DEFAULT 0,
  medidas TEXT NULL,
  rango_presupuesto VARCHAR(60) NULL,
  requiere_instalacion TINYINT(1) NOT NULL DEFAULT 0,

  -- Respuesta del admin y flujo de producción
  precio_cotizado DECIMAL(10,2) NULL DEFAULT NULL,
  descripcion_respuesta TEXT NULL DEFAULT NULL,
  fecha_entrega_estimada DATE NULL DEFAULT NULL,
  token_seguimiento VARCHAR(64) NULL DEFAULT NULL UNIQUE,

  estado ENUM('nueva','en_revision','respondida','aceptada',
              'en_produccion','lista','entregada','cancelada') NOT NULL DEFAULT 'nueva',

  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_estado (estado),
  INDEX idx_correo (correo_cliente),
  INDEX idx_fecha (fecha_creacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE citas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_cita VARCHAR(30) NOT NULL UNIQUE,

  nombre_cliente VARCHAR(120) NOT NULL,
  correo_cliente VARCHAR(150) NOT NULL,
  telefono_cliente VARCHAR(30) NULL,

  -- Dirección descompuesta (igual que en pedidos)
  direccion  VARCHAR(255) NOT NULL,
  colonia    VARCHAR(120) NULL,
  municipio  VARCHAR(100) NULL,
  ciudad     VARCHAR(100) NULL,
  cp         VARCHAR(10)  NULL,

  fecha_cita DATE NOT NULL,
  rango_horario VARCHAR(20) NULL,
  tipo ENUM('medicion','instalacion','otro') NOT NULL DEFAULT 'medicion',
  estado ENUM('nueva','confirmada','completada','cancelada') NOT NULL DEFAULT 'nueva',

  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_estado (estado),
  INDEX idx_fecha_cita (fecha_cita),
  INDEX idx_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 4) Pedidos + detalle
-- =========================
CREATE TABLE pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_pedido VARCHAR(30) NOT NULL UNIQUE,
  token_seguimiento VARCHAR(32) NOT NULL UNIQUE,  -- Para tracking sin login

  nombre_cliente VARCHAR(120) NOT NULL,
  correo_cliente VARCHAR(150) NOT NULL,
  telefono_cliente VARCHAR(30) NULL,

  tipo_entrega ENUM('recoger','envio') NOT NULL DEFAULT 'envio',
  direccion_envio VARCHAR(255) NULL,
  colonia_envio   VARCHAR(120) NULL,   -- Colonia para localización precisa
  ciudad_envio    VARCHAR(100) NULL,   -- Ciudad para agrupación logística
  municipio_envio VARCHAR(100) NULL,   -- Municipio (puede diferir de la ciudad)
  cp_envio        VARCHAR(10)  NULL,   -- Código postal para agrupación logística

  incluye_instalacion TINYINT(1) NOT NULL DEFAULT 0,
  fecha_estimada DATE NULL,

  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  costo_envio DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  costo_instalacion DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  descuento DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,

  estado ENUM('pendiente','pagado','en_produccion','listo','entregado','cancelado')
    NOT NULL DEFAULT 'pendiente',

  notas VARCHAR(255) NULL,
  notificacion_enviada TINYINT(1) NOT NULL DEFAULT 0,  -- Evita enviar emails duplicados

  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_estado (estado),
  INDEX idx_correo (correo_cliente),
  INDEX idx_fecha_estimada (fecha_estimada),
  INDEX idx_fecha_creacion (fecha_creacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE detalle_pedido (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  producto_id INT NULL,  -- NULL si es personalizado
  nombre_producto VARCHAR(180) NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  cantidad INT NOT NULL DEFAULT 1,
  total_linea DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_detalle_pedido_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
    ON DELETE CASCADE 
    ON UPDATE CASCADE,

  CONSTRAINT fk_detalle_pedido_producto
    FOREIGN KEY (producto_id) REFERENCES productos(id)
    ON DELETE SET NULL 
    ON UPDATE CASCADE,
    
  INDEX idx_pedido (pedido_id),
  INDEX idx_producto (producto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 5) Pagos (sin datos de tarjeta)
-- =========================
CREATE TABLE pagos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,

  -- 'stripe' = pago con tarjeta vía Stripe, 'paypal' = pago vía PayPal
  metodo ENUM('stripe','paypal','tarjeta') NOT NULL DEFAULT 'stripe',

  -- Generado automáticamente: no hay que insertarlo desde PHP
  proveedor VARCHAR(20) GENERATED ALWAYS AS (
    CASE metodo WHEN 'paypal' THEN 'paypal' ELSE 'stripe' END
  ) STORED,

  -- ID de la transacción del proveedor (PayPal capture id / Stripe charge id)
  id_transaccion_proveedor VARCHAR(120) NULL,

  -- Referencia que guarda el PHP (PayPal orderID / Stripe payment_intent id)
  referencia_externa VARCHAR(120) NULL,

  estado ENUM('pendiente','aprobado','fallido','reembolsado','cancelado')
    NOT NULL DEFAULT 'pendiente',

  monto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  moneda VARCHAR(10) NOT NULL DEFAULT 'MXN',

  -- Respuesta completa del proveedor para debug/auditoría
  payload_proveedor JSON NULL,

  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_pagos_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_pedido (pedido_id),
  INDEX idx_estado (estado),
  INDEX idx_proveedor (proveedor),
  INDEX idx_ref_ext (referencia_externa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- Constraints únicas
-- =========================

-- Índice para búsquedas rápidas de imagen principal por producto
-- (La unicidad de es_principal=1 se controla desde la aplicación)
CREATE INDEX idx_imagen_principal
ON imagenes_producto (producto_id, es_principal);

-- No repetir la misma clave de especificación en el mismo producto
CREATE UNIQUE INDEX uq_especificacion_clave
ON especificaciones_producto (producto_id, clave);
-- ================================================================
-- CAPACIDAD DE PRODUCCIÓN Y ENTREGAS
-- Controla cuántos pedidos/entregas pueden agendarse por semana
-- El admin configura esto desde el panel
-- ================================================================

CREATE TABLE IF NOT EXISTS capacidad_produccion (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Semana representada como el lunes de esa semana
  semana_inicio DATE NOT NULL UNIQUE,

  -- Cuántos pedidos NUEVOS puede entrar a producción esa semana
  slots_produccion INT NOT NULL DEFAULT 3,

  -- Cuántas entregas/instalaciones pueden hacerse esa semana
  slots_entrega INT NOT NULL DEFAULT 5,

  -- Bloqueo total (vacaciones, cierre, etc.)
  bloqueado TINYINT(1) NOT NULL DEFAULT 0,
  motivo_bloqueo VARCHAR(150) NULL,

  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_semana (semana_inicio),
  INDEX idx_bloqueado (bloqueado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- DÍAS BLOQUEADOS ESPECÍFICOS
-- Para días festivos, mantenimiento, etc.
-- ================================================================
CREATE TABLE IF NOT EXISTS dias_bloqueados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  motivo VARCHAR(150) NOT NULL DEFAULT 'Día no hábil',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- CLIENTES REGISTRADOS (e-commerce)
-- Los clientes usan Firebase Auth pero se guardan aquí, separados
-- del personal interno (usuarios_personal)
-- ================================================================
DROP TABLE IF EXISTS ofertas;
DROP TABLE IF EXISTS clientes;

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
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  -- Seguridad: revocación de sesiones robadas
  sesiones_revocadas_desde TIMESTAMP NULL DEFAULT NULL,

  INDEX idx_correo (correo),
  INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar campo municipio_envio (ejecutar en instalaciones existentes)
ALTER TABLE pedidos ADD COLUMN municipio_envio VARCHAR(100) NULL AFTER ciudad_envio;

-- Vincular pedidos a clientes (nullable para pedidos históricos de invitados)
ALTER TABLE pedidos ADD COLUMN cliente_id INT NULL AFTER token_seguimiento;
ALTER TABLE pedidos ADD CONSTRAINT fk_pedidos_cliente
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX idx_pedidos_cliente ON pedidos (cliente_id);

-- Columnas que pueden faltar en instalaciones existentes previas al módulo de clientes
-- Nota: ejecutar cada ALTER solo si la columna no existe aún
ALTER TABLE cotizaciones ADD COLUMN modelo_mueble VARCHAR(80) NULL AFTER telefono_cliente;

-- Dirección descompuesta en cotizaciones (instalaciones existentes)
ALTER TABLE cotizaciones ADD COLUMN direccion  VARCHAR(255) NULL AFTER modelo_mueble;
ALTER TABLE cotizaciones ADD COLUMN colonia    VARCHAR(120) NULL AFTER direccion;
ALTER TABLE cotizaciones ADD COLUMN municipio  VARCHAR(100) NULL AFTER colonia;
ALTER TABLE cotizaciones ADD COLUMN ciudad     VARCHAR(100) NULL AFTER municipio;
ALTER TABLE cotizaciones ADD COLUMN cp         VARCHAR(10)  NULL AFTER ciudad;

-- Dirección descompuesta en citas (instalaciones existentes)
ALTER TABLE citas ADD COLUMN colonia    VARCHAR(120) NULL AFTER direccion;
ALTER TABLE citas ADD COLUMN municipio  VARCHAR(100) NULL AFTER colonia;
ALTER TABLE citas ADD COLUMN ciudad     VARCHAR(100) NULL AFTER municipio;
ALTER TABLE citas ADD COLUMN cp         VARCHAR(10)  NULL AFTER ciudad;

-- Vincular cotizaciones a clientes
ALTER TABLE cotizaciones ADD COLUMN cliente_id INT NULL AFTER numero_cotizacion;
ALTER TABLE cotizaciones ADD CONSTRAINT fk_cotizaciones_cliente
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Vincular citas a clientes
ALTER TABLE citas ADD COLUMN cliente_id INT NULL AFTER numero_cita;
ALTER TABLE citas ADD CONSTRAINT fk_citas_cliente
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ================================================================
-- OFERTAS Y PROMOCIONES (Marketing)
-- Descuentos, cupones y campanhas de marketing
-- ================================================================
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

-- ================================================================
-- CARRITOS GUARDADOS
-- Persistencia del carrito para recuperación entre sesiones
-- Permite restaurar el carrito cuando el cliente regresa al sitio
-- ================================================================
CREATE TABLE IF NOT EXISTS carritos_guardados (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Cliente registrado (NULL si es visitante anónimo)
  cliente_id INT NULL,

  -- Token único de sesión para identificar carritos de visitantes
  session_token VARCHAR(64) NOT NULL UNIQUE,

  -- Items del carrito en formato JSON
  items JSON NOT NULL,

  -- Total estimado (calculado al guardar, para referencia rápida)
  total_estimado DECIMAL(10,2) NOT NULL DEFAULT 0.00,

  -- Número de productos en el carrito
  num_productos INT NOT NULL DEFAULT 0,

  fecha_guardado    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_carrito_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  INDEX idx_cliente  (cliente_id),
  INDEX idx_session  (session_token),
  INDEX idx_fecha    (fecha_guardado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- ANTICIPO / PAGO PARCIAL (ejecutar en instalaciones existentes)
-- tipo_pago: elegido por el cliente en el carrito (completo o 50% anticipo)
-- monto_pagado: suma de pagos aprobados (stripe/paypal/manual) para el pedido
-- estado 'anticipo_pagado': se pagó el anticipo, falta liquidar el saldo
-- ================================================================
ALTER TABLE pedidos ADD COLUMN tipo_pago ENUM('completo','anticipo') NOT NULL DEFAULT 'completo' AFTER total;
ALTER TABLE pedidos ADD COLUMN monto_pagado DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER tipo_pago;
ALTER TABLE pedidos MODIFY COLUMN estado ENUM('pendiente','anticipo_pagado','pagado','en_produccion','listo','entregado','cancelado')
  NOT NULL DEFAULT 'pendiente';

-- ================================================================
-- INVITACIONES DE PERSONAL
-- El admin invita empleados por correo; ellos crean su propia
-- contraseña sin que el admin la conozca nunca.
-- ================================================================
CREATE TABLE IF NOT EXISTS invitaciones_personal (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  token         VARCHAR(64)  NOT NULL UNIQUE,
  correo        VARCHAR(255) NOT NULL,
  nombre_completo VARCHAR(255) NOT NULL,
  rol           ENUM('administrador','empleado') NOT NULL DEFAULT 'empleado',
  creada_por    INT          NOT NULL,
  expira_en     DATETIME     NOT NULL,
  usada_en      DATETIME     NULL DEFAULT NULL,

  INDEX idx_token  (token),
  INDEX idx_correo (correo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;