import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const pool = mysql.createPool({
  host: (process.env.DB_HOST || 'localhost').trim(),
  port: Number((process.env.DB_PORT || '').trim()) || 3306,
  user: (process.env.DB_USER || 'root').trim(),
  password: (process.env.DB_PASSWORD || '').trim(),
  database: (process.env.DB_NAME || 'tecnonova').trim(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function queryRun(sql: string, params: any[] = []): Promise<any> {
  const [result] = await pool.execute(sql, params);
  return result;
}

export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

export async function queryGet<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const [rows] = await pool.execute(sql, params);
  const rowsArray = rows as T[];
  return rowsArray.length > 0 ? rowsArray[0] : null;
}

export async function initDatabase(): Promise<void> {
  try {
    const conn = await pool.getConnection();
    console.log('Conexión con el servidor MySQL (Auth Microservice) establecida con éxito.');
    conn.release();
  } catch (error: any) {
    console.error('====================================================');
    console.error(` ERROR: No se pudo conectar al servidor MySQL en API 2.`);
    console.error(` Detalles: ${error.message}`);
    console.error('====================================================');
    throw error;
  }

  // Create users table if it does not exist
  await queryRun(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'customer'
    )
  `);

  // Alter table safely to add store_id if needed
  try {
    await queryRun("ALTER TABLE users ADD COLUMN store_id VARCHAR(50) NOT NULL DEFAULT 'tienda1'");
    console.log("Columna store_id añadida a la tabla users.");
  } catch (e: any) {
    if (!e.message.includes('Duplicate column name') && !e.message.includes('already exists')) {
      console.warn("Advertencia al alterar users:", e.message);
    }
  }

  // Seed default admin users
  const userRows = await queryAll<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (userRows && userRows[0] && userRows[0].count === 0) {
    const adminPasswordHash = bcrypt.hashSync('adminpassword123', 10);
    await queryRun(
      'INSERT INTO users (id, email, password, name, role, store_id) VALUES (?, ?, ?, ?, ?, ?)',
      ['user-admin-t1', 'admin@tecnonova.com', adminPasswordHash, 'Administrador TecnoNova T1', 'admin', 'tienda1']
    );
    await queryRun(
      'INSERT INTO users (id, email, password, name, role, store_id) VALUES (?, ?, ?, ?, ?, ?)',
      ['user-admin-t2', 'admin@tecnonova.com', adminPasswordHash, 'Administrador TecnoNova T2', 'admin', 'tienda2']
    );
    console.log('Usuarios Administradores creados en microservicio Auth.');
  }
}

export { pool };
