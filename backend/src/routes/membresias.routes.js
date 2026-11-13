import { Router } from "express";
import * as controlador from "../controllers/membresias.controller.js";

// Rutas del administrador (el acceso se restringe en app.js).
// Las rutas fijas van antes que las que llevan :id.
const router = Router();

router.post("/", controlador.registrar); // E4-HU1 registrar una membresía
router.get("/", controlador.listar); // todas las membresías
router.get("/usuarios", controlador.usuarios); // usuarios del gimnasio
router.get("/vencimientos", controlador.vencimientos); // E4-HU4 consultar vencimientos
router.get("/usuario/:usuarioId", controlador.deUsuario); // E4-HU2 membresía de un usuario
router.post("/:id/renovaciones", controlador.renovar); // E4-HU3 renovar
router.post("/:id/alerta", controlador.generarAlerta); // E4-HU4 generar alerta

export default router;
