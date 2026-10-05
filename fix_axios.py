import re

with open("frontend/src/api/axios.js", "r", encoding="utf-8") as f:
    content = f.read()

# Add better timeout/network error handling in the response interceptor
old = "    return Promise.reject(error);\n  }\n);\n\nexport default api;"

new = """    // Provide human-readable messages for common network failures
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      error.userMessage = "Request timed out. Please check your connection and try again.";
    } else if (!error.response && error.message?.includes("Network Error")) {
      error.userMessage = "Network error. Please check your internet connection.";
    }

    return Promise.reject(error);
  }
);

export default api;"""

content = content.replace(old, new)

with open("frontend/src/api/axios.js", "w", encoding="utf-8") as f:
    f.write(content)
