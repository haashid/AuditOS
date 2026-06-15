import { Toaster } from "@/components/ui/Toaster";
import { ShieldCheck } from "lucide-react";
import Image from "next/image";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-xl px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center">
          <div className="flex h-14 w-14 items-center justify-center">
            <Image src="/logo.png" alt="AuditOS Logo" width={56} height={56} className="w-full h-full object-contain scale-[1.7]" />
          </div>
          <span className="text-xl font-bold tracking-tight -ml-1">
            Audit<span className="text-blue-600">OS</span> Client Portal
          </span>
        </div>
      </header>
      <main>
        {children}
      </main>
      <Toaster />
    </div>
  );
}
