import os

with open("frontend/src/layouts/DashboardLayout.jsx", "r", encoding="utf-8") as f:
    content = f.read()

old_import = "} from \"lucide-react\";"
new_import = "  Sun,\n  Moon\n} from \"lucide-react\";"

if "Sun," not in content:
    content = content.replace(old_import, new_import)

with open("frontend/src/layouts/DashboardLayout.jsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Added Sun and Moon to lucide-react imports")
