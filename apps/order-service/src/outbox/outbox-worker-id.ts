import { randomUUID } from 'crypto';

export const OUTBOX_WORKER_ID = `order-service-${process.pid}-${randomUUID()}`;
