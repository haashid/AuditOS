"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/useToast";
import { apiListEngagements, apiCreateEngagement, apiDeleteEngagement, Engagement } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardList, ChevronRight, Calendar, Trash2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-amber-100 text-amber-800 border-amber-200",
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
};

function EngagementRow({
  engagement,
  onClick,
  onDelete,
}: {
  engagement: Engagement;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 px-4 py-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors group"
    >
      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
        <ClipboardList className="w-5 h-5 text-blue-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors">{engagement.name}</p>
        <p className="text-xs text-slate-500 truncate">{engagement.client_name || "—"}</p>
      </div>

      <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
        <Calendar className="w-3.5 h-3.5" />
        {engagement.fiscal_year_start
          ? `${engagement.fiscal_year_start} — ${engagement.fiscal_year_end || "?"}`
          : "No fiscal year set"}
      </div>

      <Badge
        className={`text-xs capitalize border ${STATUS_COLORS[engagement.status] || "bg-slate-100 text-slate-800 border-slate-200"}`}
        variant="secondary"
      >
        {engagement.status}
      </Badge>

      <div className="text-xs text-slate-400 hidden md:block w-24 text-right">
        {new Date(engagement.created_at).toLocaleDateString()}
      </div>

      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
      
      <button 
        onClick={onDelete}
        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ml-2 flex-shrink-0"
        title="Delete Engagement"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function EngagementsPage() {
  const router = useRouter();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    client_name: "",
    audit_type: "financial",
    fiscal_year_start: "",
    fiscal_year_end: "",
  });

  const load = () => {
    apiListEngagements()
      .then(setEngagements)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const update = (key: string, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this engagement? This action cannot be undone.")) return;
    try {
      await apiDeleteEngagement(id);
      toast.success("Engagement deleted successfully");
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete engagement");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiCreateEngagement({
        name: form.name,
        client_name: form.client_name || undefined,
        audit_type: form.audit_type,
        fiscal_year_start: form.fiscal_year_start || undefined,
        fiscal_year_end: form.fiscal_year_end || undefined,
      });
      toast.success("Engagement created successfully");
      setDialogOpen(false);
      setForm({ name: "", client_name: "", audit_type: "financial", fiscal_year_start: "", fiscal_year_end: "" });
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create engagement");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl space-y-6 mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Engagements</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {engagements.length} audit engagement{engagements.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          id="new-engagement-btn"
          onClick={() => setDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Engagement
        </Button>
      </div>

      {/* Engagements Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="w-10 flex-shrink-0" />
          <div className="flex-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Engagement
          </div>
          <div className="hidden sm:block text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">
            Fiscal Year
          </div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">
            Status
          </div>
          <div className="hidden md:block text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 text-right">
            Created
          </div>
          <div className="w-4 flex-shrink-0" />
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 text-sm">Loading engagements...</p>
          </div>
        ) : engagements.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-900 font-semibold mb-1">No engagements yet</p>
            <p className="text-slate-500 text-sm">
              Create your first audit engagement to get started
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {engagements.map((eng) => (
              <EngagementRow
                key={eng.id}
                engagement={eng}
                onClick={() => router.push(`/engagements/${eng.id}`)}
                onDelete={(e) => handleDelete(e, eng.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Engagement Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-md shadow-xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900">New Audit Engagement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm font-medium">Engagement Name *</Label>
              <Input
                id="engagement-name"
                placeholder="Acme Corp FY2024 Annual Audit"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm font-medium">Client Name</Label>
              <Input
                id="client-name"
                placeholder="Acme Corp"
                value={form.client_name}
                onChange={(e) => update("client_name", e.target.value)}
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm font-medium">Audit Type</Label>
              <Select
                value={form.audit_type}
                onValueChange={(val: string | null) => val && update("audit_type", val)}
              >
                <SelectTrigger
                  id="audit-type"
                  className="bg-white border-slate-200 text-slate-900 focus:ring-blue-500"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  <SelectItem value="financial">Financial Audit</SelectItem>
                  <SelectItem value="internal">Internal Audit</SelectItem>
                  <SelectItem value="tax">Tax Audit</SelectItem>
                  <SelectItem value="it">IT Audit</SelectItem>
                  <SelectItem value="cyber">Cybersecurity Audit</SelectItem>
                  <SelectItem value="esg">ESG Audit</SelectItem>
                  <SelectItem value="operational">Operational Audit</SelectItem>
                  <SelectItem value="supply_chain">Supply Chain Audit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm font-medium">FY Start</Label>
                <Input
                  id="fy-start"
                  type="date"
                  value={form.fiscal_year_start}
                  onChange={(e) => update("fiscal_year_start", e.target.value)}
                  className="bg-white border-slate-200 text-slate-900 focus-visible:ring-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm font-medium">FY End</Label>
                <Input
                  id="fy-end"
                  type="date"
                  value={form.fiscal_year_end}
                  onChange={(e) => update("fiscal_year_end", e.target.value)}
                  className="bg-white border-slate-200 text-slate-900 focus-visible:ring-blue-500"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 mt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                id="create-engagement-submit"
                type="submit"
                disabled={creating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {creating ? "Creating..." : "Create Engagement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
