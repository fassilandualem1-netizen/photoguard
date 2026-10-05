import sys
sys.stdout.reconfigure(encoding="utf-8")

fixes = [
    # AlbumDetail: rawTargetPhotos.map - this is a computed array, safe if guarded
    ("frontend/src/pages/AlbumDetail.jsx",
     "const preparedDownloads = rawTargetPhotos.map(",
     "const preparedDownloads = (Array.isArray(rawTargetPhotos) ? rawTargetPhotos : []).map("),

    # AlbumDetail: displayPhotos.map in JSX
    ("frontend/src/pages/AlbumDetail.jsx",
     "{displayPhotos.map((item) => {",
     "{(Array.isArray(displayPhotos) ? displayPhotos : []).map((item) => {"),

    # DashboardLayout: navItems is a static const - safe. Skip.
    # StudioBrandingView: BRAND_COLOR_PRESETS is static const - safe. Skip.

    # DashboardHome: filteredAlbums.map
    ("frontend/src/pages/DashboardHome.jsx",
     "{filteredAlbums.map((album) => (",
     "{(Array.isArray(filteredAlbums) ? filteredAlbums : []).map((album) => ("),

    ("frontend/src/pages/DashboardHome.jsx",
     "{filteredAlbums.map((album) => {",
     "{(Array.isArray(filteredAlbums) ? filteredAlbums : []).map((album) => {"),

    # StudioAssistantsView: assistants.map
    ("frontend/src/components/StudioAssistantsView.jsx",
     "{assistants.map((asst) => (",
     "{(Array.isArray(assistants) ? assistants : []).map((asst) => ("),
]

for filepath, old, new in fixes:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    if old in content:
        content = content.replace(old, new)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[FIXED] {filepath.split('/')[-1]}: {old[:60]}...")
    else:
        print(f"[SKIP]  {filepath.split('/')[-1]}: pattern not found - {old[:60]}...")
