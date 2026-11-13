// Capa de comunicación con la API REST (Express). Todo el acceso a datos
// del frontend pasa por aquí; los componentes no usan fetch directamente.

const BASE = import.meta.env.VITE_API_URL || "/api";

export class ApiError extends Error {
  constructor(mensaje, codigo = "ERROR", campos = [], estado = 0) {
    super(mensaje);
    this.name = "ApiError";
    this.codigo = codigo;
    this.campos = campos;
    this.estado = estado;
  }
}

// Sesión actual: la define AuthProvider (token y qué hacer si el servidor la rechaza).
let tokenActual = null;
let alVencerSesion = null;

export function configurarSesion({ token, alVencer }) {
  if (token !== undefined) tokenActual = token;
  if (alVencer !== undefined) alVencerSesion = alVencer;
}

async function solicitar(metodo, ruta, cuerpo) {
  let respuesta;

  const encabezados = { "Content-Type": "application/json" };
  if (tokenActual) encabezados.Authorization = `Bearer ${tokenActual}`;

  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: encabezados,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ApiError(
      "No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.",
      "SIN_CONEXION"
    );
  }

  let json = null;

  try {
    json = await respuesta.json();
  } catch {
    json = null;
  }

  if (!respuesta.ok || !json || json.ok !== true) {
    const detalle = json?.error;

    // Sesión inexistente o vencida (pero no un simple error de contraseña en el login).
    if (
      respuesta.status === 401 &&
      tokenActual &&
      alVencerSesion &&
      ["SESION_INVALIDA", "NO_AUTENTICADO"].includes(detalle?.codigo)
    ) {
      alVencerSesion();
    }

    throw new ApiError(
      detalle?.mensaje ||
        "El servidor no pudo procesar la solicitud. Intenta de nuevo.",
      detalle?.codigo || "ERROR",
      detalle?.campos || [],
      respuesta.status
    );
  }

  return json; // { ok, data, meta?, mensaje? }
}

function conParametros(ruta, parametros = {}) {
  const consulta = new URLSearchParams();

  Object.entries(parametros).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null) consulta.append(clave, valor);
  });

  const texto = consulta.toString();
  return texto ? `${ruta}?${texto}` : ruta;
}

export const api = {
  auth: {
    login: (documento, contrasena) =>
      solicitar("POST", "/auth/login", { documento, contrasena }),
    yo: () => solicitar("GET", "/auth/yo"),
  },
  usuarios: {
    listar: (parametros) => solicitar("GET", conParametros("/usuarios", parametros)),
    registrar: (datos) => solicitar("POST", "/usuarios", datos),
    actualizar: (id, datos) => solicitar("PUT", `/usuarios/${id}`, datos),
    cambiarEstado: (id, estado) =>
      solicitar("PATCH", `/usuarios/${id}/estado`, { estado }),
  },
  rutinas: {
    listar: () => solicitar("GET", "/rutinas"),
    obtener: (id) => solicitar("GET", `/rutinas/${id}`),
    crear: (datos) => solicitar("POST", "/rutinas", datos),
    actualizar: (id, datos) => solicitar("PUT", `/rutinas/${id}`, datos),
  },
  asignaciones: {
    asignar: (datos) => solicitar("POST", "/asignaciones", datos),
    usuarios: () => solicitar("GET", "/asignaciones/usuarios"),
  },
  miRutina: {
    consultar: () => solicitar("GET", "/mi-rutina"),
  },
  pagos: {
    registrar: (datos) => solicitar("POST", "/pagos", datos),
    listar: () => solicitar("GET", "/pagos"),
    usuarios: () => solicitar("GET", "/pagos/usuarios"),
    pendientes: (usuarioId) =>
      solicitar(
        "GET",
        conParametros("/pagos/pendientes", usuarioId ? { usuario_id: usuarioId } : {})
      ),
    generarCobro: (datos) => solicitar("POST", "/pagos/cobros", datos),
    actualizarEstado: (id, estado) =>
      solicitar("PATCH", `/pagos/cobros/${id}/estado`, { estado }),
  },
  misPagos: {
    consultar: (periodo) =>
      solicitar("GET", conParametros("/mis-pagos", periodo ? { periodo } : {})),
    pendientes: () => solicitar("GET", "/mis-pagos/pendientes"),
  },
};
