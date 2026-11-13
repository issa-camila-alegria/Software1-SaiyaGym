import { pool } from "../config/db.js";

// Las funciones que reciben "cliente" se ejecutan dentro de una transacción.

const COLUMNAS_RUTINA = `r.id, r.nombre, r.objetivo, r.estado, r.entrenador_id,
       u.nombre AS entrenador_nombre, r.creado_en, r.actualizado_en`;

export async function crear(cliente, { nombre, objetivo, entrenadorId }) {
  const { rows } = await cliente.query(
    `INSERT INTO rutinas (nombre, objetivo, entrenador_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [nombre, objetivo, entrenadorId]
  );

  return rows[0].id;
}

// El entrenador creador no cambia al modificar la rutina.
export async function actualizar(cliente, id, { nombre, objetivo }) {
  await cliente.query(
    `UPDATE rutinas
        SET nombre = $2, objetivo = $3, actualizado_en = now()
      WHERE id = $1`,
    [id, nombre, objetivo]
  );
}

/** Reemplaza todos los ejercicios de la rutina por la lista recibida. */
export async function reemplazarEjercicios(cliente, rutinaId, ejercicios) {
  await cliente.query("DELETE FROM rutina_ejercicios WHERE rutina_id = $1", [
    rutinaId,
  ]);

  for (const [indice, ejercicio] of ejercicios.entries()) {
    await cliente.query(
      `INSERT INTO rutina_ejercicios (rutina_id, orden, nombre, series, repeticiones)
       VALUES ($1, $2, $3, $4, $5)`,
      [rutinaId, indice + 1, ejercicio.nombre, ejercicio.series, ejercicio.repeticiones]
    );
  }
}

export async function listar() {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_RUTINA},
            (SELECT COUNT(*)::int FROM rutina_ejercicios e
              WHERE e.rutina_id = r.id) AS total_ejercicios,
            (SELECT COUNT(*)::int FROM asignaciones_rutina a
              WHERE a.rutina_id = r.id AND a.vigente) AS usuarios_asignados
       FROM rutinas r
       JOIN personas u ON u.id = r.entrenador_id
      ORDER BY r.id DESC`
  );

  return rows;
}

/** Devuelve la rutina con su lista de ejercicios, o null si no existe. */
export async function obtenerPorId(id) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_RUTINA}
       FROM rutinas r
       JOIN personas u ON u.id = r.entrenador_id
      WHERE r.id = $1`,
    [id]
  );

  if (rows.length === 0) return null;

  const ejercicios = await pool.query(
    `SELECT orden, nombre, series, repeticiones
       FROM rutina_ejercicios
      WHERE rutina_id = $1
      ORDER BY orden ASC`,
    [id]
  );

  return { ...rows[0], ejercicios: ejercicios.rows };
}

/** Busca otra rutina con el mismo nombre (sin importar mayúsculas ni espacios de más). */
export async function buscarPorNombre(nombre, excluirId = null) {
  const { rows } = await pool.query(
    `SELECT id FROM rutinas
      WHERE lower(btrim(nombre)) = lower($1) AND ($2::int IS NULL OR id <> $2::int)`,
    [nombre, excluirId]
  );

  return rows[0] ?? null;
}
