import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { formatearFecha } from "../utils/formato.js";

const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const claseEstado = {
  Activa: "activo",
  "Próxima a vencer": "por-vencer",
  Vencida: "inactivo",
  "Por iniciar": "por-iniciar",
};

const textoEstado = {
  Activa: "Membresía activa",
  "Próxima a vencer": "Membresía próxima a vencer",
  Vencida: "Membresía vencida",
  "Por iniciar": "Membresía por iniciar",
};

function textoDias(membresia) {
  const dias = membresia.dias_restantes;

  if (membresia.estado === "Por iniciar") return `Inicia el ${formatearFecha(membresia.fecha_inicio)}`;
  if (dias < 0) return `Venció hace ${-dias} ${dias === -1 ? "día" : "días"}`;
  if (dias === 0) return "Vence hoy";
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}

// Sprint 4 - E4-HU2: el usuario consulta SU membresía.
// El servidor identifica al usuario por su sesión: no puede ver membresías ajenas.
function MiMembresiaPage() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null); // { membresia, historial, alerta }

  const cargar = () => {
    setCargando(true);
    setError(null);

    return api.miMembresia
      .consultar()
      .then((respuesta) => setResultado(respuesta.data))
      .catch((falla) => setError(falla.message))
      .finally(() => setCargando(false));
  };

  // Carga inicial al abrir la pantalla.
  useEffect(() => {
    let vigente = true;

    api.miMembresia
      .consultar()
      .then((respuesta) => {
        if (vigente) setResultado(respuesta.data);
      })
      .catch((falla) => {
        if (vigente) setError(falla.message);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, []);

  const m = resultado?.membresia;

  return (
    <>
      <section className="bienvenida">
        <div>
          <span className="sobretitulo">Panel del usuario</span>
          <h2>Mi membresía</h2>
          <p>
            Consulta si tu membresía está activa, hasta cuándo es válida y el
            historial de tus períodos.
          </p>
        </div>

        <div className="bienvenida-icono" aria-hidden="true">
          <span>SG</span>
        </div>
      </section>

      {cargando ? (
        <section className="tarjeta">
          <div className="vacio">
            <h3>Cargando tu membresía...</h3>
          </div>
        </section>
      ) : error ? (
        <section className="tarjeta">
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">!</div>
            <h3>No se pudo cargar tu membresía</h3>
            <p>{error}</p>
            <button className="boton-secundario boton-compacto" type="button" onClick={cargar}>
              Reintentar
            </button>
          </div>
        </section>
      ) : !m ? (
        <section className="tarjeta">
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">i</div>
            <h3>Aún no tienes una membresía registrada</h3>
            <p>Acércate a la recepción del gimnasio para afiliarte.</p>
          </div>
        </section>
      ) : (
        <>
          {resultado.alerta && (
            <div
              className={`alerta-membresia ${m.estado === "Vencida" ? "critica" : ""}`}
              role="status"
            >
              <span>{resultado.alerta.mensaje}</span>
            </div>
          )}

          <section className="resumen" aria-label="Estado de mi membresía">
            <article className="indicador">
              <span className="indicador-etiqueta">ESTADO</span>
              <div>
                <span className={`estado ${claseEstado[m.estado]}`}>
                  <span className="estado-punto"></span>
                  {textoEstado[m.estado]}
                </span>
              </div>
              <span className="indicador-descripcion">Tipo {m.tipo}</span>
            </article>

            <article className="indicador">
              <span className="indicador-etiqueta">VENCE EL</span>
              <strong>{formatearFecha(m.fecha_fin)}</strong>
              <span className="indicador-descripcion">Inicio de vigencia: {formatearFecha(m.fecha_inicio)}</span>
            </article>

            <article className="indicador">
              <span className="indicador-etiqueta">TIEMPO RESTANTE</span>
              <strong>{m.dias_restantes < 0 ? 0 : m.dias_restantes}</strong>
              <span className="indicador-descripcion">{textoDias(m)}</span>
            </article>
          </section>

          <section className="tarjeta">
            <div className="encabezado-listado">
              <div className="titulo-listado">
                <div>
                  <span className="sobretitulo">Historial</span>
                  <h2>Mis períodos</h2>
                </div>

                <span className="contador">
                  {resultado.historial.length}{" "}
                  {resultado.historial.length === 1 ? "período" : "períodos"}
                </span>
              </div>
            </div>

            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Origen</th>
                    <th>Tipo</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th>Valor</th>
                  </tr>
                </thead>

                <tbody>
                  {resultado.historial.map((periodo) => (
                    <tr key={periodo.id}>
                      <td data-label="Origen">{periodo.origen}</td>
                      <td data-label="Tipo">{periodo.tipo}</td>
                      <td data-label="Desde">{periodo.fecha_inicio}</td>
                      <td data-label="Hasta">{periodo.fecha_fin}</td>
                      <td data-label="Valor">{moneda.format(periodo.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {m.estado !== "Activa" && m.estado !== "Por iniciar" && (
              <p className="aviso">Para renovar tu membresía, acércate a la recepción del gimnasio.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}

export default MiMembresiaPage;
