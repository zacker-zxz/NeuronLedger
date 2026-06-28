"""
NeuronLedger — Ledger Router
GET  /api/ledger          — List all ledger entries
GET  /api/ledger/{id}     — Get specific entry
GET  /api/ledger/verify   — Verify entire chain integrity
GET  /api/ledger/verify/{id} — Verify single entry
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, LedgerEntryModel
from services.proof_ledger import verify_entry, verify_chain

router = APIRouter(prefix="/api", tags=["ledger"])


@router.get("/ledger")
def list_ledger_entries(db: Session = Depends(get_db)):
    """List all ledger entries in chain order."""
    entries = (
        db.query(LedgerEntryModel)
        .order_by(LedgerEntryModel.entry_index.asc())
        .all()
    )
    return [
        {
            "id": e.id,
            "entry_index": e.entry_index,
            "inference_id": e.inference_id,
            "graph_id": e.graph_id,
            "timestamp": e.timestamp,
            "model_version": e.model_version,
            "graph_state_hash": e.graph_state_hash,
            "input_hash": e.input_hash,
            "output_hash": e.output_hash,
            "previous_hash": e.previous_hash,
            "merkle_root": e.merkle_root,
            "verification_signature": e.verification_signature,
            "is_verified": e.is_verified,
            "blockchain_tx_hash": e.blockchain_tx_hash,
        }
        for e in entries
    ]


@router.get("/ledger/verify")
def verify_full_chain(db: Session = Depends(get_db)):
    """Verify the integrity of the entire ledger chain."""
    entries = (
        db.query(LedgerEntryModel)
        .order_by(LedgerEntryModel.entry_index.asc())
        .all()
    )

    entry_dicts = [
        {
            "id": e.id,
            "entry_index": e.entry_index,
            "inference_id": e.inference_id,
            "graph_id": e.graph_id,
            "timestamp": e.timestamp,
            "model_version": e.model_version,
            "graph_state_hash": e.graph_state_hash,
            "input_hash": e.input_hash,
            "output_hash": e.output_hash,
            "previous_hash": e.previous_hash,
            "merkle_root": e.merkle_root,
            "verification_signature": e.verification_signature,
            "blockchain_tx_hash": e.blockchain_tx_hash,
        }
        for e in entries
    ]

    result = verify_chain(entry_dicts)
    return result


@router.get("/ledger/verify/{entry_id}")
def verify_single_entry(entry_id: str, db: Session = Depends(get_db)):
    """Verify a single ledger entry's integrity."""
    entry = db.query(LedgerEntryModel).filter(LedgerEntryModel.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")

    entry_dict = {
        "id": entry.id,
        "entry_index": entry.entry_index,
        "inference_id": entry.inference_id,
        "graph_id": entry.graph_id,
        "timestamp": entry.timestamp,
        "model_version": entry.model_version,
        "graph_state_hash": entry.graph_state_hash,
        "input_hash": entry.input_hash,
        "output_hash": entry.output_hash,
        "previous_hash": entry.previous_hash,
        "merkle_root": entry.merkle_root,
        "verification_signature": entry.verification_signature,
        "blockchain_tx_hash": entry.blockchain_tx_hash,
    }

    return verify_entry(entry_dict)


@router.get("/ledger/{entry_id}")
def get_ledger_entry(entry_id: str, db: Session = Depends(get_db)):
    """Get a specific ledger entry by ID."""
    entry = db.query(LedgerEntryModel).filter(LedgerEntryModel.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")

    return {
        "id": entry.id,
        "entry_index": entry.entry_index,
        "inference_id": entry.inference_id,
        "graph_id": entry.graph_id,
        "timestamp": entry.timestamp,
        "model_version": entry.model_version,
        "graph_state_hash": entry.graph_state_hash,
        "input_hash": entry.input_hash,
        "output_hash": entry.output_hash,
        "previous_hash": entry.previous_hash,
        "merkle_root": entry.merkle_root,
        "verification_signature": entry.verification_signature,
        "is_verified": entry.is_verified,
        "blockchain_tx_hash": entry.blockchain_tx_hash,
    }

@router.delete("/ledger/reset")
def reset_ledger(db: Session = Depends(get_db)):
    """DANGER: Delete all ledger entries. DEV ONLY."""
    db.query(LedgerEntryModel).delete()
    db.commit()
    return {"status": "success", "message": "Ledger reset"}
