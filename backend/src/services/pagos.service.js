import { conTransaccion } from "../config/db.js";
import * as repositorio from "../repositories/pagos.repository.js";
import * as usuarios from "../repositories/usuarios.repository.js";
import {
  CONCEPTO_POR_DEFECTO,
  PATRON_PERIODO as patronPeriodo,
  VALOR_MAXIMO,
} from "../config/reglas.js";
import { AppError, leerId } from "../utils/AppError.js";

// Capa de lógica de negocio de pagos (Sprint 3: E3-HU1 y E3-HU2).

const vacio = (valor) =>
  valor === undefined || valor === null || String(valor).trim() === "";

/** Período actual en formato AAAA-MM. */
function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

/** Convierte el valor recibido en número con máximo 2 decimales; null si no es válido. */
function leerValor(crudo) {
  const texto = String(crudo ?? "").trim().replace(",", ".");

  if (!/^-?\d+(\.\d{1,2})?$/.test(texto)) return null;

  return Number(texto);
}

/** Usuarios del gimnasio a quienes se les puede registrar un pago. */
export async function listarUsuariosPagables() {
  const lista = await usuarios.listar({ rol: "usuario" });

  return lista.map(({ id, nombre, documento, estado }) => ({
    id,
    nombre,
    documento,
    estado,
  }));
}

/** Valida y limpia los datos de un pago o cobro (usuario, concepto, período y valor). */
function leerDatosCobro(cuerpo, { esCobro = false } = {}) {
  if (vacio(cuerpo?.usuario_id)) {
    throw new AppError(
      400,
      "USUARIO_NO_SELECCIONADO",
      esCobro
        ? "Selecciona el usuario al que se le generará el cobro."
        : "Selecciona el usuario que realizó el pago.",
      ["usuario_id"]
    );
  }

  const usuarioId = leerId(cuerpo.usuario_id, "usuario");
  const concepto =
    String(cuerpo?.concepto ?? "").trim().replace(/\s+/g, " ") ||
    CONCEPTO_POR_DEFECTO;
  const periodo = String(cuerpo?.periodo ?? "").trim() || periodoActual();

  if (concepto.length > 80) {
    throw new AppError(
      400,
      "CONCEPTO_INVALIDO",
      "El concepto debe tener máximo 80 caracteres.",
      ["concepto"]
    );
  }

  if (!patronPeriodo.test(periodo)) {
    throw new AppError(
      400,
      "PERIODO_INVALIDO",
      "El período debe tener el formato AAAA-MM (por ejemplo 2026-10).",
      ["periodo"]
    );
  }

  if (vacio(cuerpo?.valor)) {
    throw new AppError(
      400,
      "VALOR_INVALIDO",
      esCobro ? "Ingresa el valor del cobro." : "Ingresa el valor del pago.",
      ["valor"]
    );
  }

  const valor = leerValor(cuerpo.valor);

  if (valor === null || valor <= 0 || valor > VALOR_MAXIMO) {
    throw new AppError(
      400,
      "VALOR_INVALIDO",
      `El valor del ${esCobro ? "cobro" : "pago"} debe ser un número mayor que cero (máximo 2 decimales).`,
      ["valor"]
    );
  }

  return { usuarioId, concepto, periodo, valor };
}

/** El usuario debe existir y ser del gimnasio (rol "usuario"). */
async function exigirUsuarioQuePaga(usuarioId) {
  const usuario = await usuarios.obtenerPorId(usuarioId);

  if (!usuario) {
    throw new AppError(404, "USUARIO_NO_ENCONTRADO", "El usuario no fue encontrado.", [
      "usuario_id",
    ]);
  }

  if (usuario.rol !== "usuario") {
    throw new AppError(
      409,
      "USUARIO_NO_PAGA",
      "Los pagos y cobros solo se manejan con usuarios del gimnasio.",
      ["usuario_id"]
    );
  }

  return usuario;
}

// E3-HU1: el administrador registra el pago de un usuario.
export async function registrar(cuerpo, administrador) {
  const { usuarioId, concepto, periodo, valor } = leerDatosCobro(cuerpo);
  const usuario = await exigirUsuarioQuePaga(usuarioId);

  const yaPagada = () =>
    new AppError(
      409,
      "PAGO_DUPLICADO",
      `La obligación "${concepto}" del período ${periodo} ya fue registrada como pagada para ${usuario.nombre}.`,
      ["concepto", "periodo"]
    );

  try {
    const pago = await conTransaccion(async (cliente) => {
      const obligacion = await repositorio.obtenerObligacionBloqueada(
        cliente,
        usuarioId,
        concepto,
        periodo
      );

      let obligacionId;

      if (!obligacion) {
        // No había una obligación previa: se crea ya saldada con este pago.
        ({ id: obligacionId } = await repositorio.crearObligacion(cliente, {
          usuarioId,
          concepto,
          periodo,
          valor,
          estado: "Pagada",
        }));
      } else if (obligacion.estado === "Pagada") {
        throw yaPagada();
      } else {
        obligacionId = obligacion.id;
        await repositorio.marcarObligacionPagada(cliente, obligacionId);
      }

      const { id } = await repositorio.crearPago(cliente, {
        obligacionId,
        usuarioId,
        valor,
        registradoPor: administrador.id,
      });

      return repositorio.obtenerPago(cliente, id);
    });

    return pago;
  } catch (error) {
    // Dos registros simultáneos: la restricción única de la base los detiene.
    if (error.code === "23505") throw yaPagada();
    throw error;
  }
}

/** Últimos pagos registrados (vista del administrador). */
export async function listarRecientes() {
  return repositorio.listarRecientes();
}

// E3-HU2: el usuario consulta SU historial (el id sale de la sesión).
export async function consultarHistorial(usuarioIdCrudo, periodoCrudo) {
  const usuarioId = leerId(usuarioIdCrudo, "id de usuario");
  const periodo = String(periodoCrudo ?? "").trim();

  if (periodo && !patronPeriodo.test(periodo)) {
    throw new AppError(
      400,
      "PERIODO_INVALIDO",
      "El período debe tener el formato AAAA-MM (por ejemplo 2026-10).",
      ["periodo"]
    );
  }

  const pagos = await repositorio.listarPorUsuario(usuarioId, periodo || null);
  const total = pagos.reduce((suma, pago) => suma + pago.valor, 0);

  return {
    pagos,
    resumen: { cantidad: pagos.length, total: Math.round(total * 100) / 100 },
    periodo: periodo || null,
  };
}

// ---------------------------------------------------------------------
// E3-HU3: cobros pendientes
// ---------------------------------------------------------------------

/** Suma y cuenta una lista de cobros pendientes. */
function resumirPendientes(pendientes) {
  const total = pendientes.reduce((suma, cobro) => suma + cobro.valor, 0);
  return { cantidad: pendientes.length, total: Math.round(total * 100) / 100 };
}

/** El administrador genera un cobro pendiente para un usuario (ej. la mensualidad del mes). */
export async function generarCobro(cuerpo) {
  const { usuarioId, concepto, periodo, valor } = leerDatosCobro(cuerpo, { esCobro: true });
  const usuario = await exigirUsuarioQuePaga(usuarioId);

  try {
    return await conTransaccion(async (cliente) => {
      const existente = await repositorio.obtenerObligacionBloqueada(
        cliente,
        usuarioId,
        concepto,
        periodo
      );

      if (existente) {
        throw new AppError(
          409,
          "COBRO_DUPLICADO",
          existente.estado === "Pagada"
            ? `La obligación "${concepto}" del período ${periodo} ya fue pagada por ${usuario.nombre}.`
            : `${usuario.nombre} ya tiene un cobro pendiente de "${concepto}" para el período ${periodo}.`,
          ["concepto", "periodo"]
        );
      }

      const { id } = await repositorio.crearObligacion(cliente, {
        usuarioId,
        concepto,
        periodo,
        valor,
        estado: "Pendiente",
      });

      return repositorio.obtenerCobro(cliente, id);
    });
  } catch (error) {
    // Dos solicitudes simultáneas: la restricción única de la base detiene la segunda.
    if (error.code === "23505") {
      throw new AppError(
        409,
        "COBRO_DUPLICADO",
        `${usuario.nombre} ya tiene una obligación de "${concepto}" para el período ${periodo}.`,
        ["concepto", "periodo"]
      );
    }
    throw error;
  }
}

/**
 * El administrador consulta los cobros pendientes: de un usuario (si se
 * indica usuario_id) o de todos. Si el usuario no existe responde 404.
 */
export async function consultarPendientes(usuarioIdCrudo) {
  let usuario = null;

  if (!vacio(usuarioIdCrudo)) {
    const usuarioId = leerId(usuarioIdCrudo, "usuario");
    usuario = await exigirUsuarioQuePaga(usuarioId);
  }

  const pendientes = await repositorio.listarPendientes(usuario?.id ?? null);

  return {
    pendientes,
    resumen: resumirPendientes(pendientes),
    usuario: usuario ? { id: usuario.id, nombre: usuario.nombre } : null,
  };
}

/** El usuario consulta SUS cobros pendientes (el id sale de la sesión). */
export async function consultarMisPendientes(usuarioIdCrudo) {
  const usuarioId = leerId(usuarioIdCrudo, "id de usuario");
  const pendientes = await repositorio.listarPendientes(usuarioId);

  return { pendientes, resumen: resumirPendientes(pendientes) };
}

// ---------------------------------------------------------------------
// E3-HU4: actualizar el estado de un pago
// ---------------------------------------------------------------------

/**
 * Cambia el estado de un cobro:
 *  - "Pagada": registra el pago por el valor del cobro (queda a nombre del administrador).
 *  - "Pendiente": revierte el pago (se elimina el registro del pago y el cobro vuelve a estar pendiente).
 */
export async function actualizarEstado(idCrudo, cuerpo, administrador) {
  const id = leerId(idCrudo, "id del cobro");
  const estado = String(cuerpo?.estado ?? "").trim();

  if (!["Pagada", "Pendiente"].includes(estado)) {
    throw new AppError(
      400,
      "ESTADO_INVALIDO",
      "El estado debe ser Pagada o Pendiente.",
      ["estado"]
    );
  }

  return conTransaccion(async (cliente) => {
    const cobro = await repositorio.obtenerCobroBloqueado(cliente, id);

    if (!cobro) {
      throw new AppError(404, "PAGO_NO_ENCONTRADO", "El pago no fue encontrado.");
    }

    if (cobro.estado === estado) {
      throw new AppError(
        409,
        "ESTADO_SIN_CAMBIOS",
        estado === "Pagada"
          ? `El cobro de "${cobro.concepto}" del período ${cobro.periodo} ya está pagado.`
          : `El cobro de "${cobro.concepto}" del período ${cobro.periodo} ya está pendiente.`
      );
    }

    if (estado === "Pagada") {
      await repositorio.crearPago(cliente, {
        obligacionId: cobro.id,
        usuarioId: cobro.usuario_id,
        valor: cobro.valor,
        registradoPor: administrador.id,
      });
      await repositorio.marcarObligacionPagada(cliente, cobro.id);
    } else {
      await repositorio.eliminarPagoDeObligacion(cliente, cobro.id);
      await repositorio.marcarObligacionPendiente(cliente, cobro.id);
    }

    return repositorio.obtenerCobro(cliente, cobro.id);
  });
}
