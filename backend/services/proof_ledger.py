"""
NeuronLedger — Proof Ledger Service
Implements a SHA-256 Merkle hash chain for tamper-evident inference records.
Optionally writes the Merkle root to an Ethereum/Polygon network via Web3.
"""

import hashlib
import hmac
import json
import uuid
import os
from datetime import datetime, timezone
from typing import Any
from dotenv import load_dotenv

load_dotenv()

LEDGER_SECRET = b"neuronledger-proof-secret-v1"
MODEL_VERSION = "1.0.0"

WEB3_PROVIDER_URI = os.getenv("WEB3_PROVIDER_URI")
WALLET_PRIVATE_KEY = os.getenv("WALLET_PRIVATE_KEY")

if WEB3_PROVIDER_URI and WALLET_PRIVATE_KEY:
    from web3 import Web3
    from eth_account import Account
    w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER_URI))
    account = Account.from_key(WALLET_PRIVATE_KEY)
else:
    w3 = None
    account = None


def hash_data(data: Any) -> str:
    canonical = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compute_merkle_root(hashes: list[str]) -> str:
    if not hashes:
        return "0" * 64
    layer = list(hashes)
    while len(layer) > 1:
        next_layer = []
        for i in range(0, len(layer), 2):
            left = layer[i]
            right = layer[i + 1] if i + 1 < len(layer) else layer[i]
            combined = hashlib.sha256((left + right).encode()).hexdigest()
            next_layer.append(combined)
        layer = next_layer
    return layer[0]


def sign_entry(entry_data: dict) -> str:
    canonical = json.dumps(entry_data, sort_keys=True, default=str)
    sig = hmac.new(LEDGER_SECRET, canonical.encode("utf-8"), hashlib.sha256)
    return sig.hexdigest()


def anchor_to_blockchain(merkle_root: str) -> str:
    """Send a transaction with the Merkle root as data payload to the blockchain."""
    if not w3 or not account or not w3.is_connected():
        return "local_chain_only"

    try:
        tx = {
            "to": account.address,  # Send to self to minimize cost/setup
            "value": 0,
            "gas": 21000 + 68 * 32, # base gas + data gas roughly
            "gasPrice": w3.eth.gas_price,
            "nonce": w3.eth.get_transaction_count(account.address),
            "data": f"0x{merkle_root}"
        }
        
        signed_tx = w3.eth.account.sign_transaction(tx, private_key=WALLET_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        return tx_hash.hex()
    except Exception as e:
        print(f"Blockchain anchoring failed: {e}")
        return "anchoring_failed"


def create_ledger_entry(
    inference_id: str,
    graph_id: str,
    graph_data: dict,
    input_params: dict,
    output_data: dict,
    previous_hash: str,
    entry_index: int,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()

    graph_state_hash = hash_data(graph_data)
    input_hash = hash_data(input_params)
    output_hash = hash_data(output_data)

    merkle_root = compute_merkle_root([
        graph_state_hash, input_hash, output_hash, previous_hash,
    ])

    # Fire and forget blockchain anchoring
    tx_hash = anchor_to_blockchain(merkle_root)

    entry_core = {
        "id": str(uuid.uuid4()),
        "entry_index": entry_index,
        "inference_id": inference_id,
        "graph_id": graph_id,
        "timestamp": now,
        "model_version": MODEL_VERSION,
        "graph_state_hash": graph_state_hash,
        "input_hash": input_hash,
        "output_hash": output_hash,
        "previous_hash": previous_hash,
        "merkle_root": merkle_root,
        "blockchain_tx_hash": tx_hash,
    }

    entry_core["verification_signature"] = sign_entry(entry_core)
    return entry_core


def verify_entry(entry: dict) -> dict:
    expected_merkle = compute_merkle_root([
        entry["graph_state_hash"],
        entry["input_hash"],
        entry["output_hash"],
        entry["previous_hash"],
    ])

    merkle_ok = expected_merkle == entry["merkle_root"]

    entry_without_sig = {k: v for k, v in entry.items() if k != "verification_signature"}
    expected_sig = sign_entry(entry_without_sig)
    sig_ok = hmac.compare_digest(expected_sig, entry.get("verification_signature", ""))

    return {
        "is_valid": merkle_ok and sig_ok,
        "merkle_valid": merkle_ok,
        "signature_valid": sig_ok,
        "expected_merkle": expected_merkle,
        "actual_merkle": entry["merkle_root"],
    }


def verify_chain(entries: list[dict]) -> dict:
    if not entries:
        return {"is_valid": True, "issues": [], "entries_checked": 0}

    issues = []
    sorted_entries = sorted(entries, key=lambda e: e["entry_index"])

    prev_hash = "0" * 64
    for i, entry in enumerate(sorted_entries):
        if entry["previous_hash"] != prev_hash:
            issues.append({
                "entry_index": entry["entry_index"],
                "issue": "broken_chain",
                "detail": f"previous_hash mismatch at index {i}",
            })

        verification = verify_entry(entry)
        if not verification["is_valid"]:
            issues.append({
                "entry_index": entry["entry_index"],
                "issue": "tampered_entry",
                "detail": f"Merkle={verification['merkle_valid']}, Sig={verification['signature_valid']}",
            })

        prev_hash = entry["merkle_root"]

    return {
        "is_valid": len(issues) == 0,
        "issues": issues,
        "entries_checked": len(sorted_entries),
        "chain_length": len(sorted_entries),
    }
