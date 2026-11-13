import * as servicio from "../services/rutinas.service.js";
import * as asignaciones from "../services/asignaciones.service.js";
import { enviar } from "../utils/respuestas.js";

export async function crear(req, res) {
  const rutina = await servicio.crear(req.body, req.usuario);
  enviar(res, 201, rutina, { mensaje: "Rutina registrada correctamente." });
}

export async function listar(req, res) {
  enviar(res, 200, await servicio.listar());
}

export async function obtener(req, res) {
  enviar(res, 200, await servicio.obtener(req.params.id));
}

export async function actualizar(req, res) {
  const rutina = await servicio.actualizar(req.params.id, req.body, req.usuario);
  enviar(res, 200, rutina, { mensaje: "Rutina modificada correctamente." });
}

export async function asignar(req, res) {
  const { asignacion, usuario, rutina } = await asignaciones.asignar(req.body);

  enviar(res, 201, asignacion, {
    mensaje: `La rutina "${rutina.nombre}" fue asignada a ${usuario.nombre} correctamente.`,
  });
}

// Usuarios del gimnasio a los que el entrenador puede asignar rutinas
// (solo datos básicos: no se exponen teléfono ni correo).
export async function usuariosAsignables(req, res) {
  enviar(res, 200, await asignaciones.listarUsuariosAsignables());
}

// E2-HU4: el usuario consulta SU rutina (el id sale de la sesión).
export async function miRutina(req, res) {
  enviar(res, 200, await asignaciones.consultarRutinaDeUsuario(req.usuario.id));
}
