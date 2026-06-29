import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/useToast";

export function AddControlModal({ isOpen, onClose, onAdded }: any) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    process_name: "",
    risk_description: "",
    control_activity: "",
    frequency: "Annual",
  });

  const handleSubmit = async () => {
    if (!formData.process_name || !formData.risk_description || !formData.control_activity) {
      toast.error("Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/v1/internal-controls", {
        method: "POST",
        body: JSON.stringify(formData)
      });
      toast.success("Control added successfully");
      onAdded();
      onClose();
    } catch (e) {
      toast.error("Failed to add control");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Internal Control</DialogTitle>
          <DialogDescription>Define a risk and its mitigating control activity.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Process / Sub-process</Label>
            <Input 
              placeholder="e.g. Procure to Pay" 
              value={formData.process_name}
              onChange={(e) => setFormData({...formData, process_name: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label>Risk Description</Label>
            <Textarea 
              placeholder="What could go wrong?"
              value={formData.risk_description}
              onChange={(e) => setFormData({...formData, risk_description: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label>Control Activity</Label>
            <Textarea 
              placeholder="How is the risk mitigated?"
              value={formData.control_activity}
              onChange={(e) => setFormData({...formData, control_activity: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label>Frequency</Label>
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring"
              value={formData.frequency}
              onChange={(e) => setFormData({...formData, frequency: e.target.value})}
            >
              <option value="Annual">Annual</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Monthly">Monthly</option>
              <option value="Daily">Daily</option>
              <option value="Transactional">Transactional</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {loading ? "Adding..." : "Add Control"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
