// ========================================
// Authentication Module
// ========================================

const AuthModule = {
    currentUser: null,
    permissions: {},

    init() {
        this.bindEvents();
        this.checkSession();
    },

    bindEvents() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }
    },

    checkSession() {
        // Check if user is stored in sessionStorage
        const savedUser = sessionStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.loadPermissions().then(() => {
                this.showApp();
            });
        }
    },

    async login() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');

        if (!username || !password) {
            this.showLoginError('Por favor ingresa usuario y contraseña');
            return;
        }

        try {
            // Query user from database
            const { data: users, error } = await supabaseClient
                .from('app_users')
                .select('*')
                .eq('username', username)
                .eq('password_hash', password)
                .eq('is_active', true)
                .single();

            if (error || !users) {
                this.showLoginError('Usuario o contraseña incorrectos');
                return;
            }

            // Save user to session
            this.currentUser = users;
            sessionStorage.setItem('currentUser', JSON.stringify(users));

            // Update last login
            await supabaseClient
                .from('app_users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', users.id);

            // Load permissions
            await this.loadPermissions();

            // Show app
            this.showApp();

        } catch (err) {
            console.error('Login error:', err);
            this.showLoginError('Error al iniciar sesión');
        }
    },

    async loadPermissions() {
        if (!this.currentUser) return;

        // Admin has all permissions
        if (this.currentUser.role === 'admin') {
            this.permissions = {
                dashboard: { can_access: true, can_edit: true },
                products: { can_access: true, can_edit: true },
                inventory: { can_access: true, can_edit: true },
                clients: { can_access: true, can_edit: true },
                guides: { can_access: true, can_edit: true },
                analytics: { can_access: true, can_edit: true },
                confirmation: { can_access: true, can_edit: true },
                purchases: { can_access: true, can_edit: true },
                accounts: { can_access: true, can_edit: true },
                users: { can_access: true, can_edit: true }
            };
            return;
        }

        try {
            const { data: perms, error } = await supabaseClient
                .from('user_permissions')
                .select('*')
                .eq('user_id', this.currentUser.id);

            if (error) throw error;

            // Convert to object
            this.permissions = {};
            perms.forEach(p => {
                this.permissions[p.module] = {
                    can_access: p.can_access,
                    can_edit: p.can_edit
                };
            });

        } catch (err) {
            console.error('Error loading permissions:', err);
        }
    },

    showLoginError(message) {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 3000);
        }
    },

    showApp() {
        // Hide login screen
        document.getElementById('loginScreen').style.display = 'none';

        // Show app container
        document.getElementById('appContainer').style.display = 'flex';

        // Update user info in sidebar
        this.updateUserInfo();

        // Apply permissions to navigation
        this.applyPermissions();

        // Initialize the app
        App.init();
    },

    updateUserInfo() {
        if (!this.currentUser) return;

        const initial = document.getElementById('userInitial');
        const displayName = document.getElementById('userDisplayName');
        const role = document.getElementById('userRole');

        if (initial) {
            initial.textContent = this.currentUser.display_name.charAt(0).toUpperCase();
        }
        if (displayName) {
            displayName.textContent = this.currentUser.display_name;
        }
        if (role) {
            role.textContent = this.currentUser.role === 'admin' ? 'Administrador' : 'Empleado';
        }
    },

    applyPermissions() {
        // Show/hide nav items based on permissions
        const navItems = document.querySelectorAll('.nav-item[data-section]');

        navItems.forEach(item => {
            const section = item.dataset.section;

            // Admin-only items
            if (item.classList.contains('nav-admin-only')) {
                item.style.display = this.currentUser.role === 'admin' ? 'flex' : 'none';
                return;
            }

            // Check permission for this module
            const perm = this.permissions[section];
            if (perm && !perm.can_access) {
                item.style.display = 'none';
            } else {
                item.style.display = 'flex';
            }
        });
    },

    canAccess(module) {
        if (this.currentUser?.role === 'admin') return true;
        return this.permissions[module]?.can_access || false;
    },

    canEdit(module) {
        if (this.currentUser?.role === 'admin') return true;
        return this.permissions[module]?.can_edit || false;
    },

    logout() {
        this.currentUser = null;
        this.permissions = {};
        sessionStorage.removeItem('currentUser');

        // Hide app, show login
        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';

        // Clear form
        document.getElementById('loginForm').reset();
    }
};

window.AuthModule = AuthModule;

// Initialize auth module when page loads
document.addEventListener('DOMContentLoaded', () => {
    AuthModule.init();
});
