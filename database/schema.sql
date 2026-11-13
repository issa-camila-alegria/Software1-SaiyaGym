-- =====================================================================
-- SAIYAGYM - Esquema de base de datos (PostgreSQL)
-- Cubre: Sprint 1 (personas), Sprint 2 (rutinas y su asignación),
-- Sprint 3 (obligaciones de cobro y pagos), Sprint 4 (membresías) y Sprint 5 (asistencia y rachas).
-- Es idempotente: se puede ejecutar varias veces sin borrar datos.
--
-- MODELO DE HERENCIA (tabla por subtipo)
--
--                      personas
--                         ^
--        +----------------+----------------+
--        |                |                |
--  administradores    entrenadores       usuarios
--
--   * personas         : supertipo. Guarda lo que comparten todos
--                        (datos personales, rol, estado y contraseña).
--   * administradores  : subtipo. Gestiona a las personas.
--   * entrenadores     : subtipo. Es el único que crea rutinas.
--   * usuarios         : subtipo. Es quien entrena y recibe rutinas.
--
-- Cada subtipo usa como clave primaria la MISMA clave de personas
-- (persona_id), de modo que una fila de subtipo "es" una persona.
-- Una persona pertenece a UN solo subtipo (ver "rol" más abajo).
-- =====================================================================

-- ---------------------------------------------------------------------
-- MIGRACIÓN (solo aplica a bases creadas antes de la herencia)
-- Antes existía una única tabla "usuarios" con todos los datos. Si se
-- detecta esa forma antigua, se renombra para conservar los datos; más
-- abajo se copian a las tablas nuevas y se elimina. En una base nueva,
-- o ya migrada, este bloque no hace nada.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1
                 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name   = 'usuarios'
                  AND column_name  = 'documento') THEN  -- solo la tabla antigua la tiene
        -- Bases anteriores al login pueden no tener esta columna.
        ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS contrasena_hash VARCHAR(100);
        ALTER TABLE usuarios RENAME CONSTRAINT usuarios_pkey TO usuarios_antiguo_pkey;
        ALTER TABLE usuarios RENAME TO usuarios_antiguo;
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- PERSONAS (supertipo) (E1)
-- El estado permite inactivar sin eliminar el registro (E1-HU4).
-- La contraseña se guarda siempre cifrada (hash bcrypt), nunca en texto
-- plano. Es opcional: una persona sin contraseña no puede ingresar hasta
-- que el administrador se la asigne.
--
-- "rol" es el discriminador de la herencia: indica a qué subtipo
-- pertenece la persona. El UNIQUE (id, rol) existe para que los subtipos
-- puedan apuntar a la pareja (id, rol); así la base de datos garantiza
-- que una persona NO esté en dos subtipos a la vez ni en uno que no
-- corresponde a su rol.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personas (
    id               SERIAL PRIMARY KEY,
    nombre           VARCHAR(120) NOT NULL,
    documento        VARCHAR(20)  NOT NULL,
    telefono         VARCHAR(20)  NOT NULL,
    correo           VARCHAR(120) NOT NULL,
    rol              VARCHAR(15)  NOT NULL,
    estado           VARCHAR(10)  NOT NULL DEFAULT 'Activo',
    contrasena_hash  VARCHAR(100),
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT personas_documento_uk UNIQUE (documento),
    CONSTRAINT personas_id_rol_uk    UNIQUE (id, rol),
    CONSTRAINT personas_nombre_ck    CHECK (length(btrim(nombre)) > 0),
    CONSTRAINT personas_telefono_ck  CHECK (length(btrim(telefono)) > 0),
    CONSTRAINT personas_correo_ck    CHECK (length(btrim(correo)) > 0),
    CONSTRAINT personas_rol_ck       CHECK (rol IN ('administrador', 'entrenador', 'usuario')),
    CONSTRAINT personas_estado_ck    CHECK (estado IN ('Activo', 'Inactivo'))
);

-- ---------------------------------------------------------------------
-- SUBTIPOS de persona
-- Cada uno repite "rol" con un valor fijo (CHECK) y lo incluye en la
-- clave foránea compuesta (persona_id, rol) -> personas (id, rol).
-- Resultado: solo se puede crear la fila de subtipo si la persona
-- existe Y tiene exactamente ese rol.
-- Si más adelante un perfil necesita atributos propios (por ejemplo,
-- especialidad del entrenador), se agregan como columnas de su tabla.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS administradores (
    persona_id  INTEGER     PRIMARY KEY,
    rol         VARCHAR(15) NOT NULL DEFAULT 'administrador',
    CONSTRAINT administradores_rol_ck CHECK (rol = 'administrador'),
    CONSTRAINT administradores_persona_fk
        FOREIGN KEY (persona_id, rol) REFERENCES personas (id, rol)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entrenadores (
    persona_id  INTEGER     PRIMARY KEY,
    rol         VARCHAR(15) NOT NULL DEFAULT 'entrenador',
    CONSTRAINT entrenadores_rol_ck CHECK (rol = 'entrenador'),
    CONSTRAINT entrenadores_persona_fk
        FOREIGN KEY (persona_id, rol) REFERENCES personas (id, rol)
        ON DELETE CASCADE
);

-- "usuarios" ahora es solo el subtipo de quien entrena en el gimnasio.
CREATE TABLE IF NOT EXISTS usuarios (
    persona_id  INTEGER     PRIMARY KEY,
    rol         VARCHAR(15) NOT NULL DEFAULT 'usuario',
    CONSTRAINT usuarios_rol_ck CHECK (rol = 'usuario'),
    CONSTRAINT usuarios_persona_fk
        FOREIGN KEY (persona_id, rol) REFERENCES personas (id, rol)
        ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- RUTINAS (E2-HU1, E2-HU3)
-- Solo un ENTRENADOR puede crear rutinas: la clave foránea apunta a la
-- tabla entrenadores, no a personas, así que la base de datos rechaza
-- cualquier rutina cuyo creador no sea entrenador.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rutinas (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(120) NOT NULL,
    objetivo        VARCHAR(255) NOT NULL,
    entrenador_id   INTEGER      NOT NULL,
    estado          VARCHAR(10)  NOT NULL DEFAULT 'Activa',
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT rutinas_entrenador_fk FOREIGN KEY (entrenador_id) REFERENCES entrenadores (persona_id),
    CONSTRAINT rutinas_nombre_ck   CHECK (length(btrim(nombre)) > 0),
    CONSTRAINT rutinas_objetivo_ck CHECK (length(btrim(objetivo)) > 0),
    CONSTRAINT rutinas_estado_ck   CHECK (estado IN ('Activa', 'Inactiva'))
);

-- Ejercicios que componen una rutina (una rutina debe tener al menos uno;
-- esa regla se valida en el backend).
CREATE TABLE IF NOT EXISTS rutina_ejercicios (
    id            SERIAL PRIMARY KEY,
    rutina_id     INTEGER      NOT NULL REFERENCES rutinas (id) ON DELETE CASCADE,
    orden         SMALLINT     NOT NULL,
    nombre        VARCHAR(120) NOT NULL,
    series        SMALLINT     NOT NULL,
    repeticiones  SMALLINT     NOT NULL,
    CONSTRAINT rutina_ejercicios_orden_uk UNIQUE (rutina_id, orden),
    CONSTRAINT rutina_ejercicios_nombre_ck CHECK (length(btrim(nombre)) > 0),
    CONSTRAINT rutina_ejercicios_series_ck CHECK (series BETWEEN 1 AND 20),
    CONSTRAINT rutina_ejercicios_reps_ck   CHECK (repeticiones BETWEEN 1 AND 200)
);

-- ---------------------------------------------------------------------
-- ASIGNACIONES DE RUTINA (E2-HU2, E2-HU4)
-- Historial de asignaciones; solo una puede estar vigente por usuario.
-- Solo se asigna a un USUARIO (subtipo): no a administradores ni a
-- entrenadores.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asignaciones_rutina (
    id                SERIAL PRIMARY KEY,
    usuario_id        INTEGER NOT NULL,
    rutina_id         INTEGER NOT NULL REFERENCES rutinas (id),
    fecha_asignacion  DATE    NOT NULL DEFAULT CURRENT_DATE,
    vigente           BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT asignaciones_rutina_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios (persona_id)
);

-- ---------------------------------------------------------------------
-- OBLIGACIONES DE PAGO (E3)
-- Lo que un usuario debe pagar en un período (ej. la mensualidad de
-- 2026-10). Solo puede existir una obligación por usuario, concepto y
-- período: eso evita que el mismo pago se registre dos veces (E3-HU1).
-- Mientras está "Pendiente" aparece en los pagos pendientes (E3-HU3);
-- al pagarse pasa a "Pagada" (E3-HU1 y E3-HU4).
-- Solo se cobra a un USUARIO (subtipo), no a administradores ni entrenadores.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS obligaciones (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER       NOT NULL,
    concepto    VARCHAR(80)   NOT NULL,
    periodo     CHAR(7)       NOT NULL,
    valor       NUMERIC(12,2) NOT NULL,
    estado      VARCHAR(10)   NOT NULL DEFAULT 'Pendiente',
    creado_en   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT obligaciones_usuario_fk  FOREIGN KEY (usuario_id) REFERENCES usuarios (persona_id),
    CONSTRAINT obligaciones_uk          UNIQUE (usuario_id, concepto, periodo),
    CONSTRAINT obligaciones_concepto_ck CHECK (length(btrim(concepto)) > 0),
    CONSTRAINT obligaciones_periodo_ck  CHECK (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT obligaciones_valor_ck    CHECK (valor > 0),
    CONSTRAINT obligaciones_estado_ck   CHECK (estado IN ('Pendiente', 'Pagada'))
);

-- ---------------------------------------------------------------------
-- PAGOS (E3-HU1, E3-HU2, E3-HU4)
-- Cada pago salda exactamente una obligación (obligacion_id es único).
-- Guarda la fecha, el valor y quién lo registró: solo un ADMINISTRADOR
-- (la clave foránea apunta a la tabla administradores).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagos (
    id              SERIAL PRIMARY KEY,
    obligacion_id   INTEGER       NOT NULL REFERENCES obligaciones (id),
    usuario_id      INTEGER       NOT NULL,
    valor           NUMERIC(12,2) NOT NULL,
    fecha_pago      DATE          NOT NULL DEFAULT CURRENT_DATE,
    registrado_por  INTEGER       NOT NULL,
    creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT pagos_usuario_fk    FOREIGN KEY (usuario_id)     REFERENCES usuarios (persona_id),
    CONSTRAINT pagos_registrador_fk FOREIGN KEY (registrado_por) REFERENCES administradores (persona_id),
    CONSTRAINT pagos_obligacion_uk UNIQUE (obligacion_id),
    CONSTRAINT pagos_valor_ck      CHECK (valor > 0)
);

-- ---------------------------------------------------------------------
-- MEMBRESÍAS (E4)
-- Cada usuario del gimnasio tiene UNA membresía (membresias.usuario_id es
-- único). La fila guarda la vigencia actual: fecha_inicio y fecha_fin.
-- El estado (Activa, Próxima a vencer, Vencida) NO se guarda: se calcula
-- con la fecha de hoy, así nunca queda desactualizado.
-- Solo se afilia a un USUARIO (subtipo), no a administradores ni entrenadores.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS membresias (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER       NOT NULL,
    tipo            VARCHAR(12)   NOT NULL,
    fecha_inicio    DATE          NOT NULL,
    fecha_fin       DATE          NOT NULL,
    valor           NUMERIC(12,2) NOT NULL,
    creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT membresias_usuario_fk   FOREIGN KEY (usuario_id) REFERENCES usuarios (persona_id),
    CONSTRAINT membresias_usuario_uk   UNIQUE (usuario_id),
    CONSTRAINT membresias_tipo_ck      CHECK (tipo IN ('Mensual', 'Trimestral', 'Semestral', 'Anual')),
    CONSTRAINT membresias_vigencia_ck  CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT membresias_valor_ck     CHECK (valor > 0)
);

-- Historial de períodos: una fila por el registro inicial y por cada
-- renovación (E4-HU1 y E4-HU3). Lo registra siempre un ADMINISTRADOR.
CREATE TABLE IF NOT EXISTS membresia_periodos (
    id              SERIAL PRIMARY KEY,
    membresia_id    INTEGER       NOT NULL REFERENCES membresias (id),
    origen          VARCHAR(12)   NOT NULL,
    tipo            VARCHAR(12)   NOT NULL,
    fecha_inicio    DATE          NOT NULL,
    fecha_fin       DATE          NOT NULL,
    valor           NUMERIC(12,2) NOT NULL,
    registrado_por  INTEGER       NOT NULL,
    creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT membresia_periodos_admin_fk   FOREIGN KEY (registrado_por) REFERENCES administradores (persona_id),
    CONSTRAINT membresia_periodos_origen_ck  CHECK (origen IN ('Registro', 'Renovación')),
    CONSTRAINT membresia_periodos_tipo_ck    CHECK (tipo IN ('Mensual', 'Trimestral', 'Semestral', 'Anual')),
    CONSTRAINT membresia_periodos_vigencia_ck CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT membresia_periodos_valor_ck   CHECK (valor > 0)
);

-- Alertas de vencimiento (E4-HU4): el administrador genera una alerta para
-- una membresía próxima a vencer o vencida y el usuario la ve en su pantalla.
-- Solo puede haber una alerta por vencimiento (vence_el): al renovar cambia
-- la fecha de fin y la alerta anterior deja de aplicar.
CREATE TABLE IF NOT EXISTS alertas_membresia (
    id              SERIAL PRIMARY KEY,
    membresia_id    INTEGER       NOT NULL REFERENCES membresias (id),
    vence_el        DATE          NOT NULL,
    mensaje         VARCHAR(200)  NOT NULL,
    generada_por    INTEGER       NOT NULL,
    creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT alertas_membresia_admin_fk FOREIGN KEY (generada_por) REFERENCES administradores (persona_id),
    CONSTRAINT alertas_membresia_uk       UNIQUE (membresia_id, vence_el)
);

-- ---------------------------------------------------------------------
-- MIGRACIÓN (continuación): pasa los datos de la tabla antigua a las
-- nuevas conservando los mismos id (así rutinas y asignaciones siguen
-- apuntando a las mismas personas), reapunta las claves foráneas y
-- elimina la tabla antigua. Todo el script corre como una sola
-- transacción: si algo falla, no queda nada a medias.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('usuarios_antiguo') IS NOT NULL THEN
        INSERT INTO personas (id, nombre, documento, telefono, correo, rol, estado,
                              contrasena_hash, creado_en, actualizado_en)
        SELECT id, nombre, documento, telefono, correo, rol, estado,
               contrasena_hash, creado_en, actualizado_en
          FROM usuarios_antiguo
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO administradores (persona_id)
        SELECT id FROM usuarios_antiguo WHERE rol = 'administrador'
        ON CONFLICT DO NOTHING;

        INSERT INTO entrenadores (persona_id)
        SELECT id FROM usuarios_antiguo WHERE rol = 'entrenador'
        ON CONFLICT DO NOTHING;

        INSERT INTO usuarios (persona_id)
        SELECT id FROM usuarios_antiguo WHERE rol = 'usuario'
        ON CONFLICT DO NOTHING;

        -- Que el próximo id generado continúe después del mayor existente.
        PERFORM setval(pg_get_serial_sequence('personas', 'id'),
                       COALESCE((SELECT MAX(id) FROM personas), 1),
                       (SELECT MAX(id) IS NOT NULL FROM personas));

        -- Las claves foráneas antiguas apuntaban a la tabla anterior.
        ALTER TABLE rutinas             DROP CONSTRAINT IF EXISTS rutinas_entrenador_id_fkey;
        ALTER TABLE asignaciones_rutina DROP CONSTRAINT IF EXISTS asignaciones_rutina_usuario_id_fkey;

        ALTER TABLE rutinas
            ADD CONSTRAINT rutinas_entrenador_fk
            FOREIGN KEY (entrenador_id) REFERENCES entrenadores (persona_id);
        ALTER TABLE asignaciones_rutina
            ADD CONSTRAINT asignaciones_rutina_usuario_fk
            FOREIGN KEY (usuario_id) REFERENCES usuarios (persona_id);

        -- Bases que ya tenían obligaciones y pagos: sus claves foráneas apuntaban
        -- a la tabla antigua; se reapuntan a los subtipos nuevos.
        ALTER TABLE obligaciones DROP CONSTRAINT IF EXISTS obligaciones_usuario_id_fkey;
        ALTER TABLE pagos        DROP CONSTRAINT IF EXISTS pagos_usuario_id_fkey;
        ALTER TABLE pagos        DROP CONSTRAINT IF EXISTS pagos_registrado_por_fkey;

        ALTER TABLE obligaciones DROP CONSTRAINT IF EXISTS obligaciones_usuario_fk;
        ALTER TABLE pagos        DROP CONSTRAINT IF EXISTS pagos_usuario_fk;
        ALTER TABLE pagos        DROP CONSTRAINT IF EXISTS pagos_registrador_fk;

        ALTER TABLE obligaciones
            ADD CONSTRAINT obligaciones_usuario_fk
            FOREIGN KEY (usuario_id) REFERENCES usuarios (persona_id);
        ALTER TABLE pagos
            ADD CONSTRAINT pagos_usuario_fk
            FOREIGN KEY (usuario_id) REFERENCES usuarios (persona_id);
        ALTER TABLE pagos
            ADD CONSTRAINT pagos_registrador_fk
            FOREIGN KEY (registrado_por) REFERENCES administradores (persona_id);

        DROP TABLE usuarios_antiguo;
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- ÍNDICES
-- ---------------------------------------------------------------------
-- Sprint 5 (E5): asistencia y rachas.
-- Una fila por usuario y por día (asistencias_dia_uk): así no se puede
-- registrar dos veces el mismo día, ni siquiera con dos clics a la vez.
-- La RACHA no se guarda: se calcula con las fechas (días seguidos), así
-- nunca queda desactualizada. "Día" = día del gimnasio (ZONA_HORARIA).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asistencias (
    id             SERIAL PRIMARY KEY,
    usuario_id     INTEGER     NOT NULL,
    fecha          DATE        NOT NULL,
    registrada_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT asistencias_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios (persona_id),
    CONSTRAINT asistencias_dia_uk     UNIQUE (usuario_id, fecha)
);

-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_una_vigente_por_usuario
    ON asignaciones_rutina (usuario_id) WHERE vigente;

CREATE INDEX IF NOT EXISTS rutina_ejercicios_rutina_idx ON rutina_ejercicios (rutina_id);
CREATE INDEX IF NOT EXISTS asignaciones_rutina_rutina_idx ON asignaciones_rutina (rutina_id);
CREATE INDEX IF NOT EXISTS rutinas_entrenador_idx ON rutinas (entrenador_id);
CREATE INDEX IF NOT EXISTS obligaciones_usuario_idx ON obligaciones (usuario_id);
CREATE INDEX IF NOT EXISTS obligaciones_pendientes_idx ON obligaciones (periodo, id) WHERE estado = 'Pendiente';
CREATE INDEX IF NOT EXISTS pagos_usuario_idx ON pagos (usuario_id, fecha_pago DESC);
CREATE INDEX IF NOT EXISTS membresias_vencimiento_idx ON membresias (fecha_fin);
CREATE INDEX IF NOT EXISTS membresia_periodos_membresia_idx ON membresia_periodos (membresia_id, id DESC);
