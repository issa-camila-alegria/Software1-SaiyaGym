import { useCallback, useEffect, useState } from "react";
import Llama from "../components/Llama.jsx";
import { DIAS_TIRA_ASISTENCIA, HITOS_RACHA } from "../config/constantes.js";
import { api } from "../services/api.js";
import { formatearFecha } from "../utils/formato.js";

// Cada estado de la racha tiene su color (siempre acompañado de texto).
const claseEstado = {
  Activa: "activo",
  "En riesgo": "riesgo",
  Interrumpida: "interrumpida",
  "Sin racha": "por-iniciar",
};

const claseRacha = {
  Activa: "racha-activa",
  "En riesgo": "racha-riesgo",
  Interrumpida: "racha-interrumpida",
  "Sin racha": "racha-sin",
};

/** Meta siguiente y avance (0 a 100) hacia ella. */
function progresoHito(actual) {
  const siguiente = HITOS_RACHA.find((hito) => hito > actual) ?? null;
  const anterior = [...HITOS_RACHA].reverse().find((hito) => hito <= actual) ?? 0;
  const avance = siguiente ? ((actual - anterior) / (siguiente - anterior)) * 100 : 100;
  return { siguiente, avance: Math.round(avance) };
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// "2026-11-17" -> "mar". Se calcula con UTC para que la zona horaria no mueva el día.
function diaSemana(fecha) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return DIAS[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];
}

// Los últimos días (DIAS_TIRA_ASISTENCIA) terminando en "hoy" (fecha del gimnasio que da el servidor).
function ultimosDias(asistencias, hoy) {
  const asistio = new Set(asistencias.map((a) => a.fecha));
  const lista = [];

  for (let i = DIAS_TIRA_ASISTENCIA - 1; i >= 0; i -= 1) {
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
  const progreso = racha ? progresoHito(racha.actual) : null;
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
          <section className={`tarjeta accion-asistencia ${racha.estado === "En riesgo" && !datos.hoy ? "alerta-riesgo" : ""}`}>
            <div>
              <span className="sobretitulo">Hoy</span>
              <h2>{datos.hoy ? "Asistencia registrada" : "¿Ya llegaste al gimnasio?"}</h2>
              <p className={datos.puede_registrar || datos.hoy ? "" : "aviso-bloqueo"}>
                {racha.estado === "En riesgo" && !datos.hoy && datos.puede_registrar
                  ? `¡Tu racha de ${racha.actual} ${racha.actual === 1 ? "día" : "días"} está en riesgo! Registra tu asistencia hoy para no perderla.`
                  : datos.hoy
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

          <section className={`resumen resumen-racha ${claseRacha[racha.estado]}`} aria-label="Mi racha de asistencia">
            <article className="indicador indicador-racha">
              <span className="indicador-etiqueta">RACHA ACTUAL</span>
              <div className="racha-numero">
                <Llama apagada={racha.actual === 0 || racha.estado === "Interrumpida"} />
                <strong>{racha.actual}</strong>
              </div>
              <span className="indicador-descripcion">
                {racha.actual === 1 ? "día seguido" : "días seguidos"}
              </span>
              <div className="meta-racha">
                <div
                  className="meta-barra"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progreso.avance}
                  aria-label="Avance hacia la siguiente meta"
                >
                  <span style={{ width: `${progreso.avance}%` }}></span>
                </div>
                <small>
                  {progreso.siguiente
                    ? `Meta: ${progreso.siguiente} días (te faltan ${progreso.siguiente - racha.actual})`
                    : "¡Superaste todas las metas!"}
                </small>
              </div>
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
              <ul className="insignias" aria-label="Metas alcanzadas con tu mejor racha">
                {HITOS_RACHA.map((hito) => (
                  <li key={hito} className={racha.mejor >= hito ? "lograda" : ""} title={`${hito} días seguidos`}>
                    {hito}
                    <span className="sr-solo">{racha.mejor >= hito ? " alcanzada" : " pendiente"}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          {semana.length > 0 && (
            <section className="tarjeta">
              <div className="encabezado-listado">
                <div className="titulo-listado">
                  <div>
                    <span className="sobretitulo">Últimos {DIAS_TIRA_ASISTENCIA} días</span>
                    <h2>Mi constancia</h2>
                  </div>
                </div>
              </div>

              <ol className="semana" aria-label="Asistencia de los últimos días">
                {semana.map((dia) => (
                  <li
                    key={dia.fecha}
                    className={`dia ${dia.asistio ? "asistio" : ""} ${dia.esHoy ? "hoy" : ""}`}
                    title={`${formatearFecha(dia.fecha)}: ${dia.asistio ? "asististe" : "sin asistencia"}`}
                  >
                    <span className="dia-nombre">{dia.esHoy ? "hoy" : diaSemana(dia.fecha)}</span>
                    <span className="dia-marca" aria-hidden="true">{dia.asistio ? <Llama /> : ""}</span>
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
