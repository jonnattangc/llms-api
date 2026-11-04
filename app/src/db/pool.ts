import mysql from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';

let pool: Pool | undefined;

// Pool de conexiones al esquema exclusivo de este sistema (llm_manager). Se crea al primer uso.
export function getPool(): Pool {
  if (pool) return pool;
  if (!process.env.HOST_BD) {
    throw new Error('HOST_BD no está definida, el registro de archivos dinámicos no está disponible.');
  }

  pool = mysql.createPool({
    host: process.env.HOST_BD,
    port: Number(process.env.PORT_BD ?? 3306),
    user: process.env.USER_BD ?? '',
    password: process.env.PASS_BD ?? '',
    database: process.env.SCHEMA_BD || 'llm_manager',
    charset: 'utf8mb4',
    connectionLimit: 5,
    connectTimeout: 5000,
    timezone: 'Z',
  });
  return pool;
}
