import re, sys
sys.stdout.reconfigure(encoding="utf-8")

files = {
    "AlbumDetail.jsx": "frontend/src/pages/AlbumDetail.jsx",
    "DashboardLayout.jsx": "frontend/src/layouts/DashboardLayout.jsx",
    "StudioBrandingView.jsx": "frontend/src/components/StudioBrandingView.jsx",
    "DashboardHome.jsx": "frontend/src/pages/DashboardHome.jsx",
    "StudioAssistantsView.jsx": "frontend/src/components/StudioAssistantsView.jsx",
}

for fname, fpath in files.items():
    with open(fpath, "r", encoding="utf-8") as f:
        lines = f.readlines()
    print(f"\n--- {fname}: unguarded .map() calls ---")
    for i, line in enumerate(lines, 1):
        if ".map(" in line and "?.map(" not in line:
            ctx = "".join(lines[max(0,i-3):i+2]).strip()[:200]
            print(f"  Line {i}: {line.strip()[:100]}")
