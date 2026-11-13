import { useCallback, useEffect, useRef, useState } from "react";
import DetalleRutina from "../components/DetalleRutina.jsx";
import { useAuth } from "../auth/useAuth.js";
import { ESTADO_INACTIVO, LIMITES_EJERCICIO } from "../config/constantes.js";
import { api } from "../services/api.js";

const asignacionInicial = { usuario_id: "", rutina_id: "" };

// Rutinas y usuarios a quienes se puede asignar, en paralelo.
const pedirDatos = () =>
  Promise.all([api.rutinas.listar(), api.asignaciones.usuarios()]);

// Sprint 2 - E2: crear, modificar y asignar rutinas (vista del entrenador).
function RutinasPage({ notificar }) {
  const { usuario: entrenadorActual } = useAuth();
  const [rutinas, setRutinas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  // Formulario de rutina
  const contadorEjercicios = useRef(1);
  const crearEjercicioVacio = () => {
    contadorEjercicios.current += 1;
    return { clave: contadorEjercicios.current, nombre: "", series: "", repeticiones: "" };
  };

  const [formulario, setFormulario] = useState({
    nombre: "",
    objetivo: "",
    ejercicios: [{ clave: 1, nombre: "", series: "", repeticiones: "" }],
  });
  const [editando, setEditando] = useState(null);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  // Detalle y asignación
  const [detalle, setDetalle] = useState(null);
  const [asignacion, setAsignacion] = useState(asignacionInicial);
  const [erroresAsignacion, setErroresAsignacion] = useState({});
  const [asignando, setAsignando] = useState(false);

  const cargarRutinas = useCallback(async () => {
    const respuesta = await api.rutinas.listar();
    setRutinas(respuesta.data);
  }, []);

  const aplicarDatos = useCallback(([listaRutinas, listaUsuarios]) => {
    setRutinas(listaRutinas.data);
    setUsuarios(listaUsuarios.data);
    setErrorCarga(null);
  }, []);

  // Recarga manual (botón "Reintentar" o tras un error).
  const cargarTodo = useCallback(async () => {
    try {
      aplicarDatos(await pedirDatos());
    } catch (error) {
      setErrorCarga(error.message);
    } finally {
      setCargando(false);
    }
  }, [aplicarDatos]);

  // Carga inicial al abrir el módulo.
  useEffect(() => {
    let vigente = true;

    pedirDatos()
      .then((datos) => {
        if (vigente) aplicarDatos(datos);
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
  }, [aplicarDatos]);

  const reiniciarFormulario = () => {
    contadorEjercicios.current += 1;

    setFormulario({
      nombre: "",
      objetivo: "",
      ejercicios: [
        {
          clave: contadorEjercicios.current,
          nombre: "",
          series: "",
          repeticiones: "",
        },
      ],
    });
    setEditando(null);
    setErrores({});
  };

  const manejarCambio = (e) => {
    const { name, value } = e.target;

    setFormulario((anterior) => ({ ...anterior, [name]: value }));
    setErrores((anteriores) => ({ ...anteriores, [name]: false }));
  };

  const cambiarEjercicio = (clave, campo, valor) => {
    setFormulario((anterior) => ({
      ...anterior,
      ejercicios: anterior.ejercicios.map((ejercicio) =>
        ejercicio.clave === clave ? { ...ejercicio, [campo]: valor } : ejercicio
      ),
    }));
    setErrores((anteriores) => ({ ...anteriores, ejercicios: false }));
  };

  const agregarEjercicio = () => {
    setFormulario((anterior) => ({
      ...anterior,
      ejercicios: [...anterior.ejercicios, crearEjercicioVacio()],
    }));
  };

  const quitarEjercicio = (clave) => {
    setFormulario((anterior) => ({
      ...anterior,
      ejercicios: anterior.ejercicios.filter(
        (ejercicio) => ejercicio.clave !== clave
      ),
    }));
  };

  const guardarRutina = async (e) => {
    e.preventDefault();
    if (guardando) return;

    setGuardando(true);
    setErrores({});

    const datos = {
      nombre: formulario.nombre,
      objetivo: formulario.objetivo,
      ejercicios: formulario.ejercicios.map(
        ({ nombre, series, repeticiones }) => ({ nombre, series, repeticiones })
      ),
    };

    try {
      const respuesta =
        editando !== null
          ? await api.rutinas.actualizar(editando, datos)
          : await api.rutinas.crear(datos);

      notificar("exito", respuesta.mensaje);
      setDetalle(respuesta.data);
      reiniciarFormulario();
      await cargarRutinas();
    } catch (error) {
      setErrores(
        Object.fromEntries((error.campos || []).map((campo) => [campo, true]))
      );
      notificar("error", error.message);

      if (error.codigo === "RUTINA_NO_ENCONTRADA") {
        reiniciarFormulario();
        await cargarTodo();
      }
    } finally {
      setGuardando(false);
    }
  };

  const editarRutina = async (id) => {
    try {
      const { data } = await api.rutinas.obtener(id);

      setFormulario({
        nombre: data.nombre,
        objetivo: data.objetivo,
        ejercicios: data.ejercicios.map((ejercicio) => {
          contadorEjercicios.current += 1;

          return {
            clave: contadorEjercicios.current,
            nombre: ejercicio.nombre,
            series: String(ejercicio.series),
            repeticiones: String(ejercicio.repeticiones),
          };
        }),
      });
      setEditando(id);
      setErrores({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      notificar("error", error.message);
      await cargarTodo();
    }
  };

  const verRutina = async (id) => {
    try {
      const { data } = await api.rutinas.obtener(id);
      setDetalle(data);
    } catch (error) {
      notificar("error", error.message);
      await cargarTodo();
    }
  };

  const manejarCambioAsignacion = (e) => {
    const { name, value } = e.target;

    setAsignacion((anterior) => ({ ...anterior, [name]: value }));
    setErroresAsignacion((anteriores) => ({ ...anteriores, [name]: false }));
  };

  const asignarRutina = async (e) => {
    e.preventDefault();
    if (asignando) return;

    setAsignando(true);
    setErroresAsignacion({});

    try {
      const respuesta = await api.asignaciones.asignar(asignacion);

      notificar("exito", respuesta.mensaje);
      setAsignacion(asignacionInicial);
      await cargarRutinas();
    } catch (error) {
      setErroresAsignacion(
        Object.fromEntries((error.campos || []).map((campo) => [campo, true]))
      );
      notificar("error", error.message);
    } finally {
      setAsignando(false);
    }
  };

  return (
    <>
      <section className="bienvenida">
        <div>
          <span className="sobretitulo">Panel del entrenador</span>
          <h2>Gestión de rutinas</h2>
          <p>
            Crea rutinas de entrenamiento, ajústalas según el progreso
            y asígnalas a los usuarios del gimnasio.
          </p>
        </div>

        <div className="bienvenida-icono" aria-hidden="true">
          <span>SG</span>
        </div>
      </section>

      {errorCarga && (
        <section className="tarjeta">
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">!</div>
            <h3>No se pudo cargar la información</h3>
            <p>{errorCarga}</p>
            <button
              className="boton-secundario boton-compacto"
              type="button"
              onClick={cargarTodo}
            >
              Reintentar
            </button>
          </div>
        </section>
      )}

      <section className="tarjeta">
        <div className="encabezado-tarjeta">
          <div>
            <span className="sobretitulo">
              {editando !== null ? "Modificación" : "Nueva rutina"}
            </span>

            <h2>
              {editando !== null ? "Modificar rutina" : "Crear rutina"}
            </h2>
          </div>

          <span className="numero-seccion">01</span>
        </div>

        <form onSubmit={guardarRutina} className="formulario" noValidate>
          <label className={errores.nombre ? "campo-error" : ""}>
            Nombre de la rutina
            <input
              type="text"
              name="nombre"
              placeholder="Ej. Fuerza tren superior"
              value={formulario.nombre}
              onChange={manejarCambio}
              aria-invalid={Boolean(errores.nombre)}
            />
          </label>

          <label>
            Entrenador
            <input type="text" value={entrenadorActual.nombre} readOnly />
          </label>

          <label
            className={`campo-completo ${errores.objetivo ? "campo-error" : ""}`}
          >
            Objetivo
            <input
              type="text"
              name="objetivo"
              placeholder="Ej. Ganar fuerza y masa muscular"
              value={formulario.objetivo}
              onChange={manejarCambio}
              aria-invalid={Boolean(errores.objetivo)}
            />
          </label>

          <fieldset
            className={`ejercicios ${errores.ejercicios ? "campo-error-bloque" : ""}`}
          >
            <legend>Ejercicios de la rutina</legend>

            {formulario.ejercicios.map((ejercicio, indice) => (
              <div className="fila-ejercicio" key={ejercicio.clave}>
                <label>
                  Ejercicio {indice + 1}
                  <input
                    type="text"
                    placeholder="Ej. Press banca"
                    value={ejercicio.nombre}
                    onChange={(e) =>
                      cambiarEjercicio(ejercicio.clave, "nombre", e.target.value)
                    }
                  />
                </label>

                <label>
                  Series
                  <input
                    type="number"
                    min={LIMITES_EJERCICIO.series.min}
                    max={LIMITES_EJERCICIO.series.max}
                    inputMode="numeric"
                    placeholder="4"
                    value={ejercicio.series}
                    onChange={(e) =>
                      cambiarEjercicio(ejercicio.clave, "series", e.target.value)
                    }
                  />
                </label>

                <label>
                  Repeticiones
                  <input
                    type="number"
                    min={LIMITES_EJERCICIO.repeticiones.min}
                    max={LIMITES_EJERCICIO.repeticiones.max}
                    inputMode="numeric"
                    placeholder="10"
                    value={ejercicio.repeticiones}
                    onChange={(e) =>
                      cambiarEjercicio(
                        ejercicio.clave,
                        "repeticiones",
                        e.target.value
                      )
                    }
                  />
                </label>

                <button
                  type="button"
                  className="boton-quitar"
                  onClick={() => quitarEjercicio(ejercicio.clave)}
                  aria-label={`Quitar ejercicio ${indice + 1}`}
                >
                  ×
                </button>
              </div>
            ))}

            <button
              type="button"
              className="boton-agregar"
              onClick={agregarEjercicio}
            >
              + Agregar ejercicio
            </button>
          </fieldset>

          <div className="acciones-formulario">
            <button
              className="boton-principal"
              type="submit"
              disabled={guardando}
            >
              {guardando
                ? "Guardando..."
                : editando !== null
                  ? "Guardar cambios"
                  : "Registrar rutina"}
            </button>

            {editando !== null && (
              <button
                className="boton-secundario"
                type="button"
                onClick={reiniciarFormulario}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      {detalle && (
        <section className="tarjeta">
          <div className="encabezado-tarjeta">
            <div>
              <span className="sobretitulo">Detalle de la rutina</span>
              <h2>{detalle.nombre}</h2>
            </div>

            <button
              type="button"
              className="boton-secundario boton-compacto"
              onClick={() => setDetalle(null)}
            >
              Cerrar
            </button>
          </div>

          <DetalleRutina rutina={detalle} />
        </section>
      )}

      <section className="tarjeta">
        <div className="encabezado-tarjeta">
          <div>
            <span className="sobretitulo">Asignación</span>
            <h2>Asignar rutina a un usuario</h2>
          </div>

          <span className="numero-seccion">02</span>
        </div>

        <form onSubmit={asignarRutina} className="formulario" noValidate>
          <label className={erroresAsignacion.usuario_id ? "campo-error" : ""}>
            Usuario
            <select
              name="usuario_id"
              value={asignacion.usuario_id}
              onChange={manejarCambioAsignacion}
              aria-invalid={Boolean(erroresAsignacion.usuario_id)}
            >
              <option value="">Selecciona un usuario</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre} · {usuario.documento}
                  {usuario.estado === ESTADO_INACTIVO ? " (inactivo)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className={erroresAsignacion.rutina_id ? "campo-error" : ""}>
            Rutina
            <select
              name="rutina_id"
              value={asignacion.rutina_id}
              onChange={manejarCambioAsignacion}
              aria-invalid={Boolean(erroresAsignacion.rutina_id)}
            >
              <option value="">Selecciona una rutina</option>
              {rutinas.map((rutina) => (
                <option key={rutina.id} value={rutina.id}>
                  {rutina.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="acciones-formulario">
            <button
              className="boton-principal"
              type="submit"
              disabled={asignando}
            >
              {asignando ? "Asignando..." : "Asignar rutina"}
            </button>
          </div>
        </form>
      </section>

      <section className="tarjeta">
        <div className="encabezado-listado">
          <div className="titulo-listado">
            <div>
              <span className="sobretitulo">Catálogo</span>
              <h2>Rutinas registradas</h2>
            </div>

            <span className="contador">
              {rutinas.length} {rutinas.length === 1 ? "rutina" : "rutinas"}
            </span>
          </div>
        </div>

        {cargando ? (
          <div className="vacio">
            <h3>Cargando rutinas...</h3>
          </div>
        ) : rutinas.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">＋</div>
            <h3>Todavía no hay rutinas</h3>
            <p>Crea la primera rutina de entrenamiento con el formulario.</p>
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Rutina</th>
                  <th>Objetivo</th>
                  <th>Entrenador</th>
                  <th>Ejercicios</th>
                  <th>Asignada a</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {rutinas.map((rutina) => (
                  <tr key={rutina.id}>
                    <td data-label="Rutina">
                      <strong>{rutina.nombre}</strong>
                    </td>
                    <td data-label="Objetivo">{rutina.objetivo}</td>
                    <td data-label="Entrenador">{rutina.entrenador_nombre}</td>
                    <td data-label="Ejercicios">{rutina.total_ejercicios}</td>
                    <td data-label="Asignada a">
                      {rutina.usuarios_asignados}{" "}
                      {rutina.usuarios_asignados === 1 ? "usuario" : "usuarios"}
                    </td>
                    <td data-label="Acciones">
                      <div className="acciones-tabla">
                        <button
                          className="boton-editar"
                          type="button"
                          disabled={rutina.entrenador_id !== entrenadorActual.id}
                          title={
                            rutina.entrenador_id !== entrenadorActual.id
                              ? "Solo quien creó la rutina puede modificarla."
                              : undefined
                          }
                          onClick={() => editarRutina(rutina.id)}
                        >
                          Modificar
                        </button>

                        <button
                          className="boton-estado"
                          type="button"
                          onClick={() => verRutina(rutina.id)}
                        >
                          Ver
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

export default RutinasPage;
