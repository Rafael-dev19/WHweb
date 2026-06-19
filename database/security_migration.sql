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

ALTER TABLE usuarios_personal
    ADD COLUMN IF NOT EXISTS sesiones_revocadas_desde TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS totp_secreto             VARCHAR(64)  NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS totp_activo              TINYINT(1)   NOT NULL DEFAULT 0;

-- ── Tabla: clientes ───────────────────────────────────────────────
-- Misma columna de revocación para clientes e-commerce.

ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS sesiones_revocadas_desde TIMESTAMP NULL DEFAULT NULL;

-- ── Índices opcionales (mejoran velocidad de la verificación) ────
-- No son críticos en tablas pequeñas; añadir si hay miles de filas.
-- CREATE INDEX IF NOT EXISTS idx_revocadas_personal
--     ON usuarios_personal (id, sesiones_revocadas_desde);
-- CREATE INDEX IF NOT EXISTS idx_revocadas_clientes
--     ON clientes (id, sesiones_revocadas_desde);
