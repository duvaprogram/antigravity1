// ========================================
// Utilities Module
// ========================================

const Utils = {
    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Generate guide number
    generateGuideNumber() {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `GD${year}${month}${day}-${random}`;
    },

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-EC', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },

    // Format date
    formatDate(date, includeTime = false) {
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        return new Date(date).toLocaleDateString('es-EC', options);
    },

    // Format date for display (time only)
    formatTime(date) {
        return new Date(date).toLocaleTimeString('es-EC', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Show toast notification
    showToast(message, type = 'info') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ'}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        // Auto remove after 4.5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4500);

        // Manual close
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    },

    // Alias for showToast
    showNotification(message, type = 'info') {
        return this.showToast(message, type);
    },

    // Open modal
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    // Close modal
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    // Get status class
    getStatusClass(status) {
        const classes = {
            'Pendiente': 'pendiente',
            'En ruta': 'en-ruta',
            'Entregado': 'entregado',
            'Pagado': 'pagado',
            'Cancelado': 'cancelado',
            'Devolución': 'devolucion',
            'Novedad': 'novedad'
        };
        return classes[status] || 'pendiente';
    },

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Make Utils available globally
window.Utils = Utils;
