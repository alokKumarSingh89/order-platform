const getServiceConfig = (name, instances = 1) => {
  return {
    name,
    cwd: `./apps/${name}`,
    script: "npm",
    args: "run start:dev",
    instances,
    exec_mode: "fork",
    autorestart: true,
    increment_var: "PORT",
    env: {
      NODE_ENV: "development",
    },
  };
};
const getServiceWorker = (name, instances = 1) => {
  return {
    name: `${name}-worker`,
    cwd: `./apps/${name}`,
    script: "npm",
    args: "run start:worker:dev",
    instances,
    exec_mode: "fork",
    autorestart: true,
    env: {
      NODE_ENV: "development",
    },
  };
};
const apps = [
  getServiceConfig("api-gateway"),
  getServiceConfig("order-service"),
  getServiceWorker("order-service"),
  getServiceConfig("inventory-service"),
  getServiceWorker("inventory-service"),
  getServiceConfig("payment-service"),
  getServiceWorker("payment-service"),
];
module.exports = {
  apps,
};
