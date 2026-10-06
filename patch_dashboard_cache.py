import os

with open("frontend/src/pages/DashboardHome.jsx", "r", encoding="utf-8") as f:
    content = f.read()

old_use_effect = """  useEffect(() => {
    if (!isAdmin || viewAsPhotographer) {
      if (currentTab === "albums") {
        fetchAlbums();
      }
    }
  }, [isAdmin, viewAsPhotographer, currentTab]);"""

new_use_effect = """  useEffect(() => {
    if (!isAdmin || viewAsPhotographer) {
      // Only show loading spinner on initial mount or if empty
      const isBackground = albums.length > 0;
      if (!isBackground) setLoading(true);
      
      api.get("/api/v1/albums")
        .then(response => {
          setAlbums(response.data || []);
        })
        .catch(err => {
          if (!isBackground) setError(err.response?.data?.detail || "Failed to load client albums. Please try again.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, viewAsPhotographer, currentTab]);"""

# Replace it
if old_use_effect in content:
    content = content.replace(old_use_effect, new_use_effect)
    with open("frontend/src/pages/DashboardHome.jsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched DashboardHome caching logic!")
else:
    print("Could not find the useEffect block.")
