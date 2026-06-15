"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  Settings,
  Users,
  Activity,
  LogOut,
  ShieldCheck,
  Building,
  Receipt,
  ChevronRight,
  Menu, 
  X,
  type LucideIcon
} from "lucide-react";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  module?: string;
}

const CORE_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/engagements", icon: ClipboardList, label: "Engagements" },
  { href: "/team", icon: Users, label: "Team" },
  { href: "/activity", icon: Activity, label: "Activity Log" },
];

const MODULE_ITEMS: NavItem[] = [
  { module: "financial_audit", href: "/financial", icon: ShieldCheck, label: "Financial Audit" },
  { module: "internal_audit", href: "/internal", icon: Building, label: "Internal Audit" },
  { module: "tax_audit", href: "/tax", icon: Receipt, label: "Tax Audit" },
];

const ROLE_LABELS: Record<string, string> = {
  partner: "Partner",
  senior_auditor: "Senior Auditor",
  junior_auditor: "Junior Auditor",
  reviewer: "Reviewer",
  admin: "Partner",
  auditor: "Auditor",
};

export default function Sidebar({ isOpen, setIsOpen }: { isOpen?: boolean; setIsOpen?: (val: boolean) => void }) {
  const pathname = usePathname();
  const { user, logout, hasModule } = useAuth();

  const roleLabel = ROLE_LABELS[user?.role || ""] || user?.role || "Auditor";

  const renderItem = (item: NavItem) => {
    const isActive =
      item.href === "/dashboard"
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + "/");
        
    return (
      <Link
        key={item.href}
        href={item.href}
        id={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group",
          isActive
            ? "bg-blue-50 text-blue-700"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
        )}
      >
        <item.icon
          className={cn(
            "w-4 h-4 flex-shrink-0 transition-colors",
            isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
          )}
        />
        <span className="flex-1">{item.label}</span>
        {isActive && (
          <ChevronRight className="w-3 h-3 text-blue-500 opacity-60" />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsOpen?.(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col shadow-2xl lg:shadow-sm transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:static lg:flex-shrink-0'}
      `}>
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-slate-100">
        <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
          <Image src="/logo.png" alt="AuditOS Logo" width={48} height={48} className="w-full h-full object-contain scale-[1.7]" />
        </div>
        <div className="min-w-0 -ml-1 flex-1">
          <p className="text-sm font-bold text-slate-900 tracking-tight">AuditOS</p>
          <p className="text-[10px] text-slate-400 font-medium">AI Platform</p>
        </div>
        {setIsOpen && (
          <button 
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {/* Core Items */}
        {CORE_ITEMS.map(renderItem)}

        {/* Dynamic Modules */}
        {MODULE_ITEMS.some(item => item.module && hasModule(item.module)) && (
          <>
            <div className="border-t border-slate-100 my-3 ml-2 mr-2" />
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 py-1 mb-1">Modules</p>
            {MODULE_ITEMS.filter(item => item.module && hasModule(item.module)).map(renderItem)}
          </>
        )}

        {/* Bottom items */}
        <div className="border-t border-slate-100 my-3 ml-2 mr-2" />
        {user?.is_superadmin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-purple-600 hover:bg-purple-50 transition-all duration-150 group"
          >
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">Superadmin Panel</span>
          </Link>
        )}
        {renderItem({ href: "/settings", icon: Settings, label: "Settings" })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center gap-3 px-3 py-2 mb-1 rounded-lg bg-slate-50">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-blue-700">
              {(user?.full_name || user?.email || "U")[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">
              {user?.full_name || user?.email}
            </p>
            <p className="text-[10px] text-slate-400 truncate">{roleLabel}</p>
          </div>
        </div>
        <button
          id="logout-button"
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150 group"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
    </>
  );
}
