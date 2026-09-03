# NestJS Microservices — Interview & Production Learning Project

A production-oriented NestJS microservices learning project covering:

- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM
- Database-per-service
- Kafka
- Redis
- API Gateway
- Load Balancing
- Transactional Outbox
- Saga Pattern
- Compensation / Rollback
- Idempotent Kafka Consumers
- Manual Kafka Offset Commit
- Retry & Dead Letter concepts
- PM2
- Docker Compose
- Kubernetes concepts
- Database Primary/Replica
- Database Sharding
- Microservice scalability

The business example used throughout the project is:

```text
Order → Inventory → Payment
```

# 1. Architecture

```text
                             Client
                            |
                            v
                   +----------------+
                   |  API Gateway    |
                   |     :3000       |
                   +-------+--------+
                           |
                           v
                   +---------------+
                   |   Order API   |
                   |     :3001     |
                   +-------+-------+
                           |
                           v
                     +----------+
                     | order_db |
                     +----------+
                           |
                           v
                    Outbox Worker
                           |
                           v
                         Kafka
                           |
          +----------------+----------------+
          |                                 |
          v                                 v
 Inventory Worker                    Order Saga Worker
          |                                 |
          v                                 |
    inventory_db                            |
          |                                 |
          +---- inventory.reserved ---------+
                                            |
                                            v
                                    payment.requested
                                            |
                                            v
                                     Payment Worker
                                            |
                                            v
                                      payment_db
                                            |
                              +-------------+-------------+
                              |                           |
                              v                           v
                       payment.completed          payment.failed
                              |                           |
                              +-------------+-------------+
                                            |
                                       Order Saga
                                            |
                              +-------------+-------------+
                              |                           |
                              v                           v
                         CONFIRMED          inventory.release.requested
                                                        |
                                                        v
                                               Inventory Worker
                                                        |
                                                        v
                                               inventory.released
                                                        |
                                                        v
                                                   Order Saga
                                                        |
                                                        v
                                                    CANCELLED
```

# 2. Core Architecture Principles

## Database-per-Service

Each microservice owns its database.

```text
    Order Service
        |
        +-- order_db

    Inventory Service
        |
        +-- inventory_db

    Payment Service
        |
        +-- payment_db
```

# 3. Project Structure

```text
apps/
├── api-gateway/
│
├── order-service/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── database/
│   │   ├── orders/
│   │   ├── outbox/
│   │   ├── saga/
│   │   ├── kafka/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── saga-main.ts
│   │   └── outbox-main.ts
│   ├── .env
│   ├── prisma.config.ts
│   └── package.json
│
├── inventory-service/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── database/
│   │   ├── inventory/
│   │   ├── kafka/
│   │   ├── outbox/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── worker-main.ts
│   │   └── outbox-main.ts
│   ├── .env
│   ├── prisma.config.ts
│   └── package.json
│
└── payment-service/
    ├── prisma/
    │   ├── schema.prisma
    │   └── migrations/
    ├── src/
    │   ├── database/
    │   ├── payment/
    │   ├── kafka/
    │   ├── outbox/
    │   ├── app.module.ts
    │   ├── main.ts
    │   ├── worker-main.ts
    │   └── outbox-main.ts
    ├── .env
    ├── prisma.config.ts
    └── package.json
```

# 4. Docker Infrastructure

```text
    order-platform-postgres
        localhost:5432

    order-platform-inventory-postgres
        localhost:5433

    order-platform-redis
        localhost:6379

    order-platform-kafka
        localhost:9092
```

Current database mapping:

```text
    PostgreSQL :5432
        |
        +-- order_db
        +-- payment_db

    PostgreSQL :5433
        |
        +-- inventory_db
```

Logical ownership remains separate even though Order and Payment currently share the same physical PostgreSQL container.

This can later be changed to one PostgreSQL cluster/container per service if stronger physical isolation is required.

# 5. Docker CMD

```bash
    ## Run the docker using compose
    docker compose up -d
    docker compose ps
    docker compose down
    docker compose down -v #Be careful with -v because it deletes local database/Kafka/Redis data.

    ## Order/Payment PostgreSQL:
    docker exec order-platform-postgres pg_isready -U postgres
    docker exec order-platform-inventory-postgres pg_isready -U postgres


    ## List databases:
    docker exec -it order-platform-postgres psql -U postgres -c "\l"
    docker exec -it order-platform-inventory-postgres psql -U postgres -c "\l"

    # If payment_db does not exist:
    docker exec -it order-platform-postgres psql -U postgres -c "CREATE DATABASE payment_db;"

    ## Verify:
    docker exec -it order-platform-postgres psql -U postgres -c "\l"

    ## Verify Redis
    docker exec order-platform-redis redis-cli ping #output- PONG

    ## Verify Kafka
    docker exec order-platform-kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092

    ## Create Kafka Topics
    docker exec order-platform-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic order.created --partitions 3 --replication-factor 1

    ## List Kafka Topic
    docker exec order-platform-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

# 6. Prisma Commands

```bash
    #Generate
    npx prisma generate

    #Create migration:
    npx prisma migrate dev

    #Named migration
    npx prisma migrate dev --name migration_name

    #Prisma Studio
    npx prisma studio
```

# 7.Kafka Topics

```text
    order.created
    inventory.reserved
    inventory.rejected
    payment.requested
    payment.completed
    payment.failed
    inventory.release.requested
    inventory.released
    order.confirmed
    order.cancelled
```

# 8. Successful Saga Flow

```text
    POST /orders
        |
        v
    Order API
        |
        v
    Order DB Transaction
        |
        +-- Order PENDING
        +-- Outbox order.created
        |
        v
    Order Outbox Worker
        |
        v
    Kafka
        |
        v
    Inventory Worker
        |
        +-- Reserve inventory
        +-- Outbox inventory.reserved
        |
        v
    Kafka
        |
        v
    Order Saga
        |
        +-- Outbox payment.requested
        |
        v
    Payment Worker
        |
        +-- Payment COMPLETED
        +-- Outbox payment.completed
        |
        v
    Order Saga
        |
        +-- Order CONFIRMED
        +-- Outbox order.confirmed
```

# 9. Failed Saga Flow

```text
    Order PENDING
        |
        v
    Inventory RESERVED
        |
        v
    Payment FAILED
        |
        v
    Order Saga
        |
        v
    inventory.release.requested
        |
        v
    Inventory Worker
        |
        +-- Release reservation
        +-- inventory.released
        |
        v
    Order Saga
        |
        v
    Order CANCELLED
```
