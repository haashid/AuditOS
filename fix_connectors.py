import re
with open('backend/api/v1/connectors.py', 'r') as f:
    content = f.read()
content = re.sub(r'\s*source_system=".*?",\n', '\n', content)
with open('backend/api/v1/connectors.py', 'w') as f:
    f.write(content)
print("Done")
