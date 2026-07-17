import 'dotenv/config';
import express from 'express';
import { initDatabase } from '../database/mysql';
import { MysqlUserRepository } from '../database/MysqlUserRepository';
import { createAuthRouter } from './routes/authRoutes';

const app = express();
const port = process.env.PORT || 3001; // Puerto 3001 por defecto para el microservicio de autenticación

app.use(express.json());

const userRepository = new MysqlUserRepository();

app.use('/api/auth', createAuthRouter(userRepository));

async function startServer() {
  try {
    await initDatabase();
    app.listen(port, () => {
      console.log(`====================================================`);
      console.log(` Servidor de Autenticación corriendo en http://localhost:${port}`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Error inicializando el servidor de autenticación:', error);
    process.exit(1);
  }
}

startServer();
