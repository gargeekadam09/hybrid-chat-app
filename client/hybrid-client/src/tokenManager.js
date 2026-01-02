// Token management utilities
export const tokenManager = {
  // Save token to localStorage
  saveToken: (token) => {
    localStorage.setItem('chatAppToken', token);
  },

  // Get token from localStorage
  getToken: () => {
    return localStorage.getItem('chatAppToken');
  },

  // Remove token from localStorage
  removeToken: () => {
    localStorage.removeItem('chatAppToken');
  },

  // Check if token exists
  hasToken: () => {
    return !!localStorage.getItem('chatAppToken');
  },

  // Decode token to get user info (without verification)
  decodeToken: (token) => {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (error) {
      return null;
    }
  },

  // Check if token is expired
  isTokenExpired: (token) => {
    const decoded = tokenManager.decodeToken(token);
    if (!decoded) return true;
    
    const currentTime = Date.now() / 1000;
    return decoded.exp < currentTime;
  }
};