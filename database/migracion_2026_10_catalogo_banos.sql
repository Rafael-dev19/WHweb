-- ================================================================
-- Migración 2026-10 — Catálogo de baño 2026 + pedido manual por tipo
-- ================================================================
-- Correr UNA vez en producción (phpMyAdmin → SQL), en este orden.
-- Fuente de los datos: RECURSOS/Catalogo Wooden House.pdf.
--
-- Qué hace:
--   1. Columnas nuevas del pedido manual (teléfonos extra, medidas, ancho,
--      cubierta, color, info extra, foto de referencia, tipo de proyecto).
--   2. pagos.metodo acepta efectivo/transferencia/terminal (ya se usaban).
--   3. producto_medidas: precio por ancho de cada modelo.
--   4. Una sola categoría "Muebles de baño": se desactivan "A piso" y
--      "Flotados" y los modelos viejos (soft delete, los pedidos históricos
--      siguen apuntando a ellos) y se cargan los 7 modelos del PDF.
-- Las fotos están en public/assets/img/catalogo/ (se suben con el código).
-- ================================================================

-- 1) Pedido manual -------------------------------------------------
ALTER TABLE pedidos ADD COLUMN telefonos_secundarios TEXT NULL AFTER telefono_cliente;
ALTER TABLE pedidos ADD COLUMN tipo_proyecto ENUM('bano','cocina','closet') NOT NULL DEFAULT 'bano' AFTER token_seguimiento;

ALTER TABLE detalle_pedido ADD COLUMN medidas_personalizadas TEXT NULL AFTER nombre_producto;
ALTER TABLE detalle_pedido ADD COLUMN ancho_cm SMALLINT NULL AFTER medidas_personalizadas;
ALTER TABLE detalle_pedido ADD COLUMN cubierta VARCHAR(20) NULL AFTER ancho_cm;
ALTER TABLE detalle_pedido ADD COLUMN color VARCHAR(80) NULL AFTER cubierta;
ALTER TABLE detalle_pedido ADD COLUMN info_extra TEXT NULL AFTER color;
ALTER TABLE detalle_pedido ADD COLUMN imagen_referencia VARCHAR(500) NULL AFTER info_extra;

-- 2) Pagos manuales ------------------------------------------------
ALTER TABLE pagos MODIFY COLUMN metodo
  ENUM('stripe','paypal','tarjeta','transferencia','efectivo','terminal') NOT NULL DEFAULT 'stripe';

-- 3) Precio por ancho ----------------------------------------------
CREATE TABLE IF NOT EXISTS producto_medidas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  ancho_cm SMALLINT NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  UNIQUE KEY uq_producto_ancho (producto_id, ancho_cm),
  CONSTRAINT fk_medidas_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Catálogo ------------------------------------------------------
UPDATE productos  SET activo = 0;
UPDATE categorias SET activo = 0;

INSERT INTO categorias (nombre, descripcion, activo)
VALUES ('Muebles de baño', 'Catálogo de muebles de baño 2026 — cada modelo personalizable a la medida', 1)
ON DUPLICATE KEY UPDATE activo = 1, descripcion = VALUES(descripcion);
SET @cat := (SELECT id FROM categorias WHERE nombre = 'Muebles de baño');

-- Precios estándar (Valencia, Texas, Grecia, California, Estambul)
-- 60=$5,800 · 70=$6,100 · 80=$6,400 · 90=$6,700 · 100=$7,000 · 120=$7,600

-- Modelo 01 · Valencia
INSERT INTO productos (categoria_id, nombre, descripcion, precio_base, stock_disponible, etiqueta, activo)
VALUES (@cat, 'Valencia', 'Clásico con doble cajón. Diseño atemporal con cajones amplios que aportan funcionalidad sin perder elegancia. Perfecto para baños principales y de visita.', 5800, 999, NULL, 1);
SET @p := LAST_INSERT_ID();
INSERT INTO producto_medidas (producto_id, ancho_cm, precio) VALUES (@p,60,5800),(@p,70,6100),(@p,80,6400),(@p,90,6700),(@p,100,7000),(@p,120,7600);
INSERT INTO imagenes_producto (producto_id, url_imagen, es_principal, orden) VALUES (@p, '/assets/img/catalogo/valencia.jpg', 1, 0);
INSERT INTO especificaciones_producto (producto_id, clave, valor) VALUES
 (@p,'Estilo','Clásico con doble cajón'),
 (@p,'Mueble','MDF Arauco 15 mm'),
 (@p,'Ovalín','Cerámica (a elegir)'),
 (@p,'Monomando','A elegir'),
 (@p,'Incluye','Céspol y contracanasta'),
 (@p,'Herrajes','Cierre lento'),
 (@p,'Anchos disponibles','60 a 120 cm');

-- Modelo 02 · Texas
INSERT INTO productos (categoria_id, nombre, descripcion, precio_base, stock_disponible, etiqueta, activo)
VALUES (@cat, 'Texas', 'Puerta y cajón. Combinación versátil con puerta lateral y cajón superior, más repisa abierta inferior. Aprovecha el espacio con estilo y funcionalidad.', 5800, 999, NULL, 1);
SET @p := LAST_INSERT_ID();
INSERT INTO producto_medidas (producto_id, ancho_cm, precio) VALUES (@p,60,5800),(@p,70,6100),(@p,80,6400),(@p,90,6700),(@p,100,7000),(@p,120,7600);
INSERT INTO imagenes_producto (producto_id, url_imagen, es_principal, orden) VALUES (@p, '/assets/img/catalogo/texas.jpg', 1, 0);
INSERT INTO especificaciones_producto (producto_id, clave, valor) VALUES
 (@p,'Estilo','Puerta y cajón'),
 (@p,'Mueble','MDF Arauco 15 mm'),
 (@p,'Ovalín','Cerámica (a elegir)'),
 (@p,'Monomando','A elegir'),
 (@p,'Incluye','Céspol y contracanasta'),
 (@p,'Herrajes','Bisagras de cierre lento'),
 (@p,'Anchos disponibles','60 a 120 cm');

-- Modelo 03 · Grecia
INSERT INTO productos (categoria_id, nombre, descripcion, precio_base, stock_disponible, etiqueta, activo)
VALUES (@cat, 'Grecia', 'Rústico con divisiones. Estilo cálido con cajón interior dividido para máxima organización. Textura de madera rústica que aporta carácter al baño.', 5800, 999, NULL, 1);
SET @p := LAST_INSERT_ID();
INSERT INTO producto_medidas (producto_id, ancho_cm, precio) VALUES (@p,60,5800),(@p,70,6100),(@p,80,6400),(@p,90,6700),(@p,100,7000),(@p,120,7600);
INSERT INTO imagenes_producto (producto_id, url_imagen, es_principal, orden) VALUES (@p, '/assets/img/catalogo/grecia.jpg', 1, 0);
INSERT INTO especificaciones_producto (producto_id, clave, valor) VALUES
 (@p,'Estilo','Rústico con divisiones'),
 (@p,'Mueble','MDF Arauco 15 mm'),
 (@p,'Ovalín','Cerámica (a elegir)'),
 (@p,'Monomando','A elegir'),
 (@p,'Incluye','Céspol y contracanasta'),
 (@p,'Cajón','Con organizadores internos'),
 (@p,'Anchos disponibles','60 a 120 cm');

-- Modelo 04 · Ámsterdam (solo puertas, más accesible)
INSERT INTO productos (categoria_id, nombre, descripcion, precio_base, stock_disponible, etiqueta, activo)
VALUES (@cat, 'Ámsterdam', 'Solo puertas, más accesible. Diseño contemporáneo con dos puertas de cierre lento. Al ser solo puertas (sin cajones con correderas), tiene un precio más accesible sin sacrificar el estilo.', 5400, 999, 'Más accesible', 1);
SET @p := LAST_INSERT_ID();
INSERT INTO producto_medidas (producto_id, ancho_cm, precio) VALUES (@p,60,5400),(@p,70,5600),(@p,80,5800),(@p,90,6000),(@p,100,6200),(@p,120,6600);
INSERT INTO imagenes_producto (producto_id, url_imagen, es_principal, orden) VALUES (@p, '/assets/img/catalogo/amsterdam.jpg', 1, 0);
INSERT INTO especificaciones_producto (producto_id, clave, valor) VALUES
 (@p,'Estilo','Solo puertas'),
 (@p,'Mueble','MDF Arauco 15 mm'),
 (@p,'Ovalín','Cerámica (a elegir)'),
 (@p,'Monomando','A elegir'),
 (@p,'Incluye','Céspol y contracanasta'),
 (@p,'Herrajes','Bisagras de cierre lento'),
 (@p,'Anchos disponibles','60 a 120 cm');

-- Modelo 05 · California
INSERT INTO productos (categoria_id, nombre, descripcion, precio_base, stock_disponible, etiqueta, activo)
VALUES (@cat, 'California', 'Bicolor contemporáneo. Contraste moderno entre estructura blanca y cajones en madera veteada. Aporta luminosidad y carácter al espacio.', 5800, 999, NULL, 1);
SET @p := LAST_INSERT_ID();
INSERT INTO producto_medidas (producto_id, ancho_cm, precio) VALUES (@p,60,5800),(@p,70,6100),(@p,80,6400),(@p,90,6700),(@p,100,7000),(@p,120,7600);
INSERT INTO imagenes_producto (producto_id, url_imagen, es_principal, orden) VALUES (@p, '/assets/img/catalogo/california.jpg', 1, 0);
INSERT INTO especificaciones_producto (producto_id, clave, valor) VALUES
 (@p,'Estilo','Bicolor contemporáneo'),
 (@p,'Mueble','MDF Arauco 15 mm bicolor'),
 (@p,'Ovalín','Cerámica (a elegir)'),
 (@p,'Monomando','A elegir'),
 (@p,'Incluye','Céspol y contracanasta'),
 (@p,'Herrajes','Correderas de cierre lento'),
 (@p,'Anchos disponibles','60 a 120 cm');

-- Modelo 06 · París (alta gama con cuarzo)
INSERT INTO productos (categoria_id, nombre, descripcion, precio_base, stock_disponible, etiqueta, activo)
VALUES (@cat, 'París', 'Alta gama con cuarzo. Nuestro modelo estrella de alta gama. Cubierta de cuarzo premium, repisas abiertas de exhibición y dobles cajones con correderas de calidad superior. Precio variable según tipo de piedra.', 13500, 999, 'Alta gama', 1);
SET @p := LAST_INSERT_ID();
INSERT INTO producto_medidas (producto_id, ancho_cm, precio) VALUES (@p,80,13500),(@p,100,15500),(@p,120,17500);
INSERT INTO imagenes_producto (producto_id, url_imagen, es_principal, orden) VALUES (@p, '/assets/img/catalogo/paris.jpg', 1, 0);
INSERT INTO especificaciones_producto (producto_id, clave, valor) VALUES
 (@p,'Estilo','Alta gama con cuarzo'),
 (@p,'Mueble','MDF Arauco 15 mm'),
 (@p,'Cubierta','Cuarzo incluida'),
 (@p,'Ovalín','ELVEX premium'),
 (@p,'Monomando','URREA de alta gama'),
 (@p,'Incluye','Céspol y contracanasta'),
 (@p,'Anchos disponibles','80, 100 y 120 cm');

-- Modelo 07 · Estambul
INSERT INTO productos (categoria_id, nombre, descripcion, precio_base, stock_disponible, etiqueta, activo)
VALUES (@cat, 'Estambul', 'Madera oscura con cubierta. Elegancia en tonos oscuros con cubierta blanca contrastante. Acabado sobrio y sofisticado para quien busca un baño de diseño.', 5800, 999, NULL, 1);
SET @p := LAST_INSERT_ID();
INSERT INTO producto_medidas (producto_id, ancho_cm, precio) VALUES (@p,60,5800),(@p,70,6100),(@p,80,6400),(@p,90,6700),(@p,100,7000),(@p,120,7600);
INSERT INTO imagenes_producto (producto_id, url_imagen, es_principal, orden) VALUES (@p, '/assets/img/catalogo/estambul.jpg', 1, 0);
INSERT INTO especificaciones_producto (producto_id, clave, valor) VALUES
 (@p,'Estilo','Madera oscura con cubierta'),
 (@p,'Mueble','MDF Arauco 15 mm'),
 (@p,'Cubierta','Blanca integrada'),
 (@p,'Ovalín','Cerámica (a elegir)'),
 (@p,'Monomando','A elegir'),
 (@p,'Incluye','Céspol y contracanasta'),
 (@p,'Anchos disponibles','60 a 120 cm');
