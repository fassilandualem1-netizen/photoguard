import os

# --- PATCH LOGIN.JSX ---
with open("frontend/src/pages/Login.jsx", "r", encoding="utf-8") as f:
    login_content = f.read()

# Replace the manual button with ThemeToggle
old_button = """          <button
            id="theme-toggle-login"
            onClick={toggleTheme}
            className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-white dark:bg-[#0b0e14] border 
border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 
dark:hover:text-indigo-400 shadow-sm transition-all"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>"""
new_button = """          <ThemeToggle className="absolute top-4 right-4 z-50" />"""
login_content = login_content.replace(old_button, new_button)
login_content = login_content.replace("import { useTheme } from \"../context/ThemeContext\";", "import ThemeToggle from \"../components/ThemeToggle\";")

with open("frontend/src/pages/Login.jsx", "w", encoding="utf-8") as f:
    f.write(login_content)


# --- PATCH DASHBOARDLAYOUT.JSX ---
with open("frontend/src/layouts/DashboardLayout.jsx", "r", encoding="utf-8") as f:
    dash_content = f.read()

import re

# Add import
if "import ThemeToggle" not in dash_content:
    dash_content = dash_content.replace('import { useAuth } from "../context/AuthContext";', 'import { useAuth } from "../context/AuthContext";\nimport ThemeToggle from "../components/ThemeToggle";')

# Remove the manual buttons
old_menu_button_1 = """            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium 
text-slate-600 dark:text-slate-300 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#111620] dark:bg-[#111620] 
dark:hover:bg-slate-800/50 transition-colors mb-2"
            >
              <div className="flex items-center gap-3">
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
              </div>
            </button>"""
new_menu_button_1 = """            <ThemeToggle variant="menu" className="mb-2" />"""
dash_content = dash_content.replace(old_menu_button_1, new_menu_button_1)

old_menu_button_2 = """                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium 
text-slate-600 dark:text-slate-300 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#111620] dark:bg-[#111620] 
dark:hover:bg-slate-800/50 transition-colors mb-2"
                  >
                    <div className="flex items-center gap-3">
                      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                    </div>
                  </button>"""
new_menu_button_2 = """                  <ThemeToggle variant="menu" className="mb-2" />"""
dash_content = dash_content.replace(old_menu_button_2, new_menu_button_2)

with open("frontend/src/layouts/DashboardLayout.jsx", "w", encoding="utf-8") as f:
    f.write(dash_content)

print("Theme refactor complete!")
