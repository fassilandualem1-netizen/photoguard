import os
import re

# We will apply smart replacements across all jsx files in frontend/src
replacements = {
    r'\bbg-white\b': 'bg-white dark:bg-[#0b0e14]',
    r'\bbg-\[\#F6F7FB\]\b': 'bg-[#F6F7FB] dark:bg-[#06080d]',
    r'\btext-slate-900\b': 'text-slate-900 dark:text-white',
    r'\btext-slate-800\b': 'text-slate-800 dark:text-slate-200',
    r'\btext-slate-700\b': 'text-slate-700 dark:text-slate-300',
    r'\btext-slate-600\b': 'text-slate-600 dark:text-slate-400',
    r'\bborder-slate-200\b': 'border-slate-200 dark:border-slate-800',
    r'\bborder-slate-300\b': 'border-slate-300 dark:border-slate-700',
    r'\bbg-slate-50\b': 'bg-slate-50 dark:bg-slate-800/50',
    r'\bhover:bg-slate-50\b': 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
    r'\bbg-slate-100\b': 'bg-slate-100 dark:bg-slate-800',
    r'\bhover:text-slate-900\b': 'hover:text-slate-900 dark:hover:text-white',
    r'\bdivide-slate-200\b': 'divide-slate-200 dark:divide-slate-800',
    r'\bdivide-slate-100\b': 'divide-slate-100 dark:divide-slate-800/50',
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    # Prevent double replacements
    if "dark:bg-" in content and "DashboardLayout" not in filepath: # avoid re-running if already done
        pass 
        
    for old, new in replacements.items():
        # Only replace if not already replaced
        # A simple hack: we just do it, but skip if dark: is already near
        content = re.sub(old + r'(?! dark:)', new, content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('frontend/src'):
    for file in files:
        if file.endswith(('.jsx', '.js')):
            process_file(os.path.join(root, file))

print("Theme classes applied.")
