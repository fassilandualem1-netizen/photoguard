import re

with open("frontend/src/pages/AlbumDetail.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add uploadError state
content = content.replace(
    "const [lastUploadSummary, setLastUploadSummary] = useState(null);",
    "const [lastUploadSummary, setLastUploadSummary] = useState(null);\n  const [uploadError, setUploadError] = useState(null);"
)

# 2. Clear uploadError when starting
content = content.replace(
    "setLastUploadSummary(null);\n      setUploadProgress({ current: 0, total: fileList.length });",
    "setLastUploadSummary(null);\n      setUploadError(null);\n      setUploadProgress({ current: 0, total: fileList.length });"
)

# 3. Catch signature fetch error and set uploadError
content = content.replace(
    'console.warn("Direct-to-cloud signature unavailable, fallback to backend proxy.", err);',
    'console.warn("Direct-to-cloud signature unavailable, fallback to backend proxy.", err);\n        if (!navigator.onLine) {\n          setUploadError("You appear to be offline. Please check your internet connection.");\n          setUploading(false);\n          return;\n        }'
)

# 4. Pass uploadError to PhotoUploader component
content = content.replace(
    "onFileUpload={handleFileUpload}\n        />",
    "onFileUpload={handleFileUpload}\n          uploadError={uploadError}\n        />"
)

with open("frontend/src/pages/AlbumDetail.jsx", "w", encoding="utf-8") as f:
    f.write(content)
