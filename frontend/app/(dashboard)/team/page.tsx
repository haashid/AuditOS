"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Users, UserPlus, Copy, Check, Shield, Star, Eye, Briefcase,
  Mail, Calendar, Crown, ChevronDown,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ROLES = [
  { value: "senior_auditor", label: "Senior Auditor", icon: Briefcase, color: "bg-blue-100 text-blue-700" },
  { value: "junior_auditor", label: "Junior Auditor", icon: Star, color: "bg-indigo-100 text-indigo-700" },
  { value: "reviewer", label: "Reviewer", icon: Eye, color: "bg-purple-100 text-purple-700" },
];

const ROLE_META: Record<string, { label: string; color: string }> = {
  partner: { label: "Partner", color: "bg-amber-100 text-amber-800" },
  admin: { label: "Partner", color: "bg-amber-100 text-amber-800" },
  senior_auditor: { label: "Senior Auditor", color: "bg-blue-100 text-blue-700" },
  auditor: { label: "Senior Auditor", color: "bg-blue-100 text-blue-700" },
  junior_auditor: { label: "Junior Auditor", color: "bg-indigo-100 text-indigo-700" },
  reviewer: { label: "Reviewer", color: "bg-purple-100 text-purple-700" },
};

interface Member {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role] || { label: role, color: "bg-slate-100 text-slate-700" };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>
      {role === "partner" || role === "admin" ? <Crown className="w-3 h-3" /> : null}
      {meta.label}
    </span>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("junior_auditor");
  const [inviteLink, setInviteLink] = useState("");
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const isPartner = ["partner", "admin"].includes(user?.role || "");

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem("auditos_token");
      const res = await fetch(`${API}/api/v1/team/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMembers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setError("");
    try {
      const token = localStorage.getItem("auditos_token");
      const res = await fetch(`${API}/api/v1/team/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create invitation");
      setInviteLink(data.invite_link);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInviting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const token = localStorage.getItem("auditos_token");
      const res = await fetch(`${API}/api/v1/team/members/${memberId}/role`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) fetchMembers();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Team Management
            </h1>
            <p className="text-slate-500 text-sm mt-1">Manage your firm&apos;s members and permissions</p>
          </div>
          {isPartner && (
            <button
              id="invite-member-btn"
              onClick={() => { setShowInviteModal(true); setInviteLink(""); setError(""); setInviteEmail(""); }}
              className="btn-primary"
            >
              <UserPlus className="w-4 h-4" />
              Invite Member
            </button>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Object.entries(
            members.reduce<Record<string, number>>((acc, m) => {
              const role = m.role === "admin" ? "partner" : m.role === "auditor" ? "senior_auditor" : m.role;
              acc[role] = (acc[role] || 0) + 1;
              return acc;
            }, {})
          ).map(([role, count]) => (
            <div key={role} className="stat-card text-center">
              <p className="text-2xl font-bold text-slate-900">{count}</p>
              <p className="text-xs text-slate-500 mt-1">{ROLE_META[role]?.label || role}</p>
            </div>
          ))}
        </div>

        {/* Member table */}
        <div className="card-elevated overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-white">
            <h2 className="font-semibold text-slate-800">Team Members ({members.length})</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full bg-white">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Member</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Joined</th>
                  {isPartner && <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {members.map((m) => (
                  <tr key={m.id} className="table-row">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                          {(m.full_name || m.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{m.full_name}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" />{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><RoleBadge role={m.role} /></td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                      </span>
                    </td>
                    {isPartner && (
                      <td className="px-6 py-4">
                        {m.id !== user?.id ? (
                          <div className="relative group inline-block">
                            <select
                              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 cursor-pointer hover:border-blue-400 transition-colors"
                              value={m.role}
                              onChange={(e) => handleRoleChange(m.id, e.target.value)}
                            >
                              <option value="partner">Partner</option>
                              <option value="senior_auditor">Senior Auditor</option>
                              <option value="junior_auditor">Junior Auditor</option>
                              <option value="reviewer">Reviewer</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">You</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Invite Team Member</h3>
                <p className="text-xs text-slate-400">Generate a secure invite link</p>
              </div>
            </div>

            {!inviteLink ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                    <input
                      id="invite-email-input"
                      type="email"
                      className="input"
                      placeholder="colleague@firm.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                    <div className="grid grid-cols-1 gap-2">
                      {ROLES.map(({ value, label, icon: Icon, color }) => (
                        <button
                          key={value}
                          onClick={() => setInviteRole(value)}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                            inviteRole === value
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-100 hover:border-slate-200"
                          }`}
                        >
                          <span className={`p-1.5 rounded-lg ${color}`}>
                            <Icon className="w-3 h-3" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{label}</p>
                          </div>
                          {inviteRole === value && (
                            <Check className="w-4 h-4 text-blue-600 ml-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    id="generate-invite-btn"
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail}
                    className="btn-primary flex-1"
                  >
                    {inviting ? "Generating..." : "Generate Link"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <p className="text-sm font-semibold text-green-800 mb-1">✅ Invite link created!</p>
                  <p className="text-xs text-green-700">Share this link with the invitee. It expires in 7 days.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-600 flex-1 truncate font-mono">{inviteLink}</p>
                  <button
                    id="copy-invite-link-btn"
                    onClick={handleCopy}
                    className="flex-shrink-0 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => { setShowInviteModal(false); setInviteLink(""); setInviteEmail(""); }}
                  className="btn-primary w-full mt-4"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
