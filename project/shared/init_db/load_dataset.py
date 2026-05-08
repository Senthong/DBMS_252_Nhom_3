"""
Run after downloading the Brazilian E-Commerce dataset from Kaggle:
https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce

Place CSV files in shared/init_db/data/ then run:
    pip install pandas psycopg2-binary python-dotenv sqlalchemy
    python load_dataset.py
"""
import json
import os
import pandas as pd
import redis
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin@localhost:5432/ecommerce")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

TABLE_MAP = {
    "olist_customers_dataset.csv":              "customers",
    "olist_sellers_dataset.csv":                "sellers",
    "olist_products_dataset.csv":               "products",
    "olist_orders_dataset.csv":                 "orders",
    "olist_order_items_dataset.csv":            "order_items",
    "olist_order_payments_dataset.csv":         "order_payments",
    "olist_order_reviews_dataset.csv":          "order_reviews",
    "olist_geolocation_dataset.csv":            "geolocation",
    "product_category_name_translation.csv":    "product_category_name_translation",
}

# Mapping Primary Keys for Redis key construction
PK_MAP = {
    "customers":      ["customer_id"],
    "sellers":        ["seller_id"],
    "products":       ["product_id"],
    "orders":         ["order_id"],
    "order_items":    ["order_id", "order_item_id"],       # Composite key
    "order_payments": ["order_id", "payment_sequential"],  # Composite key
    "order_reviews":  ["review_id"],
}


def load():
    engine = create_engine(DATABASE_URL)
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

    for csv_file, table in TABLE_MAP.items():
        path = os.path.join(DATA_DIR, csv_file)
        if not os.path.exists(path):
            print(f"[SKIP] {csv_file} not found")
            continue

        df = pd.read_csv(path)

        # ── PostgreSQL load (SQLAlchemy 2.x compatible) ──────────────────────
        with engine.begin() as conn:
            df.to_sql(
                name=table,
                con=conn,
                # schema="public",  ← xóa dòng này
                if_exists="append",
                index=False,
                method="multi",
                chunksize=1000,
            )
        print(f"[PG]    Loaded {len(df):>7,} rows  → public.{table}")

        # ── Redis load ────────────────────────────────────────────────────────
        records = json.loads(df.to_json(orient="records"))
        pks = PK_MAP.get(table, [])
        pipe = redis_client.pipeline()

        for i, record in enumerate(records):
            if pks:
                key = f"{table}:" + ":".join(str(record[pk]) for pk in pks)
            else:
                key = f"{table}:{i}"  # fallback if table has no PK defined

            pipe.set(key, json.dumps(record))

            # Flush pipeline every 10k records to avoid memory buildup
            if (i + 1) % 10_000 == 0:
                pipe.execute()
                pipe = redis_client.pipeline()  # Reset pipeline after flush

        pipe.execute()  # Flush remaining records
        print(f"[Redis] Loaded {len(records):>7,} keys → prefix '{table}:'")


if __name__ == "__main__":
    load()