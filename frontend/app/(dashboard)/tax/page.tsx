"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiListEngagements, Engagement } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, Briefcase, Calendar, FolderOpen, ArrowRight } from "lucide-react";

export default function TaxAuditWorkspace() {
  const router = useRouter();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiListEngagements()
      .then((data) => {
        setEngagements(data.filter((e) => e.audit_type === "tax"));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900 to-teal-800 p-8 rounded-2xl shadow-lg text-white">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <Receipt className="w-6 h-6 text-emerald-100" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Tax Audit Workspace</h1>
          </div>
          <p className="text-emerald-100/80 max-w-xl text-sm leading-relaxed">
            Welcome to the AI-powered Tax Audit module. Select an engagement below to perform GST reconciliations, analyze Form 3CD clauses, and parse Form 26AS.
          </p>
        </div>
        <Button 
          onClick={() => router.push("/engagements")}
          className="bg-white text-emerald-900 hover:bg-emerald-50 shadow-sm self-start md:self-auto border-0"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          View All Engagements
        </Button>
      </div>

      {/* Engagements Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-emerald-600" />
          Active Engagements
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : engagements.length === 0 ? (
          <Card className="bg-slate-50 border-dashed border-2 border-slate-200">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
                <Receipt className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">No Engagements Found</h3>
              <p className="text-slate-500 text-sm mb-6 max-w-sm">
                You haven't created any engagements yet. Head over to the Engagements page to create one.
              </p>
              <Button onClick={() => router.push("/engagements")} className="bg-emerald-600 text-white hover:bg-emerald-700">
                Create Engagement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {engagements.map((eng) => (
              <Card 
                key={eng.id} 
                className="group cursor-pointer hover:shadow-md transition-all duration-300 hover:-translate-y-1 border-slate-200 bg-white"
                onClick={() => router.push(`/tax/${eng.id}`)}
              >
                <CardHeader className="pb-3 border-b border-slate-50 relative overflow-hidden">
                  {/* Subtle background decoration */}
                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
                  
                  <div className="relative z-10">
                    <Badge variant="outline" className={`mb-3 capitalize ${
                      eng.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      eng.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {eng.status}
                    </Badge>
                    <CardTitle className="text-lg text-slate-900 truncate pr-4">
                      {eng.name}
                    </CardTitle>
                    <p className="text-sm text-slate-500 truncate mt-1">
                      {eng.client_name || "No Client Assigned"}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 relative z-10">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      {eng.fiscal_year_start ? `${eng.fiscal_year_start.substring(0,4)}` : "TBD"}
                    </div>
                    
                    <div className="flex items-center text-emerald-600 font-medium text-xs opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-300">
                      Open Tax Hub
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
