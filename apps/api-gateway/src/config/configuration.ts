export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  services: {
    order: process.env.ORDER_SERVICE_URL,
    inventory: process.env.INVENTORY_SERVICE_URL,
    payment: process.env.PAYMENT_SERVICE_URL,
    product: process.env.PRODUCT_SERVICE_URL,
    user: process.env.USER_SERVICE_URL,
  },
});
