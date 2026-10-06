import os

with open("frontend/src/pages/Login.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add useTheme
if "import { useTheme }" not in content:
    content = content.replace("import { useAuth } from \"../context/AuthContext\";", "import { useAuth } from \"../context/AuthContext\";\nimport { useTheme } from \"../context/ThemeContext\";")

# Add Sun and Moon to lucide-react
old_lucide = """  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react";"""

new_lucide = """  AlertCircle,
  Eye,
  EyeOff,
  Sun,
  Moon
} from "lucide-react";"""

if "Sun," not in content:
    content = content.replace(old_lucide, new_lucide)

with open("frontend/src/pages/Login.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Patched Login.jsx imports successfully")
