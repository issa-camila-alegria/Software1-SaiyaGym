import { useCallback, useEffect, useMemo, useState } from "react";
import { api, configurarSesion } from "../services/api.js";
import { AuthContext } from "./AuthContext.js";
import { borrarToken, guardarToken, leerToken } from "./sesion.js";

export default function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [validando, setValidando] = useState(() => Boolean(leerToken()));
  const [avisoSesion, setAvisoSesion] = useState(null);

  const cerrarSesion = useCallback(() => {
    borrarToken();
    configurarSesion({ token: null });
    setUsuario(null);
  }, []);

  // Si el servidor dice que la sesión ya no sirve, se vuelve al login con un aviso.
  const sesionVencida = useCallback(() => {
    cerrarSesion();
    setAvisoSesion("Tu sesión no es válida o expiró. Inicia sesión de nuevo.");
  }, [cerrarSesion]);

  // Al abrir la app: si hay token guardado se comprueba con el servidor.
  useEffect(() => {
    const token = leerToken();
    configurarSesion({ token, alVencer: sesionVencida });
    if (!token) return undefined;

    let vigente = true;
    api.auth
      .yo()
      .then((r) => {
        if (vigente) setUsuario(r.data);
      })
      .catch(() => {
        if (!vigente) return;
        borrarToken();
        configurarSesion({ token: null, alVencer: sesionVencida });
      })
      .finally(() => {
        if (vigente) setValidando(false);
      });

    return () => {
      vigente = false;
    };
  }, [sesionVencida]);

  const iniciarSesion = useCallback(
    async (documento, contrasena) => {
      const r = await api.auth.login(documento, contrasena);
      guardarToken(r.data.token);
      configurarSesion({ token: r.data.token, alVencer: sesionVencida });
      setAvisoSesion(null);
      setUsuario(r.data.usuario);
    },
    [sesionVencida]
  );

  const valor = useMemo(
    () => ({ usuario, validando, avisoSesion, iniciarSesion, cerrarSesion }),
    [usuario, validando, avisoSesion, iniciarSesion, cerrarSesion]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
