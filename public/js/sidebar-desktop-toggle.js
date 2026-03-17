/**
 * Sidebar Desktop Toggle Module
 * Handles collapsible sidebar for desktop screens (≤1459px)
 * 
 * Features:
 * - Smooth collapse/expand animation
 * - Persistent state in localStorage
 * - Responsive to viewport changes
 * - Only active on desktop (768px - 1459px)
 */

class SidebarDesktopToggle {
    constructor() {
        this.sidebar = document.getElementById('sidebar-desktop');
        this.toggleBtn = document.getElementById('sidebar-desktop-toggle');
        this.mainContent = document.querySelector('main');
        this.storageKey = 'sidebarDesktopState';
        
        // Only initialize on desktop screens
        if (this.isDesktopSmall()) {
            this.init();
        }
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    /**
     * Check if screen is desktop small (768px - 1459px)
     */
    isDesktopSmall() {
        return window.innerWidth >= 768 && window.innerWidth <= 1459;
    }

    /**
     * Initialize the sidebar toggle functionality
     */
    init() {
        if (!this.sidebar || !this.toggleBtn) {
            console.warn('Sidebar or toggle button not found');
            return;
        }

        // Add click listener to toggle button
        this.toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggle();
        });

        // Restore previous state from localStorage
        this.restoreState();

        // Add keyboard shortcut (Ctrl/Cmd + K) to toggle sidebar
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    /**
     * Toggle sidebar state with animation
     */
    toggle() {
        if (!this.sidebar) return;

        const isExpanded = this.sidebar.classList.contains('sidebar-expanded');

        if (isExpanded) {
            this.collapse();
        } else {
            this.expand();
        }

        // Save state to localStorage
        this.saveState();

        // Trigger custom event for other components
        this.dispatchStateChange(!isExpanded);
    }

    /**
     * Expand the sidebar
     */
    expand() {
        if (!this.sidebar) return;
        
        this.sidebar.classList.add('sidebar-expanded');
        
        // Update toggle button - it moves with CSS (left: 252px when expanded)
        if (this.toggleBtn) {
            this.toggleBtn.classList.add('sidebar-expanded');
            const icon = this.toggleBtn.querySelector('i');
            if (icon) {
                icon.style.transform = 'rotate(180deg)';
            }
        }

        // Shift main content: 280px sidebar width - 50px peek = 230px margin
        if (this.mainContent) {
            this.mainContent.style.marginLeft = '230px';
        }

        // Update internal section margins
        this.updateSectionMargins(true);
        
        // Announce to screen readers
        this.announce('Sidebar expandido');
    }

    /**
     * Collapse the sidebar
     */
    collapse() {
        if (!this.sidebar) return;
        
        this.sidebar.classList.remove('sidebar-expanded');
        
        // Update toggle button - it moves back with CSS (left: 242px when collapsed)
        if (this.toggleBtn) {
            this.toggleBtn.classList.remove('sidebar-expanded');
            const icon = this.toggleBtn.querySelector('i');
            if (icon) {
                icon.style.transform = 'rotate(0deg)';
            }
        }

        // Reset main content
        if (this.mainContent) {
            this.mainContent.style.marginLeft = '0';
        }

        // Update internal section margins
        this.updateSectionMargins(false);
        
        // Announce to screen readers
        this.announce('Sidebar contraído');
    }

    /**
     * Update internal section margins based on sidebar state
     * @param {boolean} isExpanded - Whether sidebar is expanded
     */
    updateSectionMargins(isExpanded) {
        // Update all section-content divs
        const sections = document.querySelectorAll('.section-content');
        sections.forEach(section => {
            if (isExpanded) {
                section.style.marginRight = '40px';
            } else {
                section.style.marginRight = '20px';
            }
        });

        // Update all card elements
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            if (isExpanded) {
                card.style.marginRight = '20px';
            } else {
                card.style.marginRight = '0px';
            }
        });

        // Update progress bars and other major components
        const progressContainers = document.querySelectorAll('[class*="progress"], [class*="gantt"], [class*="attendance"]');
        progressContainers.forEach(container => {
            if (isExpanded) {
                container.style.marginRight = '20px';
            } else {
                container.style.marginRight = '0px';
            }
        });
    }

    /**
     * Save current state to localStorage
     */
    saveState() {
        const isExpanded = this.sidebar.classList.contains('sidebar-expanded');
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                expanded: isExpanded,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Could not save sidebar state:', e);
        }
    }

    /**
     * Restore state from localStorage
     */
    restoreState() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const state = JSON.parse(saved);
                if (state.expanded) {
                    this.expand();
                } else {
                    this.collapse();
                }
            } else {
                // Default: collapsed
                this.collapse();
            }
        } catch (e) {
            console.warn('Could not restore sidebar state:', e);
            this.collapse();
        }
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        if (!this.isDesktopSmall()) {
            // If not on desktop small anymore, remove expanded class
            if (this.sidebar) {
                this.sidebar.classList.remove('sidebar-expanded');
            }
            if (this.toggleBtn) {
                this.toggleBtn.classList.remove('sidebar-expanded');
                this.toggleBtn.style.left = '8px';
                this.toggleBtn.style.display = 'none';
                const icon = this.toggleBtn.querySelector('i');
                if (icon) {
                    icon.style.transform = 'rotate(0deg)';
                }
            }
            if (this.mainContent) {
                this.mainContent.style.marginLeft = '';
            }
        }
    }

    /**
     * Dispatch custom event when sidebar state changes
     * @param {boolean} isExpanded - Whether sidebar is now expanded
     */
    dispatchStateChange(isExpanded) {
        const event = new CustomEvent('sidebarStateChange', {
            detail: { isExpanded }
        });
        document.dispatchEvent(event);
    }

    /**
     * Announce state change to screen readers (accessibility)
     * @param {string} message - Message to announce
     */
    announce(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        document.body.appendChild(announcement);

        // Remove after announcement
        setTimeout(() => {
            announcement.remove();
        }, 1000);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.sidebarToggle = new SidebarDesktopToggle();
    });
} else {
    window.sidebarToggle = new SidebarDesktopToggle();
}
