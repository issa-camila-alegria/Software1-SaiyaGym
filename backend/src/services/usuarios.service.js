import * as repositorio from "../repositories/usuarios.repository.js";
import { AppError, leerId } from "../utils/AppError.js";
import {
  MENSAJE_CONTRASENA,
  cifrarContrasena,
  contrasenaValida,
} from "./auth.service.js";

// Capa de lógica de negocio del módulo de usuarios (Sprint 1).
// Solo el administrador puede llegar aquí (lo controla el middleware).

const ETIQUETAS = {
  nombre: "Nombre completo",
  documento: "Número de documento",
  telefono: "Teléfono",
  correo: "Correo electrónico",
};

export const ROLES = ["administrador", "entrenador", "usuario"];
export const ESTADOS = ["Activo", "Inactivo"];

const patronDocumento = /^[A-Za-z0-9]{4,20}$/;
const patronTelefono = /^\+?[0-9\s-]{7,20}$/;
const patronCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const comoTexto = (valor) =>
  typeof valor === "string" || typeof valor === "number"
    ? String(valor).trim()
    : "";

/**
 * Valida y limpia los datos de un usuario. Lanza AppError si algo falla.
 * Al registrar (contrasenaObligatoria = true) la contraseña es requerida;
 * al actualizar es opcional (si viene, reemplaza la anterior).
 */
function validarUsuario(cuerpo, { contrasenaObligatoria }) {
  const datos = {
    nombre: comoTexto(cuerpo?.nombre).replace(/\s+/g, " "),
    documento: comoTexto(cuerpo?.documento).toUpperCase(),
    telefono: comoTexto(cuerpo?.telefono),
    correo: comoTexto(cuerpo?.correo).toLowerCase(),
    rol: comoTexto(cuerpo?.rol).toLowerCase() || "usuario",
  };

  const contrasena =
    typeof cuerpo?.contrasena === "string" ? cuerpo.contrasena : "";

  const faltantes = Object.keys(ETIQUETAS).filter((campo) => !datos[campo]);
  const etiquetasFaltantes = faltantes.map((campo) => ETIQUETAS[campo]);

  if (contrasenaObligatoria && !contrasena) {
    faltantes.push("contrasena");
    etiquetasFaltantes.push("Contraseña");
  }

  if (faltantes.length > 0) {
    throw new AppError(
      400,
      "DATOS_INCOMPLETOS",
      `Faltan campos obligatorios: ${etiquetasFaltantes.join(", ")}.`,
      faltantes
    );
  }

  const problemas = [];

  if (datos.nombre.length > 120) {
    problemas.push(["nombre", "El nombre debe tener máximo 120 caracteres."]);
  }

  if (!patronDocumento.test(datos.documento)) {
    problemas.push([
      "documento",
      "El documento debe tener entre 4 y 20 letras o números, sin espacios.",
    ]);
  }

  const digitosTelefono = (datos.telefono.match(/[0-9]/g) || []).length;

  if (!patronTelefono.test(datos.telefono) || digitosTelefono < 7) {
    problemas.push([
      "telefono",
      "El teléfono debe tener entre 7 y 20 dígitos (puede incluir +, espacios o guiones).",
    ]);
  }

  if (!patronCorreo.test(datos.correo) || datos.correo.length > 120) {
    problemas.push(["correo", "Ingresa un correo electrónico válido."]);
  }

  if (!ROLES.includes(datos.rol)) {
    problemas.push(["rol", "El rol debe ser administrador, entrenador o usuario."]);
  }

  if (contrasena && !contrasenaValida(contrasena)) {
    problemas.push(["contrasena", MENSAJE_CONTRASENA]);
  }

  if (problemas.length > 0) {
    throw new AppError(
      400,
      "DATOS_INVALIDOS",
      problemas.map(([, mensaje]) => mensaje).join(" "),
      problemas.map(([campo]) => campo)
    );
  }

  return { datos, contrasena };
}

async function exigirNoDuplicado(documento, excluirId = null) {
  const duplicado = await repositorio.buscarPorDocumento(documento, excluirId);

  if (duplicado) {
    throw new AppError(
      409,
      "USUARIO_DUPLICADO",
      "El usuario ya existe: hay un registro con ese documento.",
      ["documento"]
    );
  }
}

async function exigirCorreoLibre(correo, excluirId = null) {
  const repetido = await repositorio.buscarPorCorreo(correo, excluirId);

  if (repetido) {
    throw new AppError(
      409,
      "CORREO_DUPLICADO",
      "Ese correo electrónico ya pertenece a otro usuario.",
      ["correo"]
    );
  }
}

async function exigirExistente(id) {
  const usuario = await repositorio.obtenerPorId(id);

  if (!usuario) {
    throw new AppError(404, "USUARIO_NO_ENCONTRADO", "El usuario no existe.");
  }

  return usuario;
}

// E1-HU1
export async function registrar(cuerpo) {
  const { datos, contrasena } = validarUsuario(cuerpo, {
    contrasenaObligatoria: true,
  });
  await exigirNoDuplicado(datos.documento);
  await exigirCorreoLibre(datos.correo);

  return repositorio.crear({
    ...datos,
    contrasenaHash: await cifrarContrasena(contrasena),
  });
}

// E1-HU2: consultar y buscar por nombre o documento.
export async function listar(consulta = {}) {
  const filtros = {};
  let buscando = false;

  if (consulta.buscar !== undefined) {
    const criterio = comoTexto(consulta.buscar);

    if (!criterio) {
      throw new AppError(
        400,
        "CRITERIO_VACIO",
        "Ingresa un nombre o número de documento para buscar."
      );
    }

    filtros.buscar = criterio;
    buscando = true;
  }

  if (consulta.rol !== undefined) {
    if (!ROLES.includes(consulta.rol)) {
      throw new AppError(400, "ROL_INVALIDO", "El rol indicado no es válido.");
    }
    filtros.rol = consulta.rol;
  }

  if (consulta.estado !== undefined) {
    if (!ESTADOS.includes(consulta.estado)) {
      throw new AppError(400, "ESTADO_INVALIDO", "El estado indicado no es válido.");
    }
    filtros.estado = consulta.estado;
  }

  const [usuarios, resumen] = await Promise.all([
    repositorio.listar(filtros),
    repositorio.resumen(),
  ]);

  return {
    usuarios,
    resumen,
    mensaje:
      buscando && usuarios.length === 0
        ? "No se encontró ningún usuario con ese criterio."
        : undefined,
  };
}

export async function obtener(idCrudo) {
  return exigirExistente(leerId(idCrudo, "id de usuario"));
}

// E1-HU3
export async function actualizar(idCrudo, cuerpo, actor) {
  const id = leerId(idCrudo, "id de usuario");
  const existente = await exigirExistente(id);

  const { datos, contrasena } = validarUsuario(cuerpo, {
    contrasenaObligatoria: false,
  });

  // Evita que el administrador se quite a sí mismo el acceso.
  if (actor.id === id && datos.rol !== existente.rol) {
    throw new AppError(
      409,
      "ACCION_NO_PERMITIDA",
      "No puedes cambiar tu propio rol.",
      ["rol"]
    );
  }

  await exigirNoDuplicado(datos.documento, id);
  await exigirCorreoLibre(datos.correo, id);

  try {
    return await repositorio.actualizar(id, {
      ...datos,
      contrasenaHash: contrasena ? await cifrarContrasena(contrasena) : null,
    });
  } catch (error) {
    // 23503: la persona ya tiene rutinas, asignaciones o pagos ligados a su rol actual.
    if (error.code === "23503") {
      throw new AppError(
        409,
        "ROL_EN_USO",
        "No se puede cambiar el rol: la persona ya tiene rutinas, asignaciones o pagos asociados.",
        ["rol"]
      );
    }
    // 23505: otro registro tomó el mismo documento al mismo tiempo.
    if (error.code === "23505") {
      throw new AppError(
        409,
        "USUARIO_DUPLICADO",
        "El usuario ya existe: hay un registro con ese documento.",
        ["documento"]
      );
    }
    throw error;
  }
}

// E1-HU4: se cambia el estado, nunca se elimina el registro.
export async function cambiarEstado(idCrudo, cuerpo, actor) {
  const id = leerId(idCrudo, "id de usuario");
  const estado = comoTexto(cuerpo?.estado);

  if (!ESTADOS.includes(estado)) {
    throw new AppError(
      400,
      "ESTADO_INVALIDO",
      "El estado debe ser Activo o Inactivo.",
      ["estado"]
    );
  }

  await exigirExistente(id);

  if (actor.id === id && estado === "Inactivo") {
    throw new AppError(
      409,
      "ACCION_NO_PERMITIDA",
      "No puedes inactivar tu propio usuario."
    );
  }

  return repositorio.cambiarEstado(id, estado);
}
