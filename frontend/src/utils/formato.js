const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// "2026-11-17" -> "17 nov 2026". Se parte el texto a mano (sin new Date)
// para que la zona horaria no mueva el día.
export function formatearFecha(valor) {
  if (!valor) return "—";
  const coincide = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
  if (!coincide) return String(valor);
  const [, anio, mes, dia] = coincide;
  return `${Number(dia)} ${MESES[Number(mes) - 1]} ${anio}`;
}
