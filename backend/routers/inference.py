"""
NeuronLedger — Inference Router
POST /api/inference/{graph_id}   — Run full AI analysis
GET  /api/inference               — List all inferences
GET  /api/inference/{id}          — Get inference result
"""

import uuid
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db, GraphModel, InferenceModel, LedgerEntryModel
from services.ai_engine import run_full_inference
from services.proof_ledger import create_ledger_entry

router = APIRouter(prefix="/api", tags=["inference"])


class InferenceRequest(BaseModel):
    graph_id: str
    inference_type: Optional[str] = "full"


@router.post("/inference")
def run_inference(request: InferenceRequest, db: Session = Depends(get_db)):
    """Run AI inference on a stored graph and create a ledger proof entry."""
    graph = db.query(GraphModel).filter(GraphModel.id == request.graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")

    graph_data = json.loads(graph.graph_data)

    # Run AI analysis
    result = run_full_inference(graph_data)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # Store inference result
    inference_id = str(uuid.uuid4())
    db_inference = InferenceModel(
        id=inference_id,
        graph_id=request.graph_id,
        inference_type=request.inference_type or "full",
        result_data=json.dumps(result),
        confidence=result.get("confidence", 0.0),
        anomaly_count=result.get("anomaly_count", 0),
        created_at=datetime.utcnow(),
    )
    db.add(db_inference)
    db.flush()  # get ID before ledger entry

    # Get the last ledger entry to chain from
    last_entry = (
        db.query(LedgerEntryModel)
        .order_by(LedgerEntryModel.entry_index.desc())
        .first()
    )
    previous_hash = last_entry.merkle_root if last_entry else "0" * 64
    entry_index = (last_entry.entry_index + 1) if last_entry else 0

    # Create tamper-evident proof entry
    ledger_data = create_ledger_entry(
        inference_id=inference_id,
        graph_id=request.graph_id,
        graph_data=graph_data,
        input_params={"graph_id": request.graph_id, "type": request.inference_type},
        output_data={
            "anomaly_count": result.get("anomaly_count"),
            "confidence": result.get("confidence"),
            "cluster_count": result.get("cluster_count"),
            "average_trust": result.get("average_trust"),
        },
        previous_hash=previous_hash,
        entry_index=entry_index,
    )

    db_ledger = LedgerEntryModel(
        id=ledger_data["id"],
        entry_index=ledger_data["entry_index"],
        inference_id=inference_id,
        graph_id=request.graph_id,
        timestamp=ledger_data["timestamp"],
        graph_state_hash=ledger_data["graph_state_hash"],
        input_hash=ledger_data["input_hash"],
        output_hash=ledger_data["output_hash"],
        model_version=ledger_data["model_version"],
        previous_hash=ledger_data["previous_hash"],
        merkle_root=ledger_data["merkle_root"],
        verification_signature=ledger_data["verification_signature"],
        is_verified=True,
        blockchain_tx_hash=ledger_data.get("blockchain_tx_hash"),
    )
    db.add(db_ledger)
    db.commit()

    return {
        "inference_id": inference_id,
        "graph_id": request.graph_id,
        "result": result,
        "ledger_entry": {
            "id": ledger_data["id"],
            "entry_index": entry_index,
            "merkle_root": ledger_data["merkle_root"],
            "timestamp": ledger_data["timestamp"],
        },
    }


@router.get("/inference")
def list_inferences(db: Session = Depends(get_db)):
    """List all stored inferences."""
    inferences = (
        db.query(InferenceModel)
        .order_by(InferenceModel.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": i.id,
            "graph_id": i.graph_id,
            "inference_type": i.inference_type,
            "confidence": i.confidence,
            "anomaly_count": i.anomaly_count,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in inferences
    ]


@router.get("/inference/{inference_id}")
def get_inference(inference_id: str, db: Session = Depends(get_db)):
    """Get full inference result by ID."""
    inference = db.query(InferenceModel).filter(InferenceModel.id == inference_id).first()
    if not inference:
        raise HTTPException(status_code=404, detail="Inference not found")

    result_data = json.loads(inference.result_data)
    ledger = db.query(LedgerEntryModel).filter(
        LedgerEntryModel.inference_id == inference_id
    ).first()

    return {
        "id": inference.id,
        "graph_id": inference.graph_id,
        "inference_type": inference.inference_type,
        "confidence": inference.confidence,
        "anomaly_count": inference.anomaly_count,
        "created_at": inference.created_at.isoformat() if inference.created_at else None,
        "result": result_data,
        "ledger_entry_id": ledger.id if ledger else None,
    }
