// ========================================
// Journal & Goals Module
// ========================================

const JournalModule = {
    entries: [],
    goals: [],
    currentMood: null,

    init() {
        this.loadData();
        this.bindEvents();
    },

    loadData() {
        const savedEntries = localStorage.getItem('journal_entries');
        const savedGoals = localStorage.getItem('journal_goals');
        
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
    },

    saveData() {
        localStorage.setItem('journal_entries', JSON.stringify(this.entries));
        localStorage.setItem('journal_goals', JSON.stringify(this.goals));
    },

    bindEvents() {
        // Mood Selector
        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                this.currentMood = e.currentTarget.dataset.mood;
            });
        });

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
            });
        }

        if (goalForm) {
            goalForm.addEventListener('submit', (e) => this.handleSaveGoal(e));
        }
    },

    async render() {
        this.renderEntries();
        this.renderGoals();
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
        
        if (!this.currentMood) {
            Utils.showToast('Por favor selecciona cómo te sientes hoy', 'error');
            return;
        }

        const doneWell = document.getElementById('journalDone').value;
        const doneWrong = document.getElementById('journalWrong').value;

        const newEntry = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            mood: this.currentMood,
            doneWell: doneWell,
            doneWrong: doneWrong
        };

        this.entries.unshift(newEntry); // Add to beginning
        this.saveData();

        Utils.showToast('Entrada guardada con éxito', 'success');
        
        // Reset form
        document.getElementById('journalEntryForm').reset();
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
        this.currentMood = null;

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

        const newGoal = {
            id: Date.now().toString(),
            title: title,
            targetDate: date,
            category: category,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.goals.push(newGoal);
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
                            <button class="btn btn-sm btn-icon" style="color: ${goal.completed ? 'var(--text-muted)' : 'var(--success)'}" onclick="JournalModule.toggleGoal('${goal.id}')" title="${goal.completed ? 'Reabrir' : 'Completar'}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </button>
                            <button class="btn btn-sm btn-icon" style="color: var(--danger)" onclick="JournalModule.deleteGoal('${goal.id}')" title="Eliminar">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="goal-title">${Utils.escapeHtml(goal.title)}</div>
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

    deleteGoal(id) {
        if (!confirm('¿Eliminar esta meta?')) return;
        this.goals = this.goals.filter(g => g.id !== id);
        this.saveData();
        this.renderGoals();
        Utils.showToast('Meta eliminada', 'success');
    }
};

window.JournalModule = JournalModule;
