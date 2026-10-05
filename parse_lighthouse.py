import json

with open("lighthouse_result.json", "r", encoding="utf-8") as f:
    d = json.load(f)

cats = d.get("categories", {})
audits = d.get("audits", {})

print("=== SCORES ===")
for k, v in cats.items():
    score = v.get("score")
    if score is not None:
        print(f'{v["title"]}: {round(score*100)}/100')

print("")
print("=== KEY METRICS ===")
metrics = ["first-contentful-paint","speed-index","largest-contentful-paint","interactive","total-blocking-time","cumulative-layout-shift"]
for m in metrics:
    if m in audits:
        a = audits[m]
        score = a.get("score")
        score_str = f'{round(score*100)}' if score is not None else "N/A"
        print(f'{a["title"]}: {a.get("displayValue","N/A")} (score: {score_str})')

print("")
print("=== TOP OPPORTUNITIES ===")
opps = [(k,v) for k,v in audits.items() if v.get("details", {}).get("type") == "opportunity" and v.get("score", 1) < 0.9]
opps.sort(key=lambda x: x[1].get("score", 1))
for k, v in opps[:8]:
    print(f'- {v["title"]}: {v.get("displayValue","")}')
