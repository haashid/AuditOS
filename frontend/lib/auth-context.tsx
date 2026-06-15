"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiGetMe, UserOut } from "@/lib/api";

interface AuthContextType {
  user: UserOut | null;
  token: string | null;
  isLoading: boolean;
  activeModules: string[];
  hasModule: (moduleKey: string) => boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModules, setActiveModules] = useState<string[]>(["financial_audit"]);
  const router = useRouter();

  const fetchModules = async (tokenStr: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/modules/status`, {
        headers: { Authorization: `Bearer ${tokenStr}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveModules(data.active_modules || ["financial_audit"]);
      }
    } catch (e) {
      console.error("Failed to fetch modules", e);
    }
  };

  const hasModule = (moduleKey: string): boolean => {
    return activeModules.includes(moduleKey);
  };

  useEffect(() => {
    // Restore session from localStorage on mount
    const storedToken = localStorage.getItem("auditos_token");
    if (storedToken) {
      Promise.resolve().then(() => setToken(storedToken));
      Promise.all([
        apiGetMe(),
        fetchModules(storedToken)
      ])
        .then(([u]) => setUser(u))
        .catch(() => {
          localStorage.removeItem("auditos_token");
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      Promise.resolve().then(() => setIsLoading(false));
    }
  }, []);

  const login = async (newToken: string) => {
    localStorage.setItem("auditos_token", newToken);
    setToken(newToken);
    const me = await apiGetMe();
    await fetchModules(newToken);
    setUser(me);
  };

  const logout = () => {
    localStorage.removeItem("auditos_token");
    setToken(null);
    setUser(null);
    setActiveModules(["financial_audit"]);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, activeModules, hasModule, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
