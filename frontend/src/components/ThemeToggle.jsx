import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ variant = "icon", className = "" }) {
  const { theme, toggleTheme } = useTheme();

  if (variant === "menu") {
    return (
      <button
        onClick={toggleTheme}
        className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#111620] dark:bg-[#111620] dark:hover:bg-slate-800/50 transition-colors ${className}`}
      >
        <div className="flex items-center gap-3">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`p-2.5 rounded-full bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition-all ${className}`}
      aria-label="Toggle Theme"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
