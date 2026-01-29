// ========================================
// Users Module (Admin Only)
// ========================================

const UsersModule = {
    users: [],
    selectedUserId: null,
    pendingPermissions: {},

    init() {
        // Only initialize for admin
        if (AuthModule.currentUser?.role !== 'admin') return;
    },

    async render() {
        await this.loadUsers();
        this.renderUsersTable();
    },

    async loadUsers() {
        try {
            const { data, error } = await supabaseClient
                .from('app_users')
                .select('*')
                .order('role', { ascending: true });

            if (error) throw error;
            this.users = data || [];
        } catch (err) {
            console.error('Error loading users:', err);
            this.users = [];
        }
    },

    renderUsersTable() {
        const tbody = document.getElementById('usersTable');
        if (!tbody) return;

        tbody.innerHTML = this.users.map(user => `
            <tr>
                <td><strong>${user.username}</strong></td>
                <td>${user.display_name}</td>
                <td>
                    <span class="status-badge ${user.role === 'admin' ? 'status-delivered' : 'status-transit'}">
                        ${user.role === 'admin' ? 'Admin' : 'Empleado'}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${user.is_active ? 'status-delivered' : 'status-cancelled'}">
                        ${user.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>${user.last_login ? new Date(user.last_login).toLocaleString('es-ES') : 'Nunca'}</td>
                <td>
                    ${user.role !== 'admin' ? `
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-secondary btn-sm" onclick="UsersModule.managePermissions('${user.id}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                                Permisos
                            </button>
                            <button class="btn btn-sm ${user.is_active ? 'btn-danger' : 'btn-primary'}" 
                                onclick="UsersModule.toggleUserStatus('${user.id}', ${!user.is_active})">
                                ${user.is_active ? 'Desactivar' : 'Activar'}
                            </button>
                        </div>
                    ` : '<span style="color: var(--text-muted);">No editable</span>'}
                </td>
            </tr>
        `).join('');
    },

    async managePermissions(userId) {
        this.selectedUserId = userId;
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        // Show permissions card
        document.getElementById('permissionsCard').style.display = 'block';
        document.getElementById('permissionsUserName').textContent = user.display_name;

        // Load current permissions
        await this.loadUserPermissions(userId);

        // Render permissions toggles
        this.renderPermissionsGrid();
    },

    async loadUserPermissions(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('user_permissions')
                .select('*')
                .eq('user_id', userId);

            if (error) throw error;

            // Convert to object
            this.pendingPermissions = {};
            const modules = ['dashboard', 'products', 'inventory', 'clients', 'guides', 'confirmation', 'purchases'];

            modules.forEach(module => {
                const perm = data.find(p => p.module === module);
                this.pendingPermissions[module] = {
                    can_access: perm ? perm.can_access : true,
                    can_edit: perm ? perm.can_edit : true
                };
            });

        } catch (err) {
            console.error('Error loading user permissions:', err);
        }
    },

    renderPermissionsGrid() {
        const grid = document.getElementById('permissionsGrid');
        if (!grid) return;

        const moduleNames = {
            dashboard: { name: 'Dashboard', icon: '📊' },
            products: { name: 'Productos', icon: '📦' },
            inventory: { name: 'Inventario', icon: '📈' },
            clients: { name: 'Clientes', icon: '👥' },
            guides: { name: 'Guías de Despacho', icon: '📄' },
            confirmation: { name: 'Confirmación', icon: '✅' },
            purchases: { name: 'Compras', icon: '🛒' }
        };

        grid.innerHTML = Object.entries(moduleNames).map(([key, info]) => {
            const perm = this.pendingPermissions[key] || { can_access: true };
            return `
                <div class="permission-item" style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                        <span style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;">
                            <span style="font-size: 1.25rem;">${info.icon}</span>
                            ${info.name}
                        </span>
                    </div>
                    <label class="toggle-container" style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
                        <input type="checkbox" 
                            id="perm_${key}" 
                            ${perm.can_access ? 'checked' : ''} 
                            onchange="UsersModule.updatePendingPermission('${key}', this.checked)"
                            style="width: 20px; height: 20px; cursor: pointer;">
                        <span style="font-size: 0.875rem; color: var(--text-secondary);">
                            ${perm.can_access ? 'Acceso permitido' : 'Sin acceso'}
                        </span>
                    </label>
                </div>
            `;
        }).join('');
    },

    updatePendingPermission(module, canAccess) {
        this.pendingPermissions[module] = {
            can_access: canAccess,
            can_edit: canAccess
        };

        // Update label
        const checkbox = document.getElementById(`perm_${module}`);
        if (checkbox) {
            const label = checkbox.nextElementSibling;
            if (label) {
                label.textContent = canAccess ? 'Acceso permitido' : 'Sin acceso';
            }
        }
    },

    async savePermissions() {
        if (!this.selectedUserId) return;

        try {
            // Delete existing permissions
            await supabaseClient
                .from('user_permissions')
                .delete()
                .eq('user_id', this.selectedUserId);

            // Insert new permissions
            const permissions = Object.entries(this.pendingPermissions).map(([module, perm]) => ({
                user_id: this.selectedUserId,
                module,
                can_access: perm.can_access,
                can_edit: perm.can_edit
            }));

            const { error } = await supabaseClient
                .from('user_permissions')
                .insert(permissions);

            if (error) throw error;

            Utils.showToast('Permisos guardados exitosamente', 'success');
            this.closePermissions();

        } catch (err) {
            console.error('Error saving permissions:', err);
            Utils.showToast('Error al guardar permisos', 'error');
        }
    },

    closePermissions() {
        this.selectedUserId = null;
        this.pendingPermissions = {};
        document.getElementById('permissionsCard').style.display = 'none';
    },

    async toggleUserStatus(userId, newStatus) {
        try {
            const { error } = await supabaseClient
                .from('app_users')
                .update({ is_active: newStatus })
                .eq('id', userId);

            if (error) throw error;

            Utils.showToast(newStatus ? 'Usuario activado' : 'Usuario desactivado', 'success');
            await this.render();

        } catch (err) {
            console.error('Error toggling user status:', err);
            Utils.showToast('Error al cambiar estado del usuario', 'error');
        }
    }
};

window.UsersModule = UsersModule;
