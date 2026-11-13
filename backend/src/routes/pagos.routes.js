import { Router } from "express";
import * as controlador from "../controllers/pagos.controller.js";

// Rutas del administrador (el acceso se restringe en app.js).
const router = Router();

router.post("/", controlador.registrar); // E3-HU1 registrar un pago
router.get("/", controlador.listar); // últimos pagos registrados
router.get("/usuarios", controlador.usuariosPagables); // usuarios a quienes registrar pagos
router.get("/pendientes", controlador.pendientes); // E3-HU3 consultar pagos pendientes
router.post("/cobros", controlador.generarCobro); // generar un cobro pendiente
router.patch("/cobros/:id/estado", controlador.actualizarEstado); // E3-HU4 actualizar estado

export default router;
