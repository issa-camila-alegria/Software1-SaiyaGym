import { conTransaccion } from "../config/db.js";
import * as repositorio from "../repositories/rutinas.repository.js";
import { RUTINA } from "../config/reglas.js";
import { AppError, leerId } from "../utils/AppError.js";

// Capa de lógica de negocio de rutinas (Sprint 2: E2-HU1 y E2-HU3).
// Solo los entrenadores llegan aquí (lo controla el middleware).

const comoTexto = (valor) =>
  typeof valor === "string" || typeof valor === "number"
    ? String(valor).trim()
    : "";

const entero = (valor) => {
  const texto = comoTexto(valor);
  return /^\d+$/.test(texto) ? Number(texto) : null;
};

/** Valida los datos de la rutina y de sus ejercicios. */
function validarRutina(cuerpo) {
  const nombre = comoTexto(cuerpo?.nombre).replace(/\s+/g, " ");
  const objetivo = comoTexto(cuerpo?.objetivo).replace(/\s+/g, " ");

  const faltantes = [];
  if (!nombre) faltantes.push(["nombre", "Nombre de la rutina"]);
  if (!objetivo) faltantes.push(["objetivo", "Objetivo"]);

  if (faltantes.length > 0) {
    throw new AppError(
      400,
      "DATOS_INCOMPLETOS",
      `Faltan datos obligatorios de la rutina: ${faltantes
        .map(([, etiqueta]) => etiqueta)
        .join(", ")}.`,
      faltantes.map(([campo]) => campo)
    );
  }

  if (nombre.length > RUTINA.nombreMax || objetivo.length > RUTINA.objetivoMax) {
    throw new AppError(
      400,
      "DATOS_INVALIDOS",
      `El nombre admite máximo ${RUTINA.nombreMax} caracteres y el objetivo máximo ${RUTINA.objetivoMax}.`,
      ["nombre", "objetivo"]
    );
  }

  const lista = Array.isArray(cuerpo?.ejercicios) ? cuerpo.ejercicios : [];

  if (lista.length === 0) {
    throw new AppError(
      400,
      "SIN_EJERCICIOS",
      "La rutina debe tener al menos un ejercicio.",
      ["ejercicios"]
    );
  }

  if (lista.length > 50) {
    throw new AppError(
      400,
      "DATOS_INVALIDOS",
      "Una rutina admite máximo 50 ejercicios.",
      ["ejercicios"]
    );
  }

  const ejercicios = lista.map((item, indice) => {
    const ejercicio = {
      nombre: comoTexto(item?.nombre).replace(/\s+/g, " "),
      series: entero(item?.series),
      repeticiones: entero(item?.repeticiones),
    };

    const posicion = indice + 1;

    // Un número con decimales (10.5) no es ejecutable: se avisa con claridad.
    const crudo = (valor) => comoTexto(valor);
    if (
      (crudo(item?.series) && ejercicio.series === null) ||
      (crudo(item?.repeticiones) && ejercicio.repeticiones === null)
    ) {
      throw new AppError(
        400,
        "DATOS_INVALIDOS",
        `En el ejercicio ${posicion}, las series y las repeticiones deben ser números enteros.`,
        ["ejercicios"]
      );
    }

    if (
      !ejercicio.nombre ||
      ejercicio.series === null ||
      ejercicio.repeticiones === null
    ) {
      throw new AppError(
        400,
        "DATOS_INCOMPLETOS",
        `Completa el nombre, las series y las repeticiones del ejercicio ${posicion}.`,
        ["ejercicios"]
      );
    }

    if (
      ejercicio.nombre.length > RUTINA.ejercicio.nombreMax ||
      ejercicio.series < RUTINA.ejercicio.series.min ||
      ejercicio.series > RUTINA.ejercicio.series.max ||
      ejercicio.repeticiones < RUTINA.ejercicio.repeticiones.min ||
      ejercicio.repeticiones > RUTINA.ejercicio.repeticiones.max
    ) {
      throw new AppError(
        400,
        "DATOS_INVALIDOS",
        `El ejercicio ${posicion} no es válido: series entre ${RUTINA.ejercicio.series.min} y ${RUTINA.ejercicio.series.max}, repeticiones entre ${RUTINA.ejercicio.repeticiones.min} y ${RUTINA.ejercicio.repeticiones.max} y nombre de máximo ${RUTINA.ejercicio.nombreMax} caracteres.`,
        ["ejercicios"]
      );
    }

    return ejercicio;
  });

  return { nombre, objetivo, ejercicios };
}

async function exigirNombreLibre(nombre, excluirId = null) {
  if (await repositorio.buscarPorNombre(nombre, excluirId)) {
    throw new AppError(
      409,
      "RUTINA_DUPLICADA",
      "Ya existe una rutina con ese nombre. Usa otro para distinguirla (por ejemplo, agrega el nivel).",
      ["nombre"]
    );
  }
}

// E2-HU1: la rutina queda a nombre del entrenador que la crea.
export async function crear(cuerpo, entrenador) {
  const datos = validarRutina(cuerpo);
  await exigirNombreLibre(datos.nombre);

  const id = await conTransaccion(async (cliente) => {
    const rutinaId = await repositorio.crear(cliente, {
      ...datos,
      entrenadorId: entrenador.id,
    });
    await repositorio.reemplazarEjercicios(cliente, rutinaId, datos.ejercicios);
    return rutinaId;
  });

  return repositorio.obtenerPorId(id);
}

export async function listar() {
  return repositorio.listar();
}

export async function obtener(idCrudo) {
  const id = leerId(idCrudo, "id de rutina");
  const rutina = await repositorio.obtenerPorId(id);

  if (!rutina) {
    throw new AppError(404, "RUTINA_NO_ENCONTRADA", "La rutina no fue encontrada.");
  }

  return rutina;
}

// E2-HU3: cada rutina la modifica solo el entrenador que la creó.
export async function actualizar(idCrudo, cuerpo, actor) {
  const id = leerId(idCrudo, "id de rutina");
  const existente = await repositorio.obtenerPorId(id);

  if (!existente) {
    throw new AppError(404, "RUTINA_NO_ENCONTRADA", "La rutina no fue encontrada.");
  }

  if (existente.entrenador_id !== actor.id) {
    throw new AppError(
      403,
      "SIN_PERMISO",
      "No tienes permiso para realizar esta acción."
    );
  }

  const datos = validarRutina(cuerpo);
  await exigirNombreLibre(datos.nombre, id);

  await conTransaccion(async (cliente) => {
    await repositorio.actualizar(cliente, id, datos);
    await repositorio.reemplazarEjercicios(cliente, id, datos.ejercicios);
  });

  return repositorio.obtenerPorId(id);
}
