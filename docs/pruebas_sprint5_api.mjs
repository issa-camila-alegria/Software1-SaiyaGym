const B = "http://localhost:3000/api";
let ok = 0, bad = 0;
const call = async (m, u, t, b) => { const r = await fetch(B + u, { method: m, headers: { "content-type": "application/json", ...(t ? { authorization: "Bearer " + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const login = async (d, c = "Saiya2026") => (await call("POST", "/auth/login", null, { documento: d, contrasena: c })).j?.data?.token;
const check = (nombre, cond, extra = "") => { (cond ? ok++ : bad++); console.log((cond ? "OK   " : "FALLA ") + nombre + (cond ? "" : "  -> " + extra)); };
const ver = async (t) => (await call("GET", "/mi-asistencia", t)).j.data;

const cam = await login("10000003");
let d = await ver(cam);
check("Camila: racha 4 'En riesgo', puede registrar hoy", d.racha.actual === 4 && d.racha.estado === "En riesgo" && d.puede_registrar === true && d.total === 4, JSON.stringify(d.racha));
check("Historial ordenado por fecha (más reciente primero)", d.asistencias.every((a, i, v) => i === 0 || v[i - 1].fecha > a.fecha));
let r = await call("POST", "/mi-asistencia", cam);
check("E5-HU1 asistencia registrada (201) con fecha y hora", r.s === 201 && /^\d{4}-\d\d-\d\d$/.test(r.j.data.asistencia.fecha) && /^\d\d:\d\d$/.test(r.j.data.asistencia.hora), JSON.stringify(r.j));
check("E5-HU3 la racha sube a 5 y queda 'Activa'", r.j.data.racha.actual === 5 && r.j.data.racha.estado === "Activa" && r.j.data.racha.asistio_hoy, JSON.stringify(r.j.data.racha));
r = await call("POST", "/mi-asistencia", cam);
d = await ver(cam);
check("E5-HU1 asistencia duplicada: 409 y sigue una sola por día", r.s === 409 && r.j.error.codigo === "ASISTENCIA_YA_REGISTRADA" && d.total === 5, JSON.stringify(r.j));
check("E5-HU3 duplicado no suma dos veces la racha", d.racha.actual === 5);
check("E5-HU4 consulta de racha por /racha", (await call("GET", "/mi-asistencia/racha", cam)).j.data.actual === 5);

const luc = await login("20000012");
check("E5-HU4 sin asistencias: 'Sin racha', valor inicial 0", (await call("GET", "/mi-asistencia/racha", luc)).j.data.estado === "Sin racha");
check("E5-HU2 sin asistencias: lista vacía", (await ver(luc)).asistencias.length === 0);
const dos = await Promise.all([call("POST", "/mi-asistencia", luc), call("POST", "/mi-asistencia", luc)]);
d = await ver(luc);
check("Dos clics a la vez: una sola asistencia (201 + 409)", dos.map((x) => x.s).sort().join() === "201,409" && d.total === 1 && d.racha.actual === 1, dos.map((x) => x.s).join());

const mar = await login("20000011");
d = await ver(mar);
check("Mario: racha actual 6 (Activa) y mejor 9", d.racha.actual === 6 && d.racha.mejor === 9 && d.racha.estado === "Activa" && d.puede_registrar === false, JSON.stringify(d.racha));

const pab = await login("20000010");
d = (await call("GET", "/mi-asistencia/racha", pab)).j.data;
check("Pablo: racha interrumpida (actual 0, mejor 5)", d.estado === "Interrumpida" && d.actual === 0 && d.mejor === 5 && d.racha_anterior === 5, JSON.stringify(d));
r = await call("POST", "/mi-asistencia", pab);
check("E5-HU3 racha reiniciada: vuelve a 1 y conserva la mejor (5)", r.s === 201 && r.j.data.racha.actual === 1 && r.j.data.racha.mejor === 5, JSON.stringify(r.j.data?.racha));

const nat = await login("20000019");
d = (await call("GET", "/mi-asistencia/racha", nat)).j.data;
check("Natalia: racha 2 'En riesgo' (aún la puede mantener hoy)", d.actual === 2 && d.estado === "En riesgo");

const juan = await login("20000014");
const antes = (await ver(juan)).total;
r = await call("POST", "/mi-asistencia", juan);
check("E5-HU1 membresía vencida: 409 MEMBRESIA_NO_VIGENTE y no se guarda", r.s === 409 && r.j.error.codigo === "MEMBRESIA_NO_VIGENTE" && (await ver(juan)).total === antes, JSON.stringify(r.j));
check("Pantalla: con membresía vencida no se puede registrar y explica por qué", (await ver(juan)).puede_registrar === false && /venció/.test((await ver(juan)).motivo));
r = await call("POST", "/mi-asistencia", await login("20000017"));
check("Membresía por iniciar: 409", r.s === 409 && r.j.error.codigo === "MEMBRESIA_NO_VIGENTE", JSON.stringify(r.j));
r = await call("POST", "/mi-asistencia", await login("20000021"));
check("Sin membresía: 409", r.s === 409 && r.j.error.codigo === "MEMBRESIA_NO_VIGENTE", JSON.stringify(r.j));

check("E5-HU1 sin sesión: 401", (await call("POST", "/mi-asistencia")).s === 401);
check("Token falso: 401", (await call("GET", "/mi-asistencia", "abc.def.ghi")).s === 401);
check("Administrador no puede usar asistencia: 403", (await call("GET", "/mi-asistencia", await login("10000001"))).s === 403);
check("Entrenador no puede registrar asistencia: 403", (await call("POST", "/mi-asistencia", await login("10000002"))).s === 403);
check("Usuario inactivo no entra", (await login("20000020")) === undefined);
check("Cada usuario ve solo lo suyo (Camila 5, Lucía 1)", (await ver(cam)).total === 5 && (await ver(luc)).total === 1);

console.log(`\n${ok} OK, ${bad} fallas`);
process.exit(bad ? 1 : 0);
