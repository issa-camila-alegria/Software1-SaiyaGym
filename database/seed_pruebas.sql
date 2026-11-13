-- =====================================================================
-- SAIYAGYM - Datos de PRUEBA para probar todas las funciones (Sprints 1 a 4)
-- Se ejecuta con:  npm run db:seed:pruebas   (dentro de la carpeta backend)
--
-- Qué crea (todas las fechas son relativas a HOY, así los estados de las
-- membresías siempre dan variedad aunque lo ejecutes otro día):
--   * 3 entrenadores (1 inactivo) y 14 usuarios (2 inactivos), además de los
--     de seed.sql (administrador 10000001, entrenador 10000002, usuarios
--     10000003 y 10000004).
--   * 6 rutinas con ejercicios (1 inactiva) y sus asignaciones, con historial.
--   * Cobros pendientes y pagos realizados de varios meses.
--   * Membresías en todos los estados: Activa, Próxima a vencer (vence hoy,
--     en 1, 4 y 5 días), Vencida, Por iniciar, y usuarios sin membresía.
--     Algunas con renovaciones en el historial y con alerta ya generada.
--
-- Todas las personas nuevas usan la contraseña Saiya2026 (la asigna el script).
-- Se puede ejecutar varias veces: si los datos ya existen, no hace nada.
-- =====================================================================

DO $prueba$
DECLARE
    hoy   DATE := CURRENT_DATE;
    admin INTEGER;
    r     RECORD;
    mid   INTEGER;
    fin_  DATE;
    ini_  DATE;
    k     INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM personas WHERE documento = '20000010') THEN
        RAISE NOTICE 'Los datos de prueba ya estaban cargados: no se hizo nada.';
        RETURN;
    END IF;

    -- Los datos base (administrador, entrenador, Camila y Andrés) los pone seed.sql.
    SELECT id INTO admin FROM personas WHERE documento = '10000001';
    IF admin IS NULL THEN
        RAISE EXCEPTION 'Falta el administrador 10000001. Ejecuta primero: npm run db:seed';
    END IF;

    -- ---------------------------------------------------------------
    -- PERSONAS
    -- ---------------------------------------------------------------
    INSERT INTO personas (nombre, documento, telefono, correo, rol, estado) VALUES
        ('Laura Beltrán',      '20000001', '3101000001', 'laura.beltran@saiyagym.test',   'administrador', 'Activo'),
        ('Carlos Mendoza',     '20000002', '3101000002', 'carlos.mendoza@saiyagym.test',  'entrenador',    'Activo'),
        ('Valentina Ríos',     '20000003', '3101000003', 'valentina.rios@saiyagym.test',  'entrenador',    'Inactivo'),
        ('Pablo Ruiz',         '20000010', '3112000010', 'pablo.ruiz@saiyagym.test',      'usuario',       'Activo'),
        ('Mario Vega',         '20000011', '3112000011', 'mario.vega@saiyagym.test',      'usuario',       'Activo'),
        ('Lucía Mora',         '20000012', '3112000012', 'lucia.mora@saiyagym.test',      'usuario',       'Activo'),
        ('Rosa Peña',          '20000013', '3112000013', 'rosa.pena@saiyagym.test',       'usuario',       'Activo'),
        ('Juan Torres',        '20000014', '3112000014', 'juan.torres@saiyagym.test',     'usuario',       'Activo'),
        ('Daniela Rojas',      '20000015', '3112000015', 'daniela.rojas@saiyagym.test',   'usuario',       'Activo'),
        ('Santiago Cruz',      '20000016', '3112000016', 'santiago.cruz@saiyagym.test',   'usuario',       'Activo'),
        ('Valeria Núñez',      '20000017', '3112000017', 'valeria.nunez@saiyagym.test',   'usuario',       'Activo'),
        ('Felipe Cano',        '20000018', '3112000018', 'felipe.cano@saiyagym.test',     'usuario',       'Activo'),
        ('Natalia Ortiz',      '20000019', '3112000019', 'natalia.ortiz@saiyagym.test',   'usuario',       'Activo'),
        ('Esteban Lara',       '20000020', '3112000020', 'esteban.lara@saiyagym.test',    'usuario',       'Inactivo'),
        ('Marcela Díaz',       '20000021', '3112000021', 'marcela.diaz@saiyagym.test',    'usuario',       'Activo');

    INSERT INTO administradores (persona_id) SELECT id FROM personas WHERE rol = 'administrador' ON CONFLICT DO NOTHING;
    INSERT INTO entrenadores    (persona_id) SELECT id FROM personas WHERE rol = 'entrenador'    ON CONFLICT DO NOTHING;
    INSERT INTO usuarios        (persona_id) SELECT id FROM personas WHERE rol = 'usuario'       ON CONFLICT DO NOTHING;

    -- ---------------------------------------------------------------
    -- RUTINAS Y EJERCICIOS
    -- ---------------------------------------------------------------
    CREATE TEMP TABLE _rutinas (n INT, nombre TEXT, objetivo TEXT, doc TEXT, estado TEXT) ON COMMIT DROP;
    INSERT INTO _rutinas VALUES
        (1, 'Fuerza tren superior',        'Ganar fuerza en pecho, espalda y hombros',          '10000002', 'Activa'),
        (2, 'Pierna y glúteo',             'Fortalecer tren inferior y mejorar la postura',     '20000002', 'Activa'),
        (3, 'Cardio y quema de grasa',     'Bajar porcentaje de grasa con trabajo intenso',     '20000002', 'Activa'),
        (4, 'Full body principiantes',     'Aprender los movimientos básicos de todo el cuerpo','10000002', 'Activa'),
        (5, 'Movilidad y estiramiento',    'Recuperación y flexibilidad entre entrenamientos',  '20000002', 'Inactiva'),
        (6, 'Hipertrofia pecho y espalda', 'Aumentar masa muscular en el torso',                '20000003', 'Activa');

    CREATE TEMP TABLE _map (n INT, id INT) ON COMMIT DROP;
    FOR r IN SELECT * FROM _rutinas ORDER BY n LOOP
        INSERT INTO rutinas (nombre, objetivo, entrenador_id, estado)
        VALUES (r.nombre, r.objetivo, (SELECT id FROM personas WHERE documento = r.doc), r.estado)
        RETURNING id INTO mid;
        INSERT INTO _map VALUES (r.n, mid);
    END LOOP;

    INSERT INTO rutina_ejercicios (rutina_id, orden, nombre, series, repeticiones)
    SELECT (SELECT id FROM _map WHERE n = e.n), e.orden, e.nombre, e.series, e.reps
      FROM (VALUES
        (1,1,'Press de banca',4,10),(1,2,'Remo con barra',4,10),(1,3,'Press militar',3,12),(1,4,'Dominadas asistidas',3,8),(1,5,'Curl de bíceps',3,12),
        (2,1,'Sentadilla libre',4,12),(2,2,'Peso muerto rumano',4,10),(2,3,'Zancadas caminando',3,12),(2,4,'Puente de glúteo',4,15),(2,5,'Elevación de talones',3,20),
        (3,1,'Burpees',4,12),(3,2,'Saltos de cuerda',5,50),(3,3,'Mountain climbers',4,30),(3,4,'Sentadilla con salto',3,15),
        (4,1,'Sentadilla goblet',3,12),(4,2,'Flexiones de brazos',3,10),(4,3,'Remo con mancuerna',3,12),(4,4,'Plancha abdominal',3,30),
        (5,1,'Gato-camello',2,10),(5,2,'Rotación de cadera',2,12),(5,3,'Estiramiento de isquiotibiales',2,15),
        (6,1,'Press inclinado con mancuernas',4,10),(6,2,'Aperturas en polea',3,12),(6,3,'Jalón al pecho',4,10),(6,4,'Remo en polea baja',3,12)
      ) AS e(n, orden, nombre, series, reps);

    -- Asignaciones: (usuario, rutina, hace cuántos días, vigente)
    INSERT INTO asignaciones_rutina (usuario_id, rutina_id, fecha_asignacion, vigente)
    SELECT p.id, m.id, hoy - a.dias, a.vigente
      FROM (VALUES
        ('10000003', 4, 90, FALSE), ('10000003', 1, 30, TRUE),
        ('20000010', 2, 20, TRUE),
        ('20000011', 3, 15, TRUE),
        ('20000012', 1, 45, TRUE),
        ('20000013', 4, 10, TRUE),
        ('20000014', 4, 60, FALSE), ('20000014', 6, 12, TRUE),
        ('20000015', 2, 25, TRUE),
        ('20000016', 3, 8,  TRUE),
        ('20000018', 4, 5,  TRUE),
        ('20000019', 6, 18, TRUE),
        ('20000020', 4, 70, TRUE)
      ) AS a(doc, n, dias, vigente)
      JOIN personas p ON p.documento = a.doc
      JOIN _map m ON m.n = a.n;

    -- ---------------------------------------------------------------
    -- MEMBRESÍAS (el estado se calcula con la fecha de hoy)
    -- doc, tipo, meses, vence en (días desde hoy), valor, cuántos períodos tendrá el historial
    -- ---------------------------------------------------------------
    FOR r IN
        SELECT * FROM (VALUES
            ('10000003', 'Mensual',     1,   12, 80000,   3),  -- Activa, con 2 renovaciones
            ('20000010', 'Mensual',     1,    4, 80000,   1),  -- Próxima a vencer (con alerta)
            ('20000011', 'Trimestral',  3,   60, 210000,  1),  -- Activa (aún no se puede renovar: faltan más de 30 días)
            ('20000012', 'Anual',      12,  250, 780000,  1),  -- Activa
            ('20000013', 'Mensual',     1,    1, 80000,   1),  -- Próxima a vencer (mañana)
            ('20000014', 'Mensual',     1,   -3, 80000,   1),  -- Vencida (con alerta)
            ('20000015', 'Semestral',   6,  -40, 420000,  1),  -- Vencida hace más de un mes
            ('20000016', 'Mensual',     1,    5, 80000,   1),  -- Próxima a vencer (límite de 5 días)
            ('20000018', 'Mensual',     1,    0, 80000,   1),  -- Vence hoy
            ('20000019', 'Mensual',     1,   28, 80000,   2),  -- Activa, con 1 renovación
            ('20000020', 'Mensual',     1,  -20, 80000,   1)   -- Vencida (usuario inactivo)
        ) AS v(doc, tipo, meses, vence_en, valor, periodos)
    LOOP
        fin_ := hoy + r.vence_en;
        ini_ := (fin_ + 1 - (r.meses || ' months')::interval)::date;

        INSERT INTO membresias (usuario_id, tipo, fecha_inicio, fecha_fin, valor)
        VALUES ((SELECT id FROM personas WHERE documento = r.doc), r.tipo, ini_, fin_, r.valor)
        RETURNING id INTO mid;

        -- Historial: el período actual y, hacia atrás, los anteriores (cada uno termina el día antes de que empiece el siguiente).
        FOR k IN 0 .. r.periodos - 1 LOOP
            INSERT INTO membresia_periodos (membresia_id, origen, tipo, fecha_inicio, fecha_fin, valor, registrado_por, creado_en)
            VALUES (
                mid,
                CASE WHEN k = r.periodos - 1 THEN 'Registro' ELSE 'Renovación' END,
                r.tipo,
                (ini_ - (k * r.meses || ' months')::interval)::date,
                (ini_ - (k * r.meses || ' months')::interval + (r.meses || ' months')::interval - interval '1 day')::date,
                r.valor, admin,
                (ini_ - (k * r.meses || ' months')::interval)::timestamptz
            );
        END LOOP;
    END LOOP;

    -- Por iniciar: empieza dentro de 7 días.
    INSERT INTO membresias (usuario_id, tipo, fecha_inicio, fecha_fin, valor)
    VALUES ((SELECT id FROM personas WHERE documento = '20000017'), 'Trimestral',
            hoy + 7, (hoy + 7 + interval '3 months' - interval '1 day')::date, 210000)
    RETURNING id INTO mid;
    INSERT INTO membresia_periodos (membresia_id, origen, tipo, fecha_inicio, fecha_fin, valor, registrado_por)
    SELECT id, 'Registro', tipo, fecha_inicio, fecha_fin, valor, admin FROM membresias WHERE id = mid;

    -- Alertas ya generadas (Pablo, por vencer, y Juan, vencida).
    INSERT INTO alertas_membresia (membresia_id, vence_el, mensaje, generada_por)
    SELECT m.id, m.fecha_fin, 'Tu membresía vence pronto. Renuévala para seguir entrenando.', admin
      FROM membresias m JOIN personas p ON p.id = m.usuario_id
     WHERE p.documento IN ('20000010', '20000014');

    -- ---------------------------------------------------------------
    -- COBROS Y PAGOS
    -- doc, concepto, meses atrás (período), valor, ¿pagada?, hace cuántos días se pagó
    -- ---------------------------------------------------------------
    CREATE TEMP TABLE _cobros (doc TEXT, concepto TEXT, atras INT, valor NUMERIC, pagada BOOLEAN, dias_pago INT) ON COMMIT DROP;
    INSERT INTO _cobros VALUES
        ('10000003', 'Inscripción',  3, 50000, TRUE,  92),
        ('10000003', 'Mensualidad',  2, 80000, TRUE,  58),
        ('10000003', 'Mensualidad',  1, 80000, TRUE,  27),
        ('10000003', 'Mensualidad',  0, 80000, FALSE, NULL),
        ('20000010', 'Mensualidad',  1, 80000, TRUE,  26),
        ('20000010', 'Mensualidad',  0, 80000, FALSE, NULL),
        ('20000011', 'Mensualidad',  0, 80000, TRUE,  14),
        ('20000012', 'Mensualidad',  0, 80000, TRUE,  3),
        ('20000013', 'Mensualidad',  1, 80000, FALSE, NULL),
        ('20000013', 'Mensualidad',  0, 80000, FALSE, NULL),
        ('20000014', 'Mensualidad',  2, 80000, TRUE,  55),
        ('20000014', 'Mensualidad',  1, 90000, FALSE, NULL),
        ('20000014', 'Mensualidad',  0, 90000, FALSE, NULL),
        ('20000015', 'Inscripción',  0, 50000, FALSE, NULL),
        ('20000015', 'Mensualidad',  1, 80000, FALSE, NULL),
        ('20000016', 'Mensualidad',  0, 80000, TRUE,  6),
        ('20000017', 'Inscripción',  0, 50000, FALSE, NULL),
        ('20000018', 'Mensualidad',  1, 80000, TRUE,  29),
        ('20000018', 'Mensualidad',  0, 80000, TRUE,  1),
        ('20000019', 'Mensualidad',  0, 80000, FALSE, NULL),
        ('20000020', 'Mensualidad',  1, 80000, FALSE, NULL);

    INSERT INTO obligaciones (usuario_id, concepto, periodo, valor, estado)
    SELECT p.id, c.concepto, to_char(date_trunc('month', hoy) - (c.atras || ' months')::interval, 'YYYY-MM'),
           c.valor, CASE WHEN c.pagada THEN 'Pagada' ELSE 'Pendiente' END
      FROM _cobros c JOIN personas p ON p.documento = c.doc;

    INSERT INTO pagos (obligacion_id, usuario_id, valor, fecha_pago, registrado_por)
    SELECT o.id, o.usuario_id, o.valor, hoy - c.dias_pago, admin
      FROM _cobros c
      JOIN personas p ON p.documento = c.doc
      JOIN obligaciones o ON o.usuario_id = p.id AND o.concepto = c.concepto
       AND o.periodo = to_char(date_trunc('month', hoy) - (c.atras || ' months')::interval, 'YYYY-MM')
     WHERE c.pagada;

    RAISE NOTICE 'Datos de prueba cargados.';
END
$prueba$;
