# SAIYAGYM

Sistema web para la gestión de gimnasios (proyecto universitario de Ingeniería de Sistemas).

**Arquitectura de tres capas:** React (Vite) → API REST con Express → PostgreSQL.

## Alcance implementado

| Sprint | Módulo | Historias |
|---|---|---|
| 1 | Gestión de usuarios | E1-HU1 Registrar · E1-HU2 Consultar/buscar · E1-HU3 Actualizar · E1-HU4 Gestionar estado |
| 2 | Gestión de rutinas | E2-HU1 Crear · E2-HU2 Asignar · E2-HU3 Modificar · E2-HU4 Consultar rutina asignada |
| 3 | Gestión de pagos | E3-HU1 Registrar pago (administrador) · E3-HU2 Historial de pagos (usuario) · E3-HU3 Consultar pagos pendientes (administrador y usuario) · E3-HU4 Actualizar el estado de un pago (administrador) |
| 4 | Gestión de membresías | E4-HU1 Registrar membresía · E4-HU2 Consultar la membresía de un usuario (administrador) y la propia (usuario) · E4-HU3 Renovar membresía · E4-HU4 Consultar vencimientos y generar alertas |
| 5 | Asistencia y rachas | E5-HU1 Registrar mi asistencia · E5-HU2 Consultar mi historial de asistencia · E5-HU3 Gestionar mi racha · E5-HU4 Consultar mis días consecutivos |

## Un programa distinto para cada perfil

Hay que **iniciar sesión** (documento + contraseña). Según el rol, la persona ve solo su parte:

| Perfil | Qué ve | Qué NO puede ver ni usar |
|---|---|---|
| **Administrador** | Gestión de usuarios (registrar, buscar, editar, activar/inactivar, asignar contraseña) registro de pagos, cobros pendientes y cambio de estado de los pagos, membresías (registrar, consultar, renovar, vencimientos y alertas) | Rutinas, asignaciones, "Mi rutina" |
| **Entrenador** | Crear/modificar rutinas y asignarlas a usuarios | Gestión de usuarios, "Mi rutina" |
| **Usuario** | Solo su propia rutina asignada, su historial de pagos, su membresía y su asistencia (registrarla, ver su historial y su racha) | Todo lo demás |

La restricción **se aplica en el servidor** (la API responde 403 si un perfil llama a rutas que no le corresponden), no solo ocultando botones.

Los Sprints 1 a 5 están completos (usuarios, rutinas, pagos, membresías, asistencia y rachas). Fidelización y logros (Sprint 6) **no** están incluidos.

## Estructura

```
SAIYAGYM/
├── frontend/    React + Vite (interfaz)
│   └── src/
│       ├── auth/         sesión (AuthProvider, useAuth, token en sessionStorage)
│       ├── pages/        LoginPage, UsuariosPage, RutinasPage, MiRutinaPage, PagosPage, MisPagosPage, MembresiasPage, MiMembresiaPage
│       ├── assets/       logo del proyecto (PNG con fondo transparente)
│       ├── components/   Mensaje, DetalleRutina
│       └── services/     api.js (única capa que habla con el backend)
├── backend/     Node.js + Express (API REST)
│   ├── src/
│   │   ├── routes/        URLs de la API
│   │   ├── controllers/   reciben la petición y arman la respuesta
│   │   ├── services/      reglas de negocio y validaciones
│   │   ├── repositories/  consultas SQL parametrizadas
│   │   ├── middleware/    autenticación/permisos por rol y manejo de errores
│   │   └── config/        variables de entorno y conexión a PostgreSQL
│   └── scripts/init-db.js crea la base de datos y las tablas
├── database/
│   ├── schema.sql   tablas, claves, restricciones
│   └── seed.sql     datos de ejemplo (opcional)
└── README.md
```

## Requisitos

- Node.js 20 o superior
- PostgreSQL 14 o superior (con el servicio iniciado) y la contraseña del usuario `postgres`

## Puesta en marcha (Windows / PowerShell)

Usa **dos terminales**: una para el backend y otra para el frontend.

### 1. Backend (terminal 1)

```powershell
cd backend
copy .env.example .env
```

Abre `backend\.env` y completa:

- `DB_PASSWORD`: tu contraseña real de PostgreSQL.
- `JWT_SECRET`: una frase larga y propia (mínimo 16 caracteres). Sirve para firmar las sesiones; **no la publiques**.

Luego:

```powershell
npm.cmd install
npm.cmd run db:init
npm.cmd run db:seed
npm.cmd run dev
```

- `db:init` crea la base `saiyagym` (si no existe) y las tablas. Se puede repetir sin perder datos.
- `db:seed` es **opcional**: agrega 4 usuarios de ejemplo y les asigna contraseña (ver abajo).
- Debe aparecer: `API de SAIYAGYM escuchando en http://localhost:3000` y `Conectado a PostgreSQL`.

### 2. Frontend (terminal 2)

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Abre http://localhost:5173/

### Usuarios de demostración (solo con `db:seed`)

| Perfil | Documento | Contraseña |
|---|---|---|
| Administrador | `10000001` | `Saiya2026` |
| Entrenador | `10000002` | `Saiya2026` |
| Usuario | `10000003` | `Saiya2026` |

Son solo para pruebas: cámbialas antes de usar el sistema con datos reales.

### Flujo sugerido para probar

1. Ingresa como **Administrador** y registra personas (con su contraseña y rol).
2. Cierra sesión, ingresa como **Entrenador**: crea una rutina y asígnala a un usuario.
3. Cierra sesión, ingresa como **Usuario**: verás directamente tu rutina.

## API REST

Todas las rutas, salvo `/api/salud` y `/api/auth/login`, exigen el encabezado `Authorization: Bearer <token>`.
`/api/usuarios` es solo del administrador; `/api/rutinas` y `/api/asignaciones`, solo del entrenador; `/api/mi-rutina`, `/api/mis-pagos`, `/api/mi-membresia` y `/api/mi-asistencia`, solo del usuario; `/api/pagos` y `/api/membresias`, solo del administrador.

Respuestas exitosas: `{ "ok": true, "data": ..., "mensaje": "..." }`
Errores: `{ "ok": false, "error": { "codigo": "...", "mensaje": "...", "campos": [] } }`

| Método | Ruta | Historia |
|---|---|---|
| POST | `/api/auth/login` | iniciar sesión (público) → `{ token, usuario }` |
| GET | `/api/auth/yo` | datos de la sesión actual |
| POST | `/api/usuarios` | E1-HU1 registrar (solo administrador) |
| GET | `/api/usuarios?buscar=&rol=&estado=` | E1-HU2 consultar / buscar |
| GET | `/api/usuarios/:id` | consultar un usuario |
| PUT | `/api/usuarios/:id` | E1-HU3 actualizar |
| PATCH | `/api/usuarios/:id/estado` | E1-HU4 activar / inactivar (`{ "estado": "Activo" \| "Inactivo" }`) |
| POST | `/api/pagos` | E3-HU1 registrar pago (`usuario_id`, `valor`, `periodo` AAAA-MM, `concepto` opcional) |
| GET | `/api/pagos` | últimos pagos registrados (administrador) |
| GET | `/api/pagos/usuarios` | usuarios a quienes registrar pagos |
| POST | `/api/pagos/cobros` | generar un cobro pendiente (`usuario_id`, `valor`, `periodo`, `concepto` opcional) |
| GET | `/api/pagos/pendientes?usuario_id=` | E3-HU3 pagos pendientes de todos o de un usuario (administrador) |
| PATCH | `/api/pagos/cobros/:id/estado` | E3-HU4 marcar como `Pagada` o devolver a `Pendiente` (administrador) |
| GET | `/api/mis-pagos?periodo=AAAA-MM` | E3-HU2 mi historial de pagos (usuario) |
| GET | `/api/mis-pagos/pendientes` | E3-HU3 mis pagos pendientes (usuario) |
| POST | `/api/membresias` | E4-HU1 registrar membresía (`usuario_id`, `tipo` Mensual/Trimestral/Semestral/Anual, `valor`, `fecha_inicio` opcional AAAA-MM-DD) |
| GET | `/api/membresias` | todas las membresías con resumen por estado (administrador) |
| GET | `/api/membresias/usuarios` | usuarios del gimnasio y si ya tienen membresía |
| GET | `/api/membresias/usuario/:usuarioId` | E4-HU2 membresía, historial de períodos y alerta de un usuario (administrador) |
| POST | `/api/membresias/:id/renovaciones` | E4-HU3 renovar (`tipo` y `valor` opcionales: si faltan se repiten los anteriores) |
| GET | `/api/membresias/vencimientos?dias=5&filtro=proximas` | E4-HU4 vencimientos; `filtro` = `proximas`, `vencidas` o `todas` |
| POST | `/api/membresias/:id/alerta` | E4-HU4 generar alerta para una membresía próxima a vencer o vencida |
| GET | `/api/mi-membresia` | E4-HU2 mi membresía, mi historial y mi alerta (usuario) |
| GET | `/api/mi-asistencia` | E5-HU2 mi historial de asistencia (más reciente primero), si ya registré hoy, mi racha y si puedo registrar (usuario) |
| POST | `/api/mi-asistencia` | E5-HU1 registrar mi asistencia de hoy; devuelve la racha ya actualizada |
| GET | `/api/mi-asistencia/racha` | E5-HU3 / E5-HU4 mi racha: `actual`, `mejor`, `estado` (Activa, En riesgo, Interrumpida, Sin racha) |

**Reglas de asistencia y rachas (Sprint 5)** — *pendientes de confirmar con el docente*:
- Solo registra asistencia un usuario con membresía vigente (Activa o Próxima a vencer). Vencida, por iniciar o sin membresía se rechaza (409).
- Una asistencia por usuario y por día (el día es el de la zona horaria del gimnasio, `ZONA_HORARIA`). Un segundo intento se rechaza y no duplica la racha; una restricción única en la base lo garantiza aunque se haga doble clic.
- La racha cuenta días calendario seguidos. Si pasa un día completo sin asistir, se reinicia (la siguiente asistencia vuelve a 1). La racha de ayer sigue «En riesgo» hasta que termine hoy.
- La racha no se guarda: se calcula con las fechas de asistencia, así nunca queda desactualizada.
| POST | `/api/rutinas` | E2-HU1 crear rutina |
| GET | `/api/rutinas` · `/api/rutinas/:id` | listar / consultar |
| PUT | `/api/rutinas/:id` | E2-HU3 modificar rutina |
| POST | `/api/asignaciones` | E2-HU2 asignar (`{ "usuario_id", "rutina_id" }`) |
| GET | `/api/asignaciones/usuarios` | usuarios a quienes se puede asignar (solo entrenador) |
| GET | `/api/mi-rutina` | E2-HU4 rutina asignada a quien tiene la sesión (solo usuario) |
| GET | `/api/salud` | comprueba API y base de datos |

## Decisiones de diseño y supuestos

- **Rol en el registro:** E1-HU1 pide registrar "datos personales y su rol". Se usó una sola tabla `usuarios` con el campo `rol` (`administrador`, `entrenador`, `usuario`).
- **Búsqueda (E1-HU2):** el listado muestra todos los usuarios; con el botón *Buscar* se filtra por nombre o documento. Si el criterio está vacío, la API responde pidiendo el dato (criterio de aceptación 3).
- **Inicio de sesión y roles:** los criterios de las historias lo dan por supuesto, así que se implementó: ingreso con documento y contraseña, sesión con token firmado (JWT, 8 h por defecto, se cierra al cerrar el navegador) y permisos por rol en el servidor. Las contraseñas se guardan cifradas (bcrypt), nunca en texto plano.
- **Contraseñas:** la define el administrador al registrar (mínimo 8 caracteres, con letras y números) y puede restablecerla al editar. Un usuario sin contraseña no puede ingresar.
- **Usuario inactivo:** no puede iniciar sesión y, si ya tenía sesión abierta, esta deja de funcionar de inmediato. El administrador no puede inactivarse ni cambiarse el rol a sí mismo.
- **Freno a adivinar contraseñas:** tras 8 intentos fallidos seguidos para un mismo documento, se bloquea el ingreso por 15 minutos.
- **Ejercicios de una rutina:** se escriben libremente (nombre, series, repeticiones); no se creó un catálogo de ejercicios porque ninguna historia lo pide.
- **Una rutina vigente por usuario:** al asignar una nueva, la anterior queda en el historial (`asignaciones_rutina.vigente = false`).
- **Rutina "no disponible" (E2-HU4, escenario 3):** la columna `rutinas.estado` (`Activa`/`Inactiva`) existe y la API la respeta; no hay pantalla para inactivar rutinas porque ninguna historia lo solicita.
- **Documentos:** se guardan en mayúsculas (4 a 20 letras o números) para evitar duplicados como `ab123` y `AB123`.
- **Seguridad:** consultas SQL parametrizadas, credenciales y `JWT_SECRET` solo en `backend/.env` (excluido de Git), mensajes de error internos sin detalles técnicos.

## Solución de problemas

| Mensaje | Causa y solución |
|---|---|
| `Usuario o contraseña de PostgreSQL incorrectos` | Revisa `DB_USER` y `DB_PASSWORD` en `backend\.env`. |
| `No se pudo conectar a PostgreSQL en localhost:5432` | El servicio de PostgreSQL no está iniciado (Servicios de Windows → `postgresql-x64-XX`). |
| `El puerto 3000 ya está en uso` | Cierra el otro programa o cambia `PORT` en `backend\.env` (y el destino del proxy en `frontend\vite.config.js`). |
| En la web: "No se pudo conectar con el servidor" | El backend no está en ejecución: revisa la terminal 1. |
| `Falta JWT_SECRET en backend/.env` | Agrega `JWT_SECRET=` con una frase larga (16+ caracteres) en `backend\.env` y reinicia. |
| "Documento o contraseña incorrectos" con un usuario creado antes de existir el login | Ese usuario no tiene contraseña: el administrador debe editarlo y asignarle una. |
| PowerShell bloquea `npm` | Usa siempre `npm.cmd`. |
