// Crea la base de datos (si no existe) y aplica el esquema de /database.
//   npm run db:init   -> crea la base y las tablas
//   npm run db:seed   -> además inserta usuarios de ejemplo con contraseña (opcional)

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";
import { config } from "../src/config/env.js";

const carpetaDatabase = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../database"
);

const conDatos = process.argv.includes("--seed");

// Contraseña de los usuarios de ejemplo (solo para pruebas y demostración).
const CONTRASENA_DEMO = "Saiya2026";
const DOCUMENTOS_DEMO = ["10000001", "10000002", "10000003", "10000004"];

async function conectar(baseDeDatos) {
  const cliente = new pg.Client({ ...config.db, database: baseDeDatos });
  await cliente.connect();
  return cliente;
}

async function asegurarBaseDeDatos() {
  const nombre = config.db.database;

  if (!/^[A-Za-z0-9_]+$/.test(nombre)) {
    throw new Error("DB_NAME solo puede tener letras, números y guion bajo.");
  }

  try {
    return await conectar(nombre);
  } catch (error) {
    if (error.code !== "3D000") throw error; // 3D000 = la base no existe

    console.log(`La base "${nombre}" no existe. Creándola...`);
    const admin = await conectar("postgres");
    await admin.query(`CREATE DATABASE "${nombre}"`);
    await admin.end();

    return conectar(nombre);
  }
}

function explicar(error) {
  if (error.code === "ECONNREFUSED") {
    return `No se pudo conectar a PostgreSQL en ${config.db.host}:${config.db.port}. ¿Está iniciado el servicio?`;
  }
  if (error.code === "28P01") {
    return "Usuario o contraseña de PostgreSQL incorrectos. Revisa DB_USER y DB_PASSWORD en backend/.env.";
  }
  return error.message;
}

try {
  const cliente = await asegurarBaseDeDatos();

  await cliente.query(await readFile(path.join(carpetaDatabase, "schema.sql"), "utf8"));
  console.log("Esquema aplicado: tablas listas.");

  if (conDatos) {
    await cliente.query(await readFile(path.join(carpetaDatabase, "seed.sql"), "utf8"));

    // A los usuarios de ejemplo que aún no tengan contraseña se les asigna la de demostración.
    const hash = await bcrypt.hash(CONTRASENA_DEMO, 10);
    await cliente.query(
      `UPDATE personas SET contrasena_hash = $1
        WHERE documento = ANY($2) AND contrasena_hash IS NULL`,
      [hash, DOCUMENTOS_DEMO]
    );

    console.log("Usuarios de ejemplo listos.");
    console.log(`  Administrador: documento 10000001  contraseña ${CONTRASENA_DEMO}`);
    console.log(`  Entrenador:    documento 10000002  contraseña ${CONTRASENA_DEMO}`);
    console.log(`  Usuario:       documento 10000003  contraseña ${CONTRASENA_DEMO}`);
  }

  await cliente.end();
  console.log("Base de datos lista.");
} catch (error) {
  console.error(`Error: ${explicar(error)}`);
  process.exit(1);
}
