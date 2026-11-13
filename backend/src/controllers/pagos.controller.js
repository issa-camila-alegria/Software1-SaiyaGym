import * as servicio from "../services/pagos.service.js";
import { enviar } from "../utils/respuestas.js";

// E3-HU1 (administrador)
export async function registrar(req, res) {
  const pago = await servicio.registrar(req.body, req.usuario);
  enviar(res, 201, pago, {
    mensaje: `Pago de ${pago.usuario_nombre} registrado correctamente.`,
  });
}

export async function listar(req, res) {
  enviar(res, 200, await servicio.listarRecientes());
}

export async function usuariosPagables(req, res) {
  enviar(res, 200, await servicio.listarUsuariosPagables());
}

// E3-HU2 (usuario): solo su propio historial, el id sale de la sesión.
export async function misPagos(req, res) {
  enviar(res, 200, await servicio.consultarHistorial(req.usuario.id, req.query.periodo));
}

// E3-HU3 (administrador): generar un cobro y consultar los pendientes.
export async function generarCobro(req, res) {
  const cobro = await servicio.generarCobro(req.body);
  enviar(res, 201, cobro, {
    mensaje: `Cobro de ${cobro.usuario_nombre} generado correctamente.`,
  });
}

export async function pendientes(req, res) {
  const resultado = await servicio.consultarPendientes(req.query.usuario_id);
  const vacia = resultado.pendientes.length === 0;
  const mensaje = !vacia
    ? "Consulta realizada correctamente."
    : resultado.usuario
      ? `${resultado.usuario.nombre} no tiene pagos pendientes.`
      : "No hay pagos pendientes.";

  enviar(res, 200, resultado, { mensaje });
}

// E3-HU4 (administrador): marcar un cobro como pagado o volverlo a pendiente.
export async function actualizarEstado(req, res) {
  const cobro = await servicio.actualizarEstado(req.params.id, req.body, req.usuario);
  enviar(res, 200, cobro, {
    mensaje:
      cobro.estado === "Pagada"
        ? `Cobro de ${cobro.usuario_nombre} marcado como pagado.`
        : `Cobro de ${cobro.usuario_nombre} devuelto a pendiente.`,
  });
}

// E3-HU3 (usuario): sus propios pagos pendientes.
export async function misPendientes(req, res) {
  const resultado = await servicio.consultarMisPendientes(req.usuario.id);
  enviar(res, 200, resultado, {
    mensaje:
      resultado.pendientes.length === 0
        ? "No tienes pagos pendientes."
        : "Consulta realizada correctamente.",
  });
}
