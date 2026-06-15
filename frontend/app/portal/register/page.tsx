"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/useToast";
import { apiPortalRegister } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function PortalRegister() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    company_name: "",
    engagement_id: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiPortalRegister(formData);
      localStorage.setItem("auditos_portal_token", res.access_token);
      toast.success("Registration successful");
      router.push("/portal/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-12 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 shadow-xl rounded-[24px] p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create Portal Account</h2>
          <p className="text-slate-500 mt-2">Register to access your audit findings.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="engagement_id" className="text-slate-700 text-sm font-medium">Engagement ID (from your auditor)</Label>
            <Input
              id="engagement_id"
              required
              value={formData.engagement_id}
              onChange={(e) => setFormData({ ...formData, engagement_id: e.target.value })}
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600/20 h-12 rounded-xl font-mono text-sm"
              placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_name" className="text-slate-700 text-sm font-medium">Company Name</Label>
            <Input
              id="company_name"
              required
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600/20 h-12 rounded-xl"
              placeholder="Acme Corp"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-slate-700 text-sm font-medium">Full Name</Label>
            <Input
              id="full_name"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600/20 h-12 rounded-xl"
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700 text-sm font-medium">Email Address</Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600/20 h-12 rounded-xl"
              placeholder="jane@company.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-700 text-sm font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600/20 h-12 rounded-xl"
              placeholder="Enter your password"
            />
          </div>
          
          <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-12 rounded-xl transition shadow-lg shadow-blue-600/20 mt-2">
            {loading ? "Registering..." : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/portal/login" className="text-blue-600 hover:text-blue-700 font-semibold transition">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
