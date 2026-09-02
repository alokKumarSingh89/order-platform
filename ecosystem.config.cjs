module.exports = {
  apps: [
    {
      name: "api-gateway",
      cwd: "./apps/api-gateway",
      script: "npm",
      args: "run start:dev",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
    },

    {
      name: "order-api",
      cwd: "./apps/order-service",
      script: "npm",
      args: "run start:dev",
      instances: 3,
      exec_mode: "fork",
      autorestart: true,
      increment_var: "PORT",
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
    },

    {
      name: "outbox-worker",
      cwd: "./apps/order-service",
      script: "npm",
      args: "run start:worker:dev",
      instances: 2,
      exec_mode: "fork",
      autorestart: true,
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
