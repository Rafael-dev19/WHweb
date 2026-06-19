-- ================================================================
-- Wooden House — Migración: invitaciones de personal
-- Ejecutar UNA SOLA VEZ.
-- Permite que el admin invite empleados por correo; ellos crean
-- su propia contraseña sin que el admin la conozca.
-- ================================================================

USE wooden_house;

DROP PROCEDURE IF EXISTS wh_invitaciones_migration;
DELIMITER $$
CREATE PROCEDURE wh_invitaciones_migration()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invitaciones_personal'
    ) THEN
        CREATE TABLE invitaciones_personal (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            token         VARCHAR(64)  NOT NULL UNIQUE,
            correo        VARCHAR(255) NOT NULL,
            nombre_completo VARCHAR(255) NOT NULL,
            rol           ENUM('administrador','empleado') NOT NULL DEFAULT 'empleado',
            creada_por    INT          NOT NULL,            -- id en usuarios_personal
            expira_en     DATETIME     NOT NULL,
            usada_en      DATETIME     NULL DEFAULT NULL,
            INDEX idx_token  (token),
            INDEX idx_correo (correo)
        );
    END IF;
END$$
DELIMITER ;

CALL wh_invitaciones_migration();
DROP PROCEDURE IF EXISTS wh_invitaciones_migration;
