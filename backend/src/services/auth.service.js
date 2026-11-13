import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import * as usuarios from "../repositories/usuarios.repository.js";
import {
  CONTRASENA,
  LIMITE_INTENTOS,
  MENSAJE_CONTRASENA,
  PATRON_CONTRASENA,
} from "../config/reglas.js";
import { AppError } from "../utils/AppError.js";

// Lógica de inicio de sesión. La contraseña nunca se guarda ni se
// devuelve en texto plano: solo se compara contra su hash (bcrypt).

const RONDAS_BCRYPT = CONTRASENA.rondasBcrypt;

// Hash falso: se compara contra él cuando el documento no existe, para que
// la respuesta tarde lo mismo y no se pueda adivinar qué documentos existen.
const HASH_FALSO = bcrypt.hashSync("clave-falsa-para-igualar-tiempos", RONDAS_BCRYPT);

// Freno contra adivinar contraseñas: máximo de fallos por documento + IP.
const { maxFallos: MAX_FALLOS, ventanaMs: VENTANA_MS } = LIMITE_INTENTOS;
const fallos = new Map(); // clave -> { cantidad, desde }

export { MENSAJE_CONTRASENA };

export const contrasenaValida = (contrasena) =>
  typeof contrasena === "string" && PATRON_CONTRASENA.test(contrasena);

export const cifrarContrasena = (contrasena) =>
  bcrypt.hash(contrasena, RONDAS_BCRYPT);

function bloqueado(clave) {
  const registro = fallos.get(clave);
  if (!registro) return false;

  if (Date.now() - registro.desde > VENTANA_MS) {
    fallos.delete(clave);
    return false;
  }

  return registro.cantidad >= MAX_FALLOS;
}

function registrarFallo(clave) {
  const registro = fallos.get(clave);

  if (!registro || Date.now() - registro.desde > VENTANA_MS) {
    fallos.set(clave, { cantidad: 1, desde: Date.now() });
  } else {
    registro.cantidad += 1;
  }
}

export async function iniciarSesion(cuerpo, ip = "") {
  const documento =
    typeof cuerpo?.documento === "string" || typeof cuerpo?.documento === "number"
      ? String(cuerpo.documento).trim().toUpperCase()
      : "";
  const contrasena =
    typeof cuerpo?.contrasena === "string" ? cuerpo.contrasena : "";

  if (!documento || !contrasena) {
    throw new AppError(
      400,
      "DATOS_INCOMPLETOS",
      "Ingresa tu documento y tu contraseña.",
      [!documento && "documento", !contrasena && "contrasena"].filter(Boolean)
    );
  }

  const clave = `${ip}|${documento}`;

  if (bloqueado(clave)) {
    throw new AppError(
      429,
      "DEMASIADOS_INTENTOS",
      "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo."
    );
  }

  const usuario = await usuarios.obtenerCredenciales(documento);

  const correcta = await bcrypt.compare(
    contrasena,
    usuario?.contrasena_hash || HASH_FALSO
  );

  if (!usuario || !usuario.contrasena_hash || !correcta) {
    registrarFallo(clave);
    throw new AppError(
      401,
      "CREDENCIALES_INVALIDAS",
      "Documento o contraseña incorrectos."
    );
  }

  if (usuario.estado !== "Activo") {
    throw new AppError(
      403,
      "USUARIO_INACTIVO",
      "Tu usuario está inactivo. Comunícate con el administrador."
    );
  }

  fallos.delete(clave);

  const token = jwt.sign({ rol: usuario.rol }, config.jwt.secreto, {
    subject: String(usuario.id),
    expiresIn: config.jwt.expira,
    algorithm: "HS256",
  });

  return {
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
  };
}

/** Verifica el token y devuelve el usuario ACTUAL desde la base de datos. */
export async function validarToken(token) {
  let carga;

  try {
    carga = jwt.verify(token, config.jwt.secreto, { algorithms: ["HS256"] });
  } catch {
    throw new AppError(
      401,
      "SESION_INVALIDA",
      "Tu sesión no es válida o expiró. Inicia sesión de nuevo."
    );
  }

  const usuario = await usuarios.obtenerParaSesion(Number(carga.sub));

  if (!usuario) {
    throw new AppError(
      401,
      "SESION_INVALIDA",
      "Tu sesión no es válida o expiró. Inicia sesión de nuevo."
    );
  }

  if (usuario.estado !== "Activo") {
    throw new AppError(
      401,
      "SESION_INVALIDA",
      "Tu usuario está inactivo. Comunícate con el administrador."
    );
  }

  return usuario;
}
