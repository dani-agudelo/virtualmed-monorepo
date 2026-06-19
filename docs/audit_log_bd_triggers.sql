-- =============================================================================
-- audit_log_bd_triggers.sql  (PostgreSQL)
-- =============================================================================
-- Alcance: roles, permissions, role_permissions, appointments, clinical_encounters,
--          diagnoses, prescriptions, medications, prescription_medications,
--          video_sessions, video_chat_messages
-- Escritura: triggers I/U/D que INSERTAN filas en audit_logs (OldData/NewData jsonb).
--
-- Tablas auditadas aquí:
--   roles, permissions, role_permissions,
--   appointments, clinical_encounters, diagnoses, prescriptions,
--   medications, prescription_medications,
--   video_sessions, video_chat_messages
--
-- Notas:
--   - app.user_id: opcional; la app lo setea vía interceptor antes de SaveChanges.
--   - video_sessions: en NewData/OldData se omite la columna RoomToken (secreto de sala).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Extensión (también puede estar ya aplicada por la migración EF)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 2) Índices sobre audit_logs (tabla creada por EF; IF NOT EXISTS = idempotente)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "IX_audit_logs_OccurredAt" ON audit_logs ("OccurredAt");
CREATE INDEX IF NOT EXISTS "IX_audit_logs_TableName" ON audit_logs ("TableName");
CREATE INDEX IF NOT EXISTS "IX_audit_logs_RowPk" ON audit_logs ("RowPk");

-- -----------------------------------------------------------------------------
-- 3) Función genérica UpdatedAt
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at_generic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."UpdatedAt" = now();
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4) Lectura de app.user_id (SET LOCAL desde la app antes de SaveChanges)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_get_app_user_id()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN NULLIF(current_setting('app.user_id', true), '');
END;
$$;

-- =============================================================================
-- 5) RBAC y dominio clínico: columnas UpdatedAt + triggers de auditoría
-- =============================================================================

-- --- roles ---
ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS "CreatedAt" timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_roles_set_updated_at ON roles;
CREATE TRIGGER trg_roles_set_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_generic();

CREATE OR REPLACE FUNCTION audit_roles_iud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_json jsonb;
    new_json jsonb;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        new_json := jsonb_build_object(
            'Id', NEW."Id",
            'Name', NEW."Name"
        );

        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('roles','I', NEW."Id"::text, NULL, new_json, audit_get_app_user_id());

        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Solo auditar si cambió el campo de negocio
        IF NEW."Name" IS DISTINCT FROM OLD."Name" THEN
            old_json := jsonb_build_object('Name', OLD."Name");
            new_json := jsonb_build_object('Name', NEW."Name");

            INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
            VALUES ('roles','U', NEW."Id"::text, old_json, new_json, audit_get_app_user_id());
        END IF;

        RETURN NEW;
    ELSE -- DELETE
        old_json := jsonb_build_object(
            'Id', OLD."Id",
            'Name', OLD."Name"
        );

        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('roles','D', OLD."Id"::text, old_json, NULL, audit_get_app_user_id());

        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_roles_audit_iud ON roles;
CREATE TRIGGER trg_roles_audit_iud
AFTER INSERT OR UPDATE OR DELETE ON roles
FOR EACH ROW
EXECUTE FUNCTION audit_roles_iud();

-- =========================================================
-- Permissions: created_at/updated_at + audit de cambios
-- =========================================================
ALTER TABLE permissions
    ADD COLUMN IF NOT EXISTS "CreatedAt" timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_permissions_set_updated_at ON permissions;
CREATE TRIGGER trg_permissions_set_updated_at
BEFORE UPDATE ON permissions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_generic();

CREATE OR REPLACE FUNCTION audit_permissions_iud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_json jsonb;
    new_json jsonb;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        new_json := jsonb_build_object(
            'Id', NEW."Id",
            'Name', NEW."Name",
            'Description', NEW."Description",
            'Resource', NEW."Resource",
            'Action', NEW."Action"
        );

        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('permissions','I', NEW."Id"::text, NULL, new_json, audit_get_app_user_id());

        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        old_json := '{}'::jsonb;
        new_json := '{}'::jsonb;

        IF NEW."Name" IS DISTINCT FROM OLD."Name" THEN
            old_json := old_json || jsonb_build_object('Name', OLD."Name");
            new_json := new_json || jsonb_build_object('Name', NEW."Name");
        END IF;

        IF NEW."Description" IS DISTINCT FROM OLD."Description" THEN
            old_json := old_json || jsonb_build_object('Description', OLD."Description");
            new_json := new_json || jsonb_build_object('Description', NEW."Description");
        END IF;

        IF NEW."Resource" IS DISTINCT FROM OLD."Resource" THEN
            old_json := old_json || jsonb_build_object('Resource', OLD."Resource");
            new_json := new_json || jsonb_build_object('Resource', NEW."Resource");
        END IF;

        IF NEW."Action" IS DISTINCT FROM OLD."Action" THEN
            old_json := old_json || jsonb_build_object('Action', OLD."Action");
            new_json := new_json || jsonb_build_object('Action', NEW."Action");
        END IF;

        -- Solo auditar si al menos una columna cambió
        IF new_json <> '{}'::jsonb THEN
            INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
            VALUES ('permissions','U', NEW."Id"::text, old_json, new_json, audit_get_app_user_id());
        END IF;

        RETURN NEW;
    ELSE -- DELETE
        old_json := jsonb_build_object(
            'Id', OLD."Id",
            'Name', OLD."Name",
            'Description', OLD."Description",
            'Resource', OLD."Resource",
            'Action', OLD."Action"
        );

        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('permissions','D', OLD."Id"::text, old_json, NULL, audit_get_app_user_id());

        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_permissions_audit_iud ON permissions;
CREATE TRIGGER trg_permissions_audit_iud
AFTER INSERT OR UPDATE OR DELETE ON permissions
FOR EACH ROW
EXECUTE FUNCTION audit_permissions_iud();

-- =========================================================
-- role_permissions (puente): created_at/updated_at + audit
-- =========================================================
ALTER TABLE role_permissions
    ADD COLUMN IF NOT EXISTS "CreatedAt" timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_role_permissions_set_updated_at ON role_permissions;
CREATE TRIGGER trg_role_permissions_set_updated_at
BEFORE UPDATE ON role_permissions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_generic();

CREATE OR REPLACE FUNCTION audit_role_permissions_iud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_json jsonb;
    new_json jsonb;
    pk text;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        pk := format('RoleId=%s;PermissionId=%s', NEW."RoleId"::text, NEW."PermissionId"::text);

        new_json := jsonb_build_object(
            'RoleId', NEW."RoleId",
            'PermissionId', NEW."PermissionId"
        );

        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('role_permissions','I', pk, NULL, new_json, audit_get_app_user_id());

        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        pk := format('RoleId=%s;PermissionId=%s', NEW."RoleId"::text, NEW."PermissionId"::text);

        IF NEW."RoleId" IS DISTINCT FROM OLD."RoleId" OR NEW."PermissionId" IS DISTINCT FROM OLD."PermissionId" THEN
            old_json := jsonb_build_object(
                'RoleId', OLD."RoleId",
                'PermissionId', OLD."PermissionId"
            );
            new_json := jsonb_build_object(
                'RoleId', NEW."RoleId",
                'PermissionId', NEW."PermissionId"
            );

            INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
            VALUES ('role_permissions','U', pk, old_json, new_json, audit_get_app_user_id());
        END IF;

        RETURN NEW;
    ELSE -- DELETE
        pk := format('RoleId=%s;PermissionId=%s', OLD."RoleId"::text, OLD."PermissionId"::text);

        old_json := jsonb_build_object(
            'RoleId', OLD."RoleId",
            'PermissionId', OLD."PermissionId"
        );

        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('role_permissions','D', pk, old_json, NULL, audit_get_app_user_id());

        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_role_permissions_audit_iud ON role_permissions;
CREATE TRIGGER trg_role_permissions_audit_iud
AFTER INSERT OR UPDATE OR DELETE ON role_permissions
FOR EACH ROW
EXECUTE FUNCTION audit_role_permissions_iud();

-- =========================================================
-- appointments: created_at/updated_at + audit
-- =========================================================
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS "CreatedAt" timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_appointments_set_updated_at ON appointments;
CREATE TRIGGER trg_appointments_set_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_generic();

CREATE OR REPLACE FUNCTION audit_appointments_iud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_json jsonb;
    new_json jsonb;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        new_json := to_jsonb(NEW) - 'CreatedAt' - 'UpdatedAt';
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('appointments','I', NEW."Id"::text, NULL, new_json, audit_get_app_user_id());
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        old_json := to_jsonb(OLD) - 'CreatedAt' - 'UpdatedAt';
        new_json := to_jsonb(NEW) - 'CreatedAt' - 'UpdatedAt';
        IF old_json IS DISTINCT FROM new_json THEN
            INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
            VALUES ('appointments','U', NEW."Id"::text, old_json, new_json, audit_get_app_user_id());
        END IF;
        RETURN NEW;
    ELSE
        old_json := to_jsonb(OLD) - 'CreatedAt' - 'UpdatedAt';
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('appointments','D', OLD."Id"::text, old_json, NULL, audit_get_app_user_id());
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_audit_iud ON appointments;
CREATE TRIGGER trg_appointments_audit_iud
AFTER INSERT OR UPDATE OR DELETE ON appointments
FOR EACH ROW
EXECUTE FUNCTION audit_appointments_iud();

-- =========================================================
-- clinical_encounters: created_at/updated_at + audit
-- =========================================================
ALTER TABLE clinical_encounters
    ADD COLUMN IF NOT EXISTS "CreatedAt" timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_clinical_encounters_set_updated_at ON clinical_encounters;
CREATE TRIGGER trg_clinical_encounters_set_updated_at
BEFORE UPDATE ON clinical_encounters
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_generic();

CREATE OR REPLACE FUNCTION audit_clinical_encounters_iud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_json jsonb;
    new_json jsonb;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        new_json := to_jsonb(NEW) - 'CreatedAt' - 'UpdatedAt';

        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('clinical_encounters','I', NEW."Id"::text, NULL, new_json, audit_get_app_user_id());
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        old_json := to_jsonb(OLD) - 'CreatedAt' - 'UpdatedAt';
        new_json := to_jsonb(NEW) - 'CreatedAt' - 'UpdatedAt';

        IF old_json IS DISTINCT FROM new_json THEN
            INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
            VALUES ('clinical_encounters','U', NEW."Id"::text, old_json, new_json, audit_get_app_user_id());
        END IF;
        RETURN NEW;
    ELSE
        old_json := to_jsonb(OLD) - 'CreatedAt' - 'UpdatedAt';
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('clinical_encounters','D', OLD."Id"::text, old_json, NULL, audit_get_app_user_id());
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_encounters_audit_iud ON clinical_encounters;
CREATE TRIGGER trg_clinical_encounters_audit_iud
AFTER INSERT OR UPDATE OR DELETE ON clinical_encounters
FOR EACH ROW
EXECUTE FUNCTION audit_clinical_encounters_iud();

-- =========================================================
-- diagnoses: created_at/updated_at + audit
-- =========================================================
ALTER TABLE diagnoses
    ADD COLUMN IF NOT EXISTS "CreatedAt" timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_diagnoses_set_updated_at ON diagnoses;
CREATE TRIGGER trg_diagnoses_set_updated_at
BEFORE UPDATE ON diagnoses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_generic();

CREATE OR REPLACE FUNCTION audit_diagnoses_iud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_json jsonb;
    new_json jsonb;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        new_json := to_jsonb(NEW) - 'CreatedAt' - 'UpdatedAt';
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('diagnoses','I', NEW."Id"::text, NULL, new_json, audit_get_app_user_id());
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        old_json := to_jsonb(OLD) - 'CreatedAt' - 'UpdatedAt';
        new_json := to_jsonb(NEW) - 'CreatedAt' - 'UpdatedAt';
        IF old_json IS DISTINCT FROM new_json THEN
            INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
            VALUES ('diagnoses','U', NEW."Id"::text, old_json, new_json, audit_get_app_user_id());
        END IF;
        RETURN NEW;
    ELSE
        old_json := to_jsonb(OLD) - 'CreatedAt' - 'UpdatedAt';
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('diagnoses','D', OLD."Id"::text, old_json, NULL, audit_get_app_user_id());
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_diagnoses_audit_iud ON diagnoses;
CREATE TRIGGER trg_diagnoses_audit_iud
AFTER INSERT OR UPDATE OR DELETE ON diagnoses
FOR EACH ROW
EXECUTE FUNCTION audit_diagnoses_iud();

-- =========================================================
-- prescriptions: created_at/updated_at + audit
-- =========================================================
ALTER TABLE prescriptions
    ADD COLUMN IF NOT EXISTS "CreatedAt" timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_prescriptions_set_updated_at ON prescriptions;
CREATE TRIGGER trg_prescriptions_set_updated_at
BEFORE UPDATE ON prescriptions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_generic();

CREATE OR REPLACE FUNCTION audit_prescriptions_iud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_json jsonb;
    new_json jsonb;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        new_json := to_jsonb(NEW) - 'CreatedAt' - 'UpdatedAt';
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('prescriptions','I', NEW."Id"::text, NULL, new_json, audit_get_app_user_id());
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        old_json := to_jsonb(OLD) - 'CreatedAt' - 'UpdatedAt';
        new_json := to_jsonb(NEW) - 'CreatedAt' - 'UpdatedAt';
        IF old_json IS DISTINCT FROM new_json THEN
            INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
            VALUES ('prescriptions','U', NEW."Id"::text, old_json, new_json, audit_get_app_user_id());
        END IF;
        RETURN NEW;
    ELSE
        old_json := to_jsonb(OLD) - 'CreatedAt' - 'UpdatedAt';
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('prescriptions','D', OLD."Id"::text, old_json, NULL, audit_get_app_user_id());
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescriptions_audit_iud ON prescriptions;
CREATE TRIGGER trg_prescriptions_audit_iud
AFTER INSERT OR UPDATE OR DELETE ON prescriptions
FOR EACH ROW
EXECUTE FUNCTION audit_prescriptions_iud();

-- =========================================================
-- medications: created_at/updated_at + audit
-- =========================================================
ALTER TABLE medications
    ADD COLUMN IF NOT EXISTS "CreatedAt" timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_medications_set_updated_at ON medications;
CREATE TRIGGER trg_medications_set_updated_at
BEFORE UPDATE ON medications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_generic();

CREATE OR REPLACE FUNCTION audit_medications_iud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_json jsonb;
    new_json jsonb;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        new_json := to_jsonb(NEW) - 'CreatedAt' - 'UpdatedAt';
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('medications','I', NEW."Id"::text, NULL, new_json, audit_get_app_user_id());
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        old_json := to_jsonb(OLD) - 'CreatedAt' - 'UpdatedAt';
        new_json := to_jsonb(NEW) - 'CreatedAt' - 'UpdatedAt';
        IF old_json IS DISTINCT FROM new_json THEN
            INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
            VALUES ('medications','U', NEW."Id"::text, old_json, new_json, audit_get_app_user_id());
        END IF;
        RETURN NEW;
    ELSE
        old_json := to_jsonb(OLD) - 'CreatedAt' - 'UpdatedAt';
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('medications','D', OLD."Id"::text, old_json, NULL, audit_get_app_user_id());
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_medications_audit_iud ON medications;
CREATE TRIGGER trg_medications_audit_iud
AFTER INSERT OR UPDATE OR DELETE ON medications
FOR EACH ROW
EXECUTE FUNCTION audit_medications_iud();

-- =========================================================
-- prescription_medications: created_at/updated_at + audit
-- =========================================================
ALTER TABLE prescription_medications
    ADD COLUMN IF NOT EXISTS "CreatedAt" timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_prescription_medications_set_updated_at ON prescription_medications;
CREATE TRIGGER trg_prescription_medications_set_updated_at
BEFORE UPDATE ON prescription_medications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_generic();

CREATE OR REPLACE FUNCTION audit_prescription_medications_iud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_json jsonb;
    new_json jsonb;
    pk text;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        pk := format('PrescriptionId=%s;MedicationId=%s', NEW."PrescriptionId"::text, NEW."MedicationId"::text);
        new_json := to_jsonb(NEW) - 'CreatedAt' - 'UpdatedAt';
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('prescription_medications','I', pk, NULL, new_json, audit_get_app_user_id());
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        pk := format('PrescriptionId=%s;MedicationId=%s', NEW."PrescriptionId"::text, NEW."MedicationId"::text);
        old_json := to_jsonb(OLD) - 'CreatedAt' - 'UpdatedAt';
        new_json := to_jsonb(NEW) - 'CreatedAt' - 'UpdatedAt';
        IF old_json IS DISTINCT FROM new_json THEN
            INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
            VALUES ('prescription_medications','U', pk, old_json, new_json, audit_get_app_user_id());
        END IF;
        RETURN NEW;
    ELSE
        pk := format('PrescriptionId=%s;MedicationId=%s', OLD."PrescriptionId"::text, OLD."MedicationId"::text);
        old_json := to_jsonb(OLD) - 'CreatedAt' - 'UpdatedAt';
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('prescription_medications','D', pk, old_json, NULL, audit_get_app_user_id());
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescription_medications_audit_iud ON prescription_medications;
CREATE TRIGGER trg_prescription_medications_audit_iud
AFTER INSERT OR UPDATE OR DELETE ON prescription_medications
FOR EACH ROW
EXECUTE FUNCTION audit_prescription_medications_iud();

-- =========================================================
-- video_sessions: updated_at + audit (create/start/end/refresh vía fila)
-- RowPk = SessionId (identificador público de la sala).
-- =========================================================
DROP TRIGGER IF EXISTS trg_video_sessions_set_updated_at ON video_sessions;
CREATE TRIGGER trg_video_sessions_set_updated_at
BEFORE UPDATE ON video_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_generic();

CREATE OR REPLACE FUNCTION audit_video_sessions_row_json(v video_sessions)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT (to_jsonb(v) - 'CreatedAt' - 'UpdatedAt' - 'RoomToken')
        || jsonb_build_object('roomToken', '[redacted]');
$$;

CREATE OR REPLACE FUNCTION audit_video_sessions_iud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_json jsonb;
    new_json jsonb;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        new_json := audit_video_sessions_row_json(NEW);
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('video_sessions','I', NEW."SessionId"::text, NULL, new_json, audit_get_app_user_id());
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        old_json := audit_video_sessions_row_json(OLD);
        new_json := audit_video_sessions_row_json(NEW);
        IF old_json IS DISTINCT FROM new_json THEN
            INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
            VALUES ('video_sessions','U', NEW."SessionId"::text, old_json, new_json, audit_get_app_user_id());
        END IF;
        RETURN NEW;
    ELSE
        old_json := audit_video_sessions_row_json(OLD);
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('video_sessions','D', OLD."SessionId"::text, old_json, NULL, audit_get_app_user_id());
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_video_sessions_audit_iud ON video_sessions;
CREATE TRIGGER trg_video_sessions_audit_iud
AFTER INSERT OR UPDATE OR DELETE ON video_sessions
FOR EACH ROW
EXECUTE FUNCTION audit_video_sessions_iud();

-- =========================================================
-- video_chat_messages: audit (mensajes de chat persistidos)
-- =========================================================
CREATE OR REPLACE FUNCTION audit_video_chat_messages_iud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_json jsonb;
    new_json jsonb;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        new_json := to_jsonb(NEW);
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('video_chat_messages','I', NEW."Id"::text, NULL, new_json, audit_get_app_user_id());
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);
        IF old_json IS DISTINCT FROM new_json THEN
            INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
            VALUES ('video_chat_messages','U', NEW."Id"::text, old_json, new_json, audit_get_app_user_id());
        END IF;
        RETURN NEW;
    ELSE
        old_json := to_jsonb(OLD);
        INSERT INTO audit_logs("TableName","Operation","RowPk","OldData","NewData","AppUserId")
        VALUES ('video_chat_messages','D', OLD."Id"::text, old_json, NULL, audit_get_app_user_id());
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_video_chat_messages_audit_iud ON video_chat_messages;
CREATE TRIGGER trg_video_chat_messages_audit_iud
AFTER INSERT OR UPDATE OR DELETE ON video_chat_messages
FOR EACH ROW
EXECUTE FUNCTION audit_video_chat_messages_iud();

-- audit_logs updated_at (opcional; por ahora no se actualiza)
DROP TRIGGER IF EXISTS trg_audit_logs_set_updated_at ON audit_logs;
CREATE TRIGGER trg_audit_logs_set_updated_at
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_generic();

COMMIT;

