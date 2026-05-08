-- Phase 1 schema for Member 4 — Concurrency Control demos.
-- Idempotent: every CREATE/INSERT is guarded.

CREATE SCHEMA IF NOT EXISTS m4_concurrency;

CREATE TABLE IF NOT EXISTS m4_concurrency.product_stock (
    product_id  VARCHAR(50) PRIMARY KEY REFERENCES public.products(product_id),
    stock       INT NOT NULL,
    version     INT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
-- the no-lock strategy must be able to make stock negative to demonstrate
-- oversells; the CHECK on older deployments would mask that bug, so drop it.
ALTER TABLE m4_concurrency.product_stock DROP CONSTRAINT IF EXISTS product_stock_stock_check;

CREATE TABLE IF NOT EXISTS m4_concurrency.accounts (
    account_id  VARCHAR(20) PRIMARY KEY,
    color       CHAR(1) NOT NULL CHECK (color IN ('B','W')),
    balance     INT NOT NULL
);

CREATE TABLE IF NOT EXISTS m4_concurrency.demo_counter (
    name  VARCHAR(40) PRIMARY KEY,
    value INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS m4_concurrency.run_log (
    id            SERIAL PRIMARY KEY,
    started_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    strategy      VARCHAR(40) NOT NULL,
    buyers        INT NOT NULL,
    initial_stock INT NOT NULL,
    sold          INT NOT NULL,
    oversold      INT NOT NULL,
    elapsed_ms    INT NOT NULL,
    p99_ms        INT NOT NULL,
    notes         TEXT
);
