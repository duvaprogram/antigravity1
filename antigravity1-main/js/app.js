// ========================================
// Main Application Module
// ========================================

const App = {
    _initialized: false,
    currentSection: 'dashboard',
    isLoading: false,

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        // Show loading state
        this.showLoading(true);

        try {
            // Initialize database (connect to Supabase)
            const dbReady = await Database.init();
            if (!dbReady) {
                throw new Error('Failed to connect to database');
            }

            // Initialize theme
            this.initTheme();

            // Initialize all modules
            ProductsModule.init();
            InventoryModule.init();
            ClientsModule.init();
            GuidesModule.init();
            AnalyticsModule.init();
            ConfirmationModule.init();
            PurchasesModule.init();
            FreightsModule.init();
            PaymentsModule.init();
            AccountsModule.init();
            UsersModule.init();
            CampaignsModule.init();
            IncomeStatementModule.init();
            CalculatorModule.init();
            MaterialsCalculatorModule.init();
            FinanceModule.init();
            JournalModule.init();
            if (typeof MultimediaModule !== 'undefined') {
                MultimediaModule.init();
            }

            // Bind navigation events
            this.bindNavigation();

            // Bind global modal close
            this.bindModalClose();

            // Bind mobile menu
            this.bindMobileMenu();

            // Update clock
            this.updateClock();
            setInterval(() => this.updateClock(), 1000);

            // Handle hash navigation
            this.handleHashChange();
            window.addEventListener('hashchange', () => this.handleHashChange());

            console.log('✅ Sistema de Domicilios initialized successfully with Supabase');
            Utils.showToast('Conectado a la base de datos', 'success');

        } catch (error) {
            console.error('❌ Error initializing app:', error);
            Utils.showToast('Error al conectar con la base de datos', 'error');
        } finally {
            this.showLoading(false);
        }
    },

    showLoading(show) {
        this.isLoading = show;
        // Could add a loading overlay here in the future
    },

    initTheme() {
        // Check saved theme or system preference
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

        // Default is dark (no class), light mode adds 'light-mode' class
        if (savedTheme === 'light' || (!savedTheme && systemPrefersLight)) {
            document.body.classList.add('light-mode');
            this.updateThemeIcons(true);
        } else {
            this.updateThemeIcons(false);
        }

        // Bind toggle button
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const isLight = document.body.classList.toggle('light-mode');
                localStorage.setItem('theme', isLight ? 'light' : 'dark');
                this.updateThemeIcons(isLight);
            });
        }
    },

    updateThemeIcons(isLight) {
        const sunIcon = document.querySelector('.icon-sun');
        const moonIcon = document.querySelector('.icon-moon');

        if (sunIcon && moonIcon) {
            if (isLight) {
                // In light mode, show moon (to switch to dark)
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
            } else {
                // In dark mode, show sun (to switch to light)
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
            }
        }
    },

    bindNavigation() {
        document.querySelectorAll('.nav-item, [data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.currentTarget.dataset.section ||
                    e.currentTarget.getAttribute('href').replace('#', '');
                this.navigateTo(section);
            });
        });
    },

    navigateTo(section) {
        // Update URL hash
        window.location.hash = section;

        // Update active nav item
        // Normalize images alias to multimedia
        const normalizedSection = section === 'images' ? 'multimedia' : section;

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === normalizedSection || (normalizedSection === 'multimedia' && item.dataset.section === 'images')) {
                item.classList.add('active');
            }
        });

        // Update page title
        const titles = {
            'dashboard': 'Dashboard',
            'products': 'Productos',
            'inventory': 'Inventario',
            'clients': 'Clientes',
            'guides': 'Guías de Despacho',
            'analytics': 'Análisis de Datos',
            'confirmation': 'Confirmación de Pedidos',
            'purchases': 'Compras a Proveedores',
            'freights': 'Fletes - Pagos de Movilización',
            'payments': 'Gestión de Pagos',
            'accounts': 'Cuentas y Flujo de Efectivo',
            'users': 'Administración de Usuarios',
            'campaigns': 'Creación de Campañas',
            'income-statement': 'Estado de Resultados',
            'calculator': 'Calculadora de Utilidad',
            'materials-calculator': 'Calculadora de Materiales',
            'finance': 'Finanzas Personales',
            'multimedia': 'Multimedia (Imágenes y Videos)',
            'images': 'Multimedia (Imágenes y Videos)',
            'journal': 'Diario y Metas'
        };

        document.getElementById('pageTitle').textContent = titles[normalizedSection] || titles[section] || 'Dashboard';

        // Show/hide sections
        document.querySelectorAll('.content-section').forEach(s => {
            s.classList.remove('active');
        });

        const targetSection = document.getElementById(`section-${normalizedSection}`) || document.getElementById(`section-${section}`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Render section content
        this.renderSection(normalizedSection);

        // Close mobile menu
        document.getElementById('sidebar').classList.remove('open');

        this.currentSection = normalizedSection;
    },

    handleHashChange() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        this.navigateTo(hash);
    },

    async renderSection(section) {
        switch (section) {
            case 'dashboard':
                await this.updateDashboard();
                break;
            case 'products':
                await ProductsModule.render();
                break;
            case 'inventory':
                await InventoryModule.render();
                break;
            case 'clients':
                await ClientsModule.render();
                break;
            case 'guides':
                await GuidesModule.render();
                break;
            case 'analytics':
                await AnalyticsModule.render();
                break;
            case 'confirmation':
                await ConfirmationModule.render();
                break;
            case 'purchases':
                await PurchasesModule.render();
                break;
            case 'freights':
                await FreightsModule.render();
                break;
            case 'payments':
                await PaymentsModule.render();
                break;
            case 'accounts':
                await AccountsModule.render();
                break;
            case 'users':
                await UsersModule.render();
                break;
            case 'campaigns':
                if (!CampaignsModule.initialized) {
                    await CampaignsModule.init();
                } else {
                    await CampaignsModule.loadAllDataFromDb();
                }
                break;
            case 'income-statement':
                await IncomeStatementModule.render();
                break;
            case 'calculator':
                CalculatorModule.init();
                break;
            case 'materials-calculator':
                MaterialsCalculatorModule.init();
                break;
            case 'finance':
                if (typeof FinanceModule.render === 'function') {
                    await FinanceModule.render();
                } else {
                    FinanceModule.init();
                }
                break;
            case 'multimedia':
            case 'images':
                if (typeof MultimediaModule !== 'undefined') {
                    await MultimediaModule.init();
                }
                break;
            case 'journal':
                if (typeof JournalModule.render === 'function') {
                    await JournalModule.render();
                } else {
                    JournalModule.init();
                }
                break;

        }
    },

    async updateDashboard() {
        try {
            // Stats - now async
            const [products, inventory, clients, todayGuides, guides] = await Promise.all([
                Database.getProducts(),
                Database.getInventory(),
                Database.getClients(),
                Database.getTodayGuides(),
                Database.getGuides()
            ]);

            document.getElementById('statProducts').textContent = products.filter(p => p.active).length;
            document.getElementById('statInventory').textContent = inventory.reduce((sum, i) => sum + i.available, 0);
            document.getElementById('statClients').textContent = clients.length;
            document.getElementById('statGuides').textContent = todayGuides.length;

            // Calculate total inventory cost (cost * available quantity)
            const totalInventoryCost = inventory.reduce((sum, item) => {
                // Fallback to product cost if view doesn't return it directly
                const product = products.find(p => p.id === item.productId);
                let itemCost;
                if (product && typeof window.ProductsModule !== 'undefined' && typeof window.ProductsModule.getRealCost === 'function') {
                    itemCost = window.ProductsModule.getRealCost(product);
                } else {
                    const rawCost = item.cost || (product ? product.cost : 0) || 0;
                    itemCost = rawCost * 40000;
                }
                return sum + (itemCost * (item.available || 0));
            }, 0);
            document.getElementById('statTotalProductCost').textContent = `$${totalInventoryCost.toFixed(2)}`;

            // Recent guides
            const recentGuides = guides.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
            const recentGuidesTable = document.getElementById('recentGuidesTable');

            if (recentGuides.length === 0) {
                recentGuidesTable.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; color: var(--text-muted);">
                            No hay guías recientes
                        </td>
                    </tr>
                `;
            } else {
                recentGuidesTable.innerHTML = recentGuides.map(guide => {
                    const statusClass = Utils.getStatusClass(guide.status);
                    const cityClass = guide.city.toLowerCase();

                    return `
                        <tr onclick="App.navigateTo('guides'); GuidesModule.viewGuide('${guide.id}')" style="cursor: pointer;">
                            <td><strong style="color: var(--primary);">${guide.guideNumber}</strong></td>
                            <td>${Utils.escapeHtml(guide.clientName || 'N/A')}</td>
                            <td><span class="city-badge ${cityClass}">${guide.city}</span></td>
                            <td><span class="status-badge ${statusClass}">${guide.status}</span></td>
                        </tr>
                    `;
                }).join('');
            }

            // Low stock items
            const lowStockItems = await Database.getLowStockItems();
            const lowStockList = document.getElementById('lowStockList');

            if (lowStockItems.length === 0) {
                lowStockList.innerHTML = `
                    <li style="text-align: center; color: var(--text-muted); padding: 1rem;">
                        <span style="color: var(--success);">✓</span> Todo el inventario está en niveles óptimos
                    </li>
                `;
            } else {
                lowStockList.innerHTML = lowStockItems.slice(0, 5).map(item => {
                    return `
                        <li>
                            <span class="product-name">${Utils.escapeHtml(item.productName || 'N/A')}</span>
                            <span class="stock-qty">${item.available} uds</span>
                        </li>
                    `;
                }).join('');
            }

            // City stats chart
            const quitoGuides = guides.filter(g => g.city === 'Quito').length;
            const guayaquilGuides = guides.filter(g => g.city === 'Guayaquil').length;
            const maxGuides = Math.max(quitoGuides, guayaquilGuides, 1);

            document.getElementById('quitoBar').style.width = `${(quitoGuides / maxGuides) * 100}%`;
            document.getElementById('guayaquilBar').style.width = `${(guayaquilGuides / maxGuides) * 100}%`;
            document.getElementById('quitoCount').textContent = quitoGuides;
            document.getElementById('guayaquilCount').textContent = guayaquilGuides;

        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
    },

    bindModalClose() {
        // Close modal when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                });
            }
        });

        // Global handler for close buttons (data-close attribute)
        document.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('[data-close]');
            if (closeBtn) {
                const modalId = closeBtn.getAttribute('data-close');
                if (modalId) {
                    const modal = document.getElementById(modalId);
                    if (modal) {
                        modal.classList.remove('active');
                        document.body.style.overflow = '';
                    }
                }
            }
        });
    },

    bindMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');

        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            }
        });
    },

    updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('es-EC', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const dateString = now.toLocaleDateString('es-EC', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
        document.getElementById('currentTime').textContent = `${dateString} · ${timeString}`;
    },

    async syncAllOnline(options = { showToast: true }) {
        const syncBtns = document.querySelectorAll('.global-sync-btn .sync-icon, .global-sync-btn-sidebar .sync-icon');
        syncBtns.forEach(icon => icon.classList.add('spin-icon'));
        
        try {
            console.log('🔄 Sincronizando toda la aplicación online con Supabase...');
            
            // 1. Re-init database cache (cities, statuses, categories, pages)
            if (window.Database && typeof Database.init === 'function') {
                await Database.init();
            }

            // 2. Sync Journal and Goals from Supabase
            if (window.JournalModule) {
                if (typeof JournalModule.downloadCloudToLocal === 'function') {
                    await JournalModule.downloadCloudToLocal(false);
                } else if (typeof JournalModule.loadData === 'function') {
                    await JournalModule.loadData();
                }
            }

            // 3. Sync Income Statement & Finance if available
            if (window.IncomeStatementModule && typeof IncomeStatementModule.loadData === 'function') {
                await IncomeStatementModule.loadData();
            }
            if (window.FinanceModule && typeof FinanceModule.loadData === 'function') {
                await FinanceModule.loadData();
            }

            // 4. Sync Campaigns & Ads & Sales & Reports from Supabase
            if (window.CampaignsModule && typeof CampaignsModule.loadAllDataFromDb === 'function') {
                await CampaignsModule.loadAllDataFromDb();
            }

            // 5. Update Dashboard stats
            await this.updateDashboard();

            // 6. Re-render active section
            await this.renderSection(this.currentSection);

            if (options.showToast) {
                Utils.showToast('✅ ¡Toda la información ha sido sincronizada online con Supabase!', 'success');
            }
            return true;
        } catch (error) {
            console.error('❌ Error en sincronización global:', error);
            if (options.showToast) {
                Utils.showToast('Error sincronizando con la nube: ' + (error.message || error), 'error');
            }
            return false;
        } finally {
            setTimeout(() => {
                syncBtns.forEach(icon => icon.classList.remove('spin-icon'));
            }, 600);
        }
    }
};

// App.init() is now called by AuthModule after login
// Do NOT auto-initialize here

// Make App available globally
window.App = App;
