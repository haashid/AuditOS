import os
import sys

path = r'c:\Users\user\.gemini\antigravity-ide\scratch\auditOS\auditos\frontend\app\(dashboard)\engagements\[id]\page.tsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'value="upload"' in line or 'value="transactions"' in line or 'value="documents"' in line or 'value="workpapers"' in line:
        print(f'{i+1}: {line.strip()}')
