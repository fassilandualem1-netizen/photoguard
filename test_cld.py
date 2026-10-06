raw_url1 = "https://res.cloudinary.com/demo/image/upload/v1234/folder/id.jpg"
raw_url2 = "https://res.cloudinary.com/demo/image/authenticated/v1234/folder/id.jpg"

def get_public_id(raw_url):
    if "/upload/" in raw_url:
        parts = raw_url.split("/upload/")[-1].split("/")
    elif "/authenticated/" in raw_url:
        parts = raw_url.split("/authenticated/")[-1].split("/")
    else:
        parts = raw_url.split("/")[-1:]
    
    clean_parts = [
        p for p in parts
        if not p.startswith("v") and not (
            p.startswith("c_") or p.startswith("w_") or p.startswith("q_") or p.startswith("s--") or p.startswith("l_") or p.startswith("f_")
        )
    ]
    full_path = "/".join(clean_parts)
    import os
    return os.path.splitext(full_path)[0]

print("Upload public_id:", get_public_id(raw_url1))
print("Auth public_id:", get_public_id(raw_url2))
