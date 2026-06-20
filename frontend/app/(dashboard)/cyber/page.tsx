"use client";
import ModuleEngagementSelector from "@/components/modules/ModuleEngagementSelector";
import { Shield } from "lucide-react";

export default function CyberAuditPage() {
  return (
    <ModuleEngagementSelector
      config={{
        title: "Cybersecurity Audit Workspace",
        description: "AI-powered vulnerability assessment and NIST CSF analysis. Select an engagement to ingest Nessus/OpenVAS scans, map controls to ISO 27001, and generate assurance reports.",
        gradient: "bg-gradient-to-r from-red-900 to-rose-800",
        iconBg: "bg-white/10",
        badgeColor: "bg-red-100 text-red-800",
        buttonColor: "bg-red-600 hover:bg-red-700",
        hoverBg: "hover:border-red-200",
        icon: <Shield className="w-6 h-6 text-red-100" />,
        basePath: "/cyber",
        auditType: "cyber",
      }}
    />
  );
}
