"use client";
import { useAuth } from "@/lib/auth-context";

interface RoleGateProps {
  children: React.ReactNode;
  minimumRole?: string;    // show if role >= this
  exactRoles?: string[];   // show if role is one of these
  fallback?: React.ReactNode;  // show if blocked
}

export function RoleGate({
  children,
  minimumRole,
  exactRoles,
  fallback = null
}: RoleGateProps) {
  const { hasRole, role } = useAuth();

  if (minimumRole && !hasRole(minimumRole)) {
    return <>{fallback}</>;
  }

  if (exactRoles && role && !exactRoles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
