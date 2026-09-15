import re

with open("PhotoGuard_App/frontend/src/App.tsx", "r") as f:
    content = f.read()

# 1. Remove Client Access Code Entry
client_access_regex = re.compile(r'\{\s*/\*\s*Client Access Code Entry\s*\*/\s*\}.*?(?=\s*</div>\s*</div>\s*\);)', re.DOTALL)
replacement_client_access = """{/* Client Access Removed for Security */}
      <div className="w-full max-w-md mt-6 p-6 bg-neutral-900/50 rounded-2xl border border-neutral-800 text-center">
        <h3 className="text-white font-medium mb-2">Are you a Client?</h3>
        <p className="text-neutral-400 text-sm mb-4">
          To ensure maximum security and privacy, client galleries are only accessible via the PhotoGuard Mobile App.
        </p>
        <div className="flex gap-4 justify-center">
          <span className="text-xs bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-md">Android</span>
          <span className="text-xs bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-md">iOS</span>
        </div>
      </div>
"""
content = client_access_regex.sub(replacement_client_access, content)

# 2. Remove handleClientAccess function
handle_client_access_regex = re.compile(r'const handleClientAccess = \(e: React\.FormEvent\) => \{.*?\};\n', re.DOTALL)
content = handle_client_access_regex.sub('', content)

# 3. Remove accessCode state
content = content.replace("const [accessCode, setAccessCode] = useState('');\n", "")

# 4. Remove Route for client gallery
content = content.replace('<Route path="/client/:code" element={<ClientGallery />} />', '')

# 5. Remove ClientGallery function
client_gallery_regex = re.compile(r'function ClientGallery\(\) \{.*?(?=\n// -{20,}\n// Login Component)', re.DOTALL)
content = client_gallery_regex.sub('', content)

with open("PhotoGuard_App/frontend/src/App.tsx", "w") as f:
    f.write(content)
