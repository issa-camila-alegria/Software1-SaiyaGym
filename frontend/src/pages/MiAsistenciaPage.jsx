import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.js";
import { formatearFecha } from "../utils/formato.js";

const claseEstado = {
  Activa: "activo",
  "En riesgo": "por-vencer",
  Interrumpida: "inactivo",
  "Sin racha": "por-iniciar",
};

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// "2026-11-17" -> "mar". Se calcula con UTC para que la zona horaria no mueva el día.
function diaSemana(fecha) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return DIAS[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];
}

// Los últimos 14 días terminando en "hoy" (fecha del gimnasio que da el servidor).
function ultimosDias(asistencias, hoy) {
  const asistio = new Set(asistencias.map((a) => a.fecha));
  const lista = [];

  for (let i = 13; i >= 0; i -= 1) {
    const fecha = sumarDias(hoy, -i);
    lista.push({ fecha, asistio: asistio.has(fecha), esHoy: i === 0 });
  }

  return lista;
}

function sumarDias(fecha, n) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia + n));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// Sprint 5 - E5: el usuario registra SU asistencia, ve su historial y su racha.
// El servidor identifica al usuario por su sesión: no puede ver ni registrar la de otro.
function MiAsistenciaPage({ notificar }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [datos, setDatos] = useState(null);
  const [registrando, setRegistrando] = useState(false);

  const cargar = useCallback(() => {
    return api.miAsistencia
      .consultar()
      .then((respuesta) => {
        setDatos(respuesta.data);
        setError(null);
      })
      .catch((falla) => setError(falla.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const registrar = async () => {
    setRegistrando(true);

    try {
      const respuesta = await api.miAsistencia.registrar();
      notificar("exito", respuesta.mensaje);
    } catch (falla) {
      notificar("error", falla.message);
    } finally {
      await cargar();
      setRegistrando(false);
    }
  };

  const racha = datos?.racha;
  const semana = datos ? ultimosDias(datos.asistencias, datos.fecha_hoy) : [];

  return (
    <>
      <section className="bienvenida">
        <div>
          <span className="sobretitulo">Panel del usuario</span>
          <h2>Mi asistencia</h2>
          <p>
            Registra tu asistencia cuando llegues al gimnasio y mira cuántos
            días seguidos llevas entrenando.
          </p>
        </div>

        <div className="bienvenida-icono" aria-hidden="true">
          <span>SG</span>
        </div>
      </section>

      {cargando ? (
        <section className="tarjeta">
          <div className="vacio">
            <h3>Cargando tu asistencia...</h3>
          </div>
        </section>
      ) : error ? (
        <section className="tarjeta">
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">!</div>
            <h3>No se pudo cargar tu asistencia</h3>
            <p>{error}</p>
            <button className="boton-secundario boton-compacto" type="button" onClick={cargar}>
              Reintentar
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="tarjeta accion-asistencia">
            <div>
              <span className="sobretitulo">Hoy</span>
              <h2>{datos.hoy ? "Asistencia registrada" : "¿Ya llegaste al gimnasio?"}</h2>
              <p className={datos.puede_registrar || datos.hoy ? "" : "aviso-bloqueo"}>
                {datos.hoy
                  ? `Quedó guardada a las ${datos.hoy.hora}. Solo se cuenta una asistencia por día.`
                  : datos.puede_registrar
                    ? "Registra tu asistencia de hoy para sumar a tu racha."
                    : datos.motivo}
              </p>
            </div>

            <button
              className="boton-principal"
              type="button"
              disabled={!datos.puede_registrar || registrando}
              onClick={registrar}
            >
              {registrando ? "Registrando..." : datos.hoy ? "Ya registrada" : "Registrar mi asistencia"}
            </button>
          </section>

          <section className="resumen" aria-label="Mi racha de asistencia">
            <article className="indicador">
              <span className="indicador-etiqueta">RACHA ACTUAL</span>
              <strong>{racha.actual}</strong>
              <span className="indicador-descripcion">
                {racha.actual === 1 ? "día seguido" : "días seguidos"}
              </span>
            </article>

            <article className="indicador">
              <span className="indicador-etiqueta">ESTADO DE LA RACHA</span>
              <div>
                <span className={`estado ${claseEstado[racha.estado]}`}>
                  <span className="estado-punto"></span>
                  {racha.estado}
                </span>
              </div>
              <span className="indicador-descripcion">{racha.mensaje}</span>
            </article>

            <article className="indicador">
              <span className="indicador-etiqueta">MEJOR RACHA</span>
              <strong>{racha.mejor}</strong>
              <span className="indicador-descripcion">
                {racha.ultima_asistencia
                  ? `Última asistencia: ${formatearFecha(racha.ultima_asistencia)}`
                  : "Aún sin asistencias"}
              </span>
            </article>
          </section>

          {semana.length > 0 && (
            <section className="tarjeta">
              <div className="encabezado-listado">
                <div className="titulo-listado">
                  <div>
                    <span className="sobretitulo">Últimos 14 días</span>
                    <h2>Mi constancia</h2>
                  </div>
                </div>
              </div>

              <ol className="semana" aria-label="Asistencia de los últimos 14 días">
                {semana.map((dia) => (
                  <li
                    key={dia.fecha}
                    className={`dia ${dia.asistio ? "asistio" : ""} ${dia.esHoy ? "hoy" : ""}`}
                    title={`${formatearFecha(dia.fecha)}: ${dia.asistio ? "asististe" : "sin asistencia"}`}
                  >
                    <span className="dia-nombre">{dia.esHoy ? "hoy" : diaSemana(dia.fecha)}</span>
                    <span className="dia-marca" aria-hidden="true">{dia.asistio ? "✓" : ""}</span>
                    <span className="dia-numero">{Number(dia.fecha.slice(8))}</span>
                    <span className="sr-solo">{dia.asistio ? "asististe" : "sin asistencia"}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="tarjeta">
            <div className="encabezado-listado">
              <div className="titulo-listado">
                <div>
                  <span className="sobretitulo">Historial</span>
                  <h2>Mis asistencias</h2>
                </div>

                <span className="contador">
                  {datos.total} {datos.total === 1 ? "asistencia" : "asistencias"}
                </span>
              </div>
            </div>

            {datos.asistencias.length === 0 ? (
              <div className="vacio">
                <div className="vacio-icono" aria-hidden="true">i</div>
                <h3>Aún no tienes asistencias registradas</h3>
                <p>Cuando registres la primera aparecerá aquí, ordenada por fecha.</p>
              </div>
            ) : (
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Día</th>
                      <th>Hora</th>
                    </tr>
                  </thead>

                  <tbody>
                    {datos.asistencias.map((asistencia) => (
                      <tr key={asistencia.id}>
                        <td data-label="Fecha">{formatearFecha(asistencia.fecha)}</td>
                        <td data-label="Día">{diaSemana(asistencia.fecha)}</td>
                        <td data-label="Hora">{asistencia.hora}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

export default MiAsistenciaPage;
