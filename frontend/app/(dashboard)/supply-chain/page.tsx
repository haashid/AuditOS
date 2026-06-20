"use client";

import { useEffect, useState, useRef } from "react";
import { Truck, Upload, Plus, ChevronRight, AlertTriangle, ShieldAlert, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("auditos_token") : null;
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

export default function SupplyChainDashboard() {
  const router = useRouter();
  const [engagements, setEngagements] = useState<any[]>([]);
  const [activeEngagementId, setActiveEngagementId] = useState<string | null>(null);
  
  const [vendors, setVendors] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchEngagements = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/engagements`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setEngagements(data);
        if (data.length > 0 && !activeEngagementId) {
          setActiveEngagementId(data[0].id);
        }
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchEngagements();
  }, []);

  const fetchVendors = async () => {
    if (!activeEngagementId) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/supply-chain/engagements/${activeEngagementId}/vendors`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setVendors(data.vendors);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchVendors();
  }, [activeEngagementId]);

  const uploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeEngagementId) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/api/v1/supply-chain/engagements/${activeEngagementId}/vendors/upload-csv`, {
        method: "POST", headers: authHeaders(), body: fd
      });
      const data = await res.json();
      alert(`Uploaded ${data.total_vendors} vendors`);
      fetchVendors();
    } catch { alert("Upload failed"); }
    finally { setUploading(false); }
  };

  const highCritical = vendors.filter(v => v.criticality === "High").length;
  const highRisk = vendors.filter(v => (v.overall_risk_score || 0) > 75).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Engagement Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-500" />
            Supply Chain Audit
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Vendor risk assessment and compliance monitoring</p>
        </div>

        {engagements.length > 0 ? (
          <select 
            value={activeEngagementId || ""}
            onChange={(e) => setActiveEngagementId(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5 shadow-sm"
          >
            {engagements.map((eng) => (
              <option key={eng.id} value={eng.id}>{eng.client_name} - {eng.period_name}</option>
            ))}
          </select>
        ) : (
          <div className="text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
            No active engagements found.
          </div>
        )}
      </div>

      {activeEngagementId ? (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-50 rounded-lg"><Truck className="w-5 h-5 text-indigo-600" /></div>
                <h3 className="text-slate-600 font-medium">Total Vendors</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{vendors.length}</p>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-50 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                <h3 className="text-slate-600 font-medium">High Criticality</h3>
              </div>
              <p className="text-3xl font-bold text-red-600">{highCritical}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-50 rounded-lg"><ShieldAlert className="w-5 h-5 text-orange-600" /></div>
                <h3 className="text-slate-600 font-medium">High Risk (&gt;75)</h3>
              </div>
              <p className="text-3xl font-bold text-orange-600">{highRisk}</p>
            </div>
          </div>

          {/* Vendors Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-900">Vendor Master List</h3>
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={uploadCSV} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Uploading..." : "Upload CSV"}
                </button>
              </div>
            </div>
            
            {vendors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b border-slate-100 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Vendor Code</th>
                      <th className="px-5 py-3 font-semibold">Vendor Name</th>
                      <th className="px-5 py-3 font-semibold">Category</th>
                      <th className="px-5 py-3 font-semibold">Criticality</th>
                      <th className="px-5 py-3 font-semibold text-right">Risk Score</th>
                      <th className="px-5 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {vendors.map((v) => {
                      const scoreColor = !v.overall_risk_score ? "text-slate-400" :
                                         v.overall_risk_score > 75 ? "text-red-600 font-bold" :
                                         v.overall_risk_score > 50 ? "text-orange-600 font-bold" : "text-emerald-600 font-bold";
                      return (
                        <tr key={v.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-5 py-4 font-mono text-xs text-slate-500">{v.vendor_code}</td>
                          <td className="px-5 py-4 font-medium text-slate-900">{v.vendor_name}</td>
                          <td className="px-5 py-4 text-slate-600">{v.category}</td>
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                              v.criticality === "High" ? "bg-red-50 text-red-700" :
                              v.criticality === "Medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                            }`}>
                              {v.criticality}
                            </span>
                          </td>
                          <td className={`px-5 py-4 text-right ${scoreColor}`}>
                            {v.overall_risk_score ? `${v.overall_risk_score}/100` : "Unassessed"}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Link href={`/supply-chain/${v.id}?engagement_id=${activeEngagementId}`}
                                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium text-sm">
                              Audit <ChevronRight className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <Truck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900 mb-1">No vendors found</h3>
                <p className="text-slate-500 text-sm mb-4">Upload a vendor master CSV to get started.</p>
                <button onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                  <Upload className="w-4 h-4" /> Upload CSV
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">Select an Engagement</h3>
          <p className="text-slate-500 text-sm">Please select an engagement from the dropdown above to view the supply chain dashboard.</p>
        </div>
      )}
    </div>
  );
}
