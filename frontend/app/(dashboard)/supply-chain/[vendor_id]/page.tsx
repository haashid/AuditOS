"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, BrainCircuit, Activity, Shield, Leaf, FileText } from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("auditos_token") : null;
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });
const jsonHeaders = () => ({ "Content-Type": "application/json", ...authHeaders() });

export default function VendorDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const vendorId = params.vendor_id as string;
  const engagementId = searchParams.get("engagement_id");

  const [vendor, setVendor] = useState<any>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  
  const [finNotes, setFinNotes] = useState("");
  const [cyberNotes, setCyberNotes] = useState("");
  const [esgNotes, setEsgNotes] = useState("");
  
  const [assessing, setAssessing] = useState(false);

  const fetchVendorData = async () => {
    if (!engagementId || !vendorId) return;
    try {
      const vRes = await fetch(`${API_BASE}/api/v1/supply-chain/engagements/${engagementId}/vendors/${vendorId}`, { headers: authHeaders() });
      if (vRes.ok) setVendor(await vRes.json());

      const aRes = await fetch(`${API_BASE}/api/v1/supply-chain/engagements/${engagementId}/vendors/${vendorId}/assessments`, { headers: authHeaders() });
      if (aRes.ok) setAssessments((await aRes.json()).assessments);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchVendorData();
  }, [engagementId, vendorId]);

  const runAssessment = async () => {
    setAssessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/supply-chain/engagements/${engagementId}/vendors/${vendorId}/assess`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          financial_notes: finNotes,
          cyber_notes: cyberNotes,
          esg_notes: esgNotes
        })
      });
      if (res.ok) {
        alert("Assessment completed successfully");
        setFinNotes(""); setCyberNotes(""); setEsgNotes("");
        fetchVendorData(); // refresh vendor score and assessments list
      } else {
        alert("Assessment failed");
      }
    } catch (e) { alert("Assessment error"); }
    finally { setAssessing(false); }
  };

  if (!vendor) return <div className="p-12 text-center text-slate-500">Loading vendor data...</div>;

  const scoreColor = !vendor.overall_risk_score ? "bg-slate-100 text-slate-700" :
                     vendor.overall_risk_score > 75 ? "bg-red-100 text-red-800" :
                     vendor.overall_risk_score > 50 ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-indigo-600 flex items-center gap-1 mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Vendor List
        </button>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{vendor.vendor_name}</h1>
            <p className="text-slate-500 text-sm mt-1">Vendor Code: <span className="font-mono">{vendor.vendor_code}</span> | Category: {vendor.category}</p>
          </div>
          <div className="flex gap-3 text-sm">
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-center shadow-sm">
              <p className="text-slate-500 text-xs mb-1">Criticality</p>
              <p className="font-bold text-slate-800">{vendor.criticality}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-center shadow-sm">
              <p className="text-slate-500 text-xs mb-1">Annual Spend</p>
              <p className="font-bold text-slate-800">${vendor.annual_spend?.toLocaleString()}</p>
            </div>
            <div className={`border rounded-lg px-4 py-2 text-center shadow-sm ${scoreColor.replace('bg-', 'border-').replace('100', '200')} ${scoreColor}`}>
              <p className="text-xs mb-1 opacity-80">Overall Risk Score</p>
              <p className="font-bold text-xl">{vendor.overall_risk_score ? `${vendor.overall_risk_score}/100` : "N/A"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Data Entry */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              New Risk Assessment
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Enter audit notes from questionnaires, third-party reports, or interviews. AI will score the risk.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                  <Activity className="w-4 h-4 text-blue-500" /> Financial Health Notes
                </label>
                <textarea rows={3} value={finNotes} onChange={e => setFinNotes(e.target.value)}
                  placeholder="e.g. Current ratio is 1.2, slight decline in revenue YoY..."
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                  <Shield className="w-4 h-4 text-red-500" /> Cyber & IT Security Notes
                </label>
                <textarea rows={3} value={cyberNotes} onChange={e => setCyberNotes(e.target.value)}
                  placeholder="e.g. SOC2 Type II available, no major breaches, MFA enforced..."
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                  <Leaf className="w-4 h-4 text-emerald-500" /> ESG & Sustainability Notes
                </label>
                <textarea rows={3} value={esgNotes} onChange={e => setEsgNotes(e.target.value)}
                  placeholder="e.g. ISO 14001 certified, no modern slavery policy found..."
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              
              <button onClick={runAssessment} disabled={assessing || (!finNotes && !cyberNotes && !esgNotes)}
                className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {assessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                {assessing ? "Running AI Assessment..." : "Run AI Risk Assessment"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Assessment History */}
        <div className="space-y-6">
          {assessments.length > 0 ? (
            assessments.map((a: any, i) => (
              <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {i === 0 ? "Latest Assessment" : "Previous Assessment"}
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {a.assessment_date} • {a.assessor_name}
                  </span>
                </div>
                
                <h4 className="font-semibold text-slate-900 mb-2">Overall Summary</h4>
                <p className="text-sm text-slate-700 mb-4 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 leading-relaxed">
                  {a.ai_overall_summary}
                </p>

                <div className="space-y-3">
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Financial Risk</h5>
                    <p className="text-sm text-slate-600 leading-relaxed">{a.ai_financial_risk_explanation}</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Cyber Risk</h5>
                    <p className="text-sm text-slate-600 leading-relaxed">{a.ai_cyber_risk_explanation}</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">ESG Risk</h5>
                    <p className="text-sm text-slate-600 leading-relaxed">{a.ai_esg_risk_explanation}</p>
                  </div>
                </div>

                {a.ai_recommended_actions && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-indigo-500" /> Recommended Actions
                    </h5>
                    <p className="text-sm text-slate-600 leading-relaxed">{a.ai_recommended_actions}</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center border-dashed">
              <BrainCircuit className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-slate-900">No Assessments Yet</h3>
              <p className="text-slate-500 text-xs mt-1">Run an AI assessment to generate risk scores.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
