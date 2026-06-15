"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/useToast";
import { apiPortalGetFindings, apiPortalRespondFinding, Finding } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MessageSquare, LogOut, Send } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/40",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  low: "bg-blue-500/20 text-blue-300 border-blue-500/40",
};

export default function PortalDashboard() {
  const router = useRouter();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("auditos_portal_token");
    if (!token) {
      router.push("/portal/login");
      return;
    }

    apiPortalGetFindings(token)
      .then((data) => {
        setFindings(data);
        const initialResponses: Record<string, string> = {};
        data.forEach(f => {
          initialResponses[f.id] = f.management_response || "";
        });
        setResponses(initialResponses);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Session expired. Please login again.");
        localStorage.removeItem("auditos_portal_token");
        router.push("/portal/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("auditos_portal_token");
    router.push("/portal/login");
  };

  const handleSubmitResponse = async (findingId: string) => {
    const token = localStorage.getItem("auditos_portal_token");
    if (!token) return;
    
    setSubmitting(findingId);
    try {
      await apiPortalRespondFinding(token, findingId, responses[findingId] || "");
      toast.success("Management response submitted");
      setFindings(findings.map(f => f.id === findingId ? { ...f, management_response: responses[findingId] } : f));
    } catch (err: any) {
      toast.error(err.message || "Failed to submit response");
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading your findings...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Audit Findings</h1>
          <p className="text-slate-400">
            Please review the open findings below and provide your management responses.
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {findings.length === 0 ? (
        <div className="text-center p-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">You have no open findings requiring a response.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {findings.map((finding) => (
            <div key={finding.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline" className={SEVERITY_COLORS[finding.severity] || "border-slate-500 text-slate-400"}>
                    {finding.severity.toUpperCase()}
                  </Badge>
                  <h3 className="text-lg font-semibold text-white">{finding.title}</h3>
                </div>
                <p className="text-slate-300 mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                  {finding.description}
                </p>
                {finding.recommendation && (
                  <div className="mt-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                    <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">Auditor Recommendation</h4>
                    <p className="text-sm text-indigo-200/80">{finding.recommendation}</p>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-slate-900/50 border-t border-slate-700">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <MessageSquare className="w-4 h-4" /> Management Response
                </label>
                <textarea
                  value={responses[finding.id] || ""}
                  onChange={(e) => setResponses({ ...responses, [finding.id]: e.target.value })}
                  placeholder="Enter your management response, remediation plan, and timeline here..."
                  className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder:text-slate-600 resize-none"
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    onClick={() => handleSubmitResponse(finding.id)}
                    disabled={submitting === finding.id || responses[finding.id] === finding.management_response}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {submitting === finding.id ? "Saving..." : finding.management_response ? "Update Response" : "Submit Response"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
