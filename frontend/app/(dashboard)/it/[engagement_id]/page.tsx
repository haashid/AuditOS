"use client";

import { CopilotFAB } from '@/components/CopilotFAB';
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "@/hooks/useToast";
import {
  Monitor, Upload, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Loader2, FileText, Users, Key, Shield, Download, ArrowLeft
} from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("auditos_token") : null;

const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });
const jsonHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });

const CATEGORY_LABELS: Record<string, string> = {
  access_control: "Access Controls",
  change_management: "Change Management",
  computer_operations: "Computer Operations",
  program_development: "Program Development",
};

const EFFECTIVENESS_COLORS: Record<string, string> = {
  effective: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partially_effective: "bg-amber-50 text-amber-700 border-amber-200",
  ineffective: "bg-red-50 text-red-700 border-red-200",
  not_tested: "bg-slate-100 text-slate-600 border-slate-200",
};

const TABS = [
  { id: "itgc", label: "ITGC Controls" },
  { id: "access", label: "User Access Review" },
  { id: "change", label: "Change Management" },
];

interface Control {
  id: string;
  category: string;
  control_id: string;
  control_name: string;
  control_description: string;
  test_procedure: string;
  effectiveness: string;
  evidence_description: string | null;
  auditor_notes: string | null;
  ai_assessment: string | null;
  is_key_control: boolean;
  deficiency_type: string | null;
}

interface AccessSummary {
  total_users: number;
  dormant_accounts: number;
  admin_accounts: number;
  no_mfa_admins: number;
  flagged_users: Array<{
    username: string;
    full_name: string;
    department: string;
    access_level: string;
    system_name: string;
    risk_flag: string;
    last_login_date: string | null;
  }>;
}

interface ChangeSummary {
  total_changes: number;
  unauthorized: number;
  emergency: number;
  production_direct: number;
  changes: Array<{
    change_id: string;
    change_type: string;
    description: string | null;
    approved_by: string;
    change_date: string | null;
    environment: string;
    is_unauthorized: boolean;
    is_emergency: boolean;
    production_direct: boolean;
  }>;
}

export default function ITAuditDetailPage() {
  const params = useParams();
  const engagementId = params.engagement_id as string;

  const [activeTab, setActiveTab] = useState("itgc");
  const [controls, setControls] = useState<Control[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [initializing, setInitializing] = useState(false);
  const [expandedControl, setExpandedControl] = useState<string | null>(null);
  const [editState, setEditState] = useState<Record<string, any>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [accessSummary, setAccessSummary] = useState<AccessSummary | null>(null);
  const [accessUploading, setAccessUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [changeSummary, setChangeSummary] = useState<ChangeSummary | null>(null);
  const [changeUploading, setChangeUploading] = useState(false);
  const changeFileInputRef = useRef<HTMLInputElement>(null);

  const fetchControls = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/it/engagements/${engagementId}/itgc/controls`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setControls(data.controls);
        setSummary(data.summary);
      }
    } catch (e) { console.error(e); }
  };

  const fetchAccessSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/it/engagements/${engagementId}/user-access/summary`, { headers: authHeaders() });
      if (res.ok) setAccessSummary(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchChangeSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/it/engagements/${engagementId}/change-log/summary`, { headers: authHeaders() });
      if (res.ok) setChangeSummary(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchControls();
    fetchAccessSummary();
    fetchChangeSummary();
  }, [engagementId]);

  const initializeControls = async () => {
    setInitializing(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/it/engagements/${engagementId}/itgc/initialize`, {
        method: "POST", headers: authHeaders()
      });
      const data = await res.json();
      toast.success(`Initialized ${data.total_controls} ITGC controls`);
      fetchControls();
    } catch {
      toast.error("Failed to initialize controls");
    } finally {
      setInitializing(false);
    }
  };

  const updateControl = async (controlId: string) => {
    const state = editState[controlId] || {};
    try {
      const res = await fetch(`${API_BASE}/api/v1/it/engagements/${engagementId}/itgc/controls/${controlId}`, {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({
          effectiveness: state.effectiveness || "not_tested",
          evidence_description: state.evidence_description || null,
          auditor_notes: state.auditor_notes || null,
          deficiency_type: state.deficiency_type || null,
        })
      });
      if (res.ok) {
        toast.success("Control saved");
        fetchControls();
      }
    } catch { toast.error("Save failed"); }
  };

  const runAiAssess = async (controlId: string) => {
    setAiLoading(controlId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/it/engagements/${engagementId}/itgc/controls/${controlId}/ai-assess`, {
        method: "POST", headers: authHeaders()
      });
      const data = await res.json();
      toast.success("AI assessment complete");
      // Update local state
      setControls(prev => prev.map(c => c.id === controlId ? { ...c, ai_assessment: data.ai_assessment } : c));
    } catch { toast.error("AI assessment failed"); }
    finally { setAiLoading(null); }
  };

  const uploadAccessCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAccessUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/api/v1/it/engagements/${engagementId}/user-access/upload`, {
        method: "POST", headers: authHeaders(), body: fd
      });
      const data = await res.json();
      toast.success(`Uploaded ${data.total_users} users, ${data.flagged_users} flagged`);
      fetchAccessSummary();
    } catch { toast.error("Upload failed"); }
    finally { setAccessUploading(false); }
  };

  const uploadChangeCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setChangeUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/api/v1/it/engagements/${engagementId}/change-log/upload`, {
        method: "POST", headers: authHeaders(), body: fd
      });
      const data = await res.json();
      toast.success(`Uploaded ${data.total_changes} changes`);
      fetchChangeSummary();
    } catch { toast.error("Upload failed"); }
    finally { setChangeUploading(false); }
  };

  const downloadReport = () => {
    window.open(`${API_BASE}/api/v1/it/engagements/${engagementId}/itgc/generate-report`, "_blank");
  };

  const grouped: Record<string, Control[]> = {};
  for (const c of controls) {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/it" className="text-sm text-slate-500 hover:text-cyan-600 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to IT Audit
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Monitor className="w-6 h-6 text-cyan-500" />
            IT Audit Workspace
          </h1>
          <p className="text-slate-500 mt-1 text-sm">ITGC testing, user access review, and change management audit</p>
        </div>
        <div className="flex gap-2">
          {controls.length === 0 ? (
            <button
              onClick={initializeControls}
              disabled={initializing}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50 transition-colors"
            >
              {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Monitor className="w-4 h-4" />}
              Initialize ITGC Controls
            </button>
          ) : (
            <button
              onClick={downloadReport}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download ITGC Report
            </button>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total Controls", value: summary.total, color: "text-slate-900" },
            { label: "Effective", value: summary.effective, color: "text-emerald-600" },
            { label: "Not Tested", value: summary.not_tested, color: "text-slate-500" },
            { label: "Deficiencies", value: summary.deficiencies, color: "text-red-600" },
            { label: "Completion", value: `${summary.completion_pct}%`, color: "text-cyan-600" },
          ].map((s) => (
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
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === tab.id
                ? "bg-white text-cyan-700 shadow-sm border border-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ITGC Controls Tab */}
      {activeTab === "itgc" && (
        <div className="space-y-6">
          {controls.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
              <Monitor className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium mb-1">No ITGC controls initialized</p>
              <p className="text-sm text-slate-400">Click "Initialize ITGC Controls" to seed 13 standard controls</p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, catControls]) => (
              <div key={category}>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 px-1">
                  {CATEGORY_LABELS[category] || category} ({catControls.length})
                </h3>
                <div className="space-y-3">
                  {catControls.map(control => {
                    const isExpanded = expandedControl === control.id;
                    const edit = editState[control.id] || {};
                    const effectiveness = edit.effectiveness ?? control.effectiveness;
                    const evidence = edit.evidence_description ?? control.evidence_description ?? "";

                    return (
                      <div key={control.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        {/* Control Header */}
                        <div
                          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => setExpandedControl(isExpanded ? null : control.id)}
                        >
                          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded shrink-0">
                            {control.control_id}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{control.control_name}</p>
                            {control.is_key_control && (
                              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                                Key Control
                              </span>
                            )}
                          </div>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 capitalize ${EFFECTIVENESS_COLORS[control.effectiveness]}`}>
                            {control.effectiveness.replace("_", " ")}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 p-4 space-y-4">
                            <p className="text-sm text-slate-600">{control.control_description}</p>
                            <details className="text-sm">
                              <summary className="text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700">Test Procedure</summary>
                              <pre className="mt-2 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-3 border">{control.test_procedure}</pre>
                            </details>

                            {/* Effectiveness */}
                            <div>
                              <label className="text-xs font-medium text-slate-700 block mb-1">Effectiveness</label>
                              <select
                                value={effectiveness}
                                onChange={e => setEditState(prev => ({ ...prev, [control.id]: { ...prev[control.id], effectiveness: e.target.value } }))}
                                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                              >
                                <option value="not_tested">Not Tested</option>
                                <option value="effective">Effective</option>
                                <option value="partially_effective">Partially Effective</option>
                                <option value="ineffective">Ineffective</option>
                              </select>
                            </div>

                            {/* Deficiency Type (when ineffective) */}
                            {effectiveness === "ineffective" && (
                              <div>
                                <label className="text-xs font-medium text-slate-700 block mb-1">Deficiency Classification</label>
                                <select
                                  value={edit.deficiency_type ?? control.deficiency_type ?? ""}
                                  onChange={e => setEditState(prev => ({ ...prev, [control.id]: { ...prev[control.id], deficiency_type: e.target.value } }))}
                                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                >
                                  <option value="">Select...</option>
                                  <option value="deficiency">Deficiency</option>
                                  <option value="significant_deficiency">Significant Deficiency</option>
                                  <option value="material_weakness">Material Weakness</option>
                                </select>
                              </div>
                            )}

                            {/* Evidence */}
                            <div>
                              <label className="text-xs font-medium text-slate-700 block mb-1">Evidence Description</label>
                              <textarea
                                rows={3}
                                value={evidence}
                                onChange={e => setEditState(prev => ({ ...prev, [control.id]: { ...prev[control.id], evidence_description: e.target.value } }))}
                                placeholder="Describe what you observed, tested, and the evidence obtained..."
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                              />
                            </div>

                            {/* Auditor Notes */}
                            <div>
                              <label className="text-xs font-medium text-slate-700 block mb-1">Auditor Notes</label>
                              <textarea
                                rows={2}
                                value={edit.auditor_notes ?? control.auditor_notes ?? ""}
                                onChange={e => setEditState(prev => ({ ...prev, [control.id]: { ...prev[control.id], auditor_notes: e.target.value } }))}
                                placeholder="Any additional notes..."
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                              />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateControl(control.id)}
                                className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 transition-colors"
                              >
                                Save
                              </button>
                              {evidence.trim().length > 0 && (
                                <button
                                  onClick={() => runAiAssess(control.id)}
                                  disabled={aiLoading === control.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                >
                                  {aiLoading === control.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    "✦ AI Assess"
                                  )}
                                </button>
                              )}
                            </div>

                            {/* AI Assessment */}
                            {control.ai_assessment && (
                              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                <p className="text-xs font-medium text-purple-700 mb-1">✦ AI Assessment</p>
                                <p className="text-sm text-purple-900 italic leading-relaxed">{control.ai_assessment}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* User Access Review Tab */}
      {activeTab === "access" && (
        <div className="space-y-6">
          {/* Upload Area */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-500" />
              Upload User Access Data
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Upload a CSV with columns: username, full_name, email, department, job_title, system_name, access_level, access_granted_date, last_login_date, is_active, has_mfa
            </p>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={uploadAccessCSV} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={accessUploading}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50 transition-colors"
            >
              {accessUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {accessUploading ? "Uploading..." : "Upload CSV"}
            </button>
          </div>

          {/* Summary Stats */}
          {accessSummary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Users", value: accessSummary.total_users, color: "text-slate-900" },
                  { label: "Dormant Accounts", value: accessSummary.dormant_accounts, color: "text-amber-600" },
                  { label: "Admin Accounts", value: accessSummary.admin_accounts, color: "text-red-600" },
                  { label: "Admins without MFA", value: accessSummary.no_mfa_admins, color: "text-red-700" },
                ].map(s => (
                  <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Flagged Users Table */}
              {accessSummary.flagged_users.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Flagged Users ({accessSummary.flagged_users.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          {["Username", "Department", "Access Level", "System", "Risk Flags", "Last Login"].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {accessSummary.flagged_users.map((u, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{u.username}</td>
                            <td className="px-4 py-3 text-slate-600">{u.department}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                u.access_level.toLowerCase() === "admin" || u.access_level.toLowerCase() === "superuser"
                                  ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
                              }`}>{u.access_level}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{u.system_name}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {u.risk_flag.split(",").map(flag => (
                                  <span key={flag} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium">
                                    {flag.replace("_", " ")}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">{u.last_login_date || "Never"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Change Management Tab */}
      {activeTab === "change" && (
        <div className="space-y-6">
          {/* Upload Area */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-500" />
                  Upload Change Log
                </h3>
                <p className="text-sm text-slate-500">
                  Upload a CSV from your ITSM tool (e.g. Jira, ServiceNow).
                </p>
              </div>
              <a href={`${API_BASE}/api/v1/templates/itsm_changes`} download className="text-sm text-cyan-600 hover:underline flex items-center gap-1">
                <Download className="w-4 h-4" /> Download Template
              </a>
            </div>
            <input ref={changeFileInputRef} type="file" accept=".csv" className="hidden" onChange={uploadChangeCSV} />
            <button
              onClick={() => changeFileInputRef.current?.click()}
              disabled={changeUploading}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50 transition-colors"
            >
              {changeUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {changeUploading ? "Uploading..." : "Upload Change Log CSV"}
            </button>
          </div>

          {/* Summary Stats */}
          {changeSummary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Changes", value: changeSummary.total_changes, color: "text-slate-900" },
                  { label: "Unauthorized", value: changeSummary.unauthorized, color: "text-red-600" },
                  { label: "Emergency", value: changeSummary.emergency, color: "text-amber-600" },
                  { label: "Production Direct", value: changeSummary.production_direct, color: "text-red-700" },
                ].map(s => (
                  <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Changes Table */}
              {changeSummary.changes.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900">Recent Changes ({changeSummary.changes.length})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          {["Change ID", "Type", "Description", "Environment", "Risk Flags", "Date"].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {changeSummary.changes.map((c, i) => {
                           const flags = [];
                           if (c.is_unauthorized) flags.push("Unauthorized");
                           if (c.is_emergency) flags.push("Emergency");
                           if (c.production_direct) flags.push("Prod Direct (No Test)");
                           return (
                             <tr key={i} className="hover:bg-slate-50">
                               <td className="px-4 py-3 font-medium text-slate-900">{c.change_id}</td>
                               <td className="px-4 py-3">
                                 <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                   c.change_type === "emergency" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                                 }`}>{c.change_type}</span>
                               </td>
                               <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={c.description || ""}>{c.description || "-"}</td>
                               <td className="px-4 py-3 text-slate-600">{c.environment}</td>
                               <td className="px-4 py-3">
                                 <div className="flex flex-wrap gap-1">
                                   {flags.length > 0 ? flags.map(flag => (
                                     <span key={flag} className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full font-medium">
                                       {flag}
                                     </span>
                                   )) : <span className="text-slate-400 text-xs">None</span>}
                                 </div>
                               </td>
                               <td className="px-4 py-3 text-slate-500 text-xs">{c.change_date || "-"}</td>
                             </tr>
                           )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <CopilotFAB engagementId={engagementId} moduleName="it" />
    </div>
  );
}

