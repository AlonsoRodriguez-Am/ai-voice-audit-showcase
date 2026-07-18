import React, { useState, useEffect } from 'react';
import { fetchAnalyticsUsage, fetchGpuTelemetry } from '../api/diagnostics';

const AnalyticsPage: React.FC = () => {
    const [period, setPeriod] = useState('today');
    const [providerFilter, setProviderFilter] = useState('global');
    
    const [analytics, setAnalytics] = useState<any[]>([]);
    const [telemetry, setTelemetry] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const data = await fetchAnalyticsUsage(period);
            setAnalytics(data);
        } catch (error) {
            console.error("Error loading analytics", error);
        } finally {
            setLoading(false);
        }
    };

    const loadTelemetry = async () => {
        try {
            const data = await fetchGpuTelemetry();
            setTelemetry(data);
        } catch (error) {
            console.error("Error loading telemetry", error);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, [period]);

    useEffect(() => {
        loadTelemetry();
        const interval = setInterval(loadTelemetry, 5000); // refresh every 5s
        return () => clearInterval(interval);
    }, []);

    const filteredAnalytics = analytics.filter(row => {
        if (providerFilter === 'global') return true;
        if (providerFilter === 'local') return row.provider.toLowerCase() === 'ollama';
        if (providerFilter === 'external') return ['google', 'openai', 'claude', 'grok', 'gemini'].includes(row.provider.toLowerCase());
        return true;
    });

    const totalTokens = filteredAnalytics.reduce((sum, r) => sum + r.total_tokens, 0);
    const totalRequests = filteredAnalytics.reduce((sum, r) => sum + r.requests, 0);
    const totalCost = filteredAnalytics.reduce((sum, r) => sum + (r.estimated_cost || 0), 0);

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">AI Infrastructure & Analytics</h1>

            {/* GPU Telemetry Zone */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Hardware Telemetry (Real-time)</h2>
                {telemetry ? (
                    telemetry.available ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {telemetry.gpus.map((gpu: any) => (
                                <div key={gpu.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                    <h3 className="font-bold text-gray-800">{gpu.name}</h3>
                                    <div className="mt-4 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">GPU Utilization</span>
                                            <span className="font-semibold">{gpu.gpu_utilization_percent}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${gpu.gpu_utilization_percent}%` }}></div>
                                        </div>
                                        
                                        <div className="flex justify-between text-sm mt-4">
                                            <span className="text-gray-500">VRAM Usage</span>
                                            <span className="font-semibold">{gpu.memory_used_mb}MB / {gpu.memory_total_mb}MB</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${gpu.memory_utilization_percent}%` }}></div>
                                        </div>

                                        <div className="flex justify-between text-sm mt-4">
                                            <span className="text-gray-500">Temperature</span>
                                            <span className={`font-semibold ${gpu.temperature_c > 80 ? 'text-red-600' : 'text-green-600'}`}>
                                                {gpu.temperature_c}°C
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-800">System Resources</h3>
                                <div className="mt-4 space-y-2 text-sm">
                                    <p><span className="text-gray-500">CPU Usage:</span> {telemetry.system.cpu_percent}%</p>
                                    <p><span className="text-gray-500">RAM Usage:</span> {telemetry.system.ram_used_mb}MB / {telemetry.system.ram_total_mb}MB ({telemetry.system.ram_percent}%)</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md border border-yellow-200">
                            {telemetry.message || "Telemetry data not available."}
                        </div>
                    )
                ) : (
                    <div className="animate-pulse flex space-x-4">
                        <div className="flex-1 space-y-4 py-1">
                            <div className="h-20 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                )}
            </div>

            <hr className="my-8" />

            {/* Analytics Filters */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-700">Token Analytics</h2>
                <div className="flex space-x-4 mt-4 md:mt-0">
                    <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                        <option value="global">All Providers</option>
                        <option value="local">Local Only (vLLM)</option>
                        <option value="external">External Only</option>
                    </select>
                    <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                        <option value="today">Today</option>
                        <option value="week">Last 7 Days</option>
                        <option value="month">Last 30 Days</option>
                        <option value="30plus">All Time</option>
                    </select>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
                    <p className="text-sm font-medium text-gray-500">Total Tokens Consumed</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{totalTokens.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
                    <p className="text-sm font-medium text-gray-500">Total Requests</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{totalRequests.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
                    <p className="text-sm font-medium text-gray-500">Estimated API Cost</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">${totalCost.toFixed(4)}</p>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading analytics...</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Prompt Tokens</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Tokens</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Tokens</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Requests</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Est. Cost</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredAnalytics.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">No data available for the selected filters.</td></tr>
                            ) : (
                                filteredAnalytics.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.model}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{row.provider}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.prompt_tokens.toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.completion_tokens.toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700 text-right">{row.total_tokens.toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.requests.toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">${(row.estimated_cost || 0).toFixed(4)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default AnalyticsPage;
