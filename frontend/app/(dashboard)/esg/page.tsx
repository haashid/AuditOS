"use client";
import ModuleEngagementSelector from "@/components/modules/ModuleEngagementSelector";
import { Leaf } from "lucide-react";

export default function ESGAuditPage() {
  return (
    <ModuleEngagementSelector
      config={{
        title: "ESG Audit Workspace",
        description: "Carbon emission calculations (Scope 1/2/3), BRSR compliance analysis (SEBI mandate), GRI and TCFD mapping. Select an engagement to track your ESG data and generate an assurance report.",
        gradient: "bg-gradient-to-r from-emerald-900 to-teal-800",
        iconBg: "bg-white/10",
        badgeColor: "bg-emerald-100 text-emerald-800",
        buttonColor: "bg-emerald-600 hover:bg-emerald-700",
        hoverBg: "hover:border-emerald-200",
        icon: <Leaf className="w-6 h-6 text-emerald-100" />,
        basePath: "/esg",
        auditType: "esg",
      }}
    />
  );
}

