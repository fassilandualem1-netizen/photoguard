import os, re

dir_paths = ["frontend/src/components", "frontend/src/pages", "frontend/src/layouts"]

replacements = [
    # Safe replacements using negative lookahead to avoid double replacement
    (r'bg-white(?!\s+dark:bg-\[#0b0e14\])', r'bg-white dark:bg-[#0b0e14]'),
    (r'bg-\[#F6F7FB\](?!\s+dark:bg-\[#06080c\])', r'bg-[#F6F7FB] dark:bg-[#06080c]'),
    (r'border-slate-200(?!\s+dark:border-slate-800)', r'border-slate-200 dark:border-slate-800'),
    (r'border-slate-300(?!\s+dark:border-slate-700)', r'border-slate-300 dark:border-slate-700'),
    (r'border-slate-100(?!\s+dark:border-slate-800)', r'border-slate-100 dark:border-slate-800'),
    (r'text-slate-900(?!\s+dark:text-white)', r'text-slate-900 dark:text-white'),
    (r'text-slate-500(?!\s+dark:text-slate-400)', r'text-slate-500 dark:text-slate-400'),
    (r'text-slate-600(?!\s+dark:text-slate-300)', r'text-slate-600 dark:text-slate-300'),
    (r'text-slate-700(?!\s+dark:text-slate-200)', r'text-slate-700 dark:text-slate-200'),
    (r'bg-slate-50(?!\s+dark:bg-\[#111620\])', r'bg-slate-50 dark:bg-[#111620]'),
    (r'bg-slate-100(?!\s+dark:bg-slate-800)', r'bg-slate-100 dark:bg-slate-800'),
    (r'hover:bg-slate-50(?!\s+dark:hover:bg-\[#111620\])', r'hover:bg-slate-50 dark:hover:bg-[#111620]'),
]

for dpath in dir_paths:
    for root, _, files in os.walk(dpath):
        for file in files:
            if not file.endswith(".jsx"): continue
            fpath = os.path.join(root, file)
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
            
            new_content = content
            for old, new in replacements:
                new_content = re.sub(old, new, new_content)
            
            if new_content != content:
                with open(fpath, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Updated classes in {file}")
