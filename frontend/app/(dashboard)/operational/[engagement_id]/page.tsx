"use client";

import { CopilotFAB } from '@/components/CopilotFAB';
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Settings2, Plus, Upload, Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("auditos_token") : null;
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });
const jsonHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });

const TABS = [
  { id: "risks", label: "Process Risks" },
  { id: "kpis", label: "KPI Tracking" },
  { id: "ai", label: "AI Analysis" },
];

const RATING_COLORS: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const RATING_BG: Record<string, string> = {
  critical: "border-l-4 border-l-red-500",
  high: "border-l-4 border-l-orange-500",
  medium: "border-l-4 border-l-amber-500",
  low: "border-l-4 border-l-emerald-500",
};

export default function OperationalAuditDetailPage() {
  const params = useParams();
  const engagementId = params.engagement_id as string;

  const [activeTab, setActiveTab] = useState("risks");
  const [riskData, setRiskData] = useState<any>(null);
  const [kpiData, setKpiData] = useState<any>(null);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [kpiUploading, setKpiUploading] = useState(false);
  const [showRiskForm, setShowRiskForm] = useState(false);
  const [riskSaving, setRiskSaving] = useState(false);
  const aiRef = useRef<HTMLDivElement>(null);
  const kpiFileRef = useRef<HTMLInputElement>(null);

  const [riskForm, setRiskForm] = useState({
    process_name: "", risk_name: "", risk_description: "", risk_category: "financial",
    inherent_likelihood: 3, inherent_impact: 3,
    control_description: "", control_effectiveness: "not_tested",
    residual_likelihood: 2, residual_impact: 2, owner: ""
  });

  const fetchAll = async () => {
    try {
      const [rRes, kRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/operational/engagements/${engagementId}/process-risks`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/operational/engagements/${engagementId}/kpis/summary`, { headers: authHeaders() }),
      ]);
      if (rRes.ok) setRiskData(await rRes.json());
      if (kRes.ok) setKpiData(await kRes.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchAll(); }, [engagementId]);

  const addRisk = async () => {
    setRiskSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/operational/engagements/${engagementId}/process-risks`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          ...riskForm,
          inherent_likelihood: Number(riskForm.inherent_likelihood),
          inherent_impact: Number(riskForm.inherent_impact),
          residual_likelihood: Number(riskForm.residual_likelihood),
          residual_impact: Number(riskForm.residual_impact),
        })
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Risk added: ${data.risk_rating.toUpperCase()} (Score: ${data.residual_risk_score})`);
        setShowRiskForm(false);
        fetchAll();
      } else {
        const err = await res.json();
        alert("Error: " + (err.detail || "Failed"));
      }
    } catch { alert("Failed to add risk"); }
    finally { setRiskSaving(false); }
  };

  const uploadKPIs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKpiUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/api/v1/operational/engagements/${engagementId}/kpis/upload`, {
        method: "POST", headers: authHeaders(), body: fd
      });
      const data = await res.json();
      alert(`Uploaded ${data.total_kpis} KPIs, ${data.adverse_variances} adverse variances`);
      fetchAll();
    } catch { alert("Upload failed"); }
    finally { setKpiUploading(false); }
  };

  const runAI = async () => {
    setAiText("");
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/operational/engagements/${engagementId}/ai-analysis`, {
        method: "POST", headers: authHeaders()
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiText(prev => prev + decoder.decode(value));
        if (aiRef.current) aiRef.current.scrollTop = aiRef.current.scrollHeight;
      }
    } catch (e) { setAiText("Error: " + e); }
    finally { setAiLoading(false); }
  };

  const inputClass = "w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/operational" className="text-sm text-slate-500 hover:text-orange-600 flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Operational Audit
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-orange-500" />
          Operational Audit Workspace
        </h1>
        <p className="text-slate-500 mt-1 text-sm">Process risk assessment, KPI variance analysis, and AI-powered insights</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{riskData?.total || 0}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total Risks</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{(riskData?.by_rating?.critical || 0) + (riskData?.by_rating?.high || 0)}</p>
          <p className="text-xs text-slate-500 mt-0.5">High+ Risks</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{kpiData?.total_kpis || 0}</p>
          <p className="text-xs text-slate-500 mt-0.5">KPIs Tracked</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{kpiData?.adverse_variances || 0}</p>
          <p className="text-xs text-slate-500 mt-0.5">Adverse KPIs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100/70 p-1 rounded-lg border border-slate-200 w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === tab.id ? "bg-white text-orange-700 shadow-sm border border-slate-200/50" : "text-slate-600 hover:text-slate-900"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Process Risks Tab */}
      {activeTab === "risks" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-900">
              Process Risk Register
              {riskData?.total > 0 && <span className="ml-2 text-sm font-normal text-slate-500">({riskData.total} risks, sorted by residual score)</span>}
            </h3>
            <button onClick={() => setShowRiskForm(!showRiskForm)}
              className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
              <Plus className="w-4 h-4" />
              Add Risk
            </button>
          </div>

          {/* Add Risk Form */}
          {showRiskForm && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h4 className="font-medium text-slate-900">New Process Risk</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Process Name</label>
                  <input value={riskForm.process_name} onChange={e => setRiskForm(p => ({ ...p, process_name: e.target.value }))}
                    placeholder="Procure-to-Pay" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Risk Category</label>
                  <select value={riskForm.risk_category} onChange={e => setRiskForm(p => ({ ...p, risk_category: e.target.value }))} className={inputClass}>
                    <option value="financial">Financial</option>
                    <option value="operational">Operational</option>
                    <option value="compliance">Compliance</option>
                    <option value="strategic">Strategic</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-700 block mb-1">Risk Name</label>
                  <input value={riskForm.risk_name} onChange={e => setRiskForm(p => ({ ...p, risk_name: e.target.value }))}
                    placeholder="Unauthorized vendor payments" className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-700 block mb-1">Risk Description</label>
                  <textarea rows={2} value={riskForm.risk_description} onChange={e => setRiskForm(p => ({ ...p, risk_description: e.target.value }))}
                    placeholder="Describe the risk in detail..." className={inputClass + " resize-none"} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Inherent Likelihood (1-5): {riskForm.inherent_likelihood}</label>
                  <input type="range" min={1} max={5} value={riskForm.inherent_likelihood} onChange={e => setRiskForm(p => ({ ...p, inherent_likelihood: Number(e.target.value) }))}
                    className="w-full accent-orange-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Inherent Impact (1-5): {riskForm.inherent_impact}</label>
                  <input type="range" min={1} max={5} value={riskForm.inherent_impact} onChange={e => setRiskForm(p => ({ ...p, inherent_impact: Number(e.target.value) }))}
                    className="w-full accent-orange-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Residual Likelihood (1-5): {riskForm.residual_likelihood}</label>
                  <input type="range" min={1} max={5} value={riskForm.residual_likelihood} onChange={e => setRiskForm(p => ({ ...p, residual_likelihood: Number(e.target.value) }))}
                    className="w-full accent-orange-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Residual Impact (1-5): {riskForm.residual_impact}</label>
                  <input type="range" min={1} max={5} value={riskForm.residual_impact} onChange={e => setRiskForm(p => ({ ...p, residual_impact: Number(e.target.value) }))}
                    className="w-full accent-orange-500" />
                </div>
              </div>
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700 font-medium">
                Inherent Score: {riskForm.inherent_likelihood * riskForm.inherent_impact}/25 →
                Residual Score: {riskForm.residual_likelihood * riskForm.residual_impact}/25 →
                Rating: <span className="font-bold capitalize">{
                  riskForm.residual_likelihood * riskForm.residual_impact >= 20 ? "Critical" :
                  riskForm.residual_likelihood * riskForm.residual_impact >= 12 ? "High" :
                  riskForm.residual_likelihood * riskForm.residual_impact >= 6 ? "Medium" : "Low"
                }</span>
              </div>
              <div className="flex gap-2">
                <button onClick={addRisk} disabled={riskSaving || !riskForm.process_name || !riskForm.risk_name}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
                  {riskSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Save Risk
                </button>
                <button onClick={() => setShowRiskForm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Risk Cards */}
          {riskData?.risks?.length > 0 ? (
            <div className="space-y-3">
              {riskData.risks.map((r: any) => (
                <div key={r.id} className={`bg-white border border-slate-200 rounded-xl p-5 ${RATING_BG[r.risk_rating]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-slate-500">{r.process_name}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500 capitalize">{r.risk_category}</span>
                      </div>
                      <p className="font-semibold text-slate-900">{r.risk_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-slate-500">
                        {r.inherent_risk_score} → {r.residual_risk_score}
                      </span>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${RATING_COLORS[r.risk_rating]}`}>
                        {r.risk_rating}
                      </span>
                    </div>
                  </div>
                  {r.owner && <p className="text-xs text-slate-400 mt-2">Owner: {r.owner}</p>}
                </div>
              ))}
            </div>
          ) : !showRiskForm && (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
              <Settings2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium mb-1">No risks documented</p>
              <p className="text-sm text-slate-400">Click "Add Risk" to begin the risk register</p>
            </div>
          )}
        </div>
      )}

      {/* KPI Tracking Tab */}
      {activeTab === "kpis" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 mb-1">Upload KPI Data</h3>
            <p className="text-sm text-slate-500 mb-4">
              CSV columns: department, kpi_name, kpi_category, unit, actual_value, target_value, prior_period_value, period
            </p>
            <input ref={kpiFileRef} type="file" accept=".csv" className="hidden" onChange={uploadKPIs} />
            <button onClick={() => kpiFileRef.current?.click()} disabled={kpiUploading}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
              {kpiUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {kpiUploading ? "Uploading..." : "Upload CSV"}
            </button>
          </div>

          {kpiData?.kpis?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">KPI Results</h3>
                <span className="text-sm text-amber-600 font-medium">
                  {kpiData.adverse_variances} adverse variances
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {["Department", "KPI", "Actual", "Target", "vs Target", "Status"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {kpiData.kpis.map((k: any) => {
                      const pct = k.variance_vs_target;
                      const isAdverse = k.is_adverse;
                      return (
                        <tr key={k.id} className={isAdverse ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-slate-50"}>
                          <td className="px-4 py-3 text-slate-600">{k.department}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{k.kpi_name}</td>
                          <td className="px-4 py-3 text-slate-700">{k.actual_value} {k.unit}</td>
                          <td className="px-4 py-3 text-slate-500">{k.target_value} {k.unit}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div className={`h-full rounded-full ${isAdverse ? "bg-red-500" : "bg-emerald-500"}`}
                                  style={{ width: `${Math.min(Math.abs(pct), 100)}%` }} />
                              </div>
                              <span className={`text-xs font-bold ${pct > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isAdverse ? (
                              <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                <AlertTriangle className="w-3 h-3" />Adverse
                              </span>
                            ) : (
                              <span className="text-xs text-emerald-600 font-medium">On Track</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Analysis Tab */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 mb-1">AI Operational Health Analysis</h3>
            <p className="text-sm text-slate-500 mb-4">
              AI synthesizes your process risks and KPI variances into a comprehensive operational audit commentary with root cause analysis and recommendations.
            </p>
            <button onClick={runAI} disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
              {aiLoading ? "Analyzing..." : "Run AI Analysis"}
            </button>
          </div>

          {aiText && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-orange-500" />
                Analysis Results
              </h4>
              <div ref={aiRef} className="bg-slate-50 rounded-lg p-4 border border-slate-100 max-h-[600px] overflow-y-auto">
                <div className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-pre:bg-slate-100 prose-pre:text-slate-800">
                  <ReactMarkdown>{aiText}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <CopilotFAB engagementId={engagementId} moduleName="operational" />
    </div>
  );
}

