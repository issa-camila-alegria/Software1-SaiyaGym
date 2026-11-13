import { useState } from "react";
import { useAuth } from "../auth/useAuth.js";
import logo from "../assets/logo.png";

// Pantalla de ingreso. Es lo único que se ve sin haber iniciado sesión.
function LoginPage() {
  const { iniciarSesion, avisoSesion } = useAuth();
  const [documento, setDocumento] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [verContrasena, setVerContrasena] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;

    if (!documento.trim() || !contrasena) {
      setError("Ingresa tu documento y tu contraseña.");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      await iniciarSesion(documento, contrasena);
    } catch (falla) {
      setError(falla.message);
      setEnviando(false);
    }
  };

  return (
    <main className="login-pagina">
      <section className="login-tarjeta">
        <div className="login-marca">
          <img className="login-logo" src={logo} alt="Logo de SAIYAGYM: fuerza y bienestar" />
          <h1>SAIYAGYM</h1>
          <p>SISTEMA DE GESTIÓN PARA GIMNASIOS</p>
          <span className="login-lema">Fuerza y bienestar, en un solo lugar.</span>
        </div>

        <div className="login-panel">

        <h2>Iniciar sesión</h2>

        {avisoSesion && !error && (
          <p className="aviso" role="status">
            {avisoSesion}
          </p>
        )}

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={enviar} className="login-formulario" noValidate>
          <label>
            Documento
            <input
              type="text"
              name="documento"
              inputMode="text"
              autoComplete="username"
              autoFocus
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
            />
          </label>

          <label>
            Contraseña
            <div className="campo-contrasena">
              <input
                type={verContrasena ? "text" : "password"}
                name="contrasena"
                autoComplete="current-password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
              />
              <button
                type="button"
                className="boton-ver"
                onClick={() => setVerContrasena((v) => !v)}
                aria-pressed={verContrasena}
              >
                {verContrasena ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>

          <button className="boton-principal" type="submit" disabled={enviando}>
            {enviando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="login-ayuda">
          ¿No tienes acceso? Solicítalo al administrador del gimnasio.
        </p>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
