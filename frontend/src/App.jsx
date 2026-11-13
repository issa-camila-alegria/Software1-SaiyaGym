import { useCallback, useState } from "react";
import "./App.css";
import { useAuth } from "./auth/useAuth.js";
import logoPequeno from "./assets/logo-pequeno.png";
import Mensaje from "./components/Mensaje.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import MembresiasPage from "./pages/MembresiasPage.jsx";
import MiMembresiaPage from "./pages/MiMembresiaPage.jsx";
import MiRutinaPage from "./pages/MiRutinaPage.jsx";
import MisPagosPage from "./pages/MisPagosPage.jsx";
import PagosPage from "./pages/PagosPage.jsx";
import RutinasPage from "./pages/RutinasPage.jsx";
import UsuariosPage from "./pages/UsuariosPage.jsx";

// Cada perfil tiene su propio programa: solo ve las pantallas de esta lista.
// (El servidor también lo exige: ocultar botones no basta como seguridad.)
const modulosPorRol = {
  administrador: [
    { id: "usuarios", nombre: "Usuarios", sprint: 1, Pagina: UsuariosPage },
    { id: "pagos", nombre: "Pagos", sprint: 3, Pagina: PagosPage },
    { id: "membresias", nombre: "Membresías", sprint: 4, Pagina: MembresiasPage },
  ],
  entrenador: [
    { id: "rutinas", nombre: "Rutinas", sprint: 2, Pagina: RutinasPage },
  ],
  usuario: [
    { id: "mi-rutina", nombre: "Mi rutina", sprint: 2, Pagina: MiRutinaPage },
    { id: "mis-pagos", nombre: "Mis pagos", sprint: 3, Pagina: MisPagosPage },
    { id: "mi-membresia", nombre: "Mi membresía", sprint: 4, Pagina: MiMembresiaPage },
  ],
};

const nombreRol = {
  administrador: "Administrador",
  entrenador: "Entrenador",
  usuario: "Usuario",
};

function Programa({ usuario, cerrarSesion }) {
  const modulos = modulosPorRol[usuario.rol] || [];
  const [moduloActivo, setModuloActivo] = useState(modulos[0]?.id);
  const [mensaje, setMensaje] = useState(null);

  // Cada llamada crea un objeto nuevo para que el aviso se reinicie.
  const notificar = useCallback((tipo, texto) => {
    setMensaje({ tipo, texto });
  }, []);

  const cerrarMensaje = useCallback(() => setMensaje(null), []);

  const cambiarModulo = (id) => {
    setModuloActivo(id);
    setMensaje(null);
  };

  const modulo = modulos.find((item) => item.id === moduloActivo);

  if (!modulo) {
    return (
      <div className="app">
        <main className="contenido">
          <section className="tarjeta">
            <p>Tu perfil no tiene pantallas disponibles.</p>
            <button className="boton-secundario" type="button" onClick={cerrarSesion}>
              Cerrar sesión
            </button>
          </section>
        </main>
      </div>
    );
  }

  const Pagina = modulo.Pagina;

  return (
    <div className="app">
      <Mensaje mensaje={mensaje} onCerrar={cerrarMensaje} />

      <header className="encabezado">
        <div className="marca">
          <img className="marca-logo" src={logoPequeno} alt="Logo de SAIYAGYM" />

          <div>
            <h1>SAIYAGYM</h1>
            <p>SISTEMA DE GESTIÓN PARA GIMNASIOS</p>
          </div>
        </div>

        {modulos.length > 1 && (
          <nav className="navegacion" aria-label="Módulos del sistema">
            {modulos.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`navegacion-item ${
                  item.id === moduloActivo ? "activa" : ""
                }`}
                aria-current={item.id === moduloActivo ? "page" : undefined}
                onClick={() => cambiarModulo(item.id)}
              >
                <span>{item.nombre}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="sesion">
          <div className="sesion-datos">
            <strong>{usuario.nombre}</strong>
            <small>{nombreRol[usuario.rol]}</small>
          </div>

          <button
            type="button"
            className="boton-secundario boton-compacto"
            onClick={cerrarSesion}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="contenido">
        <Pagina notificar={notificar} />

        <footer className="pie-pagina">
          <span>SAIYAGYM</span>
          <span>{modulo.nombre}</span>
        </footer>
      </main>
    </div>
  );
}

function App() {
  const { usuario, validando, cerrarSesion } = useAuth();

  if (validando) {
    return (
      <main className="login-pagina">
        <p className="cargando">Verificando sesión...</p>
      </main>
    );
  }

  if (!usuario) return <LoginPage />;

  // key: al cambiar de usuario se reinicia todo el estado de las pantallas.
  return <Programa key={usuario.id} usuario={usuario} cerrarSesion={cerrarSesion} />;
}

export default App;
