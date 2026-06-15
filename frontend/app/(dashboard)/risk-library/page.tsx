"use client";

import { useEffect, useState } from "react";
import { apiGetRiskLibrary, RiskItem } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Briefcase, ChevronDown, ChevronUp } from "lucide-react";

const INDUSTRIES = [
  { id: "banking", label: "Banking" },
  { id: "healthcare", label: "Healthcare" },
  { id: "manufacturing", label: "Manufacturing" },
  { id: "retail", label: "Retail" },
  { id: "government", label: "Government" },
  { id: "education", label: "Education" },
];

const IMPACT_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-300 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

export default function RiskLibraryPage() {
  const [activeIndustry, setActiveIndustry] = useState("banking");
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiGetRiskLibrary(activeIndustry)
      .then(setRisks)
      .catch(console.error)
      .finally(() => setLoading(false));
    setExpandedId(null);
  }, [activeIndustry]);

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-blue-600" />
          Industry Risk Library
        </h1>
        <p className="text-slate-500 mt-2">
          Explore industry-specific audit risks, recommended procedures, and AI-detected red flags.
        </p>
      </div>

      <Tabs value={activeIndustry} onValueChange={setActiveIndustry} className="w-full">
        <TabsList className="bg-white border border-slate-200 h-10 mb-6 flex flex-wrap h-auto">
          {INDUSTRIES.map((ind) => (
            <TabsTrigger
              key={ind.id}
              value={ind.id}
              className="data-[state=active]:bg-blue-50 data-[state=active]:text-slate-900 text-slate-500"
            >
              {ind.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeIndustry} className="mt-0 space-y-4">
          {loading ? (
            <div className="text-slate-500 p-8 text-center">Loading {activeIndustry} risks...</div>
          ) : risks.length === 0 ? (
            <div className="text-slate-500 p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
              No risks populated for this industry yet.
            </div>
          ) : (
            risks.map((risk) => (
              <div
                key={risk.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden transition-all"
              >
                <div
                  className="p-5 cursor-pointer hover:bg-slate-750 flex items-start justify-between"
                  onClick={() => setExpandedId(expandedId === risk.id ? null : risk.id)}
                >
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <Badge variant="outline" className="border-slate-600 text-slate-600">
                        {risk.risk_area}
                      </Badge>
                      <Badge variant="outline" className={IMPACT_COLORS[risk.impact] || "text-slate-500"}>
                        {risk.impact.toUpperCase()} IMPACT
                      </Badge>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">{risk.risk_title}</h3>
                  </div>
                  <div className="text-slate-400">
                    {expandedId === risk.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {expandedId === risk.id && (
                  <div className="p-5 border-t border-slate-200 bg-white space-y-6">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-600 mb-2">Description</h4>
                      <p className="text-sm text-slate-500 leading-relaxed">{risk.risk_description}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-semibold text-blue-600 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> Recommended Audit Procedures
                        </h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {risk.audit_procedures.map((proc, i) => (
                            <li key={i} className="text-sm text-slate-600">{proc}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-rose-400 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> AI Red Flags (to monitor)
                        </h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {risk.red_flags.map((flag, i) => (
                            <li key={i} className="text-sm text-slate-600">{flag}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
