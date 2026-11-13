import { conTransaccion, pool } from "../config/db.js";

// Capa de acceso a datos: aquí solo hay SQL (siempre con consultas
// parametrizadas: los valores van en $1, $2... nunca pegados al texto).
// IMPORTANTE: COLUMNAS no incluye contrasena_hash, así que el hash
// nunca sale en las respuestas de la API.
//
// Modelo de herencia: los datos comunes viven en "personas" y cada persona
// tiene además una fila en la tabla de su rol (administradores, entrenadores
// o usuarios). Aquí se mantienen las dos al crear o cambiar de rol.

// Tabla del subtipo según el rol (valores fijos: nunca vienen del usuario).
const TABLA_ROL = {
  administrador: "administradores",
  entrenador: "entrenadores",
  usuario: "usuarios",
};

const COLUMNAS =
  "id, nombre, documento, telefono, correo, rol, estado, creado_en, actualizado_en";

// Escapa los comodines de LIKE para que "%" o "_" se busquen como texto normal.
const escaparLike = (texto) => texto.replace(/[\\%_]/g, "\\$&");

export async function crear({ nombre, documento, telefono, correo, rol, contrasenaHash }) {
  return conTransaccion(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO personas (nombre, documento, telefono, correo, rol, contrasena_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLUMNAS}`,
      [nombre, documento, telefono, correo, rol, contrasenaHash]
    );

    await cliente.query(`INSERT INTO ${TABLA_ROL[rol]} (persona_id) VALUES ($1)`, [
      rows[0].id,
    ]);

    return rows[0];
  });
}

export async function listar({ buscar, rol, estado } = {}) {
  const condiciones = [];
  const valores = [];

  if (buscar) {
    valores.push(`%${escaparLike(buscar)}%`);
    condiciones.push(
      `(nombre ILIKE $${valores.length} OR documento ILIKE $${valores.length})`
    );
  }

  if (rol) {
    valores.push(rol);
    condiciones.push(`rol = $${valores.length}`);
  }

  if (estado) {
    valores.push(estado);
    condiciones.push(`estado = $${valores.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT ${COLUMNAS} FROM personas ${where} ORDER BY id ASC`,
    valores
  );

  return rows;
}

export async function resumen() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE estado = 'Activo')::int AS activos,
            COUNT(*) FILTER (WHERE estado = 'Inactivo')::int AS inactivos
       FROM personas`
  );

  return rows[0];
}

export async function obtenerPorId(id) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS} FROM personas WHERE id = $1`,
    [id]
  );

  return rows[0] ?? null;
}

/** Busca un usuario con ese documento (se puede excluir un id al editar). */
export async function buscarPorDocumento(documento, excluirId = null) {
  const { rows } = await pool.query(
    `SELECT id FROM personas
      WHERE documento = $1 AND ($2::int IS NULL OR id <> $2::int)`,
    [documento, excluirId]
  );

  return rows[0] ?? null;
}

/**
 * Actualiza los datos del usuario. Si contrasenaHash es null,
 * la contraseña actual se conserva.
 */
export async function actualizar(
  id,
  { nombre, documento, telefono, correo, rol, contrasenaHash = null }
) {
  return conTransaccion(async (cliente) => {
    const actual = await cliente.query(
      "SELECT rol FROM personas WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (actual.rows.length === 0) return null;

    const rolAnterior = actual.rows[0].rol;

    // Cambio de rol: se retira la fila del subtipo anterior (la base la
    // rechaza si ya tiene rutinas, asignaciones o pagos) y se crea la nueva.
    if (rolAnterior !== rol) {
      await cliente.query(`DELETE FROM ${TABLA_ROL[rolAnterior]} WHERE persona_id = $1`, [id]);
    }

    const { rows } = await cliente.query(
      `UPDATE personas
          SET nombre = $2, documento = $3, telefono = $4, correo = $5,
              rol = $6, contrasena_hash = COALESCE($7, contrasena_hash),
              actualizado_en = now()
        WHERE id = $1
        RETURNING ${COLUMNAS}`,
      [id, nombre, documento, telefono, correo, rol, contrasenaHash]
    );

    if (rolAnterior !== rol) {
      await cliente.query(`INSERT INTO ${TABLA_ROL[rol]} (persona_id) VALUES ($1)`, [id]);
    }

    return rows[0];
  });
}

export async function cambiarEstado(id, estado) {
  const { rows } = await pool.query(
    `UPDATE personas SET estado = $2, actualizado_en = now()
      WHERE id = $1
      RETURNING ${COLUMNAS}`,
    [id, estado]
  );

  return rows[0] ?? null;
}

/** Datos necesarios para iniciar sesión (incluye el hash). Uso interno. */
export async function obtenerCredenciales(documento) {
  const { rows } = await pool.query(
    `SELECT id, nombre, rol, estado, contrasena_hash
       FROM personas WHERE documento = $1`,
    [documento]
  );

  return rows[0] ?? null;
}

/** Datos mínimos del usuario autenticado, leídos en cada petición. */
export async function obtenerParaSesion(id) {
  const { rows } = await pool.query(
    "SELECT id, nombre, documento, rol, estado FROM personas WHERE id = $1",
    [id]
  );

  return rows[0] ?? null;
}
