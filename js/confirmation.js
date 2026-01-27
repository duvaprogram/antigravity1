// ========================================
// Confirmation Module (Async - Supabase)
// ========================================

const ConfirmationModule = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        const form = document.getElementById('formConfirmation');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveRecord();
            });

            // Live calculation
            const inputs = ['confTotal', 'confConfirmed', 'confDuplicates', 'confCancelled', 'confCancelledClient'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', () => this.calculatePreview());
                }
            });
        }
    },

    async render() {
        await this.updateTables();

        // Set date to today if empty
        const dateInput = document.getElementById('confDate');
        if (dateInput && !dateInput.value) {
            dateInput.valueAsDate = new Date();
        }

        this.calculatePreview();
    },

    calculatePreview() {
        const totalInput = document.getElementById('confTotal');
        const confirmedInput = document.getElementById('confConfirmed');
        const duplicatesInput = document.getElementById('confDuplicates');
        const cancelledInput = document.getElementById('confCancelled');

        const total = parseFloat(totalInput ? totalInput.value : 0) || 0;
        const confirmed = parseFloat(confirmedInput ? confirmedInput.value : 0) || 0;
        const duplicates = parseFloat(duplicatesInput ? duplicatesInput.value : 0) || 0;
        const cancelled = parseFloat(cancelledInput ? cancelledInput.value : 0) || 0;

        // Gross Percentage
        const percentage = total > 0 ? ((confirmed / total) * 100).toFixed(1) : 0;

        // Net Effectiveness
        const netTotal = total - duplicates - cancelled;
        let netPercentage = 0;
        if (netTotal > 0) {
            netPercentage = ((confirmed / netTotal) * 100).toFixed(1);
        }

        // Update Displays
        const display = document.getElementById('confPercentageValue');
        const detail = document.getElementById('confStatsDetail');
        const netDisplay = document.getElementById('confNetPercentageValue');

        if (display) {
            display.textContent = `${percentage}%`;
            this.stylePercentage(display, percentage);
        }

        if (detail) {
            detail.textContent = `${confirmed} / ${total} Confirmados`;
        }

        if (netDisplay) {
            netDisplay.textContent = `${netPercentage}%`;
            this.stylePercentage(netDisplay, netPercentage);
        }
    },

    stylePercentage(element, value) {
        if (value >= 80) element.style.color = 'var(--success)';
        else if (value >= 50) element.style.color = 'var(--warning)';
        else element.style.color = 'var(--danger)';
    },

    async saveRecord() {
        const date = document.getElementById('confDate').value;
        const page = document.getElementById('confPage').value;
        const totalOrders = parseInt(document.getElementById('confTotal').value);
        const confirmed = parseInt(document.getElementById('confConfirmed').value);
        const duplicates = parseInt(document.getElementById('confDuplicates').value) || 0;
        const cancelledCoverage = parseInt(document.getElementById('confCancelled').value) || 0;
        const cancelledClient = parseInt(document.getElementById('confCancelledClient').value) || 0;

        if (!date || !page || !totalOrders && totalOrders !== 0) {
            Utils.showToast('Por favor complete los campos requeridos', 'error');
            return;
        }

        const record = {
            date,
            page,
            totalOrders,
            confirmed,
            duplicates,
            cancelledCoverage,
            cancelledClient
        };

        try {
            await Database.saveConfirmation(record);
            Utils.showToast('Registro guardado exitosamente', 'success');

            // Clear numeric inputs
            ['confTotal', 'confConfirmed', 'confDuplicates', 'confCancelled', 'confCancelledClient']
                .forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.value = (id === 'confTotal' || id === 'confConfirmed') ? '' : '0';
                    }
                });

            await this.updateTables();
            this.calculatePreview();
        } catch (error) {
            console.error('Error saving confirmation:', error);
            Utils.showToast('Error al guardar el registro', 'error');
        }
    },

    async updateTables() {
        const records = await Database.getConfirmations();

        // Sort by date desc
        records.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));

        // Full History
        const historyBody = document.getElementById('confHistoryTable');
        if (historyBody) {
            historyBody.innerHTML = records.length ? records.map(r => `
                <tr>
                    <td>${r.date}</td>
                    <td>${r.page}</td>
                    <td>${r.totalOrders}</td>
                    <td>${r.confirmed}</td>
                    <td>${r.duplicates}</td>
                    <td>${r.cancelledCoverage}</td>
                    <td>${r.cancelledClient || 0}</td>
                    <td>
                        <span class="status-badge ${this.getPercentageClass(r.grossPercentage)}">
                            ${r.grossPercentage}%
                        </span>
                    </td>
                    <td>
                        <span class="status-badge ${this.getPercentageClass(r.netPercentage || 0)}">
                            ${r.netPercentage || 0}%
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-icon btn-danger btn-sm" onclick="ConfirmationModule.deleteRecord('${r.id}')" title="Eliminar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `).join('') : '<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay registros de confirmación</td></tr>';
        }

        // Preview (Recent)
        const previewBody = document.getElementById('confPreviewTable');
        if (previewBody) {
            previewBody.innerHTML = records.length ? records.slice(0, 5).map(r => `
                <tr>
                    <td>${r.date}</td>
                    <td>${r.page}</td>
                    <td style="font-weight: bold; color: ${this.getPercentageColor(r.grossPercentage)}">${r.grossPercentage}%</td>
                </tr>
            `).join('') : '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Sin datos</td></tr>';
        }
    },

    async deleteRecord(id) {
        if (confirm('¿Está seguro de eliminar este registro?')) {
            try {
                await Database.deleteConfirmation(id);
                await this.updateTables();
                Utils.showToast('Registro eliminado');
            } catch (error) {
                console.error('Error deleting confirmation:', error);
                Utils.showToast('Error al eliminar el registro', 'error');
            }
        }
    },

    getPercentageClass(p) {
        if (p >= 80) return 'status-delivered';
        if (p >= 50) return 'status-transit';
        return 'status-cancelled';
    },

    getPercentageColor(p) {
        if (p >= 80) return 'var(--success)';
        if (p >= 50) return 'var(--warning)';
        return 'var(--danger)';
    }
};

window.ConfirmationModule = ConfirmationModule;
