import re

with open('frontend/src/components/StudioBrandingView.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'<div>\s*<p className="text-sm font-semibold text-slate-900">Active Studio Logo</p>\s*<p className="text-xs text-slate-500 truncate max-w-\[200px\] sm:max-w-xs">\{studioLogoUrl\}</p>\s*</div>',
    r'<div>\n                  <p className="text-sm font-semibold text-slate-900">Studio Logo</p>\n                </div>',
    content
)

with open('frontend/src/components/StudioBrandingView.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
