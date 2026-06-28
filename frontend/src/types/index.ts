// NeuronLedger TypeScript Type Definitions

export interface GraphNode {
  id: string;
  label?: string;
  node_type?: string;
  degree?: number;
  in_degree?: number;
  out_degree?: number;
  balance?: number;
  citations?: number;
  [key: string]: unknown;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
  label?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  node_count: number;
  edge_count: number;
  density?: number;
  is_directed?: boolean;
  is_connected?: boolean;
}

export interface GraphRecord {
  id: string;
  name: string;
  description: string;
  node_count: number;
  edge_count: number;
  created_at: string;
  graph?: GraphData;
}

export interface NodeResult {
  anomaly_score: number;
  is_anomaly: boolean;
  cluster_id: number;
  trust_score: number;
}

export interface PathNode {
  id: string;
  influence: number;
  anomaly_score: number;
  trust_score: number;
  depth: number;
}

export interface PathEdge {
  source: string;
  target: string;
  weight: number;
  influence_contribution: number;
}

export interface ExplanationPath {
  root_node: string;
  path_nodes: PathNode[];
  path_edges: PathEdge[];
  explanation: string;
}

export interface InferenceResult {
  model_version: string;
  node_results: Record<string, NodeResult>;
  anomaly_nodes: string[];
  anomaly_count: number;
  cluster_count: number;
  average_trust: number;
  confidence: number;
  explanation_paths: Record<string, ExplanationPath>;
  graph_summary: {
    node_count: number;
    edge_count: number;
    density: number;
  };
}

export interface InferenceRecord {
  id: string;
  graph_id: string;
  inference_type: string;
  confidence: number;
  anomaly_count: number;
  created_at: string;
  result?: InferenceResult;
  ledger_entry_id?: string;
}

export interface LedgerEntry {
  id: string;
  entry_index: number;
  inference_id: string;
  graph_id: string;
  timestamp: string;
  model_version: string;
  graph_state_hash: string;
  input_hash: string;
  output_hash: string;
  previous_hash: string;
  merkle_root: string;
  verification_signature: string;
  is_verified?: boolean;
  blockchain_tx_hash?: string;
}

export interface ChainVerification {
  is_valid: boolean;
  issues: Array<{ entry_index: number; issue: string; detail: string }>;
  entries_checked: number;
  chain_length: number;
}

export type AppView = 'dashboard' | 'graph' | 'inference' | 'ledger' | 'upload';
