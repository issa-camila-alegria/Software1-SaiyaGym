import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.js";
import { formatearFecha } from "../utils/formato.js";

const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const periodoActual = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
};

const formularioInicial = () => ({
  usuario_id: "",
  concepto: "Mensualidad",
  periodo: periodoActual(),
  valor: "",
});

// Sprint 3 - el administrador gestiona los pagos de los usuarios:
//   E3-HU1 registrar un pago, E3-HU3 consultar pagos pendientes
//   (y generar cobros) y E3-HU4 actualizar el estado de un pago.
// Las reglas (valor válido, usuario existente, pago duplicado) las valida
// el backend; aquí solo se muestran los mensajes que devuelve la API.
function PagosPage({ notificar }) {
  const [usuarios, setUsuarios] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  const [formulario, setFormulario] = useState(formularioInicial);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  // Cobros pendientes (E3-HU3) y su cambio de estado (E3-HU4).
  const [pendientes, setPendientes] = useState({ pendientes: [], resumen: { cantidad: 0, total: 0 }, usuario: null });
  const [errorPendientes, setErrorPendientes] = useState(null);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [formularioCobro, setFormularioCobro] = useState(formularioInicial);
  const [erroresCobro, setErroresCobro] = useState({});
  const [generando, setGenerando] = useState(false);
  const [actualizandoId, setActualizandoId] = useState(null);

  const cargarPagos = useCallback(async () => {
    try {
      const respuesta = await api.pagos.listar();
      setPagos(respuesta.data);
      setErrorCarga(null);
    } catch (error) {
      setErrorCarga(error.message);
    } finally {
      setCargando(false);
    }
  }, []);

  /** Consulta los cobros pendientes (de todos o de un usuario). */
  const cargarPendientes = useCallback(async (usuarioId) => {
    try {
      const respuesta = await api.pagos.pendientes(usuarioId);
      setPendientes(respuesta.data);
      setErrorPendientes(null);
      return respuesta;
    } catch (error) {
      if (error.codigo === "USUARIO_NO_ENCONTRADO") {
        // El usuario desapareció: se vuelve a la vista general.
        setFiltroUsuario("");
        notificar("error", error.message);
        return cargarPendientes();
      }
      setErrorPendientes(error.message);
      return null;
    }
  }, [notificar]);

  // Carga inicial: usuarios para elegir y últimos pagos registrados.
  useEffect(() => {
    let vigente = true;

    Promise.all([api.pagos.usuarios(), api.pagos.listar(), api.pagos.pendientes()])
      .then(([respUsuarios, respPagos, respPendientes]) => {
        if (!vigente) return;
        setUsuarios(respUsuarios.data);
        setPagos(respPagos.data);
        setPendientes(respPendientes.data);
        setErrorCarga(null);
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

  const manejarCambio = (e) => {
    const { name, value } = e.target;

    setFormulario((anterior) => ({ ...anterior, [name]: value }));
    setErrores((anteriores) => ({ ...anteriores, [name]: false }));
  };

  const registrarPago = async (e) => {
    e.preventDefault();
    if (guardando) return;

    setGuardando(true);
    setErrores({});

    try {
      const respuesta = await api.pagos.registrar(formulario);

      notificar("exito", respuesta.mensaje);
      setFormulario(formularioInicial());
      await refrescar();
    } catch (error) {
      setErrores(
        Object.fromEntries((error.campos || []).map((campo) => [campo, true]))
      );
      notificar("error", error.message);
    } finally {
      setGuardando(false);
    }
  };

  const manejarCambioCobro = (e) => {
    const { name, value } = e.target;

    setFormularioCobro((anterior) => ({ ...anterior, [name]: value }));
    setErroresCobro((anteriores) => ({ ...anteriores, [name]: false }));
  };

  // Refresca los dos listados que dependen del estado de los cobros.
  const refrescar = async () => {
    await Promise.all([cargarPagos(), cargarPendientes(filtroUsuario)]);
  };

  const generarCobro = async (e) => {
    e.preventDefault();
    if (generando) return;

    setGenerando(true);
    setErroresCobro({});

    try {
      const respuesta = await api.pagos.generarCobro(formularioCobro);

      notificar("exito", respuesta.mensaje);
      setFormularioCobro(formularioInicial());
      await cargarPendientes(filtroUsuario);
    } catch (error) {
      setErroresCobro(
        Object.fromEntries((error.campos || []).map((campo) => [campo, true]))
      );
      notificar("error", error.message);
    } finally {
      setGenerando(false);
    }
  };

  const consultarPendientes = async (e) => {
    e.preventDefault();

    const respuesta = await cargarPendientes(filtroUsuario);

    // Caso "sin pagos pendientes": se avisa con el mensaje del servidor.
    if (respuesta && respuesta.data.pendientes.length === 0) {
      notificar("exito", respuesta.mensaje);
    }
  };

  const verTodos = async () => {
    setFiltroUsuario("");
    await cargarPendientes();
  };

  // E3-HU4: marcar como pagado o devolver a pendiente.
  const cambiarEstadoCobro = async (obligacionId, estado) => {
    if (actualizandoId !== null) return;

    setActualizandoId(obligacionId);

    try {
      const respuesta = await api.pagos.actualizarEstado(obligacionId, estado);
      notificar("exito", respuesta.mensaje);
    } catch (error) {
      notificar("error", error.message);
    } finally {
      setActualizandoId(null);
      await refrescar();
    }
  };

  const volverAPendiente = (pago) => {
    const confirmar = window.confirm(
      `¿Devolver a pendiente el pago de ${pago.usuario_nombre} (${pago.concepto}, ${pago.periodo})?\n` +
        "El pago registrado se eliminará y el cobro volverá a la lista de pendientes."
    );

    if (confirmar) cambiarEstadoCobro(pago.obligacion_id, "Pendiente");
  };

  const marcarPagado = (cobro) => cambiarEstadoCobro(cobro.id, "Pagada");

  return (
    <>
      <section className="bienvenida">
        <div>
          <span className="sobretitulo">Panel administrativo</span>
          <h2>Gestión de pagos</h2>
          <p>
            Registra los pagos realizados por los usuarios, genera cobros
            y consulta lo que está pendiente para controlar los ingresos
            del gimnasio.
          </p>
        </div>

        <div className="bienvenida-icono" aria-hidden="true">
          <span>SG</span>
        </div>
      </section>

      <section className="tarjeta">
        <div className="encabezado-tarjeta">
          <div>
            <span className="sobretitulo">Nuevo registro</span>
            <h2>Registrar pago</h2>
          </div>

          <span className="numero-seccion">01</span>
        </div>

        <form onSubmit={registrarPago} className="formulario" noValidate>
          <label
            className={`campo-completo ${errores.usuario_id ? "campo-error" : ""}`}
          >
            Usuario
            <select
              name="usuario_id"
              value={formulario.usuario_id}
              onChange={manejarCambio}
              aria-invalid={Boolean(errores.usuario_id)}
            >
              <option value="">Selecciona un usuario</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre} · {usuario.documento}
                  {usuario.estado !== "Activo" ? " (inactivo)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className={errores.concepto ? "campo-error" : ""}>
            Concepto
            <input
              type="text"
              name="concepto"
              placeholder="Ej. Mensualidad"
              value={formulario.concepto}
              onChange={manejarCambio}
              autoComplete="off"
              aria-invalid={Boolean(errores.concepto)}
            />
          </label>

          <label className={errores.periodo ? "campo-error" : ""}>
            Período
            <input
              type="month"
              name="periodo"
              value={formulario.periodo}
              onChange={manejarCambio}
              aria-invalid={Boolean(errores.periodo)}
            />
          </label>

          <label className={`campo-completo ${errores.valor ? "campo-error" : ""}`}>
            Valor del pago (COP)
            <input
              type="text"
              inputMode="decimal"
              name="valor"
              placeholder="Ej. 80000"
              value={formulario.valor}
              onChange={manejarCambio}
              autoComplete="off"
              aria-invalid={Boolean(errores.valor)}
            />
          </label>

          <div className="acciones-formulario">
            <button className="boton-principal" type="submit" disabled={guardando}>
              {guardando ? "Registrando..." : "Registrar pago"}
            </button>
          </div>
        </form>
      </section>

      <section className="tarjeta">
        <div className="encabezado-tarjeta">
          <div>
            <span className="sobretitulo">Nuevo cobro</span>
            <h2>Generar cobro pendiente</h2>
          </div>

          <span className="numero-seccion">02</span>
        </div>

        <form onSubmit={generarCobro} className="formulario" noValidate>
          <label
            className={`campo-completo ${erroresCobro.usuario_id ? "campo-error" : ""}`}
          >
            Usuario
            <select
              name="usuario_id"
              value={formularioCobro.usuario_id}
              onChange={manejarCambioCobro}
              aria-invalid={Boolean(erroresCobro.usuario_id)}
            >
              <option value="">Selecciona un usuario</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre} · {usuario.documento}
                  {usuario.estado !== "Activo" ? " (inactivo)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className={erroresCobro.concepto ? "campo-error" : ""}>
            Concepto
            <input
              type="text"
              name="concepto"
              placeholder="Ej. Mensualidad"
              value={formularioCobro.concepto}
              onChange={manejarCambioCobro}
              autoComplete="off"
              aria-invalid={Boolean(erroresCobro.concepto)}
            />
          </label>

          <label className={erroresCobro.periodo ? "campo-error" : ""}>
            Período
            <input
              type="month"
              name="periodo"
              value={formularioCobro.periodo}
              onChange={manejarCambioCobro}
              aria-invalid={Boolean(erroresCobro.periodo)}
            />
          </label>

          <label className={`campo-completo ${erroresCobro.valor ? "campo-error" : ""}`}>
            Valor a cobrar (COP)
            <input
              type="text"
              inputMode="decimal"
              name="valor"
              placeholder="Ej. 80000"
              value={formularioCobro.valor}
              onChange={manejarCambioCobro}
              autoComplete="off"
              aria-invalid={Boolean(erroresCobro.valor)}
            />
          </label>

          <div className="acciones-formulario">
            <button className="boton-principal" type="submit" disabled={generando}>
              {generando ? "Generando..." : "Generar cobro"}
            </button>
          </div>
        </form>
      </section>

      <section className="resumen" aria-label="Resumen de pagos pendientes">
        <article className="indicador">
          <span className="indicador-etiqueta">PAGOS PENDIENTES</span>
          <strong>{pendientes.resumen.cantidad}</strong>
          <span className="indicador-descripcion">
            {pendientes.usuario ? `De ${pendientes.usuario.nombre}` : "De todos los usuarios"}
          </span>
        </article>

        <article className="indicador">
          <span className="indicador-etiqueta">TOTAL POR COBRAR</span>
          <strong>{moneda.format(pendientes.resumen.total)}</strong>
          <span className="indicador-descripcion">
            {pendientes.usuario ? `De ${pendientes.usuario.nombre}` : "De todos los usuarios"}
          </span>
        </article>
      </section>

      <section className="tarjeta">
        <div className="encabezado-listado">
          <div className="titulo-listado">
            <div>
              <span className="sobretitulo">Por cobrar</span>
              <h2>Pagos pendientes</h2>
            </div>

            <span className="contador">
              {pendientes.resumen.cantidad}{" "}
              {pendientes.resumen.cantidad === 1 ? "pendiente" : "pendientes"}
            </span>
          </div>

          <form className="busqueda" onSubmit={consultarPendientes}>
            <label className="buscador">
              <select
                value={filtroUsuario}
                onChange={(e) => setFiltroUsuario(e.target.value)}
                aria-label="Filtrar pagos pendientes por usuario"
              >
                <option value="">Todos los usuarios</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombre} · {usuario.documento}
                  </option>
                ))}
              </select>
            </label>

            <button className="boton-principal boton-compacto" type="submit">
              Consultar
            </button>

            {pendientes.usuario && (
              <button
                className="boton-secundario boton-compacto"
                type="button"
                onClick={verTodos}
              >
                Ver todos
              </button>
            )}
          </form>
        </div>

        {errorPendientes ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">!</div>
            <h3>No se pudieron cargar los pagos pendientes</h3>
            <p>{errorPendientes}</p>
            <button
              className="boton-secundario boton-compacto"
              type="button"
              onClick={() => cargarPendientes(filtroUsuario)}
            >
              Reintentar
            </button>
          </div>
        ) : pendientes.pendientes.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">✓</div>
            <h3>No hay pagos pendientes</h3>
            <p>
              {pendientes.usuario
                ? `${pendientes.usuario.nombre} no tiene pagos pendientes.`
                : "Todos los cobros generados están pagados."}
            </p>
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Documento</th>
                  <th>Concepto</th>
                  <th>Período</th>
                  <th>Valor</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {pendientes.pendientes.map((cobro) => (
                  <tr key={cobro.id}>
                    <td data-label="Usuario">
                      <div className="celda-usuario">
                        <span className="avatar">
                          {cobro.usuario_nombre.charAt(0).toUpperCase()}
                        </span>
                        <span>{cobro.usuario_nombre}</span>
                      </div>
                    </td>
                    <td data-label="Documento">{cobro.usuario_documento}</td>
                    <td data-label="Concepto">{cobro.concepto}</td>
                    <td data-label="Período">{cobro.periodo}</td>
                    <td data-label="Valor">{moneda.format(cobro.valor)}</td>
                    <td data-label="Estado">
                      <span className="estado pendiente">
                        <span className="estado-punto"></span>
                        Pendiente
                      </span>
                    </td>
                    <td data-label="Acciones">
                      <div className="acciones-tabla">
                        <button
                          className="boton-estado"
                          type="button"
                          onClick={() => marcarPagado(cobro)}
                          disabled={actualizandoId !== null}
                        >
                          {actualizandoId === cobro.id ? "Guardando..." : "Marcar como pagado"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <div className="encabezado-listado">
          <div className="titulo-listado">
            <div>
              <span className="sobretitulo">Movimientos</span>
              <h2>Últimos pagos registrados</h2>
            </div>

            <span className="contador">
              {pagos.length} {pagos.length === 1 ? "pago" : "pagos"}
            </span>
          </div>
        </div>

        {cargando ? (
          <div className="vacio">
            <h3>Cargando pagos...</h3>
          </div>
        ) : errorCarga ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">!</div>
            <h3>No se pudieron cargar los pagos</h3>
            <p>{errorCarga}</p>
            <button
              className="boton-secundario boton-compacto"
              type="button"
              onClick={cargarPagos}
            >
              Reintentar
            </button>
          </div>
        ) : pagos.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">＋</div>
            <h3>Todavía no hay pagos</h3>
            <p>Registra el primer pago con el formulario de arriba.</p>
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Documento</th>
                  <th>Concepto</th>
                  <th>Período</th>
                  <th>Valor</th>
                  <th>Fecha de pago</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {pagos.map((pago) => (
                  <tr key={pago.id}>
                    <td data-label="Usuario">
                      <div className="celda-usuario">
                        <span className="avatar">
                          {pago.usuario_nombre.charAt(0).toUpperCase()}
                        </span>
                        <span>{pago.usuario_nombre}</span>
                      </div>
                    </td>
                    <td data-label="Documento">{pago.usuario_documento}</td>
                    <td data-label="Concepto">{pago.concepto}</td>
                    <td data-label="Período">{pago.periodo}</td>
                    <td data-label="Valor">{moneda.format(pago.valor)}</td>
                    <td data-label="Fecha">{formatearFecha(pago.fecha_pago)}</td>
                    <td data-label="Acciones">
                      <div className="acciones-tabla">
                        <button
                          className="boton-estado"
                          type="button"
                          onClick={() => volverAPendiente(pago)}
                          disabled={actualizandoId !== null}
                        >
                          {actualizandoId === pago.obligacion_id ? "Guardando..." : "Volver a pendiente"}
                        </button>
                      </div>
                    </td>
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

export default PagosPage;
