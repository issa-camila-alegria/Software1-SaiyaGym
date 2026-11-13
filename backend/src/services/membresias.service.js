import { conTransaccion } from "../config/db.js";
import * as repositorio from "../repositories/membresias.repository.js";
import * as usuarios from "../repositories/usuarios.repository.js";
import { AppError, leerId } from "../utils/AppError.js";

// Capa de lógica de negocio de membresías (Sprint 4: E4-HU1 a E4-HU4).

const { DIAS_PROXIMA_A_VENCER } = repositorio;

/** Tipos de membresía y su duración en meses. */
const MESES_POR_TIPO = { Mensual: 1, Trimestral: 3, Semestral: 6, Anual: 12 };

/** Solo se puede renovar si vence en este número de días o menos (o ya venció). */
const DIAS_PARA_RENOVAR = 30;

const DIAS_MAXIMOS_CONSULTA = 365;
const FILTROS_VENCIMIENTO = ["proximas", "vencidas", "todas"];
const VALOR_MAXIMO = 9999999999.99; // NUMERIC(12,2)

const vacio = (valor) =>
  valor === undefined || valor === null || String(valor).trim() === "";

/** Convierte el valor recibido en número con máximo 2 decimales; null si no es válido. */
function leerValor(crudo) {
  const texto = String(crudo ?? "").trim().replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(texto)) return null;

  return Number(texto);
}

function leerValorMembresia(crudo) {
  const valor = leerValor(crudo);

  if (valor === null || valor <= 0 || valor > VALOR_MAXIMO) {
    throw new AppError(
      400,
      "VALOR_INVALIDO",
      "El valor de la membresía debe ser un número mayor que cero (máximo 2 decimales).",
      ["valor"]
    );
  }

  return valor;
}

function leerTipo(crudo) {
  const tipo = String(crudo ?? "").trim();

  if (!Object.hasOwn(MESES_POR_TIPO, tipo)) {
    throw new AppError(
      400,
      "TIPO_INVALIDO",
      `El tipo de membresía debe ser uno de: ${Object.keys(MESES_POR_TIPO).join(", ")}.`,
      ["tipo"]
    );
  }

  return tipo;
}

/** Fecha AAAA-MM-DD que exista de verdad (rechaza 2026-02-31). */
function leerFecha(crudo) {
  const texto = String(crudo).trim();
  const coincide = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  const fecha = coincide ? new Date(`${texto}T00:00:00Z`) : null;

  if (
    !fecha ||
    Number.isNaN(fecha.getTime()) ||
    fecha.toISOString().slice(0, 10) !== texto ||
    Number(coincide[1]) < 2000 ||
    Number(coincide[1]) > 2100
  ) {
    throw new AppError(
      400,
      "FECHA_INVALIDA",
      "La fecha de inicio debe tener el formato AAAA-MM-DD y ser una fecha real.",
      ["fecha_inicio"]
    );
  }

  return texto;
}

/** El usuario debe existir y ser del gimnasio (rol "usuario"). */
async function exigirUsuario(usuarioId) {
  const usuario = await usuarios.obtenerPorId(usuarioId);

  if (!usuario) {
    throw new AppError(404, "USUARIO_NO_ENCONTRADO", "El usuario no fue encontrado.", [
      "usuario_id",
    ]);
  }

  if (usuario.rol !== "usuario") {
    throw new AppError(
      409,
      "USUARIO_NO_MIEMBRO",
      "Las membresías solo se manejan con usuarios del gimnasio.",
      ["usuario_id"]
    );
  }

  return usuario;
}

/** Usuarios a quienes se les puede registrar una membresía. */
export async function listarUsuarios() {
  return repositorio.listarUsuarios();
}

// ---------------------------------------------------------------------
// E4-HU1: registrar una membresía
// ---------------------------------------------------------------------

export async function registrar(cuerpo, administrador) {
  if (vacio(cuerpo?.usuario_id)) {
    throw new AppError(
      400,
      "USUARIO_NO_SELECCIONADO",
      "Selecciona el usuario al que se le registrará la membresía.",
      ["usuario_id"]
    );
  }

  const usuarioId = leerId(cuerpo.usuario_id, "usuario");

  if (vacio(cuerpo?.tipo)) {
    throw new AppError(400, "TIPO_INVALIDO", "Selecciona el tipo de membresía.", ["tipo"]);
  }

  const tipo = leerTipo(cuerpo.tipo);

  if (vacio(cuerpo?.valor)) {
    throw new AppError(400, "VALOR_INVALIDO", "Ingresa el valor de la membresía.", ["valor"]);
  }

  const valor = leerValorMembresia(cuerpo.valor);
  // Sin fecha de inicio la membresía empieza hoy (lo resuelve la base de datos).
  const fechaInicioPedida = vacio(cuerpo?.fecha_inicio) ? null : leerFecha(cuerpo.fecha_inicio);
  const meses = MESES_POR_TIPO[tipo];

  const usuario = await exigirUsuario(usuarioId);

  if (usuario.estado !== "Activo") {
    throw new AppError(
      409,
      "USUARIO_INACTIVO",
      `${usuario.nombre} está inactivo. Actívalo antes de registrarle una membresía.`,
      ["usuario_id"]
    );
  }

  const yaTiene = () =>
    new AppError(
      409,
      "MEMBRESIA_EXISTENTE",
      `${usuario.nombre} ya tiene una membresía registrada. Para extender su vigencia usa Renovar.`,
      ["usuario_id"]
    );

  try {
    return await conTransaccion(async (cliente) => {
      const { id, fecha_inicio: fechaInicio } = await repositorio.crear(cliente, {
        usuarioId,
        tipo,
        meses,
        fechaInicio: fechaInicioPedida,
        valor,
      });

      await repositorio.crearPeriodo(cliente, {
        membresiaId: id,
        origen: "Registro",
        tipo,
        meses,
        fechaInicio,
        valor,
        registradoPor: administrador.id,
      });

      return repositorio.obtenerPorId(cliente, id);
    });
  } catch (error) {
    // La restricción única de la base evita dos membresías para el mismo usuario.
    if (error.code === "23505") throw yaTiene();
    throw error;
  }
}

// ---------------------------------------------------------------------
// E4-HU2: consultar la membresía
// ---------------------------------------------------------------------

async function armarDetalle(membresia) {
  if (!membresia) return { membresia: null, historial: [], alerta: null };

  const [historial, alerta] = await Promise.all([
    repositorio.listarPeriodos(membresia.id),
    repositorio.obtenerAlertaVigente(membresia.id),
  ]);

  return { membresia, historial, alerta };
}

/** El administrador consulta la membresía de cualquier usuario. */
export async function consultarDeUsuario(usuarioIdCrudo) {
  const usuarioId = leerId(usuarioIdCrudo, "usuario");
  const usuario = await exigirUsuario(usuarioId);
  const detalle = await armarDetalle(await repositorio.obtenerPorUsuario(usuarioId));

  return {
    ...detalle,
    usuario: { id: usuario.id, nombre: usuario.nombre, documento: usuario.documento },
  };
}

/** El usuario consulta SU membresía (el id sale de la sesión). */
export async function consultarMia(usuarioIdCrudo) {
  const usuarioId = leerId(usuarioIdCrudo, "id de usuario");

  return armarDetalle(await repositorio.obtenerPorUsuario(usuarioId));
}

/** Todas las membresías con un resumen por estado. */
export async function listar() {
  const membresias = await repositorio.listar();
  const contar = (estado) => membresias.filter((m) => m.estado === estado).length;

  return {
    membresias,
    resumen: {
      total: membresias.length,
      activas: contar("Activa") + contar("Por iniciar"),
      proximas: contar("Próxima a vencer"),
      vencidas: contar("Vencida"),
    },
    dias_alerta: DIAS_PROXIMA_A_VENCER,
  };
}

// ---------------------------------------------------------------------
// E4-HU3: renovar una membresía
// ---------------------------------------------------------------------

export async function renovar(idCrudo, cuerpo, administrador) {
  const id = leerId(idCrudo, "id de la membresía");

  // El tipo y el valor son opcionales: si no se indican se repiten los del período anterior.
  const tipoNuevo = vacio(cuerpo?.tipo) ? null : leerTipo(cuerpo.tipo);
  const valorNuevo = vacio(cuerpo?.valor) ? null : leerValorMembresia(cuerpo.valor);

  return conTransaccion(async (cliente) => {
    const actual = await repositorio.bloquear(cliente, id);

    if (!actual) {
      throw new AppError(
        404,
        "MEMBRESIA_NO_ENCONTRADA",
        "La membresía no fue encontrada."
      );
    }

    if (actual.dias_restantes > DIAS_PARA_RENOVAR) {
      throw new AppError(
        409,
        "RENOVACION_NO_PERMITIDA",
        `La membresía de ${actual.usuario_nombre} aún tiene ${actual.dias_restantes} días de vigencia. ` +
          `Solo se puede renovar cuando vence en ${DIAS_PARA_RENOVAR} días o menos, o ya está vencida.`
      );
    }

    const tipo = tipoNuevo ?? actual.tipo;
    const valor = valorNuevo ?? actual.valor;
    const meses = MESES_POR_TIPO[tipo];

    await repositorio.renovar(cliente, {
      id,
      tipo,
      meses,
      inicioPeriodo: actual.inicio_nuevo_periodo,
      valor,
    });

    await repositorio.crearPeriodo(cliente, {
      membresiaId: id,
      origen: "Renovación",
      tipo,
      meses,
      fechaInicio: actual.inicio_nuevo_periodo,
      valor,
      registradoPor: administrador.id,
    });

    return repositorio.obtenerPorId(cliente, id);
  });
}

// ---------------------------------------------------------------------
// E4-HU4: vencimientos y alertas
// ---------------------------------------------------------------------

/** Membresías próximas a vencer (por defecto, las que vencen en 5 días o menos). */
export async function consultarVencimientos(diasCrudo, filtroCrudo) {
  let dias = DIAS_PROXIMA_A_VENCER;

  if (!vacio(diasCrudo)) {
    const texto = String(diasCrudo).trim();

    if (!/^\d+$/.test(texto) || Number(texto) > DIAS_MAXIMOS_CONSULTA) {
      throw new AppError(
        400,
        "DIAS_INVALIDOS",
        `Los días deben ser un número entero entre 0 y ${DIAS_MAXIMOS_CONSULTA}.`,
        ["dias"]
      );
    }

    dias = Number(texto);
  }

  const filtro = vacio(filtroCrudo) ? "proximas" : String(filtroCrudo).trim();

  if (!FILTROS_VENCIMIENTO.includes(filtro)) {
    throw new AppError(
      400,
      "FILTRO_INVALIDO",
      "El filtro debe ser proximas, vencidas o todas.",
      ["filtro"]
    );
  }

  const membresias = await repositorio.listarVencimientos(dias, filtro);

  return { membresias, resumen: { cantidad: membresias.length }, dias, filtro };
}

/** El administrador genera una alerta para el usuario con membresía por vencer o vencida. */
export async function generarAlerta(idCrudo, administrador) {
  const id = leerId(idCrudo, "id de la membresía");

  return conTransaccion(async (cliente) => {
    const bloqueada = await repositorio.bloquear(cliente, id);

    if (!bloqueada) {
      throw new AppError(404, "MEMBRESIA_NO_ENCONTRADA", "La membresía no fue encontrada.");
    }

    const membresia = await repositorio.obtenerPorId(cliente, id);

    if (!["Próxima a vencer", "Vencida"].includes(membresia.estado)) {
      throw new AppError(
        409,
        "ALERTA_NO_APLICA",
        `Solo se genera alerta para membresías que vencen en ${DIAS_PROXIMA_A_VENCER} días o menos, o ya vencidas.`
      );
    }

    if (membresia.alerta_generada) {
      throw new AppError(
        409,
        "ALERTA_EXISTENTE",
        `Ya se generó una alerta para el vencimiento del ${membresia.fecha_fin} de ${membresia.usuario_nombre}.`
      );
    }

    const mensaje =
      membresia.estado === "Vencida"
        ? `Tu membresía venció el ${membresia.fecha_fin}. Renuévala en la recepción del gimnasio.`
        : membresia.dias_restantes === 0
          ? `Tu membresía vence hoy (${membresia.fecha_fin}). Renuévala en la recepción del gimnasio.`
          : `Tu membresía vence el ${membresia.fecha_fin} (en ${membresia.dias_restantes} ${
              membresia.dias_restantes === 1 ? "día" : "días"
            }). Renuévala en la recepción del gimnasio.`;

    await repositorio.crearAlerta(cliente, {
      membresiaId: id,
      mensaje,
      generadaPor: administrador.id,
    });

    return repositorio.obtenerPorId(cliente, id);
  });
}
