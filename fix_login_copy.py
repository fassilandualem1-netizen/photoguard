import re

with open("PhotoGuard_App/frontend/src/App.tsx", "r") as f:
    content = f.read()

# Replace the specific bullet points block
old_bullets = """        {/* Features / Bullet Points */}
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
        </div>"""

new_bullets = """        {/* Features / Bullet Points */}
        <div className="space-y-3 mb-10">
          <div className="flex items-start space-x-3 text-sm text-neutral-300 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50">
            <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
            <span><strong className="text-white font-medium">Absolute Anti-Piracy:</strong> 100% screenshot and screen-record prevention on client devices.</span>
          </div>
          <div className="flex items-start space-x-3 text-sm text-neutral-300 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50">
            <CheckCircle2 size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <span><strong className="text-white font-medium">Elegant Client Experience:</strong> Deliver photos through a premium, fast-loading mobile gallery that boosts your brand.</span>
          </div>
          <div className="flex items-start space-x-3 text-sm text-neutral-300 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50">
            <CheckCircle2 size={18} className="text-yellow-500 flex-shrink-0 mt-0.5" />
            <span><strong className="text-white font-medium">Streamlined Workflow:</strong> Track client photo selections instantly and manage access with secure PIN codes.</span>
          </div>
        </div>"""

content = content.replace(old_bullets, new_bullets)

with open("PhotoGuard_App/frontend/src/App.tsx", "w") as f:
    f.write(content)
