-- ================================================================
-- Wooden House — Migración: flujo de producción para cotizaciones
-- Ejecutar UNA SOLA VEZ.
-- Extiende cotizaciones con precio, respuesta formal, token de
-- seguimiento y estados de producción.
-- ================================================================

USE wooden_house;

DROP PROCEDURE IF EXISTS wh_cot_produccion_migration;
DELIMITER $$
CREATE PROCEDURE wh_cot_produccion_migration()
BEGIN

    -- Extender el ENUM de estado para incluir el flujo de producción
    -- (MySQL requiere redeclarar todos los valores al modificar ENUM)
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cotizaciones'
          AND COLUMN_NAME = 'estado'
          AND COLUMN_TYPE NOT LIKE '%en_produccion%'
    ) THEN
        ALTER TABLE cotizaciones
            MODIFY COLUMN estado
                ENUM('nueva','en_revision','respondida','aceptada',
                     'en_produccion','lista','entregada','cancelada')
                NOT NULL DEFAULT 'nueva';
    END IF;

    -- Precio que el admin cotiza al cliente
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cotizaciones'
          AND COLUMN_NAME = 'precio_cotizado'
    ) THEN
        ALTER TABLE cotizaciones
            ADD COLUMN precio_cotizado DECIMAL(10,2) NULL DEFAULT NULL
            AFTER rango_presupuesto;
    END IF;

    -- Descripción formal de la propuesta (qué se va a fabricar, materiales, acabados)
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cotizaciones'
          AND COLUMN_NAME = 'descripcion_respuesta'
    ) THEN
        ALTER TABLE cotizaciones
            ADD COLUMN descripcion_respuesta TEXT NULL DEFAULT NULL
            AFTER precio_cotizado;
    END IF;

    -- Fecha de entrega estimada para el mueble fabricado
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cotizaciones'
          AND COLUMN_NAME = 'fecha_entrega_estimada'
    ) THEN
        ALTER TABLE cotizaciones
            ADD COLUMN fecha_entrega_estimada DATE NULL DEFAULT NULL
            AFTER descripcion_respuesta;
    END IF;

    -- Token para seguimiento público (como en pedidos)
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cotizaciones'
          AND COLUMN_NAME = 'token_seguimiento'
    ) THEN
        ALTER TABLE cotizaciones
            ADD COLUMN token_seguimiento VARCHAR(64) NULL DEFAULT NULL UNIQUE
            AFTER fecha_entrega_estimada;
    END IF;

END$$
DELIMITER ;

CALL wh_cot_produccion_migration();
DROP PROCEDURE IF EXISTS wh_cot_produccion_migration;
