import { Router } from "express";
import * as controlador from "../controllers/membresias.controller.js";

// Ruta del usuario del gimnasio (el acceso se restringe en app.js).
const router = Router();

router.get("/", controlador.miMembresia); // E4-HU2 consultar mi membresía

export default router;
