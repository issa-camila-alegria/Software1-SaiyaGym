import { AppError } from "../utils/AppError.js";

export function rutaNoEncontrada(req, res) {
  res.status(404).json({
    ok: false,
    error: {
      codigo: "RUTA_NO_ENCONTRADA",
      mensaje: `La ruta ${req.method} ${req.originalUrl} no existe.`,
    },
  });
}

// Middleware central de errores: todas las respuestas de error tienen
// el mismo formato { ok: false, error: { codigo, mensaje, campos } }.
// eslint-disable-next-line no-unused-vars
export function manejarErrores(error, req, res, next) {
  if (error instanceof AppError) {
    return res.status(error.estado).json({
      ok: false,
      error: {
        codigo: error.codigo,
        mensaje: error.message,
        campos: error.campos,
      },
    });
  }

  // JSON mal formado en el cuerpo de la petición.
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      ok: false,
      error: {
        codigo: "JSON_INVALIDO",
        mensaje: "El cuerpo de la petición no es un JSON válido.",
      },
    });
  }

  // Violación de la restricción UNIQUE del documento (por ejemplo,
  // dos registros simultáneos con el mismo documento).
  if (error.code === "23505" &&
    (error.constraint === "personas_documento_uk" ||
      error.constraint === "usuarios_documento_uk")) {
    return res.status(409).json({
      ok: false,
      error: {
        codigo: "USUARIO_DUPLICADO",
        mensaje: "El usuario ya existe: hay un registro con ese documento.",
        campos: ["documento"],
      },
    });
  }

  // Cualquier otro error: se registra en el servidor y al cliente
  // solo se le da un mensaje genérico (sin detalles internos).
  console.error("Error no controlado:", error);

  return res.status(500).json({
    ok: false,
    error: {
      codigo: "ERROR_INTERNO",
      mensaje: "Ocurrió un error inesperado en el servidor. Intenta de nuevo.",
    },
  });
}
