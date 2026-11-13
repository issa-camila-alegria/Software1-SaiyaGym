import { Router } from "express";
import * as controlador from "../controllers/asistencias.controller.js";

// Rutas del usuario del gimnasio (el acceso se restringe en app.js).
const router = Router();

router.get("/", controlador.mia); // E5-HU2 historial
router.get("/racha", controlador.racha); // E5-HU3 / E5-HU4 racha
router.post("/", controlador.registrar); // E5-HU1 registrar asistencia

export default router;
