# DBMS Assignment – Semester 252
**Stack:** PostgreSQL 15 · Redis 7 · FastAPI · React + Vite · TailwindCSS  
**Dataset:** [Brazilian E-Commerce (Olist)](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce)

## Members & Topics
| Member | Topic | Backend port | Frontend port |
|--------|-------|-------------|---------------|
| 1 | II. Indexing | 8001 | 3001 |
| 2 | III. Query Processing | 8002 | 3002 |
| 3 | IV. Transaction | 8003 | 3003 |
| 4 | V. Concurrency Control | 8004 | 3004 |
| 5 | VI. Backup & Recovery | 8005 | 3005 |

## Quick Start

### 1. Start shared infrastructure
```bash
docker-compose up postgres redis -d
```

### 2. Load dataset
Download CSVs from Kaggle → place in `shared/init_db/data/`
```bash
pip install pandas psycopg2-binary sqlalchemy
python shared/init_db/load_dataset.py
```

### 3. Connect DBeaver
- Host: `localhost` · Port: `5432`
- Database: `ecommerce` · User: `admin` · Password: `admin`

### 4. Each member runs their module independently
```bash
cd memberX_topic/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 800X

cd memberX_topic/frontend
npm install && npm run dev
```

### 5. Run all via Docker (after each member has working code)
```bash
docker-compose up --build
```

## Project structure
```
project/
├── docker-compose.yml
├── shared/
│   ├── schemas/00_init_schemas.sql   ← auto-runs on pg start
│   └── init_db/load_dataset.py
├── member1_indexing/
│   ├── backend/  (FastAPI :8001)
│   └── frontend/ (React   :3001)
├── member2_query/       (:8002 / :3002)
├── member3_transaction/ (:8003 / :3003)
├── member4_concurrency/ (:8004 / :3004)
└── member5_backup/      (:8005 / :3005)
```
