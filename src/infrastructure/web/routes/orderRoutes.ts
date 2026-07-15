import { Router, Response } from 'express';
import { ManageOrders } from '../../../application/use-cases/ManageOrders';
import { OrderRepository } from '../../../domain/repositories/OrderRepository';
import { ProductRepository } from '../../../domain/repositories/ProductRepository';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';

export function createOrderRouter(
  orderRepository: OrderRepository,
  productRepository: ProductRepository
): Router {
  const router = Router();
  const manageOrders = new ManageOrders(orderRepository, productRepository);

  router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Acceso no autorizado.' });
      }

      // Si es admin, ve todas las órdenes; si es cliente, solo las suyas
      const orders = await manageOrders.getOrders(user.role === 'admin' ? undefined : user.id);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const order = await manageOrders.getOrderDetails(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Evitar que un cliente vea la orden de otro cliente
      if (req.user?.role !== 'admin' && order.userId !== req.user?.id) {
        return res.status(403).json({ error: 'Acceso denegado a este pedido.' });
      }

      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Para el checkout simulado (offline)
  router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items array is required to create an order' });
      }
      const orderId = `order-${Date.now()}`;
      const order = await manageOrders.createOrder(orderId, { items }, req.user?.id);
      res.status(201).json(order);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}
