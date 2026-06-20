import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/useToast";

export function TestControlModal({ control, isOpen, onClose, onTested }: any) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    effectiveness: "Effective",
    evidence_url: "",
    notes: ""
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await apiFetch(`/api/v1/internal-controls/${control.id}/tests`, {
        method: "POST",
        body: JSON.stringify(formData)
      });
      toast.success("Test submitted");
      onTested();
      onClose();
    } catch (e) {
      toast.error("Failed to submit test");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Test Control: {control.process_name}</DialogTitle>
          <DialogDescription>Submit your independent test result for this control.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
            <p className="text-sm font-semibold text-slate-800">Control Activity:</p>
            <p className="text-sm text-slate-600 mt-1">{control.control_activity}</p>
          </div>

          <div className="space-y-2">
            <Label>Effectiveness</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input 
                  type="radio" 
                  name="effectiveness" 
                  value="Effective" 
                  checked={formData.effectiveness === "Effective"}
                  onChange={(e) => setFormData({...formData, effectiveness: e.target.value})}
                  className="w-4 h-4 text-indigo-600"
                />
                <span className="text-sm">Effective</span>
              </label>
              <label className="flex items-center gap-2">
                <input 
                  type="radio" 
                  name="effectiveness" 
                  value="Ineffective" 
                  checked={formData.effectiveness === "Ineffective"}
                  onChange={(e) => setFormData({...formData, effectiveness: e.target.value})}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-red-600 font-medium">Ineffective</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Evidence Link / Workpaper ID</Label>
            <Input 
              placeholder="https://..."
              value={formData.evidence_url}
              onChange={(e) => setFormData({...formData, evidence_url: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label>Testing Notes</Label>
            <Textarea 
              placeholder="Describe the sample selection and testing methodology..."
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {loading ? "Submitting..." : "Submit Test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
