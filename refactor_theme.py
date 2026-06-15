import os

path = r'c:\Users\user\.gemini\antigravity-ide\scratch\auditOS\auditos\frontend\app\(dashboard)\engagements\[id]\page.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    "bg-[var(--color-background)]": "bg-slate-50",
    "bg-[var(--color-card)]/50/50": "bg-slate-50",
    "bg-[var(--color-card)]/50": "bg-white",
    "bg-[var(--color-card)]/80": "bg-slate-50",
    "bg-[var(--color-card)]/30": "bg-white",
    "bg-[var(--color-card)]": "bg-white",
    "border-white/5": "border-slate-200",
    "border-white/10": "border-slate-200",
    "border-white/20": "border-slate-300",
    "text-white": "text-slate-900",
    "text-gray-400": "text-slate-500",
    "text-gray-300": "text-slate-600",
    "text-gray-500": "text-slate-400",
    "bg-glass-aurion": "bg-white border border-slate-200 shadow-sm",
    "bg-glass": "bg-white border border-slate-200 shadow-sm",
    "data-[state=active]:bg-[var(--color-primary)]": "data-[state=active]:bg-blue-50",
    "data-[state=active]:text-white": "data-[state=active]:text-blue-700",
    "bg-[var(--color-primary)]/10": "bg-blue-50",
    "bg-[var(--color-primary)]/5": "bg-blue-50",
    "bg-[var(--color-primary)]": "bg-blue-600",
    "hover:bg-[var(--color-primary-dark)]": "hover:bg-blue-700",
    "text-[var(--color-primary)]": "text-blue-600",
    "border-[var(--color-primary)]/50": "border-blue-300",
    "border-[var(--color-primary)]/10": "border-blue-100",
    "border-[var(--color-primary)]": "border-blue-600",
    "shadow-[var(--color-primary)]/20": "shadow-blue-500/20",
    "shadow-[0_0_15px_rgba(0,0,0,0.5)]": "shadow-sm",
    "bg-gray-800": "bg-slate-100",
    "bg-gray-700": "bg-slate-200",
    "bg-gray-900": "bg-slate-50",
    "hover:bg-gray-800": "hover:bg-slate-100",
    "hover:text-white": "hover:text-slate-900",
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
