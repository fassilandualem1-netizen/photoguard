import os

with open("app/main.py", "r", encoding="utf-8") as f:
    content = f.read()

new_constants = """
DEFAULT_ADMIN_EMAIL = "fassilandualem1@gmail.com"
SAFE_ADMIN_FALLBACK_PASSWORD = "Admin@123!"

def seed_root_admin():
"""

if "DEFAULT_ADMIN_EMAIL =" not in content:
    content = content.replace("def seed_root_admin():", new_constants)

with open("app/main.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Added missing admin constants to main.py")
