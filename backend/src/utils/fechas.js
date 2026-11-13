const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-11-17" -> "17 nov 2026" (sin usar Date, para que la zona horaria no mueva el día). */
export function formatearFecha(valor) {
  const coincide = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor ?? ""));
  if (!coincide) return String(valor ?? "");
  const [, anio, mes, dia] = coincide;
  return `${Number(dia)} ${MESES[Number(mes) - 1]} ${anio}`;
}
