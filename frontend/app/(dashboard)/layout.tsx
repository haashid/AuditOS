"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/layout/Sidebar";
import { Menu, Bell, Search } from "lucide-react";
import Image from "next/image";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    } else if (!isLoading && user && !user.onboarding_completed && pathname !== "/onboarding") {
      router.push("/onboarding");
    }
  }, [user, isLoading, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Loading AuditOS...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-[#f8fafc] flex-col lg:flex-row">
      {/* Mobile Topbar */}
      <header className="lg:hidden flex items-center justify-between bg-white border-b border-slate-200 px-4 h-16 shrink-0 z-30 relative">
        <div className="flex items-center">
          <div className="w-10 h-10 flex items-center justify-center">
            <Image src="/logo.png" alt="AuditOS Logo" width={40} height={40} className="w-full h-full object-contain scale-[1.7]" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 -ml-1">Audit<span className="text-blue-600">OS</span></span>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="p-2 text-slate-400">
            <Search className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
          </button>
          <button 
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg ml-1"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />
      
      <main className="flex-1 min-w-0 overflow-auto flex flex-col h-[calc(100vh-64px)] lg:h-screen">
        {children}
      </main>
    </div>
  );
}
