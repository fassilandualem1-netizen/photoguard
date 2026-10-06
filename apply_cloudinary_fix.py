import os

with open("app/core/storage.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

out_lines = []
in_target_func = False
for line in lines:
    if line.startswith("def generate_signed_clean_url"):
        in_target_func = True
        
        # Inject the new function
        new_func = """def generate_signed_clean_url(raw_url: str) -> str:
    \"\"\"
    Generates a cryptographically signed delivery URL with light compression.
    Backward compatible with legacy (type='upload') images.
    \"\"\"
    if not is_cloudinary_configured() or "res.cloudinary.com" not in raw_url:
        return ""
    try:
        import cloudinary.utils
        
        # Dynamically determine the asset type (backward compatibility)
        asset_type = "authenticated" if "/authenticated/" in raw_url else "upload"
        
        if asset_type == "authenticated":
            parts = raw_url.split("/authenticated/")[-1].split("/")
        else:
            parts = raw_url.split("/upload/")[-1].split("/")
            
        clean_parts = [
            p for p in parts
            if not p.startswith("v") and not (
                p.startswith("c_") or p.startswith("w_") or p.startswith("q_") or p.startswith("s--") or p.startswith("l_") or p.startswith("f_")
            )
        ]
        full_path = "/".join(clean_parts)
        public_id = os.path.splitext(full_path)[0]

        transformation = [
            {"width": 1200, "crop": "limit", "quality": "auto:good", "fetch_format": "auto"}
        ]
        signed_url, _ = cloudinary.utils.cloudinary_url(
            public_id,
            resource_type="image",
            type=asset_type,
            transformation=transformation,
            sign_url=True,
            secure=True
        )
        return signed_url
    except Exception as exc:
        logger.warning(f"[Storage] Could not generate signed Cloudinary URL: {exc}")
        return raw_url
"""
        out_lines.append(new_func)
        continue
        
    if in_target_func:
        # Skip until the next top-level function definition
        if line.startswith("def generate_s3_presigned_url"):
            in_target_func = False
            out_lines.append(line)
    else:
        out_lines.append(line)

with open("app/core/storage.py", "w", encoding="utf-8") as f:
    f.writelines(out_lines)

print("Cloudinary fix applied!")
