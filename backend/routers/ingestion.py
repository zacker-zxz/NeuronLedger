"""
NeuronLedger — Data Ingestion Router
POST /api/ingest/json   — Upload node/edge JSON
POST /api/ingest/csv    — Upload transaction CSV
GET  /api/graphs        — List all graphs
GET  /api/graphs/{id}   — Get specific graph
DELETE /api/graphs/{id} — Delete graph
"""

import uuid
import json
import io
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db, GraphModel
from services.graph_builder import (
    build_graph_from_data,
    build_graph_from_csv_transactions,
)

router = APIRouter(prefix="/api", tags=["ingestion"])


class GraphJSONPayload(BaseModel):
    name: str
    description: Optional[str] = ""
    nodes: list[dict]
    edges: list[dict]


@router.post("/ingest/json")
async def ingest_json(payload: GraphJSONPayload, db: Session = Depends(get_db)):
    """Ingest graph data from a JSON payload with nodes and edges."""
    graph_id = str(uuid.uuid4())

    raw = {"nodes": payload.nodes, "edges": payload.edges}
    graph_data = build_graph_from_data(raw)

    db_graph = GraphModel(
        id=graph_id,
        name=payload.name,
        description=payload.description or "",
        node_count=graph_data["node_count"],
        edge_count=graph_data["edge_count"],
        graph_data=json.dumps(graph_data),
        created_at=datetime.utcnow(),
    )
    db.add(db_graph)
    db.commit()

    return {
        "graph_id": graph_id,
        "name": payload.name,
        "node_count": graph_data["node_count"],
        "edge_count": graph_data["edge_count"],
        "density": graph_data["density"],
        "message": "Graph created successfully",
    }


@router.post("/ingest/csv")
async def ingest_csv(
    file: UploadFile = File(...),
    name: str = Form(default="Uploaded Graph"),
    description: str = Form(default=""),
    db: Session = Depends(get_db),
):
    """Ingest transaction-style CSV file and build a graph."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV parse error: {str(e)}")

    rows = df.fillna("").to_dict(orient="records")
    graph_data = build_graph_from_csv_transactions(rows)

    graph_id = str(uuid.uuid4())
    db_graph = GraphModel(
        id=graph_id,
        name=name or file.filename,
        description=description,
        node_count=graph_data["node_count"],
        edge_count=graph_data["edge_count"],
        graph_data=json.dumps(graph_data),
        created_at=datetime.utcnow(),
    )
    db.add(db_graph)
    db.commit()

    return {
        "graph_id": graph_id,
        "name": name,
        "node_count": graph_data["node_count"],
        "edge_count": graph_data["edge_count"],
        "density": graph_data["density"],
        "message": "CSV ingested and graph created",
    }


@router.get("/graphs")
def list_graphs(db: Session = Depends(get_db)):
    """List all stored graphs."""
    graphs = db.query(GraphModel).order_by(GraphModel.created_at.desc()).all()
    return [
        {
            "id": g.id,
            "name": g.name,
            "description": g.description,
            "node_count": g.node_count,
            "edge_count": g.edge_count,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        }
        for g in graphs
    ]


@router.get("/graphs/{graph_id}")
def get_graph(graph_id: str, db: Session = Depends(get_db)):
    """Get full graph data by ID."""
    graph = db.query(GraphModel).filter(GraphModel.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")

    graph_data = json.loads(graph.graph_data)
    return {
        "id": graph.id,
        "name": graph.name,
        "description": graph.description,
        "node_count": graph.node_count,
        "edge_count": graph.edge_count,
        "created_at": graph.created_at.isoformat() if graph.created_at else None,
        "graph": graph_data,
    }


@router.delete("/graphs/{graph_id}")
def delete_graph(graph_id: str, db: Session = Depends(get_db)):
    """Delete a graph by ID."""
    graph = db.query(GraphModel).filter(GraphModel.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    db.delete(graph)
    db.commit()
    return {"message": "Graph deleted"}
