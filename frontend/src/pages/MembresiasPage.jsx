import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";
import { formatearFecha } from "../utils/formato.js";

const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const TIPOS = ["Mensual", "Trimestral", "Semestral", "Anual"];

// Debe coincidir con la regla del servidor (DIAS_PARA_RENOVAR): el servidor es quien la exige.
const DIAS_PARA_RENOVAR = 30;

const claseEstado = {
  Activa: "activo",
  "Próxima a vencer": "por-vencer",
  Vencida: "inactivo",
  "Por iniciar": "por-iniciar",
};

function EstadoMembresia({ estado }) {
  return (
    <span className={`estado ${claseEstado[estado] ?? ""}`}>
      <span className="estado-punto"></span>
      {estado}
    </span>
  );
}

/** Texto de los días que le quedan a la membresía. */
function textoDias(membresia) {
  const dias = membresia.dias_restantes;

  if (membresia.estado === "Por iniciar") return "Aún no inicia";
  if (dias < 0) return `Venció hace ${-dias} ${dias === -1 ? "día" : "días"}`;
  if (dias === 0) return "Vence hoy";
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}

const formularioInicial = () => ({
  usuario_id: "",
  tipo: "Mensual",
  valor: "",
  fecha_inicio: "",
});

const erroresDe = (error) =>
  Object.fromEntries((error.campos || []).map((campo) => [campo, true]));

// Sprint 4 - el administrador gestiona las membresías:
//   E4-HU1 registrar, E4-HU2 consultar la de un usuario, E4-HU3 renovar y
//   E4-HU4 consultar vencimientos (y generar alertas).
// Las reglas las valida el backend; aquí solo se muestran sus mensajes.
function MembresiasPage({ notificar }) {
  const [usuarios, setUsuarios] = useState([]);
  const [lista, setLista] = useState({
    membresias: [],
    resumen: { total: 0, activas: 0, proximas: 0, vencidas: 0 },
  });
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  // E4-HU1
  const [formulario, setFormulario] = useState(formularioInicial);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  // E4-HU2 y E4-HU3
  const [usuarioConsulta, setUsuarioConsulta] = useState("");
  const [detalle, setDetalle] = useState(null); // { usuario?, membresia, historial, alerta }
  const [formularioRenovar, setFormularioRenovar] = useState({ tipo: "Mensual", valor: "" });
  const [erroresRenovar, setErroresRenovar] = useState({});
  const [renovando, setRenovando] = useState(false);
  const tarjetaDetalle = useRef(null);

  // E4-HU4
  const [filtroDias, setFiltroDias] = useState("5");
  const [filtroTipo, setFiltroTipo] = useState("proximas");
  const [vencimientos, setVencimientos] = useState({
    membresias: [],
    resumen: { cantidad: 0 },
    dias: 5,
    filtro: "proximas",
  });
  const [errorVencimientos, setErrorVencimientos] = useState(null);
  const [alertandoId, setAlertandoId] = useState(null);

  const cargarVencimientos = useCallback(async (dias, filtro) => {
    try {
      const respuesta = await api.membresias.vencimientos({ dias, filtro });
      setVencimientos(respuesta.data);
      setErrorVencimientos(null);
      return respuesta;
    } catch (error) {
      if (error.codigo === "DIAS_INVALIDOS" || error.codigo === "FILTRO_INVALIDO") {
        notificar("error", error.message);
      } else {
        setErrorVencimientos(error.message);
      }
      return null;
    }
  }, [notificar]);

  const cargarListado = useCallback(async () => {
    try {
      const [respUsuarios, respLista] = await Promise.all([
        api.membresias.usuarios(),
        api.membresias.listar(),
      ]);
      setUsuarios(respUsuarios.data);
      setLista(respLista.data);
      setErrorCarga(null);
    } catch (error) {
      setErrorCarga(error.message);
    } finally {
      setCargando(false);
    }
  }, []);

  // Carga inicial al abrir la pantalla.
  useEffect(() => {
    let vigente = true;

    Promise.all([
      api.membresias.usuarios(),
      api.membresias.listar(),
      api.membresias.vencimientos({ dias: 5, filtro: "proximas" }),
    ])
      .then(([respUsuarios, respLista, respVencimientos]) => {
        if (!vigente) return;
        setUsuarios(respUsuarios.data);
        setLista(respLista.data);
        setVencimientos(respVencimientos.data);
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

  /** Muestra el detalle de la membresía de un usuario (E4-HU2). */
  const verDetalle = useCallback(async (usuarioId, { avisar = true, desplazar = false } = {}) => {
    try {
      const respuesta = await api.membresias.deUsuario(usuarioId);
      const datos = respuesta.data;

      setDetalle(datos);
      setUsuarioConsulta(String(usuarioId));
      setErroresRenovar({});

      if (datos.membresia) {
        setFormularioRenovar({
          tipo: datos.membresia.tipo,
          valor: String(datos.membresia.valor),
        });
      }

      // Caso "usuario sin membresía": se avisa con el mensaje del servidor.
      if (avisar && !datos.membresia) notificar("exito", respuesta.mensaje);

      if (desplazar) {
        setTimeout(
          () => tarjetaDetalle.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          50
        );
      }
    } catch (error) {
      notificar("error", error.message);
    }
  }, [notificar]);

  // Después de registrar, renovar o alertar se actualiza todo lo que se muestra.
  const refrescar = async () => {
    await Promise.all([
      cargarListado(),
      cargarVencimientos(filtroDias, filtroTipo),
      detalle?.membresia || detalle?.usuario
        ? verDetalle(detalle.membresia?.usuario_id ?? detalle.usuario.id, { avisar: false })
        : Promise.resolve(),
    ]);
  };

  const manejarCambio = (e) => {
    const { name, value } = e.target;

    setFormulario((anterior) => ({ ...anterior, [name]: value }));
    setErrores((anteriores) => ({ ...anteriores, [name]: false }));
  };

  const registrar = async (e) => {
    e.preventDefault();
    if (guardando) return;

    setGuardando(true);
    setErrores({});

    try {
      const respuesta = await api.membresias.registrar(formulario);

      notificar("exito", respuesta.mensaje);
      setFormulario(formularioInicial());
      await refrescar();
      await verDetalle(respuesta.data.usuario_id, { avisar: false });
    } catch (error) {
      setErrores(erroresDe(error));
      notificar("error", error.message);
    } finally {
      setGuardando(false);
    }
  };

  const consultarUsuario = (e) => {
    e.preventDefault();

    if (!usuarioConsulta) {
      notificar("error", "Selecciona el usuario cuya membresía quieres consultar.");
      return;
    }

    verDetalle(usuarioConsulta);
  };

  const renovar = async (e) => {
    e.preventDefault();
    if (renovando || !detalle?.membresia) return;

    setRenovando(true);
    setErroresRenovar({});

    try {
      const respuesta = await api.membresias.renovar(detalle.membresia.id, formularioRenovar);
      notificar("exito", respuesta.mensaje);
      await refrescar();
    } catch (error) {
      setErroresRenovar(erroresDe(error));
      notificar("error", error.message);
      await refrescar();
    } finally {
      setRenovando(false);
    }
  };

  const consultarVencimientos = async (e) => {
    e.preventDefault();

    const respuesta = await cargarVencimientos(filtroDias, filtroTipo);

    // Caso "sin membresías por vencer": se avisa con el mensaje del servidor.
    if (respuesta && respuesta.data.membresias.length === 0) {
      notificar("exito", respuesta.mensaje);
    }
  };

  const generarAlerta = async (membresia) => {
    if (alertandoId !== null) return;

    setAlertandoId(membresia.id);

    try {
      const respuesta = await api.membresias.generarAlerta(membresia.id);
      notificar("exito", respuesta.mensaje);
    } catch (error) {
      notificar("error", error.message);
    } finally {
      setAlertandoId(null);
      await refrescar();
    }
  };

  const usuariosSinMembresia = usuarios.filter(
    (usuario) => !usuario.tiene_membresia && usuario.estado === "Activo"
  );
  const m = detalle?.membresia;
  const puedeRenovar = m && m.dias_restantes <= DIAS_PARA_RENOVAR;

  return (
    <>
      <section className="bienvenida">
        <div>
          <span className="sobretitulo">Panel administrativo</span>
          <h2>Gestión de membresías</h2>
          <p>
            Registra y renueva las membresías de los usuarios, consulta su
            estado y revisa cuáles están por vencer para avisarles a tiempo.
          </p>
        </div>

        <div className="bienvenida-icono" aria-hidden="true">
          <span>SG</span>
        </div>
      </section>

      <section className="resumen" aria-label="Resumen de membresías">
        <article className="indicador">
          <span className="indicador-etiqueta">ACTIVAS</span>
          <strong>{lista.resumen.activas}</strong>
          <span className="indicador-descripcion">Con vigencia al día</span>
        </article>

        <article className="indicador">
          <span className="indicador-etiqueta">PRÓXIMAS A VENCER</span>
          <strong>{lista.resumen.proximas}</strong>
          <span className="indicador-descripcion">Vencen en 5 días o menos</span>
        </article>

        <article className="indicador">
          <span className="indicador-etiqueta">VENCIDAS</span>
          <strong>{lista.resumen.vencidas}</strong>
          <span className="indicador-descripcion">Pendientes de renovar</span>
        </article>
      </section>

      <section className="tarjeta">
        <div className="encabezado-tarjeta">
          <div>
            <span className="sobretitulo">Nuevo registro</span>
            <h2>Registrar membresía</h2>
          </div>

          <span className="numero-seccion">01</span>
        </div>

        <form onSubmit={registrar} className="formulario" noValidate>
          <label className={`campo-completo ${errores.usuario_id ? "campo-error" : ""}`}>
            Usuario
            <select
              name="usuario_id"
              value={formulario.usuario_id}
              onChange={manejarCambio}
              aria-invalid={Boolean(errores.usuario_id)}
            >
              <option value="">Selecciona un usuario</option>
              {usuariosSinMembresia.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre} · {usuario.documento}
                </option>
              ))}
            </select>
          </label>

          <label className={errores.tipo ? "campo-error" : ""}>
            Tipo de membresía
            <select
              name="tipo"
              value={formulario.tipo}
              onChange={manejarCambio}
              aria-invalid={Boolean(errores.tipo)}
            >
              <option value="">Selecciona el tipo</option>
              {TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>

          <label className={errores.valor ? "campo-error" : ""}>
            Valor (COP)
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

          <label className={`campo-completo ${errores.fecha_inicio ? "campo-error" : ""}`}>
            Fecha de inicio (opcional)
            <input
              type="date"
              name="fecha_inicio"
              value={formulario.fecha_inicio}
              onChange={manejarCambio}
              aria-invalid={Boolean(errores.fecha_inicio)}
            />
          </label>

          <p className="nota-formulario">
            Si no eliges fecha, la membresía empieza hoy. El vencimiento se calcula según el tipo:
            mensual 1 mes, trimestral 3, semestral 6 y anual 12.
          </p>

          <div className="acciones-formulario">
            <button className="boton-principal" type="submit" disabled={guardando}>
              {guardando ? "Registrando..." : "Registrar membresía"}
            </button>
          </div>
        </form>
      </section>

      <section className="tarjeta" ref={tarjetaDetalle}>
        <div className="encabezado-listado">
          <div className="titulo-listado">
            <div>
              <span className="sobretitulo">Consulta</span>
              <h2>Membresía de un usuario</h2>
            </div>

            <span className="numero-seccion">02</span>
          </div>

          <form className="busqueda" onSubmit={consultarUsuario}>
            <label className="buscador">
              <select
                value={usuarioConsulta}
                onChange={(e) => setUsuarioConsulta(e.target.value)}
                aria-label="Usuario cuya membresía se consulta"
              >
                <option value="">Selecciona un usuario</option>
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
          </form>
        </div>

        {!detalle ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">i</div>
            <h3>Elige un usuario para ver su membresía</h3>
            <p>Aquí verás su tipo, vigencia, estado e historial, y podrás renovarla.</p>
          </div>
        ) : !m ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">i</div>
            <h3>{detalle.usuario.nombre} no tiene una membresía registrada</h3>
            <p>Regístrala con el formulario de arriba.</p>
          </div>
        ) : (
          <>
            {detalle.alerta && (
              <div className={`alerta-membresia ${m.estado === "Vencida" ? "critica" : ""}`} role="status">
                <span>Alerta generada: {detalle.alerta.mensaje}</span>
              </div>
            )}

            <dl className="datos-membresia">
              <div>
                <dt>Usuario</dt>
                <dd>{m.usuario_nombre} · {m.usuario_documento}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd><EstadoMembresia estado={m.estado} /></dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{m.tipo}</dd>
              </div>
              <div>
                <dt>Inicio de vigencia</dt>
                <dd>{formatearFecha(m.fecha_inicio)}</dd>
              </div>
              <div>
                <dt>Vencimiento</dt>
                <dd>{formatearFecha(m.fecha_fin)}</dd>
              </div>
              <div>
                <dt>Tiempo restante</dt>
                <dd>{textoDias(m)}</dd>
              </div>
              <div>
                <dt>Último valor</dt>
                <dd>{moneda.format(m.valor)}</dd>
              </div>
            </dl>

            <h3 className="subtitulo-seccion">Renovar membresía</h3>

            <form onSubmit={renovar} className="formulario" noValidate>
              <label className={erroresRenovar.tipo ? "campo-error" : ""}>
                Tipo del nuevo período
                <select
                  value={formularioRenovar.tipo}
                  onChange={(e) => {
                    setFormularioRenovar((anterior) => ({ ...anterior, tipo: e.target.value }));
                    setErroresRenovar((anteriores) => ({ ...anteriores, tipo: false }));
                  }}
                  aria-invalid={Boolean(erroresRenovar.tipo)}
                >
                  {TIPOS.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </label>

              <label className={erroresRenovar.valor ? "campo-error" : ""}>
                Valor (COP)
                <input
                  type="text"
                  inputMode="decimal"
                  value={formularioRenovar.valor}
                  onChange={(e) => {
                    setFormularioRenovar((anterior) => ({ ...anterior, valor: e.target.value }));
                    setErroresRenovar((anteriores) => ({ ...anteriores, valor: false }));
                  }}
                  autoComplete="off"
                  aria-invalid={Boolean(erroresRenovar.valor)}
                />
              </label>

              <p className="nota-formulario">
                {puedeRenovar
                  ? m.dias_restantes >= 0
                    ? "El nuevo período empieza al día siguiente del vencimiento actual."
                    : "Como ya venció, el nuevo período empieza hoy."
                  : `Todavía le quedan ${m.dias_restantes} días. Se podrá renovar cuando falten ${DIAS_PARA_RENOVAR} días o menos.`}
              </p>

              <div className="acciones-formulario">
                <button
                  className="boton-principal"
                  type="submit"
                  disabled={renovando || !puedeRenovar}
                >
                  {renovando ? "Renovando..." : "Renovar membresía"}
                </button>
              </div>
            </form>

            <h3 className="subtitulo-seccion">Historial de períodos</h3>

            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Origen</th>
                    <th>Tipo</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th>Valor</th>
                    <th>Registrado</th>
                  </tr>
                </thead>

                <tbody>
                  {detalle.historial.map((periodo) => (
                    <tr key={periodo.id}>
                      <td data-label="Origen">{periodo.origen}</td>
                      <td data-label="Tipo">{periodo.tipo}</td>
                      <td data-label="Desde">{periodo.fecha_inicio}</td>
                      <td data-label="Hasta">{periodo.fecha_fin}</td>
                      <td data-label="Valor">{moneda.format(periodo.valor)}</td>
                      <td data-label="Registrado">{periodo.registrado_el}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="tarjeta">
        <div className="encabezado-listado">
          <div className="titulo-listado">
            <div>
              <span className="sobretitulo">Vencimientos</span>
              <h2>Membresías por vencer</h2>
            </div>

            <span className="contador">
              {vencimientos.resumen.cantidad}{" "}
              {vencimientos.resumen.cantidad === 1 ? "membresía" : "membresías"}
            </span>
          </div>

          <form className="busqueda" onSubmit={consultarVencimientos}>
            <label className="buscador">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                aria-label="Qué vencimientos mostrar"
              >
                <option value="proximas">Próximas a vencer</option>
                <option value="vencidas">Ya vencidas</option>
                <option value="todas">Vencidas y próximas</option>
              </select>
            </label>

            <label className="buscador">
              <select
                value={filtroDias}
                onChange={(e) => setFiltroDias(e.target.value)}
                aria-label="Días de anticipación"
                disabled={filtroTipo === "vencidas"}
              >
                <option value="5">En 5 días o menos</option>
                <option value="10">En 10 días o menos</option>
                <option value="15">En 15 días o menos</option>
                <option value="30">En 30 días o menos</option>
              </select>
            </label>

            <button className="boton-principal boton-compacto" type="submit">
              Consultar
            </button>
          </form>
        </div>

        {errorVencimientos ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">!</div>
            <h3>No se pudieron cargar los vencimientos</h3>
            <p>{errorVencimientos}</p>
            <button
              className="boton-secundario boton-compacto"
              type="button"
              onClick={() => cargarVencimientos(filtroDias, filtroTipo)}
            >
              Reintentar
            </button>
          </div>
        ) : vencimientos.membresias.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">✓</div>
            <h3>No hay membresías para mostrar</h3>
            <p>
              {vencimientos.filtro === "proximas"
                ? `Ninguna membresía vence en los próximos ${vencimientos.dias} días.`
                : vencimientos.filtro === "vencidas"
                  ? "No hay membresías vencidas."
                  : "No hay membresías vencidas ni próximas a vencer."}
            </p>
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th>Vence</th>
                  <th>Tiempo restante</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {vencimientos.membresias.map((membresia) => (
                  <tr key={membresia.id}>
                    <td data-label="Usuario">
                      <div className="celda-usuario">
                        <span className="avatar">
                          {membresia.usuario_nombre.charAt(0).toUpperCase()}
                        </span>
                        <span>{membresia.usuario_nombre}</span>
                      </div>
                    </td>
                    <td data-label="Documento">{membresia.usuario_documento}</td>
                    <td data-label="Tipo">{membresia.tipo}</td>
                    <td data-label="Vence">{formatearFecha(membresia.fecha_fin)}</td>
                    <td data-label="Tiempo restante">{textoDias(membresia)}</td>
                    <td data-label="Estado">
                      <EstadoMembresia estado={membresia.estado} />
                    </td>
                    <td data-label="Acciones">
                      <div className="acciones-tabla">
                        {["Próxima a vencer", "Vencida"].includes(membresia.estado) && (
                          <button
                            className="boton-estado"
                            type="button"
                            onClick={() => generarAlerta(membresia)}
                            disabled={alertandoId !== null || membresia.alerta_generada}
                          >
                            {alertandoId === membresia.id
                              ? "Generando..."
                              : membresia.alerta_generada
                                ? "Alerta generada"
                                : "Generar alerta"}
                          </button>
                        )}

                        <button
                          className="boton-editar"
                          type="button"
                          onClick={() =>
                            verDetalle(membresia.usuario_id, { avisar: false, desplazar: true })
                          }
                        >
                          Ver / renovar
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
              <span className="sobretitulo">Listado</span>
              <h2>Todas las membresías</h2>
            </div>

            <span className="contador">
              {lista.resumen.total} {lista.resumen.total === 1 ? "membresía" : "membresías"}
            </span>
          </div>
        </div>

        {cargando ? (
          <div className="vacio">
            <h3>Cargando membresías...</h3>
          </div>
        ) : errorCarga ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">!</div>
            <h3>No se pudieron cargar las membresías</h3>
            <p>{errorCarga}</p>
            <button className="boton-secundario boton-compacto" type="button" onClick={cargarListado}>
              Reintentar
            </button>
          </div>
        ) : lista.membresias.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">＋</div>
            <h3>Todavía no hay membresías</h3>
            <p>Registra la primera con el formulario de arriba.</p>
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th>Inicio</th>
                  <th>Vence</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {lista.membresias.map((membresia) => (
                  <tr key={membresia.id}>
                    <td data-label="Usuario">
                      <div className="celda-usuario">
                        <span className="avatar">
                          {membresia.usuario_nombre.charAt(0).toUpperCase()}
                        </span>
                        <span>{membresia.usuario_nombre}</span>
                      </div>
                    </td>
                    <td data-label="Documento">{membresia.usuario_documento}</td>
                    <td data-label="Tipo">{membresia.tipo}</td>
                    <td data-label="Inicio">{formatearFecha(membresia.fecha_inicio)}</td>
                    <td data-label="Vence">{formatearFecha(membresia.fecha_fin)}</td>
                    <td data-label="Estado">
                      <EstadoMembresia estado={membresia.estado} />
                    </td>
                    <td data-label="Acciones">
                      <div className="acciones-tabla">
                        <button
                          className="boton-editar"
                          type="button"
                          onClick={() =>
                            verDetalle(membresia.usuario_id, { avisar: false, desplazar: true })
                          }
                        >
                          Ver / renovar
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

export default MembresiasPage;
