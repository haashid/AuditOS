"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Shield, Upload, AlertTriangle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("auditos_token") : null;
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
  info: "bg-slate-100 text-slate-600 border-slate-200",
};

const TABS = [
  { id: "vulns", label: "Vulnerabilities" },
  { id: "nist", label: "NIST CSF Assessment" },
];

interface NISTControl {
  id: string;
  function: string;
  control_code: string;
  control_name: string;
  maturity_level: number;
  gap_description: string | null;
  ai_recommendation: string | null;
}

export default function CyberAuditDetailPage() {
  const params = useParams();
  const engagementId = params.engagement_id as string;

  const [activeTab, setActiveTab] = useState("vulns");
  const [vulnSummary, setVulnSummary] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [nistText, setNistText] = useState("");
  const [nistLoading, setNistLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nistRef = useRef<HTMLDivElement>(null);

  const [nistControls, setNistControls] = useState<NISTControl[]>([]);
  const [nistInitializing, setNistInitializing] = useState(false);
  const [expandedNistControl, setExpandedNistControl] = useState<string | null>(null);
  const [nistEditState, setNistEditState] = useState<Record<string, any>>({});

  const fetchVulns = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/cyber/engagements/${engagementId}/vulnerabilities/summary`, { headers: authHeaders() });
      if (res.ok) setVulnSummary(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchNistControls = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/cyber/engagements/${engagementId}/nist/controls`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setNistControls(data.controls);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { 
    fetchVulns(); 
    fetchNistControls();
  }, [engagementId]);

  const uploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/api/v1/cyber/engagements/${engagementId}/vulnerabilities/upload-csv`, {
        method: "POST", headers: authHeaders(), body: fd
      });
      const data = await res.json();
      alert(`Uploaded ${data.total_vulnerabilities} vulnerabilities, ${data.critical} critical`);
      fetchVulns();
    } catch { alert("Upload failed"); }
    finally { setUploading(false); }
  };

  const runNIST = async () => {
    setNistText("");
    setNistLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/cyber/engagements/${engagementId}/nist-assessment/run`, {
        method: "POST", headers: authHeaders()
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setNistText(prev => prev + decoder.decode(value));
        if (nistRef.current) nistRef.current.scrollTop = nistRef.current.scrollHeight;
      }
    } catch (e) { setNistText("Error: " + e); }
    finally { setNistLoading(false); }
  };

  const initializeNistControls = async () => {
    setNistInitializing(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/cyber/engagements/${engagementId}/nist/initialize`, {
        method: "POST", headers: authHeaders()
      });
      const data = await res.json();
      alert(`Initialized ${data.total_controls} controls`);
      fetchNistControls();
    } catch { alert("Init failed"); }
    finally { setNistInitializing(false); }
  };

  const updateNistControl = async (controlId: string) => {
    const state = nistEditState[controlId] || {};
    try {
      const res = await fetch(`${API_BASE}/api/v1/cyber/engagements/${engagementId}/nist/controls/${controlId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          maturity_level: state.maturity_level ?? 0,
          gap_description: state.gap_description || null,
        })
      });
      if (res.ok) {
        alert("Saved");
        fetchNistControls();
      }
    } catch { alert("Save failed"); }
  };

  const sevOrder = ["critical", "high", "medium", "low", "info"];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/cyber" className="text-sm text-slate-500 hover:text-red-600 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Cybersecurity Audit
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-500" />
            Cybersecurity Audit Workspace
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Vulnerability management and NIST CSF assessment</p>
        </div>
      </div>

      {/* Summary Cards */}
      {vulnSummary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center md:col-span-1">
            <p className="text-2xl font-bold text-slate-900">{vulnSummary.total}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total</p>
          </div>
          {sevOrder.map(sev => (
            <div key={sev} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${sev === "critical" ? "text-red-600" : sev === "high" ? "text-orange-600" : sev === "medium" ? "text-amber-600" : "text-slate-600"}`}>
                {vulnSummary.by_severity?.[sev] || 0}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 capitalize">{sev}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100/70 p-1 rounded-lg border border-slate-200 w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === tab.id ? "bg-white text-red-700 shadow-sm border border-slate-200/50" : "text-slate-600 hover:text-slate-900"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Vulnerabilities Tab */}
      {activeTab === "vulns" && (
        <div className="space-y-4">
          {/* Upload */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 mb-1">Upload Scan Results</h3>
            <p className="text-sm text-slate-500 mb-4">
              Accepts Nessus CSV export format. Columns: Plugin ID, Name, Risk, Host, Port, Protocol, CVSS, Description, Solution, CVE
            </p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={uploadCSV} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading..." : "Upload CSV"}
            </button>
          </div>

          {/* Top 10 Table */}
          {vulnSummary?.top_10?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Top Vulnerabilities by CVSS Score</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {["Vulnerability", "Host", "CVSS", "Severity", "Status"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {vulnSummary.top_10.map((v: any) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">{v.vuln_name}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">{v.host}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${Number(v.cvss_score) >= 9 ? "text-red-600" : Number(v.cvss_score) >= 7 ? "text-orange-600" : "text-amber-600"}`}>
                            {v.cvss_score}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border capitalize ${SEVERITY_COLORS[v.severity]}`}>
                            {v.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                            v.status === "open" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                          }`}>{v.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NIST Assessment Tab */}
      {activeTab === "nist" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">NIST CSF Manual Assessment</h3>
              <p className="text-sm text-slate-500">
                Assess the organization against 16 key NIST CSF controls.
              </p>
            </div>
            {nistControls.length === 0 && (
              <button onClick={initializeNistControls} disabled={nistInitializing}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {nistInitializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {nistInitializing ? "Initializing..." : "Initialize Controls"}
              </button>
            )}
          </div>

          {nistControls.length > 0 && (
            <div className="space-y-4">
              {["Identify", "Protect", "Detect", "Respond", "Recover"].map(func => {
                const funcControls = nistControls.filter(c => c.function === func);
                if (funcControls.length === 0) return null;
                return (
                  <div key={func}>
                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2 px-1">{func}</h4>
                    <div className="space-y-2">
                      {funcControls.map(c => {
                        const isExpanded = expandedNistControl === c.id;
                        const edit = nistEditState[c.id] || {};
                        const maturity = edit.maturity_level ?? c.maturity_level;
                        const gap = edit.gap_description ?? c.gap_description ?? "";
                        
                        return (
                          <div key={c.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50" onClick={() => setExpandedNistControl(isExpanded ? null : c.id)}>
                              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded w-20 text-center">{c.control_code}</span>
                              <p className="text-sm font-semibold text-slate-900 flex-1">{c.control_name}</p>
                              <span className="text-xs font-medium bg-slate-100 px-2 py-1 rounded">Maturity: {c.maturity_level}/4</span>
                            </div>
                            {isExpanded && (
                              <div className="border-t border-slate-100 p-4 space-y-4">
                                <div>
                                  <label className="text-xs font-medium text-slate-700 block mb-1">Maturity Level (0-4)</label>
                                  <input type="range" min="0" max="4" value={maturity} onChange={e => setNistEditState(p => ({ ...p, [c.id]: { ...p[c.id], maturity_level: parseInt(e.target.value) } }))} className="w-full max-w-xs accent-red-600" />
                                  <div className="text-xs text-slate-500 mt-1">{maturity} - {['None', 'Partial', 'Risk Informed', 'Repeatable', 'Adaptive'][maturity]}</div>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-700 block mb-1">Gap Description</label>
                                  <textarea rows={2} value={gap} onChange={e => setNistEditState(p => ({ ...p, [c.id]: { ...p[c.id], gap_description: e.target.value } }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" placeholder="Describe the current gap..."></textarea>
                                </div>
                                <button onClick={() => updateNistControl(c.id)} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">Save</button>
                                
                                {c.ai_recommendation && (
                                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 mt-2">
                                    <p className="text-xs font-bold text-purple-700 mb-1">AI Recommendation</p>
                                    <p className="text-sm text-purple-900">{c.ai_recommendation}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* AI Assessment (existing) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mt-8">
            <h3 className="font-semibold text-slate-900 mb-1">Automated NIST Assessment</h3>
            <p className="text-sm text-slate-500 mb-4">
              AI assesses the organization across all 5 NIST CSF functions based on your vulnerability data.
            </p>
            <button onClick={runNIST} disabled={nistLoading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-50 transition-colors">
              {nistLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {nistLoading ? "Running Assessment..." : "Run AI Assessment"}
            </button>
            {nistText && (
              <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 max-h-[400px] overflow-y-auto">
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">{nistText}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
