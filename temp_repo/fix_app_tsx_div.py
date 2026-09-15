import re

with open("PhotoGuard_App/frontend/src/App.tsx", "r") as f:
    content = f.read()

# Fix the extra div in Login component
broken_ending = """      </div>
      </div>
    </div>
  );
}"""

fixed_ending = """      </div>
    </div>
  );
}"""

content = content.replace(broken_ending, fixed_ending)

with open("PhotoGuard_App/frontend/src/App.tsx", "w") as f:
    f.write(content)
