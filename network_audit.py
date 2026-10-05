import os, re, sys
sys.stdout.reconfigure(encoding="utf-8")

files = [
    "frontend/src/context/AuthContext.jsx",
    "frontend/src/pages/AlbumDetail.jsx",
    "frontend/src/components/CreateAlbumView.jsx",
    "frontend/src/components/PhotoUploader.jsx",
    "frontend/src/components/StudioBrandingView.jsx",
    "frontend/src/components/StudioAssistantsView.jsx",
    "frontend/src/components/GlobalErrorBoundary.jsx",
]

checks = {
    "timeout_configured": re.compile(r"timeout\s*[:=]"),
    "catch_block": re.compile(r"catch\s*\("),
    "finally_block": re.compile(r"finally\s*\{"),
    "loading_state": re.compile(r"setLoading|setIsLoading|loading"),
    "error_state": re.compile(r"setError|setErrorMsg|error"),
    "network_check": re.compile(r"navigator\.onLine|network|offline"),
    "retry_logic": re.compile(r"retry|setTimeout.*fetch|attempts"),
    "abort_controller": re.compile(r"AbortController|signal\.abort"),
}

print("=== NETWORK RESILIENCE CODE AUDIT ===\n")
for filepath in files:
    if not os.path.exists(filepath):
        print(f"MISSING: {filepath}")
        continue
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    fname = os.path.basename(filepath)
    print(f"--- {fname} ---")
    for name, pattern in checks.items():
        found = bool(pattern.search(content))
        icon = "OK" if found else "MISSING"
        print(f"  [{icon}] {name}")
    print()
