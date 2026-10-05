import os, re, sys
sys.stdout.reconfigure(encoding="utf-8")

def grep_files(pattern, directory="frontend/src"):
    regex = re.compile(pattern, re.IGNORECASE)
    results = []
    for root, _, files in os.walk(directory):
        for file in files:
            if not file.endswith(('.js', '.jsx')): continue
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                for i, line in enumerate(f, 1):
                    if regex.search(line):
                        results.append(f"{file}:{i} -> {line.strip()[:80]}")
    return results

print("=== FRONTEND SECURITY AUDIT ===\n")

print("1. Checking for hardcoded secrets or sensitive API keys...")
secrets = grep_files(r"(api_key|secret|password)\s*[:=]\s*[\"'][a-zA-Z0-9_-]{10,}[\"']")
if secrets:
    print("\n".join(secrets))
else:
    print("  [OK] No hardcoded secrets found.")

print("\n2. Checking for dangerous HTML rendering (XSS risk)...")
xss = grep_files(r"dangerouslySetInnerHTML")
if xss:
    print("\n".join(xss))
else:
    print("  [OK] No dangerouslySetInnerHTML usages found.")

print("\n3. Checking Auth Token storage mechanisms...")
storage = grep_files(r"(localStorage|sessionStorage)\.setItem\(['\"](token|auth|user)[\"']")
if storage:
    print("\n".join(storage))
else:
    print("  [OK] No dangerous token storage found.")

print("\n4. Checking Route Protection (App.jsx)...")
with open("frontend/src/App.jsx", "r", encoding="utf-8") as f:
    app_content = f.read()
if "ProtectedRoute" in app_content or "RequireAuth" in app_content or "user ?" in app_content:
    print("  [OK] Route protection mechanisms detected in App.jsx.")
else:
    print("  [WARN] Could not easily verify Protected Routes in App.jsx.")
