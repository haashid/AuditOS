"use client";

import { Building } from "lucide-react";

export default function InternalPage() {
  return (
    <div className="p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <Building className="w-8 h-8 text-slate-400" />
      </div>
      <p className="text-slate-900 font-semibold mb-1">Internal Audit (Coming Soon)</p>
      <p className="text-slate-500 text-sm">
        This module is currently in development and will be available in Phase 4.
      </p>
    </div>
  );
}
