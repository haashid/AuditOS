"use client";

import { CopilotFAB } from '@/components/CopilotFAB';
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Leaf, Plus, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("auditos_token") : null;
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });
const jsonHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });

const TABS = [
  { id: "emissions", label: "Emissions" },
  { id: "metrics", label: "ESG Metrics" },
  { id: "brsr", label: "BRSR Analysis" },
];

const SCOPE_COLORS: Record<number, string> = {
  1: "bg-orange-50 text-orange-700 border-orange-200",
  2: "bg-blue-50 text-blue-700 border-blue-200",
  3: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function ESGAuditDetailPage() {
  const params = useParams();
  const engagementId = params.engagement_id as string;

  const [activeTab, setActiveTab] = useState("emissions");
  const [emissionSummary, setEmissionSummary] = useState<any>(null);
  const [emissions, setEmissions] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [brslText, setBrsrText] = useState("");
  const [brslLoading, setBrsrLoading] = useState(false);
  const brslRef = useRef<HTMLDivElement>(null);

  const [brsrMetrics, setBrsrMetrics] = useState<any[]>([]);
  const [brsrInitializing, setBrsrInitializing] = useState(false);
  const [brsrEditState, setBrsrEditState] = useState<Record<string, number>>({});

  const [emForm, setEmForm] = useState({ scope: 1, category: "", activity_data: "", activity_unit: "liters", emission_factor: "", period: "FY2025", data_source: "", notes: "" });
  const [emSaving, setEmSaving] = useState(false);

  const [metForm, setMetForm] = useState({ pillar: "environmental", category: "", metric_name: "", value: "", unit: "", period: "FY2025", target_value: "", notes: "" });
  const [metSaving, setMetSaving] = useState(false);

  const fetchAll = async () => {
    try {
      const [sumRes, emRes, metRes, brsrRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/esg/engagements/${engagementId}/emissions/summary`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/esg/engagements/${engagementId}/emissions`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/esg/engagements/${engagementId}/metrics`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/esg/engagements/${engagementId}/brsr/metrics`, { headers: authHeaders() }),
      ]);
      if (sumRes.ok) setEmissionSummary(await sumRes.json());
      if (emRes.ok) setEmissions(await emRes.json());
      if (metRes.ok) setMetrics(await metRes.json());
      if (brsrRes.ok) setBrsrMetrics((await brsrRes.json()).metrics);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchAll(); }, [engagementId]);

  const fetchBrsrMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/esg/engagements/${engagementId}/brsr/metrics`, { headers: authHeaders() });
      if (res.ok) setBrsrMetrics((await res.json()).metrics);
    } catch (e) { console.error(e); }
  };

  const addEmission = async () => {
    setEmSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/esg/engagements/${engagementId}/emissions/add`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          scope: Number(emForm.scope),
          category: emForm.category,
          activity_data: parseFloat(emForm.activity_data),
          activity_unit: emForm.activity_unit,
          emission_factor: parseFloat(emForm.emission_factor),
          period: emForm.period,
          data_source: emForm.data_source || null,
          notes: emForm.notes || null,
        })
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Added: ${data.co2e_tonnes} tCO2e`);
        setEmForm({ scope: 1, category: "", activity_data: "", activity_unit: "liters", emission_factor: "", period: "FY2025", data_source: "", notes: "" });
        fetchAll();
      } else {
        const err = await res.json();
        alert("Error: " + (err.detail || "Failed"));
      }
    } catch { alert("Failed to add emission"); }
    finally { setEmSaving(false); }
  };

  const addMetric = async () => {
    setMetSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/esg/engagements/${engagementId}/metrics/add`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          pillar: metForm.pillar,
          category: metForm.category,
          metric_name: metForm.metric_name,
          value: parseFloat(metForm.value),
          unit: metForm.unit,
          period: metForm.period,
          target_value: metForm.target_value ? parseFloat(metForm.target_value) : null,
          notes: metForm.notes || null,
        })
      });
      if (res.ok) {
        alert("Metric added");
        setMetForm({ pillar: "environmental", category: "", metric_name: "", value: "", unit: "", period: "FY2025", target_value: "", notes: "" });
        fetchAll();
      }
    } catch { alert("Failed to add metric"); }
    finally { setMetSaving(false); }
  };

  const runBRSR = async () => {
    setBrsrText("");
    setBrsrLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/esg/engagements/${engagementId}/brsr/ai-analysis`, {
        method: "POST", headers: authHeaders()
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setBrsrText(prev => prev + decoder.decode(value));
        if (brslRef.current) brslRef.current.scrollTop = brslRef.current.scrollHeight;
      }
    } catch (e) { setBrsrText("Error: " + e); }
    finally { setBrsrLoading(false); }
  };

  const initializeBrsrMetrics = async () => {
    setBrsrInitializing(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/esg/engagements/${engagementId}/brsr/initialize`, {
        method: "POST", headers: authHeaders()
      });
      const data = await res.json();
      alert(`Initialized ${data.total_metrics} BRSR metrics`);
      fetchBrsrMetrics();
    } catch { alert("Init failed"); }
    finally { setBrsrInitializing(false); }
  };

  const updateBrsrMetric = async (metricId: string) => {
    if (brsrEditState[metricId] === undefined) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/esg/engagements/${engagementId}/brsr/metrics/${metricId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ value: brsrEditState[metricId] })
      });
      if (res.ok) {
        alert("Saved");
        fetchBrsrMetrics();
      }
    } catch { alert("Save failed"); }
  };

  const pillarColor = (pillar: string) => ({
    environmental: "bg-emerald-50 text-emerald-700",
    social: "bg-blue-50 text-blue-700",
    governance: "bg-purple-50 text-purple-700",
  }[pillar] || "bg-slate-50 text-slate-600");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/esg" className="text-sm text-slate-500 hover:text-emerald-600 flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to ESG Audit
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Leaf className="w-6 h-6 text-emerald-500" />
          ESG Audit Workspace
        </h1>
        <p className="text-slate-500 mt-1 text-sm">Carbon emissions tracking, ESG metrics, and BRSR compliance analysis</p>
      </div>

      {/* Emissions Summary */}
      {emissionSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total tCO2e", value: emissionSummary.total_co2e_tonnes, color: "text-slate-900" },
            { label: "Scope 1 (Direct)", value: emissionSummary.scope_1_tonnes, color: "text-orange-600" },
            { label: "Scope 2 (Electricity)", value: emissionSummary.scope_2_tonnes, color: "text-blue-600" },
            { label: "Scope 3 (Value Chain)", value: emissionSummary.scope_3_tonnes, color: "text-purple-600" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100/70 p-1 rounded-lg border border-slate-200 w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === tab.id ? "bg-white text-emerald-700 shadow-sm border border-slate-200/50" : "text-slate-600 hover:text-slate-900"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Emissions Tab */}
      {activeTab === "emissions" && (
        <div className="space-y-6">
          {/* Entry Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Add Emission Record</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Scope</label>
                <select value={emForm.scope} onChange={e => setEmForm(p => ({ ...p, scope: Number(e.target.value) }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value={1}>Scope 1 — Direct</option>
                  <option value={2}>Scope 2 — Electricity</option>
                  <option value={3}>Scope 3 — Value Chain</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Category</label>
                <input value={emForm.category} onChange={e => setEmForm(p => ({ ...p, category: e.target.value }))}
                  placeholder="e.g. Stationary Combustion"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Activity Data</label>
                <input type="number" value={emForm.activity_data} onChange={e => setEmForm(p => ({ ...p, activity_data: e.target.value }))}
                  placeholder="50000"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Unit</label>
                <select value={emForm.activity_unit} onChange={e => setEmForm(p => ({ ...p, activity_unit: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="liters">Liters</option>
                  <option value="kWh">kWh</option>
                  <option value="km">Kilometers</option>
                  <option value="tonnes">Tonnes</option>
                  <option value="m3">m³</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Emission Factor (kg CO2e/unit)</label>
                <input type="number" step="0.0001" value={emForm.emission_factor} onChange={e => setEmForm(p => ({ ...p, emission_factor: e.target.value }))}
                  placeholder="2.68"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Period</label>
                <input value={emForm.period} onChange={e => setEmForm(p => ({ ...p, period: e.target.value }))}
                  placeholder="FY2024"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-700 block mb-1">Data Source</label>
                <input value={emForm.data_source} onChange={e => setEmForm(p => ({ ...p, data_source: e.target.value }))}
                  placeholder="IPCC 2021, India CEF 2023-24..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-medium">
              Calculated tCO2e = Activity Data × Emission Factor ÷ 1000
              {emForm.activity_data && emForm.emission_factor && (
                <span className="ml-2 font-bold">= {(parseFloat(emForm.activity_data) * parseFloat(emForm.emission_factor) / 1000).toFixed(4)} tCO2e</span>
              )}
            </div>
            <button onClick={addEmission} disabled={emSaving || !emForm.category || !emForm.activity_data || !emForm.emission_factor}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {emSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Emission Record
            </button>
          </div>

          {/* Emissions Table */}
          {emissions.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">All Emission Records ({emissions.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {["Scope", "Category", "Activity Data", "Factor", "tCO2e", "Period"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {emissions.map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${SCOPE_COLORS[r.scope]}`}>
                            Scope {r.scope}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{r.category}</td>
                        <td className="px-4 py-3 text-slate-600">{r.activity_data.toLocaleString()} {r.activity_unit}</td>
                        <td className="px-4 py-3 text-slate-500">{r.emission_factor}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">{r.co2e_tonnes}</td>
                        <td className="px-4 py-3 text-slate-500">{r.period}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ESG Metrics Tab */}
      {activeTab === "metrics" && (
        <div className="space-y-6">
          {/* Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Add ESG Metric</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Pillar</label>
                <select value={metForm.pillar} onChange={e => setMetForm(p => ({ ...p, pillar: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="environmental">Environmental</option>
                  <option value="social">Social</option>
                  <option value="governance">Governance</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Category</label>
                <input value={metForm.category} onChange={e => setMetForm(p => ({ ...p, category: e.target.value }))}
                  placeholder="energy, water, diversity..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Metric Name</label>
                <input value={metForm.metric_name} onChange={e => setMetForm(p => ({ ...p, metric_name: e.target.value }))}
                  placeholder="Women in Leadership (%)"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Actual Value</label>
                <input type="number" step="0.01" value={metForm.value} onChange={e => setMetForm(p => ({ ...p, value: e.target.value }))}
                  placeholder="28.5"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Target Value (optional)</label>
                <input type="number" step="0.01" value={metForm.target_value} onChange={e => setMetForm(p => ({ ...p, target_value: e.target.value }))}
                  placeholder="35.0"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Unit</label>
                <input value={metForm.unit} onChange={e => setMetForm(p => ({ ...p, unit: e.target.value }))}
                  placeholder="%, kWh, m³, count..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <button onClick={addMetric} disabled={metSaving || !metForm.metric_name || !metForm.value}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {metSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Metric
            </button>
          </div>

          {/* Metrics grouped by pillar */}
          {["environmental", "social", "governance"].map(pillar => {
            const pillarMetrics = metrics.filter((m: any) => m.pillar === pillar);
            if (!pillarMetrics.length) return null;
            return (
              <div key={pillar}>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 px-1 capitalize">{pillar}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pillarMetrics.map((m: any) => {
                    const isAdverse = m.vs_target !== null && m.vs_target < -10;
                    return (
                      <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pillarColor(m.pillar)}`}>{m.category}</span>
                          {m.vs_target !== null && (
                            <span className={`text-xs font-bold ${isAdverse ? "text-red-600" : "text-emerald-600"}`}>
                              {m.vs_target > 0 ? "+" : ""}{m.vs_target}% vs target
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-800 mb-1">{m.metric_name}</p>
                        <p className="text-xl font-bold text-slate-900">{m.value} <span className="text-sm font-normal text-slate-500">{m.unit}</span></p>
                        {m.target_value && <p className="text-xs text-slate-400 mt-0.5">Target: {m.target_value} {m.unit}</p>}
                        <p className="text-xs text-slate-400">{m.period}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BRSR Analysis Tab */}
      {activeTab === "brsr" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">BRSR Core Disclosure Metrics</h3>
              <p className="text-sm text-slate-500">
                Track required quantitative metrics for BRSR compliance.
              </p>
            </div>
            {brsrMetrics.length === 0 && (
              <button onClick={initializeBrsrMetrics} disabled={brsrInitializing}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {brsrInitializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {brsrInitializing ? "Initializing..." : "Initialize 14 Core Metrics"}
              </button>
            )}
          </div>

          {brsrMetrics.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">Pillar</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/2">Metric Name</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {brsrMetrics.map((m: any) => {
                      const value = brsrEditState[m.id] !== undefined ? brsrEditState[m.id] : m.value;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pillarColor(m.pillar.toLowerCase())}`}>{m.pillar}</span></td>
                          <td className="px-4 py-3 font-medium text-slate-900">{m.metric_name}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                value={value} 
                                onChange={e => setBrsrEditState(p => ({ ...p, [m.id]: parseFloat(e.target.value) }))}
                                className="w-24 text-sm border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                              />
                              <span className="text-xs text-slate-500 mr-2">{m.unit}</span>
                              {brsrEditState[m.id] !== undefined && brsrEditState[m.id] !== m.value && (
                                <button onClick={() => updateBrsrMetric(m.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700">Save</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mt-8">
            <h3 className="font-semibold text-slate-900 mb-1">Automated BRSR Analysis</h3>
            <p className="text-sm text-slate-500 mb-4">
              AI analyzes compliance across all 9 SEBI BRSR principles based on the ESG data you've entered.
            </p>
            <button onClick={runBRSR} disabled={brslLoading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-50 transition-colors">
              {brslLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Leaf className="w-4 h-4" />}
              {brslLoading ? "Analyzing..." : "Run AI Analysis"}
            </button>
          </div>

          {brslText && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 mt-4">
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Leaf className="w-4 h-4 text-emerald-500" />
                BRSR Analysis Results
              </h4>
              <div ref={brslRef} className="bg-slate-50 rounded-lg p-4 border border-slate-100 max-h-[600px] overflow-y-auto">
                <div className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-pre:bg-slate-100 prose-pre:text-slate-800">
                  <ReactMarkdown>{brslText}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <CopilotFAB engagementId={engagementId} moduleName="esg" />
    </div>
  );
}

