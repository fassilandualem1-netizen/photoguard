with open("frontend/src/pages/Login.jsx", "r", encoding="utf-8") as f:
    content = f.read()

if "import { useTheme }" not in content:
    content = content.replace(
        'import { Mail, Lock, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";',
        'import { Mail, Lock, ShieldCheck, AlertCircle, Loader2, Sun, Moon } from "lucide-react";\nimport { useTheme } from "../context/ThemeContext";'
    )

if "const { theme, toggleTheme } = useTheme();" not in content:
    content = content.replace(
        'export default function Login({ onLoginSuccess }) {',
        'export default function Login({ onLoginSuccess }) {\n  const { theme, toggleTheme } = useTheme();'
    )

# Insert the absolute positioned button inside the main container
floating_button = """      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-full bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors"
        title="Toggle Theme"
      >
        {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="relative z-10 w-full max-w-md">"""

content = content.replace(
    '<div className="relative z-10 w-full max-w-md">',
    floating_button
)

with open("frontend/src/pages/Login.jsx", "w", encoding="utf-8") as f:
    f.write(content)
