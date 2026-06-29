"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Activity, FolderOpen, Flag, FileCheck, Shield, Upload, Users,
  Filter, ChevronDown, RefreshCw,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  resource_type: string;
  created_at: string;
}

export default function ActivityPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivity = async (pg = 1, append = false) => {
    try {
      const token = localStorage.getItem("auditos_token");
      const res = await fetch(`${API}/api/v1/activity?page=${pg}&page_size=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTotal(data.total);
        if (append) {
          setActivities((prev) => [...prev, ...data.data]);
        } else {
          setActivities(data.data);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchActivity(1); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchActivity(1);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchActivity(nextPage, true);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              Activity Log
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Audit trail of all significant actions — {total} total events
            </p>
          </div>
          <button
            id="refresh-activity-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="card-elevated flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Activity className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-slate-700 font-semibold mb-1">No activity yet</h3>
            <p className="text-slate-400 text-sm">Actions will appear here as your team works</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-100" />

            <div className="space-y-4">
              {activities.map((item, i) => {
                const Icon = ACTION_ICONS[item.action_type] || Activity;
                const colorClass = ACTION_COLORS[item.action_type] || "bg-slate-100 text-slate-600";
                return (
                  <div
                    key={item.id}
                    className="relative flex gap-4 animate-fade-in-up"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    {/* Icon */}
                    <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass} border-2 border-white shadow-sm`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 hover:border-blue-100 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-slate-800 font-medium leading-snug">{item.description}</p>
                        <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(item.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">
                          {(item.user_name || "?")[0].toUpperCase()}
                        </div>
                        <span className="text-xs text-slate-500">{item.user_name}</span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400 capitalize">{item.action_type.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {activities.length < total && (
              <div className="flex justify-center mt-6">
                <button
                  id="load-more-activity-btn"
                  onClick={handleLoadMore}
                  className="btn-secondary"
                >
                  <ChevronDown className="w-4 h-4" />
                  Load More
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
