import os
import re

directories = ['client/src/features', 'client/src/stores', 'client/src/components']

targets = [
    # 1. const/let/var headers = token ? { Authorization ... } : undefined;
    (r'(const|let|var)\s+(authHeaders|headers)\s*=\s*token\s*\?\s*\{[\s\n]*Authorization:\s*`Bearer\s*\$\{token\}`[\s\n]*\}\s*:\s*(undefined|null|\{\});?', ''),
    
    # 2. headers: token ? { Authorization ... } : undefined
    (r'headers:\s*token\s*\?\s*\{[\s\n]*Authorization:\s*`Bearer\s*\$\{token\}`[\s\n]*\}\s*:\s*(undefined|null|\{\}),?', ''),
    
    # 3. headers: { Authorization ... }
    (r'headers:\s*\{[\s\n]*Authorization:\s*`Bearer\s*\$\{token\}`[\s\n]*\},?', ''),
    
    # 4. return token ? { Authorization ... } : undefined
    (r'return\s+token\s*\?\s*\{[\s\n]*Authorization:\s*`Bearer\s*\$\{token\}`[\s\n]*\}\s*:\s*(undefined|null|\{\});?', 'return undefined;'),
    
    # 5. Clean up any remaining token getItem
    (r'(const|let|var)\s+token\s*=\s*(localStorage|sessionStorage)\.getItem\([\'"]token[\'"]\).*?;?\n?', '')
]

for d in directories:
    full_d = os.path.join('..', d) # running from server/ directory
    if not os.path.exists(full_d):
        full_d = os.path.join(os.getcwd(), d)
    if not os.path.exists(full_d): continue

    for root, _, files in os.walk(full_d):
        for f in files:
            if f.endswith('.js') or f.endswith('.jsx'):
                p = os.path.join(root, f)
                with open(p, 'r', encoding='utf-8') as file:
                    content = file.read()
                
                new_content = content
                for pattern, replacement in targets:
                    new_content = re.sub(pattern, replacement, new_content, flags=re.MULTILINE|re.IGNORECASE)
                
                # Cleanup leftover empty objects in axios calls
                # e.g. axios.get(url, { }) -> axios.get(url)
                new_content = re.sub(r',\s*\{\s*\}\s*\)', ')', new_content)
                new_content = re.sub(r'\(\s*\{\s*\}\s*\)', '()', new_content)
                new_content = re.sub(r'\{\s*,\s*', '{', new_content)
                new_content = re.sub(r',\s*,\s*', ',', new_content)
                new_content = re.sub(r',\s*\}', ' }', new_content)

                if new_content != content:
                    with open(p, 'w', encoding='utf-8') as file:
                        file.write(new_content)
                    print(f"Fixed {p}")
