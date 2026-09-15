export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface ApiOptions extends RequestInit {
  requireAuth?: boolean;
}

export async function apiFetch(endpoint: string, options: ApiOptions = {}) {
  const { requireAuth = true, headers, ...customOptions } = options;
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (requireAuth) {
    // Assuming you store the user in localStorage when onLogin is called
    // or we can grab the token from a secure place
    const storedUserStr = localStorage.getItem('photoguard_user');
    if (storedUserStr) {
      const storedUser = JSON.parse(storedUserStr);
      if (storedUser.token) {
        defaultHeaders['Authorization'] = `Bearer ${storedUser.token}`;
      }
    }
  }

  // Remove Content-Type if FormData is used, so the browser sets the multipart boundary automatically
  if (customOptions.body instanceof FormData) {
    delete defaultHeaders['Content-Type'];
  }

  const finalOptions: RequestInit = {
    ...customOptions,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, finalOptions);
    
    if (response.status === 401) {
      // Global 401 Unauthorized handling
      console.error("Unauthorized: Session expired or invalid.");
      localStorage.removeItem('photoguard_user');
      window.location.href = '/?error=SessionExpired'; // Redirect to login
      return null;
    }

    if (response.status === 503) {
       console.error("Service Unavailable.");
       alert("The service is temporarily unavailable. Please try again later.");
       return null;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || `API Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    throw error;
  }
}
