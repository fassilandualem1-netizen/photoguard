import re

with open('frontend/src/pages/AlbumDetail.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace Client Selecting badge
content = re.sub(
    r'<span className="px-3 py-1 rounded-full bg-amber-500/15 text-indigo-500 text-xs font-semibold border border-amber-500/30 flex items-center gap-1\.5">\s*<span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />\s*<span>Client Selecting</span>\s*</span>',
    r'<span className="w-7 h-7 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center" title="Client Selecting">\n                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />\n                </span>',
    content
)

# 2. Remove Access PIN row in header
content = re.sub(
    r'<div className="flex items-center gap-1\.5">\s*<span className="text-slate-500 font-medium">Access PIN:</span>\s*<span className="font-mono font-bold text-indigo-700 px-2\.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 tracking-wider text-sm shadow-inner">\s*\{albumPin\}\s*</span>\s*</div>',
    '',
    content
)
# Note: In a previous version, the Access PIN span lacked "shadow-inner". Let's handle both.
content = re.sub(
    r'<div className="flex items-center gap-1\.5">\s*<span className="text-slate-500 font-medium">Access PIN:</span>\s*<span className="font-mono font-bold text-indigo-700 px-2\.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 tracking-wider text-sm(?: shadow-inner)?">\s*\{albumPin\}\s*</span>\s*</div>',
    '',
    content
)

# 3. Remove the shareText div
content = re.sub(
    r'<div className="p-2\.5 rounded-xl bg-slate-950/80 border border-slate-200 text-\[10px\] text-slate-500 font-mono leading-relaxed select-all">\s*"{shareText}"\s*</div>',
    '',
    content
)

with open('frontend/src/pages/AlbumDetail.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
