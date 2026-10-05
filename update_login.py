import os
login_file = "frontend/src/pages/Login.jsx"
with open(login_file, "r", encoding="utf-8") as f:
    content = f.read()

# Add useTheme and Moon/Sun icon import if missing
if "useTheme" not in content:
    content = content.replace(
        'import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";',
        'import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle, Moon, Sun } from "lucide-react";\nimport { useTheme } from "../context/ThemeContext";'
    )
    content = content.replace("const [error, setError] = useState(null);", "const [error, setError] = useState(null);\n  const { theme, toggleTheme } = useTheme();")

# Add the toggle button in the top right corner
if "toggleTheme" in content and "id=\"theme-toggle-login\"" not in content:
    # Find the top right corner spot to place the toggle button. 
    # The relative overflow-hidden container starts at id="login-container"
    target = '<div className="w-full max-w-[440px] relative z-10 my-auto">'
    toggle_html = """
        {/* Theme Toggle */}
        <button
          id="theme-toggle-login"
          onClick={toggleTheme}
          className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition-all"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-full max-w-[440px] relative z-10 my-auto">"""
    
    content = content.replace(target, toggle_html)

# Fix the background missing dark class
content = content.replace(
    'bg-[#F6F7FB] text-slate-900 dark:text-white',
    'bg-[#F6F7FB] dark:bg-[#06080c] text-slate-900 dark:text-white'
)

with open(login_file, "w", encoding="utf-8") as f:
    f.write(content)
print("Login page updated with toggle and background fixed.")
