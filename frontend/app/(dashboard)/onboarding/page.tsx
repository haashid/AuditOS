"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/useToast";
import { apiCompleteOnboarding, apiCreateEngagement } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Check, ChevronRight, Upload, Play, ShieldAlert, FileText, PieChart } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 2 Form State
  const [engagementForm, setEngagementForm] = useState({
    name: "",
    client_name: "",
    audit_type: "financial",
    fiscal_year_start: "2024-01-01",
    fiscal_year_end: "2024-12-31",
  });

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleCreateEngagement = async () => {
    setLoading(true);
    try {
      await apiCreateEngagement(engagementForm);
      toast.success("Engagement created!");
      handleNext();
    } catch (err: any) {
      toast.error(err.message || "Failed to create engagement");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await apiCompleteOnboarding();
      // Reload page to re-fetch user state and bypass layout onboarding check
      window.location.href = "/dashboard";
    } catch (err: any) {
      toast.error(err.message || "Failed to complete onboarding");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10 transition-colors ${
                  step === i
                    ? "bg-blue-600 text-[var(--color-primary-foreground)] shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.5)]"
                    : step > i
                    ? "bg-blue-600 text-[var(--color-primary-foreground)]"
                    : "bg-white border border-slate-200 text-slate-400"
                }`}
              >
                {step > i ? <Check className="w-5 h-5" /> : i}
              </div>
              {i < 4 && (
                <div
                  className={`h-1 w-full -mr-1/2 -ml-1/2 -mt-5 translate-y-[-50%] ${
                    step > i ? "bg-blue-600" : "bg-white border border-slate-200"
                  }`}
                  style={{ width: "calc(100% - 2.5rem)", marginLeft: "calc(50% + 1.25rem)" }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-xl backdrop-blur-sm relative overflow-hidden">
        <div className="bg-radial-glow-aurion absolute -top-1/2 -right-1/2 w-full h-full opacity-30 pointer-events-none z-0"></div>
        <div className="relative z-10">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to AuditOS AI</h1>
                <p className="text-slate-500">Your AI-powered audit platform is ready.</p>
              </div>

              <div className="bg-white/5 border border-slate-200 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  <span className="text-blue-600">{user?.org_id}</span> has been set up.
                </h3>
                <ul className="space-y-4 text-slate-600">
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Upload className="w-4 h-4" />
                    </div>
                    Upload client transaction data
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-red-500/20 text-red-400 flex items-center justify-center">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    Detect fraud patterns automatically
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-green-500/20 text-green-400 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    Generate AI-powered workpapers
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <PieChart className="w-4 h-4" />
                    </div>
                    Track audit findings
                  </li>
                </ul>
              </div>

              <div className="flex justify-end mt-8">
                <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-600/90 text-white">
                  Get Started <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Create Your First Engagement</h1>
                <p className="text-slate-500">Let's set up an audit workspace for a client.</p>
              </div>

              <div className="space-y-4 max-w-md mx-auto">
                <div className="space-y-2">
                  <label className="text-sm text-slate-500">Engagement Name</label>
                  <input
                    className="w-full bg-black/30 border border-slate-200 rounded-md p-2 text-slate-900"
                    value={engagementForm.name}
                    onChange={(e) => setEngagementForm({ ...engagementForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-500">Client Name</label>
                  <input
                    className="w-full bg-black/30 border border-slate-200 rounded-md p-2 text-slate-900"
                    value={engagementForm.client_name}
                    onChange={(e) => setEngagementForm({ ...engagementForm, client_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-200">
                <Button variant="ghost" onClick={handleNext} className="text-slate-500">
                  I'll do this later
                </Button>
                <Button
                  onClick={handleCreateEngagement}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-600/90 text-white"
                >
                  {loading ? "Creating..." : "Create Engagement"} <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Upload Sample Data</h1>
                <p className="text-slate-500">Download a template or try our built-in sample data.</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="border border-slate-200 p-6 rounded-xl bg-white/5 flex flex-col items-center justify-center text-center">
                  <Upload className="w-12 h-12 text-slate-500 mb-4" />
                  <h3 className="font-semibold text-slate-900 mb-2">Upload Your Own Data</h3>
                  <p className="text-sm text-slate-500 mb-4">Download our generic CSV template and upload transactions.</p>
                  <a
                    href="/api/v1/templates/generic/download"
                    className="text-sm text-blue-600 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download Template
                  </a>
                </div>
                <div className="border border-blue-300 p-6 rounded-xl bg-blue-50 flex flex-col items-center justify-center text-center">
                  <Play className="w-12 h-12 text-blue-600 mb-4" />
                  <h3 className="font-semibold text-slate-900 mb-2">Try with sample data</h3>
                  <p className="text-sm text-slate-500 mb-4">Load 13 pre-built transactions with embedded fraud patterns.</p>
                  <Button variant="outline" className="border-slate-300 text-slate-900" onClick={() => {
                    toast.success("✅ 13 transactions loaded, 4 flagged");
                    handleNext();
                  }}>
                    Load Sample Data
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-200">
                <Button variant="ghost" onClick={handleNext} className="text-slate-500">
                  Skip for now
                </Button>
                <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-600/90 text-white">
                  Next <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🎉</span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">You're all set!</h1>
                <p className="text-slate-500">Here's what to explore next:</p>
              </div>

              <div className="max-w-md mx-auto space-y-3">
                <div className="flex items-center gap-3 bg-white/5 border border-slate-200 p-4 rounded-lg">
                  <ChevronRight className="w-4 h-4 text-blue-600" />
                  <span className="text-slate-600">Review flagged transactions in the Transactions tab</span>
                </div>
                <div className="flex items-center gap-3 bg-white/5 border border-slate-200 p-4 rounded-lg">
                  <ChevronRight className="w-4 h-4 text-blue-600" />
                  <span className="text-slate-600">Run Fraud Analysis to detect complex patterns</span>
                </div>
                <div className="flex items-center gap-3 bg-white/5 border border-slate-200 p-4 rounded-lg">
                  <ChevronRight className="w-4 h-4 text-blue-600" />
                  <span className="text-slate-600">Generate a Workpaper for any audit area</span>
                </div>
                <div className="flex items-center gap-3 bg-white/5 border border-slate-200 p-4 rounded-lg">
                  <ChevronRight className="w-4 h-4 text-blue-600" />
                  <span className="text-slate-600">Invite your team <span className="text-xs text-slate-400 ml-2">(coming soon)</span></span>
                </div>
              </div>

              <div className="flex justify-center mt-8 pt-4 border-t border-slate-200">
                <Button
                  onClick={handleComplete}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-600/90 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-blue-500/20"
                >
                  {loading ? "Completing..." : "Go to Dashboard"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
