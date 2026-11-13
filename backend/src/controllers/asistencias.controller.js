import * as servicio from "../services/asistencias.service.js";
import { enviar } from "../utils/respuestas.js";

// El usuario solo ve y registra SU asistencia: el id sale de la sesión.

// E5-HU2 (historial) + estado de hoy + racha
export async function mia(req, res) {
  const resultado = await servicio.consultarMia(req.usuario.id);

  enviar(res, 200, resultado, {
    mensaje:
      resultado.total === 0
        ? "Aún no tienes asistencias registradas."
        : "Consulta realizada correctamente.",
  });
}

// E5-HU3 y E5-HU4 (racha)
export async function racha(req, res) {
  const resultado = await servicio.consultarRacha(req.usuario.id);
  enviar(res, 200, resultado, { mensaje: resultado.mensaje });
}

// E5-HU1
export async function registrar(req, res) {
  const resultado = await servicio.registrar(req.usuario.id);

  enviar(res, 201, resultado, {
    mensaje: `Asistencia registrada correctamente a las ${resultado.asistencia.hora}. ${resultado.racha.mensaje}`,
  });
}
