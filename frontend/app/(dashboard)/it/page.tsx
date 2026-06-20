"use client";
import ModuleEngagementSelector from "@/components/modules/ModuleEngagementSelector";
import { Monitor } from "lucide-react";

export default function ITAuditPage() {
  return (
    <ModuleEngagementSelector
      config={{
        title: "IT Audit Workspace",
        description: "AI-powered IT General Controls (ITGC) testing. Select an engagement to review user access, change management, backup controls, and segregation of duties.",
        gradient: "bg-gradient-to-r from-cyan-900 to-sky-800",
        iconBg: "bg-white/10",
        badgeColor: "bg-cyan-100 text-cyan-800",
        buttonColor: "bg-cyan-600 hover:bg-cyan-700",
        hoverBg: "hover:border-cyan-200",
        icon: <Monitor className="w-6 h-6 text-cyan-100" />,
        basePath: "/it",
        auditType: "it",
      }}
    />
  );
}

