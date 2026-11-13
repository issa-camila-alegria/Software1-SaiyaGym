import { pool } from "../config/db.js";

// Capa de acceso a datos de membresías (Sprint 4).
// Solo SQL, siempre con consultas parametrizadas.

/** Una membresía vence "pronto" cuando le quedan este número de días o menos. */
export const DIAS_PROXIMA_A_VENCER = 5;

// El estado no se guarda: se calcula con la fecha de hoy.
// DIAS_PROXIMA_A_VENCER es una constante del código (nunca viene del usuario).
const SELECT_MEMBRESIA = `
  SELECT m.id, m.usuario_id, u.nombre AS usuario_nombre, u.documento AS usuario_documento,
         u.estado AS usuario_estado, m.tipo,
         to_char(m.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
         to_char(m.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
         m.valor::float8 AS valor,
         (m.fecha_fin - CURRENT_DATE) AS dias_restantes,
         CASE WHEN m.fecha_fin < CURRENT_DATE THEN 'Vencida'
              WHEN m.fecha_inicio > CURRENT_DATE THEN 'Por iniciar'
              WHEN m.fecha_fin - CURRENT_DATE <= ${DIAS_PROXIMA_A_VENCER} THEN 'Próxima a vencer'
              ELSE 'Activa' END AS estado,
         EXISTS (SELECT 1 FROM alertas_membresia a
                  WHERE a.membresia_id = m.id AND a.vence_el = m.fecha_fin) AS alerta_generada
    FROM membresias m
    JOIN personas u ON u.id = m.usuario_id`;

/** Usuarios del gimnasio con una marca que indica si ya tienen membresía. */
export async function listarUsuarios() {
  const { rows } = await pool.query(
    `SELECT p.id, p.nombre, p.documento, p.estado,
            EXISTS (SELECT 1 FROM membresias m WHERE m.usuario_id = p.id) AS tiene_membresia
       FROM personas p
      WHERE p.rol = 'usuario'
      ORDER BY p.nombre ASC, p.id ASC`
  );

  return rows;
}

/** Crea la membresía; fecha_fin = inicio + meses - 1 día. Sin fecha de inicio empieza hoy. */
export async function crear(cliente, { usuarioId, tipo, meses, fechaInicio, valor }) {
  const { rows } = await cliente.query(
    `INSERT INTO membresias (usuario_id, tipo, fecha_inicio, fecha_fin, valor)
     VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE),
             (COALESCE($3::date, CURRENT_DATE) + make_interval(months => $4))::date - 1, $5)
     RETURNING id, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio`,
    [usuarioId, tipo, fechaInicio, meses, valor]
  );

  return rows[0];
}

/** Guarda un período (registro inicial o renovación) en el historial. */
export async function crearPeriodo(
  cliente,
  { membresiaId, origen, tipo, meses, fechaInicio, valor, registradoPor }
) {
  await cliente.query(
    `INSERT INTO membresia_periodos
            (membresia_id, origen, tipo, fecha_inicio, fecha_fin, valor, registrado_por)
     VALUES ($1, $2, $3, $4::date, ($4::date + make_interval(months => $5))::date - 1, $6, $7)`,
    [membresiaId, origen, tipo, fechaInicio, meses, valor, registradoPor]
  );
}

/**
 * Bloquea la membresía (FOR UPDATE) hasta terminar la transacción para que dos
 * renovaciones simultáneas no se crucen. Devuelve también desde qué fecha
 * empezaría un nuevo período: si aún está vigente continúa al día siguiente
 * del vencimiento; si ya venció, empieza hoy.
 */
export async function bloquear(cliente, id) {
  const { rows } = await cliente.query(
    `SELECT m.id, m.usuario_id, m.tipo, m.valor::float8 AS valor,
            (m.fecha_fin - CURRENT_DATE) AS dias_restantes,
            to_char(GREATEST(m.fecha_fin + 1, CURRENT_DATE), 'YYYY-MM-DD') AS inicio_nuevo_periodo,
            (SELECT nombre FROM personas WHERE id = m.usuario_id) AS usuario_nombre
       FROM membresias m
      WHERE m.id = $1
        FOR UPDATE`,
    [id]
  );

  return rows[0] ?? null;
}

/**
 * Extiende la vigencia. Si todavía estaba vigente se conserva la fecha de
 * inicio original (la afiliación es continua); si había vencido, la vigencia
 * vuelve a empezar en el nuevo período.
 */
export async function renovar(cliente, { id, tipo, meses, inicioPeriodo, valor }) {
  await cliente.query(
    `UPDATE membresias
        SET fecha_inicio   = CASE WHEN fecha_fin >= CURRENT_DATE THEN fecha_inicio ELSE $4::date END,
            fecha_fin      = ($4::date + make_interval(months => $3))::date - 1,
            tipo           = $2,
            valor          = $5,
            actualizado_en = now()
      WHERE id = $1`,
    [id, tipo, meses, inicioPeriodo, valor]
  );
}

export async function obtenerPorId(cliente, id) {
  const { rows } = await cliente.query(`${SELECT_MEMBRESIA} WHERE m.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function obtenerPorUsuario(usuarioId) {
  const { rows } = await pool.query(`${SELECT_MEMBRESIA} WHERE m.usuario_id = $1`, [
    usuarioId,
  ]);

  return rows[0] ?? null;
}

/** Todas las membresías, las que vencen primero arriba. */
export async function listar() {
  const { rows } = await pool.query(
    `${SELECT_MEMBRESIA} ORDER BY m.fecha_fin ASC, m.id ASC`
  );

  return rows;
}

/**
 * Membresías por vencer (E4-HU4).
 *   proximas: vigentes que vencen en "dias" días o menos.
 *   vencidas: ya vencidas.
 *   todas:    vencidas y las que vencen en "dias" días o menos.
 */
export async function listarVencimientos(dias, filtro) {
  const condiciones = {
    proximas: "m.fecha_fin >= CURRENT_DATE AND m.fecha_fin - CURRENT_DATE <= $1::int",
    vencidas: "m.fecha_fin < CURRENT_DATE AND $1::int >= 0",
    todas: "m.fecha_fin - CURRENT_DATE <= $1::int",
  };

  const { rows } = await pool.query(
    `${SELECT_MEMBRESIA}
      WHERE ${condiciones[filtro]}
      ORDER BY m.fecha_fin ASC, m.id ASC`,
    [dias]
  );

  return rows;
}

/** Períodos de una membresía, del más reciente al más antiguo. */
export async function listarPeriodos(membresiaId) {
  const { rows } = await pool.query(
    `SELECT id, origen, tipo, valor::float8 AS valor,
            to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
            to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
            to_char(creado_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS registrado_el
       FROM membresia_periodos
      WHERE membresia_id = $1
      ORDER BY id DESC`,
    [membresiaId]
  );

  return rows;
}

export async function crearAlerta(cliente, { membresiaId, mensaje, generadaPor }) {
  await cliente.query(
    `INSERT INTO alertas_membresia (membresia_id, vence_el, mensaje, generada_por)
     SELECT m.id, m.fecha_fin, $2, $3 FROM membresias m WHERE m.id = $1`,
    [membresiaId, mensaje, generadaPor]
  );
}

/** Alerta vigente de la membresía (la del vencimiento actual), si existe. */
export async function obtenerAlertaVigente(membresiaId) {
  const { rows } = await pool.query(
    `SELECT a.mensaje, to_char(a.creado_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha
       FROM alertas_membresia a
       JOIN membresias m ON m.id = a.membresia_id AND m.fecha_fin = a.vence_el
      WHERE a.membresia_id = $1`,
    [membresiaId]
  );

  return rows[0] ?? null;
}
