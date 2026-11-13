import * as servicio from "../services/membresias.service.js";
import { enviar } from "../utils/respuestas.js";

// E4-HU1 (administrador)
export async function registrar(req, res) {
  const membresia = await servicio.registrar(req.body, req.usuario);
  enviar(res, 201, membresia, {
    mensaje: `Membresía ${membresia.tipo} de ${membresia.usuario_nombre} registrada correctamente. Vigente hasta el ${membresia.fecha_fin}.`,
  });
}

export async function usuarios(req, res) {
  enviar(res, 200, await servicio.listarUsuarios());
}

export async function listar(req, res) {
  enviar(res, 200, await servicio.listar());
}

// E4-HU2 (administrador): la membresía de un usuario cualquiera.
export async function deUsuario(req, res) {
  const resultado = await servicio.consultarDeUsuario(req.params.usuarioId);

  enviar(res, 200, resultado, {
    mensaje: resultado.membresia
      ? "Consulta realizada correctamente."
      : `${resultado.usuario.nombre} no tiene una membresía registrada.`,
  });
}

// E4-HU2 (usuario): solo su membresía, el id sale de la sesión.
export async function miMembresia(req, res) {
  const resultado = await servicio.consultarMia(req.usuario.id);

  enviar(res, 200, resultado, {
    mensaje: resultado.membresia
      ? "Consulta realizada correctamente."
      : "Aún no tienes una membresía registrada. Acércate a la recepción del gimnasio.",
  });
}

// E4-HU3 (administrador)
export async function renovar(req, res) {
  const membresia = await servicio.renovar(req.params.id, req.body, req.usuario);
  enviar(res, 200, membresia, {
    mensaje: `Membresía de ${membresia.usuario_nombre} renovada correctamente. Nuevo vencimiento: ${membresia.fecha_fin}.`,
  });
}

// E4-HU4 (administrador)
export async function vencimientos(req, res) {
  const resultado = await servicio.consultarVencimientos(req.query.dias, req.query.filtro);
  const nombre = { proximas: "próximas a vencer", vencidas: "vencidas", todas: "vencidas ni próximas a vencer" };

  enviar(res, 200, resultado, {
    mensaje:
      resultado.membresias.length === 0
        ? resultado.filtro === "proximas"
          ? `No hay membresías próximas a vencer en los próximos ${resultado.dias} días.`
          : `No hay membresías ${nombre[resultado.filtro]}.`
        : "Consulta realizada correctamente.",
  });
}

export async function generarAlerta(req, res) {
  const membresia = await servicio.generarAlerta(req.params.id, req.usuario);
  enviar(res, 201, membresia, {
    mensaje: `Alerta generada para ${membresia.usuario_nombre}.`,
  });
}
