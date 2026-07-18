import axios from 'axios';

let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
if (typeof window !== 'undefined' && API_BASE_URL.includes('localhost') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:5001`;
}

const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
        headers: { Authorization: `Bearer ${token}` }
    };
};

export const fetchAnalyticsUsage = async (period: string = 'today') => {
    const response = await axios.get(`${API_BASE_URL}/api/analytics/usage?period=${period}`, getAuthHeaders());
    return response.data;
};

export const fetchGpuTelemetry = async () => {
    const response = await axios.get(`${API_BASE_URL}/api/telemetry/gpu`, getAuthHeaders());
    return response.data;
};

export const testLlmConnection = async (data: any) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => formData.append(key, data[key]));
    const response = await axios.post(`${API_BASE_URL}/api/diagnostics/test-llm`, formData, getAuthHeaders());
    return response.data;
};

export const testSttTranscription = async (file: File, modelSize: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model_size', modelSize);
    const response = await axios.postForm(`${API_BASE_URL}/api/diagnostics/test-stt`, formData, {
        headers: getAuthHeaders().headers
    });
    return response.data;
};

export const fetchOllamaModels = async () => {
    const response = await axios.get(`${API_BASE_URL}/api/diagnostics/ollama-models`, getAuthHeaders());
    return response.data;
};

export const fetchHealthStatus = async () => {
    const response = await axios.get(`${API_BASE_URL}/api/diagnostics/health`, getAuthHeaders());
    return response.data;
};

export const fetchSystemStats = async () => {
    const response = await axios.get(`${API_BASE_URL}/api/diagnostics/system-stats`, getAuthHeaders());
    return response.data;
};

export const exportAuditLogs = async (startTime: string, endTime: string) => {
    const response = await axios.get(`${API_BASE_URL}/api/diagnostics/export-logs`, {
        ...getAuthHeaders(),
        params: { start_time: startTime, end_time: endTime },
        responseType: 'blob'
    });
    
    // Trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};

export const releaseWorkers = async () => {
    const response = await axios.post(`${API_BASE_URL}/api/diagnostics/release-workers`, {}, getAuthHeaders());
    return response.data;
};

export const applyActiveModel = async (model: string) => {
    const response = await axios.post(`${API_BASE_URL}/api/diagnostics/apply-model`, { model }, getAuthHeaders());
    return response.data;
};

export const fetchActiveModelStatus = async () => {
    const response = await axios.get(`${API_BASE_URL}/api/diagnostics/model-status`, getAuthHeaders());
    return response.data;
};
