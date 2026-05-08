CREATE SCHEMA IF NOT EXISTS m1_indexing;
CREATE SCHEMA IF NOT EXISTS m2_query;
CREATE SCHEMA IF NOT EXISTS m3_transaction;
CREATE SCHEMA IF NOT EXISTS m4_concurrency;
CREATE SCHEMA IF NOT EXISTS m5_backup;

CREATE TABLE IF NOT EXISTS public.customers (
    customer_id         VARCHAR(50) PRIMARY KEY,
    customer_unique_id  VARCHAR(50),
    customer_zip_code_prefix   VARCHAR(10),
    customer_city       VARCHAR(100),
    customer_state      CHAR(2)
);
CREATE TABLE IF NOT EXISTS public.sellers (
    seller_id       VARCHAR(50) PRIMARY KEY,
    seller_zip_code_prefix VARCHAR(10),
    seller_city     VARCHAR(100),
    seller_state    CHAR(2)
);
CREATE TABLE IF NOT EXISTS public.products (
    product_id                    VARCHAR(50) PRIMARY KEY,
    product_category_name         VARCHAR(100),
    product_name_lenght           INT,
    product_description_lenght    INT,
    product_photos_qty            INT,
    product_weight_g              NUMERIC,
    product_length_cm             NUMERIC,
    product_height_cm             NUMERIC,
    product_width_cm              NUMERIC
);
CREATE TABLE IF NOT EXISTS public.orders (
    order_id                          VARCHAR(50) PRIMARY KEY,
    customer_id                       VARCHAR(50) REFERENCES public.customers(customer_id),
    order_status                      VARCHAR(20),
    order_purchase_timestamp          TIMESTAMP,
    order_approved_at                 TIMESTAMP,
    order_delivered_carrier_date      TIMESTAMP,
    order_delivered_customer_date     TIMESTAMP,
    order_estimated_delivery_date     TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.order_items (
    order_id            VARCHAR(50) REFERENCES public.orders(order_id),
    order_item_id       INT,
    product_id          VARCHAR(50) REFERENCES public.products(product_id),
    seller_id           VARCHAR(50) REFERENCES public.sellers(seller_id),
    shipping_limit_date TIMESTAMP,
    price               NUMERIC(10,2),
    freight_value       NUMERIC(10,2),
    PRIMARY KEY (order_id, order_item_id)
);
CREATE TABLE IF NOT EXISTS public.order_payments (
    order_id             VARCHAR(50) REFERENCES public.orders(order_id),
    payment_sequential   INT,
    payment_type         VARCHAR(30),
    payment_installments INT,
    payment_value        NUMERIC(10,2),
    PRIMARY KEY (order_id, payment_sequential)
);
CREATE TABLE IF NOT EXISTS public.order_reviews (
    review_id               VARCHAR(50),
    order_id                VARCHAR(50) REFERENCES public.orders(order_id),
    review_score            INT CHECK (review_score BETWEEN 1 AND 5),
    review_comment_title    TEXT,
    review_comment_message  TEXT,
    review_creation_date    TIMESTAMP,
    review_answer_timestamp TIMESTAMP,
    PRIMARY KEY (review_id, order_id)
);
-- ✅ Added
CREATE TABLE IF NOT EXISTS public.geolocation (
    geolocation_zip_code_prefix VARCHAR(10),
    geolocation_lat             NUMERIC(9,6),
    geolocation_lng             NUMERIC(9,6),
    geolocation_city            VARCHAR(100),
    geolocation_state           CHAR(2)
    -- No PK: one zip code maps to multiple coordinates
);

-- ✅ Added
CREATE TABLE IF NOT EXISTS public.product_category_name_translation (
    product_category_name         VARCHAR(100) PRIMARY KEY,
    product_category_name_english VARCHAR(100)
);
