# Publicar SAIYAGYM en internet (gratis)

Resultado: una dirección `https://saiyagym.onrender.com` (o similar) que funciona desde cualquier celular o computador.

Se usan dos servicios gratuitos: **Neon** (base de datos PostgreSQL) y **Render** (página + API).

## 1. Base de datos en Neon
1. Entra a https://neon.tech → *Sign up* (con GitHub o Google).
2. *Create project* → nombre `saiyagym` → región la más cercana (ej. US East).
3. En *Connection string* copia la URL (empieza con `postgresql://...` y termina en `?sslmode=require`).

## 2. Cargar las tablas y los datos de ejemplo
Desde tu computador, en PowerShell, dentro de `backend`:

```powershell
$env:DATABASE_URL="PEGA_AQUI_LA_URL_DE_NEON"
npm install
npm run db:seed          # tablas + usuarios de ejemplo (clave Saiya2026)
# o: npm run db:seed:pruebas   # además, datos para probar todas las funciones
```
Debe decir «Esquema aplicado» y «Base de datos lista».

## 3. Subir el código a GitHub
Haz commit y push de estos cambios al repositorio (incluye `render.yaml`).

## 4. Publicar en Render
1. Entra a https://render.com → *New* → *Blueprint* → conecta el repositorio de GitHub.
2. Render lee `render.yaml`. Te pedirá `DATABASE_URL`: pega la URL de Neon.
3. *Apply*. Tarda 3–5 minutos. Al terminar aparece el enlace `https://...onrender.com`.
4. Abre el enlace e inicia sesión con `10000001` / `Saiya2026` (administrador).

## Cosas que debes saber
- En el plan gratuito de Render el servicio se «duerme» tras 15 min sin uso; la primera visita después tarda ~1 minuto en despertar.
- `JWT_SECRET` lo genera Render solo; no lo compartas.
- Para actualizar: haz `git push` y Render vuelve a publicar solo.
- Si quieres una dirección propia (www.tugimnasio.com) se compra un dominio y se conecta en Render → *Settings → Custom Domains* (no es gratis).
