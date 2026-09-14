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
        div.textContent = text || '';
        return div.innerHTML;
    }
};

// ========================================
// Multi-Select Dropdown Checklist Component
// ========================================
class MultiSelectDropdown {
    constructor(options = {}) {
        this.container = typeof options.container === 'string' 
            ? document.querySelector(options.container) 
            : options.container;
            
        if (!this.container) {
            console.error('MultiSelectDropdown: Container not found', options.container);
            return;
        }

        this.id = options.id || ('ms_' + Math.random().toString(36).substr(2, 9));
        this.placeholder = options.placeholder || 'Seleccionar...';
        this.allSelectedText = options.allSelectedText || 'Todos';
        this.noneSelectedText = options.noneSelectedText || 'Ninguno';
        this.searchable = options.searchable !== false;
        this.searchPlaceholder = options.searchPlaceholder || 'Buscar...';
        this.items = options.items || []; // Array of { value, label, subtitle }
        this.selectedValues = new Set(options.selected || []);
        this.defaultAll = options.defaultAll !== false;
        this.onChange = options.onChange || (() => {});
        this.searchQuery = '';

        // If defaultAll and no specific selection provided, select all
        if (this.defaultAll && (!options.selected || options.selected.length === 0)) {
            this.selectedValues = new Set(this.items.map(i => String(i.value)));
        }

        this.init();
    }

    init() {
        this.container.classList.add('multiselect-container');
        this.render();
        this.bindEvents();
        this.updateTriggerText();
    }

    render() {
        this.container.innerHTML = `
            <div class="multiselect-trigger" id="${this.id}_trigger" tabindex="0" role="button" aria-haspopup="listbox">
                <span class="multiselect-trigger-text" id="${this.id}_text">${Utils.escapeHtml(this.placeholder)}</span>
                <svg class="multiselect-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
            <div class="multiselect-dropdown" id="${this.id}_dropdown">
                ${this.searchable ? `
                <div class="multiselect-search-box">
                    <svg class="multiselect-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" class="multiselect-search-input" id="${this.id}_search" placeholder="${Utils.escapeHtml(this.searchPlaceholder)}" autocomplete="off">
                </div>` : ''}
                <div class="multiselect-actions">
                    <button type="button" class="multiselect-btn-action" id="${this.id}_selectAll">Marcar todos</button>
                    <span style="color: var(--text-muted); font-size: 0.7rem;" id="${this.id}_countInfo">0/0</span>
                    <button type="button" class="multiselect-btn-action" id="${this.id}_deselectAll">Desmarcar</button>
                </div>
                <div class="multiselect-options-list" id="${this.id}_list">
                    ${this.renderOptionsHtml()}
                </div>
            </div>
        `;
    }

    renderOptionsHtml() {
        const query = this.searchQuery.toLowerCase().trim();
        const filtered = this.items.filter(item => {
            if (!query) return true;
            const labelMatch = (item.label || '').toLowerCase().includes(query);
            const subMatch = (item.subtitle || '').toLowerCase().includes(query);
            const valMatch = String(item.value || '').toLowerCase().includes(query);
            return labelMatch || subMatch || valMatch;
        });

        if (filtered.length === 0) {
            return `<div class="multiselect-empty">No se encontraron resultados</div>`;
        }

        return filtered.map(item => {
            const isChecked = this.selectedValues.has(String(item.value));
            return `
                <label class="multiselect-item" data-val="${Utils.escapeHtml(String(item.value))}">
                    <input type="checkbox" value="${Utils.escapeHtml(String(item.value))}" ${isChecked ? 'checked' : ''}>
                    <div class="multiselect-item-content">
                        <span class="multiselect-item-title">${Utils.escapeHtml(item.label)}</span>
                        ${item.subtitle ? `<span class="multiselect-item-subtitle">${Utils.escapeHtml(item.subtitle)}</span>` : ''}
                    </div>
                </label>
            `;
        }).join('');
    }

    bindEvents() {
        const trigger = this.container.querySelector('.multiselect-trigger');
        const dropdown = this.container.querySelector('.multiselect-dropdown');
        const searchInput = this.container.querySelector('.multiselect-search-input');
        const selectAllBtn = this.container.querySelector(`#${this.id}_selectAll`);
        const deselectAllBtn = this.container.querySelector(`#${this.id}_deselectAll`);
        const list = this.container.querySelector('.multiselect-options-list');

        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });

        // Search input
        if (searchInput) {
            searchInput.addEventListener('click', (e) => e.stopPropagation());
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                list.innerHTML = this.renderOptionsHtml();
                this.updateCountInfo();
            });
        }

        // List item click (delegation)
        // List item checkbox change (delegation)
        list.addEventListener('change', (e) => {
            const checkbox = e.target.closest('input[type="checkbox"]');
            if (!checkbox) return;

            const val = String(checkbox.value);
            if (checkbox.checked) {
                this.selectedValues.add(val);
            } else {
                this.selectedValues.delete(val);
            }

            this.updateTriggerText();
            this.updateCountInfo();
            this.onChange(this.getSelected(), this);
        });

        // Select all / visible
        selectAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const query = this.searchQuery.toLowerCase().trim();
            if (query) {
                // Select only visible matching items
                this.items.forEach(item => {
                    const labelMatch = (item.label || '').toLowerCase().includes(query);
                    const subMatch = (item.subtitle || '').toLowerCase().includes(query);
                    if (labelMatch || subMatch) {
                        this.selectedValues.add(String(item.value));
                    }
                });
            } else {
                // Select all
                this.selectedValues = new Set(this.items.map(i => String(i.value)));
            }

            list.innerHTML = this.renderOptionsHtml();
            this.updateTriggerText();
            this.updateCountInfo();
            this.onChange(this.getSelected(), this);
        });

        // Deselect all / visible
        deselectAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const query = this.searchQuery.toLowerCase().trim();
            if (query) {
                // Deselect only visible matching items
                this.items.forEach(item => {
                    const labelMatch = (item.label || '').toLowerCase().includes(query);
                    const subMatch = (item.subtitle || '').toLowerCase().includes(query);
                    if (labelMatch || subMatch) {
                        this.selectedValues.delete(String(item.value));
                    }
                });
            } else {
                // Deselect all
                this.selectedValues.clear();
            }

            list.innerHTML = this.renderOptionsHtml();
            this.updateTriggerText();
            this.updateCountInfo();
            this.onChange(this.getSelected(), this);
        });

        // Click outside listener
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });
    }

    toggle() {
        if (this.container.classList.contains('open')) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        // Close other multiselects first
        document.querySelectorAll('.multiselect-container.open').forEach(el => {
            if (el !== this.container) el.classList.remove('open');
        });

        this.container.classList.add('open');
        const trigger = this.container.querySelector('.multiselect-trigger');
        if (trigger) trigger.classList.add('active');

        // Elevate parent card to ensure it stays above all sibling elements
        const parentCard = this.container.closest('.card');
        if (parentCard) {
            parentCard.style.overflow = 'visible';
            parentCard.style.zIndex = '150';
            parentCard.style.position = 'relative';
        }

        // Check if dropdown would overflow the right edge of viewport
        const dropdown = this.container.querySelector('.multiselect-dropdown');
        if (dropdown) {
            const rect = this.container.getBoundingClientRect();
            if (rect.left + 300 > window.innerWidth) {
                dropdown.style.left = 'auto';
                dropdown.style.right = '0';
            } else {
                dropdown.style.left = '0';
                dropdown.style.right = 'auto';
            }
        }

        // Focus search input
        const searchInput = this.container.querySelector('.multiselect-search-input');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 50);
        }
        this.updateCountInfo();
    }

    close() {
        this.container.classList.remove('open');
        const trigger = this.container.querySelector('.multiselect-trigger');
        if (trigger) trigger.classList.remove('active');

        // Restore card z-index if no other multiselect is open
        const anyOpen = document.querySelectorAll('.multiselect-container.open').length > 0;
        if (!anyOpen) {
            const parentCard = this.container.closest('.card');
            if (parentCard) {
                parentCard.style.zIndex = '50';
            }
        }
    }

    updateCountInfo() {
        const countSpan = this.container.querySelector(`#${this.id}_countInfo`);
        if (!countSpan) return;
        const total = this.items.length;
        const selected = this.selectedValues.size;
        countSpan.textContent = `${selected}/${total}`;
    }

    updateTriggerText() {
        const textEl = this.container.querySelector(`#${this.id}_text`);
        if (!textEl) return;

        const total = this.items.length;
        const selected = this.selectedValues.size;

        if (total === 0) {
            textEl.innerHTML = Utils.escapeHtml(this.placeholder);
            return;
        }

        if (selected === 0) {
            textEl.innerHTML = `<span style="color: var(--text-muted);">${Utils.escapeHtml(this.noneSelectedText)}</span>`;
        } else if (selected === total) {
            textEl.innerHTML = `<strong>${Utils.escapeHtml(this.allSelectedText)}</strong> <span class="multiselect-badge" style="background: rgba(99, 102, 241, 0.2); color: var(--primary);">${total}</span>`;
        } else if (selected === 1) {
            const singleVal = Array.from(this.selectedValues)[0];
            const item = this.items.find(i => String(i.value) === String(singleVal));
            const label = item ? item.label : singleVal;
            textEl.innerHTML = `<span>${Utils.escapeHtml(label)}</span>`;
        } else if (selected <= 2) {
            const selectedItems = this.items.filter(i => this.selectedValues.has(String(i.value)));
            const labels = selectedItems.map(i => i.label).join(', ');
            textEl.innerHTML = `<span>${Utils.escapeHtml(labels)}</span> <span class="multiselect-badge">${selected}</span>`;
        } else {
            textEl.innerHTML = `<span>${selected} seleccionados</span> <span class="multiselect-badge">${selected}</span>`;
        }
    }

    setItems(items, keepSelection = true) {
        this.items = items || [];
        if (!keepSelection || this.selectedValues.size === 0) {
            if (this.defaultAll) {
                this.selectedValues = new Set(this.items.map(i => String(i.value)));
            } else {
                this.selectedValues.clear();
            }
        } else {
            // Filter out selected values that no longer exist
            const validValues = new Set(this.items.map(i => String(i.value)));
            const newSelection = new Set();
            this.selectedValues.forEach(val => {
                if (validValues.has(val)) newSelection.add(val);
            });
            this.selectedValues = newSelection;
        }

        const list = this.container.querySelector('.multiselect-options-list');
        if (list) {
            list.innerHTML = this.renderOptionsHtml();
        }
        this.updateTriggerText();
        this.updateCountInfo();
    }

    setSelected(values, triggerChange = true) {
        this.selectedValues = new Set((values || []).map(v => String(v)));
        const list = this.container.querySelector('.multiselect-options-list');
        if (list) {
            list.innerHTML = this.renderOptionsHtml();
        }
        this.updateTriggerText();
        this.updateCountInfo();
        if (triggerChange) {
            this.onChange(this.getSelected(), this);
        }
    }

    selectAll(triggerChange = true) {
        this.selectedValues = new Set(this.items.map(i => String(i.value)));
        const list = this.container.querySelector('.multiselect-options-list');
        if (list) {
            list.innerHTML = this.renderOptionsHtml();
        }
        this.updateTriggerText();
        this.updateCountInfo();
        if (triggerChange) {
            this.onChange(this.getSelected(), this);
        }
    }

    deselectAll(triggerChange = true) {
        this.selectedValues.clear();
        const list = this.container.querySelector('.multiselect-options-list');
        if (list) {
            list.innerHTML = this.renderOptionsHtml();
        }
        this.updateTriggerText();
        this.updateCountInfo();
        if (triggerChange) {
            this.onChange(this.getSelected(), this);
        }
    }

    getSelected() {
        return Array.from(this.selectedValues);
    }

    isAllSelected() {
        return this.items.length > 0 && this.selectedValues.size === this.items.length;
    }
}

// Make Utils and MultiSelectDropdown available globally
window.Utils = Utils;
window.MultiSelectDropdown = MultiSelectDropdown;

