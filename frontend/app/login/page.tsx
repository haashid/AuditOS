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
import { apiLogin } from "@/lib/api";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiLogin({ email, password });
      await login(res.access_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 justify-center items-center p-4">
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
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-slate-500 mt-2">Sign in to your audit workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700 text-sm font-medium">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@firm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600/20 h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-700 text-sm font-medium">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600/20 h-12 rounded-xl"
            />
          </div>

          <Button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-12 rounded-xl transition shadow-lg shadow-blue-600/20 mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </Button>

          <p className="text-center text-sm text-slate-500 pt-4">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-blue-600 hover:text-blue-700 font-semibold transition"
            >
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
