import os

with open("frontend/src/layouts/DashboardLayout.jsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("LayoutGrid, LayoutTemplate, Share2, Send\n  Sun,", "LayoutGrid, LayoutTemplate, Share2, Send,\n  Sun,")

with open("frontend/src/layouts/DashboardLayout.jsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Fixed syntax error")
