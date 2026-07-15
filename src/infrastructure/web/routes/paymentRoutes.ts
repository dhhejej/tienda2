import { Router, Response } from 'express';
import Stripe from 'stripe';
import { ProductRepository } from '../../../domain/repositories/ProductRepository';
import { OrderRepository } from '../../../domain/repositories/OrderRepository';
import { Order } from '../../../domain/entities/Order';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key_to_prevent_crash').trim());

export function createPaymentRouter(
  productRepository: ProductRepository,
  orderRepository: OrderRepository
): Router {
  const router = Router();

  // 1. Crear sesión de Checkout
  router.post('/create-checkout-session', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { items } = req.body; // Array de { productId, quantity }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'El carrito no puede estar vacío.' });
      }

      const lineItems = [];
      const validatedItems = [];

      for (const item of items) {
        const product = await productRepository.findById(item.productId);
        if (!product) {
          return res.status(404).json({ error: `Producto no encontrado: ${item.productId}` });
        }
        if (product.stock < item.quantity) {
          return res.status(400).json({ error: `Stock insuficiente para: ${product.name}` });
        }

        lineItems.push({
          price_data: {
            currency: 'mxn',
            product_data: {
              name: product.name,
              description: product.description || undefined
            },
            unit_amount: Math.round(product.price * 100) // Stripe requiere centavos
          },
          quantity: item.quantity
        });

        validatedItems.push({
          id: product.id,
          qty: item.quantity
        });
      }

      // Crear la sesión en Stripe
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/cancel.html`,
        metadata: {
          items: JSON.stringify(validatedItems),
          userId: req.user?.id || ''
        }
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error('Error creando sesión de Stripe:', error);
      res.status(500).json({ error: error.message || 'Error al procesar el pago.' });
    }
  });

  // 2. Webhook de Stripe (recibe notificaciones de éxito criptográficamente firmadas)
  router.post('/webhook', async (req: any, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    let event: Stripe.Event;

    try {
      if (!req.rawBody) {
        throw new Error('No se pudo acceder al buffer crudo del request (rawBody).');
      }
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error('❌ Error de validación de firma del Webhook:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Procesar evento checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`🔔 Webhook recibido: Sesión de pago completada [ID: ${session.id}]`);

      try {
        const metadataItems = session.metadata?.items;
        if (!metadataItems) {
          throw new Error('Metadatos de la sesión de Stripe vacíos.');
        }

        const items = JSON.parse(metadataItems) as Array<{ id: string; qty: number }>;
        const orderItems = [];
        let total = 0;

        for (const item of items) {
          const product = await productRepository.findById(item.id);
          if (!product) {
            console.error(`Producto ${item.id} no encontrado en webhook.`);
            continue;
          }

          orderItems.push({
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity: item.qty
          });

          total += product.price * item.qty;

          // Descontar inventario
          product.stock = Math.max(0, product.stock - item.qty);
          await productRepository.save(product);
        }

        // Obtener el userId de los metadatos de la sesión
        const userId = session.metadata?.userId || null;

        // Crear la orden de compra
        const newOrder = new Order(
          `order-${Date.now()}`,
          orderItems,
          total,
          'PAID',
          new Date(),
          userId
        );

        await orderRepository.save(newOrder);
        console.log(`✅ Orden ${newOrder.id} registrada en MySQL y stock actualizado.`);
      } catch (error: any) {
        console.error('❌ Error procesando orden del Webhook:', error.message);
        return res.status(500).send(`Internal Webhook Error: ${error.message}`);
      }
    }

    res.json({ received: true });
  });

  return router;
}
