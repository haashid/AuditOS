import os
import re

directories_to_process = [
    'app/(dashboard)',
    'components'
]

replacements = {
    r'bg-slate-950': 'bg-[var(--color-background)]',
    r'bg-slate-900': 'bg-[var(--color-card)]',
    r'bg-slate-800': 'bg-[var(--color-card)]/50',
    r'border-slate-800': 'border-white/5',
    r'border-slate-700': 'border-white/10',
    r'text-slate-400': 'text-gray-400',
    r'text-slate-300': 'text-gray-300',
    r'text-slate-200': 'text-gray-200',
    r'text-slate-500': 'text-gray-500',
    r'bg-indigo-600/20': 'bg-[var(--color-primary)]/10',
    r'bg-indigo-600': 'bg-[var(--color-primary)]',
    r'hover:bg-indigo-500/10': 'hover:bg-[var(--color-primary)]/10',
    r'hover:bg-indigo-500': 'hover:bg-[var(--color-primary-dark)]',
    r'bg-indigo-500/20': 'bg-[var(--color-primary)]/10',
    r'bg-indigo-500/10': 'bg-[var(--color-primary)]/5',
    r'bg-indigo-500': 'bg-[var(--color-primary)]',
    r'text-indigo-400': 'text-[var(--color-primary)]',
    r'text-indigo-300': 'text-[var(--color-primary)]',
    r'border-indigo-500/50': 'border-[var(--color-primary)]/30',
    r'border-indigo-500/30': 'border-[var(--color-primary)]/20',
    r'border-indigo-500/20': 'border-[var(--color-primary)]/10',
    r'border-indigo-500': 'border-[var(--color-primary)]/50',
    r'border-t-indigo-500': 'border-t-[var(--color-primary)]',
    r'shadow-indigo-600/25': 'glow-primary shadow-[var(--color-primary)]/20',
    r'shadow-lg shadow-indigo-600/25': 'glow-primary',
    r'bg-indigo-400': 'bg-[var(--color-primary)]',
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    for pattern, replacement in replacements.items():
        content = re.sub(pattern, replacement, content)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for directory in directories_to_process:
    full_dir_path = os.path.join(os.getcwd(), directory)
    if os.path.exists(full_dir_path):
        for root, _, files in os.walk(full_dir_path):
            for file in files:
                if file.endswith('.tsx') or file.endswith('.ts'):
                    process_file(os.path.join(root, file))

print("Done replacing theme classes.")
