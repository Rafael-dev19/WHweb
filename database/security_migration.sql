-- ================================================================
-- Wooden House — Migración de seguridad
-- Ejecutar UNA SOLA VEZ sobre la BD existente.
-- Añade columnas para: revocación de sesiones y 2FA TOTP.
-- ================================================================

USE wooden_house;

-- ── Tabla: usuarios_personal ──────────────────────────────────────
-- sesiones_revocadas_desde: invalidar tokens emitidos antes de esta hora
--   (se escribe en logout; cualquier sesión anterior queda muerta).
-- totp_secreto:  clave Base32 para Google Authenticator / Authy.
-- totp_activo:   0 = desactivado (default), 1 = obligatorio al entrar.

-- ADD COLUMN IF NOT EXISTS es MariaDB; en MySQL 8.0 usar procedimiento
DROP PROCEDURE IF EXISTS wh_security_migration;
DELIMITER $$
CREATE PROCEDURE wh_security_migration()
BEGIN
    -- usuarios_personal: sesiones_revocadas_desde
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios_personal'
          AND COLUMN_NAME = 'sesiones_revocadas_desde'
    ) THEN
        ALTER TABLE usuarios_personal
            ADD COLUMN sesiones_revocadas_desde TIMESTAMP NULL DEFAULT NULL;
    END IF;

    -- usuarios_personal: totp_secreto
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios_personal'
          AND COLUMN_NAME = 'totp_secreto'
    ) THEN
        ALTER TABLE usuarios_personal
            ADD COLUMN totp_secreto VARCHAR(64) NULL DEFAULT NULL;
    END IF;

    -- usuarios_personal: totp_activo
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios_personal'
          AND COLUMN_NAME = 'totp_activo'
    ) THEN
        ALTER TABLE usuarios_personal
            ADD COLUMN totp_activo TINYINT(1) NOT NULL DEFAULT 0;
    END IF;

    -- clientes: sesiones_revocadas_desde
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clientes'
          AND COLUMN_NAME = 'sesiones_revocadas_desde'
    ) THEN
        ALTER TABLE clientes
            ADD COLUMN sesiones_revocadas_desde TIMESTAMP NULL DEFAULT NULL;
    END IF;
END$$
DELIMITER ;

CALL wh_security_migration();
DROP PROCEDURE IF EXISTS wh_security_migration;

-- ── Índices opcionales (mejoran velocidad de la verificación) ────
-- No son críticos en tablas pequeñas; añadir si hay miles de filas.
-- CREATE INDEX IF NOT EXISTS idx_revocadas_personal
--     ON usuarios_personal (id, sesiones_revocadas_desde);
-- CREATE INDEX IF NOT EXISTS idx_revocadas_clientes
--     ON clientes (id, sesiones_revocadas_desde);
