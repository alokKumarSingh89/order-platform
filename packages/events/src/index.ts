export interface EventEnvelope<T> {
  eventId: string;
  eventType: string;
  occurredAt: string;
  correlationId: string;
  payload: T;
}

export interface OrderCreatedPayload {
  orderId: string;
  userId: string;
  productId: string;
  quantity: number;
  totalAmount: string;
}

export interface InventoryReservedPayload {
  orderId: string;
  productId: string;
  quantity: number;
  amount: string;
}

export interface InventoryFailedPayload {
  orderId: string;
  reason: string;
}

export interface PaymentCompletedPayload {
  orderId: string;
  paymentId: string;
}

export interface PaymentFailedPayload {
  orderId: string;
  reason: string;
}

export interface InventoryReleasedPayload {
  orderId: string;
}

export const KafkaTopics = {
  ORDER_CREATED: "order.created",

  INVENTORY_RESERVE: "inventory.reserve",
  INVENTORY_RESERVED: "inventory.reserved",
  INVENTORY_FAILED: "inventory.failed",

  PAYMENT_PROCESS: "payment.process",
  PAYMENT_COMPLETED: "payment.completed",
  PAYMENT_FAILED: "payment.failed",

  INVENTORY_RELEASE: "inventory.release",
  INVENTORY_RELEASED: "inventory.released",

  ORDER_CONFIRMED: "order.confirmed",
  ORDER_CANCELLED: "order.cancelled",
} as const;
