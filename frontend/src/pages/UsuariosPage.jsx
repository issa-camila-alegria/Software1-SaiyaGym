import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth.js";
import { api } from "../services/api.js";

const ROLES = [
  { valor: "usuario", etiqueta: "Usuario" },
  { valor: "entrenador", etiqueta: "Entrenador" },
  { valor: "administrador", etiqueta: "Administrador" },
];

const etiquetaRol = Object.fromEntries(
  ROLES.map((rol) => [rol.valor, rol.etiqueta])
);

const formularioInicial = {
  nombre: "",
  documento: "",
  telefono: "",
  correo: "",
  rol: "usuario",
  contrasena: "",
};

// Sprint 1 - E1: registrar, consultar, actualizar y gestionar el estado.
// Las reglas de negocio las valida el backend; aquí solo se muestran
// los mensajes que devuelve la API.
function UsuariosPage({ notificar }) {
  const { usuario: sesion } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [resumen, setResumen] = useState({ total: 0, activos: 0, inactivos: 0 });
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  const [textoBusqueda, setTextoBusqueda] = useState("");
  const [busquedaActiva, setBusquedaActiva] = useState("");

  const [formulario, setFormulario] = useState(formularioInicial);
  const [editando, setEditando] = useState(null);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async (buscar) => {
    try {
      const respuesta = await api.usuarios.listar(buscar ? { buscar } : {});
      setUsuarios(respuesta.data);
      setResumen(respuesta.meta.resumen);
      setErrorCarga(null);
    } catch (error) {
      setErrorCarga(error.message);
    } finally {
      setCargando(false);
    }
  }, []);

  // Carga inicial del directorio al abrir el módulo.
  useEffect(() => {
    let vigente = true;

    api.usuarios
      .listar()
      .then((respuesta) => {
        if (!vigente) return;
        setUsuarios(respuesta.data);
        setResumen(respuesta.meta.resumen);
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

  const limpiarFormulario = () => {
    setFormulario(formularioInicial);
    setEditando(null);
    setErrores({});
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();
    if (guardando) return;

    setGuardando(true);
    setErrores({});

    try {
      const respuesta =
        editando !== null
          ? await api.usuarios.actualizar(editando, formulario)
          : await api.usuarios.registrar(formulario);

      notificar("exito", respuesta.mensaje);
      limpiarFormulario();
      await cargar(busquedaActiva);
    } catch (error) {
      setErrores(
        Object.fromEntries((error.campos || []).map((campo) => [campo, true]))
      );
      notificar("error", error.message);

      if (error.codigo === "USUARIO_NO_ENCONTRADO") {
        limpiarFormulario();
        await cargar(busquedaActiva);
      }
    } finally {
      setGuardando(false);
    }
  };

  const editarUsuario = (usuario) => {
    setFormulario({
      nombre: usuario.nombre,
      documento: usuario.documento,
      telefono: usuario.telefono,
      correo: usuario.correo,
      rol: usuario.rol,
      contrasena: "", // vacía = se conserva la contraseña actual
    });

    setEditando(usuario.id);
    setErrores({});

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cambiarEstado = async (usuario) => {
    const nuevoEstado = usuario.estado === "Activo" ? "Inactivo" : "Activo";

    try {
      const respuesta = await api.usuarios.cambiarEstado(usuario.id, nuevoEstado);
      notificar("exito", respuesta.mensaje);
    } catch (error) {
      notificar("error", error.message);
    }

    await cargar(busquedaActiva);
  };

  const buscarUsuarios = async (e) => {
    e.preventDefault();

    try {
      const respuesta = await api.usuarios.listar({ buscar: textoBusqueda });
      setUsuarios(respuesta.data);
      setResumen(respuesta.meta.resumen);
      setBusquedaActiva(textoBusqueda.trim());
      setErrorCarga(null);
    } catch (error) {
      // Incluye el caso de criterio de búsqueda vacío: se avisa y se vuelve a
      // mostrar el directorio completo, para que la pantalla no quede con el
      // resultado de una búsqueda anterior ("0 usuarios") junto al aviso.
      notificar("error", error.message);
      if (!textoBusqueda.trim()) await limpiarBusqueda();
    }
  };

  const limpiarBusqueda = async () => {
    setTextoBusqueda("");
    setBusquedaActiva("");
    await cargar();
  };

  return (
    <>
      <section className="bienvenida">
        <div>
          <span className="sobretitulo">Panel administrativo</span>
          <h2>Gestión de usuarios</h2>
          <p>
            Administra y consulta la información de los usuarios
            de SAIYAGYM desde un solo lugar.
          </p>
        </div>

        <div className="bienvenida-icono" aria-hidden="true">
          <span>SG</span>
        </div>
      </section>

      <section className="resumen" aria-label="Resumen de usuarios">
        <article className="indicador">
          <span className="indicador-etiqueta">TOTAL DE USUARIOS</span>
          <strong>{resumen.total}</strong>
          <span className="indicador-descripcion">
            Registrados en el sistema
          </span>
        </article>

        <article className="indicador">
          <span className="indicador-etiqueta">USUARIOS ACTIVOS</span>
          <strong>{resumen.activos}</strong>
          <span className="indicador-descripcion">Con estado activo</span>
        </article>

        <article className="indicador">
          <span className="indicador-etiqueta">USUARIOS INACTIVOS</span>
          <strong>{resumen.inactivos}</strong>
          <span className="indicador-descripcion">Con estado inactivo</span>
        </article>
      </section>

      <section className="tarjeta">
        <div className="encabezado-tarjeta">
          <div>
            <span className="sobretitulo">
              {editando !== null ? "Edición de registro" : "Nuevo registro"}
            </span>

            <h2>
              {editando !== null ? "Actualizar usuario" : "Registrar usuario"}
            </h2>
          </div>

          <span className="numero-seccion">01</span>
        </div>

        <form onSubmit={guardarUsuario} className="formulario" noValidate>
          <label className={errores.nombre ? "campo-error" : ""}>
            Nombre completo
            <input
              type="text"
              name="nombre"
              placeholder="Ej. Camila Pérez"
              value={formulario.nombre}
              onChange={manejarCambio}
              autoComplete="name"
              aria-invalid={Boolean(errores.nombre)}
            />
          </label>

          <label className={errores.documento ? "campo-error" : ""}>
            Número de documento
            <input
              type="text"
              name="documento"
              placeholder="Ingresa el documento"
              value={formulario.documento}
              onChange={manejarCambio}
              autoComplete="off"
              aria-invalid={Boolean(errores.documento)}
            />
          </label>

          <label className={errores.telefono ? "campo-error" : ""}>
            Teléfono
            <input
              type="tel"
              name="telefono"
              placeholder="Ingresa el teléfono"
              value={formulario.telefono}
              onChange={manejarCambio}
              autoComplete="tel"
              aria-invalid={Boolean(errores.telefono)}
            />
          </label>

          <label className={errores.correo ? "campo-error" : ""}>
            Correo electrónico
            <input
              type="email"
              name="correo"
              placeholder="ejemplo@correo.com"
              value={formulario.correo}
              onChange={manejarCambio}
              autoComplete="email"
              aria-invalid={Boolean(errores.correo)}
            />
          </label>

          <label className={errores.rol ? "campo-error" : ""}>
            Rol
            <select
              name="rol"
              value={formulario.rol}
              onChange={manejarCambio}
              aria-invalid={Boolean(errores.rol)}
            >
              {ROLES.map((rol) => (
                <option key={rol.valor} value={rol.valor}>
                  {rol.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label
            className={`campo-completo ${errores.contrasena ? "campo-error" : ""}`}
          >
            {editando !== null ? "Nueva contraseña (opcional)" : "Contraseña"}
            <input
              type="password"
              name="contrasena"
              placeholder={
                editando !== null
                  ? "Déjala vacía para conservar la actual"
                  : "Mínimo 8 caracteres, con letras y números"
              }
              value={formulario.contrasena}
              onChange={manejarCambio}
              autoComplete="new-password"
              aria-invalid={Boolean(errores.contrasena)}
            />
          </label>

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
                  : "Registrar usuario"}
            </button>

            {editando !== null && (
              <button
                className="boton-secundario"
                type="button"
                onClick={limpiarFormulario}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="tarjeta">
        <div className="encabezado-listado">
          <div className="titulo-listado">
            <div>
              <span className="sobretitulo">Directorio</span>
              <h2>Usuarios registrados</h2>
            </div>

            <span className="contador">
              {usuarios.length} {usuarios.length === 1 ? "usuario" : "usuarios"}
            </span>
          </div>

          <form className="busqueda" onSubmit={buscarUsuarios}>
            <label className="buscador">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                placeholder="Buscar por nombre o documento..."
                value={textoBusqueda}
                onChange={(e) => setTextoBusqueda(e.target.value)}
                aria-label="Buscar usuarios por nombre o documento"
              />
            </label>

            <button className="boton-principal boton-compacto" type="submit">
              Buscar
            </button>

            {busquedaActiva && (
              <button
                className="boton-secundario boton-compacto"
                type="button"
                onClick={limpiarBusqueda}
              >
                Limpiar
              </button>
            )}
          </form>
        </div>

        {cargando ? (
          <div className="vacio">
            <h3>Cargando usuarios...</h3>
          </div>
        ) : errorCarga ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">!</div>
            <h3>No se pudo cargar el directorio</h3>
            <p>{errorCarga}</p>
            <button
              className="boton-secundario boton-compacto"
              type="button"
              onClick={() => cargar(busquedaActiva)}
            >
              Reintentar
            </button>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">
              {busquedaActiva ? "⌕" : "＋"}
            </div>

            <h3>
              {busquedaActiva
                ? "No encontramos coincidencias"
                : "Todavía no hay usuarios"}
            </h3>

            <p>
              {busquedaActiva
                ? "No se encontró ningún usuario con ese nombre o documento."
                : "Registra el primer usuario para comenzar a construir el directorio."}
            </p>
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Documento</th>
                  <th>Teléfono</th>
                  <th>Correo electrónico</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id}>
                    <td data-label="Usuario">
                      <div className="celda-usuario">
                        <span className="avatar">
                          {usuario.nombre.charAt(0).toUpperCase()}
                        </span>

                        <span>{usuario.nombre}</span>
                      </div>
                    </td>

                    <td data-label="Documento">{usuario.documento}</td>
                    <td data-label="Teléfono">{usuario.telefono}</td>
                    <td data-label="Correo">{usuario.correo}</td>

                    <td data-label="Rol">
                      <span className="etiqueta-rol">
                        {etiquetaRol[usuario.rol]}
                      </span>
                    </td>

                    <td data-label="Estado">
                      <span
                        className={`estado ${
                          usuario.estado === "Activo" ? "activo" : "inactivo"
                        }`}
                      >
                        <span className="estado-punto"></span>
                        {usuario.estado}
                      </span>
                    </td>

                    <td data-label="Acciones">
                      <div className="acciones-tabla">
                        <button
                          className="boton-editar"
                          type="button"
                          onClick={() => editarUsuario(usuario)}
                        >
                          Editar
                        </button>

                        <button
                          className="boton-estado"
                          type="button"
                          onClick={() => cambiarEstado(usuario)}
                          disabled={usuario.id === sesion.id}
                          title={
                            usuario.id === sesion.id
                              ? "No puedes cambiar el estado de tu propio usuario"
                              : undefined
                          }
                        >
                          {usuario.estado === "Activo" ? "Inactivar" : "Activar"}
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

export default UsuariosPage;
