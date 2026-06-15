"use client";

import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, Building2, Link as LinkIcon, Save, Layers, CheckCircle2, CircleDashed } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "@/hooks/useToast";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 w-40 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-900 font-medium">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Integration states for Demo
  const [zohoClientId, setZohoClientId] = useState("1000.xxxxxxxxx");
  const [zohoClientSecret, setZohoClientSecret] = useState("••••••••••••••••");
  
  const [tallyClientId, setTallyClientId] = useState("tally_live_v1");
  const [tallyClientSecret, setTallyClientSecret] = useState("••••••••••••••••");

  const handleSaveIntegrations = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Integration settings saved successfully.");
    }, 800);
  };

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account and integration preferences</p>
      </div>

      <div className="grid gap-8">
        {/* Profile card */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Profile details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-col">
              <InfoRow label="Full name" value={user?.full_name || "—"} />
              <InfoRow label="Email address" value={user?.email || "—"} />
              <InfoRow label="Role" value={user?.role || "—"} />
              <InfoRow
                label="Account created"
                value={
                  user?.created_at
                    ? new Date(user.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Organization card */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Organization setup
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-col">
              <InfoRow label="Firm Name" value={user?.org_id ? "Demo Audit Partners" : "—"} />
              <InfoRow label="Organization ID" value={user?.org_id?.slice(0, 8) + "..." || "—"} />
            </div>
          </CardContent>
        </Card>

        {/* Integrations card */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-4 border-b border-slate-100">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-blue-600" />
                  API Integrations
                </CardTitle>
                <CardDescription className="mt-1.5">
                  Configure your OAuth Client ID and Secret for live connector syncing.
                </CardDescription>
              </div>
              <Button 
                onClick={handleSaveIntegrations} 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                {loading ? "Saving..." : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Keys
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            
            {/* Zoho Books */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Zoho Books Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">Client ID</Label>
                  <Input 
                    value={zohoClientId}
                    onChange={(e) => setZohoClientId(e.target.value)}
                    className="bg-slate-50 border-slate-200 focus:border-blue-500" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">Client Secret</Label>
                  <Input 
                    type="password"
                    value={zohoClientSecret}
                    onChange={(e) => setZohoClientSecret(e.target.value)}
                    className="bg-slate-50 border-slate-200 focus:border-blue-500" 
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100 w-full"></div>

            {/* Tally Prime */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                Tally Prime Cloud Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">Client ID / URL</Label>
                  <Input 
                    value={tallyClientId}
                    onChange={(e) => setTallyClientId(e.target.value)}
                    className="bg-slate-50 border-slate-200 focus:border-blue-500" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">Client Secret / API Key</Label>
                  <Input 
                    type="password"
                    value={tallyClientSecret}
                    onChange={(e) => setTallyClientSecret(e.target.value)}
                    className="bg-slate-50 border-slate-200 focus:border-blue-500" 
                  />
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Modules card */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-4 border-b border-slate-100">
            <div>
              <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Audit Modules
              </CardTitle>
              <CardDescription className="mt-1.5">
                View your organization's active capabilities. Contact your AuditOS administrator to enable additional modules.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              
              {/* Active Modules */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Your Active Modules</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Financial Audit</p>
                      <p className="text-xs text-slate-500">Core module — always active</p>
                    </div>
                  </div>
                  {user?.hasModule && user.hasModule("internal_audit") && (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">Internal Audit</p>
                        <p className="text-xs text-slate-500">Active</p>
                      </div>
                    </div>
                  )}
                  {user?.hasModule && user.hasModule("tax_audit") && (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">Tax Audit</p>
                        <p className="text-xs text-slate-500">Active</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Inactive Modules */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Inactive / Coming Soon</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CircleDashed className="w-5 h-5 text-slate-300 flex-shrink-0" />
                    <p className="text-sm text-slate-500">IT Audit <span className="text-xs ml-2 text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">Phase 4</span></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <CircleDashed className="w-5 h-5 text-slate-300 flex-shrink-0" />
                    <p className="text-sm text-slate-500">Cybersecurity <span className="text-xs ml-2 text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">Phase 4</span></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <CircleDashed className="w-5 h-5 text-slate-300 flex-shrink-0" />
                    <p className="text-sm text-slate-500">ESG Audit <span className="text-xs ml-2 text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">Phase 4</span></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <CircleDashed className="w-5 h-5 text-slate-300 flex-shrink-0" />
                    <p className="text-sm text-slate-500">Operational <span className="text-xs ml-2 text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">Phase 4</span></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <CircleDashed className="w-5 h-5 text-slate-300 flex-shrink-0" />
                    <p className="text-sm text-slate-500">Supply Chain <span className="text-xs ml-2 text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">Phase 5</span></p>
                  </div>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
