const ROLE_CONFIG = {
  partner: {
    label: "Partner",
    className: "bg-purple-500/20 text-purple-300 border border-purple-500/30"
  },
  senior_auditor: {
    label: "Senior Auditor",
    className: "bg-blue-500/20 text-blue-300 border border-blue-500/30"
  },
  junior_auditor: {
    label: "Junior Auditor",
    className: "bg-green-500/20 text-green-300 border border-green-500/30"
  },
  reviewer: {
    label: "Reviewer",
    className: "bg-amber-500/20 text-amber-300 border border-amber-500/30"
  },
  portal_user: {
    label: "Client Portal",
    className: "bg-gray-500/20 text-gray-300 border border-gray-500/30"
  }
};

export function RoleBadge({ role }: { role: string }) {
  const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG];
  if (!config) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
