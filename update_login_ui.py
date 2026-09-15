import re

with open("PhotoGuard_App/frontend/src/App.tsx", "r") as f:
    content = f.read()

new_login_return = """  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg bg-neutral-900 rounded-3xl border border-neutral-800 p-8 sm:p-10 shadow-2xl mb-6">
        
        {/* Header Section */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-20 h-20 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mb-5">
            <Shield size={40} />
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">PhotoGuard Studio</h1>
          <p className="text-neutral-400 mt-3 text-sm max-w-sm">
            The ultimate anti-piracy platform built exclusively for professional photographers.
          </p>
        </div>

        {/* Features / Bullet Points */}
        <div className="space-y-3 mb-10">
          <div className="flex items-start space-x-3 text-sm text-neutral-300 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50">
            <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
            <span><strong className="text-white font-medium">Absolute Anti-Piracy:</strong> 100% screenshot and screen-record prevention on client devices.</span>
          </div>
          <div className="flex items-start space-x-3 text-sm text-neutral-300 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50">
            <CheckCircle2 size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <span><strong className="text-white font-medium">Secure Delivery:</strong> Fast batch uploads with local RAM compression and access codes.</span>
          </div>
          <div className="flex items-start space-x-3 text-sm text-neutral-300 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50">
            <CheckCircle2 size={18} className="text-yellow-500 flex-shrink-0 mt-0.5" />
            <span><strong className="text-white font-medium">Auto-Cleanup:</strong> Expiring albums and automatic cloud storage purging.</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm mb-6 border border-red-500/20 text-center">{error}</div>}

        {/* Login Action */}
        <div>
          <button
            type="button"
            onClick={handleTelegramLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#24A1DE] hover:bg-[#1d8dbf] text-white font-medium py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-blue-900/20"
          >
            <Send size={20} />
            <span>Log in with Telegram</span>
          </button>
          <p className="text-center text-neutral-600 text-xs mt-5">Strictly For Authorized Photographers Only</p>
        </div>

      </div>
    </div>
  );
}
"""

content = re.sub(r'  return \(\n    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4">.*?  \);\n\}', new_login_return, content, flags=re.DOTALL)

with open("PhotoGuard_App/frontend/src/App.tsx", "w") as f:
    f.write(content)
