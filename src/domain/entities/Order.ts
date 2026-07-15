export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

export class Order {
  constructor(
    public readonly id: string,
    public readonly items: OrderItem[],
    public readonly total: number,
    public readonly status: 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELLED',
    public readonly createdAt: Date,
    public readonly userId: string | null = null
  ) {}

  public static create(id: string, items: OrderItem[], userId: string | null = null): Order {
    const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    return new Order(id, items, total, 'PENDING', new Date(), userId);
  }
}
