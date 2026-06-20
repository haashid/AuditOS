"use client";
import ModuleEngagementSelector from "@/components/modules/ModuleEngagementSelector";
import { Settings2 } from "lucide-react";

export default function OperationalAuditPage() {
  return (
    <ModuleEngagementSelector
      config={{
        title: "Operational Audit Workspace",
        description: "Process risk assessment, KPI variance analysis, and AI-powered operational health commentary. Select an engagement to map risks, track KPIs, and generate a management report.",
        gradient: "bg-gradient-to-r from-orange-900 to-amber-800",
        iconBg: "bg-white/10",
        badgeColor: "bg-orange-100 text-orange-800",
        buttonColor: "bg-orange-600 hover:bg-orange-700",
        hoverBg: "hover:border-orange-200",
        icon: <Settings2 className="w-6 h-6 text-orange-100" />,
        basePath: "/operational",
      }}
    />
  );
}
