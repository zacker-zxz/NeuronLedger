import axios from 'axios';
import type {
  GraphRecord,
  InferenceRecord,
  LedgerEntry,
  ChainVerification,
  GraphData,
} from '../types';

const api = axios.create({
  baseURL: 'https://api.zackers.tech/api',
  headers: { 'Content-Type': 'application/json' },
});

// ─── Graphs ─────────────────────────────────────────────────────────────────

export const getGraphs = () =>
  api.get<GraphRecord[]>('/graphs').then((r) => r.data);

export const getGraph = (id: string) =>
  api.get<GraphRecord & { graph: GraphData }>(`/graphs/${id}`).then((r) => r.data);

export const deleteGraph = (id: string) =>
  api.delete(`/graphs/${id}`).then((r) => r.data);

export const ingestJSON = (payload: {
  name: string;
  description: string;
  nodes: object[];
  edges: object[];
}) => api.post('/ingest/json', payload).then((r) => r.data);

export const ingestCSV = (file: File, name: string) => {
  const form = new FormData();
  form.append('file', file);
  form.append('name', name);
  return axios
    .post('/api/ingest/csv', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};

// ─── Inference ───────────────────────────────────────────────────────────────

export const runInference = (graphId: string) =>
  api
    .post('/inference', { graph_id: graphId, inference_type: 'full' })
    .then((r) => r.data);

export const getInferences = () =>
  api.get<InferenceRecord[]>('/inference').then((r) => r.data);

export const getInference = (id: string) =>
  api.get<InferenceRecord>(`/inference/${id}`).then((r) => r.data);

// ─── Ledger ──────────────────────────────────────────────────────────────────

export const getLedger = () =>
  api.get<LedgerEntry[]>('/ledger').then((r) => r.data);

export const getLedgerEntry = (id: string) =>
  api.get<LedgerEntry>(`/ledger/${id}`).then((r) => r.data);

export const verifyChain = () =>
  api.get<ChainVerification>('/ledger/verify').then((r) => r.data);

export const verifyEntry = (id: string) =>
  api.get(`/ledger/verify/${id}`).then((r) => r.data);

export const resetLedger = () =>
  api.delete('/ledger/reset').then((r) => r.data);
