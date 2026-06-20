import glob
import re

files = glob.glob('c:/Users/user/.gemini/antigravity-ide/scratch/auditOS/auditos/frontend/app/(dashboard)/**/page.tsx', recursive=True)

modules_map = {
    'cyber': 'cyber',
    'esg': 'esg',
    'financial': 'financial',
    'it': 'it',
    'operational': 'operational',
    'supply-chain': 'supply-chain',
    'tax': 'tax',
    'internal': 'internal'
}

for filepath in files:
    if 'engagements' in filepath.replace('\\\\', '/'): continue
    
    module_name = None
    for k, v in modules_map.items():
        if f'/{k}/' in filepath.replace('\\\\', '/'):
            module_name = v
            break
            
    if not module_name:
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    content = re.sub(
        r'<CopilotFAB (engagementId=\{[^\}]+\}) />',
        f'<CopilotFAB \\\g<1> moduleName=\"{module_name}\" />',
        content
    )
    content = re.sub(
        r'<CopilotFAB />',
        f'<CopilotFAB moduleName=\"{module_name}\" />',
        content
    )
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f'Updated {filepath} with moduleName={module_name}')
