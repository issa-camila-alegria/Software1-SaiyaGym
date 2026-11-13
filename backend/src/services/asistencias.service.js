import * as repositorio from "../repositories/asistencias.repository.js";
import * as membresias from "../repositories/membresias.repository.js";
import {
  ESTADOS_MEMBRESIA_VIGENTE,
  LIMITE_HISTORIAL_ASISTENCIA,
} from "../config/reglas.js";
import { AppError } from "../utils/AppError.js";
import { formatearFecha } from "../utils/fechas.js";

// Capa de lógica de negocio de asistencia y rachas (Sprint 5: E5-HU1 a E5-HU4).
//
// REGLAS (ver README):
//  - Solo registra asistencia un usuario con membresía vigente (Activa o
//    Próxima a vencer). Vencida, por iniciar o inexistente se rechaza.
//  - Una asistencia por día (día del gimnasio, zona horaria de Colombia).
//  - La racha cuenta días CALENDARIO seguidos. Si pasa un día completo sin
//    asistir, la racha se reinicia (la siguiente asistencia vuelve a 1).
//  - La racha de ayer sigue "viva" hasta que termine hoy: ese es el estado
//    "En riesgo" (todavía puedes mantenerla asistiendo hoy).

const LIMITE_HISTORIAL = LIMITE_HISTORIAL_ASISTENCIA;
const ESTADOS_VIGENTES = ESTADOS_MEMBRESIA_VIGENTE;

const dias = (n) => `${n} ${n === 1 ? "día" : "días"}`;

/** Convierte los tramos de días seguidos en el resumen de la racha. */
export function armarRacha(tramos) {
  const mejor = tramos.reduce((maximo, tramo) => Math.max(maximo, tramo.dias), 0);
  const ultimo = tramos[0] ?? null;

  if (!ultimo) {
    return {
      estado: "Sin racha",
      actual: 0,
      mejor: 0,
      ultima_asistencia: null,
      asistio_hoy: false,
      mensaje: "Aún no tienes asistencias registradas. Registra la de hoy para iniciar tu racha.",
    };
  }

  const base = { mejor, ultima_asistencia: ultimo.fin };

  if (ultimo.dias_desde_fin === 0) {
    return {
      ...base,
      estado: "Activa",
      actual: ultimo.dias,
      asistio_hoy: true,
      mensaje:
        ultimo.dias === 1
          ? "Iniciaste tu racha hoy. Vuelve mañana para sumar el día 2."
          : `Llevas ${dias(ultimo.dias)} seguidos. Vuelve mañana para sumar uno más.`,
    };
  }

  if (ultimo.dias_desde_fin === 1) {
    return {
      ...base,
      estado: "En riesgo",
      actual: ultimo.dias,
      asistio_hoy: false,
      mensaje: `Tu racha es de ${dias(ultimo.dias)}. Registra tu asistencia hoy para mantenerla.`,
    };
  }

  return {
    ...base,
    estado: "Interrumpida",
    actual: 0,
    racha_anterior: ultimo.dias,
    asistio_hoy: false,
    mensaje: `Tu racha se interrumpió: tu última asistencia fue el ${formatearFecha(ultimo.fin)}. Tu mejor racha fue de ${dias(mejor)}. Registra tu asistencia para empezar una nueva.`,
  };
}

/** ¿Puede este usuario registrar su asistencia ahora? Si no, por qué. */
function evaluarMembresia(membresia) {
  if (!membresia) {
    return {
      permitido: false,
      codigo: "MEMBRESIA_NO_VIGENTE",
      motivo: "Para registrar tu asistencia necesitas una membresía vigente. Aún no tienes una registrada; acércate a la recepción del gimnasio.",
    };
  }

  if (membresia.estado === "Vencida") {
    return {
      permitido: false,
      codigo: "MEMBRESIA_NO_VIGENTE",
      motivo: `Tu membresía venció el ${formatearFecha(membresia.fecha_fin)}. Para registrar tu asistencia debes contar con una membresía vigente; renuévala en la recepción.`,
    };
  }

  if (membresia.estado === "Por iniciar") {
    return {
      permitido: false,
      codigo: "MEMBRESIA_NO_VIGENTE",
      motivo: `Tu membresía inicia el ${formatearFecha(membresia.fecha_inicio)}. Podrás registrar tu asistencia desde esa fecha.`,
    };
  }

  return { permitido: ESTADOS_VIGENTES.includes(membresia.estado) };
}

// E5-HU2 y E5-HU3 (+HU4): historial, racha y si hoy se puede registrar.
export async function consultarMia(usuarioId) {
  const [lista, total, hoy, tramos, membresia, fechaHoy] = await Promise.all([
    repositorio.listar(usuarioId, LIMITE_HISTORIAL),
    repositorio.contar(usuarioId),
    repositorio.deHoy(usuarioId),
    repositorio.tramos(usuarioId),
    membresias.obtenerPorUsuario(usuarioId),
    repositorio.fechaHoy(),
  ]);

  const evaluacion = evaluarMembresia(membresia);
  const puedeRegistrar = evaluacion.permitido && !hoy;

  return {
    fecha_hoy: fechaHoy,
    asistencias: lista,
    total,
    hoy,
    racha: armarRacha(tramos),
    puede_registrar: puedeRegistrar,
    motivo: hoy
      ? `Ya registraste tu asistencia de hoy a las ${hoy.hora}.`
      : evaluacion.permitido
        ? null
        : evaluacion.motivo,
  };
}

// E5-HU3 / E5-HU4: solo la racha.
export async function consultarRacha(usuarioId) {
  return armarRacha(await repositorio.tramos(usuarioId));
}

// E5-HU1: registrar la asistencia de hoy (y devolver la racha ya actualizada).
export async function registrar(usuarioId) {
  const evaluacion = evaluarMembresia(await membresias.obtenerPorUsuario(usuarioId));

  if (!evaluacion.permitido) {
    throw new AppError(409, evaluacion.codigo, evaluacion.motivo);
  }

  const asistencia = await repositorio.registrarHoy(usuarioId);

  if (!asistencia) {
    const existente = await repositorio.deHoy(usuarioId);

    throw new AppError(
      409,
      "ASISTENCIA_YA_REGISTRADA",
      `Ya registraste tu asistencia de hoy${existente ? ` a las ${existente.hora}` : ""}. Solo se cuenta una por día.`
    );
  }

  return { asistencia, racha: armarRacha(await repositorio.tramos(usuarioId)) };
}
