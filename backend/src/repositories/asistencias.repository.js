import { pool } from "../config/db.js";

// Capa de acceso a datos de asistencia (Sprint 5: E5-HU1 a E5-HU4).
// "Hoy" es el día del gimnasio: la conexión usa ZONA_HORARIA (ver config/db.js).

const FECHA = "to_char(a.fecha, 'YYYY-MM-DD')";
const HORA = "to_char(a.registrada_en, 'HH24:MI')";

/**
 * Registra la asistencia de hoy. Si ya existía (un registro por usuario y
 * por día) no inserta nada y devuelve null; la restricción UNIQUE hace que
 * dos clics simultáneos no dupliquen la asistencia.
 */
export async function registrarHoy(usuarioId) {
  const { rows } = await pool.query(
    `INSERT INTO asistencias AS a (usuario_id, fecha)
     VALUES ($1, CURRENT_DATE)
     ON CONFLICT (usuario_id, fecha) DO NOTHING
     RETURNING a.id, ${FECHA} AS fecha, ${HORA} AS hora`,
    [usuarioId]
  );

  return rows[0] ?? null;
}

/** La asistencia de hoy, si existe. */
export async function deHoy(usuarioId) {
  const { rows } = await pool.query(
    `SELECT a.id, ${FECHA} AS fecha, ${HORA} AS hora
       FROM asistencias a
      WHERE a.usuario_id = $1 AND a.fecha = CURRENT_DATE`,
    [usuarioId]
  );

  return rows[0] ?? null;
}

/** Historial: las más recientes primero (orden por fecha). */
export async function listar(usuarioId, limite) {
  const { rows } = await pool.query(
    `SELECT a.id, ${FECHA} AS fecha, ${HORA} AS hora
       FROM asistencias a
      WHERE a.usuario_id = $1
      ORDER BY a.fecha DESC
      LIMIT $2`,
    [usuarioId, limite]
  );

  return rows;
}

export async function contar(usuarioId) {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS total FROM asistencias WHERE usuario_id = $1",
    [usuarioId]
  );

  return rows[0].total;
}

/**
 * Agrupa las asistencias en "rachas" (tramos de días seguidos).
 * Truco: fecha - número de fila es constante dentro de un tramo.
 * Devuelve los tramos del más reciente al más antiguo.
 */
export async function tramos(usuarioId) {
  const { rows } = await pool.query(
    `WITH dias AS (
       SELECT fecha,
              fecha - (ROW_NUMBER() OVER (ORDER BY fecha))::int AS grupo
         FROM asistencias
        WHERE usuario_id = $1
     )
     SELECT to_char(MIN(fecha), 'YYYY-MM-DD') AS inicio,
            to_char(MAX(fecha), 'YYYY-MM-DD') AS fin,
            COUNT(*)::int                      AS dias,
            (CURRENT_DATE - MAX(fecha))::int   AS dias_desde_fin
       FROM dias
      GROUP BY grupo
      ORDER BY MAX(fecha) DESC`,
    [usuarioId]
  );

  return rows;
}

/** El día de hoy según la zona horaria del gimnasio ("YYYY-MM-DD"). */
export async function fechaHoy() {
  const { rows } = await pool.query("SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS hoy");
  return rows[0].hoy;
}
