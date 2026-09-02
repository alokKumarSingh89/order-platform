module.exports = {
  apps: [
    {
      name: "api-gateway",
      cwd: "./apps/api-gateway",
      script: "dist/main.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
    },

    {
      name: "order-api",
      cwd: "./apps/order-service",
      script: "dist/main.js",
      instances: 3,
      exec_mode: "fork",
      increment_var: "PORT",
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
    },

    {
      name: "outbox-worker",
      cwd: "./apps/order-service",
      script: "dist/outbox-main.js",
      instances: 2,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
