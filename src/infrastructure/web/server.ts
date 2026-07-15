import 'dotenv/config';
import express from 'express';
import path from 'path';
import { initDatabase } from '../database/mysql';
import { MysqlProductRepository } from '../database/MysqlProductRepository';
import { MysqlOrderRepository } from '../database/MysqlOrderRepository';
import { MysqlUserRepository } from '../database/MysqlUserRepository';
import { createProductRouter } from './routes/productRoutes';
import { createOrderRouter } from './routes/orderRoutes';
import { createPaymentRouter } from './routes/paymentRoutes';
import { createAuthRouter } from './routes/authRoutes';

const app = express();
const port = process.env.PORT || 3000;

// Guardar rawBody en la petición para verificar firmas criptográficas de webhooks de Stripe
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// Servir archivos estáticos del frontend
app.use(express.static(path.resolve(__dirname, '../../../public')));

const productRepository = new MysqlProductRepository();
const orderRepository = new MysqlOrderRepository();
const userRepository = new MysqlUserRepository();

app.use('/api/products', createProductRouter(productRepository));
app.use('/api/orders', createOrderRouter(orderRepository, productRepository));
app.use('/api/payments', createPaymentRouter(productRepository, orderRepository));
app.use('/api/auth', createAuthRouter(userRepository));

app.get('/api/config', (req, res) => {
  res.json({
    defaultStoreId: process.env.DEFAULT_STORE_ID || 'tienda1'
  });
});


async function startServer() {
  try {
    await initDatabase();
    app.listen(port, () => {
      console.log(`====================================================`);
      console.log(` Servidor de la Tienda corriendo en http://localhost:${port}`);
      console.log(` Para usar dominio local, mapea tienda.local en hosts`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Error inicializando el servidor:', error);
    process.exit(1);
  }
}

startServer();
