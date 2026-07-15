import { OrderRepository } from '../../domain/repositories/OrderRepository';
import { Order, OrderItem } from '../../domain/entities/Order';
import { queryAll, queryGet, queryRun } from './mysql';

interface MysqlOrderRow {
  id: string;
  total: string;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELLED';
  created_at: string;
  user_id: string | null;
}

interface MysqlOrderItemRow {
  product_id: string;
  name: string;
  price: string;
  quantity: number;
}

export class MysqlOrderRepository implements OrderRepository {
  public async findAll(): Promise<Order[]> {
    const orderRows = await queryAll<MysqlOrderRow>('SELECT * FROM orders ORDER BY created_at DESC');
    const orders: Order[] = [];

    for (const r of orderRows) {
      const itemRows = await queryAll<MysqlOrderItemRow>(
        'SELECT product_id, name, price, quantity FROM order_items WHERE order_id = ?',
        [r.id]
      );
      const items: OrderItem[] = itemRows.map(i => ({
        productId: i.product_id,
        productName: i.name,
        price: Number(i.price),
        quantity: i.quantity
      }));
      orders.push(new Order(r.id, items, Number(r.total), r.status, new Date(r.created_at), r.user_id));
    }

    return orders;
  }

  public async findById(id: string): Promise<Order | null> {
    const r = await queryGet<MysqlOrderRow>('SELECT * FROM orders WHERE id = ?', [id]);
    if (!r) return null;

    const itemRows = await queryAll<MysqlOrderItemRow>(
      'SELECT product_id, name, price, quantity FROM order_items WHERE order_id = ?',
      [r.id]
    );
    const items: OrderItem[] = itemRows.map(i => ({
      productId: i.product_id,
      productName: i.name,
      price: Number(i.price),
      quantity: i.quantity
    }));

    return new Order(r.id, items, Number(r.total), r.status, new Date(r.created_at), r.user_id);
  }

  public async findByUserId(userId: string): Promise<Order[]> {
    const orderRows = await queryAll<MysqlOrderRow>(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    const orders: Order[] = [];

    for (const r of orderRows) {
      const itemRows = await queryAll<MysqlOrderItemRow>(
        'SELECT product_id, name, price, quantity FROM order_items WHERE order_id = ?',
        [r.id]
      );
      const items: OrderItem[] = itemRows.map(i => ({
        productId: i.product_id,
        productName: i.name,
        price: Number(i.price),
        quantity: i.quantity
      }));
      orders.push(new Order(r.id, items, Number(r.total), r.status, new Date(r.created_at), r.user_id));
    }

    return orders;
  }

  public async save(order: Order): Promise<void> {
    await queryRun(
      `INSERT INTO orders (id, total, status, created_at, user_id) 
       VALUES (?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
         total = VALUES(total), 
         status = VALUES(status), 
         created_at = VALUES(created_at),
         user_id = VALUES(user_id)`,
      [order.id, order.total, order.status, order.createdAt.toISOString(), order.userId]
    );

    await queryRun('DELETE FROM order_items WHERE order_id = ?', [order.id]);

    for (const item of order.items) {
      await queryRun(
        `INSERT INTO order_items (order_id, product_id, name, price, quantity) 
         VALUES (?, ?, ?, ?, ?)`,
        [order.id, item.productId, item.productName, item.price, item.quantity]
      );
    }
  }
}
