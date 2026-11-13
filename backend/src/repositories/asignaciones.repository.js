import { pool } from "../config/db.js";

/**
 * Asigna una rutina a un usuario (dentro de una transacción):
 * la asignación vigente anterior, si existe, queda como histórico.
 */
export async function asignar(cliente, usuarioId, rutinaId) {
  await cliente.query(
    `UPDATE asignaciones_rutina SET vigente = FALSE
      WHERE usuario_id = $1 AND vigente`,
    [usuarioId]
  );

  const { rows } = await cliente.query(
    `INSERT INTO asignaciones_rutina (usuario_id, rutina_id)
     VALUES ($1, $2)
     RETURNING id, usuario_id, rutina_id, vigente,
               to_char(fecha_asignacion, 'YYYY-MM-DD') AS fecha_asignacion`,
    [usuarioId, rutinaId]
  );

  return rows[0];
}

/** Bloquea la fila del usuario: dos asignaciones a la vez se atienden una tras otra. */
export async function bloquearUsuario(cliente, usuarioId) {
  await cliente.query("SELECT id FROM personas WHERE id = $1 FOR UPDATE", [usuarioId]);
}

/** Asignación vigente dentro de una transacción. */
export async function vigenteEnTransaccion(cliente, usuarioId) {
  const { rows } = await cliente.query(
    "SELECT id, rutina_id FROM asignaciones_rutina WHERE usuario_id = $1 AND vigente",
    [usuarioId]
  );

  return rows[0] ?? null;
}

/** Asignación vigente de un usuario (o null si no tiene). */
export async function obtenerVigentePorUsuario(usuarioId) {
  const { rows } = await pool.query(
    `SELECT id, usuario_id, rutina_id,
            to_char(fecha_asignacion, 'YYYY-MM-DD') AS fecha_asignacion
       FROM asignaciones_rutina
      WHERE usuario_id = $1 AND vigente`,
    [usuarioId]
  );

  return rows[0] ?? null;
}
