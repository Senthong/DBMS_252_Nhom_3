from sqlalchemy import create_engine, text

engine = create_engine("postgresql://admin:admin@localhost:5432/ecommerce")
with engine.connect() as conn:
    result = conn.execute(text("SELECT 1"))
    print("DB OK:", result.scalar())