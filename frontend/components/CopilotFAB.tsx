"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X } from "lucide-react";
import { toast } from "@/hooks/useToast";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("auditos_token") : null;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MODULE_QUESTIONS: Record<string, string[]> = {
  "financial": [
    "Summarize all high-risk transactions",
    "Which accounts have the most flagged entries?",
    "Show transactions posted on weekends",
    "What are the top 5 largest transactions?",
    "Are there any transactions missing descriptions?",
  ],
  "internal": [
    "Summarize failing controls",
    "Which processes have the highest residual risk?",
    "Show controls missing evidence",
    "List all key controls",
    "What are the latest test results?",
  ],
  "tax": [
    "Which accounts have non-deductible exposure?",
    "Summarize GST/VAT reconciliation differences",
    "Show flagged high-risk tax entries",
    "What is the total tax variance?",
  ],
  "it": [
    "Show all dormant user accounts",
    "Which admins do not have MFA enabled?",
    "List unauthorized production changes",
    "Summarize the ITGC maturity score",
    "Which changes lacked approval?",
  ],
  "cyber": [
    "Summarize critical severity vulnerabilities",
    "Which NIST controls are scored lowest?",
    "List vulnerabilities with CVSS over 9.0",
    "Generate a remediation plan for missing SSL",
  ],
  "esg": [
    "Calculate total Scope 1 and 2 emissions",
    "Which ESG metrics are missing targets?",
    "Summarize BRSR principle 6 disclosures",
    "Show emissions tracked from diesel",
  ],
  "operational": [
    "Which KPIs are showing adverse variance?",
    "Summarize high-impact operational risks",
    "List process bottlenecks identified",
    "Show trends in production downtime",
  ],
  "supply-chain": [
    "List vendors with Critical ESG risk",
    "Summarize failed supplier compliance audits",
    "Show top 5 largest vendor contracts",
    "Which suppliers lack SOC2 reports?",
  ]
};

export function CopilotTab({ engagementId, moduleName = "financial" }: { engagementId?: string, moduleName?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/v1/copilot/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question, engagement_id: engagementId || "global" }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const aiResponseObj = { text: "" };

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunkText = decoder.decode(value, { stream: true });
        aiResponseObj.text = aiResponseObj.text + chunkText;
        const currentText = aiResponseObj.text;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: currentText };
          return updated;
        });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Copilot error");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full absolute inset-0">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-600/20">
              <Bot className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-center px-4">
              <h3 className="text-slate-900 font-semibold text-sm">Audit Copilot</h3>
              <p className="text-slate-500 text-xs mt-1">Ask questions about this engagement&apos;s data</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-[90%]">
              {(MODULE_QUESTIONS[moduleName] || MODULE_QUESTIONS["financial"]).map((q) => (
                <button
                  key={q}
                  id={`copilot-suggest-${q.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
                  onClick={() => sendMessage(q)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:border-blue-600/30 hover:text-blue-600 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-slate-900 rounded-br-sm"
                    : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce delay-75" />
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce delay-150" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="relative"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Copilot anything..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600/50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 disabled:opacity-50 disabled:hover:text-slate-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

export function CopilotFAB({ engagementId, moduleName = "financial" }: { engagementId?: string, moduleName?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-8 w-[400px] h-[600px] max-h-[70vh] bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden z-50">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Audit Copilot</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-white relative">
            <CopilotTab engagementId={engagementId} moduleName={moduleName} />
          </div>
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-slate-900 rounded-full shadow-lg glow-primary transition-transform hover:scale-105 z-50 flex items-center justify-center"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>
    </>
  );
}
