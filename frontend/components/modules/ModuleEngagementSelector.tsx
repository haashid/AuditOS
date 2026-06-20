"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiListEngagements, Engagement } from "@/lib/api";

interface ModuleConfig {
  title: string;
  description: string;
  gradient: string;
  iconBg: string;
  badgeColor: string;
  buttonColor: string;
  hoverBg: string;
  icon: React.ReactNode;
  basePath: string;
  auditType: string;
}

export default function ModuleEngagementSelector({ config }: { config: ModuleConfig }) {
  const router = useRouter();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiListEngagements()
      .then((data) => setEngagements(data.filter((e) => e.audit_type === config.auditType)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${config.gradient} p-8 rounded-2xl shadow-lg text-white`}>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 ${config.iconBg} rounded-lg backdrop-blur-sm`}>
              {config.icon}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{config.title}</h1>
          </div>
          <p className="text-white/80 max-w-xl text-sm leading-relaxed">{config.description}</p>
        </div>
        <button
          onClick={() => router.push("/engagements")}
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all self-start md:self-auto"
        >
          View All Engagements
        </button>
      </div>

      {/* Engagement Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Select an Engagement</h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-36 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : engagements.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
            <p className="text-slate-500 mb-4">No engagements found.</p>
            <button
              onClick={() => router.push("/engagements")}
              className={`${config.buttonColor} text-white px-4 py-2 rounded-lg text-sm font-medium`}
            >
              Create Engagement
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {engagements.map((eng) => (
              <div
                key={eng.id}
                onClick={() => router.push(`${config.basePath}/${eng.id}`)}
                className={`group cursor-pointer bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300 hover:-translate-y-1 ${config.hoverBg}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${
                    eng.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                    eng.status === 'completed' ? 'bg-blue-50 text-blue-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {eng.status}
                  </span>
                  <span className="text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                <h3 className="font-semibold text-slate-900 truncate mb-1">{eng.name}</h3>
                <p className="text-sm text-slate-500 truncate">{eng.client_name || "No client"}</p>
                {eng.fiscal_year_start && (
                  <p className="text-xs text-slate-400 mt-2">FY: {eng.fiscal_year_start.substring(0, 4)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
