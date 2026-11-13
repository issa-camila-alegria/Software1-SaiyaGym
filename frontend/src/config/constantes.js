// Constantes de la interfaz, en UN solo lugar. Ninguna pantalla escribe estos
// valores a mano: todas los importan de aquí.
//
// IMPORTANTE: el servidor es quien manda. Las reglas de negocio reales viven en
// backend/src/config/reglas.js y el backend siempre las vuelve a validar; los
// valores de este archivo solo sirven para ayudar al usuario (límites de los
// campos, opciones de las listas). Si cambias una regla allá, cámbiala aquí.

// ---------------------------------------------------------------- Perfiles
export const ROLES = [
  { valor: "usuario", etiqueta: "Usuario" },
  { valor: "entrenador", etiqueta: "Entrenador" },
  { valor: "administrador", etiqueta: "Administrador" },
];

export const ROL_POR_DEFECTO = "usuario";

export const ETIQUETA_ROL = Object.fromEntries(
  ROLES.map((rol) => [rol.valor, rol.etiqueta])
);

export const ESTADO_ACTIVO = "Activo";
export const ESTADO_INACTIVO = "Inactivo";

// ------------------------------------------------------------- Membresías
export const TIPOS_MEMBRESIA = ["Mensual", "Trimestral", "Semestral", "Anual"];
export const TIPO_MEMBRESIA_POR_DEFECTO = TIPOS_MEMBRESIA[0];

/** Debe coincidir con DIAS_PROXIMA_A_VENCER del servidor. */
export const DIAS_PROXIMA_A_VENCER = 5;

/** Debe coincidir con DIAS_PARA_RENOVAR del servidor. */
export const DIAS_PARA_RENOVAR = 30;

/** Opciones del filtro "vencen en N días o menos" (la primera es la de alerta). */
export const OPCIONES_DIAS_VENCIMIENTO = [DIAS_PROXIMA_A_VENCER, 10, 15, DIAS_PARA_RENOVAR];

export const FILTRO_VENCIMIENTO_POR_DEFECTO = "proximas";

// ----------------------------------------------------------------- Rutinas
/** Límites de los campos del formulario (los mismos que valida el servidor). */
export const LIMITES_EJERCICIO = {
  series: { min: 1, max: 20 },
  repeticiones: { min: 1, max: 200 },
};

// ------------------------------------------------------------ Presentación
export const IDIOMA = "es-CO";
export const MONEDA = "COP";
export const SEGUNDOS_AVISO_EXITO = 5;
