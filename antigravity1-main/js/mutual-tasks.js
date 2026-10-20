// ==============================================================================
// MÓDULO: Sincronizador de Pendientes Mutuos (Dirección vs Trabajadora)
// Soporte para Nombres Personalizados (ej: Duvan & Monica),
// Supabase (sincronización en tiempo real) y LocalStorage fallback
// ==============================================================================

const MutualTasksModule = (() => {
    // --- NOMBRES PERSONALIZABLES DE LAS PARTES ---
    let roleNames = {
        admin: 'Duvan',
        worker: 'Monica'
    };

    // --- DATOS SEMILLA DE EJEMPLO ---
    const INITIAL_ITEMS = [
        {
            id: '101',
            title: 'Pago pendiente comisión / reembolso de envíos',
            description: 'Quedó pendiente liquidar el excedente de la semana pasada según relación enviada.',
            category: 'payment',
            priority: 'high',
            turn: 'admin',
            createdBy: 'worker',
            status: 'active',
            amount: 185000,
            dueDate: '2026-10-21',
            createdAt: '18 Oct',
            notes: [
                { id: 'n1', author: 'worker', text: 'Subí las fotos de los recibos a la carpeta compartida.', timestamp: 'Ayer, 4:20 PM' }
            ]
        },
        {
            id: '102',
            title: 'Arreglar banner y botón de WhatsApp en la página web',
            description: 'En celulares el botón flotante tapa el carrito de compras y el banner principal carga lento.',
            category: 'web',
            priority: 'high',
            turn: 'worker',
            createdBy: 'admin',
            status: 'active',
            dueDate: '2026-10-20',
            createdAt: '19 Oct',
            notes: [
                { id: 'n2', author: 'admin', text: 'Te dejé la imagen optimizada lista para subir.', timestamp: 'Hoy, 9:15 AM' }
            ]
        },
        {
            id: '103',
            title: 'Solucionar reclamo de cliente por pedido trocado',
            description: 'Llamar al cliente del pedido #408, ofrecerle cambio exprés y coordinar recogida.',
            category: 'issue',
            priority: 'medium',
            turn: 'admin',
            createdBy: 'admin',
            status: 'in_review',
            dueDate: '2026-10-19',
            createdAt: '17 Oct',
            notes: [
                { id: 'n3', author: 'worker', text: 'Ya hablé con la clienta, aceptó el cambio y la transportadora recoge mañana. Quedo atenta a tu visto bueno.', timestamp: 'Hoy, 11:40 AM' }
            ]
        }
    ];

    // --- CONFIGURACIÓN DE CATEGORÍAS Y PRIORIDADES ---
    const CATEGORIES = {
        payment: { label: 'Pago / Dinero', icon: 'dollar-sign', badgeClass: 'mt-badge-cat-payment' },
        web: { label: 'Página Web', icon: 'globe', badgeClass: 'mt-badge-cat-web' },
        issue: { label: 'Resolver Problema', icon: 'alert-triangle', badgeClass: 'mt-badge-cat-issue' },
        general: { label: 'Operativo / Otro', icon: 'layers', badgeClass: 'mt-badge-cat-general' }
    };

    const PRIORITIES = {
        high: { label: 'Urgente', badgeClass: 'mt-badge-prio-high' },
        medium: { label: 'Normal', badgeClass: 'mt-badge-prio-medium' },
        low: { label: 'Baja', badgeClass: 'mt-badge-prio-low' }
    };

    // --- ESTADO DEL MÓDULO ---
    let items = [];
    let currentUser = 'admin'; // 'admin' | 'worker'
    let activeTab = 'all'; // 'all' | 'my_turn' | 'their_turn' | 'review' | 'completed'
    let selectedCategory = 'all';
    let draftNotes = {};
    let openLogs = { '103': true };
    let isSupabaseConnected = false;
    let isInitialized = false;
    let realtimeChannel = null;

    // --- ICONOS SVG (Lucide) ---
    function getSvg(name, size = 16) {
        const icons = {
            'arrow-left-right': `<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>`,
            'dollar-sign': `<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
            'globe': `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
            'alert-triangle': `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
            'layers': `<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>`,
            'flame': `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z"/>`,
            'clock': `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
            'user-check': `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>`,
            'check-circle-2': `<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>`,
            'check-check': `<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>`,
            'plus': `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
            'trash-2': `<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>`,
            'eye': `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>`,
            'send': `<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`,
            'message-square': `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
            'rotate-ccw': `<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>`,
            'x': `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
            'settings': `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`
        };
        const content = icons[name] || '';
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">${content}</svg>`;
    }

    // --- UTILIDADES DE FORMATO ---
    function formatCOP(val) {
        if (!val || isNaN(val)) return '$0';
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
    }

    function formatTime() {
        const now = new Date();
        return now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }

    function roleName(role, isMe = false) {
        const base = role === 'admin' ? roleNames.admin : roleNames.worker;
        if (isMe) {
            return `${base} (Yo)`;
        }
        return base;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // --- PERSISTENCIA Y CARGA DE DATOS ---
    async function init() {
        if (isInitialized) return;
        isInitialized = true;

        // Cargar nombres personalizados desde LocalStorage
        try {
            const savedNames = localStorage.getItem('mutual_tasks_names_v1');
            if (savedNames) {
                const parsed = JSON.parse(savedNames);
                if (parsed.admin) roleNames.admin = parsed.admin;
                if (parsed.worker) roleNames.worker = parsed.worker;
            }
        } catch(e) {
            console.warn('Error reading saved names:', e);
        }

        // Auto-seleccionar perspectiva según el usuario logueado en el sistema
        if (typeof AuthModule !== 'undefined' && AuthModule.currentUser) {
            currentUser = AuthModule.currentUser.role === 'admin' ? 'admin' : 'worker';
        }

        // Cargar desde LocalStorage inicialmente para respuesta instantánea
        try {
            const saved = localStorage.getItem('modulo_pendientes_v1');
            if (saved) {
                items = JSON.parse(saved);
            } else {
                items = INITIAL_ITEMS;
                localStorage.setItem('modulo_pendientes_v1', JSON.stringify(items));
            }
        } catch (e) {
            console.warn('Error reading from localStorage:', e);
            items = INITIAL_ITEMS;
        }

        // Cargar desde Supabase y configurar sincronización en tiempo real
        await loadFromSupabase();
        setupRealtime();
    }

    async function loadFromSupabase() {
        if (!window.supabaseClient) {
            isSupabaseConnected = false;
            return;
        }

        try {
            const { data, error } = await window.supabaseClient
                .from('mutual_tasks')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('Supabase mutual_tasks not ready, using local data:', error.message);
                isSupabaseConnected = false;
                return;
            }

            if (data && Array.isArray(data)) {
                isSupabaseConnected = true;

                // 1. Detectar si existe configuración de nombres guardada en la base de datos
                const configRow = data.find(row => row.id === '__config_names__');
                if (configRow && configRow.description) {
                    try {
                        const parsed = JSON.parse(configRow.description);
                        if (parsed.admin) roleNames.admin = parsed.admin;
                        if (parsed.worker) roleNames.worker = parsed.worker;
                        localStorage.setItem('mutual_tasks_names_v1', JSON.stringify(roleNames));
                    } catch(e) {}
                }

                // 2. Filtrar items normales (excluyendo registros de configuración)
                const taskRows = data.filter(row => row.id !== '__config_names__');

                if (taskRows.length > 0) {
                    items = taskRows.map(row => ({
                        id: String(row.id),
                        title: row.title,
                        description: row.description || '',
                        category: row.category || 'issue',
                        priority: row.priority || 'medium',
                        turn: row.turn || 'worker',
                        createdBy: row.created_by || 'admin',
                        status: row.status || 'active',
                        amount: row.amount ? Number(row.amount) : undefined,
                        dueDate: row.due_date || undefined,
                        createdAt: row.created_at ? new Date(row.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : 'Hoy',
                        notes: Array.isArray(row.notes) ? row.notes : []
                    }));
                    localStorage.setItem('modulo_pendientes_v1', JSON.stringify(items));
                } else if (items.length > 0) {
                    // Sembrar datos iniciales si está vacía
                    seedInitialDataToSupabase();
                }
            }
        } catch (err) {
            console.error('Error fetching mutual_tasks from Supabase:', err);
            isSupabaseConnected = false;
        }
    }

    async function seedInitialDataToSupabase() {
        if (!window.supabaseClient || !isSupabaseConnected) return;
        try {
            for (const item of INITIAL_ITEMS) {
                await saveItemToSupabase(item);
            }
        } catch (e) {
            console.warn('Could not seed initial data:', e);
        }
    }

    async function saveItemToSupabase(item) {
        if (!window.supabaseClient) return;
        try {
            const payload = {
                id: String(item.id),
                title: item.title,
                description: item.description || '',
                category: item.category,
                priority: item.priority,
                turn: item.turn,
                created_by: item.createdBy,
                status: item.status,
                amount: item.amount || null,
                due_date: item.dueDate || null,
                notes: item.notes || [],
                updated_at: new Date().toISOString()
            };

            const { error } = await window.supabaseClient
                .from('mutual_tasks')
                .upsert(payload);

            if (error) {
                console.warn('Error saving to Supabase:', error.message);
            } else {
                isSupabaseConnected = true;
            }
        } catch (e) {
            console.warn('Supabase save error:', e);
        }
    }

    async function deleteItemFromSupabase(id) {
        if (!window.supabaseClient) return;
        try {
            await window.supabaseClient
                .from('mutual_tasks')
                .delete()
                .eq('id', String(id));
        } catch (e) {
            console.warn('Supabase delete error:', e);
        }
    }

    function setupRealtime() {
        if (!window.supabaseClient || realtimeChannel) return;
        try {
            realtimeChannel = window.supabaseClient
                .channel('realtime_mutual_tasks')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'mutual_tasks' },
                    async () => {
                        await loadFromSupabase();
                        if (App && App.currentSection === 'mutual-tasks') {
                            render();
                        }
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        isSupabaseConnected = true;
                    }
                });
        } catch (e) {
            console.warn('Could not connect realtime channel:', e);
        }
    }

    function persistState() {
        localStorage.setItem('modulo_pendientes_v1', JSON.stringify(items));
    }

    // --- GESTIÓN DE NOMBRES PERSONALIZADOS ---
    function openNamesModal() {
        const modal = document.getElementById('mtNamesModal');
        if (modal) {
            modal.style.display = 'flex';
            const adminInput = document.getElementById('mtInputAdminName');
            const workerInput = document.getElementById('mtInputWorkerName');
            if (adminInput) adminInput.value = roleNames.admin;
            if (workerInput) workerInput.value = roleNames.worker;
            if (adminInput) setTimeout(() => adminInput.focus(), 100);
        }
    }

    function closeNamesModal() {
        const modal = document.getElementById('mtNamesModal');
        if (modal) modal.style.display = 'none';
    }

    async function handleSaveNames(e) {
        if (e && e.preventDefault) e.preventDefault();
        const adminInput = document.getElementById('mtInputAdminName');
        const workerInput = document.getElementById('mtInputWorkerName');

        const newAdmin = adminInput ? adminInput.value.trim() : '';
        const newWorker = workerInput ? workerInput.value.trim() : '';

        if (!newAdmin || !newWorker) {
            if (typeof Utils !== 'undefined') Utils.showToast('Ambos nombres son obligatorios', 'warning');
            return;
        }

        roleNames.admin = newAdmin;
        roleNames.worker = newWorker;
        localStorage.setItem('mutual_tasks_names_v1', JSON.stringify(roleNames));

        // Sincronizar configuración de nombres en Supabase
        if (window.supabaseClient) {
            try {
                await window.supabaseClient
                    .from('mutual_tasks')
                    .upsert({
                        id: '__config_names__',
                        title: 'CONFIG_NAMES',
                        description: JSON.stringify(roleNames),
                        category: 'general',
                        priority: 'low',
                        turn: 'admin',
                        created_by: 'admin',
                        status: 'completed',
                        updated_at: new Date().toISOString()
                    });
            } catch(err) {
                console.warn('Could not sync custom names to Supabase:', err);
            }
        }

        closeNamesModal();
        render();
        if (typeof Utils !== 'undefined') Utils.showToast(`Nombres configurados: ${roleNames.admin} y ${roleNames.worker}`, 'success');
    }

    // --- ACCIONES Y OPERACIONES ---
    function switchRole(newRole) {
        currentUser = newRole;
        render();
    }

    function setActiveTab(tab) {
        activeTab = tab;
        render();
    }

    function setSelectedCategory(cat) {
        selectedCategory = cat;
        render();
    }

    function toggleLog(itemId) {
        openLogs[itemId] = !openLogs[itemId];
        render();
    }

    function updateDraftNote(itemId, text) {
        draftNotes[itemId] = text;
    }

    async function handleCreate(e) {
        if (e && e.preventDefault) e.preventDefault();

        const titleEl = document.getElementById('mtModalTitle');
        const descEl = document.getElementById('mtModalDesc');
        const catEl = document.getElementById('mtModalCat');
        const prioEl = document.getElementById('mtModalPrio');
        const assignEl = document.getElementById('mtModalAssign');
        const amountEl = document.getElementById('mtModalAmount');
        const dueEl = document.getElementById('mtModalDueDate');

        const title = titleEl ? titleEl.value.trim() : '';
        if (!title) {
            if (typeof Utils !== 'undefined') Utils.showToast('El título del pendiente es obligatorio', 'warning');
            return;
        }

        const category = catEl ? catEl.value : 'issue';
        const priority = prioEl ? prioEl.value : 'medium';
        const assignTo = assignEl ? assignEl.value : (currentUser === 'admin' ? 'worker' : 'admin');
        const amount = (category === 'payment' && amountEl && amountEl.value) ? Number(amountEl.value) : undefined;
        const dueDate = dueEl && dueEl.value ? dueEl.value : undefined;
        const description = descEl ? descEl.value.trim() : '';

        const newItem = {
            id: Date.now().toString(),
            title,
            description,
            category,
            priority,
            turn: assignTo,
            createdBy: currentUser,
            status: 'active',
            amount,
            dueDate,
            createdAt: 'Hoy',
            notes: [
                {
                    id: Date.now().toString() + '-init',
                    author: currentUser,
                    text: `Pendiente creado y asignado inicialmente a ${roleName(assignTo)}.`,
                    timestamp: `Hoy, ${formatTime()}`
                }
            ]
        };

        items = [newItem, ...items];
        persistState();
        await saveItemToSupabase(newItem);

        closeModal();
        render();
        if (typeof Utils !== 'undefined') Utils.showToast('Nuevo pendiente registrado', 'success');
    }

    async function handlePassTurn(itemId) {
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        const nextTurn = item.turn === 'admin' ? 'worker' : 'admin';
        const noteText = (draftNotes[itemId] || '').trim();

        const newNote = {
            id: Date.now().toString(),
            author: currentUser,
            text: noteText
                ? `🔄 Pasó el turno: "${noteText}"`
                : `🔄 Pasó la pelota a cancha de ${roleName(nextTurn)}.`,
            timestamp: `Hoy, ${formatTime()}`
        };

        const updated = {
            ...item,
            turn: nextTurn,
            status: 'active',
            notes: [...item.notes, newNote]
        };

        items = items.map(i => i.id === itemId ? updated : i);
        draftNotes[itemId] = '';
        persistState();
        await saveItemToSupabase(updated);

        render();
        if (typeof Utils !== 'undefined') Utils.showToast(`Turno pasado a ${roleName(nextTurn)}`, 'info');
    }

    async function handleRequestReview(itemId) {
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        const reviewer = item.turn === 'admin' ? 'worker' : 'admin';
        const noteText = (draftNotes[itemId] || '').trim();

        const newNote = {
            id: Date.now().toString(),
            author: currentUser,
            text: noteText
                ? `✅ Marcado como resuelto: "${noteText}". Esperando validación.`
                : `✅ Marcó el pendiente como resuelto. Pasa a validación de ${roleName(reviewer)}.`,
            timestamp: `Hoy, ${formatTime()}`
        };

        const updated = {
            ...item,
            status: 'in_review',
            turn: reviewer,
            notes: [...item.notes, newNote]
        };

        items = items.map(i => i.id === itemId ? updated : i);
        draftNotes[itemId] = '';
        persistState();
        await saveItemToSupabase(updated);

        render();
        if (typeof Utils !== 'undefined') Utils.showToast(`Enviado a validación de ${roleName(reviewer)}`, 'success');
    }

    async function handleConfirmClose(itemId) {
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        const newNote = {
            id: Date.now().toString(),
            author: currentUser,
            text: `🎉 Validado y cerrado definitivamente por ${roleName(currentUser)}.`,
            timestamp: `Hoy, ${formatTime()}`
        };

        const updated = {
            ...item,
            status: 'completed',
            notes: [...item.notes, newNote]
        };

        items = items.map(i => i.id === itemId ? updated : i);
        persistState();
        await saveItemToSupabase(updated);

        render();
        if (typeof Utils !== 'undefined') Utils.showToast('Pendiente validado y cerrado', 'success');
    }

    async function handleRejectReview(itemId) {
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        const previousTurn = item.turn === 'admin' ? 'worker' : 'admin';
        const noteText = (draftNotes[itemId] || '').trim() || 'Aún falta un detalle por ajustar.';

        const newNote = {
            id: Date.now().toString(),
            author: currentUser,
            text: `⚠️ Devuelto a pendiente: "${noteText}"`,
            timestamp: `Hoy, ${formatTime()}`
        };

        const updated = {
            ...item,
            status: 'active',
            turn: previousTurn,
            notes: [...item.notes, newNote]
        };

        items = items.map(i => i.id === itemId ? updated : i);
        draftNotes[itemId] = '';
        persistState();
        await saveItemToSupabase(updated);

        render();
        if (typeof Utils !== 'undefined') Utils.showToast(`Devuelto a ${roleName(previousTurn)}`, 'warning');
    }

    async function handleAddComment(itemId) {
        const text = (draftNotes[itemId] || '').trim();
        if (!text) return;

        const item = items.find(i => i.id === itemId);
        if (!item) return;

        const newNote = {
            id: Date.now().toString(),
            author: currentUser,
            text,
            timestamp: `Hoy, ${formatTime()}`
        };

        const updated = {
            ...item,
            notes: [...item.notes, newNote]
        };

        items = items.map(i => i.id === itemId ? updated : i);
        draftNotes[itemId] = '';
        openLogs[itemId] = true;
        persistState();
        await saveItemToSupabase(updated);

        render();
    }

    async function handleDelete(itemId) {
        if (!confirm('¿Seguro que deseas eliminar este pendiente mutuo?')) return;

        items = items.filter(i => i.id !== itemId);
        persistState();
        await deleteItemFromSupabase(itemId);

        render();
        if (typeof Utils !== 'undefined') Utils.showToast('Pendiente eliminado', 'info');
    }

    function openModal() {
        const modal = document.getElementById('mtCreateModal');
        if (modal) {
            modal.style.display = 'flex';
            const assignEl = document.getElementById('mtModalAssign');
            if (assignEl) {
                assignEl.value = currentUser === 'admin' ? 'worker' : 'admin';
            }
            const catEl = document.getElementById('mtModalCat');
            if (catEl) onCategoryChange(catEl.value);
            const titleInput = document.getElementById('mtModalTitle');
            if (titleInput) {
                titleInput.value = '';
                setTimeout(() => titleInput.focus(), 100);
            }
        }
    }

    function closeModal() {
        const modal = document.getElementById('mtCreateModal');
        if (modal) modal.style.display = 'none';
    }

    function onCategoryChange(val) {
        const amountGroup = document.getElementById('mtModalAmountGroup');
        if (amountGroup) {
            amountGroup.style.display = (val === 'payment') ? 'block' : 'none';
        }
    }

    // --- RENDERIZADO DEL MÓDULO ---
    function render() {
        const container = document.getElementById('section-mutual-tasks');
        if (!container) return;

        const otherRole = currentUser === 'admin' ? 'worker' : 'admin';

        // --- CÁLCULO DE MÉTRICAS (KPIs) ---
        const openItems = items.filter(i => i.status !== 'completed');
        const myTurnCount = openItems.filter(i => i.turn === currentUser && i.status === 'active').length;
        const theirTurnCount = openItems.filter(i => i.turn === otherRole && i.status === 'active').length;
        const waitingReviewCount = openItems.filter(i => i.status === 'in_review').length;

        const moneyMySide = openItems
            .filter(i => i.category === 'payment' && i.turn === currentUser)
            .reduce((sum, i) => sum + (i.amount || 0), 0);

        const moneyTheirSide = openItems
            .filter(i => i.category === 'payment' && i.turn === otherRole)
            .reduce((sum, i) => sum + (i.amount || 0), 0);

        // --- FILTRADO DE ITEMS ---
        const filteredItems = items.filter(item => {
            if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
            if (activeTab === 'my_turn') return item.status === 'active' && item.turn === currentUser;
            if (activeTab === 'their_turn') return item.status === 'active' && item.turn === otherRole;
            if (activeTab === 'review') return item.status === 'in_review';
            if (activeTab === 'completed') return item.status === 'completed';
            return item.status !== 'completed';
        });

        // --- CONSTRUCCIÓN DEL HTML ---
        let html = `
        <div class="mutual-tasks-wrapper">

            <!-- CABECERA PRINCIPAL Y SWITCHER DE PERSPECTIVA -->
            <header class="mt-header">
                <div class="mt-title-group">
                    <div class="mt-title-icon">
                        ${getSvg('arrow-left-right', 22)}
                    </div>
                    <div>
                        <h1>Sincronizador de Pendientes Mutuos</h1>
                        <p>Gestión transparente de tareas y acuerdos entre <strong>${escapeHtml(roleNames.admin)}</strong> y <strong>${escapeHtml(roleNames.worker)}</strong>.</p>
                    </div>
                </div>

                <div class="mt-header-actions">
                    <!-- Estado de sincronización Supabase -->
                    <span class="mt-sync-pill ${isSupabaseConnected ? 'online' : 'offline'}" title="${isSupabaseConnected ? 'Sincronizado en tiempo real con Supabase' : 'Guardando localmente (Ejecuta el script SQL en Supabase para sincronizar en la nube)'}">
                        <span style="font-size: 0.65rem;">${isSupabaseConnected ? '🟢' : '🟡'}</span>
                        ${isSupabaseConnected ? 'Supabase Nube' : 'Modo Local'}
                    </span>

                    <!-- Selector interactivo de vista -->
                    <div class="mt-user-switcher">
                        <span class="mt-switch-label">
                            ${getSvg('eye', 13)} Vista:
                        </span>
                        <button type="button" 
                            onclick="MutualTasksModule.switchRole('admin')" 
                            class="mt-switch-btn ${currentUser === 'admin' ? 'active-admin' : ''}"
                            title="Cambiar perspectiva a ${escapeHtml(roleNames.admin)}">
                            ${escapeHtml(roleNames.admin)} ${currentUser === 'admin' ? '(Yo)' : ''}
                        </button>
                        <button type="button" 
                            onclick="MutualTasksModule.switchRole('worker')" 
                            class="mt-switch-btn ${currentUser === 'worker' ? 'active-worker' : ''}"
                            title="Cambiar perspectiva a ${escapeHtml(roleNames.worker)}">
                            ${escapeHtml(roleNames.worker)} ${currentUser === 'worker' ? '(Yo)' : ''}
                        </button>
                    </div>

                    <!-- Botón Personalizar Nombres -->
                    <button type="button" onclick="MutualTasksModule.openNamesModal()" class="mt-btn-settings" title="Editar los nombres de los participantes (ej: Duvan y Monica)">
                        ${getSvg('settings', 14)} ⚙️ Nombres
                    </button>

                    <!-- Botón Crear Nuevo Pendiente -->
                    <button type="button" onclick="MutualTasksModule.openModal()" class="mt-btn-primary">
                        ${getSvg('plus', 16)} Nuevo Pendiente
                    </button>
                </div>
            </header>

            <!-- TABLERO DE BALANZA (KPIs EN TIEMPO REAL) -->
            <section class="mt-kpi-grid">
                <!-- Tarjeta 1: Mi Turno -->
                <div class="mt-kpi-card kpi-mine ${activeTab === 'my_turn' ? 'active-tab' : ''}" onclick="MutualTasksModule.setActiveTab('my_turn')">
                    <div class="mt-kpi-top">
                        <div>
                            <span class="mt-kpi-badge">Pelota en mi cancha</span>
                            <div class="mt-kpi-number">${myTurnCount}</div>
                            <p class="mt-kpi-desc">
                                Cosas que <strong>${roleName(currentUser, true)}</strong> debe responder o gestionar ahora.
                            </p>
                        </div>
                        <div class="mt-kpi-icon">
                            ${getSvg('flame', 24)}
                        </div>
                    </div>
                    ${moneyMySide > 0 ? `
                        <div class="mt-kpi-money">
                            <span class="mt-kpi-money-label">Dinero en mi turno:</span>
                            <span class="mt-kpi-money-val">${formatCOP(moneyMySide)}</span>
                        </div>
                    ` : ''}
                </div>

                <!-- Tarjeta 2: Turno de la Contraparte -->
                <div class="mt-kpi-card kpi-theirs ${activeTab === 'their_turn' ? 'active-tab' : ''}" onclick="MutualTasksModule.setActiveTab('their_turn')">
                    <div class="mt-kpi-top">
                        <div>
                            <span class="mt-kpi-badge">En cancha de ${roleName(otherRole)}</span>
                            <div class="mt-kpi-number">${theirTurnCount}</div>
                            <p class="mt-kpi-desc">
                                Pendientes donde estoy esperando acción de <strong>${roleName(otherRole)}</strong>.
                            </p>
                        </div>
                        <div class="mt-kpi-icon">
                            ${getSvg('clock', 24)}
                        </div>
                    </div>
                    ${moneyTheirSide > 0 ? `
                        <div class="mt-kpi-money">
                            <span class="mt-kpi-money-label">Dinero en su turno:</span>
                            <span class="mt-kpi-money-val">${formatCOP(moneyTheirSide)}</span>
                        </div>
                    ` : ''}
                </div>

                <!-- Tarjeta 3: Por Validar (Doble Check) -->
                <div class="mt-kpi-card kpi-review ${activeTab === 'review' ? 'active-tab' : ''}" onclick="MutualTasksModule.setActiveTab('review')">
                    <div class="mt-kpi-top">
                        <div>
                            <span class="mt-kpi-badge">Por Validar (Doble Check)</span>
                            <div class="mt-kpi-number">${waitingReviewCount}</div>
                            <p class="mt-kpi-desc">
                                Marcados como listos, esperando confirmación mutua para archivar.
                            </p>
                        </div>
                        <div class="mt-kpi-icon">
                            ${getSvg('user-check', 24)}
                        </div>
                    </div>
                </div>
            </section>

            <!-- BARRA DE FILTROS Y CATEGORÍAS -->
            <section class="mt-filters-panel">
                <!-- Pestañas de Estado -->
                <div class="mt-tabs-group">
                    <button type="button" class="mt-tab-btn ${activeTab === 'all' ? 'active' : ''}" onclick="MutualTasksModule.setActiveTab('all')">
                        Todos Activos
                    </button>
                    <button type="button" class="mt-tab-btn ${activeTab === 'my_turn' ? 'active' : ''}" onclick="MutualTasksModule.setActiveTab('my_turn')">
                        Mi Turno (${myTurnCount})
                    </button>
                    <button type="button" class="mt-tab-btn ${activeTab === 'their_turn' ? 'active' : ''}" onclick="MutualTasksModule.setActiveTab('their_turn')">
                        Turno de ${roleName(otherRole)} (${theirTurnCount})
                    </button>
                    <button type="button" class="mt-tab-btn ${activeTab === 'review' ? 'active' : ''}" onclick="MutualTasksModule.setActiveTab('review')">
                        Por Validar (${waitingReviewCount})
                    </button>
                    <button type="button" class="mt-tab-btn ${activeTab === 'completed' ? 'active' : ''}" onclick="MutualTasksModule.setActiveTab('completed')">
                        Historial Cerrados
                    </button>
                </div>

                <!-- Filtro por Área / Categoría -->
                <div class="mt-categories-group">
                    <button type="button" class="mt-cat-pill ${selectedCategory === 'all' ? 'active' : ''}" onclick="MutualTasksModule.setSelectedCategory('all')">
                        Todas las áreas
                    </button>
                    ${Object.keys(CATEGORIES).map(catKey => {
                        const cfg = CATEGORIES[catKey];
                        const isActive = selectedCategory === catKey;
                        return `
                            <button type="button" class="mt-cat-pill ${isActive ? 'active' : ''}" onclick="MutualTasksModule.setSelectedCategory('${catKey}')">
                                ${getSvg(cfg.icon, 13)} ${cfg.label}
                            </button>
                        `;
                    }).join('')}
                </div>
            </section>

            <!-- LISTA DE TARJETAS DE PENDIENTES -->
            <section class="mt-tasks-list">
        `;

        if (filteredItems.length === 0) {
            html += `
                <div class="mt-empty-state">
                    <div class="mt-empty-icon">${getSvg('check-circle-2', 48)}</div>
                    <h3>¡Todo despejado en esta vista!</h3>
                    <p>No hay pendientes que coincidan con este filtro. Puedes cambiar de pestaña o registrar un nuevo acuerdo mutuo.</p>
                </div>
            `;
        } else {
            html += filteredItems.map(item => {
                const cat = CATEGORIES[item.category] || CATEGORIES.general;
                const prio = PRIORITIES[item.priority] || PRIORITIES.medium;
                const isMyTurn = item.turn === currentUser;
                const isLogsOpen = !!openLogs[item.id];
                const cardModifier = item.status === 'in_review'
                    ? 'is-review'
                    : (item.status === 'completed'
                        ? 'is-completed'
                        : (isMyTurn ? 'is-my-turn' : ''));

                return `
                    <div class="mt-card ${cardModifier}" id="mt-card-${item.id}">
                        <div class="mt-card-body">
                            <!-- Metadatos superiores -->
                            <div class="mt-card-meta">
                                <div class="mt-badges-wrap">
                                    <span class="mt-badge ${cat.badgeClass}">
                                        ${getSvg(cat.icon, 13)} ${cat.label}
                                    </span>
                                    <span class="mt-badge ${prio.badgeClass}">
                                        Prioridad ${prio.label}
                                    </span>
                                    ${item.amount ? `
                                        <span class="mt-badge mt-badge-amount">
                                            ${formatCOP(item.amount)}
                                        </span>
                                    ` : ''}
                                    ${item.dueDate ? `
                                        <span class="mt-badge mt-badge-date">
                                            📅 Límite: ${escapeHtml(item.dueDate)}
                                        </span>
                                    ` : ''}
                                </div>

                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <!-- Indicador de Turno -->
                                    ${item.status === 'completed' ? `
                                        <span class="mt-turn-indicator mt-turn-completed">
                                            ${getSvg('check-check', 14)} Cerrado y Validado
                                        </span>
                                    ` : item.status === 'in_review' ? `
                                        <span class="mt-turn-indicator mt-turn-review">
                                            ${getSvg('user-check', 14)} Esperando validación de ${roleName(item.turn)}
                                        </span>
                                    ` : `
                                        <span class="mt-turn-indicator ${isMyTurn ? 'mt-turn-my-turn' : 'mt-turn-their-turn'}">
                                            ${isMyTurn ? `<span class="mt-ping-dot"></span>` : ''}
                                            Turno actual: ${roleName(item.turn)}
                                        </span>
                                    `}

                                    <!-- Botón Eliminar -->
                                    <button type="button" class="mt-btn-delete" title="Eliminar registro" onclick="MutualTasksModule.handleDelete('${item.id}')">
                                        ${getSvg('trash-2', 15)}
                                    </button>
                                </div>
                            </div>

                            <!-- Título y Descripción -->
                            <h3 class="mt-card-title">${escapeHtml(item.title)}</h3>
                            ${item.description ? `
                                <p class="mt-card-desc">${escapeHtml(item.description)}</p>
                            ` : ''}

                            <!-- Barra de Interacción Rápida (Ping-Pong y Cierre) -->
                            ${item.status !== 'completed' ? `
                                <div class="mt-interaction-bar">
                                    <div class="mt-note-input-wrap">
                                        <input type="text" 
                                            class="mt-note-input"
                                            value="${escapeHtml(draftNotes[item.id] || '')}"
                                            oninput="MutualTasksModule.updateDraftNote('${item.id}', this.value)"
                                            onkeydown="if(event.key==='Enter') MutualTasksModule.handleAddComment('${item.id}')"
                                            placeholder="Escribe una nota de avance, link o respuesta antes de actuar..." />
                                        <button type="button" class="mt-btn-quick-note" onclick="MutualTasksModule.handleAddComment('${item.id}')" title="Solo agregar nota a la bitácora">
                                            ${getSvg('send', 13)} Nota
                                        </button>
                                    </div>

                                    <div class="mt-action-buttons">
                                        ${item.status === 'active' ? `
                                            <button type="button" class="mt-action-btn mt-btn-pass" onclick="MutualTasksModule.handlePassTurn('${item.id}')">
                                                ${getSvg('arrow-left-right', 13)} Pasar pelota a ${roleName(item.turn === 'admin' ? 'worker' : 'admin')}
                                            </button>
                                            <button type="button" class="mt-action-btn mt-btn-resolve" onclick="MutualTasksModule.handleRequestReview('${item.id}')">
                                                ${getSvg('check-circle-2', 13)} Ya lo resolví (Enviar a Revisión)
                                            </button>
                                        ` : `
                                            <button type="button" class="mt-action-btn mt-btn-reject" onclick="MutualTasksModule.handleRejectReview('${item.id}')">
                                                ${getSvg('rotate-ccw', 13)} Aún falta (Devolver)
                                            </button>
                                            <button type="button" class="mt-action-btn mt-btn-confirm" onclick="MutualTasksModule.handleConfirmClose('${item.id}')">
                                                ${getSvg('check-check', 13)} Validar y Archivar Definitivamente
                                            </button>
                                        `}
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Footer y Botón para desplegar Bitácora -->
                            <div class="mt-card-footer">
                                <span>Creado por ${roleName(item.createdBy)} • ${escapeHtml(item.createdAt)}</span>
                                <button type="button" class="mt-btn-toggle-log" onclick="MutualTasksModule.toggleLog('${item.id}')">
                                    ${getSvg('message-square', 13)}
                                    ${isLogsOpen ? 'Ocultar bitácora' : `Ver bitácora (${item.notes.length})`}
                                </button>
                            </div>
                        </div>

                        <!-- Bitácora Desplegable -->
                        ${isLogsOpen && item.notes && item.notes.length > 0 ? `
                            <div class="mt-log-drawer">
                                <span class="mt-log-header">Historial de movimientos y notas</span>
                                <div class="mt-log-list">
                                    ${item.notes.map(note => `
                                        <div class="mt-log-item">
                                            <span class="mt-log-author ${note.author === 'admin' ? 'admin' : 'worker'}">
                                                ${note.author === 'admin' ? escapeHtml(roleNames.admin) : escapeHtml(roleNames.worker)}
                                            </span>
                                            <span class="mt-log-text">${escapeHtml(note.text)}</span>
                                            <span class="mt-log-time">${escapeHtml(note.timestamp)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }

        html += `
            </section>

            <!-- MODAL DE CONFIGURACIÓN DE NOMBRES -->
            <div id="mtNamesModal" class="mt-modal-backdrop" style="display: none;" onclick="if(event.target === this) MutualTasksModule.closeNamesModal()">
                <div class="mt-modal-box" style="max-width: 440px;">
                    <div class="mt-modal-head">
                        <h3>⚙️ Personalizar Nombres de las Partes</h3>
                        <button type="button" class="mt-modal-close" onclick="MutualTasksModule.closeNamesModal()">
                            ${getSvg('x', 18)}
                        </button>
                    </div>

                    <form onsubmit="MutualTasksModule.handleSaveNames(event)">
                        <p style="font-size: 0.82rem; color: var(--text-muted, #94a3b8); margin: 0 0 1rem 0; line-height: 1.4;">
                            Define los nombres que aparecerán en todas las tarjetas, turnos y bitácora del sincronizador:
                        </p>

                        <div class="mt-form-group">
                            <label>Nombre Dirección / Admin (Tú)</label>
                            <input type="text" id="mtInputAdminName" class="mt-input" required value="${escapeHtml(roleNames.admin)}" placeholder="Ej: Duvan" />
                        </div>

                        <div class="mt-form-group" style="margin-top: 0.85rem;">
                            <label>Nombre Trabajadora / Colaboradora</label>
                            <input type="text" id="mtInputWorkerName" class="mt-input" required value="${escapeHtml(roleNames.worker)}" placeholder="Ej: Monica" />
                        </div>

                        <div class="mt-modal-actions" style="margin-top: 1.25rem;">
                            <button type="button" class="mt-btn-cancel" onclick="MutualTasksModule.closeNamesModal()">Cancelar</button>
                            <button type="submit" class="mt-btn-primary">Guardar Nombres</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- MODAL DE CREACIÓN DE PENDIENTE -->
            <div id="mtCreateModal" class="mt-modal-backdrop" style="display: none;" onclick="if(event.target === this) MutualTasksModule.closeModal()">
                <div class="mt-modal-box">
                    <div class="mt-modal-head">
                        <h3>Registrar Nuevo Pendiente Mutuo</h3>
                        <button type="button" class="mt-modal-close" onclick="MutualTasksModule.closeModal()">
                            ${getSvg('x', 18)}
                        </button>
                    </div>

                    <form onsubmit="MutualTasksModule.handleCreate(event)">
                        <div class="mt-form-group">
                            <label>¿Qué está pendiente? *</label>
                            <input type="text" id="mtModalTitle" class="mt-input" required placeholder="Ej: Pagar factura de proveedor / Arreglar catálogo web..." />
                        </div>

                        <div class="mt-form-grid-2" style="margin-top: 0.85rem;">
                            <div class="mt-form-group">
                                <label>Categoría</label>
                                <select id="mtModalCat" class="mt-select" onchange="MutualTasksModule.onCategoryChange(this.value)">
                                    <option value="issue">⚠️ Solucionar Problema</option>
                                    <option value="payment">💸 Pago / Dinero</option>
                                    <option value="web">🌐 Página Web / Sistema</option>
                                    <option value="general">📋 Operativo / General</option>
                                </select>
                            </div>

                            <div class="mt-form-group">
                                <label>Prioridad</label>
                                <select id="mtModalPrio" class="mt-select">
                                    <option value="high">🔥 Urgente</option>
                                    <option value="medium" selected>⚡ Normal</option>
                                    <option value="low">🌱 Baja</option>
                                </select>
                            </div>
                        </div>

                        <!-- Monto condicional para pagos -->
                        <div id="mtModalAmountGroup" class="mt-form-group" style="display: none; margin-top: 0.85rem;">
                            <label style="color: #10b981;">Valor en Pesos ($)</label>
                            <input type="number" id="mtModalAmount" class="mt-input" placeholder="Ej: 150000" style="border-color: rgba(16, 185, 129, 0.4);" />
                        </div>

                        <div class="mt-form-grid-2" style="margin-top: 0.85rem;">
                            <div class="mt-form-group">
                                <label>¿En cancha de quién empieza?</label>
                                <select id="mtModalAssign" class="mt-select" style="font-weight: 700; color: #818cf8;">
                                    <option value="worker">En cancha de ${escapeHtml(roleNames.worker)}</option>
                                    <option value="admin">En mi cancha (${escapeHtml(roleNames.admin)})</option>
                                </select>
                            </div>

                            <div class="mt-form-group">
                                <label>Fecha Límite (Opcional)</label>
                                <input type="date" id="mtModalDueDate" class="mt-input" />
                            </div>
                        </div>

                        <div class="mt-form-group" style="margin-top: 0.85rem;">
                            <label>Detalles o Contexto</label>
                            <textarea id="mtModalDesc" class="mt-textarea" rows="3" placeholder="Describe los detalles para que no se pierda información en el camino..."></textarea>
                        </div>

                        <div class="mt-modal-actions">
                            <button type="button" class="mt-btn-cancel" onclick="MutualTasksModule.closeModal()">Cancelar</button>
                            <button type="submit" class="mt-btn-primary">Guardar y Asignar Turno</button>
                        </div>
                    </form>
                </div>
            </div>

        </div>
        `;

        container.innerHTML = html;
    }

    // --- API PÚBLICA ---
    return {
        init,
        render,
        switchRole,
        setActiveTab,
        setSelectedCategory,
        toggleLog,
        updateDraftNote,
        handleCreate,
        handlePassTurn,
        handleRequestReview,
        handleConfirmClose,
        handleRejectReview,
        handleAddComment,
        handleDelete,
        openModal,
        closeModal,
        onCategoryChange,
        openNamesModal,
        closeNamesModal,
        handleSaveNames
    };
})();

// Exportar globalmente
window.MutualTasksModule = MutualTasksModule;
