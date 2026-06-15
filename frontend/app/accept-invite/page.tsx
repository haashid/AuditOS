"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Eye, EyeOff, CheckCircle } from "lucide-react";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { setError("Invalid invite link — no token found."); return; }
    if (!fullName.trim()) { setError("Full name is required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API}/api/v1/team/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, full_name: fullName, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to accept invite");

      localStorage.setItem("auditos_token", data.access_token);
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Welcome aboard!</h2>
        <p className="text-slate-500 text-sm">Redirecting to your dashboard...</p>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-8">
        <div className="w-20 h-20 flex items-center justify-center mx-auto mb-4">
          <Image src="/logo.png" alt="AuditOS Logo" width={80} height={80} className="w-full h-full object-contain scale-[1.7]" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Join your team</h1>
        <p className="text-slate-500 text-sm mt-1">Complete your account to get started</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
          <input
            id="full-name-input"
            type="text"
            className="input"
            placeholder="Your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
          <div className="relative">
            <input
              id="password-input"
              type={showPassword ? "text" : "password"}
              className="input pr-10"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
          <input
            id="confirm-password-input"
            type="password"
            className="input"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          id="accept-invite-submit"
          type="submit"
          disabled={loading}
          className="btn-primary w-full justify-center py-2.5"
        >
          {loading ? "Setting up your account..." : "Accept & Join"}
        </button>
      </form>
    </>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card-elevated p-8">
          <Suspense fallback={<div className="text-center text-slate-400">Loading...</div>}>
            <AcceptInviteForm />
          </Suspense>
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">
          AuditOS — AI-powered audit platform
        </p>
      </div>
    </div>
  );
}
