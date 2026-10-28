import { apiGet, apiPost } from '../api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const BASE = '/api/v1/equipment';

/* ---------- selected branch (hash id only, never a numeric id) ---------- */
const BRANCH_KEY = 'gym_selected_branch';
export const getSelectedBranch = () => localStorage.getItem(BRANCH_KEY) || 'all';
export const setSelectedBranch = (hash) => localStorage.setItem(BRANCH_KEY, hash || 'all');

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') p.append(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

const authHeaders = () => {
  const token = localStorage.getItem('gym_access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const send = async (method, endpoint, payload) => {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: authHeaders(),
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await response.json().catch(() => null);
    return data || { success: false, message: `Request failed with status code ${response.status}.` };
  } catch {
    return { success: false, message: 'Network connectivity error. Please check your connection.' };
  }
};

// Authenticated file download (CSV export)
export const downloadFile = async (endpoint, fallbackName) => {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, { headers: authHeaders() });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      return { success: false, message: err?.message || 'Could not download the file.' };
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = match ? match[1] : fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { success: true, message: 'Download started.' };
  } catch {
    return { success: false, message: 'Network connectivity error. Please check your connection.' };
  }
};

export const eqApi = {
  // ----- Reads -----
  lookups: () => apiGet(`${BASE}/lookups`),
  stats: (branch) => apiGet(`${BASE}/stats${qs({ branch })}`),
  list: (params) => apiGet(`${BASE}${qs(params)}`),
  detail: (id) => apiGet(`${BASE}/${id}`),
  byQr: (token) => apiGet(`${BASE}/qr/${token}`),
  categories: () => apiGet(`${BASE}/categories`),
  incidents: (params) => apiGet(`${BASE}/incidents${qs(params)}`),
  maintenance: (params) => apiGet(`${BASE}/maintenance${qs(params)}`),
  plans: (params) => apiGet(`${BASE}/plans${qs(params)}`),
  parts: (params) => apiGet(`${BASE}/parts${qs(params)}`),
  contracts: (params) => apiGet(`${BASE}/contracts${qs(params)}`),
  transfers: (params) => apiGet(`${BASE}/transfers${qs(params)}`),
  exportCsv: (params) => downloadFile(`${BASE}/export${qs(params)}`, 'equipment.csv'),

  // ----- Equipment -----
  createEquipment: (body) => apiPost(BASE, body),
  bulkImport: (body) => apiPost(`${BASE}/bulk`, body),
  updateEquipment: (id, body) => send('PATCH', `${BASE}/${id}`, body),
  setEquipmentStatus: (id, body) => send('PATCH', `${BASE}/${id}/status`, body),
  deleteEquipment: (id) => send('DELETE', `${BASE}/${id}`),
  addInspection: (id, body) => apiPost(`${BASE}/${id}/inspections`, body),
  addAttachment: (id, body) => apiPost(`${BASE}/${id}/attachments`, body),
  deleteAttachment: (attId) => send('DELETE', `${BASE}/attachments/${attId}`),

  // ----- Categories -----
  createCategory: (body) => apiPost(`${BASE}/categories`, body),
  updateCategory: (id, body) => send('PATCH', `${BASE}/categories/${id}`, body),
  deleteCategory: (id) => send('DELETE', `${BASE}/categories/${id}`),

  // ----- Breakdown tickets -----
  reportIncident: (body) => apiPost(`${BASE}/incidents/report`, body),
  setIncidentStatus: (id, body) => send('PATCH', `${BASE}/incidents/${id}/status`, body),
  resolveIncident: (id, body) => send('PATCH', `${BASE}/incidents/${id}/resolve`, body),

  // ----- Maintenance work orders -----
  scheduleMaintenance: (body) => apiPost(`${BASE}/maintenance/schedule`, body),
  runScheduler: () => apiPost(`${BASE}/maintenance/run-scheduler`, {}),
  startMaintenance: (id) => send('PATCH', `${BASE}/maintenance/${id}/start`, {}),
  completeMaintenance: (id, body) => send('PATCH', `${BASE}/maintenance/${id}/complete`, body),
  cancelMaintenance: (id, body) => send('PATCH', `${BASE}/maintenance/${id}/cancel`, body),

  // ----- Preventive plans -----
  createPlan: (body) => apiPost(`${BASE}/plans`, body),
  updatePlan: (id, body) => send('PATCH', `${BASE}/plans/${id}`, body),
  deletePlan: (id) => send('DELETE', `${BASE}/plans/${id}`),

  // ----- Spare parts -----
  createPart: (body) => apiPost(`${BASE}/parts`, body),
  updatePart: (id, body) => send('PATCH', `${BASE}/parts/${id}`, body),
  restockPart: (id, body) => apiPost(`${BASE}/parts/${id}/restock`, body),

  // ----- Contracts -----
  createContract: (body) => apiPost(`${BASE}/contracts`, body),
  updateContract: (id, body) => send('PATCH', `${BASE}/contracts/${id}`, body),
  assignContract: (id, body) => apiPost(`${BASE}/contracts/${id}/assign`, body),

  // ----- Transfers -----
  requestTransfer: (body) => apiPost(`${BASE}/transfers`, body),
  decideTransfer: (id, body) => send('PATCH', `${BASE}/transfers/${id}/decision`, body),
};