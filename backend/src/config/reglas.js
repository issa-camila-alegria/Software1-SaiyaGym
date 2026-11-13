// Reglas de negocio y límites del sistema, en UN solo lugar.
// Ningún servicio ni repositorio escribe estos valores a mano: todos los
// importan de aquí. Para cambiar una regla (por ejemplo, cuántos días antes
// de vencer se avisa) basta con editar este archivo.
//
// Los textos que ven los usuarios se arman con estos mismos valores, así el
// mensaje y la validación nunca se contradicen.
//
// Las credenciales y datos de despliegue NO van aquí: están en env.js (.env).

// ---------------------------------------------------------------- Perfiles
export const ROLES = ["administrador", "entrenador", "usuario"];
export const ROL_POR_DEFECTO = "usuario";
export const ESTADOS_USUARIO = ["Activo", "Inactivo"];

/** Tabla del subtipo según el rol (herencia de tablas en PostgreSQL). */
export const TABLA_POR_ROL = {
  administrador: "administradores",
  entrenador: "entrenadores",
  usuario: "usuarios",
};

/** Qué parte de la API puede usar cada perfil (ver app.js). */
export const ACCESO_API = {
  usuarios: "administrador",
  pagos: "administrador",
  membresias: "administrador",
  rutinas: "entrenador",
  asignaciones: "entrenador",
  "mi-rutina": "usuario",
  "mis-pagos": "usuario",
  "mi-membresia": "usuario",
  "mi-asistencia": "usuario",
};

// ---------------------------------------------------------------- Usuarios
export const USUARIO = {
  nombreMax: 120,
  correoMax: 120,
  documento: { min: 4, max: 20 },
  telefono: { min: 7, max: 20 },
  etiquetas: {
    nombre: "Nombre completo",
    documento: "Número de documento",
    telefono: "Teléfono",
    correo: "Correo electrónico",
  },
};

export const PATRON_DOCUMENTO = new RegExp(
  `^[A-Za-z0-9]{${USUARIO.documento.min},${USUARIO.documento.max}}$`
);
export const PATRON_TELEFONO = new RegExp(
  `^\\+?[0-9\\s-]{${USUARIO.telefono.min},${USUARIO.telefono.max}}$`
);
export const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ------------------------------------------------------------- Contraseñas
export const CONTRASENA = { min: 8, max: 72, rondasBcrypt: 10 };

export const PATRON_CONTRASENA = new RegExp(
  `^(?=.*[A-Za-z])(?=.*\\d).{${CONTRASENA.min},${CONTRASENA.max}}$`
);

export const MENSAJE_CONTRASENA = `La contraseña debe tener entre ${CONTRASENA.min} y ${CONTRASENA.max} caracteres, con al menos una letra y un número.`;

// Freno contra adivinar contraseñas: máximo de fallos por documento + IP.
export const LIMITE_INTENTOS = { maxFallos: 8, ventanaMs: 15 * 60 * 1000 };

// ----------------------------------------------------------------- Rutinas
export const RUTINA = {
  nombreMax: 120,
  objetivoMax: 255,
  ejercicio: { nombreMax: 120, series: { min: 1, max: 20 }, repeticiones: { min: 1, max: 200 } },
};

// ------------------------------------------------------------------- Pagos
/** NUMERIC(12,2): el valor más grande que cabe en la base de datos. */
export const VALOR_MAXIMO = 9999999999.99;
export const CONCEPTO_POR_DEFECTO = "Mensualidad";
export const PATRON_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

// ------------------------------------------------------------- Membresías
/** Tipos de membresía y su duración en meses. */
export const MESES_POR_TIPO = { Mensual: 1, Trimestral: 3, Semestral: 6, Anual: 12 };

/** Se marca "Próxima a vencer" cuando faltan estos días o menos. */
export const DIAS_PROXIMA_A_VENCER = 5;

/** Solo se puede renovar si vence en este número de días o menos (o ya venció). */
export const DIAS_PARA_RENOVAR = 30;

/** Máximo de días que se puede consultar hacia adelante en vencimientos. */
export const DIAS_MAXIMOS_CONSULTA = 365;

export const FILTROS_VENCIMIENTO = ["proximas", "vencidas", "todas"];

/** Estados de membresía que permiten usar el gimnasio. */
export const ESTADOS_MEMBRESIA_VIGENTE = ["Activa", "Próxima a vencer"];

// -------------------------------------------------------------- Asistencia
/** Máximo de registros de asistencia que devuelve el historial. */
export const LIMITE_HISTORIAL_ASISTENCIA = 366;

// ---------------------------------------------------------------- Servidor
export const LIMITE_CUERPO_JSON = "100kb";

// -------------------------------------------------------------- Datos demo
// Solo para pruebas y demostración (npm run db:seed): nunca se usan en producción real.
export const DEMO = {
  contrasena: "Saiya2026",
  documentos: ["10000001", "10000002", "10000003", "10000004"],
};
