const fs = require("fs");
const path = "frontend/src/layouts/DashboardLayout.jsx";

let content = fs.readFileSync(path, "utf-8");

// Add import if not exists
if (!content.includes("useTheme")) {
    content = content.replace(
        "import { useAuth } from `"..`/context/AuthContext`";",
        "import { useAuth } from `"..`/context/AuthContext`";\nimport { useTheme } from `"..`/context/ThemeContext`";"
    );
}

// Add hook usage if not exists
if (!content.includes("const { theme, toggleTheme } = useTheme();")) {
    content = content.replace(
        "const { user, logout, isAdmin } = useAuth();",
        "const { user, logout, isAdmin } = useAuth();\n  const { theme, toggleTheme } = useTheme();"
    );
}

fs.writeFileSync(path, content, "utf-8");
console.log("Patched DashboardLayout.jsx");
