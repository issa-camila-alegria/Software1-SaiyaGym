import { useCallback, useEffect, useState } from "react";
import DetalleRutina from "../components/DetalleRutina.jsx";
import { api } from "../services/api.js";
import { formatearFecha } from "../utils/formato.js";

// Sprint 2 - E2-HU4: el usuario consulta SU rutina asignada.
// El servidor identifica al usuario por su sesión: no puede pedir la de otro.
function MiRutinaPage() {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [resultado, setResultado] = useState(null); // { rutina, fecha_asignacion }
  const [aviso, setAviso] = useState(null); // { titulo, texto }

  const aplicarError = useCallback((error) => {
    if (error.codigo === "SIN_RUTINA") {
      setAviso({ titulo: "Sin rutina asignada", texto: error.message });
    } else if (error.codigo === "RUTINA_NO_DISPONIBLE") {
      setAviso({ titulo: "Rutina no disponible", texto: error.message });
    } else {
      setErrorCarga(error.message);
    }
  }, []);

  // Recarga manual (botones "Actualizar" y "Reintentar").
  const consultar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    setAviso(null);

    try {
      const respuesta = await api.miRutina.consultar();
      setResultado(respuesta.data);
    } catch (error) {
      setResultado(null);
      aplicarError(error);
    } finally {
      setCargando(false);
    }
  }, [aplicarError]);

  // Carga inicial al abrir la pantalla.
  useEffect(() => {
    let vigente = true;

    api.miRutina
      .consultar()
      .then((respuesta) => {
        if (vigente) setResultado(respuesta.data);
      })
      .catch((error) => {
        if (vigente) aplicarError(error);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [aplicarError]);

  return (
    <>
      <section className="bienvenida">
        <div>
          <span className="sobretitulo">Panel del usuario</span>
          <h2>Mi rutina</h2>
          <p>
            Consulta los ejercicios que debes realizar según la rutina
            que te asignó tu entrenador.
          </p>
        </div>

        <div className="bienvenida-icono" aria-hidden="true">
          <span>SG</span>
        </div>
      </section>

      {cargando && (
        <section className="tarjeta">
          <p className="cargando">Cargando tu rutina...</p>
        </section>
      )}

      {!cargando && errorCarga && (
        <section className="tarjeta">
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">!</div>
            <h3>No se pudo cargar tu rutina</h3>
            <p>{errorCarga}</p>
            <button
              className="boton-secundario boton-compacto"
              type="button"
              onClick={consultar}
            >
              Reintentar
            </button>
          </div>
        </section>
      )}

      {!cargando && aviso && (
        <section className="tarjeta">
          <div className="vacio">
            <div className="vacio-icono" aria-hidden="true">i</div>
            <h3>{aviso.titulo}</h3>
            <p>{aviso.texto}</p>
            <button
              className="boton-secundario boton-compacto"
              type="button"
              onClick={consultar}
            >
              Actualizar
            </button>
          </div>
        </section>
      )}

      {!cargando && resultado && (
        <section className="tarjeta">
          <div className="encabezado-tarjeta">
            <div>
              <span className="sobretitulo">Tu rutina actual</span>
              <h2>{resultado.rutina.nombre}</h2>
            </div>

            <span className="contador">
              Asignada el {formatearFecha(resultado.fecha_asignacion)}
            </span>
          </div>

          <DetalleRutina rutina={resultado.rutina} />

          <div className="acciones-formulario">
            <button
              className="boton-secundario boton-compacto"
              type="button"
              onClick={consultar}
            >
              Actualizar
            </button>
          </div>
        </section>
      )}
    </>
  );
}

export default MiRutinaPage;
