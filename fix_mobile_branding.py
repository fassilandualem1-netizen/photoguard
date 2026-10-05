import re

with open('frontend/src/layouts/DashboardLayout.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Mobile branding
content = re.sub(
    r'<span className="font-bold text-base text-slate-900">PhotoGuard</span>',
    r'<span className="font-bold text-base text-slate-900 truncate max-w-[150px]">{displayName}</span>',
    content
)

content = re.sub(
    r'<div className="flex items-center gap-2">\s*<div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">\s*<LayoutGrid className="w-3\.5 h-3\.5 text-indigo-600" />\s*</div>',
    r'<div className="flex items-center gap-2">\n                {displayLogo && !isAssistant ? (\n                  <img src={displayLogo} alt="Logo" className="h-7 w-7 object-contain rounded-md" />\n                ) : (\n                  <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">\n                    <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />\n                  </div>\n                )}',
    content
)

with open('frontend/src/layouts/DashboardLayout.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
