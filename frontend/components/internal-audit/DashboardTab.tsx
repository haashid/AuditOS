import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export function DashboardTab({ controls }: any) {
  
  // Calculate distribution of testing status
  let effective = 0;
  let ineffective = 0;
  let notTested = 0;

  controls.forEach((c: any) => {
    if (c.tests && c.tests.length > 0) {
      if (c.tests[0].effectiveness === "Effective") effective++;
      else if (c.tests[0].effectiveness === "Ineffective") ineffective++;
    } else {
      notTested++;
    }
  });

  const pieData = [
    { name: "Effective", value: effective, color: "#10b981" },
    { name: "Ineffective", value: ineffective, color: "#ef4444" },
    { name: "Not Tested", value: notTested, color: "#cbd5e1" },
  ].filter(d => d.value > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="bg-white border-slate-200">
        <CardHeader>
          <CardTitle className="text-base text-slate-900">Control Effectiveness Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200">
        <CardHeader>
          <CardTitle className="text-base text-slate-900">Open Deficiencies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {controls.filter((c: any) => c.tests && c.tests.length > 0 && c.tests[0].effectiveness === "Ineffective").length === 0 ? (
              <p className="text-sm text-slate-500">No open deficiencies detected.</p>
            ) : (
              controls
                .filter((c: any) => c.tests && c.tests.length > 0 && c.tests[0].effectiveness === "Ineffective")
                .map((c: any) => (
                  <div key={c.id} className="p-3 border border-red-100 bg-red-50 rounded-lg">
                    <p className="text-sm font-semibold text-red-800">{c.process_name}</p>
                    <p className="text-xs text-red-600 mt-1">{c.control_activity}</p>
                    <p className="text-xs text-slate-500 mt-2">Tested on {new Date(c.tests[0].test_date).toLocaleDateString()}</p>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
