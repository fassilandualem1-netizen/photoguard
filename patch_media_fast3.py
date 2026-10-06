import os

filepath = "app/api/media.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

sig_rl = """    # RATE-01: 30 signatures per user per minute
    is_limited, retry_after = check_generic_rate_limit(f"rate:signature:user:{current_user.id}", 30, 60)
    if is_limited:
        raise HTTPException(status_code=429, detail=f"Too many signature requests. Try again in {retry_after}s.")"""

save_rl = """    # RATE-01: 120 saves per user per minute
    is_limited, retry_after = check_generic_rate_limit(f"rate:saveurl:user:{current_user.id}", 120, 60)
    if is_limited:
        raise HTTPException(status_code=429, detail=f"Too many save requests. Try again in {retry_after}s.")"""

content = content.replace(sig_rl, "")
content = content.replace(save_rl, "")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Removed remaining media rate limits.")
