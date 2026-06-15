"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  apiGetOrganizationsAdmin,
  apiActivateModule,
  apiDeactivateModule
} from "@/lib/api";
import { Shield, Search, Settings, Check, X } from "lucide-react";

export default function SuperadminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Superadmin check
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login");
      } else if (!user.is_superadmin) {
        router.push("/dashboard");
      }
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.is_superadmin) {
      fetchOrgs();
    }
  }, [user]);

  const fetchOrgs = async () => {
    try {
      setDataLoading(true);
      const data = await apiGetOrganizationsAdmin();
      setOrganizations(data);
    } catch (e) {
      console.error("Failed to fetch organizations:", e);
    } finally {
      setDataLoading(false);
    }
  };

  const handleToggleModule = async (orgId: string, moduleKey: string, isActive: boolean) => {
    try {
      if (isActive) {
        if (!confirm(`Are you sure you want to deactivate ${moduleKey}?`)) return;
        await apiDeactivateModule(orgId, moduleKey);
      } else {
        await apiActivateModule(orgId, moduleKey);
      }
      // Refresh
      fetchOrgs();
      
      // Update selected org state if open
      if (selectedOrg && selectedOrg.id === orgId) {
        const newActive = isActive 
          ? selectedOrg.active_modules.filter((m: string) => m !== moduleKey)
          : [...selectedOrg.active_modules, moduleKey];
        setSelectedOrg({ ...selectedOrg, active_modules: newActive });
      }
    } catch (e: any) {
      alert(e.message || "Failed to toggle module");
    }
  };

  const filteredOrgs = organizations.filter(org => 
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Hardcoded for UI mapping, ideally fetched from an endpoint, but perfectly fine to define here for the UI
  const ALL_MODULES = [
    { key: "financial_audit", name: "Financial Audit", is_core: true },
    { key: "internal_audit", name: "Internal Audit" },
    { key: "tax_audit", name: "Tax Audit" },
    { key: "it_audit", name: "IT Audit", coming_soon: true },
    { key: "cyber_audit", name: "Cybersecurity Audit", coming_soon: true },
    { key: "esg_audit", name: "ESG Audit", coming_soon: true },
    { key: "operational_audit", name: "Operational Audit", coming_soon: true },
    { key: "supply_chain_audit", name: "Supply Chain Audit", coming_soon: true }
  ];

  if (loading || !user || !user.is_superadmin) {
    return <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">AuditOS Admin Panel</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <span>Logged in as: <strong>{user.email}</strong></span>
          <button onClick={() => router.push("/dashboard")} className="text-blue-600 hover:underline">
            Back to App
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 flex">
        {/* Main Table Area */}
        <div className={`flex-1 transition-all ${selectedOrg ? 'pr-6' : ''}`}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-120px)]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Organizations</h2>
              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search organizations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {dataLoading ? (
                <div className="p-8 text-center text-slate-500">Loading organizations...</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                      <th className="font-medium px-6 py-3">Organization</th>
                      <th className="font-medium px-6 py-3 text-center">Members</th>
                      <th className="font-medium px-6 py-3">Active Modules</th>
                      <th className="font-medium px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                    {filteredOrgs.map(org => (
                      <tr key={org.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{org.name}</td>
                        <td className="px-6 py-4 text-center">{org.member_count}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {org.active_modules.map((m: string) => (
                              <span key={m} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-100">
                                {m.replace("_audit", "")}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedOrg(org)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                          >
                            <Settings className="w-4 h-4" />
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredOrgs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                          No organizations found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Slide-over panel */}
        {selectedOrg && (
          <div className="w-[400px] bg-white rounded-2xl border border-slate-200 shadow-xl flex flex-col h-[calc(100vh-120px)] animate-fade-in-up">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Managing Modules</p>
                <h3 className="text-lg font-bold text-slate-900">{selectedOrg.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedOrg(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {ALL_MODULES.map(module => {
                const isActive = selectedOrg.active_modules.includes(module.key);
                
                return (
                  <div key={module.key} className={`flex items-center justify-between p-4 rounded-xl border ${isActive ? 'bg-blue-50/50 border-blue-100' : 'bg-white border-slate-200'} ${module.coming_soon ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                        {isActive ? <Check className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{module.name}</div>
                        {module.is_core && <div className="text-xs text-blue-600 font-medium">Core — Always On</div>}
                        {module.coming_soon && <div className="text-xs text-slate-400">Coming Soon</div>}
                      </div>
                    </div>
                    
                    {!module.is_core && !module.coming_soon && (
                      <button
                        onClick={() => handleToggleModule(selectedOrg.id, module.key, isActive)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive 
                            ? 'bg-white border border-slate-300 text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200' 
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
