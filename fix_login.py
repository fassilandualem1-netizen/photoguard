import re

with open('frontend/src/pages/Login.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Main container
content = content.replace('bg-[#06080c] text-slate-100 selection:bg-[#FF1A4B]/30 selection:text-amber-200', 'bg-[#F6F7FB] text-slate-900 selection:bg-indigo-100 selection:text-indigo-900')

# 2. Background accents
content = content.replace('bg-gradient-to-tr from-[#FF1A4B]/10 via-[#F59E0B]/10 to-transparent', 'bg-gradient-to-tr from-indigo-500/10 via-sky-500/10 to-transparent')
content = content.replace('from-transparent via-[#06080c]/60 to-[#06080c]', 'from-transparent via-[#F6F7FB]/60 to-[#F6F7FB]')

# 3. Card
content = content.replace('bg-[#0b0e14]/90 border border-slate-800/80 shadow-[0_24px_70px_-12px_rgba(0,0,0,0.85),0_0_40px_rgba(245,158,11,0.06)]', 'bg-white border border-slate-200 shadow-xl shadow-slate-200/50')
content = content.replace('backdrop-blur-2xl', '') # Remove backdrop blur as it's solid white now or keep it? Keep it won't hurt, but removing is cleaner.

# 4. Logo glow
content = content.replace('bg-gradient-to-r from-[#FF1A4B] to-[#F59E0B] blur-lg opacity-40 group-hover:opacity-60', 'bg-indigo-500 blur-lg opacity-20 group-hover:opacity-40')

# 5. Text PhotoGuard
content = content.replace('<span className="font-extrabold text-2xl tracking-tight text-white">PhotoGuard</span>', '<span className="font-extrabold text-2xl tracking-tight text-slate-900">PhotoGuard</span>')

# 6. Studio Badge
content = content.replace('border border-amber-500/30 bg-gradient-to-r from-[#FF1A4B]/15 to-[#F59E0B]/15 text-amber-300', 'border border-indigo-200 bg-indigo-50 text-indigo-700')

# 7. Headers
content = content.replace('text-xl sm:text-2xl font-bold tracking-tight text-white mb-1.5', 'text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mb-1.5')
content = content.replace('text-xs sm:text-sm text-slate-400', 'text-xs sm:text-sm text-slate-500')

# 8. Error Alert (Make it lighter for light theme)
content = content.replace('border border-red-500/40 bg-red-950/60 text-red-200', 'border border-red-200 bg-red-50 text-red-700')
content = content.replace('text-red-400', 'text-red-600')
content = content.replace('shadow-red-950/40', 'shadow-red-100/50')

# 9. Labels
content = content.replace('text-xs font-semibold uppercase tracking-wider text-slate-400', 'text-xs font-semibold uppercase tracking-wider text-slate-600')

# 10. Inputs
content = content.replace('bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 transition-all shadow-inner', 'bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all shadow-sm')

content = content.replace('bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 transition-all shadow-inner', 'bg-white border border-slate-200 rounded-xl pl-10 pr-11 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all shadow-sm')

# 11. Password toggle
content = content.replace('text-slate-500 hover:text-slate-300', 'text-slate-400 hover:text-slate-600')

# 12. Button
content = content.replace('bg-gradient-to-r from-[#FF1A4B] via-[#FF5E3A] to-[#F59E0B] text-white font-bold text-sm hover:opacity-95 active:scale-[0.99] transition-all duration-200 shadow-xl shadow-[#FF1A4B]/20', 'bg-indigo-600 border border-indigo-700 text-white font-bold text-sm hover:bg-indigo-700 active:scale-[0.99] transition-all duration-200 shadow-lg shadow-indigo-600/20')

# Ensure "Provided by Admin" has correct text-slate-500 (already exists, but check if we need adjustments)
# <span className="text-xs text-slate-500 cursor-default"> Provided by Admin </span> -> good.

with open('frontend/src/pages/Login.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
