with open("PhotoGuard_App/frontend/src/App.tsx", "r") as f:
    lines = f.readlines()

output = []
for i in range(len(lines)):
    # lines 104 and 105 are the extra divs
    if i == 104 or i == 105:
        if "</div>" in lines[i]:
            continue
    output.append(lines[i])

with open("PhotoGuard_App/frontend/src/App.tsx", "w") as f:
    f.writelines(output)
