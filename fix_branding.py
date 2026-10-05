import re

with open('frontend/src/layouts/DashboardLayout.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Desktop branding
content = re.sub(
    r'\{user\?\.studio_logo_url && !isAssistant \? \(\s*<img src=\{user\.studio_logo_url\}',
    r'{displayLogo && !isAssistant ? (\n            <img src={displayLogo}',
    content
)
content = re.sub(
    r'<span className="font-bold text-lg text-slate-900 tracking-tight">PhotoGuard</span>',
    r'<span className="font-bold text-lg text-slate-900 tracking-tight truncate max-w-[150px]">{displayName}</span>',
    content
)

# Mobile branding
mobile_old = '''<div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <span className="font-bold text-base text-slate-900">PhotoGuard</span>'''

mobile_new = '''{displayLogo && !isAssistant ? (
                  <img src={displayLogo} alt="Logo" className="h-7 w-7 object-contain rounded-md" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                )}
                <span className="font-bold text-base text-slate-900 truncate max-w-[150px]">{displayName}</span>'''

content = content.replace(mobile_old, mobile_new)

with open('frontend/src/layouts/DashboardLayout.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
