import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { config } from "./config/env.js";
import { pool } from "./config/db.js";
import { autenticar, autorizar } from "./middleware/auth.js";
import { manejarErrores, rutaNoEncontrada } from "./middleware/errorHandler.js";
import asignacionesRoutes from "./routes/asignaciones.routes.js";
import authRoutes from "./routes/auth.routes.js";
import membresiasRoutes from "./routes/membresias.routes.js";
import miMembresiaRoutes from "./routes/miMembresia.routes.js";
import miRutinaRoutes from "./routes/miRutina.routes.js";
import misPagosRoutes from "./routes/misPagos.routes.js";
import pagosRoutes from "./routes/pagos.routes.js";
import rutinasRoutes from "./routes/rutinas.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";

const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "100kb" }));

// Comprobación rápida de que la API y la base de datos responden.
app.get("/api/salud", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, data: { api: "activa", baseDeDatos: "conectada" } });
  } catch {
    res.status(503).json({
      ok: false,
      error: {
        codigo: "BASE_DE_DATOS_NO_DISPONIBLE",
        mensaje: "No se pudo conectar con la base de datos.",
      },
    });
  }
});

// Inicio de sesión (público).
app.use("/api/auth", authRoutes);

// Cada perfil solo puede usar su propia parte de la API:
//   administrador -> gestión de usuarios, pagos y membresías
//   entrenador    -> rutinas y asignaciones
//   usuario       -> su propia rutina, sus pagos y su membresía
app.use("/api/usuarios", autenticar, autorizar("administrador"), usuariosRoutes);
app.use("/api/pagos", autenticar, autorizar("administrador"), pagosRoutes);
app.use("/api/membresias", autenticar, autorizar("administrador"), membresiasRoutes);
app.use("/api/rutinas", autenticar, autorizar("entrenador"), rutinasRoutes);
app.use("/api/asignaciones", autenticar, autorizar("entrenador"), asignacionesRoutes);
app.use("/api/mi-rutina", autenticar, autorizar("usuario"), miRutinaRoutes);
app.use("/api/mis-pagos", autenticar, autorizar("usuario"), misPagosRoutes);
app.use("/api/mi-membresia", autenticar, autorizar("usuario"), miMembresiaRoutes);

// En producción, el mismo servidor entrega la página (frontend/dist) y la API:
// así se usa una sola dirección web y no hace falta configurar CORS.
const carpetaWeb = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist");
if (existsSync(carpetaWeb)) {
  app.use(express.static(carpetaWeb));
  app.get(/^\/(?!api(\/|$)).*/, (req, res) => res.sendFile(path.join(carpetaWeb, "index.html")));
}

app.use(rutaNoEncontrada);
app.use(manejarErrores);

export default app;
