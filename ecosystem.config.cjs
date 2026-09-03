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
const getServiceWorker = (name, type = "worker", instances = 1) => {
  return {
    name: `${name}-${type}`,
    cwd: `./apps/${name}`,
    script: "npm",
    args: `run start:${type}:dev`,
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
  getServiceWorker("order-service", "saga"),
  getServiceConfig("inventory-service"),
  getServiceWorker("inventory-service"),
  getServiceConfig("payment-service"),
  getServiceWorker("payment-service"),
];
module.exports = {
  apps,
};
