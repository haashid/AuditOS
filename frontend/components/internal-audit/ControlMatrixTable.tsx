import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Beaker, Trash2 } from "lucide-react";
import { AddControlModal } from "./AddControlModal";
import { TestControlModal } from "./TestControlModal";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/useToast";

export function ControlMatrixTable({ controls, refreshControls, loading }: any) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [testingControl, setTestingControl] = useState<any>(null);

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/v1/internal-controls/${id}`, { method: "DELETE" });
      toast.success("Control deleted");
      refreshControls();
    } catch (e) {
      toast.error("Failed to delete control");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Risk Control Matrix (RCM)</h2>
        <Button onClick={() => setIsAddOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Control
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Process</TableHead>
              <TableHead className="w-1/3">Risk & Control Activity</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Latest Test</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">Loading controls...</TableCell>
              </TableRow>
            ) : controls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">No controls found. Add one to get started.</TableCell>
              </TableRow>
            ) : (
              controls.map((control: any) => {
                const latestTest = control.tests && control.tests.length > 0 ? control.tests[0] : null;
                return (
                  <TableRow key={control.id}>
                    <TableCell className="font-medium text-slate-900">{control.process_name}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-red-600">Risk: {control.risk_description}</p>
                        <p className="text-sm text-slate-600">{control.control_activity}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="bg-slate-50">{control.frequency}</Badge></TableCell>
                    <TableCell>
                      {latestTest ? (
                        <Badge 
                          className={latestTest.effectiveness === "Effective" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
                        >
                          {latestTest.effectiveness}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">Not Tested</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-indigo-50 text-indigo-700">{control.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setTestingControl(control)}>
                          <Beaker className="w-4 h-4 mr-1" />
                          Test
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(control.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AddControlModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onAdded={refreshControls} />
      {testingControl && (
        <TestControlModal control={testingControl} isOpen={true} onClose={() => setTestingControl(null)} onTested={refreshControls} />
      )}
    </div>
  );
}
