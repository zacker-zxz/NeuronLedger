# NeuronLedger 🧠🔗

> **A Graph Neural AI with Verifiable Memory on a Blockchain-Like Audit Layer**

NeuronLedger is a research-grade AI intelligence system that learns from relational data, detects patterns in graphs, and records every decision in a tamper-evident proof ledger.

---

## What it does

| Feature | Technology |
|---|---|
| Graph construction | NetworkX directed graphs |
| Anomaly detection | Isolation Forest (scikit-learn) |
| Community detection | Louvain algorithm |
| Trust scoring | Weighted PageRank |
| Explainability | BFS influence path tracing |
| Proof ledger | SHA-256 Merkle hash chain |
| 3D visualization | Three.js + react-three-fiber |
| API | FastAPI + SQLite |

---

## Quick Start

### 1. Start the Backend

```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000  
API docs: http://localhost:8000/docs

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

---

## Architecture

```
Data Input (CSV/JSON)
       ↓
 Graph Builder (NetworkX)
       ↓
 AI Engine
  ├── Isolation Forest (anomaly detection)
  ├── Louvain clustering (community detection)
  ├── PageRank (trust scoring)
  └── BFS path tracing (explainability)
       ↓
 Proof Ledger (SHA-256 Merkle chain)
  ├── graph_state_hash
  ├── input_hash
  ├── output_hash
  ├── previous_hash (chain link)
  └── merkle_root + HMAC signature
       ↓
 3D Visualization (Three.js)
```

---

## Sample Datasets

Three datasets are pre-loaded on startup:

1. **Wallet Transfer Network** — crypto wallet graph with money laundering patterns
2. **Research Citation Network** — academic paper citation graph
3. **Social Interaction Network** — user communication graph with spam detection

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ingest/csv` | Upload CSV transaction file |
| POST | `/api/ingest/json` | Upload JSON graph |
| GET | `/api/graphs` | List all graphs |
| GET | `/api/graphs/{id}` | Get graph with full data |
| POST | `/api/inference` | Run AI analysis on a graph |
| GET | `/api/inference` | List all inference runs |
| GET | `/api/ledger` | Get full proof chain |
| GET | `/api/ledger/verify` | Verify chain integrity |

---

## The Proof Ledger

Every inference creates a chain-linked entry:

```json
{
  "entry_index": 0,
  "graph_state_hash": "sha256...",
  "input_hash": "sha256...",
  "output_hash": "sha256...",
  "previous_hash": "sha256...",
  "merkle_root": "sha256...",
  "verification_signature": "hmac-sha256...",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

Altering any entry breaks the chain — detectable immediately.

---

## Author

**Tejas Tayade** — NeuronLedger 2026  
MIT License
