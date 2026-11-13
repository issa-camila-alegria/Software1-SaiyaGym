-- =====================================================================
-- SAIYAGYM - Datos MASIVOS de demostración (más de 50 registros por módulo)
-- Se ejecuta con:  npm run db:seed:masivo   (dentro de la carpeta backend)
-- (incluye antes los datos de seed.sql y seed_pruebas.sql)
--
-- Qué crea (todo generado con reglas fijas, sin azar: siempre da lo mismo;
-- las fechas son relativas a HOY, así los estados siempre dan variedad):
--   * 2 administradores, 4 entrenadores y 60 usuarios (1 de cada 10 inactivo).
--   * 52 rutinas (13 programas x 4 niveles) con 4 a 6 ejercicios cada una.
--   * Una rutina vigente por usuario activo y, para muchos, una anterior.
--   * Membresías para 55 usuarios en todos los estados (Activa, Próxima a
--     vencer, Vencida, Por iniciar), con historial de renovaciones y alertas.
--   * Cobros y pagos: inscripción y 3 mensualidades por usuario, unos pagados
--     y otros pendientes.
--   * Asistencias de los últimos 75 días con rachas Activas, En riesgo,
--     Interrumpidas y usuarios Sin racha.
--
-- Documentos 3000xxxx; contraseña Saiya2026 (la asigna el script).
-- Se puede ejecutar varias veces: si ya existen, no hace nada.
-- =====================================================================

DO $masivo$
DECLARE
    hoy     DATE := CURRENT_DATE;
    admin   INTEGER;
    nombres TEXT[] := ARRAY['Andrea','Bruno','Camilo','Diana','Eduardo','Fernanda','Gabriel','Helena','Iván','Julia',
                            'Kevin','Laura','Mateo','Nicolás','Olga','Paula','Ricardo','Sara','Tomás','Úrsula',
                            'Víctor','Ximena','Yolanda','Zoe','Alejandro','Brenda','Cristian','Dayana','Emilio','Flor'];
    apellidos TEXT[] := ARRAY['Acosta','Barrios','Castaño','Duarte','Escobar','Forero','Gómez','Herrera','Isaza','Jiménez',
                              'Londoño','Medina','Naranjo','Ocampo','Palacio','Quintero','Restrepo','Salazar','Triana','Uribe',
                              'Valencia','Zapata','Arango','Bedoya','Cardona','Delgado','Espinosa','Franco','Guerrero','Henao'];
    programas TEXT[] := ARRAY['Fuerza tren superior','Pierna y glúteo','Cardio intensivo','Full body','Core y abdomen',
                              'Movilidad y flexibilidad','Hipertrofia pecho','Hipertrofia espalda','HIIT quema grasa',
                              'Resistencia muscular','Funcional','Brazos y hombros','Entrenamiento en circuito'];
    objetivos TEXT[] := ARRAY['Ganar fuerza en el tren superior','Fortalecer piernas y glúteos','Mejorar la capacidad cardiovascular',
                              'Trabajar todo el cuerpo en una sesión','Fortalecer la zona media','Ganar rango de movimiento',
                              'Aumentar masa muscular del pecho','Aumentar masa muscular de la espalda','Quemar grasa con intervalos',
                              'Aguantar más repeticiones con buena técnica','Mejorar el movimiento en el día a día',
                              'Definir brazos y hombros','Combinar fuerza y cardio por estaciones'];
    ejercicios TEXT[] := ARRAY['Press de banca','Remo con barra','Sentadilla libre','Peso muerto','Zancadas','Plancha abdominal',
                               'Burpees','Saltos de cuerda','Press militar','Curl de bíceps','Fondos en banco','Jalón al pecho',
                               'Hip thrust','Mountain climbers','Elevación lateral','Remo con mancuerna','Prensa de piernas',
                               'Flexiones de brazos','Abdominales en V','Estocadas laterales'];
    niveles TEXT[] := ARRAY['nivel 1','nivel 2','nivel 3','nivel 4'];
    i INTEGER; j INTEGER; k INTEGER;
    nombre_ TEXT; doc_ TEXT; uid INTEGER; rid INTEGER; mid INTEGER; oid INTEGER;
    tipo_ TEXT; meses_ INTEGER; valor_ NUMERIC; vence_ INTEGER; per_ INTEGER;
    ini_ DATE; fin_ DATE; n_ex INTEGER;
    ofertas INTEGER[] := ARRAY[-45,-12,-2,0,1,3,5,9,15,22,28,40,75,120,200,300];
BEGIN
    IF EXISTS (SELECT 1 FROM personas WHERE documento = '30000001') THEN
        RAISE NOTICE 'Los datos masivos ya estaban cargados: no se hizo nada.';
        RETURN;
    END IF;

    SELECT id INTO admin FROM personas WHERE documento = '10000001';
    IF admin IS NULL THEN
        RAISE EXCEPTION 'Falta el administrador 10000001. Ejecuta primero: npm run db:seed';
    END IF;

    -- ------------------------------------------------------- PERSONAS
    -- 2 administradores (30000201-202), 4 entrenadores (30000101-104), 60 usuarios (30000001-060).
    FOR i IN 1 .. 66 LOOP
        nombre_ := nombres[1 + (i % 30)] || ' ' || apellidos[1 + ((i * 7 + (i / 30) * 11 + 3) % 30)];
        doc_ := CASE WHEN i <= 60 THEN '3000' || lpad(i::text, 4, '0')
                     WHEN i <= 64 THEN '3000' || lpad((100 + i - 60)::text, 4, '0')
                     ELSE '3000' || lpad((200 + i - 64)::text, 4, '0') END;
        INSERT INTO personas (nombre, documento, telefono, correo, rol, estado, creado_en)
        VALUES (nombre_, doc_, '320' || lpad((4000000 + i)::text, 7, '0'),
                lower(translate(split_part(nombre_, ' ', 1) || '.' || split_part(nombre_, ' ', 2) || i, 'ÁÉÍÓÚáéíóúñÑ', 'AEIOUaeiounN')) || '@saiyagym.test',
                CASE WHEN i <= 60 THEN 'usuario' WHEN i <= 64 THEN 'entrenador' ELSE 'administrador' END,
                CASE WHEN i <= 60 AND i % 10 = 0 THEN 'Inactivo' ELSE 'Activo' END,
                now() - ((70 - i) || ' days')::interval);
    END LOOP;

    INSERT INTO administradores (persona_id) SELECT id FROM personas WHERE rol = 'administrador' ON CONFLICT DO NOTHING;
    INSERT INTO entrenadores    (persona_id) SELECT id FROM personas WHERE rol = 'entrenador'    ON CONFLICT DO NOTHING;
    INSERT INTO usuarios        (persona_id) SELECT id FROM personas WHERE rol = 'usuario'       ON CONFLICT DO NOTHING;

    -- --------------------------------------------------------- RUTINAS
    FOR i IN 1 .. 52 LOOP
        j := (i - 1) % 13;           -- programa
        k := (i - 1) / 13;           -- nivel
        INSERT INTO rutinas (nombre, objetivo, entrenador_id, estado)
        VALUES (programas[j + 1] || ' - ' || niveles[k + 1], objetivos[j + 1],
                (SELECT id FROM personas WHERE documento = '3000' || lpad((100 + 1 + (i % 4))::text, 4, '0')),
                CASE WHEN i % 11 = 0 THEN 'Inactiva' ELSE 'Activa' END)
        RETURNING id INTO rid;

        n_ex := 4 + (i % 3);           -- 4 a 6 ejercicios
        FOR k IN 1 .. n_ex LOOP
            INSERT INTO rutina_ejercicios (rutina_id, orden, nombre, series, repeticiones)
            VALUES (rid, k, ejercicios[1 + ((j * 3 + k * 5 + i) % 20)],
                    3 + ((i + k) % 3), 8 + 2 * ((i * k) % 6));
        END LOOP;
    END LOOP;

    -- ---------------------------------------------------- ASIGNACIONES
    -- Una vigente por usuario activo y, a los pares, una anterior ya reemplazada.
    FOR i IN 1 .. 60 LOOP
        SELECT p.id INTO uid FROM personas p WHERE p.documento = '3000' || lpad(i::text, 4, '0');
        IF i % 2 = 0 THEN
            INSERT INTO asignaciones_rutina (usuario_id, rutina_id, fecha_asignacion, vigente)
            SELECT uid, r.id, hoy - (60 + i), FALSE FROM rutinas r
             WHERE r.nombre LIKE '% - nivel 1' ORDER BY r.id OFFSET (i % 13) LIMIT 1;
        END IF;
        INSERT INTO asignaciones_rutina (usuario_id, rutina_id, fecha_asignacion, vigente)
        SELECT uid, r.id, hoy - (3 + (i * 5) % 50), TRUE FROM rutinas r
         WHERE r.estado = 'Activa' ORDER BY r.id OFFSET (i * 3) % 46 LIMIT 1;
    END LOOP;

    -- --------------------------------------------------- MEMBRESÍAS
    -- Usuarios 1-55 (los 5 últimos quedan sin membresía).
    FOR i IN 1 .. 55 LOOP
        SELECT p.id INTO uid FROM personas p WHERE p.documento = '3000' || lpad(i::text, 4, '0');
        meses_ := (ARRAY[1,1,1,3,1,6,1,12])[1 + (i % 8)];
        tipo_  := CASE meses_ WHEN 1 THEN 'Mensual' WHEN 3 THEN 'Trimestral' WHEN 6 THEN 'Semestral' ELSE 'Anual' END;
        valor_ := CASE meses_ WHEN 1 THEN 80000 WHEN 3 THEN 210000 WHEN 6 THEN 420000 ELSE 780000 END;
        vence_ := ofertas[1 + (i % 16)];
        per_   := 1 + (i % 3);

        -- Que la vigencia no sea más larga que el tipo (un mensual no vence en 300 días).
        IF vence_ > meses_ * 28 THEN vence_ := meses_ * 28 - 1; END IF;

        -- Quien viene entrenando seguido (racha Activa o En riesgo) tiene la membresía vigente.
        IF i % 6 IN (1, 2) AND vence_ < 8 THEN vence_ := 8 + (i % 18); END IF;
        IF vence_ > meses_ * 28 THEN vence_ := meses_ * 28 - 1; END IF;

        IF i % 17 = 0 THEN           -- Por iniciar: empieza en unos días
            ini_ := hoy + 2 + (i % 5);
            fin_ := (ini_ + (meses_ || ' months')::interval - interval '1 day')::date;
            per_ := 1;
        ELSE
            fin_ := hoy + vence_;
            ini_ := (fin_ + 1 - (meses_ || ' months')::interval)::date;
        END IF;

        INSERT INTO membresias (usuario_id, tipo, fecha_inicio, fecha_fin, valor)
        VALUES (uid, tipo_, ini_, fin_, valor_) RETURNING id INTO mid;

        FOR k IN 0 .. per_ - 1 LOOP
            INSERT INTO membresia_periodos (membresia_id, origen, tipo, fecha_inicio, fecha_fin, valor, registrado_por, creado_en)
            VALUES (mid, CASE WHEN k = per_ - 1 THEN 'Registro' ELSE 'Renovación' END, tipo_,
                    (ini_ - (k * meses_ || ' months')::interval)::date,
                    (ini_ - (k * meses_ || ' months')::interval + (meses_ || ' months')::interval - interval '1 day')::date,
                    valor_, admin, (ini_ - (k * meses_ || ' months')::interval)::timestamptz);
        END LOOP;

        -- Alerta ya generada a una de cada dos membresías por vencer o vencidas.
        IF fin_ <= hoy + 5 AND i % 2 = 1 THEN
            INSERT INTO alertas_membresia (membresia_id, vence_el, mensaje, generada_por)
            VALUES (mid, fin_, 'Tu membresía vence pronto. Renuévala para seguir entrenando.', admin);
        END IF;
    END LOOP;

    -- --------------------------------------------------- COBROS Y PAGOS
    -- Por usuario: inscripción (hace 3 meses) y mensualidades de hace 2, 1 y 0 meses.
    FOR i IN 1 .. 60 LOOP
        SELECT p.id INTO uid FROM personas p WHERE p.documento = '3000' || lpad(i::text, 4, '0');
        FOR k IN 0 .. 3 LOOP
            INSERT INTO obligaciones (usuario_id, concepto, periodo, valor, estado)
            VALUES (uid, CASE WHEN k = 0 THEN 'Inscripción' ELSE 'Mensualidad' END,
                    to_char(date_trunc('month', hoy) - ((3 - k) || ' months')::interval, 'YYYY-MM'),
                    CASE WHEN k = 0 THEN 50000 ELSE 80000 + 5000 * (i % 3) END,
                    -- lo más antiguo casi siempre está pagado; lo del mes actual, mezclado
                    CASE WHEN (k <= 1 AND i % 7 <> 0) OR (k = 2 AND i % 3 <> 0) OR (k = 3 AND i % 2 = 0)
                         THEN 'Pagada' ELSE 'Pendiente' END)
            RETURNING id INTO oid;
        END LOOP;
    END LOOP;

    INSERT INTO pagos (obligacion_id, usuario_id, valor, fecha_pago, registrado_por)
    SELECT o.id, o.usuario_id, o.valor,
           LEAST(hoy, (to_date(o.periodo || '-01', 'YYYY-MM-DD') + ((o.id * 7) % 25))::date), admin
      FROM obligaciones o
      JOIN personas p ON p.id = o.usuario_id AND p.documento LIKE '3000%'
     WHERE o.estado = 'Pagada';

    RAISE NOTICE 'Datos masivos cargados.';
END
$masivo$;

-- ---------------------------------------------------------------------
-- Asistencias masivas. Reglas por usuario (i = 1 a 60):
--   i % 6 = 1 -> racha ACTIVA: viene todos los días hasta hoy (largo 3 a 30)
--   i % 6 = 2 -> EN RIESGO: llegó hasta ayer y hoy aún no
--   i % 6 = 3 -> INTERRUMPIDA: dejó de venir hace 3 a 12 días
--   i % 6 = 4 -> constante con huecos: viene ~5 de cada 7 días (no hoy)
--   i % 6 = 5 -> SIN RACHA: apenas 2 o 3 visitas sueltas hace semanas
--   i % 6 = 0 -> nunca ha venido
-- Solo para usuarios con membresía vigente al día de hoy, o con una racha vieja.
-- ---------------------------------------------------------------------
DO $asist$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM personas WHERE documento = '30000001') THEN
        RETURN;
    END IF;

    INSERT INTO asistencias (usuario_id, fecha, registrada_en)
    SELECT p.id, d::date, LEAST(d::date + make_interval(hours => 6 + (u.i * 3) % 14, mins => (u.i * 11) % 60), now())
      FROM generate_series(1, 60) AS u(i)
      JOIN personas p ON p.documento = '3000' || lpad(u.i::text, 4, '0')
     CROSS JOIN LATERAL generate_series(CURRENT_DATE - 75, CURRENT_DATE, interval '1 day') AS d
     WHERE
       CASE u.i % 6
         WHEN 1 THEN d::date >  CURRENT_DATE - (3 + (u.i * 2) % 28)          -- hasta hoy
                  OR (d::date BETWEEN CURRENT_DATE - 70 AND CURRENT_DATE - 40 AND (d::date - CURRENT_DATE + u.i) % 3 <> 0)
         WHEN 2 THEN (d::date BETWEEN CURRENT_DATE - (2 + (u.i * 3) % 14) AND CURRENT_DATE - 1)
                  OR (d::date BETWEEN CURRENT_DATE - 60 AND CURRENT_DATE - 30 AND (d::date - CURRENT_DATE + u.i) % 2 = 0)
         WHEN 3 THEN d::date BETWEEN CURRENT_DATE - (12 + (u.i * 2) % 20) AND CURRENT_DATE - (3 + u.i % 10)
         WHEN 4 THEN d::date < CURRENT_DATE AND d::date >= CURRENT_DATE - 45 AND (d::date - CURRENT_DATE + u.i) % 7 NOT IN (0, 1)
         WHEN 5 THEN d::date IN (CURRENT_DATE - 20 - u.i % 9, CURRENT_DATE - 33 - u.i % 7, CURRENT_DATE - 48)
         ELSE FALSE
       END
    ON CONFLICT (usuario_id, fecha) DO NOTHING;

    RAISE NOTICE 'Asistencias masivas listas.';
END
$asist$;
