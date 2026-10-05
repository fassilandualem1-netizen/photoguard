with open("frontend/src/layouts/DashboardLayout.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Import useTheme and Moon/Sun
if "import { useTheme }" not in content:
    content = content.replace(
        'import { LogOut,',
        'import { useTheme } from "../context/ThemeContext";\nimport { LogOut, Moon, Sun,'
    )

# 2. Add useTheme hook inside component
if "const { theme, toggleTheme } = useTheme();" not in content:
    content = content.replace(
        'const { user, logout, isAssistant, isAdmin } = useAuth();',
        'const { user, logout, isAssistant, isAdmin } = useAuth();\n  const { theme, toggleTheme } = useTheme();'
    )

# 3. Add toggle button before logout button in Desktop Sidebar
desktop_logout = """          <button
            onClick={logout}"""
desktop_toggle = """          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors mb-2"
          >
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </div>
          </button>
          <button
            onClick={logout}"""
content = content.replace(desktop_logout, desktop_toggle, 1) # Only replace the first one (desktop)

# 4. Add toggle button in Mobile Sidebar
mobile_logout = """                <button
                  onClick={logout}"""
mobile_toggle = """                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors mb-2"
                >
                  <div className="flex items-center gap-3">
                    {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                  </div>
                </button>
                <button
                  onClick={logout}"""
content = content.replace(mobile_logout, mobile_toggle)

with open("frontend/src/layouts/DashboardLayout.jsx", "w", encoding="utf-8") as f:
    f.write(content)
