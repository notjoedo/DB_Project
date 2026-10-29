import mysql from "mysql2/promise";

let pool: mysql.Pool | undefined;

export function database() {
  pool ??= mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "treefinder",
    database: process.env.DB_NAME ?? "volunteer_db",
    dateStrings: true,
    decimalNumbers: true,
    connectionLimit: 10,
  });
  return pool;
}
