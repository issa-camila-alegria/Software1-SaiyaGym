import MembresiasPage from "../pages/MembresiasPage.jsx";
import MiAsistenciaPage from "../pages/MiAsistenciaPage.jsx";
import MiMembresiaPage from "../pages/MiMembresiaPage.jsx";
import MiRutinaPage from "../pages/MiRutinaPage.jsx";
import MisPagosPage from "../pages/MisPagosPage.jsx";
import PagosPage from "../pages/PagosPage.jsx";
import RutinasPage from "../pages/RutinasPage.jsx";
import UsuariosPage from "../pages/UsuariosPage.jsx";

// Cada perfil tiene su propio programa: solo ve las pantallas de esta lista.
// (El servidor también lo exige: ocultar botones no basta como seguridad.)
// Para agregar una pantalla nueva basta con sumarla aquí.
export const modulosPorRol = {
  administrador: [
    { id: "usuarios", nombre: "Usuarios", sprint: 1, Pagina: UsuariosPage },
    { id: "pagos", nombre: "Pagos", sprint: 3, Pagina: PagosPage },
    { id: "membresias", nombre: "Membresías", sprint: 4, Pagina: MembresiasPage },
  ],
  entrenador: [
    { id: "rutinas", nombre: "Rutinas", sprint: 2, Pagina: RutinasPage },
  ],
  usuario: [
    { id: "mi-rutina", nombre: "Mi rutina", sprint: 2, Pagina: MiRutinaPage },
    { id: "mis-pagos", nombre: "Mis pagos", sprint: 3, Pagina: MisPagosPage },
    { id: "mi-membresia", nombre: "Mi membresía", sprint: 4, Pagina: MiMembresiaPage },
    { id: "mi-asistencia", nombre: "Mi asistencia", sprint: 5, Pagina: MiAsistenciaPage },
  ],
};
