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
    console.log('Conexión con el servidor MySQL establecida con éxito.');
    conn.release();
  } catch (error: any) {
    console.error('====================================================');
    console.error(` ERROR: No se pudo conectar al servidor MySQL.`);
    console.error(` Detalles: ${error.message}`);
    console.error(` Asegúrate de que MySQL esté encendido y que las credenciales`);
    console.error(` en tu archivo .env sean correctas.`);
    console.error('====================================================');
    throw error;
  }

  // Create tables in MySQL if they do not exist
  await queryRun(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'customer'
    )
  `);

  await queryRun(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      stock INT NOT NULL
    )
  `);

  await queryRun(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(50) PRIMARY KEY,
      total DECIMAL(10, 2) NOT NULL,
      status VARCHAR(50) NOT NULL,
      created_at VARCHAR(50) NOT NULL
    )
  `);

  // Alter tables safely
  try {
    await queryRun(`
      ALTER TABLE orders ADD COLUMN user_id VARCHAR(50) NULL,
      ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log('Columna user_id y restricción de FK añadidas a la tabla orders.');
  } catch (error: any) {
    // Ignorar si la columna ya existe
    if (!error.message.includes('Duplicate column name') && !error.message.includes('already exists') && !error.message.includes('duplicate key')) {
      console.warn('Advertencia al alterar la tabla orders:', error.message);
    }
  }

  await queryRun(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(50) NOT NULL,
      product_id VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      quantity INT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  // Seed data if products table is empty
  const rows = await queryAll<{ count: number }>('SELECT COUNT(*) as count FROM products');
  if (rows && rows[0] && rows[0].count === 0) {
    const defaultProducts = [
      ['prod-1', 'Laptop Gamer Pro', 'Laptop con procesador i9 y tarjeta RTX 4080', 35000.00, 10],
      ['prod-2', 'Mouse Mecánico Inalámbrico', 'Mouse ergonómico con sensor óptico de 26k DPI', 1200.00, 50],
      ['prod-3', 'Teclado Mecánico RGB', 'Teclado hot-swappable con switches lineares', 1800.00, 25],
      ['prod-4', 'Monitor Curvo 34"', 'Monitor ultrawide 144Hz 1ms', 8500.00, 15]
    ];

    for (const p of defaultProducts) {
      await queryRun('INSERT INTO products (id, name, description, price, stock) VALUES (?, ?, ?, ?, ?)', p);
    }
    console.log('Tablas inicializadas y productos semilla agregados en MySQL.');
  }

  // Seed default admin user
  const userRows = await queryAll<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (userRows && userRows[0] && userRows[0].count === 0) {
    const adminPasswordHash = bcrypt.hashSync('adminpassword123', 10);
    await queryRun(
      'INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)',
      ['user-admin', 'admin@tecnonova.com', adminPasswordHash, 'Administrador TecnoNova', 'admin']
    );
    console.log('Usuario Administrador por defecto creado (admin@tecnonova.com).');
  }
}

export { pool };
