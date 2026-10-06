import os

with open("frontend/src/pages/DashboardHome.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# We need to revert my previous patch and put a better one
old_use_effect_2 = """  useEffect(() => {
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

new_use_effect_good = """  useEffect(() => {
    if (!isAdmin || viewAsPhotographer) {
      if (currentTab === "albums") {
        // Use functional state update or just check the length to avoid hard loading
        setAlbums(prevAlbums => {
          const isBackground = prevAlbums.length > 0;
          if (!isBackground) setLoading(true);
          
          api.get("/api/v1/albums")
            .then(response => {
              setAlbums(response.data || []);
            })
            .catch(err => {
              if (!isBackground) setError(err.response?.data?.detail || "Failed to load client albums.");
            })
            .finally(() => {
              setLoading(false);
            });
            
          return prevAlbums; // Don't actually change state here, just using it to get current value
        });
      }
    }
  }, [isAdmin, viewAsPhotographer, currentTab]);"""

if old_use_effect_2 in content:
    content = content.replace(old_use_effect_2, new_use_effect_good)
    with open("frontend/src/pages/DashboardHome.jsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched DashboardHome caching logic PROPERLY!")
else:
    print("Could not find the useEffect block 2.")
