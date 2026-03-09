(function () {
    // Centralized configuration for the frontend
    // If we're on GitHub Pages, we use the injected RENDER_BACKEND_URL
    // Otherwise, we default to the current origin (usually localhost)

    let API_URL = window.location.origin;

    // The __BACKEND_URL_PLACEHOLDER__ string is replaced during the GitHub Actions build process
    const productionUrl = '__BACKEND_URL_PLACEHOLDER__';

    if (productionUrl && !productionUrl.startsWith('__')) {
        API_URL = productionUrl;
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Local development: point to the server port
        API_URL = 'http://localhost:3000';
    }

    const config = { API_URL };

    if (typeof window !== 'undefined') {
        window.APP_CONFIG = config;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = config;
    }
})();
