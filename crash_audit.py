import os, re, sys
sys.stdout.reconfigure(encoding="utf-8")

files = {
    "AuthContext.jsx": "frontend/src/context/AuthContext.jsx",
    "AlbumDetail.jsx": "frontend/src/pages/AlbumDetail.jsx",
    "DashboardHome.jsx": "frontend/src/pages/DashboardHome.jsx",
    "DashboardLayout.jsx": "frontend/src/layouts/DashboardLayout.jsx",
    "CreateAlbumView.jsx": "frontend/src/components/CreateAlbumView.jsx",
    "StudioBrandingView.jsx": "frontend/src/components/StudioBrandingView.jsx",
    "StudioAssistantsView.jsx": "frontend/src/components/StudioAssistantsView.jsx",
    "AlbumCard.jsx": "frontend/src/components/AlbumCard.jsx",
    "App.jsx": "frontend/src/App.jsx",
    "AlbumLightbox.jsx": "frontend/src/components/AlbumLightbox.jsx",
}

checks = {
    "try/catch on async calls": re.compile(r"try\s*\{"),
    "optional chaining (?.)": re.compile(r"\?\.\w"),
    "null fallback (|| or ??)": re.compile(r"\|\|\s*[\"'\[\{]|\?\?"),
    "array.map without guard": lambda c: len(re.findall(r'\.map\(', c)) > 0 and len(re.findall(r'\?\s*\.map\(|\w+\s*&&\s*\w+\.map\(|Array\.isArray', c)) == 0,
    "unhandled .then() without .catch": lambda c: bool(re.search(r'\.then\(', c)) and not bool(re.search(r'\.catch\(', c)),
    "setState after unmount risk": lambda c: bool(re.search(r'useEffect.*=>.*\{', c, re.DOTALL)) and not bool(re.search(r'return\s*\(\s*\)\s*=>', c)),
}

print("=== CRASH & ERROR HANDLING AUDIT ===\n")
issues = []
for fname, filepath in files.items():
    if not os.path.exists(filepath):
        continue
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    print(f"--- {fname} ---")
    for check_name, pattern in checks.items():
        if callable(pattern):
            result = pattern(content)
            is_problem = result  # True = problem found
            icon = "WARN" if is_problem else "OK"
            if is_problem:
                issues.append(f"  {fname}: {check_name}")
        else:
            found = bool(pattern.search(content))
            is_problem = not found and check_name in ["try/catch on async calls", "optional chaining (?.)"]
            icon = "OK" if found else ("WARN" if is_problem else "NOTE")
        print(f"  [{icon}] {check_name}")
    print()

print("=== ISSUES SUMMARY ===")
for issue in issues:
    print(f"  ! {issue}")
if not issues:
    print("  No critical issues found.")
