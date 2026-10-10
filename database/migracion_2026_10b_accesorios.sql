-- ================================================================
-- Migración 2026-10 (b) — Accesorios por mueble de baño
-- ================================================================
-- Correr DESPUÉS de migracion_2026_10_catalogo_banos.sql, una sola vez.
-- Ovalín y monomando que eligió el cliente (o ventas) y los adicionales
-- (entrepaño, cajón, puerta, laca, ovalín premium) — ver
-- includes/accesorios.php. Los adicionales se guardan como texto legible
-- ("Cajón adicional, Acabado premium / laca") para que taller e instalación
-- los lean tal cual.
-- ================================================================
ALTER TABLE detalle_pedido ADD COLUMN ovalin VARCHAR(40) NULL AFTER color;
ALTER TABLE detalle_pedido ADD COLUMN monomando VARCHAR(40) NULL AFTER ovalin;
ALTER TABLE detalle_pedido ADD COLUMN adicionales VARCHAR(255) NULL AFTER monomando;

-- Quién del personal registró cada pago manual (efectivo/transferencia/
-- terminal o saldo marcado como cobrado al entregar) — auditoría.
ALTER TABLE pagos ADD COLUMN registrado_por INT NULL AFTER estado;
