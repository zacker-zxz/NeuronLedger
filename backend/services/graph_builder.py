"""
NeuronLedger — Graph Builder Service
Converts raw node/edge data into a NetworkX graph with rich metadata.
"""

import networkx as nx
import json
import uuid
from typing import Any
import numpy as np


def build_graph_from_data(data: dict) -> dict:
    """
    Build a NetworkX graph from uploaded node/edge data.
    
    Supported input formats:
      - {"nodes": [...], "edges": [...]}
      - CSV rows parsed as transaction/wallet data
    """
    G = nx.DiGraph()

    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    for node in nodes:
        nid = str(node.get("id", str(uuid.uuid4())))
        attrs = {k: v for k, v in node.items() if k != "id"}
        G.add_node(nid, **attrs)

    for edge in edges:
        src = str(edge.get("source", edge.get("from", "")))
        tgt = str(edge.get("target", edge.get("to", "")))
        if src and tgt:
            attrs = {k: v for k, v in edge.items() if k not in ("source", "target", "from", "to")}
            weight = float(attrs.get("weight", attrs.get("amount", attrs.get("value", 1.0)))
                           if any(k in attrs for k in ("weight", "amount", "value")) else 1.0)
            attrs["weight"] = weight
            G.add_edge(src, tgt, **attrs)

    return serialize_graph(G)


def build_graph_from_csv_transactions(rows: list[dict]) -> dict:
    """
    Build a graph from transaction-style CSV rows.
    Expected columns: from/source, to/target, amount/weight, timestamp (optional)
    """
    G = nx.DiGraph()
    
    for row in rows:
        # Detect column names flexibly
        src = str(row.get("from") or row.get("source") or row.get("sender") or "")
        tgt = str(row.get("to") or row.get("target") or row.get("receiver") or "")
        amount = float(row.get("amount") or row.get("value") or row.get("weight") or 1.0)
        timestamp = row.get("timestamp") or row.get("time") or row.get("date") or ""
        label = row.get("label") or row.get("type") or row.get("category") or ""

        if not src or not tgt:
            continue

        if not G.has_node(src):
            G.add_node(src, label=str(src), node_type="entity", degree=0)
        if not G.has_node(tgt):
            G.add_node(tgt, label=str(tgt), node_type="entity", degree=0)

        G.add_edge(src, tgt, weight=amount, timestamp=str(timestamp), label=str(label))

    # Enrich nodes with degree
    for node in G.nodes():
        G.nodes[node]["degree"] = G.degree(node)
        G.nodes[node]["in_degree"] = G.in_degree(node)
        G.nodes[node]["out_degree"] = G.out_degree(node)

    return serialize_graph(G)


def serialize_graph(G: nx.DiGraph) -> dict:
    """Convert NetworkX graph to JSON-serializable dict."""
    nodes = []
    for nid, attrs in G.nodes(data=True):
        node_data = {"id": str(nid)}
        for k, v in attrs.items():
            node_data[k] = _safe_value(v)
        # Ensure label exists
        if "label" not in node_data:
            node_data["label"] = str(nid)
        nodes.append(node_data)

    edges = []
    for src, tgt, attrs in G.edges(data=True):
        edge_data = {"source": str(src), "target": str(tgt)}
        for k, v in attrs.items():
            edge_data[k] = _safe_value(v)
        edges.append(edge_data)

    return {
        "nodes": nodes,
        "edges": edges,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "is_directed": True,
        "density": nx.density(G) if len(G.nodes) > 1 else 0.0,
        "is_connected": nx.is_weakly_connected(G) if len(G.nodes) > 0 else False,
    }


def deserialize_graph(graph_data: dict) -> nx.DiGraph:
    """Reconstruct NetworkX graph from serialized dict."""
    G = nx.DiGraph()
    for node in graph_data.get("nodes", []):
        nid = node["id"]
        attrs = {k: v for k, v in node.items() if k != "id"}
        G.add_node(nid, **attrs)
    for edge in graph_data.get("edges", []):
        src = edge["source"]
        tgt = edge["target"]
        attrs = {k: v for k, v in edge.items() if k not in ("source", "target")}
        G.add_edge(src, tgt, **attrs)
    return G


def _safe_value(v):
    """Make a value JSON-serializable."""
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    if isinstance(v, np.ndarray):
        return v.tolist()
    return v
