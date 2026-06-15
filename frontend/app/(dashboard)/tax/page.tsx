"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/useToast";

export default function TaxPage() {
  const router = useRouter();

  useEffect(() => {
    toast.info("Please select an engagement to perform a Tax Audit");
    router.replace("/engagements");
  }, [router]);

  return <div className="p-8 text-slate-500">Redirecting to Engagements...</div>;
}
