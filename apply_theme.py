with open("frontend/src/App.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Import ThemeProvider
content = content.replace(
    'import { useAuth } from "./context/AuthContext";',
    'import { useAuth } from "./context/AuthContext";\nimport { ThemeProvider } from "./context/ThemeContext";'
)

# Wrap inside GlobalErrorBoundary
content = content.replace(
    '<BrowserRouter>',
    '<ThemeProvider>\n      <BrowserRouter>'
)
content = content.replace(
    '</BrowserRouter>',
    '</BrowserRouter>\n      </ThemeProvider>'
)

with open("frontend/src/App.jsx", "w", encoding="utf-8") as f:
    f.write(content)
