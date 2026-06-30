// ========================================
// Journal & Goals Module
// ========================================

const JournalModule = {
    entries: [],
    goals: [],
    principles: { principles: [], rules: [], actions: [], improvements: [] },
    currentMood: null,
    editingGoalId: null,

    init() {
        this.loadData();
        this.bindEvents();
    },
    
    restoreSeedData() {
        if (!confirm('¿Estás seguro de querer restaurar el historial original? Esto sobreescribirá tus datos actuales del diario y metas si tienes alguno.')) return;
        
        if (typeof JournalSeedData !== 'undefined') {
            this.entries = [...JournalSeedData.entries];
            this.goals = [...JournalSeedData.goals];
            this.principles = JSON.parse(JSON.stringify(JournalSeedData.principles));
            this.saveData();
            
            this.renderEntries();
            this.renderGoals();
            this.renderPrinciples();
            
            Utils.showToast('Historial restaurado exitosamente', 'success');
        } else {
            Utils.showToast('Error: No se encontró el archivo de historial', 'error');
        }
    },

    loadData() {
        const savedEntries = localStorage.getItem('journal_entries');
        const savedGoals = localStorage.getItem('journal_goals');
        const savedPrinciples = localStorage.getItem('journal_principles');
        
        if (savedEntries) {
            this.entries = JSON.parse(savedEntries);
        } else if (typeof JournalSeedData !== 'undefined') {
            this.entries = [...JournalSeedData.entries];
            localStorage.setItem('journal_entries', JSON.stringify(this.entries));
        } else {
            this.entries = [];
        }

        if (savedGoals) {
            this.goals = JSON.parse(savedGoals);
        } else if (typeof JournalSeedData !== 'undefined') {
            this.goals = [...JournalSeedData.goals];
            localStorage.setItem('journal_goals', JSON.stringify(this.goals));
        } else {
            this.goals = [];
        }

        if (savedPrinciples) {
            this.principles = JSON.parse(savedPrinciples);
            
            // Migration: Add areas to existing items if missing
            if (typeof JournalSeedData !== 'undefined' && JournalSeedData.principles) {
                let migrated = false;
                for (const category in this.principles) {
                    if (this.principles[category] && Array.isArray(this.principles[category])) {
                        this.principles[category].forEach(item => {
                            if (!item.area) {
                                const seedItem = JournalSeedData.principles[category]?.find(s => s.id === item.id);
                                item.area = seedItem && seedItem.area ? seedItem.area : 'Personal';
                                migrated = true;
                            }
                        });
                    }
                }
                if (migrated) {
                    localStorage.setItem('journal_principles', JSON.stringify(this.principles));
                }
            }
        } else if (typeof JournalSeedData !== 'undefined' && JournalSeedData.principles) {
            this.principles = JSON.parse(JSON.stringify(JournalSeedData.principles));
            localStorage.setItem('journal_principles', JSON.stringify(this.principles));
        } else {
            this.principles = { principles: [], rules: [], actions: [], improvements: [] };
        }
    },

    saveData() {
        localStorage.setItem('journal_entries', JSON.stringify(this.entries));
        localStorage.setItem('journal_goals', JSON.stringify(this.goals));
        localStorage.setItem('journal_principles', JSON.stringify(this.principles));
    },

    bindEvents() {
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
        this.renderEntries();
        this.renderGoals();
        this.renderPrinciples();
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
    }
};

window.JournalModule = JournalModule;
