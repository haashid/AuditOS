"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, ShieldCheck, AlertCircle, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { DashboardTab } from "@/components/internal-audit/DashboardTab";
import { ControlMatrixTable } from "@/components/internal-audit/ControlMatrixTable";
import { toast } from "@/hooks/useToast";
import { CopilotFAB } from '@/components/CopilotFAB';

export default function InternalAuditPage() {
  const [controls, setControls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchControls = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/v1/internal-controls");
      if (Array.isArray(data)) {
        setControls(data);
      }
    } catch (e) {
      toast.error("Failed to load internal controls");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchControls();
  }, []);

  const totalControls = controls.length;
  const testedControls = controls.filter(c => c.tests && c.tests.length > 0).length;
  const ineffectiveControls = controls.filter(c => 
    c.tests && c.tests.length > 0 && c.tests[0].effectiveness === "Ineffective"
  ).length;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Building className="w-6 h-6 text-indigo-600" />
          Internal Audit
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage Risk Control Matrix (RCM) and perform continuous control testing.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total Controls</p>
                <h3 className="text-2xl font-bold text-slate-900">{totalControls}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Controls Tested</p>
                <h3 className="text-2xl font-bold text-slate-900">{testedControls}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Open Deficiencies</p>
                <h3 className="text-2xl font-bold text-slate-900">{ineffectiveControls}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rcm" className="w-full">
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="rcm">Risk Control Matrix</TabsTrigger>
        </TabsList>
        <div className="mt-6">
          <TabsContent value="dashboard">
            <DashboardTab controls={controls} />
          </TabsContent>
          <TabsContent value="rcm">
            <ControlMatrixTable controls={controls} refreshControls={fetchControls} loading={loading} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}


