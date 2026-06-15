"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "@/hooks/useToast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { apiRegister } from "@/lib/api";
import { ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    org_name: "",
  });
  const [loading, setLoading] = useState(false);

  const update = (key: string, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRegister(form);
      await login(res.access_token);
      toast.success("Account created! Welcome to AuditOS.");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 justify-center items-center p-4 py-12">
      <Link href="/" className="flex items-center mb-8 transition hover:opacity-80">
        <div className="flex h-16 w-16 items-center justify-center">
          <Image src="/logo.png" alt="AuditOS Logo" width={64} height={64} className="w-full h-full object-contain scale-[1.7]" />
        </div>
        <span className="text-3xl font-bold -ml-2">
          Audit<span className="text-blue-600">OS</span>
        </span>
      </Link>

      <div className="w-full max-w-md bg-white border border-slate-200 shadow-xl rounded-[24px] p-6 sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Create your workspace</h1>
          <p className="text-slate-500 mt-2">
            Set up your audit firm account in 60 seconds
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="org_name" className="text-slate-700 text-sm font-medium">
              Firm / Organization name
            </Label>
            <Input
              id="org_name"
              placeholder="Acme Audit Partners"
              value={form.org_name}
              onChange={(e) => update("org_name", e.target.value)}
              required
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600/20 h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-slate-700 text-sm font-medium">
              Your full name
            </Label>
            <Input
              id="full_name"
              placeholder="Jane Smith"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600/20 h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-email" className="text-slate-700 text-sm font-medium">
              Email address
            </Label>
            <Input
              id="reg-email"
              type="email"
              placeholder="you@firm.com"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              required
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600/20 h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-password" className="text-slate-700 text-sm font-medium">
              Password
            </Label>
            <Input
              id="reg-password"
              type="password"
              placeholder="Create a strong password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              required
              minLength={8}
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600/20 h-12 rounded-xl"
            />
          </div>

          <Button
            id="register-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-12 rounded-xl transition shadow-lg shadow-blue-600/20 mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating account...
              </span>
            ) : (
              "Create account"
            )}
          </Button>

          <p className="text-center text-sm text-slate-500 pt-4">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-700 font-semibold transition"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
