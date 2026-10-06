import os
import re

# 1. FIX LOGIN.JSX
with open("frontend/src/pages/Login.jsx", "r", encoding="utf-8") as f:
    login_content = f.read()

# Remove the unused useTheme call
login_content = re.sub(r'\s*const \{ theme, toggleTheme \} = useTheme\(\);', '', login_content)

with open("frontend/src/pages/Login.jsx", "w", encoding="utf-8") as f:
    f.write(login_content)

# 2. FIX DASHBOARDLAYOUT.JSX
with open("frontend/src/layouts/DashboardLayout.jsx", "r", encoding="utf-8") as f:
    dash_content = f.read()

# Replace the first button
button_pattern_1 = r'<button\s*onClick=\{toggleTheme\}\s*className="w-full flex items-center justify-between px-3 py-2\.5 rounded-lg text-sm font-medium\s*text-slate-600 dark:text-slate-300 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-\[#111620\] dark:bg-\[#111620\]\s*dark:hover:bg-slate-800/50 transition-colors mb-2"\s*>\s*<div className="flex items-center gap-3">\s*\{theme === "dark" \? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />\}\s*<span>\{theme === "dark" \? "Light Mode" : "Dark Mode"\}</span>\s*</div>\s*</button>'
dash_content = re.sub(button_pattern_1, '<ThemeToggle variant="menu" className="mb-2" />', dash_content, flags=re.MULTILINE)

# Replace the second button
button_pattern_2 = r'<button\s*onClick=\{toggleTheme\}\s*className="w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium\s*text-slate-600 dark:text-slate-300 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-\[#111620\] dark:bg-\[#111620\]\s*dark:hover:bg-slate-800/50 transition-colors mb-2"\s*>\s*<div className="flex items-center gap-3">\s*\{theme === "dark" \? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />\}\s*<span>\{theme === "dark" \? "Light Mode" : "Dark Mode"\}</span>\s*</div>\s*</button>'
dash_content = re.sub(button_pattern_2, '<ThemeToggle variant="menu" className="mb-2" />', dash_content, flags=re.MULTILINE)

# Remove the unused useTheme call
dash_content = re.sub(r'\s*const \{ theme, toggleTheme \} = useTheme\(\);', '', dash_content)
# Remove the unused Sun, Moon imports if any
dash_content = re.sub(r'import \{[^}]*Sun[^}]*Moon[^}]*\} from "lucide-react";\n', 'import { Menu, X, LayoutDashboard, Folder, Image as ImageIcon, Settings, Users, Shield, Bell, ChevronDown, CheckCircle, Search, ExternalLink, Activity, AlertCircle, Trash2, Camera, UploadCloud, Smartphone, CreditCard, LogOut } from "lucide-react";\n', dash_content)
dash_content = re.sub(r'import \{ useTheme \} from "\.\./context/ThemeContext";\n', '', dash_content)


with open("frontend/src/layouts/DashboardLayout.jsx", "w", encoding="utf-8") as f:
    f.write(dash_content)

print("Fixed theme bugs!")
