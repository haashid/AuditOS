"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { toast } from "@/hooks/useToast";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  UploadCloud, FileJson, FileSpreadsheet, CheckCircle2,
  AlertTriangle, RefreshCw, FileText, Download, Bot, Check, ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  apiUploadGSTReturn, apiListGSTReturns, apiRunGSTReconciliation,
  apiGetITCMismatches, apiUpload26AS, apiGetTDSSummary,
  apiGetForm3CD, apiUpdateForm3CDResponse, apiAISuggestForm3CDResponse
} from "@/lib/api";

const TABS = [
  { id: "gst", label: "GST Returns" },
  { id: "recon", label: "GST Reconciliation" },
  { id: "tds", label: "TDS / 26AS" },
  { id: "3cd", label: "Form 3CD" },
];

export default function TaxAuditPage() {
  const params = useParams();
  const engagementId = params.engagement_id as string;
  const router = useRouter();
  const { hasModule, isLoading } = useAuth();

  const [activeTab, setActiveTab] = useState("gst");
  const [dataLoaded, setDataLoaded] = useState(false);

  // Data States
  const [gstReturns, setGstReturns] = useState<any[]>([]);
  const [mismatches, setMismatches] = useState<any[]>([]);
  const [tdsSummary, setTdsSummary] = useState<any>(null);
  const [form3cd, setForm3cd] = useState<any>(null);

  // Loading States
  const [isUploading, setIsUploading] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!hasModule("tax_audit")) {
      toast.error("Tax Audit module not activated. Contact your administrator.");
      router.push("/dashboard");
      return;
    }

    loadAllData();
  }, [engagementId, isLoading]);

  const loadAllData = async () => {
    try {
      const [gstRes, reconRes, tdsRes, f3cdRes] = await Promise.all([
        apiListGSTReturns(engagementId).catch(() => []),
        apiGetITCMismatches(engagementId).catch(() => []),
        apiGetTDSSummary(engagementId).catch(() => null),
        apiGetForm3CD(engagementId).catch(() => null)
      ]);
      setGstReturns(gstRes);
      setMismatches(reconRes);
      setTdsSummary(tdsRes);
      setForm3cd(f3cdRes);
      setDataLoaded(true);
    } catch (error) {
      toast.error("Failed to load tax audit data");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, returnType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      if (returnType === "26AS") {
        await apiUpload26AS(engagementId, file);
        toast.success("26AS records parsed successfully");
        const tdsRes = await apiGetTDSSummary(engagementId);
        setTdsSummary(tdsRes);
      } else {
        await apiUploadGSTReturn(engagementId, returnType, file);
        toast.success(`${returnType} uploaded successfully`);
        const gstRes = await apiListGSTReturns(engagementId);
        setGstReturns(gstRes);
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRunRecon = async () => {
    setIsReconciling(true);
    try {
      await apiRunGSTReconciliation(engagementId);
      toast.success("Reconciliation task started");
      setTimeout(async () => {
        const reconRes = await apiGetITCMismatches(engagementId);
        setMismatches(reconRes);
        setIsReconciling(false);
        toast.success("Reconciliation complete");
      }, 3000);
    } catch (err: any) {
      toast.error(err.message || "Reconciliation failed");
      setIsReconciling(false);
    }
  };

  const handleGetAISuggestion = async (clauseNumber: string) => {
    setIsSuggesting(clauseNumber);
    try {
      const res = await apiAISuggestForm3CDResponse(engagementId, clauseNumber);
      
      // Update local state
      setForm3cd((prev: any) => {
        const newClauses = prev.clauses.map((c: any) => 
          c.clause_number === clauseNumber 
            ? { ...c, ai_suggested_response: res.suggestion }
            : c
        );
        return { ...prev, clauses: newClauses };
      });
      toast.success("AI suggestion generated");
    } catch (err) {
      toast.error("Failed to get AI suggestion");
    } finally {
      setIsSuggesting(null);
    }
  };

  const handleAcceptSuggestion = (clauseNumber: string, suggestion: string) => {
    handleSaveClause(clauseNumber, suggestion, true);
  };

  const handleSaveClause = async (clauseNumber: string, response: string, isApplicable: boolean) => {
    try {
      await apiUpdateForm3CDResponse(engagementId, clauseNumber, response, isApplicable);
      
      // Update local state
      setForm3cd((prev: any) => {
        const newClauses = prev.clauses.map((c: any) => {
          if (c.clause_number === clauseNumber) {
            const isCompleted = isApplicable ? response.trim().length > 0 : true;
            return { ...c, response, is_applicable: isApplicable, is_completed: isCompleted };
          }
          return c;
        });
        const newCompleted = newClauses.filter((c: any) => c.is_completed).length;
        return { ...prev, clauses: newClauses, completed: newCompleted };
      });
      toast.success("Clause saved");
    } catch (err) {
      toast.error("Failed to save clause");
    }
  };

  if (isLoading || !dataLoaded) {
    return <div className="p-8 text-slate-500">Loading tax dashboard...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Tax Audit Workspace
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium ml-2">Phase 3</span>
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Automated GST reconciliation and Form 3CD generation</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-lg border border-slate-200 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-all",
              activeTab === tab.id
                ? "bg-white text-blue-700 shadow-sm border border-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        
        {/* GST Returns Tab */}
        {activeTab === "gst" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['GSTR-1', 'GSTR-3B', 'GSTR-2B'].map(type => {
                const uploaded = gstReturns.find(r => r.return_type === type);
                return (
                  <Card key={type} className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-slate-100">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                          <FileJson className="w-4 h-4 text-slate-400" />
                          {type}
                        </CardTitle>
                        {uploaded ? (
                          <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Uploaded
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                            Missing
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      {uploaded ? (
                        <div className="text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Period:</span>
                            <span className="font-medium text-slate-900">{uploaded.filing_period}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Total Tax:</span>
                            <span className="font-medium text-slate-900">₹{uploaded.total_tax.toLocaleString('en-IN')}</span>
                          </div>
                          <p className="text-xs text-slate-400 truncate pt-2" title={uploaded.file_name}>
                            File: {uploaded.file_name}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 py-2">
                          Download the JSON payload from the GSTN portal and upload it here.
                        </p>
                      )}
                      
                      <div className="pt-2">
                        <input
                          type="file"
                          id={`upload-${type}`}
                          className="hidden"
                          accept=".json"
                          onChange={(e) => handleFileUpload(e, type)}
                          disabled={isUploading}
                        />
                        <Button 
                          variant="outline" 
                          className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => document.getElementById(`upload-${type}`)?.click()}
                          disabled={isUploading}
                        >
                          <UploadCloud className="w-4 h-4 mr-2" />
                          {uploaded ? "Replace File" : "Upload JSON"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* GST Reconciliation Tab */}
        {activeTab === "recon" && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <CardTitle className="text-base text-slate-900">ITC Mismatches</CardTitle>
                <CardDescription>Reconciliation between GSTR-2B (Available) and GSTR-3B (Claimed)</CardDescription>
              </div>
              <Button 
                onClick={handleRunRecon}
                disabled={isReconciling || !gstReturns.some(r => r.return_type === 'GSTR-3B') || !gstReturns.some(r => r.return_type === 'GSTR-2B')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isReconciling && "animate-spin")} />
                {isReconciling ? "Reconciling..." : "Run Reconciliation"}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {mismatches.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p>No ITC mismatches detected.</p>
                  <p className="text-sm mt-1">Run reconciliation after uploading GSTR-2B and GSTR-3B.</p>
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Tax Type</th>
                      <th className="px-4 py-3 text-right">Available (2B)</th>
                      <th className="px-4 py-3 text-right">Claimed (3B)</th>
                      <th className="px-4 py-3 text-right">Difference</th>
                      <th className="px-4 py-3">Risk</th>
                      <th className="px-4 py-3 w-1/3">AI Explanation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mismatches.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">{m.supplier_name.replace(" Summary Reconciliation", "")}</td>
                        <td className="px-4 py-3 text-right">₹{m.itc_in_2b.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right">₹{m.itc_in_3b.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right font-medium text-red-600">
                          ₹{Math.abs(m.difference).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                            m.risk_level === 'critical' ? 'bg-red-100 text-red-700' :
                            m.risk_level === 'high' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          )}>
                            {m.risk_level}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 leading-relaxed">
                          <div className="flex items-start gap-2">
                            <Bot className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span>{m.ai_explanation}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* TDS / 26AS Tab */}
        {activeTab === "tds" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex gap-4 items-center">
                <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-blue-900">Form 26AS Upload</h3>
                  <p className="text-sm text-blue-700">Upload CSV export from the Income Tax portal</p>
                </div>
              </div>
              <div>
                <input
                  type="file"
                  id="upload-26as"
                  className="hidden"
                  accept=".csv,.xlsx"
                  onChange={(e) => handleFileUpload(e, "26AS")}
                  disabled={isUploading}
                />
                <Button 
                  onClick={() => document.getElementById("upload-26as")?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isUploading}
                >
                  <UploadCloud className="w-4 h-4 mr-2" />
                  Upload 26AS
                </Button>
              </div>
            </div>

            {tdsSummary?.records?.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 font-medium">Total Records</p>
                    <p className="text-2xl font-bold text-slate-900">{tdsSummary.total_records}</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 font-medium">Total Payment Amount</p>
                    <p className="text-2xl font-bold text-slate-900">₹{tdsSummary.total_payment_amount.toLocaleString('en-IN')}</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm border-blue-200 bg-blue-50/30">
                  <CardContent className="p-4">
                    <p className="text-xs text-blue-600 font-medium">Total TDS Deducted</p>
                    <p className="text-2xl font-bold text-blue-700">₹{tdsSummary.total_tds_amount.toLocaleString('en-IN')}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {tdsSummary?.records?.length > 0 && (
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row justify-between items-center">
                  <CardTitle className="text-base">TDS Records</CardTitle>
                  <Button variant="outline" size="sm" className="h-8 text-slate-600">
                    <Download className="w-3 h-3 mr-2" /> Export
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[400px] overflow-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="px-4 py-2">Deductor Name</th>
                          <th className="px-4 py-2">TAN</th>
                          <th className="px-4 py-2">Section</th>
                          <th className="px-4 py-2 text-right">Payment</th>
                          <th className="px-4 py-2 text-right">TDS Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tdsSummary.records.map((r: any) => (
                          <tr key={r.id}>
                            <td className="px-4 py-2 text-slate-900 truncate max-w-[200px]">{r.deductor_name}</td>
                            <td className="px-4 py-2 font-mono text-slate-600 text-xs">{r.deductor_tan}</td>
                            <td className="px-4 py-2 font-medium text-blue-700">{r.section}</td>
                            <td className="px-4 py-2 text-right">₹{r.payment_amount.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-2 text-right font-medium text-slate-900">₹{r.tds_amount.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Form 3CD Tab */}
        {activeTab === "3cd" && form3cd && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Form 3CD Clauses</h3>
                <p className="text-sm text-slate-500">Tax Audit Report under Section 44AB</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-slate-600">
                  <span className="font-bold text-slate-900">{form3cd.completed}</span> / {form3cd.total_clauses} completed
                </div>
                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${(form3cd.completed / form3cd.total_clauses) * 100}%` }}
                  />
                </div>
                <Button variant="outline" className="text-slate-600 bg-white shadow-sm border-slate-200">
                  <FileText className="w-4 h-4 mr-2" />
                  Generate PDF
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {form3cd.clauses.map((clause: any) => (
                <Card key={clause.clause_number} className={cn("border-slate-200 shadow-sm transition-colors", clause.is_completed ? "border-l-4 border-l-green-500" : "border-l-4 border-l-slate-300")}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="bg-slate-100 text-slate-700 font-bold px-2 py-1 rounded text-xs">Clause {clause.clause_number}</span>
                          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{clause.category}</span>
                          {clause.is_completed && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        </div>
                        <p className="text-sm text-slate-900 font-medium mb-4">{clause.clause_text}</p>
                        
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id={`na-${clause.clause_number}`} 
                              checked={!clause.is_applicable}
                              onCheckedChange={(c) => handleSaveClause(clause.clause_number, clause.response, !c)}
                            />
                            <Label htmlFor={`na-${clause.clause_number}`} className="text-sm text-slate-600">Not Applicable</Label>
                          </div>
                          
                          {clause.is_applicable && (
                            <>
                              <Textarea
                                placeholder="Auditor's response..."
                                value={clause.response}
                                onChange={(e) => {
                                  // Local state update immediately for typing
                                  setForm3cd((prev: any) => ({
                                    ...prev,
                                    clauses: prev.clauses.map((c: any) => 
                                      c.clause_number === clause.clause_number ? { ...c, response: e.target.value } : c
                                    )
                                  }));
                                }}
                                onBlur={(e) => handleSaveClause(clause.clause_number, e.target.value, true)}
                                className="min-h-[100px] bg-slate-50"
                              />

                              {/* AI Suggestion Area */}
                              <div className="flex justify-end gap-2 pt-1">
                                {clause.ai_suggested_response && (
                                  <div className="flex-1 bg-blue-50/50 border border-blue-100 rounded p-3 text-sm text-blue-900 mr-2">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-blue-700 font-semibold text-xs uppercase tracking-wider">
                                      <Bot className="w-3.5 h-3.5" /> AI Suggestion
                                    </div>
                                    <p className="text-slate-700">{clause.ai_suggested_response}</p>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 px-2 mt-2 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs"
                                      onClick={() => handleAcceptSuggestion(clause.clause_number, clause.ai_suggested_response)}
                                    >
                                      <Check className="w-3 h-3 mr-1" /> Use this
                                    </Button>
                                  </div>
                                )}
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleGetAISuggestion(clause.clause_number)}
                                  disabled={isSuggesting === clause.clause_number}
                                  className="text-blue-600 border-blue-200 hover:bg-blue-50 self-start"
                                >
                                  <BrainCircuit className={cn("w-4 h-4 mr-2", isSuggesting === clause.clause_number && "animate-pulse")} />
                                  {isSuggesting === clause.clause_number ? "Generating..." : "Get AI Suggestion"}
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
