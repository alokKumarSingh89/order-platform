export const kafkaConfig = {
  clientId: 'order-service',
  brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
  connectionTimeout: 10_000,
  requestTimeout: 30_000,
};
