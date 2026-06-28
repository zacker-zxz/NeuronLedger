"""
NeuronLedger — AI Engine
Runs anomaly detection, clustering, trust scoring, and inference on graphs.
Uses OpenAI for explanation generation if configured.
"""

import networkx as nx
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN
import os
import json
from typing import Any
from dotenv import load_dotenv

from services.graph_builder import deserialize_graph

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    model = None

MODEL_VERSION = "1.1.0-Gemini" if GEMINI_API_KEY else "1.1.0-Local"


def run_full_inference(graph_data: dict) -> dict:
    """
    Run all analysis passes on a graph and return a unified result.
    """
    G = deserialize_graph(graph_data)

    if len(G.nodes()) == 0:
        return {"error": "Graph has no nodes"}

    # Feature matrix
    features, node_ids = extract_node_features(G)

    # Run all analysis passes
    anomaly_scores = detect_anomalies(G, features, node_ids)
    cluster_labels = detect_clusters(G, features, node_ids)
    trust_scores = compute_trust_scores(G, node_ids)

    # Build per-node results
    node_results = {}
    for i, nid in enumerate(node_ids):
        node_results[nid] = {
            "anomaly_score": round(float(anomaly_scores.get(nid, 0.0)), 4),
            "is_anomaly": anomaly_scores.get(nid, 0.0) > 0.65,
            "cluster_id": int(cluster_labels.get(nid, -1)),
            "trust_score": round(float(trust_scores.get(nid, 0.5)), 4),
        }

    # Explanation paths for top anomalies
    anomaly_nodes = [nid for nid, data in node_results.items() if data["is_anomaly"]]
    explanation_paths = {}
    for anid in anomaly_nodes[:5]:  # top 5 anomalies
        explanation_paths[anid] = trace_explanation_path(G, anid, node_results)

    # Summary stats
    anomaly_count = len(anomaly_nodes)
    cluster_count = len(set(v for v in cluster_labels.values() if v >= 0))
    avg_trust = float(np.mean(list(trust_scores.values()))) if trust_scores else 0.5
    confidence = compute_confidence(G, anomaly_count, cluster_count)

    return {
        "model_version": MODEL_VERSION,
        "node_results": node_results,
        "anomaly_nodes": anomaly_nodes,
        "anomaly_count": anomaly_count,
        "cluster_count": cluster_count,
        "average_trust": round(avg_trust, 4),
        "confidence": round(confidence, 4),
        "explanation_paths": explanation_paths,
        "graph_summary": {
            "node_count": len(G.nodes()),
            "edge_count": len(G.edges()),
            "density": round(nx.density(G), 6),
        }
    }


def extract_node_features(G: nx.DiGraph) -> tuple[np.ndarray, list]:
    node_ids = list(G.nodes())
    try:
        pr = nx.pagerank(G, weight="weight")
    except Exception:
        pr = {n: 1.0 / len(node_ids) for n in node_ids}
    try:
        bc = nx.betweenness_centrality(G, weight="weight", normalized=True)
    except Exception:
        bc = {n: 0.0 for n in node_ids}
    try:
        G_und = G.to_undirected()
        cc = nx.clustering(G_und, weight="weight")
    except Exception:
        cc = {n: 0.0 for n in node_ids}

    features = []
    for nid in node_ids:
        in_deg = G.in_degree(nid, weight="weight") or 0
        out_deg = G.out_degree(nid, weight="weight") or 0
        total_deg = G.degree(nid, weight="weight") or 0
        
        in_weights = [d.get("weight", 1.0) for _, _, d in G.in_edges(nid, data=True)]
        out_weights = [d.get("weight", 1.0) for _, _, d in G.out_edges(nid, data=True)]
        
        avg_in_w = float(np.mean(in_weights)) if in_weights else 0.0
        avg_out_w = float(np.mean(out_weights)) if out_weights else 0.0
        max_in_w = float(np.max(in_weights)) if in_weights else 0.0
        max_out_w = float(np.max(out_weights)) if out_weights else 0.0

        row = [
            float(in_deg), float(out_deg), float(total_deg),
            float(pr.get(nid, 0.0)), float(bc.get(nid, 0.0)), float(cc.get(nid, 0.0)),
            avg_in_w, avg_out_w, max_in_w, max_out_w,
        ]
        features.append(row)

    return np.array(features, dtype=float), node_ids


def detect_anomalies(G: nx.DiGraph, features: np.ndarray, node_ids: list) -> dict:
    if len(node_ids) < 3:
        return {nid: 0.0 for nid in node_ids}

    scaler = StandardScaler()
    X = scaler.fit_transform(features)

    contamination = min(0.2, max(0.05, 5 / len(node_ids)))
    clf = IsolationForest(n_estimators=100, contamination=contamination, random_state=42)
    clf.fit(X)

    raw_scores = clf.decision_function(X)
    min_s, max_s = raw_scores.min(), raw_scores.max()
    if max_s > min_s:
        normalized = 1.0 - (raw_scores - min_s) / (max_s - min_s)
    else:
        normalized = np.full_like(raw_scores, 0.5)

    return {nid: float(score) for nid, score in zip(node_ids, normalized)}


def detect_clusters(G: nx.DiGraph, features: np.ndarray, node_ids: list) -> dict:
    if len(node_ids) < 3:
        return {nid: 0 for nid in node_ids}

    scaler = StandardScaler()
    X = scaler.fit_transform(features)

    try:
        G_und = G.to_undirected()
        communities = nx.community.louvain_communities(G_und, seed=42)
        community_map = {}
        for cid, community in enumerate(communities):
            for node in community:
                community_map[str(node)] = cid
        return {nid: community_map.get(str(nid), -1) for nid in node_ids}
    except Exception:
        pass

    eps = max(0.5, np.percentile(np.std(X, axis=0), 50))
    db = DBSCAN(eps=eps, min_samples=2)
    labels = db.fit_predict(X)
    return {nid: int(label) for nid, label in zip(node_ids, labels)}


def compute_trust_scores(G: nx.DiGraph, node_ids: list) -> dict:
    try:
        pr = nx.pagerank(G, weight="weight", alpha=0.85)
    except Exception:
        pr = {n: 1.0 / max(len(node_ids), 1) for n in node_ids}

    values = np.array([pr.get(nid, 0.0) for nid in node_ids])
    min_v, max_v = values.min(), values.max()
    if max_v > min_v:
        normalized = (values - min_v) / (max_v - min_v)
    else:
        normalized = np.full_like(values, 0.5)

    return {nid: float(score) for nid, score in zip(node_ids, normalized)}


def generate_llm_explanation(anomaly_node: str, node_results: dict, path_nodes: list, path_edges: list) -> str:
    """Uses Gemini to explain why the node was flagged."""
    if not model:
        return f"Node '{anomaly_node}' shows anomalous behavior due to unusual connectivity patterns and edge weight distribution among its nearest neighbors."
        
    try:
        context = {
            "target_node": anomaly_node,
            "target_anomaly_score": node_results.get(anomaly_node, {}).get("anomaly_score", 0),
            "influencing_nodes": path_nodes,
            "connecting_edges": path_edges
        }
        prompt = f"""
You are the AI explanation engine for a Graph Neural System (NeuronLedger).
An anomaly was detected. Review the graph context and explain concisely (2-3 sentences) why this node is suspicious.
Use professional, analytic tone. Do not use markdown.

Graph Context:
{json.dumps(context, indent=2)}
"""
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                max_output_tokens=150,
                temperature=0.3,
            )
        )
        return response.text.strip()
    except Exception as e:
        print(f"LLM Explanation failed: {e}")
        error_str = str(e).lower()
        if "429" in error_str or "quota" in error_str:
            return f"⚠️ ERROR: Gemini Quota Exceeded. The AI explanation could not be generated. Please check your billing details."
        return f"Node '{anomaly_node}' is statistically anomalous based on local subgraph structure."


def trace_explanation_path(G: nx.DiGraph, anomaly_node: str, node_results: dict, max_depth: int = 3) -> dict:
    path_nodes = []
    path_edges = []
    visited = set()
    queue = [(anomaly_node, 0, 1.0)]

    while queue:
        node, depth, influence = queue.pop(0)
        if node in visited or depth > max_depth:
            continue
        visited.add(node)

        node_info = node_results.get(node, {})
        path_nodes.append({
            "id": node,
            "influence": round(influence, 4),
            "anomaly_score": node_info.get("anomaly_score", 0.0),
            "trust_score": node_info.get("trust_score", 0.5),
            "depth": depth,
        })

        if depth < max_depth:
            neighbors = list(G.predecessors(node)) + list(G.successors(node))
            for neighbor in neighbors[:4]:  # limit fan-out
                edge_data = G.get_edge_data(node, neighbor) or G.get_edge_data(neighbor, node) or {}
                edge_weight = float(edge_data.get("weight", 1.0))
                child_influence = influence * (edge_weight / max(1.0, edge_weight)) * 0.7

                path_edges.append({
                    "source": node,
                    "target": neighbor,
                    "weight": round(edge_weight, 4),
                    "influence_contribution": round(child_influence, 4),
                })
                queue.append((neighbor, depth + 1, child_influence))

    explanation = generate_llm_explanation(anomaly_node, node_results, path_nodes, path_edges)

    return {
        "root_node": anomaly_node,
        "path_nodes": path_nodes,
        "path_edges": path_edges,
        "explanation": explanation,
    }


def compute_confidence(G: nx.DiGraph, anomaly_count: int, cluster_count: int) -> float:
    n = len(G.nodes())
    if n == 0: return 0.0
    size_factor = min(1.0, n / 50.0)
    connectivity = nx.density(G) if n > 1 else 0.0
    cluster_clarity = min(1.0, cluster_count / max(1, n * 0.2))
    return 0.4 * size_factor + 0.3 * (1.0 - connectivity) + 0.3 * cluster_clarity
