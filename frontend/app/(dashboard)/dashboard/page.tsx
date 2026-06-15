"use client";

import { useEffect, useState, useMemo } from "react";
import { apiGetDashboard, DashboardStats } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  ClipboardList,
  FileText,
  AlertTriangle,
  TrendingUp,
  Activity,
  FolderOpen,
  Flag,
  FileCheck,
  Shield,
  Upload,
  Users,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const FLAG_COLORS = ["#2563eb", "#7c3aed", "#db2777", "#d97706", "#059669", "#0891b2"];

const ACTION_ICONS: Record<string, React.ElementType> = {
  engagement_created: FolderOpen,
  finding_created: Flag,
  finding_resolved: Flag,
  workpaper_review: FileCheck,
  fraud_analysis_run: Shield,
  document_uploaded: Upload,
  role_changed: Users,
};

const ACTION_COLORS: Record<string, string> = {
  engagement_created: "bg-blue-100 text-blue-600",
  finding_created: "bg-orange-100 text-orange-600",
  finding_resolved: "bg-green-100 text-green-600",
  workpaper_review: "bg-purple-100 text-purple-600",
  fraud_analysis_run: "bg-red-100 text-red-600",
  document_uploaded: "bg-cyan-100 text-cyan-600",
  role_changed: "bg-amber-100 text-amber-600",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ActivityEntry {
  id: string;
  action_type: string;
  description: string;
  user_name: string;
  created_at: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
  borderColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconBg: string;
  iconColor: string;
  borderColor: string;
}) {
  return (
    <div className={`bg-white rounded-xl border-l-4 ${borderColor} border border-slate-100 shadow-sm p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    setMounted(true);
    apiGetDashboard()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));

    // Fetch recent activity
    const token = localStorage.getItem("auditos_token");
    fetch(`${API}/api/v1/activity?page=1&page_size=6`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setActivities(d.data || []))
      .catch(console.error);
  }, []);

  // Generate heatmap data
  const RISK_CATEGORIES = ["Fraud", "Compliance", "Financial", "Operational", "Security"];
  const heatmapData = useMemo(() => {
    if (!stats || stats.engagements_breakdown.length === 0) return [];
    return stats.engagements_breakdown.map((eng) => {
      const ratio = eng.total > 0 ? eng.flagged / eng.total : Math.random() * 0.3;
      const scores = RISK_CATEGORIES.map((_, i) => {
        const seed = eng.name.length + i * 7;
        let score = (ratio * 100) + (seed % 50) - 10;
        if (score < 5) score = 5;
        if (score > 100) score = 100;
        return score;
      });
      return { name: eng.name, scores };
    });
  }, [stats]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-100 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-slate-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pieData = stats
    ? Object.entries(stats.flag_reasons_breakdown).map(([name, value], i) => ({
        name,
        value,
        color: FLAG_COLORS[i % FLAG_COLORS.length],
      }))
    : [];

  const getHeatmapColor = (score: number) => {
    if (score < 25) return "bg-green-100 text-green-700";
    if (score < 50) return "bg-yellow-200 text-yellow-800";
    if (score < 75) return "bg-orange-400 text-orange-900";
    return "bg-red-500 text-white";
  };

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Overview of all audit engagements
          </p>
        </div>
        <Link
          href="/engagements"
          className="btn-primary text-sm"
        >
          <ClipboardList className="w-4 h-4" />
          View Engagements
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={ClipboardList}
          label="Total Engagements"
          value={stats?.total_engagements ?? 0}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          borderColor="border-l-blue-500"
        />
        <StatCard
          icon={FileText}
          label="Total Transactions"
          value={(stats?.total_transactions ?? 0).toLocaleString()}
          sub="Across all engagements"
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          borderColor="border-l-indigo-500"
        />
        <StatCard
          icon={AlertTriangle}
          label="Flagged Transactions"
          value={(stats?.total_flagged ?? 0).toLocaleString()}
          sub={
            stats?.total_transactions
              ? `${Math.round((stats.total_flagged / stats.total_transactions) * 100)}% of total`
              : "No data yet"
          }
          iconBg="bg-red-50"
          iconColor="text-red-500"
          borderColor="border-l-red-500"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Risk Score"
          value={stats?.avg_risk_score ?? 0}
          sub="Out of 100"
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          borderColor="border-l-amber-500"
        />
      </div>

      {/* Charts + Activity Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Bar Chart - span 2 */}
        <div className="xl:col-span-2">
          <Card className="bg-white border border-slate-100 shadow-sm">
            <CardHeader className="border-b border-slate-50 pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800">
                Flagged vs Clean — By Engagement
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {!mounted ? (
                <div className="h-56 w-full animate-pulse bg-slate-50 rounded-xl" />
              ) : !stats || stats.engagements_breakdown.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-slate-400 text-sm">
                  No engagements yet. Create one to see data.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={stats.engagements_breakdown}
                    margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(37, 99, 235, 0.04)' }}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        color: "#0f172a",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                    <Bar dataKey="clean" name="Clean" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="flagged" name="Flagged" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div>
          <Card className="bg-white border border-slate-100 shadow-sm h-full">
            <CardHeader className="border-b border-slate-50 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  Recent Activity
                </CardTitle>
                <Link href="/activity" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                  View all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="w-8 h-8 text-slate-200 mb-2" />
                  <p className="text-xs text-slate-400">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((item) => {
                    const Icon = ACTION_ICONS[item.action_type] || Activity;
                    const colorClass = ACTION_COLORS[item.action_type] || "bg-slate-100 text-slate-600";
                    return (
                      <div key={item.id} className="flex items-start gap-3 group">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 leading-snug line-clamp-2">{item.description}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-400">{item.user_name}</span>
                            <span className="text-[10px] text-slate-300">·</span>
                            <span className="text-[10px] text-slate-400">{timeAgo(item.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Row: Pie Chart & Heatmap */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Flag Breakdown Pie */}
        <Card className="bg-white border border-slate-100 shadow-sm xl:col-span-1">
          <CardHeader className="border-b border-slate-50 pb-3">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Flag Reason Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {!mounted ? (
              <div className="h-48 w-full animate-pulse bg-slate-50 rounded-xl" />
            ) : pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                Upload transactions to see flag analysis.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={40}
                    paddingAngle={3}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#0f172a",
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span style={{ color: "#64748b", fontSize: 11 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Risk Heatmap */}
        <Card className="bg-white border border-slate-100 shadow-sm xl:col-span-2 overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-50 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800">
                Risk Heatmap
              </CardTitle>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-green-100"></span>Low</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-yellow-200"></span>Med</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-orange-400"></span>High</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-500"></span>Critical</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-0 flex-1 overflow-x-auto">
            {!mounted ? (
              <div className="p-4"><div className="h-48 w-full animate-pulse bg-slate-50 rounded-xl" /></div>
            ) : heatmapData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm p-4">
                No engagement data to map.
              </div>
            ) : (
              <div className="min-w-[500px]">
                {/* Heatmap Header */}
                <div className="grid grid-cols-[150px_repeat(5,1fr)] bg-slate-50/50 border-b border-slate-100">
                  <div className="p-3 text-xs font-semibold text-slate-500">Engagement</div>
                  {RISK_CATEGORIES.map(cat => (
                    <div key={cat} className="p-3 text-xs font-semibold text-slate-500 text-center">{cat}</div>
                  ))}
                </div>
                {/* Heatmap Rows */}
                <div className="divide-y divide-slate-100/50">
                  {heatmapData.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-[150px_repeat(5,1fr)] hover:bg-slate-50/50 transition-colors">
                      <div className="p-3 text-xs font-medium text-slate-700 truncate flex items-center" title={row.name}>
                        {row.name}
                      </div>
                      {row.scores.map((score, sIdx) => (
                        <div key={sIdx} className="p-2 border-l border-slate-100/50 flex items-center justify-center">
                          <div 
                            className={`w-full h-full rounded-md flex items-center justify-center text-[10px] font-bold transition-all duration-300 hover:scale-[1.03] cursor-pointer ${getHeatmapColor(score)}`}
                            title={`Score: ${Math.round(score)}`}
                          >
                            {Math.round(score)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
