// ========================================
// Journal & Goals Module
// ========================================

const JournalModule = {
    entries: [],
    goals: [],
    weeklyGoals: [],
    principles: { principles: [], rules: [], actions: [], improvements: [] },
    currentMood: null,
    editingGoalId: null,
    editingWeeklyGoalId: null,
    currentWeeklyYear: new Date().getFullYear(),
    currentWeeklyMonth: new Date().getMonth(), // 0-11
    selectedWeekKey: null,

    updateSyncStatus(status, text) {
        const badge = document.getElementById('journalSyncBadge');
        if (!badge) return;
        
        badge.className = `sync-badge sync-${status}`;
        let icon = '';
        if (status === 'success') {
            icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        } else if (status === 'syncing') {
            icon = '<svg class="spin-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>';
        } else {
            icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        }
        badge.innerHTML = `${icon} <span>${text}</span>`;
    },

    async init() {
        await this.loadData();
        this.bindEvents();
        this.renderWeeklyGoals();
    },
    
    restoreSeedData() {
        if (!confirm('¿Estás seguro de querer restaurar el historial original? Esto sobreescribirá tus datos actuales del diario y metas si tienes alguno.')) return;
        
        if (typeof JournalSeedData !== 'undefined') {
            this.entries = [...JournalSeedData.entries];
            this.goals = [...JournalSeedData.goals];
            this.weeklyGoals = [...(JournalSeedData.weeklyGoals || [])];
            this.principles = JSON.parse(JSON.stringify(JournalSeedData.principles));
            this.saveData();
            
            this.renderWeeklyGoals();
            this.renderEntries();
            this.renderGoals();
            this.renderPrinciples();
            
            Utils.showToast('Historial restaurado exitosamente', 'success');
        } else {
            Utils.showToast('Error: No se encontró el archivo de historial', 'error');
        }
    },

    async loadData() {
        const localEntries = JSON.parse(localStorage.getItem('journal_entries') || 'null');
        const localGoals = JSON.parse(localStorage.getItem('journal_goals') || 'null');
        const localWeeklyGoals = JSON.parse(localStorage.getItem('journal_weekly_goals') || 'null');
        const localPrinciples = JSON.parse(localStorage.getItem('journal_principles') || 'null');

        if (!window.supabaseClient || !window.AuthModule || !window.AuthModule.currentUser) {
            this.entries = localEntries || [];
            this.goals = localGoals || [];
            this.weeklyGoals = localWeeklyGoals || [];
            this.principles = localPrinciples || { principles: [], rules: [], actions: [], improvements: [] };
            this.updateSyncStatus('warning', 'Guardado Local (Modo sin conexión)');
            return;
        }

        const userId = window.AuthModule.currentUser.id;
        this.updateSyncStatus('syncing', 'Cargando de Supabase...');

        try {
            const { data, error } = await supabaseClient
                .from('user_journals')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.warn('Advertencia consultando user_journals en Supabase:', error);
                throw error;
            }

            if (data) {
                // Load from DB
                this.entries = data.entries || [];
                this.goals = data.goals || [];
                // Extract weekly goals from direct column, camelCase, principles backup, or local cache
                this.weeklyGoals = data.weekly_goals || data.weeklyGoals || data.principles?._weekly_goals || localWeeklyGoals || [];
                this.principles = data.principles || { principles: [], rules: [], actions: [], improvements: [] };
                
                // Clean internal backup property in memory
                if (this.principles && this.principles._weekly_goals) {
                    delete this.principles._weekly_goals;
                }

                // Update local storage cache
                localStorage.setItem('journal_entries', JSON.stringify(this.entries));
                localStorage.setItem('journal_goals', JSON.stringify(this.goals));
                localStorage.setItem('journal_weekly_goals', JSON.stringify(this.weeklyGoals));
                localStorage.setItem('journal_principles', JSON.stringify(this.principles));

                this.updateSyncStatus('success', 'Sincronizado con Supabase');
            } else {
                // Try to migrate from localStorage or SeedData if DB is empty for this user
                if (localEntries || localGoals || localWeeklyGoals || localPrinciples) {
                    this.entries = localEntries || [];
                    this.goals = localGoals || [];
                    this.weeklyGoals = localWeeklyGoals || [];
                    this.principles = localPrinciples || { principles: [], rules: [], actions: [], improvements: [] };
                    await this.saveData();
                } else if (typeof JournalSeedData !== 'undefined') {
                    this.entries = [...JournalSeedData.entries];
                    this.goals = [...JournalSeedData.goals];
                    this.weeklyGoals = [...(JournalSeedData.weeklyGoals || [])];
                    this.principles = JSON.parse(JSON.stringify(JournalSeedData.principles));
                    await this.saveData();
                } else {
                    this.entries = [];
                    this.goals = [];
                    this.weeklyGoals = [];
                    this.principles = { principles: [], rules: [], actions: [], improvements: [] };
                }
                this.updateSyncStatus('success', 'Sincronizado con Supabase');
            }
        } catch (err) {
            console.error('Error loading journal from DB, using local fallback:', err);
            this.entries = localEntries || [];
            this.goals = localGoals || [];
            this.weeklyGoals = localWeeklyGoals || [];
            this.principles = localPrinciples || { principles: [], rules: [], actions: [], improvements: [] };
            this.updateSyncStatus('warning', 'Guardado Local (Verifique tabla Supabase)');
        }
    },

    async saveData() {
        // Always save to localStorage as backup/offline caching
        localStorage.setItem('journal_entries', JSON.stringify(this.entries));
        localStorage.setItem('journal_goals', JSON.stringify(this.goals));
        localStorage.setItem('journal_weekly_goals', JSON.stringify(this.weeklyGoals));
        localStorage.setItem('journal_principles', JSON.stringify(this.principles));

        if (!window.supabaseClient || !window.AuthModule || !window.AuthModule.currentUser) {
            this.updateSyncStatus('warning', 'Guardado Local (Sin sesión activa)');
            return;
        }
        
        const userId = window.AuthModule.currentUser.id;
        this.updateSyncStatus('syncing', 'Guardando en Supabase...');

        try {
            // Dual persistence: embed _weekly_goals in principles as backup for older schemas
            const principlesToSave = {
                ...this.principles,
                _weekly_goals: this.weeklyGoals
            };

            // Check if record exists for this user
            const { data: existing, error: checkError } = await supabaseClient
                .from('user_journals')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            let saveError = null;

            if (existing && existing.id) {
                // Update existing record
                const { error: updateErr } = await supabaseClient
                    .from('user_journals')
                    .update({
                        entries: this.entries,
                        goals: this.goals,
                        weekly_goals: this.weeklyGoals,
                        principles: principlesToSave,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (updateErr && (updateErr.message?.includes('weekly_goals') || updateErr.code === '42703')) {
                    // Retry update without weekly_goals column
                    const { error: fallbackErr } = await supabaseClient
                        .from('user_journals')
                        .update({
                            entries: this.entries,
                            goals: this.goals,
                            principles: principlesToSave,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existing.id);
                    saveError = fallbackErr;
                } else {
                    saveError = updateErr;
                }
            } else {
                // Insert new record
                const { error: insertErr } = await supabaseClient
                    .from('user_journals')
                    .insert([{
                        user_id: userId,
                        entries: this.entries,
                        goals: this.goals,
                        weekly_goals: this.weeklyGoals,
                        principles: principlesToSave,
                        updated_at: new Date().toISOString()
                    }]);

                if (insertErr && (insertErr.message?.includes('weekly_goals') || insertErr.code === '42703')) {
                    // Retry insert without weekly_goals column
                    const { error: fallbackErr } = await supabaseClient
                        .from('user_journals')
                        .insert([{
                            user_id: userId,
                            entries: this.entries,
                            goals: this.goals,
                            principles: principlesToSave,
                            updated_at: new Date().toISOString()
                        }]);
                    saveError = fallbackErr;
                } else {
                    saveError = insertErr;
                }
            }

            if (saveError) {
                console.error('Error guardando diario en Supabase:', saveError);
                this.updateSyncStatus('warning', 'Guardado Local (Error al sincronizar Supabase)');
            } else {
                this.updateSyncStatus('success', 'Sincronizado con Supabase');
            }
        } catch (err) {
            console.error('Error general guardando diario en Supabase:', err);
            this.updateSyncStatus('warning', 'Guardado Local (Error de red Supabase)');
        }
    },

    async syncCloudNow() {
        this.updateSyncStatus('syncing', 'Sincronizando con Supabase...');
        await this.saveData();
        Utils.showToast('Sincronización con Supabase ejecutada', 'info');
    },

    bindEvents() {
        // Weekly Goals Navigation & Form Events
        const btnPrevMonth = document.getElementById('btnWeeklyPrevMonth');
        const btnNextMonth = document.getElementById('btnWeeklyNextMonth');
        const btnCurrentWeek = document.getElementById('btnWeeklyCurrentWeek');
        const btnNewWeeklyGoal = document.getElementById('btnNewWeeklyGoal');
        const btnCancelWeeklyGoal = document.getElementById('btnCancelWeeklyGoal');
        const weeklyGoalForm = document.getElementById('weeklyGoalForm');

        if (btnPrevMonth) btnPrevMonth.addEventListener('click', () => this.changeWeeklyMonth(-1));
        if (btnNextMonth) btnNextMonth.addEventListener('click', () => this.changeWeeklyMonth(1));
        if (btnCurrentWeek) btnCurrentWeek.addEventListener('click', () => this.goToCurrentWeek());
        if (btnNewWeeklyGoal) btnNewWeeklyGoal.addEventListener('click', () => this.openNewWeeklyGoalForm());
        if (btnCancelWeeklyGoal) btnCancelWeeklyGoal.addEventListener('click', () => this.closeWeeklyGoalForm());
        if (weeklyGoalForm) weeklyGoalForm.addEventListener('submit', (e) => this.handleSaveWeeklyGoal(e));

        // Journal Entry Form
        const form = document.getElementById('journalEntryForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSaveEntry(e));
        }

        // New Goal UI
        const btnNewGoal = document.getElementById('btnNewGoal');
        const btnCancelGoal = document.getElementById('btnCancelGoal');
        const newGoalFormContainer = document.getElementById('newGoalFormContainer');
        const goalForm = document.getElementById('goalForm');

        if (btnNewGoal) {
            btnNewGoal.addEventListener('click', () => {
                newGoalFormContainer.style.display = 'block';
                btnNewGoal.style.display = 'none';
            });
        }

        if (btnCancelGoal) {
            btnCancelGoal.addEventListener('click', () => {
                newGoalFormContainer.style.display = 'none';
                btnNewGoal.style.display = 'block';
                goalForm.reset();
                this.editingGoalId = null;
            });
        }

        if (goalForm) {
            goalForm.addEventListener('submit', (e) => this.handleSaveGoal(e));
        }

        const btnDownloadJournalPDF = document.getElementById('btnDownloadJournalPDF');
        if (btnDownloadJournalPDF) {
            btnDownloadJournalPDF.addEventListener('click', () => this.downloadJournalPDF());
        }

        // Principles Events
        const principlesCategory = document.getElementById('principlesCategory');
        if (principlesCategory) {
            principlesCategory.addEventListener('change', () => this.renderPrinciples());
        }

        const principleForm = document.getElementById('principleForm');
        if (principleForm) {
            principleForm.addEventListener('submit', (e) => this.handleAddPrinciple(e));
        }
    },

    async render() {
        this.renderWeeklyGoals();
        this.renderEntries();
        this.renderGoals();
        this.renderPrinciples();
    },

    // ========================================
    // WEEKLY GOALS & CALENDAR METHODS
    // ========================================
    getWeeksForMonth(year, monthIndex) {
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const monthShortNames = [
            'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
            'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
        ];

        const weeks = [];
        const firstDayObj = new Date(year, monthIndex, 1);
        const firstDayOfWeek = firstDayObj.getDay(); // 0: Sun, 1: Mon, 2: Tue... 6: Sat
        
        let week1StartDate = new Date(year, monthIndex, 1);
        if (firstDayOfWeek === 6) { // Saturday
            week1StartDate = new Date(year, monthIndex, 3); // Start on Monday
        } else if (firstDayOfWeek === 0) { // Sunday
            week1StartDate = new Date(year, monthIndex, 2); // Start on Monday
        }

        let currentMonday = new Date(week1StartDate);
        const dOffset = (currentMonday.getDay() + 6) % 7; // Distance to Monday
        currentMonday.setDate(currentMonday.getDate() - dOffset);

        let weekIndex = 1;
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        while (true) {
            const sunday = new Date(currentMonday);
            sunday.setDate(currentMonday.getDate() + 6);

            if (currentMonday.getMonth() > monthIndex && currentMonday.getFullYear() >= year) {
                break;
            }
            if (currentMonday.getFullYear() > year) {
                break;
            }

            const startStr = `${String(currentMonday.getDate()).padStart(2, '0')} de ${monthNames[currentMonday.getMonth()]}`;
            const endStr = `${String(sunday.getDate()).padStart(2, '0')} de ${monthNames[sunday.getMonth()]}`;
            const shortStartStr = `${String(currentMonday.getDate()).padStart(2, '0')} ${monthShortNames[currentMonday.getMonth()]}`;
            const shortEndStr = `${String(sunday.getDate()).padStart(2, '0')} ${monthShortNames[sunday.getMonth()]}`;

            const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-W${weekIndex}`;

            const startIso = `${currentMonday.getFullYear()}-${String(currentMonday.getMonth() + 1).padStart(2, '0')}-${String(currentMonday.getDate()).padStart(2, '0')}`;
            const endIso = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
            const isCurrent = todayStr >= startIso && todayStr <= endIso;

            weeks.push({
                weekNumber: weekIndex,
                key: key,
                title: `Semana ${weekIndex}: ${startStr} al ${endStr}`,
                shortLabel: `Semana ${weekIndex} (${shortStartStr} - ${shortEndStr})`,
                startDate: startIso,
                endDate: endIso,
                isCurrent: isCurrent
            });

            currentMonday.setDate(currentMonday.getDate() + 7);
            weekIndex++;

            if (weekIndex > 6 || (currentMonday.getMonth() !== monthIndex && currentMonday.getDate() > 7)) {
                break;
            }
        }

        return weeks;
    },

    renderWeeklyGoals() {
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        const monthLabel = document.getElementById('weeklyMonthLabel');
        if (monthLabel) {
            monthLabel.textContent = `${monthNames[this.currentWeeklyMonth]} ${this.currentWeeklyYear}`;
        }

        const weeks = this.getWeeksForMonth(this.currentWeeklyYear, this.currentWeeklyMonth);
        if (weeks.length === 0) return;

        const currentWeekInMonth = weeks.find(w => w.isCurrent);
        if (!this.selectedWeekKey || !weeks.some(w => w.key === this.selectedWeekKey)) {
            this.selectedWeekKey = currentWeekInMonth ? currentWeekInMonth.key : weeks[0].key;
        }

        const activeWeek = weeks.find(w => w.key === this.selectedWeekKey) || weeks[0];

        // 1. Render Week Selector Pills
        const pillsContainer = document.getElementById('weeklyPillsContainer');
        if (pillsContainer) {
            pillsContainer.innerHTML = weeks.map(w => {
                const weekGoals = this.weeklyGoals.filter(g => g.weekKey === w.key);
                const completedCount = weekGoals.filter(g => g.completed).length;
                const totalCount = weekGoals.length;
                
                let badgeHtml = '';
                if (totalCount === 0) {
                    badgeHtml = `<span class="weekly-pill-badge empty">0</span>`;
                } else if (completedCount === totalCount) {
                    badgeHtml = `<span class="weekly-pill-badge completed">✓ ${completedCount}/${totalCount}</span>`;
                } else {
                    badgeHtml = `<span class="weekly-pill-badge in-progress">${completedCount}/${totalCount}</span>`;
                }

                const isActive = w.key === this.selectedWeekKey;
                const todayBadge = w.isCurrent ? `<span style="font-size: 0.65rem; color: #818cf8; margin-left: 4px;">• Hoy</span>` : '';

                return `
                    <button type="button" class="weekly-pill ${isActive ? 'active' : ''}" onclick="JournalModule.selectWeek('${w.key}')">
                        <div class="weekly-pill-title">
                            <span>Semana ${w.weekNumber} ${todayBadge}</span>
                            ${badgeHtml}
                        </div>
                        <div class="weekly-pill-dates">${w.shortLabel.split('(')[1].replace(')', '')}</div>
                    </button>
                `;
            }).join('');
        }

        // 2. Update Active Week Banner & Progress Bar
        const titleEl = document.getElementById('selectedWeekTitle');
        const badgeEl = document.getElementById('selectedWeekBadge');
        const statsEl = document.getElementById('selectedWeekStats');
        const barEl = document.getElementById('selectedWeekProgressBar');

        const activeGoals = this.weeklyGoals.filter(g => g.weekKey === activeWeek.key);
        const activeCompleted = activeGoals.filter(g => g.completed).length;
        const activeTotal = activeGoals.length;
        const pct = activeTotal > 0 ? Math.round((activeCompleted / activeTotal) * 100) : 0;

        if (titleEl) titleEl.textContent = activeWeek.title;
        if (badgeEl) {
            badgeEl.textContent = activeWeek.isCurrent ? 'Semana Actual 🔥' : `Semana ${activeWeek.weekNumber}`;
            badgeEl.style.background = activeWeek.isCurrent ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.08)';
            badgeEl.style.color = activeWeek.isCurrent ? '#818cf8' : 'var(--text-secondary)';
        }
        if (statsEl) statsEl.textContent = `${activeCompleted} / ${activeTotal} completados (${pct}%)`;
        if (barEl) barEl.style.width = `${pct}%`;

        // 3. Update Week Selector in Form
        const weekSelect = document.getElementById('weeklyGoalWeekSelect');
        if (weekSelect) {
            weekSelect.innerHTML = weeks.map(w => `
                <option value="${w.key}" ${w.key === activeWeek.key ? 'selected' : ''}>
                    ${w.title}
                </option>
            `).join('');
        }

        // 4. Render Objectives List for Selected Week
        const listEl = document.getElementById('weeklyGoalsList');
        if (listEl) {
            if (activeGoals.length === 0) {
                listEl.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); padding: 1.75rem 1rem; background: var(--bg-primary); border-radius: 8px; border: 1px dashed var(--border);">
                        <p style="margin-bottom: 0.75rem; font-size: 0.9rem;">No tienes objetivos registrados para la <strong>${activeWeek.title}</strong>.</p>
                        <button type="button" class="btn btn-sm btn-primary" onclick="JournalModule.openNewWeeklyGoalForm()">+ Agregar Objetivo a esta Semana</button>
                    </div>
                `;
            } else {
                const priorityWeight = { 'high': 3, 'medium': 2, 'normal': 1 };
                const sorted = [...activeGoals].sort((a, b) => {
                    if (a.completed !== b.completed) return a.completed ? 1 : -1;
                    return (priorityWeight[b.priority || 'medium'] || 2) - (priorityWeight[a.priority || 'medium'] || 2);
                });

                listEl.innerHTML = sorted.map(g => {
                    const priorityClass = g.priority || 'medium';
                    const priorityLabel = g.priority === 'high' ? '🔥 Alta' : (g.priority === 'normal' ? '🎯 Normal' : '⚡ Media');
                    
                    return `
                        <div class="weekly-goal-card ${g.completed ? 'completed' : ''}">
                            <input type="checkbox" class="weekly-checkbox" ${g.completed ? 'checked' : ''} onchange="JournalModule.toggleWeeklyGoal('${g.id}')" title="${g.completed ? 'Marcar como pendiente' : 'Marcar como completado'}">
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.25rem;">
                                    <span class="priority-pill ${priorityClass}">${priorityLabel}</span>
                                    <span style="font-size: 0.72rem; color: var(--text-muted); background: var(--bg-primary); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border);">${Utils.escapeHtml(g.category || '💼 Ventas / Dropi')}</span>
                                </div>
                                <div class="weekly-goal-text" style="font-size: 0.9rem; font-weight: 500; color: var(--text-primary); margin-bottom: 0.2rem; line-height: 1.35;">
                                    ${Utils.escapeHtml(g.title)}
                                </div>
                                ${g.target ? `
                                    <div style="font-size: 0.78rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
                                        ${Utils.escapeHtml(g.target)}
                                    </div>
                                ` : ''}
                            </div>
                            <div style="display: flex; gap: 0.25rem; align-items: center;">
                                <button type="button" class="btn btn-sm btn-icon" style="color: var(--primary); padding: 4px;" onclick="JournalModule.editWeeklyGoal('${g.id}')" title="Editar objetivo">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                </button>
                                <button type="button" class="btn btn-sm btn-icon" style="color: var(--text-muted); padding: 4px;" onclick="JournalModule.moveWeeklyGoalToNextWeek('${g.id}')" title="Mover a la siguiente semana">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                </button>
                                <button type="button" class="btn btn-sm btn-icon" style="color: var(--danger); padding: 4px;" onclick="JournalModule.deleteWeeklyGoal('${g.id}')" title="Eliminar">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    },

    changeWeeklyMonth(delta) {
        let newMonth = this.currentWeeklyMonth + delta;
        let newYear = this.currentWeeklyYear;
        if (newMonth < 0) {
            newMonth = 11;
            newYear -= 1;
        } else if (newMonth > 11) {
            newMonth = 0;
            newYear += 1;
        }
        this.currentWeeklyMonth = newMonth;
        this.currentWeeklyYear = newYear;
        this.selectedWeekKey = null;
        this.renderWeeklyGoals();
    },

    goToCurrentWeek() {
        const now = new Date();
        this.currentWeeklyYear = now.getFullYear();
        this.currentWeeklyMonth = now.getMonth();
        const weeks = this.getWeeksForMonth(this.currentWeeklyYear, this.currentWeeklyMonth);
        const current = weeks.find(w => w.isCurrent);
        this.selectedWeekKey = current ? current.key : (weeks[0] ? weeks[0].key : null);
        this.renderWeeklyGoals();
    },

    selectWeek(key) {
        this.selectedWeekKey = key;
        this.renderWeeklyGoals();
    },

    openNewWeeklyGoalForm() {
        this.editingWeeklyGoalId = null;
        const form = document.getElementById('weeklyGoalForm');
        if (form) form.reset();
        document.getElementById('weeklyGoalId').value = '';
        if (this.selectedWeekKey) {
            const selectEl = document.getElementById('weeklyGoalWeekSelect');
            if (selectEl) selectEl.value = this.selectedWeekKey;
        }
        document.getElementById('newWeeklyGoalFormContainer').style.display = 'block';
        document.getElementById('btnNewWeeklyGoal').style.display = 'none';
        document.getElementById('weeklyGoalTitle').focus();
    },

    closeWeeklyGoalForm() {
        document.getElementById('newWeeklyGoalFormContainer').style.display = 'none';
        document.getElementById('btnNewWeeklyGoal').style.display = 'inline-flex';
        const form = document.getElementById('weeklyGoalForm');
        if (form) form.reset();
        this.editingWeeklyGoalId = null;
    },

    handleSaveWeeklyGoal(e) {
        e.preventDefault();
        const title = document.getElementById('weeklyGoalTitle').value.trim();
        const weekKey = document.getElementById('weeklyGoalWeekSelect').value;
        const category = document.getElementById('weeklyGoalCategory').value;
        const priority = document.getElementById('weeklyGoalPriority').value;
        const target = document.getElementById('weeklyGoalTarget').value.trim();

        if (!title) {
            Utils.showToast('Por favor escribe el título del objetivo', 'warning');
            return;
        }

        if (this.editingWeeklyGoalId) {
            const goal = this.weeklyGoals.find(g => g.id === this.editingWeeklyGoalId);
            if (goal) {
                goal.title = title;
                goal.weekKey = weekKey;
                goal.category = category;
                goal.priority = priority;
                goal.target = target;
            }
            this.editingWeeklyGoalId = null;
            Utils.showToast('Objetivo semanal actualizado', 'success');
        } else {
            const newGoal = {
                id: 'wg_' + Date.now().toString(),
                weekKey: weekKey,
                title: title,
                category: category,
                priority: priority,
                target: target,
                completed: false,
                completedAt: null,
                createdAt: new Date().toISOString()
            };
            this.weeklyGoals.push(newGoal);
            Utils.showToast('¡Objetivo semanal agregado con éxito!', 'success');
        }

        this.selectedWeekKey = weekKey;
        this.saveData();
        this.closeWeeklyGoalForm();
        this.renderWeeklyGoals();
    },

    toggleWeeklyGoal(id) {
        const goal = this.weeklyGoals.find(g => g.id === id);
        if (goal) {
            goal.completed = !goal.completed;
            goal.completedAt = goal.completed ? new Date().toISOString() : null;
            this.saveData();
            this.renderWeeklyGoals();
            if (goal.completed) {
                Utils.showToast('¡Excelente! Objetivo semanal cumplido 🎉', 'success');
            }
        }
    },

    editWeeklyGoal(id) {
        const goal = this.weeklyGoals.find(g => g.id === id);
        if (!goal) return;

        this.editingWeeklyGoalId = id;
        document.getElementById('weeklyGoalId').value = goal.id;
        document.getElementById('weeklyGoalTitle').value = goal.title;
        document.getElementById('weeklyGoalWeekSelect').value = goal.weekKey;
        document.getElementById('weeklyGoalCategory').value = goal.category || '💼 Ventas / Dropi';
        document.getElementById('weeklyGoalPriority').value = goal.priority || 'medium';
        document.getElementById('weeklyGoalTarget').value = goal.target || '';

        document.getElementById('newWeeklyGoalFormContainer').style.display = 'block';
        document.getElementById('btnNewWeeklyGoal').style.display = 'none';
        document.getElementById('newWeeklyGoalFormContainer').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    deleteWeeklyGoal(id) {
        if (!confirm('¿Estás seguro de eliminar este objetivo semanal?')) return;
        this.weeklyGoals = this.weeklyGoals.filter(g => g.id !== id);
        this.saveData();
        this.renderWeeklyGoals();
        Utils.showToast('Objetivo semanal eliminado', 'success');
    },

    moveWeeklyGoalToNextWeek(id) {
        const goal = this.weeklyGoals.find(g => g.id === id);
        if (!goal) return;

        const parts = goal.weekKey.split('-W');
        if (parts.length === 2) {
            const nextWeekNum = parseInt(parts[1], 10) + 1;
            goal.weekKey = `${parts[0]}-W${nextWeekNum}`;
            this.selectedWeekKey = goal.weekKey;
            this.saveData();
            this.renderWeeklyGoals();
            Utils.showToast(`Objetivo movido a la Semana ${nextWeekNum}`, 'success');
        }
    },

    getMoodEmoji(mood) {
        const map = {
            'amazing': '🤩',
            'happy': '😊',
            'neutral': '😐',
            'sad': '😔',
            'stressed': '😫'
        };
        return map[mood] || '🤔';
    },

    handleSaveEntry(e) {
        e.preventDefault();
        
        const moodSelect = document.getElementById('moodSelect');
        const selectedMood = moodSelect ? moodSelect.value : null;

        if (!selectedMood) {
            Utils.showToast('Por favor selecciona cómo te sientes hoy', 'error');
            return;
        }

        const doneWell = document.getElementById('journalDone').value;
        const doneWrong = document.getElementById('journalWrong').value;

        const newEntry = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            mood: selectedMood,
            doneWell: doneWell,
            doneWrong: doneWrong
        };

        this.entries.unshift(newEntry); // Add to beginning
        this.saveData();

        Utils.showToast('Entrada guardada con éxito', 'success');
        
        // Reset form
        document.getElementById('journalEntryForm').reset();
        if (moodSelect) moodSelect.value = '';

        this.renderEntries();
    },

    renderEntries() {
        const list = document.getElementById('journalEntriesList');
        if (!list) return;

        if (this.entries.length === 0) {
            list.innerHTML = `<p style="text-align:center; color: var(--text-muted); padding: 1rem;">Aún no tienes entradas. ¡Escribe la primera!</p>`;
            return;
        }

        list.innerHTML = this.entries.map(entry => {
            const dateStr = new Date(entry.date).toLocaleDateString('es-EC', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' 
            });
            
            return `
                <div class="journal-entry-card">
                    <div class="journal-entry-header">
                        <span class="journal-entry-mood">${this.getMoodEmoji(entry.mood)}</span>
                        <span class="journal-entry-date">${dateStr}</span>
                        <button class="btn btn-sm btn-icon" style="color:var(--danger)" onclick="JournalModule.deleteEntry('${entry.id}')" title="Eliminar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                    <div class="journal-entry-body">
                        <div>
                            <strong><span style="color:var(--success)">✓</span> Qué hice bien:</strong>
                            <p>${Utils.escapeHtml(entry.doneWell)}</p>
                        </div>
                        <div style="margin-top: 0.5rem;">
                            <strong><span style="color:var(--warning)">⚠</span> Qué debo mejorar:</strong>
                            <p>${Utils.escapeHtml(entry.doneWrong)}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    deleteEntry(id) {
        if (!confirm('¿Eliminar esta entrada?')) return;
        this.entries = this.entries.filter(e => e.id !== id);
        this.saveData();
        this.renderEntries();
        Utils.showToast('Entrada eliminada', 'success');
    },

    handleSaveGoal(e) {
        e.preventDefault();

        const title = document.getElementById('goalTitle').value;
        const date = document.getElementById('goalDate').value;
        const category = document.getElementById('goalCategory').value;
        const plan = document.getElementById('goalPlan') ? document.getElementById('goalPlan').value : '';

        if (this.editingGoalId) {
            const goal = this.goals.find(g => g.id === this.editingGoalId);
            if (goal) {
                goal.title = title;
                goal.targetDate = date;
                goal.category = category;
                goal.plan = plan;
            }
            this.editingGoalId = null;
        } else {
            const newGoal = {
                id: Date.now().toString(),
                title: title,
                targetDate: date,
                category: category,
                plan: plan,
                completed: false,
                createdAt: new Date().toISOString()
            };
            this.goals.push(newGoal);
        }

        this.saveData();

        Utils.showToast('Meta guardada', 'success');
        
        document.getElementById('goalForm').reset();
        document.getElementById('newGoalFormContainer').style.display = 'none';
        document.getElementById('btnNewGoal').style.display = 'block';

        this.renderGoals();
    },

    renderGoals() {
        const list = document.getElementById('goalsList');
        if (!list) return;

        if (this.goals.length === 0) {
            list.innerHTML = `<p style="text-align:center; color: var(--text-muted); padding: 1rem;">No tienes metas activas. ¡Plantéate un nuevo objetivo!</p>`;
            return;
        }

        // Sort: incomplete first, then by date
        const sortedGoals = [...this.goals].sort((a, b) => {
            if (a.completed === b.completed) {
                return new Date(a.targetDate) - new Date(b.targetDate);
            }
            return a.completed ? 1 : -1;
        });

        list.innerHTML = sortedGoals.map(goal => {
            const isLate = !goal.completed && new Date(goal.targetDate) < new Date(new Date().setHours(0,0,0,0));
            const dateStr = new Date(goal.targetDate).toLocaleDateString('es-EC', { month: 'short', day: 'numeric', year: 'numeric'});
            
            return `
                <div class="goal-card ${goal.completed ? 'goal-completed' : ''} ${isLate ? 'goal-late' : ''}">
                    <div class="goal-header">
                        <span class="goal-category badge">${Utils.escapeHtml(goal.category)}</span>
                        <div class="goal-actions">
                            <button type="button" class="btn btn-sm btn-icon" style="color: ${goal.completed ? 'var(--text-muted)' : 'var(--success)'}" onclick="JournalModule.toggleGoal('${goal.id}')" title="${goal.completed ? 'Reabrir' : 'Completar'}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </button>
                            <button type="button" class="btn btn-sm btn-icon" style="color: var(--primary)" onclick="JournalModule.editGoal('${goal.id}')" title="Editar">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                            </button>
                            <button type="button" class="btn btn-sm btn-icon" style="color: var(--danger)" onclick="JournalModule.deleteGoal('${goal.id}')" title="Eliminar">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="goal-title">${Utils.escapeHtml(goal.title)}</div>
                    ${goal.plan ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem; border-left: 2px solid var(--border); padding-left: 8px;">${Utils.escapeHtml(goal.plan).replace(/\n/g, '<br>')}</div>` : ''}
                    <div class="goal-footer">
                        <span style="color: ${isLate ? 'var(--danger)' : 'var(--text-muted)'}; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            ${dateStr} ${isLate ? '(Atrasado)' : ''}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    },

    toggleGoal(id) {
        const goal = this.goals.find(g => g.id === id);
        if (goal) {
            goal.completed = !goal.completed;
            this.saveData();
            this.renderGoals();
            if (goal.completed) {
                // Trigger a confetti or nice toast
                Utils.showToast('¡Felicidades por completar tu meta! 🎉', 'success');
            }
        }
    },

    editGoal(id) {
        const goal = this.goals.find(g => g.id === id);
        if (!goal) return;

        this.editingGoalId = id;

        document.getElementById('goalTitle').value = goal.title;
        document.getElementById('goalDate').value = goal.targetDate;
        document.getElementById('goalCategory').value = goal.category;
        if (document.getElementById('goalPlan')) {
            document.getElementById('goalPlan').value = goal.plan || '';
        }

        document.getElementById('newGoalFormContainer').style.display = 'block';
        document.getElementById('btnNewGoal').style.display = 'none';
        
        // Scroll to form if needed
        document.getElementById('newGoalFormContainer').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    deleteGoal(id) {
        if (!confirm('¿Eliminar esta meta?')) return;
        this.goals = this.goals.filter(g => g.id !== id);
        this.saveData();
        this.renderGoals();
        Utils.showToast('Meta eliminada', 'success');
    },

    downloadJournalPDF() {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            Utils.showToast('Error: No se pudo cargar el generador de PDF', 'error');
            return;
        }

        const doc = new jsPDF();
        let y = 20;

        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("Reporte de Diario y Metas", 105, y, null, null, "center");
        y += 15;

        // --- 1. OBJETIVOS SEMANALES ---
        if (this.weeklyGoals && this.weeklyGoals.length > 0) {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text("Objetivos Semanales", 20, y);
            y += 10;

            const sortedWeekly = [...this.weeklyGoals].sort((a, b) => {
                if (a.completed === b.completed) return (a.weekKey || '').localeCompare(b.weekKey || '');
                return a.completed ? 1 : -1;
            });

            doc.setFontSize(12);
            sortedWeekly.forEach((goal, index) => {
                if (y > 270) { doc.addPage(); y = 20; }
                const status = goal.completed ? "[Completado]" : "[Pendiente]";
                const priority = goal.priority === 'high' ? 'Alta' : (goal.priority === 'normal' ? 'Normal' : 'Media');

                doc.setFont("helvetica", "bold");
                doc.text(`${index + 1}. ${goal.title} ${status}`, 20, y);
                y += 7;

                doc.setFont("helvetica", "normal");
                doc.text(`Semana: ${goal.weekKey || 'N/A'} | Prioridad: ${priority} | Categoría: ${goal.category || 'General'}`, 25, y);
                y += 7;

                if (goal.target) {
                    const splitTarget = doc.splitTextToSize(`Meta/Plan: ${goal.target}`, 160);
                    doc.text(splitTarget, 25, y);
                    y += (splitTarget.length * 7);
                }
                y += 5;
            });
            y += 5;
        }

        // --- 2. METAS GENERALES ---
        if (this.goals.length > 0) {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text("Mis Metas Generales", 20, y);
            y += 10;

            const sortedGoals = [...this.goals].sort((a, b) => {
                if (a.completed === b.completed) return new Date(a.targetDate) - new Date(b.targetDate);
                return a.completed ? 1 : -1;
            });

            doc.setFontSize(12);
            sortedGoals.forEach((goal, index) => {
                if (y > 270) { doc.addPage(); y = 20; }
                const status = goal.completed ? "[Completada]" : "[Pendiente]";
                const dateStr = new Date(goal.targetDate).toLocaleDateString('es-EC');

                doc.setFont("helvetica", "bold");
                doc.text(`${index + 1}. ${goal.title} ${status}`, 20, y);
                y += 7;

                doc.setFont("helvetica", "normal");
                doc.text(`Categoría: ${goal.category} | Fecha Límite: ${dateStr}`, 25, y);
                y += 7;

                if (goal.plan) {
                    const splitPlan = doc.splitTextToSize(`Plan: ${goal.plan}`, 160);
                    doc.text(splitPlan, 25, y);
                    y += (splitPlan.length * 7);
                }
                y += 5;
            });
            y += 5;
        }

        // --- 3. DIARIO ---
        if (this.entries.length > 0) {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text("Entradas del Diario", 20, y);
            y += 10;

            doc.setFontSize(12);
            this.entries.forEach((entry, index) => {
                if (y > 260) { doc.addPage(); y = 20; }
                const dateStr = new Date(entry.date).toLocaleDateString('es-EC', { 
                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' 
                });
                
                const moodMap = {
                    'amazing': '[Increíble]',
                    'happy': '[Feliz]',
                    'neutral': '[Neutral]',
                    'sad': '[Triste]',
                    'stressed': '[Estresado]'
                };
                const moodText = moodMap[entry.mood] || '[Desconocido]';

                doc.setFont("helvetica", "bold");
                doc.text(`${moodText} ${dateStr}`, 20, y);
                y += 7;

                doc.setFont("helvetica", "normal");
                doc.setFont(undefined, "bold");
                doc.text("Que hice bien:", 25, y);
                doc.setFont(undefined, "normal");
                const splitWell = doc.splitTextToSize(entry.doneWell, 155);
                doc.text(splitWell, 30, y + 6);
                y += (splitWell.length * 6) + 8;

                if (y > 260) { doc.addPage(); y = 20; }
                doc.setFont(undefined, "bold");
                doc.text("Que debo mejorar:", 25, y);
                doc.setFont(undefined, "normal");
                const splitWrong = doc.splitTextToSize(entry.doneWrong, 155);
                doc.text(splitWrong, 30, y + 6);
                y += (splitWrong.length * 6) + 12;
            });
        }

        // --- 4. PRINCIPIOS Y REGLAS ---
        const principleCategories = [
            { key: 'principles', label: 'Principios y Valores' },
            { key: 'rules', label: 'Reglas de Vida' },
            { key: 'actions', label: 'Cómo actuaré' },
            { key: 'improvements', label: 'Cosas que mejorar' }
        ];

        let hasPrinciples = false;
        principleCategories.forEach(cat => {
            if (this.principles[cat.key] && this.principles[cat.key].length > 0) hasPrinciples = true;
        });

        if (hasPrinciples) {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text("Principios y Reglas", 20, y);
            y += 10;

            principleCategories.forEach(cat => {
                const items = this.principles[cat.key] || [];
                if (items.length > 0) {
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.setFontSize(14);
                    doc.setFont("helvetica", "bold");
                    doc.text(cat.label, 20, y);
                    y += 8;

                    doc.setFontSize(12);
                    doc.setFont("helvetica", "normal");
                    items.forEach(item => {
                        if (y > 280) { doc.addPage(); y = 20; }
                        const areaText = item.area ? `[${item.area}] ` : '';
                        const splitItem = doc.splitTextToSize(`- ${areaText}${item.text}`, 160);
                        doc.text(splitItem, 25, y);
                        y += (splitItem.length * 6) + 2;
                    });
                    y += 5;
                }
            });
        }

        doc.save("Reporte_Diario_y_Metas.pdf");
        Utils.showToast('Reporte PDF descargado exitosamente', 'success');
    },

    handleAddPrinciple(e) {
        e.preventDefault();
        const input = document.getElementById('newPrinciple');
        const areaSelect = document.getElementById('principleArea');
        const category = document.getElementById('principlesCategory').value;
        const text = input.value.trim();
        const area = areaSelect ? areaSelect.value : 'Personal';
        
        if (!text) return;

        const newItem = {
            id: 'p_' + Date.now().toString(),
            text: text,
            area: area
        };

        this.principles[category].push(newItem);
        this.saveData();
        this.renderPrinciples();
        
        input.value = '';
        Utils.showToast('Agregado exitosamente', 'success');
    },

    renderPrinciples() {
        const list = document.getElementById('principlesList');
        const category = document.getElementById('principlesCategory');
        if (!list || !category) return;

        const currentCategory = category.value;
        const items = this.principles[currentCategory] || [];

        if (items.length === 0) {
            list.innerHTML = `<p style="text-align:center; color: var(--text-muted); font-size: 0.9rem; padding: 1rem 0;">No hay elementos en esta categoría.</p>`;
            return;
        }

        // Group by area
        const grouped = {};
        items.forEach(item => {
            const area = item.area || 'Personal';
            if (!grouped[area]) grouped[area] = [];
            grouped[area].push(item);
        });

        let html = '';
        for (const [area, areaItems] of Object.entries(grouped)) {
            html += `<div style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-top: 0.75rem; margin-bottom: 0.25rem; text-transform: uppercase;">${area}</div>`;
            
            html += areaItems.map(item => `
                <div style="background: var(--bg-primary); padding: 0.6rem; border-radius: 6px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.25rem;">
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 0.25rem;">
                        <span style="font-size: 0.9rem; line-height: 1.4;">${Utils.escapeHtml(item.text)}</span>
                        <span style="font-size: 0.7rem; color: var(--primary); font-weight: 500; background: rgba(0, 122, 255, 0.1); padding: 0.1rem 0.4rem; border-radius: 4px; align-self: flex-start; border: 1px solid rgba(0, 122, 255, 0.2);">${area}</span>
                    </div>
                    <button type="button" class="btn btn-icon" style="color: var(--danger); background: none; min-width: 24px; width: 24px; height: 24px; padding: 0;" onclick="JournalModule.deletePrinciple('${currentCategory}', '${item.id}')" title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `).join('');
        }

        list.innerHTML = html;
    },

    deletePrinciple(category, id) {
        if (!confirm('¿Eliminar este elemento?')) return;
        this.principles[category] = this.principles[category].filter(p => p.id !== id);
        this.saveData();
        this.renderPrinciples();
        Utils.showToast('Elemento eliminado', 'success');
    },

    // Export backup JSON file
    exportBackup() {
        if (this.entries.length === 0 && this.goals.length === 0 && (!this.weeklyGoals || this.weeklyGoals.length === 0) && (!this.principles || Object.values(this.principles).every(arr => arr.length === 0))) {
            Utils.showToast('No hay datos en el diario para exportar', 'warning');
            return;
        }

        const backupData = {
            version: '1.1',
            exportedAt: new Date().toISOString(),
            entries: this.entries,
            goals: this.goals,
            weekly_goals: this.weeklyGoals,
            principles: this.principles
        };

        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `diario_metas_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showToast('¡Copia de seguridad del diario exportada en JSON!', 'success');
    },

    // Trigger file picker for import
    triggerImportBackup() {
        const input = document.getElementById('journalBackupInput');
        if (input) input.click();
    },

    // Import backup file
    importBackupFile(inputEl) {
        const file = inputEl.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.applyBackupData(data);
                inputEl.value = '';
                Utils.showToast('¡Copia de seguridad del diario importada con éxito!', 'success');
            } catch (err) {
                console.error('Error al importar backup del diario:', err);
                Utils.showToast('El archivo no tiene un formato de backup JSON válido', 'error');
            }
        };
        reader.readAsText(file);
    },

    // Copy all journal & goals data to clipboard as JSON text
    copyBackupToClipboard() {
        const backupData = {
            version: '1.1',
            exportedAt: new Date().toISOString(),
            entries: this.entries,
            goals: this.goals,
            weekly_goals: this.weeklyGoals,
            principles: this.principles
        };

        const jsonStr = JSON.stringify(backupData);
        navigator.clipboard.writeText(jsonStr).then(() => {
            Utils.showToast('¡Datos copiados al portapapeles! Ahora abre tu otro navegador y haz clic en "Pegar / Cargar"', 'success');
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = jsonStr;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            Utils.showToast('¡Datos copiados al portapapeles! Haz clic en "Pegar / Cargar" en el otro navegador', 'success');
        });
    },

    // Show paste modal
    pasteBackupModal() {
        const textEl = document.getElementById('journalBackupText');
        if (textEl) textEl.value = '';
        Utils.openModal('modalJournalBackup');
    },

    // Process pasted JSON backup
    processPasteBackup() {
        const textEl = document.getElementById('journalBackupText');
        const content = textEl ? textEl.value.trim() : '';

        if (!content) {
            Utils.showToast('Por favor pega el contenido de la copia de seguridad', 'warning');
            return;
        }

        try {
            const data = JSON.parse(content);
            this.applyBackupData(data);
            Utils.closeModal('modalJournalBackup');
            if (textEl) textEl.value = '';
            Utils.showToast('¡Diario y metas restaurados exitosamente!', 'success');
        } catch (err) {
            console.error('Error procesando texto de backup del diario:', err);
            Utils.showToast('El texto pegado no es un JSON de backup válido', 'error');
        }
    },

    // Apply backup data
    applyBackupData(data) {
        if (!data || (typeof data !== 'object')) {
            throw new Error('Formato inválido');
        }

        const newEntries = data.entries || [];
        const newGoals = data.goals || [];
        const newWeeklyGoals = data.weekly_goals || data.weeklyGoals || [];
        const newPrinciples = data.principles || { principles: [], rules: [], actions: [], improvements: [] };

        // Merge entries by ID
        const entryMap = new Map(this.entries.map(e => [e.id, e]));
        newEntries.forEach(e => {
            if (e.id) entryMap.set(e.id, e);
        });
        this.entries = Array.from(entryMap.values());
        this.entries.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        // Merge goals by ID
        const goalMap = new Map(this.goals.map(g => [g.id, g]));
        newGoals.forEach(g => {
            if (g.id) goalMap.set(g.id, g);
        });
        this.goals = Array.from(goalMap.values());

        // Merge weekly goals by ID
        const weeklyMap = new Map(this.weeklyGoals.map(wg => [wg.id, wg]));
        newWeeklyGoals.forEach(wg => {
            if (wg.id) weeklyMap.set(wg.id, wg);
        });
        this.weeklyGoals = Array.from(weeklyMap.values());

        // Merge principles
        if (newPrinciples && typeof newPrinciples === 'object') {
            ['principles', 'rules', 'actions', 'improvements'].forEach(cat => {
                const currentCatArr = this.principles[cat] || [];
                const newCatArr = newPrinciples[cat] || [];
                const pMap = new Map(currentCatArr.map(p => [p.id, p]));
                newCatArr.forEach(p => {
                    if (p.id) pMap.set(p.id, p);
                });
                this.principles[cat] = Array.from(pMap.values());
            });
        }

        // Save
        this.saveData();

        // Render
        this.render();
    }
};

window.JournalModule = JournalModule;
