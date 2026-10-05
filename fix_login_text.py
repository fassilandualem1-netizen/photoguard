import re

with open('frontend/src/pages/Login.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'Enter your credentials to access your console',
    'Manage your clients, albums, and proofs.'
)

with open('frontend/src/pages/Login.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
