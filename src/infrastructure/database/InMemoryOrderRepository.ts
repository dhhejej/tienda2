import { OrderRepository } from '../../domain/repositories/OrderRepository';
import { Order } from '../../domain/entities/Order';

export class InMemoryOrderRepository implements OrderRepository {
  private orders: Map<string, Order> = new Map();

  public async findAll(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  public async findById(id: string): Promise<Order | null> {
    const order = this.orders.get(id);
    return order ? this.cloneOrder(order) : null;
  }

  public async findByUserId(userId: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(o => o.userId === userId)
      .map(o => this.cloneOrder(o));
  }

  public async save(order: Order): Promise<void> {
    this.orders.set(order.id, this.cloneOrder(order));
  }

  private cloneOrder(order: Order): Order {
    return new Order(
      order.id,
      [...order.items],
      order.total,
      order.status,
      order.createdAt,
      order.userId
    );
  }
}
