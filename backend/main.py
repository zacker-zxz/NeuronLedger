"""
NeuronLedger — FastAPI Main Application
Graph Neural AI with Verifiable Memory on a Blockchain-Like Audit Layer
"""

import json
import uuid
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, SessionLocal, GraphModel
from routers.ingestion import router as ingestion_router
from routers.inference import router as inference_router
from routers.ledger import router as ledger_router
from services.graph_builder import build_graph_from_csv_transactions, build_graph_from_data


def load_sample_data():
    """Load built-in sample datasets on startup if DB is empty."""
    db = SessionLocal()
    try:
        existing = db.query(GraphModel).count()
        if existing > 0:
            return

        # Sample 1: Wallet Transfer Graph
        wallet_nodes = [
            {"id": "W001", "label": "Alice", "node_type": "wallet", "balance": 45000},
            {"id": "W002", "label": "Bob", "node_type": "wallet", "balance": 12000},
            {"id": "W003", "label": "Carol", "node_type": "wallet", "balance": 78000},
            {"id": "W004", "label": "Dave", "node_type": "wallet", "balance": 3200},
            {"id": "W005", "label": "Eve", "node_type": "wallet", "balance": 98000},
            {"id": "W006", "label": "Frank", "node_type": "wallet", "balance": 500},
            {"id": "W007", "label": "Grace", "node_type": "wallet", "balance": 22000},
            {"id": "W008", "label": "Hank", "node_type": "wallet", "balance": 67000},
            {"id": "W009", "label": "Iris", "node_type": "wallet", "balance": 4100},
            {"id": "W010", "label": "Jack", "node_type": "wallet", "balance": 150000},
            {"id": "W011", "label": "Kate", "node_type": "wallet", "balance": 890},
            {"id": "W012", "label": "Leo", "node_type": "wallet", "balance": 33000},
            {"id": "W013", "label": "Mixer1", "node_type": "mixer", "balance": 999999},
            {"id": "W014", "label": "Mixer2", "node_type": "mixer", "balance": 888888},
            {"id": "W015", "label": "Exchange", "node_type": "exchange", "balance": 5000000},
        ]
        wallet_edges = [
            {"source": "W001", "target": "W002", "weight": 5000, "label": "transfer"},
            {"source": "W001", "target": "W003", "weight": 12000, "label": "transfer"},
            {"source": "W002", "target": "W013", "weight": 11000, "label": "suspicious"},
            {"source": "W013", "target": "W004", "weight": 10500, "label": "layering"},
            {"source": "W013", "target": "W005", "weight": 9800, "label": "layering"},
            {"source": "W003", "target": "W007", "weight": 3000, "label": "transfer"},
            {"source": "W005", "target": "W015", "weight": 55000, "label": "transfer"},
            {"source": "W006", "target": "W013", "weight": 490, "label": "suspicious"},
            {"source": "W007", "target": "W008", "weight": 2500, "label": "transfer"},
            {"source": "W008", "target": "W015", "weight": 45000, "label": "transfer"},
            {"source": "W009", "target": "W014", "weight": 4000, "label": "suspicious"},
            {"source": "W014", "target": "W010", "weight": 148000, "label": "layering"},
            {"source": "W010", "target": "W015", "weight": 140000, "label": "transfer"},
            {"source": "W011", "target": "W014", "weight": 850, "label": "suspicious"},
            {"source": "W012", "target": "W001", "weight": 8000, "label": "transfer"},
            {"source": "W012", "target": "W003", "weight": 15000, "label": "transfer"},
            {"source": "W004", "target": "W012", "weight": 2000, "label": "transfer"},
            {"source": "W015", "target": "W001", "weight": 20000, "label": "withdrawal"},
        ]

        graph_data = build_graph_from_data({"nodes": wallet_nodes, "edges": wallet_edges})
        db.add(GraphModel(
            id=str(uuid.uuid4()),
            name="Wallet Transfer Network",
            description="Cryptocurrency wallet transfer graph with potential money laundering patterns",
            node_count=graph_data["node_count"],
            edge_count=graph_data["edge_count"],
            graph_data=json.dumps(graph_data),
            created_at=datetime.utcnow(),
        ))

        # Sample 2: Research Citation Network
        citation_nodes = [
            {"id": "P001", "label": "GNN Paper 2019", "node_type": "paper", "citations": 1200},
            {"id": "P002", "label": "Attention Mechanism", "node_type": "paper", "citations": 3400},
            {"id": "P003", "label": "Graph SAGE", "node_type": "paper", "citations": 890},
            {"id": "P004", "label": "Node2Vec", "node_type": "paper", "citations": 2100},
            {"id": "P005", "label": "DeepWalk", "node_type": "paper", "citations": 1700},
            {"id": "P006", "label": "Temporal GNN", "node_type": "paper", "citations": 450},
            {"id": "P007", "label": "Anomaly GNN", "node_type": "paper", "citations": 320},
            {"id": "P008", "label": "Link Prediction", "node_type": "paper", "citations": 780},
            {"id": "P009", "label": "Blockchain AI", "node_type": "paper", "citations": 90},
            {"id": "P010", "label": "Fraud Detection", "node_type": "paper", "citations": 560},
            {"id": "A001", "label": "Kipf et al.", "node_type": "author", "h_index": 28},
            {"id": "A002", "label": "Hamilton et al.", "node_type": "author", "h_index": 22},
            {"id": "A003", "label": "Perozzi et al.", "node_type": "author", "h_index": 15},
        ]
        citation_edges = [
            {"source": "P003", "target": "P001", "weight": 1, "label": "cites"},
            {"source": "P006", "target": "P001", "weight": 1, "label": "cites"},
            {"source": "P006", "target": "P003", "weight": 1, "label": "cites"},
            {"source": "P007", "target": "P001", "weight": 1, "label": "cites"},
            {"source": "P007", "target": "P003", "weight": 1, "label": "cites"},
            {"source": "P008", "target": "P004", "weight": 1, "label": "cites"},
            {"source": "P008", "target": "P005", "weight": 1, "label": "cites"},
            {"source": "P010", "target": "P007", "weight": 1, "label": "cites"},
            {"source": "P010", "target": "P001", "weight": 1, "label": "cites"},
            {"source": "P009", "target": "P010", "weight": 1, "label": "cites"},
            {"source": "A001", "target": "P001", "weight": 5, "label": "authored"},
            {"source": "A002", "target": "P003", "weight": 5, "label": "authored"},
            {"source": "A003", "target": "P005", "weight": 5, "label": "authored"},
            {"source": "P004", "target": "P002", "weight": 1, "label": "cites"},
            {"source": "P001", "target": "P002", "weight": 1, "label": "cites"},
        ]
        citation_graph = build_graph_from_data({"nodes": citation_nodes, "edges": citation_edges})
        db.add(GraphModel(
            id=str(uuid.uuid4()),
            name="Research Citation Network",
            description="Academic paper citation graph for AI and Graph Neural Network research",
            node_count=citation_graph["node_count"],
            edge_count=citation_graph["edge_count"],
            graph_data=json.dumps(citation_graph),
            created_at=datetime.utcnow(),
        ))

        # Sample 3: Social Interaction Graph
        social_rows = [
            {"from": "User_Alpha", "to": "User_Beta", "amount": 45, "label": "message"},
            {"from": "User_Alpha", "to": "User_Gamma", "amount": 12, "label": "message"},
            {"from": "User_Beta", "to": "User_Delta", "amount": 78, "label": "message"},
            {"from": "User_Gamma", "to": "User_Epsilon", "amount": 30, "label": "message"},
            {"from": "User_Delta", "to": "User_Alpha", "amount": 22, "label": "message"},
            {"from": "User_Zeta", "to": "User_Alpha", "amount": 5, "label": "message"},
            {"from": "User_Zeta", "to": "User_Beta", "amount": 4, "label": "message"},
            {"from": "User_Zeta", "to": "User_Gamma", "amount": 6, "label": "message"},
            {"from": "User_Zeta", "to": "User_Delta", "amount": 3, "label": "message"},
            {"from": "User_Eta", "to": "User_Alpha", "amount": 90, "label": "spam"},
            {"from": "User_Eta", "to": "User_Beta", "amount": 88, "label": "spam"},
            {"from": "User_Eta", "to": "User_Gamma", "amount": 92, "label": "spam"},
            {"from": "User_Theta", "to": "User_Iota", "amount": 15, "label": "message"},
            {"from": "User_Iota", "to": "User_Kappa", "amount": 18, "label": "message"},
            {"from": "User_Kappa", "to": "User_Theta", "amount": 12, "label": "message"},
        ]
        social_graph = build_graph_from_csv_transactions(social_rows)
        db.add(GraphModel(
            id=str(uuid.uuid4()),
            name="Social Interaction Network",
            description="User interaction graph with spam detection and community patterns",
            node_count=social_graph["node_count"],
            edge_count=social_graph["edge_count"],
            graph_data=json.dumps(social_graph),
            created_at=datetime.utcnow(),
        ))

        db.commit()
        print("[OK] Sample datasets loaded successfully")

    except Exception as e:
        print(f"[WARN] Sample data load error: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    init_db()
    load_sample_data()
    yield


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="NeuronLedger API",
    description="Graph Neural AI with Verifiable Memory on a Blockchain-Like Audit Layer",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingestion_router)
app.include_router(inference_router)
app.include_router(ledger_router)


@app.get("/")
def root():
    return {
        "name": "NeuronLedger",
        "version": "1.0.0",
        "status": "operational",
        "description": "Graph Neural AI with Verifiable Memory",
    }


@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
