"use client";

import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import { useParams } from "next/navigation";
import { toast } from "@/hooks/useToast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/lib/auth-context";
import {
  apiGetEngagement,
  apiListTransactions,
  apiUploadFile,
  apiUploadDocument,
  apiListDocuments,
  apiCreateFinding,
  apiListFindings,
  apiUpdateFinding,
  apiListWorkpapers,
  streamWorkpaper,
  apiGenerateReport,
  apiRunFraudAnalysis,
  apiListFraudAlerts,
  apiUpdateFraudAlert,
  apiListRegulations,
  streamGapAnalysis,
  Engagement,
  Transaction,
  TransactionListResponse,
  DocumentRecord,
  Finding,
  Workpaper,
  FraudAlert,
  RegulationItem,
  apiGetConnectorStatus,
  apiAuthorizeConnector,
  apiSubmitWorkpaper,
  apiReviewWorkpaper,
} from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Check,
  Cloud,
  Bot,
  Send,
  FileSearch,
  ShieldAlert,
  ScrollText,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Download,
  ClipboardList,
  Users,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { RoleGate } from "@/components/RoleGate";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("auditos_token") : null;

const RISK_COLOR = (score: number) => {
  if (score >= 70) return "text-rose-400";
  if (score >= 40) return "text-amber-400";
  return "text-emerald-400";
};

const FLAG_BADGE_COLORS: Record<string, string> = {
  "Round number above threshold": "bg-blue-50 text-blue-600 border-blue-600/20",
  "Transaction on weekend": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "High value transaction": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Missing description": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "No user recorded": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/40",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  low: "bg-blue-500/20 text-blue-300 border-blue-500/40",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-slate-500/20 text-slate-600 border-slate-500/40",
  in_progress: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  resolved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  risk_accepted: "bg-purple-500/20 text-purple-300 border-purple-500/40",
};

const AUDIT_AREAS = [
  "Revenue",
  "Payroll",
  "Procurement",
  "Cash & Bank",
  "Expenses",
  "Accounts Payable",
  "Accounts Receivable",
];

// ─── Data Sources Tab ─────────────────────────────────────────────────────────

function DataSourcesTab({
  engagementId,
  onUploaded,
}: {
  engagementId: string;
  onUploaded: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [connectorStatus, setConnectorStatus] = useState({ quickbooks: false, xero: false, zoho: false, tally: false });
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    // Poll connector status
    const checkStatus = () => {
      apiGetConnectorStatus(engagementId).then(setConnectorStatus).catch(console.error);
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [engagementId]);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv") && !f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      toast.error("Only CSV and Excel files are supported");
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await apiUploadFile(engagementId, file);
      toast.success(
        `Uploaded ${res.total_rows.toLocaleString()} rows — ${res.flagged_rows.toLocaleString()} flagged`,
        { duration: 6000 }
      );
      setFile(null);
      onUploaded();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleConnect = async (type: string) => {
    try {
      const res = await apiAuthorizeConnector(type, engagementId);
      window.location.href = res.authorization_url;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to connect ${type}`);
    }
  };

  const handleSync = async (type: string) => {
    setSyncing(type);
    try {
      const token = getToken();
      let url = `${API_BASE}/api/v1/connectors/${type}/sync/${engagementId}`;
      let body = undefined;
      let headers: any = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      if (type === "tally") {
        url = `${API_BASE}/api/v1/connectors/tally/live-sync/${engagementId}`;
        body = JSON.stringify({ tally_url: "http://host.docker.internal:9000" });
        headers["Content-Type"] = "application/json";
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(data.detail || "Sync failed to start");
      }
      
      if (data.total_rows !== undefined) {
        toast.success(`Synced ${data.total_rows} rows from ${type} (${data.flagged_rows} flagged)`);
      } else {
        toast.success(`${type} sync started successfully.`);
      }
      
      onUploaded();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setTimeout(() => setSyncing(null), 2000);
    }
  };

  return (
    <div className="p-6 space-y-10">
      {/* SECTION A — File Upload */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Upload a CSV or Excel export from your client's ERP system
          </p>
          <div className="flex items-center gap-2">
            <Select onValueChange={(val) => { if (val) window.open(`${API_BASE}/api/v1/templates/${val}/download`, "_blank"); }}>
              <SelectTrigger className="w-48 h-8 text-xs bg-white border-slate-200 text-slate-900">
                <SelectValue placeholder="Download Template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generic">Generic Template</SelectItem>
                <SelectItem value="sap">SAP GL Export</SelectItem>
                <SelectItem value="oracle">Oracle Financials</SelectItem>
                <SelectItem value="tally">Tally Prime</SelectItem>
                <SelectItem value="dynamics">Microsoft Dynamics 365</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 max-w-xl ${
            dragging
              ? "border-blue-300 bg-blue-50"
              : file
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-slate-200 hover:border-slate-600 bg-slate-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Cloud className={`w-10 h-10 mx-auto mb-3 ${file ? "text-emerald-400" : "text-slate-400"}`} />
          {file ? (
            <>
              <p className="text-sm font-medium text-emerald-300">{file.name}</p>
              <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600">Drop your file here, or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">CSV, XLSX, XLS supported</p>
            </>
          )}
        </div>

        {file && (
          <div className="flex gap-3 max-w-xl">
            <Button
              id="upload-submit"
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-slate-900 gap-2 shadow-lg glow-primary shadow-blue-500/20"
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading..." : "Upload & Analyze"}
            </Button>
            <Button variant="ghost" onClick={() => setFile(null)} className="text-slate-500 hover:text-slate-900">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3 space-y-1 max-w-xl">
          <p className="font-medium text-slate-500">Expected columns:</p>
          <p>date, doc_no, account_code, account_name, debit, credit, description, posted_by</p>
          <p className="text-slate-600">Column names are auto-detected — variations are supported.</p>
        </div>
      </div>

      {/* SECTION B — Live Connectors */}
      <div className="space-y-4 pt-8 border-t border-slate-200">
        <h3 className="text-base font-semibold text-slate-900">Live Connectors</h3>
        <p className="text-sm text-slate-500">Connect directly to your client's accounting software to pull transactions automatically.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* QuickBooks */}
          <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col items-center text-center hover:border-blue-200 hover:shadow-md transition-all">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4 border border-green-100">
              <span className="text-green-600 font-bold text-2xl">qb</span>
            </div>
            <h4 className="font-semibold text-slate-900 mb-2">QuickBooks Online</h4>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-sm text-slate-500">Status:</span>
              {connectorStatus.quickbooks ? (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Connected</span>
              ) : (
                <span className="text-sm text-slate-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300" /> Not Connected</span>
              )}
            </div>
            
            {connectorStatus.quickbooks ? (
              <div className="flex gap-3 w-full">
                <Button onClick={() => handleSync("quickbooks")} disabled={syncing === "quickbooks"} className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-sm">
                  {syncing === "quickbooks" ? "Syncing..." : "Sync Now"}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => handleConnect("quickbooks")} className="w-full text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-slate-200">
                Connect QuickBooks
              </Button>
            )}
          </div>

          {/* Xero */}
          <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col items-center text-center hover:border-blue-200 hover:shadow-md transition-all">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 border border-blue-100">
              <span className="text-blue-600 font-bold text-2xl">X</span>
            </div>
            <h4 className="font-semibold text-slate-900 mb-2">Xero</h4>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-sm text-slate-500">Status:</span>
              {connectorStatus.xero ? (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Connected</span>
              ) : (
                <span className="text-sm text-slate-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300" /> Not Connected</span>
              )}
            </div>
            
            {connectorStatus.xero ? (
              <div className="flex gap-3 w-full">
                <Button onClick={() => handleSync("xero")} disabled={syncing === "xero"} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                  {syncing === "xero" ? "Syncing..." : "Sync Now"}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => handleConnect("xero")} className="w-full text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-slate-200">
                Connect Xero
              </Button>
            )}
          </div>

          {/* Zoho Books */}
          <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col items-center text-center hover:border-blue-200 hover:shadow-md transition-all">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 border border-amber-100">
              <span className="text-amber-600 font-bold text-2xl">Z</span>
            </div>
            <h4 className="font-semibold text-slate-900 mb-2">Zoho Books</h4>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-sm text-slate-500">Status:</span>
              {connectorStatus.zoho ? (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Connected</span>
              ) : (
                <span className="text-sm text-slate-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300" /> Not Connected</span>
              )}
            </div>
            
            {connectorStatus.zoho ? (
              <div className="flex gap-3 w-full">
                <Button onClick={() => handleSync("zoho")} disabled={syncing === "zoho"} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white shadow-sm">
                  {syncing === "zoho" ? "Syncing..." : "Sync Now"}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => handleConnect("zoho")} className="w-full text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-slate-200">
                Connect Zoho Books
              </Button>
            )}
          </div>

          {/* Tally Prime */}
          <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col items-center text-center hover:border-blue-200 hover:shadow-md transition-all">
            <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center mb-4 border border-violet-100">
              <span className="text-violet-600 font-bold text-2xl">T</span>
            </div>
            <h4 className="font-semibold text-slate-900 mb-2">Tally Prime (Live)</h4>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-sm text-slate-500">Status:</span>
              {connectorStatus.tally ? (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Available</span>
              ) : (
                <span className="text-sm text-slate-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300" /> Offline</span>
              )}
            </div>
            
            {connectorStatus.tally ? (
              <div className="flex gap-3 w-full">
                <Button onClick={() => handleSync("tally")} disabled={syncing === "tally"} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
                  {syncing === "tally" ? "Syncing..." : "Live Sync"}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => handleSync("tally")} className="w-full text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-slate-200">
                Poll Tally (Port 9000)
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({ engagementId, onUploaded }: { engagementId: string; onUploaded?: () => void }) {
  const [data, setData] = useState<TransactionListResponse | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [isFlagged, setIsFlagged] = useState<boolean | undefined>(undefined);
  const [accountCode, setAccountCode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiListTransactions(engagementId, {
      page,
      page_size: 50,
      is_flagged: isFlagged,
      account_code: accountCode || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [engagementId, page, isFlagged, accountCode, dateFrom, dateTo]);

  useEffect(() => {
    Promise.resolve().then(() => {
      load();
    });
  }, [load]);

  const totalPages = data ? Math.ceil(data.total / 50) : 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Filter className="w-4 h-4" />
          Filters:
        </div>
        <button
          id="filter-flagged-toggle"
          onClick={() => { setIsFlagged(isFlagged === true ? undefined : true); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
            isFlagged === true
              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-600"
          }`}
        >
          {isFlagged === true ? "✓ " : ""}Flagged Only
        </button>
        <Input
          id="filter-account-code"
          placeholder="Account code..."
          value={accountCode}
          onChange={(e) => { setAccountCode(e.target.value); setPage(1); }}
          className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 h-8 text-xs w-36"
        />
        <Input
          id="filter-date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="bg-white border-slate-200 text-slate-900 h-8 text-xs w-36"
        />
        <span className="text-slate-600 text-xs">to</span>
        <Input
          id="filter-date-to"
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="bg-white border-slate-200 text-slate-900 h-8 text-xs w-36"
        />
        {(isFlagged !== undefined || accountCode || dateFrom || dateTo) && (
          <button
            onClick={() => { setIsFlagged(undefined); setAccountCode(""); setDateFrom(""); setDateTo(""); setPage(1); }}
            className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
        <div className="flex items-center gap-4 ml-auto">
          <span className="text-xs text-slate-400">
            {data ? `${data.total.toLocaleString()} transactions` : ""}
          </span>
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger render={<Button className="bg-blue-600 hover:bg-blue-700 text-slate-900 h-8 text-xs gap-1.5 shadow-lg glow-primary shadow-blue-500/20" />}>
              <Upload className="w-3 h-3" /> Upload Transactions
            </DialogTrigger>
            <DialogContent className="bg-white border-slate-200 sm:max-w-xl text-slate-900 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-slate-900">Upload Transactions</DialogTitle>
              </DialogHeader>
              <DataSourcesTab engagementId={engagementId} onUploaded={() => { setUploadOpen(false); load(); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {["Date", "Doc No", "Account", "Description", "Debit", "Credit", "Posted By", "Risk", "Flags"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">Loading...</td></tr>
              ) : !data || data.data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No transactions found</p>
                    <p className="text-slate-400 text-xs mt-1">Upload a file in the Upload tab to get started</p>
                  </td>
                </tr>
              ) : (
                data.data.map((txn: Transaction) => (
                  <tr
                    key={txn.id}
                    className={`border-b border-slate-200/50 transition-colors ${
                      txn.is_flagged ? "bg-rose-950/20 hover:bg-rose-950/30" : "hover:bg-white/30"
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{txn.transaction_date || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs font-mono whitespace-nowrap">{txn.document_number || "—"}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <div className="text-slate-600">{txn.account_code || "—"}</div>
                      <div className="text-slate-400 text-[10px]">{txn.account_name || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[160px] truncate">
                      {txn.description || <span className="text-slate-600 italic">No description</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-right whitespace-nowrap">
                      {txn.debit_amount && Number(txn.debit_amount) > 0 ? (
                        <span className="text-emerald-400 font-mono">{Number(txn.debit_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-right whitespace-nowrap">
                      {txn.credit_amount && Number(txn.credit_amount) > 0 ? (
                        <span className="text-blue-400 font-mono">{Number(txn.credit_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {txn.posted_by || <span className="text-slate-600 italic">Unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold whitespace-nowrap">
                      <span className={RISK_COLOR(txn.risk_score)}>{txn.risk_score}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 min-w-[180px]">
                        {txn.flag_reasons?.map((r) => (
                          <Badge key={r} variant="outline" className={`text-[9px] px-1.5 py-0 border ${FLAG_BADGE_COLORS[r] || "bg-slate-700 text-slate-600 border-slate-600"}`}>
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button id="prev-page" variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-slate-500 hover:text-slate-900 gap-1 h-8">
              <ChevronLeft className="w-3 h-3" /> Prev
            </Button>
            <Button id="next-page" variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="text-slate-500 hover:text-slate-900 gap-1 h-8">
              Next <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Copilot Tab ──────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "Summarize all high-risk transactions",
  "Which accounts have the most flagged entries?",
  "Show transactions posted on weekends",
  "What are the top 5 largest transactions?",
  "Are there any transactions missing descriptions?",
];

function CopilotTab({ engagementId }: { engagementId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/v1/copilot/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question, engagement_id: engagementId }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const aiResponseObj = { text: "" };

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunkText = decoder.decode(value, { stream: true });
        aiResponseObj.text = aiResponseObj.text + chunkText;
        const currentText = aiResponseObj.text;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: currentText };
          return updated;
        });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Copilot error");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full absolute inset-0">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-600/20">
              <Bot className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-center px-4">
              <h3 className="text-slate-900 font-semibold text-sm">Audit Copilot</h3>
              <p className="text-slate-500 text-xs mt-1">Ask questions about this engagement&apos;s transaction data</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-[90%]">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  id={`copilot-suggest-${q.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
                  onClick={() => sendMessage(q)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:border-blue-600/30 hover:text-blue-600 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-slate-900 rounded-br-sm"
                    : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-slate prose-sm max-w-none">
                    <ReactMarkdown>{msg.content || (loading && i === messages.length - 1 ? "▋" : "")}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}
        {loading && messages.length > 0 && messages[messages.length - 1].role === "user" && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex gap-2"
        >
          <Input
            id="copilot-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about transactions, risk, accounts..."
            disabled={loading}
            className="flex-1 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-300"
          />
          <Button
            id="copilot-send"
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-slate-900 px-4"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

function DocumentsTab({ engagementId }: { engagementId: string }) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDocs = useCallback(() => {
    apiListDocuments(engagementId).then(setDocs).catch(console.error).finally(() => setLoading(false));
  }, [engagementId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Poll every 5s if any doc is pending/processing
  useEffect(() => {
    const hasPending = docs.some((d) => d.extraction_status === "pending" || d.extraction_status === "processing");
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(loadDocs, 5000);
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [docs, loadDocs]);

  const handleFile = async (file: File) => {
    const allowed = ["pdf", "png", "jpg", "jpeg"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowed.includes(ext)) {
      toast.error("Only PDF, PNG, and JPG files are allowed");
      return;
    }
    setUploading(true);
    try {
      await apiUploadDocument(engagementId, file);
      toast.success("Document uploaded — extraction running in background");
      loadDocs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      processing: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      done: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      failed: "bg-red-500/20 text-red-300 border-red-500/30",
    };
    return map[status] || "bg-slate-700 text-slate-600 border-slate-600";
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Evidence Documents</h2>
        <p className="text-sm text-slate-500 mt-1">Upload invoices, bank statements, or contracts — AI extracts structured data automatically</p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          dragging ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:border-slate-600 bg-white/30"
        }`}
      >
        <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm text-slate-500">Uploading...</p>
          </div>
        ) : (
          <>
            <FileSearch className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-600 font-medium">Drop a document here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">PDF, PNG, JPG — AI will extract structured data automatically</p>
          </>
        )}
      </div>

      {/* Documents table */}
      {loading ? (
        <p className="text-slate-400 text-sm text-center py-8">Loading documents...</p>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FileSearch className="w-8 h-8 mx-auto mb-2 text-slate-700" />
          <p className="text-sm">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {["File Name", "Type", "Status", "Confidence", "Uploaded At"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <Fragment key={doc.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                    className="border-b border-slate-200/50 hover:bg-white/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-600 text-xs font-medium">{doc.file_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 capitalize">{doc.file_type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge(doc.extraction_status)}`}>
                        {doc.extraction_status === "processing" || doc.extraction_status === "pending" ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : null}
                        {doc.extraction_status === "done" ? "Done" :
                         doc.extraction_status === "failed" ? "Failed" :
                         doc.extraction_status === "processing" ? "Extracting..." : "Queued"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {doc.extraction_confidence != null ? `${Math.round(doc.extraction_confidence * 100)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                  {expandedId === doc.id && doc.extracted_data && (
                    <tr className="border-b border-slate-200">
                      <td colSpan={5} className="px-4 py-4 bg-white/40">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {Object.entries(doc.extracted_data)
                            .filter(([, v]) => v !== null && v !== undefined && !Array.isArray(v))
                            .map(([k, v]) => (
                              <div key={k} className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{k.replace(/_/g, " ")}</p>
                                <p className="text-sm text-slate-900 mt-1 font-medium truncate">{String(v)}</p>
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Findings Tab ─────────────────────────────────────────────────────────────

function FindingsTab({ engagementId }: { engagementId: string }) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [totalFindings, setTotalFindings] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    finding_type: "anomaly",
    severity: "medium",
    recommendation: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Jira sync state
  const [jiraConnected, setJiraConnected] = useState(false);
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [jiraSyncing, setJiraSyncing] = useState<string | null>(null);

  // Check if Jira is connected for this org
  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/api/v1/connectors/${engagementId}/status`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setJiraConnected(!!d.jira); })
      .catch(() => {});
  }, [engagementId]);

  const handlePushToJira = async (findingId: string) => {
    if (!jiraConnected) {
      toast.error("Connect Jira in Settings → Integrations first");
      return;
    }
    if (!jiraProjectKey.trim()) {
      toast.error("Enter a Jira project key (e.g. AUDIT)");
      return;
    }
    setJiraSyncing(findingId);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/v1/findings/${findingId}/sync-to-jira`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ project_key: jiraProjectKey.trim().toUpperCase() })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Sync failed" }));
        toast.error(err.detail || "Sync failed");
        return;
      }
      const data = await res.json();
      // Update the finding in local state with the new Jira fields
      setFindings(prev => prev.map(f => f.id === findingId
        ? { ...f, jira_issue_key: data.jira_issue_key, jira_issue_url: data.jira_issue_url }
        : f
      ));
      toast.success(`Pushed to Jira as ${data.jira_issue_key}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setJiraSyncing(null);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    const offset = (page - 1) * limit;
    apiListFindings(engagementId, limit, offset)
      .then((res) => {
        setFindings(res.items);
        setTotalFindings(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [engagementId, page]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      await apiCreateFinding(engagementId, form);
      toast.success("Finding created");
      setShowForm(false);
      setForm({ title: "", description: "", finding_type: "anomaly", severity: "medium", recommendation: "" });
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create finding");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (findingId: string, status: string) => {
    try {
      await apiUpdateFinding(engagementId, findingId, { status });
      setFindings((prev) => prev.map((f) => f.id === findingId ? { ...f, status } : f));
      toast.success("Status updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Audit Findings</h2>
          <p className="text-sm text-slate-500 mt-1">Track and manage exceptions identified during the audit</p>
        </div>
        <Button
          id="new-finding-btn"
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-slate-900 gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> New Finding
        </Button>
      </div>

      {/* New Finding Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">New Finding</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Title *</label>
              <Input
                id="finding-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Weekend vendor payment without approval"
                required
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Type</label>
              <select
                id="finding-type"
                value={form.finding_type}
                onChange={(e) => setForm({ ...form, finding_type: e.target.value })}
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-300"
              >
                <option value="anomaly">Anomaly</option>
                <option value="control_deficiency">Control Deficiency</option>
                <option value="compliance_gap">Compliance Gap</option>
                <option value="fraud_indicator">Fraud Indicator</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Severity *</label>
              <select
                id="finding-severity"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-300"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Description</label>
              <textarea
                id="finding-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Describe the finding in detail..."
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-300 resize-none placeholder:text-slate-600"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Recommendation</label>
              <textarea
                id="finding-recommendation"
                value={form.recommendation}
                onChange={(e) => setForm({ ...form, recommendation: e.target.value })}
                rows={2}
                placeholder="Recommended action to address this finding..."
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-300 resize-none placeholder:text-slate-600"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-slate-900 text-sm">
              {submitting ? "Creating..." : "Create Finding"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="text-slate-500 text-sm">
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Findings list */}
      {loading ? (
        <p className="text-slate-400 text-sm text-center py-8">Loading...</p>
      ) : findings.length === 0 ? (
        <div className="text-center py-12">
          <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-slate-700" />
          <p className="text-slate-500 text-sm">No findings yet</p>
          <p className="text-slate-400 text-xs mt-1">Click &quot;New Finding&quot; to log an audit exception</p>
        </div>
      ) : (
        <div className="space-y-2">
          {findings.map((f) => (
            <div key={f.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div
                onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900 truncate">{f.title}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${SEVERITY_COLORS[f.severity] || ""}`}>
                      {f.severity}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${STATUS_COLORS[f.status] || ""}`}>
                      {f.status?.replace("_", " ")}
                    </span>
                  </div>
                  {f.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{f.description}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {f.due_date && <span className="text-[10px] text-slate-400">{f.due_date}</span>}
                  {expandedId === f.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {expandedId === f.id && (
                <div className="border-t border-slate-200 px-4 py-4 space-y-3 bg-white/20">
                  {f.recommendation && (
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Recommendation</p>
                      <p className="text-xs text-slate-600">{f.recommendation}</p>
                    </div>
                  )}
                  {f.management_response && (
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Management Response</p>
                      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 mt-1">
                        <p className="text-xs text-slate-600 whitespace-pre-wrap">{f.management_response}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Update Status</p>
                    <div className="flex flex-wrap gap-2">
                      {["open", "in_progress", "resolved", "risk_accepted"].map((s) => {
                        const isProtected = s === "resolved" && (f.severity === "high" || f.severity === "critical");
                        const btn = (
                          <button
                            key={s}
                            id={`finding-status-${f.id}-${s}`}
                            onClick={() => handleStatusChange(f.id, s)}
                            className={`px-3 py-1 rounded-lg text-xs border transition-all ${
                              f.status === s
                                ? STATUS_COLORS[s]
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-500"
                            }`}
                          >
                            {s.replace("_", " ")}
                          </button>
                        );

                        if (isProtected) {
                          return (
                            <RoleGate 
                              key={s} 
                              minimumRole="senior_auditor" 
                              fallback={
                                <button disabled className="px-3 py-1 rounded-lg text-xs border bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed">
                                  resolved (Senior+)
                                </button>
                              }
                            >
                              {btn}
                            </RoleGate>
                          );
                        }
                        return btn;
                      })}
                    </div>
                  </div>

                  {/* Jira Sync */}
                  <div className="pt-2 border-t border-slate-100">
                    {(f as any).jira_issue_key ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">🔗 Synced:</span>
                        <span className="font-mono font-semibold text-blue-600">{(f as any).jira_issue_key}</span>
                        {(f as any).jira_issue_url && (
                          <a
                            href={(f as any).jira_issue_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline flex items-center gap-0.5"
                          >
                            View in Jira ↗
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-400">🔗 Not synced to Jira</span>
                        {jiraConnected ? (
                          <>
                            <input
                              type="text"
                              placeholder="Project key (e.g. AUDIT)"
                              value={jiraProjectKey}
                              onChange={e => setJiraProjectKey(e.target.value)}
                              className="border border-slate-200 rounded px-2 py-1 text-xs w-36 focus:outline-none focus:border-blue-300"
                            />
                            <button
                              id={`push-jira-${f.id}`}
                              onClick={() => handlePushToJira(f.id)}
                              disabled={jiraSyncing === f.id || !jiraProjectKey.trim()}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {jiraSyncing === f.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : null}
                              Push to Jira →
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            Connect Jira in Settings → Integrations to enable
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalFindings > limit && (
        <div className="flex items-center justify-between text-sm text-slate-500 mt-4">
          <span>Page {page} of {Math.ceil(totalFindings / limit)}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-slate-500 hover:text-slate-900 h-8">
              <ChevronLeft className="w-3 h-3" /> Prev
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(Math.ceil(totalFindings / limit), p + 1))} disabled={page === Math.ceil(totalFindings / limit)} className="text-slate-500 hover:text-slate-900 h-8">
              Next <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Workpapers Tab ───────────────────────────────────────────────────────────

function WorkpapersTab({ engagementId }: { engagementId: string }) {
  const { user } = useAuth();
  const [workpapers, setWorkpapers] = useState<Workpaper[]>([]);
  const [totalWorkpapers, setTotalWorkpapers] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState(AUDIT_AREAS[0]);
  const [generating, setGenerating] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const offset = (page - 1) * limit;
    apiListWorkpapers(engagementId, limit, offset)
      .then((res) => {
        setWorkpapers(res.items);
        setTotalWorkpapers(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [engagementId, page]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setStreamContent("");

    try {
      const token = getToken();
      const response = await streamWorkpaper(engagementId, selectedArea, token);

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Generation failed" }));
        throw new Error(err.detail || `HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreamContent(full);
      }

      toast.success("Workpaper generated and saved");
      load(); // Refresh saved workpapers list
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleAction = async (id: string, action: "submit" | "approve" | "reject") => {
    setActionLoading(`${action}-${id}`);
    try {
      if (action === "submit") {
        await apiSubmitWorkpaper(id);
        toast.success("Workpaper submitted for review");
      } else {
        await apiReviewWorkpaper(id, action);
        toast.success(`Workpaper ${action}d`);
      }
      load();
    } catch (e: any) {
      toast.error(e.message || `Failed to ${action} workpaper`);
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: "bg-slate-100 text-slate-600 border-slate-200",
      in_review: "bg-amber-100 text-amber-700 border-amber-200",
      approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
      rejected: "bg-rose-100 text-rose-700 border-rose-200",
    };
    return map[status] || "bg-slate-100 text-slate-600 border-slate-200";
  };

  const downloadAsWord = (content: string, area: string) => {
    // Basic Markdown to HTML converter with professional styling
    let htmlContent = content
      // Headers
      .replace(/^### (.*$)/gim, '<h3 style="color: #0f172a; font-family: Arial, sans-serif; font-size: 13pt; margin-top: 14pt; margin-bottom: 4pt;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="color: #0f172a; font-family: Arial, sans-serif; font-size: 15pt; margin-top: 16pt; margin-bottom: 6pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="color: #1e40af; font-family: Arial, sans-serif; font-size: 18pt; margin-bottom: 12pt;">$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Lists
      .replace(/^\s*-\s+(.*$)/gim, '<li style="margin-bottom: 4pt; font-family: Arial, sans-serif; font-size: 11pt; color: #334155;">$1</li>')
      // HR
      .replace(/^---$/gim, '<hr style="border: none; border-top: 1px solid #cbd5e1; margin: 16pt 0;">');

    // Wrap list items in <ul>
    htmlContent = htmlContent.replace(/(<li.*?>.*?<\/li>(?:\n|<br>)*)+/g, match => `<ul style="margin-top: 4pt; margin-bottom: 12pt; padding-left: 20pt;">${match}</ul>`);

    // Paragraphs for remaining text
    htmlContent = htmlContent
      .split('\n\n')
      .map(block => {
        if (block.trim().startsWith('<h') || block.trim().startsWith('<ul') || block.trim().startsWith('<hr')) {
          return block; // Keep block elements as is
        }
        return `<p style="margin-bottom: 10pt; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #334155;">${block.replace(/\n/g, '<br>')}</p>`;
      })
      .join('\n');
      
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Workpaper</title>
        <style>
          @page { margin: 1in; }
          body { font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>
        <div style="text-align: right; margin-bottom: 20pt; border-bottom: 2px solid #2563eb; padding-bottom: 10pt;">
          <strong style="color: #2563eb; font-size: 16pt; font-family: Arial, sans-serif;">AuditOS</strong><br>
          <span style="color: #64748b; font-size: 10pt; font-family: Arial, sans-serif;">Generated Workpaper Document</span>
        </div>
    `;
    const footer = `
        <div style="margin-top: 30pt; border-top: 1px solid #e2e8f0; padding-top: 10pt; text-align: center; color: #94a3b8; font-size: 9pt; font-family: Arial, sans-serif;">
          System Generated Document &bull; AuditOS AI Platform
        </div>
      </body>
      </html>
    `;
    const sourceHTML = header + htmlContent + footer;
    
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = url;
    fileDownload.download = `Workpaper_${area.replace(/\s+/g, '_')}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">AI Workpapers</h2>
        <p className="text-sm text-slate-500 mt-1">Generate formal audit workpapers using AI — based on your actual transaction data</p>
      </div>

      {/* Generator */}
      <div className="bg-white/30 border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="text-xs text-slate-500 block mb-1">Audit Area</label>
            <select
              id="workpaper-area-select"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              disabled={generating}
              className="w-full bg-white border border-slate-200 text-slate-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-300"
            >
              {AUDIT_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <Button
            id="generate-workpaper-btn"
            onClick={handleGenerate}
            disabled={generating}
            className="bg-blue-600 hover:bg-blue-700 text-slate-900 gap-2"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><ScrollText className="w-4 h-4" /> Generate Workpaper</>
            )}
          </Button>
        </div>

        {/* Streaming output */}
        {(generating || streamContent) && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 relative">
            {!generating && streamContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadAsWord(streamContent, selectedArea)}
                className="absolute top-4 right-4 text-slate-600 bg-white"
              >
                <Download className="w-4 h-4 mr-2" /> Download Word
              </Button>
            )}
            {generating && !streamContent && (
              <div className="flex items-center gap-3 text-slate-500 text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                AI is drafting your workpaper...
              </div>
            )}
            {streamContent && (
              <div className="prose prose-slate prose-sm max-w-none text-slate-600">
                <ReactMarkdown>{streamContent}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Saved workpapers */}
      {loading ? (
        <p className="text-slate-400 text-sm text-center py-4">Loading...</p>
      ) : workpapers.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-slate-500 mb-3">Previously Generated</h3>
          <div className="space-y-2">
            {workpapers.map((wp) => (
              <div key={wp.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div
                  onClick={() => setExpandedId(expandedId === wp.id ? null : wp.id)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/30 transition-colors"
                >
                  <ScrollText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-900">{wp.audit_area}</span>
                    <span className="text-xs text-slate-400 ml-2">{wp.created_at ? new Date(wp.created_at).toLocaleDateString() : ""}</span>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${statusBadge(wp.status)}`}>
                    {wp.status}
                  </span>
                  {expandedId === wp.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
                {expandedId === wp.id && wp.full_content && (
                  <div className="border-t border-slate-200 px-4 py-4 bg-white/20 relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadAsWord(wp.full_content || "", wp.audit_area)}
                      className="absolute top-4 right-4 text-slate-600 bg-white"
                    >
                      <Download className="w-4 h-4 mr-2" /> Download Word
                    </Button>
                    <div className="prose prose-slate prose-sm max-w-none text-slate-600">
                      <ReactMarkdown>{wp.full_content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {totalWorkpapers > limit && (
        <div className="flex items-center justify-between text-sm text-slate-500 mt-4">
          <span>Page {page} of {Math.ceil(totalWorkpapers / limit)}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-slate-500 hover:text-slate-900 h-8">
              <ChevronLeft className="w-3 h-3" /> Prev
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(Math.ceil(totalWorkpapers / limit), p + 1))} disabled={page === Math.ceil(totalWorkpapers / limit)} className="text-slate-500 hover:text-slate-900 h-8">
              Next <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Copilot FAB ──────────────────────────────────────────────────────────────

function CopilotFAB({ engagementId }: { engagementId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-8 w-[400px] h-[600px] max-h-[70vh] bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden z-50">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Audit Copilot</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-white relative">
            <CopilotTab engagementId={engagementId} />
          </div>
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-slate-900 rounded-full shadow-lg glow-primary transition-transform hover:scale-105 z-50 flex items-center justify-center"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EngagementDetailPage() {
  const params = useParams();
  const engagementId = params.id as string;
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [txRefresh, setTxRefresh] = useState(0);

  useEffect(() => {
    apiGetEngagement(engagementId).then(setEngagement).catch(console.error);
  }, [engagementId]);

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="border-b border-slate-200 bg-white px-8 py-4">
        <Link
          href="/engagements"
          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-2 w-fit transition-colors"
        >
          <ChevronLeft className="w-3 h-3" /> All engagements
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{engagement?.name || "Loading..."}</h1>
              {engagement?.client_name && <p className="text-sm text-slate-500">{engagement.client_name}</p>}
            </div>
            {engagement && (
              <Badge variant="outline" className="text-xs capitalize border-slate-200 text-slate-500">
                {engagement.status}
              </Badge>
            )}
          </div>
          <RoleGate minimumRole="senior_auditor">
            <Button
              variant="outline"
              className="border-blue-600/30 text-blue-600 hover:bg-blue-50 hover:text-blue-600"
              onClick={async () => {
                try {
                  const blob = await apiGenerateReport(engagementId);
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `AuditReport_${engagement?.name?.replace(/ /g, "_") || "Engagement"}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                  toast.success("Audit Report generated and downloaded");
                } catch (err: any) {
                  toast.error(err.message || "Failed to generate report");
                }
              }}
            >
              <FileText className="w-4 h-4 mr-2" />
              Generate Audit Report
            </Button>
          </RoleGate>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transactions" orientation="vertical" className="w-full px-8 pt-6 flex flex-col md:flex-row gap-6 md:gap-8 items-start mb-8">
        <TabsList className="bg-white border border-slate-200 w-full md:w-56 shrink-0 justify-start flex-col h-fit p-2 rounded-xl">
          <TabsTrigger id="tab-transactions" value="transactions" className="data-[state=active]:bg-blue-50 data-[state=active]:text-slate-900 text-slate-500 text-sm px-4 py-2.5 w-full justify-start rounded-lg transition-colors outline-none focus-visible:ring-0">
            <FileText className="w-4 h-4 mr-2" />Transactions
          </TabsTrigger>
          <TabsTrigger id="tab-upload" value="upload" className="data-[state=active]:bg-blue-50 data-[state=active]:text-slate-900 text-slate-500 text-sm px-4 py-2.5 w-full justify-start rounded-lg transition-colors mt-1 outline-none focus-visible:ring-0">
            <Cloud className="w-4 h-4 mr-2" />Data Sources
          </TabsTrigger>
          <TabsTrigger id="tab-fraud" value="fraud" className="data-[state=active]:bg-blue-50 data-[state=active]:text-slate-900 text-slate-500 text-sm px-4 py-2.5 w-full justify-start rounded-lg transition-colors mt-1 outline-none focus-visible:ring-0">
            <ShieldAlert className="w-4 h-4 mr-2" />Fraud Intelligence
          </TabsTrigger>
          <TabsTrigger id="tab-regulations" value="regulations" className="data-[state=active]:bg-blue-50 data-[state=active]:text-slate-900 text-slate-500 text-sm px-4 py-2.5 w-full justify-start rounded-lg transition-colors mt-1 outline-none focus-visible:ring-0">
            <ScrollText className="w-4 h-4 mr-2" />Regulations
          </TabsTrigger>
          <TabsTrigger id="tab-workpapers" value="workpapers" className="data-[state=active]:bg-blue-50 data-[state=active]:text-slate-900 text-slate-500 text-sm px-4 py-2.5 w-full justify-start rounded-lg transition-colors mt-1 outline-none focus-visible:ring-0">
            <ClipboardList className="w-4 h-4 mr-2" />Workpapers
          </TabsTrigger>
          <TabsTrigger id="tab-client" value="client" className="data-[state=active]:bg-blue-50 data-[state=active]:text-slate-900 text-slate-500 text-sm px-4 py-2.5 w-full justify-start rounded-lg transition-colors mt-1 outline-none focus-visible:ring-0">
            <Users className="w-4 h-4 mr-2" />Client Access
          </TabsTrigger>
          <TabsTrigger id="tab-documents" value="documents" className="data-[state=active]:bg-blue-50 data-[state=active]:text-slate-900 text-slate-500 text-sm px-4 py-2.5 w-full justify-start rounded-lg transition-colors mt-1 outline-none focus-visible:ring-0">
            <FileSearch className="w-4 h-4 mr-2" />Documents
          </TabsTrigger>
          <TabsTrigger id="tab-findings" value="findings" className="data-[state=active]:bg-blue-50 data-[state=active]:text-slate-900 text-slate-500 text-sm px-4 py-2.5 w-full justify-start rounded-lg transition-colors mt-1 outline-none focus-visible:ring-0">
            <AlertTriangle className="w-4 h-4 mr-2" />Findings
          </TabsTrigger>

        </TabsList>

        <div className="flex-1 min-w-0 w-full bg-white border border-slate-200 rounded-2xl shadow-xl">
          <TabsContent value="transactions" className="mt-0">
            <TransactionsTab key={txRefresh} engagementId={engagementId} onUploaded={() => setTxRefresh((n) => n + 1)} />
          </TabsContent>
          <TabsContent value="upload" className="mt-0 border-none p-0 outline-none">
            <DataSourcesTab engagementId={engagementId} onUploaded={() => {}} />
          </TabsContent>
          <TabsContent value="fraud" className="mt-0">
            <FraudTab engagementId={engagementId} />
          </TabsContent>
          <TabsContent value="regulations" className="mt-0">
            <RegulationsTab engagementId={engagementId} />
          </TabsContent>
          <TabsContent value="documents" className="mt-0">
            <DocumentsTab engagementId={engagementId} />
          </TabsContent>
          <TabsContent value="findings" className="mt-0">
            <FindingsTab engagementId={engagementId} />
          </TabsContent>
          <TabsContent value="workpapers" className="mt-0">
            <WorkpapersTab engagementId={engagementId} />
          </TabsContent>
          <TabsContent value="client" className="mt-0 outline-none">
            <RoleGate minimumRole="senior_auditor" fallback={<p className="text-slate-500 p-6">Client access management requires Senior Auditor.</p>}>
              <div className="p-6 bg-white rounded-xl border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-2">Client Portal Invite</h3>
                <p className="text-sm text-slate-500 mb-4">Share this link with your client so they can access the portal and respond to open findings.</p>
                <div className="flex items-center gap-2">
                   <Input value={`${window.location.origin}/portal/register?engagement=${engagementId}`} readOnly className="bg-slate-50 text-slate-600 font-mono text-sm" />
                   <Button onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/portal/register?engagement=${engagementId}`);
                      toast.success("Portal link copied to clipboard");
                   }} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                   </Button>
                </div>
              </div>
            </RoleGate>
          </TabsContent>
        </div>
      </Tabs>
      
      {/* Copilot FAB */}
      <CopilotFAB engagementId={engagementId} />
    </div>
  );
}

// ─── Fraud Intelligence Tab ───────────────────────────────────────────────────

function FraudTab({ engagementId }: { engagementId: string }) {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const offset = (page - 1) * limit;
    apiListFraudAlerts(engagementId, limit, offset)
      .then((res) => {
        setAlerts(res.items);
        setTotalAlerts(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [engagementId, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    try {
      await apiRunFraudAnalysis(engagementId);
      toast.success("Fraud analysis started in background");
      let elapsed = 0;
      const interval = setInterval(async () => {
        const newAlerts = await apiListFraudAlerts(engagementId, limit, 0);
        if (newAlerts.items.length > 0) {
          setAlerts(newAlerts.items);
          setTotalAlerts(newAlerts.total);
          setAnalyzing(false);
          clearInterval(interval);
        } else {
          elapsed += 5;
          if (elapsed >= 60) {
            setAnalyzing(false);
            clearInterval(interval);
            toast.info("Analysis taking longer than expected. Please check back later.");
          }
        }
      }, 5000);
    } catch (err: any) {
      toast.error(err.message || "Failed to start analysis");
      setAnalyzing(false);
    }
  };

  const handleStatusChange = async (alertId: string, status: string) => {
    try {
      await apiUpdateFraudAlert(engagementId, alertId, status);
      setAlerts(alerts.map((a) => (a.id === alertId ? { ...a, status : status as any } : a)));
      toast.success("Status updated");
    } catch (err: any) {
      toast.error("Failed to update status");
    }
  };

  if (loading) return <div className="p-6 text-slate-500">Loading alerts...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Fraud Intelligence</h2>
          <p className="text-sm text-slate-500">AI-powered detection of complex fraud patterns.</p>
        </div>
        <div>
          <RoleGate minimumRole="senior_auditor">
            <Button
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className="bg-blue-600 hover:bg-blue-700 text-slate-900"
            >
              {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
              {analyzing ? "Analyzing..." : "Run Analysis"}
            </Button>
          </RoleGate>
          <RoleGate exactRoles={["junior_auditor", "reviewer"]}>
            <p className="text-slate-400 text-sm">
              Fraud analysis requires Senior Auditor access.
            </p>
          </RoleGate>
        </div>
      </div>

      {alerts.length === 0 && !analyzing && (
        <div className="text-center p-12 bg-slate-50 rounded-xl border border-slate-200">
          <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">No fraud patterns detected yet.</p>
        </div>
      )}

      <div className="space-y-4">
        {alerts.map((alert) => (
          <div key={alert.id} className="p-5 bg-white border border-slate-200 rounded-xl space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <Badge variant="outline" className={SEVERITY_COLORS[alert.severity] || "border-slate-500 text-slate-500"}>
                    {alert.severity.toUpperCase()} RISK
                  </Badge>
                  <h3 className="font-medium text-slate-900">{alert.title}</h3>
                </div>
                <p className="text-sm text-slate-500">{alert.description}</p>
              </div>
              <Select value={alert.status} onValueChange={(val) => handleStatusChange(alert.id as string, val as string)}>
                <SelectTrigger className="w-32 h-8 text-xs bg-white border-slate-200 text-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="investigated">Investigated</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-slate-200/50">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Bot className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">AI Explanation</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{alert.ai_explanation}</p>
            </div>
          </div>
        ))}
      </div>

      {totalAlerts > limit && (
        <div className="flex items-center justify-between text-sm text-slate-500 mt-4">
          <span>Page {page} of {Math.ceil(totalAlerts / limit)}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-slate-500 hover:text-slate-900 h-8">
              <ChevronLeft className="w-3 h-3" /> Prev
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(Math.ceil(totalAlerts / limit), p + 1))} disabled={page === Math.ceil(totalAlerts / limit)} className="text-slate-500 hover:text-slate-900 h-8">
              Next <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Regulations Tab ──────────────────────────────────────────────────────────

function RegulationsTab({ engagementId }: { engagementId: string }) {
  const [regulations, setRegulations] = useState<RegulationItem[]>([]);
  const [selectedReg, setSelectedReg] = useState<string>("");
  const [analysis, setAnalysis] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    apiListRegulations().then(setRegulations).catch(console.error);
  }, []);

  const handleRunAnalysis = async () => {
    if (!selectedReg) return;
    setAnalyzing(true);
    setAnalysis("");
    
    try {
      const token = getToken();
      const res = await streamGapAnalysis(engagementId, selectedReg, token);
      if (!res.ok) throw new Error("Failed to start analysis");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnalysis((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to run gap analysis");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Regulatory Intelligence</h2>
        <p className="text-sm text-slate-500">Stream an AI-powered gap analysis against standard compliance frameworks.</p>
      </div>

      <div className="flex gap-4 items-end">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium text-slate-500">Select Framework</label>
          <Select value={selectedReg} onValueChange={(v) => setSelectedReg(v || "")}>
            <SelectTrigger className="bg-white border-slate-200 text-slate-900">
              <SelectValue placeholder="Choose a regulation..." />
            </SelectTrigger>
            <SelectContent>
              {regulations.map((reg) => (
                <SelectItem key={reg.id} value={reg.code}>
                  {reg.code} — {reg.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleRunAnalysis}
          disabled={!selectedReg || analyzing}
          className="bg-blue-600 hover:bg-blue-700 text-slate-900"
        >
          {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ScrollText className="w-4 h-4 mr-2" />}
          {analyzing ? "Analyzing..." : "Run Gap Analysis"}
        </Button>
      </div>

      {analysis && (
        <div className="p-6 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2 text-blue-600 mb-4 pb-4 border-b border-slate-200">
            <Bot className="w-5 h-5" />
            <span className="font-semibold">Compliance Gap Analysis</span>
          </div>
          <div className="prose prose-slate max-w-none text-sm text-slate-600">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ node, ...props }) => {
                  const text = String(props.children);
                  let className = "";
                  if (text.includes("PRESENT")) className = "border-l-2 border-green-500 pl-2 block";
                  if (text.includes("MISSING")) className = "border-l-2 border-red-500 pl-2 block";
                  if (text.includes("PARTIAL")) className = "border-l-2 border-amber-500 pl-2 block";
                  return <p className={className} {...props} />;
                },
                li: ({ node, ...props }) => {
                  const text = String(props.children);
                  let className = "";
                  if (text.includes("PRESENT")) className = "border-l-2 border-green-500 pl-2 block";
                  if (text.includes("MISSING")) className = "border-l-2 border-red-500 pl-2 block";
                  if (text.includes("PARTIAL")) className = "border-l-2 border-amber-500 pl-2 block";
                  return <li className={className} {...props} />;
                }
              }}
            >
              {analysis}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
