(function () {
    // Centralized configuration for the frontend
    const API_URL = window.location.origin;

    const config = { API_URL };

    if (typeof window !== 'undefined') {
        window.APP_CONFIG = config;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = config;
    }
})();
