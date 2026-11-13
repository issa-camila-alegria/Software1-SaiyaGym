import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.js";
import { formatearFecha } from "../utils/formato.js";

const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// Sprint 3 - E3-HU2: el usuario consulta SU historial de pagos y
// E3-HU3: sus pagos pendientes.
// El servidor identifica al usuario por su sesión: no puede ver pagos ajenos.
function MisPagosPage({ notificar }) {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [resultado, setResultado] = useState(null); // { pagos, resumen, periodo }
  const [periodo, setPeriodo] = useState("");
  const [periodoActivo, setPeriodoActivo] = useState("");
  const [pendientes, setPendientes] = useState(null); // { pendientes, resumen }
  const [errorPendientes, setErrorPendientes] = useState(null);

  const consultar = useCallback(async (periodoConsulta) => {
    setCargando(true);

    try {
      const respuesta = await api.misPagos.consultar(periodoConsulta);
      setResultado(respuesta.data);
      setPeriodoActivo(periodoConsulta || "");
      setErrorCarga(null);
    } catch (error) {
      if (error.codigo === "PERIODO_INVALIDO") {
        notificar("error", error.message);
      } else {
        setErrorCarga(error.message);
      }
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  // Carga inicial al abrir la pantalla.
  useEffect(() => {
    let vigente = true;

    api.misPagos
      .pendientes()
      .then((respuesta) => {
        if (vigente) setPendientes(respuesta.data);
      })
      .catch((error) => {
        if (vigente) setErrorPendientes(error.message);
      });

    api.misPagos
      .consultar()
      .then((respuesta) => {
        if (vigente) setResultado(respuesta.data);
      })
      .catch((error) => {
        if (vigente) setErrorCarga(error.message);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, []);

  const filtrar = (e) => {
    e.preventDefault();
    consultar(periodo);
  };

  const limpiar = () => {
    setPeriodo("");
    consultar("");
  };

  const pagos = resultado?.pagos ?? [];

  return (
    <>
      <section className="bienvenida">
        <div>
          <span className="sobretitulo">Panel del usuario</span>
          <h2>Mis pagos</h2>
          <p>
            Consulta los pagos que has realizado y verifica el historial
            de tus transacciones.
          </p>
        </div>

        <div className="bienvenida-icono" aria-hidden="true">
          <span>SG</span>
        </div>
      </section>

      {resultado && (
        <section className="resumen" aria-label="Resumen de pagos">
          <article className="indicador">
            <span className="indicador-etiqueta">PAGOS REGISTRADOS</span>
            <strong>{resultado.resumen.cantidad}</strong>
            <span className="indicador-descripcion">
              {periodoActivo ? `En ${periodoActivo}` : "En todo el historial"}
            </span>
          </article>

          <article className="indicador">
            <span className="indicador-etiqueta">TOTAL PAGADO</span>
            <strong>{moneda.format(resultado.resumen.total)}</strong>
            <span className="indicador-descripcion">
              {periodoActivo ? `En ${periodoActivo}` : "En todo el historial"}
            </span>
          </article>
        </section>
      )}

      <section className="tarjeta">
        <div className="encabezado-listado">
          <div className="titulo-listado">
            <div>
              <span className="sobretitulo">Por pagar</span>
              <h2>Mis pagos pendientes</h2>
            </div>

            {pendientes && (
              <span className="contador">
                {pendientes.resumen.cantidad}{" "}
                {pendientes.resumen.cantidad === 1 ? "pendiente" : "pendientes"}
              </span>
            )}
          </div>
        </div>

        {errorPendientes ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">!</div>
            <h3>No se pudieron cargar tus pagos pendientes</h3>
            <p>{errorPendientes}</p>
          </div>
        ) : !pendientes ? (
          <div className="vacio">
            <h3>Cargando tus pagos pendientes...</h3>
          </div>
        ) : pendientes.pendientes.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">✓</div>
            <h3>No tienes pagos pendientes</h3>
            <p>Estás al día con tus pagos.</p>
          </div>
        ) : (
          <>
            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Período</th>
                    <th>Valor</th>
                    <th>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {pendientes.pendientes.map((cobro) => (
                    <tr key={cobro.id}>
                      <td data-label="Concepto">{cobro.concepto}</td>
                      <td data-label="Período">{cobro.periodo}</td>
                      <td data-label="Valor">{moneda.format(cobro.valor)}</td>
                      <td data-label="Estado">
                        <span className="estado pendiente">
                          <span className="estado-punto"></span>
                          Pendiente
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="aviso">
              Total pendiente: <strong>{moneda.format(pendientes.resumen.total)}</strong>. Para pagar,
              acércate a la recepción del gimnasio.
            </p>
          </>
        )}
      </section>

      <section className="tarjeta">
        <div className="encabezado-listado">
          <div className="titulo-listado">
            <div>
              <span className="sobretitulo">Historial</span>
              <h2>Pagos realizados</h2>
            </div>

            <span className="contador">
              {pagos.length} {pagos.length === 1 ? "pago" : "pagos"}
            </span>
          </div>

          <form className="busqueda" onSubmit={filtrar}>
            <label className="buscador">
              <input
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                aria-label="Filtrar pagos por período"
              />
            </label>

            <button className="boton-principal boton-compacto" type="submit">
              Consultar
            </button>

            {periodoActivo && (
              <button
                className="boton-secundario boton-compacto"
                type="button"
                onClick={limpiar}
              >
                Ver todos
              </button>
            )}
          </form>
        </div>

        {cargando ? (
          <div className="vacio">
            <h3>Cargando tus pagos...</h3>
          </div>
        ) : errorCarga ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">!</div>
            <h3>No se pudo cargar tu historial</h3>
            <p>{errorCarga}</p>
            <button
              className="boton-secundario boton-compacto"
              type="button"
              onClick={() => consultar(periodoActivo)}
            >
              Reintentar
            </button>
          </div>
        ) : pagos.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">i</div>
            <h3>No hay pagos para mostrar</h3>
            <p>
              {periodoActivo
                ? `No tienes pagos registrados en el período ${periodoActivo}.`
                : "Aún no tienes pagos registrados."}
            </p>
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Fecha de pago</th>
                  <th>Concepto</th>
                  <th>Período</th>
                  <th>Valor</th>
                </tr>
              </thead>

              <tbody>
                {pagos.map((pago) => (
                  <tr key={pago.id}>
                    <td data-label="Fecha">{formatearFecha(pago.fecha_pago)}</td>
                    <td data-label="Concepto">{pago.concepto}</td>
                    <td data-label="Período">{pago.periodo}</td>
                    <td data-label="Valor">{moneda.format(pago.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default MisPagosPage;
