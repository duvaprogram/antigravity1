// ========================================
// Database Module (Supabase)
// ========================================

const Database = {
    // Cache for cities and statuses (to avoid repeated queries)
    _cache: {
        cities: null,
        statuses: null,
        pages: null,
        categories: null
    },

    // Initialize database - load cache data
    async init() {
        try {
            // Load cities into cache
            const { data: cities } = await supabaseClient
                .from('cities')
                .select('*')
                .eq('active', true);
            this._cache.cities = cities || [];

            // Load statuses into cache
            const { data: statuses } = await supabaseClient
                .from('guide_statuses')
                .select('*')
                .order('sort_order');
            this._cache.statuses = statuses || [];

            // Load pages into cache
            const { data: pages } = await supabaseClient
                .from('pages')
                .select('*')
                .eq('active', true);
            this._cache.pages = pages || [];

            // Load categories into cache
            const { data: categories } = await supabaseClient
                .from('categories')
                .select('*')
                .eq('active', true);
            this._cache.categories = categories || [];

            console.log('✅ Database initialized with Supabase');
            console.log('   Cities:', this._cache.cities.length);
            console.log('   Statuses:', this._cache.statuses.length);
            console.log('   Pages:', this._cache.pages.length);
            console.log('   Categories:', this._cache.categories.length);

            return true;
        } catch (error) {
            console.error('❌ Error initializing database:', error);
            return false;
        }
    },

    // Helper: Get city ID by name
    getCityId(cityName) {
        const city = this._cache.cities.find(c => c.name === cityName);
        return city ? city.id : null;
    },

    // Helper: Get city name by ID
    getCityName(cityId) {
        const city = this._cache.cities.find(c => c.id === cityId);
        return city ? city.name : null;
    },

    // Helper: Get status ID by name
    getStatusId(statusName) {
        const status = this._cache.statuses.find(s => s.name === statusName);
        return status ? status.id : null;
    },

    // Helper: Get status name by ID
    getStatusName(statusId) {
        const status = this._cache.statuses.find(s => s.id === statusId);
        return status ? status.name : null;
    },

    // Helper: Get page ID by name
    getPageId(pageName) {
        const page = this._cache.pages.find(p => p.name === pageName);
        return page ? page.id : null;
    },

    // ========================================
    // PRODUCTS
    // ========================================
    async getProducts() {
        try {
            const { data, error } = await supabaseClient
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform to match existing format
            return (data || []).map(p => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                description: p.description,
                category: p.category,
                import_number: p.import_number,
                cost: parseFloat(p.cost) || 0,
                price: parseFloat(p.price),
                active: p.active,
                createdAt: p.created_at
            }));
        } catch (error) {
            console.error('Error fetching products:', error);
            return [];
        }
    },

    async getProduct(id) {
        try {
            const { data, error } = await supabaseClient
                .from('products')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            return data ? {
                id: data.id,
                name: data.name,
                sku: data.sku,
                description: data.description,
                category: data.category,
                import_number: data.import_number,
                cost: parseFloat(data.cost) || 0,
                price: parseFloat(data.price),
                active: data.active,
                createdAt: data.created_at
            } : null;
        } catch (error) {
            console.error('Error fetching product:', error);
            return null;
        }
    },

    async saveProduct(product) {
        try {
            const productData = {
                name: product.name,
                sku: product.sku,
                description: product.description || null,
                category: product.category,
                import_number: product.import_number || null,
                price: product.price,
                active: product.active !== false
            };

            // Only include cost if it was provided (admin only)
            if (product.cost !== undefined) {
                productData.cost = product.cost;
            }

            let result;
            if (product.id) {
                // Update existing
                const { data, error } = await supabaseClient
                    .from('products')
                    .update(productData)
                    .eq('id', product.id)
                    .select()
                    .single();
                if (error) throw error;
                result = data;
            } else {
                // Insert new
                const { data, error } = await supabaseClient
                    .from('products')
                    .insert(productData)
                    .select()
                    .single();
                if (error) throw error;
                result = data;
            }

            return {
                id: result.id,
                name: result.name,
                sku: result.sku,
                description: result.description,
                import_number: result.import_number,
                cost: parseFloat(result.cost) || 0,
                price: parseFloat(result.price),
                active: result.active,
                createdAt: result.created_at
            };
        } catch (error) {
            console.error('Error saving product:', error);
            throw error;
        }
    },

    async deleteProduct(id) {
        try {
            // Hard delete - actually remove from database
            const { error } = await supabaseClient
                .from('products')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting product:', error);
            throw error;
        }
    },

    // ========================================
    // INVENTORY
    // ========================================
    async getInventory() {
        try {
            const { data, error } = await supabaseClient
                .from('v_inventory_complete')
                .select('*');

            if (error) throw error;

            return (data || []).map(i => ({
                id: i.id,
                productId: i.product_id,
                productName: i.product_name,
                sku: i.sku,
                category: i.category,
                cost: parseFloat(i.cost) || 0,
                price: parseFloat(i.price),
                city: i.city_name,
                cityId: i.city_id,
                available: i.available,
                reserved: i.reserved,
                minStock: i.min_stock,
                isLowStock: i.is_low_stock,
                updatedAt: i.updated_at
            }));
        } catch (error) {
            console.error('Error fetching inventory:', error);
            return [];
        }
    },

    async getInventoryByCity(city) {
        try {
            let query = supabaseClient
                .from('v_inventory_complete')
                .select('*');

            if (city !== 'all') {
                query = query.eq('city_name', city);
            }

            const { data, error } = await query;
            if (error) throw error;

            return (data || []).map(i => ({
                id: i.id,
                productId: i.product_id,
                productName: i.product_name,
                sku: i.sku,
                category: i.category,
                cost: parseFloat(i.cost) || 0,
                price: parseFloat(i.price),
                city: i.city_name,
                cityId: i.city_id,
                available: i.available,
                reserved: i.reserved,
                minStock: i.min_stock,
                isLowStock: i.is_low_stock,
                updatedAt: i.updated_at
            }));
        } catch (error) {
            console.error('Error fetching inventory by city:', error);
            return [];
        }
    },

    async getInventoryByProduct(productId, city) {
        try {
            const cityId = this.getCityId(city);
            const { data, error } = await supabaseClient
                .from('inventory')
                .select('*')
                .eq('product_id', productId)
                .eq('city_id', cityId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            return data ? {
                id: data.id,
                productId: data.product_id,
                city: city,
                available: data.available,
                reserved: data.reserved,
                minStock: data.min_stock
            } : null;
        } catch (error) {
            console.error('Error fetching inventory by product:', error);
            return null;
        }
    },

    async updateInventory(productId, city, quantity, minStock = 5, isAdjustment = false) {
        try {
            const cityId = this.getCityId(city);
            if (!cityId) throw new Error('City not found: ' + city);

            // Check if inventory record exists
            const existing = await this.getInventoryByProduct(productId, city);

            if (existing) {
                // Update existing
                // If isAdjustment is true, quantity IS the new available stock.
                // Otherwise, it's added to existing.
                const newAvailable = isAdjustment ? quantity : (existing.available + quantity);

                const { data, error } = await supabaseClient
                    .from('inventory')
                    .update({
                        available: newAvailable,
                        min_stock: minStock
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            } else {
                // Create new
                // For new records, quantity is the starting amount regardless of isAdjustment
                const { data, error } = await supabaseClient
                    .from('inventory')
                    .insert({
                        product_id: productId,
                        city_id: cityId,
                        available: quantity,
                        reserved: 0,
                        min_stock: minStock
                    })
                    .select()
                    .single();
                if (error) throw error;
                return data;
            }
        } catch (error) {
            console.error('Error updating inventory:', error);
            throw error;
        }
    },

    async deleteInventory(productId, city) {
        try {
            const cityId = this.getCityId(city);
            if (!cityId) throw new Error('City not found: ' + city);

            const { error } = await supabaseClient
                .from('inventory')
                .delete()
                .eq('product_id', productId)
                .eq('city_id', cityId);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting inventory:', error);
            throw error;
        }
    },

    async decreaseStock(productId, city, quantity) {
        try {
            const existing = await this.getInventoryByProduct(productId, city);
            if (!existing || existing.available < quantity) {
                return null;
            }

            const { data, error } = await supabaseClient
                .from('inventory')
                .update({ available: existing.available - quantity })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error decreasing stock:', error);
            return null;
        }
    },

    async increaseStock(productId, city, quantity) {
        try {
            const existing = await this.getInventoryByProduct(productId, city);
            if (!existing) {
                return await this.updateInventory(productId, city, quantity);
            }

            const { data, error } = await supabaseClient
                .from('inventory')
                .update({
                    available: existing.available + quantity
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error increasing stock:', error);
            throw error;
        }
    },

    async getLowStockItems() {
        try {
            const { data, error } = await supabaseClient
                .from('v_inventory_complete')
                .select('*')
                .eq('is_low_stock', true);

            if (error) throw error;

            return (data || []).map(i => ({
                id: i.id,
                productId: i.product_id,
                productName: i.product_name,
                sku: i.sku,
                city: i.city_name,
                available: i.available,
                minStock: i.min_stock
            }));
        } catch (error) {
            console.error('Error fetching low stock items:', error);
            return [];
        }
    },

    async registerInventoryMovement(movement) {
        try {
            const cityId = this.getCityId(movement.city);
            if (!cityId) throw new Error('City not found: ' + movement.city);

            const { data, error } = await supabaseClient
                .from('inventory_movements')
                .insert({
                    product_id: movement.productId,
                    city_id: cityId,
                    movement_type: movement.movementType,
                    quantity: movement.quantity,
                    previous_stock: movement.previousStock,
                    new_stock: movement.newStock,
                    reason: movement.reason,
                    created_by: 'Usuario' // Later can be replaced with actual user
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error registering inventory movement:', error);
            throw error;
        }
    },

    async getInventoryMovements(filters = {}) {
        try {
            let query = supabaseClient
                .from('inventory_movements')
                .select(`
                    *,
                    products (name, sku),
                    cities (name)
                `)
                .order('created_at', { ascending: false })
                .limit(100);

            if (filters.city) {
                const cityId = this.getCityId(filters.city);
                if (cityId) {
                    query = query.eq('city_id', cityId);
                }
            }

            if (filters.movementType) {
                query = query.eq('movement_type', filters.movementType);
            }

            if (filters.date) {
                const startDate = new Date(filters.date);
                startDate.setHours(0, 0, 0, 0);
                const endDate = new Date(filters.date);
                endDate.setHours(23, 59, 59, 999);
                query = query.gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString());
            }

            const { data, error } = await query;

            if (error) throw error;

            return (data || []).map(m => ({
                id: m.id,
                productId: m.product_id,
                productName: m.products?.name || 'Producto eliminado',
                sku: m.products?.sku || '',
                cityId: m.city_id,
                city: m.cities?.name || '',
                movementType: m.movement_type,
                quantity: m.quantity,
                previousStock: m.previous_stock,
                newStock: m.new_stock,
                reason: m.reason,
                createdBy: m.created_by,
                createdAt: m.created_at
            }));
        } catch (error) {
            console.error('Error fetching inventory movements:', error);
            return [];
        }
    },

    // ========================================
    // CLIENTS
    // ========================================
    async getClients() {
        try {
            const { data, error } = await supabaseClient
                .from('clients')
                .select(`
                    *,
                    cities (name)
                `)
                .eq('active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map(c => ({
                id: c.id,
                fullName: c.full_name,
                phone: c.phone,
                email: c.email,
                address: c.address,
                city: c.cities?.name || '',
                cityId: c.city_id,
                reference: c.reference,
                notes: c.notes,
                createdAt: c.created_at
            }));
        } catch (error) {
            console.error('Error fetching clients:', error);
            return [];
        }
    },

    async getClient(id) {
        try {
            const { data, error } = await supabaseClient
                .from('clients')
                .select(`
                    *,
                    cities (name)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            return data ? {
                id: data.id,
                fullName: data.full_name,
                phone: data.phone,
                email: data.email,
                address: data.address,
                city: data.cities?.name || '',
                cityId: data.city_id,
                reference: data.reference,
                notes: data.notes,
                createdAt: data.created_at
            } : null;
        } catch (error) {
            console.error('Error fetching client:', error);
            return null;
        }
    },

    async saveClient(client) {
        try {
            const cityId = this.getCityId(client.city);
            if (!cityId) throw new Error('City not found: ' + client.city);

            const clientData = {
                full_name: client.fullName,
                phone: client.phone,
                email: client.email || null,
                address: client.address,
                city_id: cityId,
                reference: client.reference || null,
                notes: client.notes || null,
                active: true
            };

            let result;
            if (client.id) {
                const { data, error } = await supabaseClient
                    .from('clients')
                    .update(clientData)
                    .eq('id', client.id)
                    .select(`*, cities (name)`)
                    .single();
                if (error) throw error;
                result = data;
            } else {
                const { data, error } = await supabaseClient
                    .from('clients')
                    .insert(clientData)
                    .select(`*, cities (name)`)
                    .single();
                if (error) throw error;
                result = data;
            }

            return {
                id: result.id,
                fullName: result.full_name,
                phone: result.phone,
                email: result.email,
                address: result.address,
                city: result.cities?.name || '',
                reference: result.reference,
                createdAt: result.created_at
            };
        } catch (error) {
            console.error('Error saving client:', error);
            throw error;
        }
    },

    async searchClients(query) {
        try {
            const { data, error } = await supabaseClient
                .from('clients')
                .select(`*, cities (name)`)
                .eq('active', true)
                .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`);

            if (error) throw error;

            return (data || []).map(c => ({
                id: c.id,
                fullName: c.full_name,
                phone: c.phone,
                address: c.address,
                city: c.cities?.name || '',
                reference: c.reference
            }));
        } catch (error) {
            console.error('Error searching clients:', error);
            return [];
        }
    },

    // ========================================
    // GUIDES
    // ========================================
    async getGuides() {
        try {
            const { data, error } = await supabaseClient
                .from('v_guides_complete')
                .select(`
                    *,
                    guide_items ( products ( name ) ),
                    guide_metadata ( source )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map(g => ({
                id: g.id,
                guideNumber: g.guide_number,
                clientId: g.client_id,
                clientName: g.client_name,
                clientPhone: g.client_phone,
                clientAddress: g.client_address,
                city: g.city_name,
                status: g.status_name,
                statusColor: g.status_color,
                totalAmount: parseFloat(g.total_amount),
                shippingCost: parseFloat(g.shipping_cost || 0),
                shippingCostOriginal: g.shipping_cost_original ? parseFloat(g.shipping_cost_original) : null,
                shippingAdjustedAt: g.shipping_adjusted_at,
                shippingAdjustmentNote: g.shipping_adjustment_note,
                observations: g.observations,
                itemsCount: g.items_count,
                items: g.guide_items || [],
                source: (g.guide_metadata && g.guide_metadata.source) ? g.guide_metadata.source : 'Manual',
                createdAt: g.created_at,
                deliveryDate: g.delivery_date,
                deliveredAt: g.delivered_at,
                amountUsd: g.amount_usd ? parseFloat(g.amount_usd) : null,
                paymentBs: g.payment_bs ? parseFloat(g.payment_bs) : null,
                deliveryTime: g.delivery_time
            }));
        } catch (error) {
            console.error('Error fetching guides:', error);
            return [];
        }
    },

    async getGuide(id) {
        try {
            const { data, error } = await supabaseClient
                .from('v_guides_complete')
                .select(`
                    *,
                    guide_metadata ( source )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            return data ? {
                id: data.id,
                guideNumber: data.guide_number,
                clientId: data.client_id,
                clientName: data.client_name,
                clientPhone: data.client_phone,
                clientAddress: data.client_address,
                city: data.city_name,
                status: data.status_name,
                statusColor: data.status_color,
                totalAmount: parseFloat(data.total_amount),
                shippingCost: data.shipping_cost ? parseFloat(data.shipping_cost) : null,
                shippingCostOriginal: data.shipping_cost_original ? parseFloat(data.shipping_cost_original) : null,
                shippingAdjustedAt: data.shipping_adjusted_at,
                shippingAdjustmentNote: data.shipping_adjustment_note,
                observations: data.observations,
                source: (data.guide_metadata && data.guide_metadata.source) ? data.guide_metadata.source : 'Manual',
                createdAt: data.created_at,
                amountUsd: data.amount_usd ? parseFloat(data.amount_usd) : null,
                paymentBs: data.payment_bs ? parseFloat(data.payment_bs) : null,
                deliveryTime: data.delivery_time
            } : null;
        } catch (error) {
            console.error('Error fetching guide:', error);
            return null;
        }
    },

    async saveGuide(guide) {
        try {
            // Get client to determine city
            const client = await this.getClient(guide.clientId);
            if (!client) throw new Error('Client not found');

            const cityId = this.getCityId(client.city);
            const statusId = this.getStatusId(guide.status || 'Pendiente');

            if (!cityId || !statusId) {
                throw new Error('City or status not found');
            }

            let result;
            if (guide.id) {
                // Update existing guide
                const updateData = {
                    client_id: guide.clientId,
                    city_id: cityId,
                    status_id: statusId,
                    total_amount: guide.totalAmount || 0,
                    shipping_cost: guide.shippingCost || null,
                    observations: guide.observations || null,
                    amount_usd: guide.amountUsd || null,
                    payment_bs: guide.paymentBs || null,
                    delivery_time: guide.deliveryTime || null
                };
                if (guide.createdAt) {
                    updateData.created_at = guide.createdAt;
                }

                const { data, error } = await supabaseClient
                    .from('guides')
                    .update(updateData)
                    .eq('id', guide.id)
                    .select()
                    .single();
                if (error) throw error;
                result = data;
            } else {
                // Generate guide number
                const { data: guideNum } = await supabaseClient
                    .rpc('generate_guide_number');

                const insertData = {
                    guide_number: guideNum,
                    client_id: guide.clientId,
                    city_id: cityId,
                    status_id: statusId,
                    total_amount: guide.totalAmount || 0,
                    shipping_cost: guide.shippingCost || null,
                    observations: guide.observations || null,
                    amount_usd: guide.amountUsd || null,
                    payment_bs: guide.paymentBs || null,
                    delivery_time: guide.deliveryTime || null
                };
                if (guide.createdAt) {
                    insertData.created_at = guide.createdAt;
                }

                const { data, error } = await supabaseClient
                    .from('guides')
                    .insert(insertData)
                    .select()
                    .single();
                if (error) throw error;
                result = data;
            }

            return {
                id: result.id,
                guideNumber: result.guide_number,
                clientId: result.client_id,
                city: client.city,
                status: guide.status || 'Pendiente',
                createdAt: result.created_at
            };
        } catch (error) {
            console.error('Error saving guide:', error);
            throw error;
        }
    },

    async updateGuideStatus(guideId, newStatus) {
        try {
            const statusId = this.getStatusId(newStatus);
            if (!statusId) throw new Error('Status not found: ' + newStatus);

            const updateData = { status_id: statusId };
            if (newStatus === 'Entregado') {
                updateData.delivered_at = new Date().toISOString();
            }

            const { error } = await supabaseClient
                .from('guides')
                .update(updateData)
                .eq('id', guideId);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating guide status:', error);
            throw error;
        }
    },

    async updateGuideShippingCost(guideId, newShippingCost, adjustmentNote) {
        try {
            // First get the current guide to save original cost if not already saved
            const { data: currentGuide, error: fetchError } = await supabaseClient
                .from('guides')
                .select('shipping_cost, shipping_cost_original')
                .eq('id', guideId)
                .single();

            if (fetchError) throw fetchError;

            const updateData = {
                shipping_cost: newShippingCost,
                shipping_adjusted_at: new Date().toISOString(),
                shipping_adjustment_note: adjustmentNote || null
            };

            // Only save original cost the first time we adjust
            if (!currentGuide.shipping_cost_original && currentGuide.shipping_cost) {
                updateData.shipping_cost_original = currentGuide.shipping_cost;
            }

            const { error } = await supabaseClient
                .from('guides')
                .update(updateData)
                .eq('id', guideId);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating guide shipping cost:', error);
            throw error;
        }
    },

    // ========================================
    // GUIDE INCIDENTS (NOVEDADES)
    // ========================================
    async getGuideIncidents(guideId) {
        try {
            const { data, error } = await supabaseClient
                .from('guide_incidents')
                .select('*')
                .eq('guide_id', guideId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return (data || []).map(i => ({
                id: i.id,
                guideId: i.guide_id,
                actionType: i.action_type,
                description: i.description,
                actionNumber: i.action_number,
                createdAt: i.created_at,
                createdBy: i.created_by
            }));
        } catch (error) {
            console.error('Error fetching guide incidents:', error);
            return [];
        }
    },

    async addGuideIncident(guideId, actionType, description) {
        try {
            // Get current count of incidents for this guide to set action number
            const { data: existing } = await supabaseClient
                .from('guide_incidents')
                .select('id')
                .eq('guide_id', guideId);

            const actionNumber = (existing ? existing.length : 0) + 1;

            const { data, error } = await supabaseClient
                .from('guide_incidents')
                .insert({
                    guide_id: guideId,
                    action_type: actionType,
                    description: description || null,
                    action_number: actionNumber
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error adding guide incident:', error);
            throw error;
        }
    },

    async getGuidesWithIncidentCounts() {
        try {
            // Get all guides with status "Novedad"
            const novedadStatusId = this.getStatusId('Novedad');
            if (!novedadStatusId) return [];

            const { data: guides, error } = await supabaseClient
                .from('v_guides_complete')
                .select('*')
                .eq('status_name', 'Novedad')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Get incident counts for each guide
            const result = [];
            for (const g of (guides || [])) {
                const { data: incidents } = await supabaseClient
                    .from('guide_incidents')
                    .select('id, action_type, created_at')
                    .eq('guide_id', g.id)
                    .order('created_at', { ascending: false });

                result.push({
                    id: g.id,
                    guideNumber: g.guide_number,
                    clientName: g.client_name,
                    clientPhone: g.client_phone,
                    city: g.city_name,
                    totalAmount: parseFloat(g.total_amount),
                    createdAt: g.created_at,
                    incidentCount: incidents ? incidents.length : 0,
                    lastIncident: incidents && incidents.length > 0 ? {
                        type: incidents[0].action_type,
                        date: incidents[0].created_at
                    } : null
                });
            }

            return result;
        } catch (error) {
            console.error('Error fetching novedades:', error);
            return [];
        }
    },

    async deleteGuide(id) {
        try {
            // Delete guide items first (if cascade is not enabled)
            const { error: errorItems } = await supabaseClient
                .from('guide_items')
                .delete()
                .eq('guide_id', id);

            if (errorItems) throw errorItems;

            // Delete guide
            const { error } = await supabaseClient
                .from('guides')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting guide:', error);
            throw error;
        }
    },

    async getGuidesByCity(city) {
        try {
            let query = supabaseClient
                .from('v_guides_complete')
                .select(`
                    *,
                    guide_metadata ( source )
                `)
                .order('created_at', { ascending: false });

            if (city !== 'all') {
                query = query.eq('city_name', city);
            }

            const { data, error } = await query;
            if (error) throw error;

            return (data || []).map(g => ({
                id: g.id,
                guideNumber: g.guide_number,
                clientId: g.client_id,
                clientName: g.client_name,
                city: g.city_name,
                status: g.status_name,
                source: (g.guide_metadata && g.guide_metadata.source) ? g.guide_metadata.source : 'Manual',
                createdAt: g.created_at
            }));
        } catch (error) {
            console.error('Error fetching guides by city:', error);
            return [];
        }
    },

    async getTodayGuides() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabaseClient
                .from('v_guides_complete')
                .select('*')
                .gte('created_at', today + 'T00:00:00')
                .lt('created_at', today + 'T23:59:59');

            if (error) throw error;

            return (data || []).map(g => ({
                id: g.id,
                guideNumber: g.guide_number,
                clientName: g.client_name,
                city: g.city_name,
                status: g.status_name
            }));
        } catch (error) {
            console.error('Error fetching today guides:', error);
            return [];
        }
    },

    // ========================================
    // GUIDE ITEMS
    // ========================================
    async getGuideItems(guideId) {
        try {
            const { data, error } = await supabaseClient
                .from('guide_items')
                .select(`
                    *,
                    products (name, sku)
                `)
                .eq('guide_id', guideId);

            if (error) throw error;

            return (data || []).map(i => ({
                id: i.id,
                guideId: i.guide_id,
                productId: i.product_id,
                productName: i.products?.name || '',
                productSku: i.products?.sku || '',
                quantity: i.quantity,
                unitPrice: parseFloat(i.unit_price),
                subtotal: parseFloat(i.subtotal)
            }));
        } catch (error) {
            console.error('Error fetching guide items:', error);
            return [];
        }
    },

    async saveGuideItem(item) {
        try {
            const { data, error } = await supabaseClient
                .from('guide_items')
                .insert({
                    guide_id: item.guideId,
                    product_id: item.productId,
                    quantity: item.quantity,
                    unit_price: item.unitPrice
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error saving guide item:', error);
            throw error;
        }
    },

    async deleteGuideItems(guideId) {
        try {
            const { error } = await supabaseClient
                .from('guide_items')
                .delete()
                .eq('guide_id', guideId);
            if (error) throw error;
        } catch (error) {
            console.error('Error deleting guide items:', error);
            throw error;
        }
    },

    // ========================================
    // CONFIRMATIONS
    // ========================================
    async getConfirmations() {
        try {
            const { data, error } = await supabaseClient
                .from('v_confirmations_complete')
                .select('*')
                .order('confirmation_date', { ascending: false });

            if (error) throw error;

            return (data || []).map(c => ({
                id: c.id,
                date: c.confirmation_date,
                page: c.page_name,
                pageId: c.page_id,
                totalOrders: c.total_orders,
                confirmed: c.confirmed,
                duplicates: c.duplicates,
                cancelledCoverage: c.cancelled_coverage,
                cancelledClient: c.cancelled_client,
                grossPercentage: parseFloat(c.gross_percentage),
                netPercentage: parseFloat(c.net_percentage),
                notes: c.notes,
                createdAt: c.created_at
            }));
        } catch (error) {
            console.error('Error fetching confirmations:', error);
            return [];
        }
    },

    async saveConfirmation(data) {
        try {
            const pageId = this.getPageId(data.page);
            if (!pageId) throw new Error('Page not found: ' + data.page);

            const confirmationData = {
                confirmation_date: data.date,
                page_id: pageId,
                total_orders: data.totalOrders,
                confirmed: data.confirmed,
                duplicates: data.duplicates || 0,
                cancelled_coverage: data.cancelledCoverage || 0,
                cancelled_client: data.cancelledClient || 0,
                notes: data.notes || null
            };

            let result;
            if (data.id) {
                const { data: updated, error } = await supabaseClient
                    .from('confirmations')
                    .update(confirmationData)
                    .eq('id', data.id)
                    .select()
                    .single();
                if (error) throw error;
                result = updated;
            } else {
                const { data: inserted, error } = await supabaseClient
                    .from('confirmations')
                    .insert(confirmationData)
                    .select()
                    .single();
                if (error) throw error;
                result = inserted;
            }

            return {
                id: result.id,
                date: result.confirmation_date,
                createdAt: result.created_at
            };
        } catch (error) {
            console.error('Error saving confirmation:', error);
            throw error;
        }
    },

    async deleteConfirmation(id) {
        try {
            const { error } = await supabaseClient
                .from('confirmations')
                .delete()
                .eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Error deleting confirmation:', error);
            throw error;
        }
    },

    // ========================================
    // STATISTICS
    // ========================================
    async getStats() {
        try {
            // Get counts
            const [products, inventory, clients, todayGuides] = await Promise.all([
                supabaseClient.from('products').select('id', { count: 'exact' }).eq('active', true),
                supabaseClient.from('inventory').select('available'),
                supabaseClient.from('clients').select('id', { count: 'exact' }).eq('active', true),
                this.getTodayGuides()
            ]);

            const totalStock = (inventory.data || []).reduce((sum, i) => sum + (i.available || 0), 0);

            return {
                products: products.count || 0,
                inventory: totalStock,
                clients: clients.count || 0,
                todayGuides: todayGuides.length
            };
        } catch (error) {
            console.error('Error fetching stats:', error);
            return { products: 0, inventory: 0, clients: 0, todayGuides: 0 };
        }
    },

    async getCityStats() {
        try {
            const guides = await this.getGuides();
            const quito = guides.filter(g => g.city === 'Quito').length;
            const guayaquil = guides.filter(g => g.city === 'Guayaquil').length;
            return { quito, guayaquil };
        } catch (error) {
            console.error('Error fetching city stats:', error);
            return { quito: 0, guayaquil: 0 };
        }
    },

    // ========================================
    // PERSONAL FINANCE
    // ========================================
    async getPFAccounts() {
        try {
            const { data, error } = await supabaseClient
                .from('pf_accounts')
                .select('*')
                .order('name');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching PF accounts:', error);
            // Si la tabla no existe aún (error 42P01 en PostgreSQL), podemos retornar vacío
            if (error && error.code === '42P01') {
                console.warn('pf_accounts table does not exist yet. Please run the SQL schema.');
                return [];
            }
            throw error;
        }
    },

    async savePFAccount(account) {
        try {
            let result;
            if (account.id) {
                const { data, error } = await supabaseClient
                    .from('pf_accounts')
                    .update({
                        name: account.name,
                        type: account.type,
                        category: account.category,
                        balance: account.balance,
                        currency: account.currency
                    })
                    .eq('id', account.id)
                    .select()
                    .single();
                if (error) throw error;
                result = data;
            } else {
                const { data, error } = await supabaseClient
                    .from('pf_accounts')
                    .insert({
                        name: account.name,
                        type: account.type,
                        category: account.category,
                        balance: account.balance,
                        currency: account.currency
                    })
                    .select()
                    .single();
                if (error) throw error;
                result = data;
            }
            return result;
        } catch (error) {
            console.error('Error saving PF account:', error);
            throw error;
        }
    },

    async deletePFAccount(id) {
        try {
            const { error } = await supabaseClient.from('pf_accounts').delete().eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Error deleting PF account:', error);
            throw error;
        }
    },

    async getPFTransactions() {
        try {
            const { data, error } = await supabaseClient
                .from('pf_transactions')
                .select('*, pf_accounts(name)')
                .order('date', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching PF transactions:', error);
            if (error && error.code === '42P01') return [];
            throw error;
        }
    },

    async savePFTransaction(tx) {
        try {
            // Guardar transacción
            const { data, error } = await supabaseClient
                .from('pf_transactions')
                .insert({
                    account_id: tx.accountId,
                    type: tx.type,
                    amount: tx.amount,
                    description: tx.description,
                    date: tx.date
                })
                .select()
                .single();
            if (error) throw error;

            // Actualizar balance de cuenta
            const accountData = await supabaseClient.from('pf_accounts').select('balance, type').eq('id', tx.accountId).single();
            if (accountData.data) {
                let currentBalance = parseFloat(accountData.data.balance || 0);
                
                // Si la cuenta es un Activo: income suma, expense resta.
                // Si la cuenta es un Pasivo (deuda): un pago (expense de deuda) reduce el saldo, un préstamo (income de deuda) lo aumenta.
                // Asumimos lógica simple: para cuentas normales (asset), ingresar dinero aumenta balance.
                let modifier = 1;
                if (accountData.data.type === 'asset') {
                    modifier = (tx.type === 'income') ? 1 : -1;
                } else if (accountData.data.type === 'liability') {
                    // Si tienes una deuda, y recibes dinero prestado (income), la deuda crece.
                    // Si pagas (expense), la deuda se reduce.
                    modifier = (tx.type === 'income') ? 1 : -1;
                }

                let newBalance = currentBalance + (tx.amount * modifier);
                await supabaseClient.from('pf_accounts').update({ balance: newBalance }).eq('id', tx.accountId);
            }
            return data;
        } catch (error) {
            console.error('Error saving PF transaction:', error);
            throw error;
        }
    },

    async getPFCategories() {
        try {
            const { data, error } = await supabaseClient
                .from('pf_categories')
                .select('*')
                .order('name');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching PF categories:', error);
            if (error && error.code === '42P01') return [];
            throw error;
        }
    },

    async savePFCategory(category) {
        try {
            const { data, error } = await supabaseClient
                .from('pf_categories')
                .insert({
                    name: category.name,
                    type: category.type
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error saving PF category:', error);
            throw error;
        }
    },

    async deletePFCategory(id) {
        try {
            const { error } = await supabaseClient
                .from('pf_categories')
                .delete()
                .eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Error deleting PF category:', error);
            throw error;
        }
    },

    async getPFSnapshots() {
        try {
            const { data, error } = await supabaseClient
                .from('pf_snapshots')
                .select('*')
                .order('date', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching PF snapshots:', error);
            if (error && error.code === '42P01') return [];
            throw error;
        }
    },

    async savePFSnapshot(snapshot) {
        try {
            const { data, error } = await supabaseClient
                .from('pf_snapshots')
                .insert({
                    date: snapshot.date,
                    total_assets: snapshot.total_assets,
                    total_liabilities: snapshot.total_liabilities,
                    net_worth: snapshot.net_worth,
                    inventory_value: snapshot.inventory_value,
                    details: snapshot.details
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error saving PF snapshot:', error);
            throw error;
        }
    },

    async deletePFSnapshot(id) {
        try {
            const { error } = await supabaseClient
                .from('pf_snapshots')
                .delete()
                .eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Error deleting PF snapshot:', error);
            throw error;
        }
    },

    // ========================================
    // CAMPAIGNS & PERFORMANCE (HYBRID CLOUD PERSISTENCE)
    // ========================================

    // Helper: Safely format date string for DB
    _formatDateStr(val) {
        if (!val) return null;
        const s = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (s.includes('T')) return s.split('T')[0];
        const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dm) return `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        return s;
    },

    // 1. CAMPAIGNS
    async getCampaigns(onlyFromCloud = false) {
        try {
            if (supabaseClient) {
                const { data, error } = await supabaseClient
                    .from('campaigns')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && Array.isArray(data)) {
                    const mapped = data.map(c => ({
                        id: c.id,
                        name: c.name,
                        code: c.code,
                        country: c.country,
                        type: c.type,
                        objective: c.objective,
                        date: c.date,
                        product: c.product,
                        adSets: c.ad_sets,
                        ads: c.ads,
                        adSetCodes: c.ad_set_codes,
                        adCodes: c.ad_codes,
                        adDetails: c.ad_details || [],
                        active: c.active !== false,
                        createdAt: c.created_at
                    }));
                    if (mapped.length > 0 || onlyFromCloud) {
                        return mapped;
                    }
                } else if (error) {
                    console.warn('⚠️ Supabase getCampaigns error:', error.message || error);
                }
            }
        } catch (error) {
            console.warn('⚠️ Supabase getCampaigns fallback:', error);
        }
        if (onlyFromCloud) return [];
        const saved = localStorage.getItem('generatedCampaigns');
        return saved ? JSON.parse(saved) : [];
    },

    async saveCampaign(campaign) {
        if (!campaign) return;
        try {
            if (supabaseClient) {
                const { error } = await supabaseClient
                    .from('campaigns')
                    .upsert({
                        id: String(campaign.id),
                        name: campaign.name || '',
                        code: campaign.code || '',
                        country: campaign.country || '',
                        type: campaign.type || '',
                        objective: campaign.objective || '',
                        date: this._formatDateStr(campaign.date) || campaign.date || '',
                        product: campaign.product || '',
                        ad_sets: campaign.adSets || 0,
                        ads: campaign.ads || 0,
                        ad_set_codes: campaign.adSetCodes || [],
                        ad_codes: campaign.adCodes || [],
                        ad_details: campaign.adDetails || [],
                        active: campaign.active !== false,
                        created_at: campaign.createdAt || new Date().toISOString()
                    });
                if (error) {
                    console.warn('⚠️ Supabase saveCampaign warning:', error.message || error);
                }
            }
        } catch (error) {
            console.warn('⚠️ Supabase saveCampaign exception:', error);
        }
    },

    async saveCampaigns(campaignsList) {
        if (!Array.isArray(campaignsList) || campaignsList.length === 0) return;
        try {
            if (supabaseClient) {
                const rows = campaignsList.map(c => ({
                    id: String(c.id),
                    name: c.name || '',
                    code: c.code || '',
                    country: c.country || '',
                    type: c.type || '',
                    objective: c.objective || '',
                    date: this._formatDateStr(c.date) || c.date || '',
                    product: c.product || '',
                    ad_sets: c.adSets || 0,
                    ads: c.ads || 0,
                    ad_set_codes: c.adSetCodes || [],
                    ad_codes: c.adCodes || [],
                    ad_details: c.adDetails || [],
                    active: c.active !== false,
                    created_at: c.createdAt || new Date().toISOString()
                }));
                const { error } = await supabaseClient
                    .from('campaigns')
                    .upsert(rows, { onConflict: 'id' });
                if (error) {
                    console.warn('⚠️ Supabase saveCampaigns warning:', error.message || error);
                }
            }
        } catch (error) {
            console.warn('⚠️ Supabase saveCampaigns exception:', error);
        }
        localStorage.setItem('generatedCampaigns', JSON.stringify(campaignsList));
    },

    async deleteCampaign(id) {
        try {
            if (supabaseClient) {
                await supabaseClient
                    .from('campaigns')
                    .delete()
                    .eq('id', String(id));
            }
        } catch (error) {
            console.warn('⚠️ Supabase deleteCampaign fallback:', error);
        }
    },

    // 2. CAMPAIGN ADS (ANUNCIOS IMPORTADOS CON IDS DE META)
    async getCampaignAds(onlyFromCloud = false) {
        try {
            if (supabaseClient) {
                const { data, error } = await supabaseClient
                    .from('campaign_ads')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && Array.isArray(data)) {
                    const mapped = data.map(a => ({
                        id: a.id,
                        adId: a.ad_id,
                        adName: a.ad_name,
                        adSetName: a.ad_set_name,
                        campaignName: a.campaign_name,
                        campaignCode: a.campaign_code,
                        country: a.country,
                        product: a.product,
                        spent: Number(a.spent) || 0,
                        currency: a.currency || 'COP',
                        impressions: Number(a.impressions) || 0,
                        reach: Number(a.reach) || 0,
                        conversations: Number(a.conversations) || 0,
                        startDate: a.start_date,
                        endDate: a.end_date,
                        createdAt: a.created_at,
                        updatedAt: a.updated_at
                    }));
                    if (mapped.length > 0 || onlyFromCloud) {
                        return mapped;
                    }
                } else if (error) {
                    console.warn('⚠️ Supabase getCampaignAds error:', error.message || error);
                }
            }
        } catch (error) {
            console.warn('⚠️ Supabase getCampaignAds fallback:', error);
        }
        if (onlyFromCloud) return [];
        const saved = localStorage.getItem('campaignAdsData');
        return saved ? JSON.parse(saved) : [];
    },

    async saveCampaignAds(ads) {
        if (!Array.isArray(ads) || ads.length === 0) return;
        try {
            if (supabaseClient) {
                const rows = ads.map(a => ({
                    id: a.id || (a.adId ? `ad_${a.adId}` : `ad_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`),
                    ad_id: String(a.adId || ''),
                    ad_name: a.adName || '',
                    ad_set_name: a.adSetName || '',
                    campaign_name: a.campaignName || '',
                    campaign_code: a.campaignCode || '',
                    country: a.country || '',
                    product: a.product || '',
                    spent: Number(a.spent) || 0,
                    currency: a.currency || 'COP',
                    impressions: Number(a.impressions) || 0,
                    reach: Number(a.reach) || 0,
                    conversations: Number(a.conversations) || 0,
                    start_date: this._formatDateStr(a.startDate) || a.startDate || null,
                    end_date: this._formatDateStr(a.endDate) || a.endDate || null,
                    updated_at: new Date().toISOString()
                }));

                const { data, error } = await supabaseClient
                    .from('campaign_ads')
                    .upsert(rows, { onConflict: 'id' });

                if (error) {
                    console.error('❌ Error guardando campaign_ads en Supabase:', error.message || error);
                } else {
                    console.log('✅ campaign_ads sincronizados con Supabase:', rows.length);
                }
            }
        } catch (error) {
            console.warn('⚠️ Supabase saveCampaignAds exception:', error);
        }
        localStorage.setItem('campaignAdsData', JSON.stringify(ads));
    },

    async deleteCampaignAd(id) {
        try {
            if (supabaseClient) {
                await supabaseClient
                    .from('campaign_ads')
                    .delete()
                    .eq('id', String(id));
            }
        } catch (error) {
            console.warn('⚠️ Supabase deleteCampaignAd fallback:', error);
        }
    },

    // 3. CAMPAIGN SALES (REGISTRO RÁPIDO DE VENTAS POR ANUNCIO)
    async getCampaignSales(onlyFromCloud = false) {
        try {
            if (supabaseClient) {
                const { data, error } = await supabaseClient
                    .from('campaign_sales')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && Array.isArray(data)) {
                    const mapped = data.map(s => ({
                        id: s.id,
                        adId: s.ad_id,
                        adName: s.ad_name,
                        campaignCode: s.campaign_code,
                        campaignName: s.campaign_name,
                        product: s.product,
                        price: Number(s.price) || 0,
                        quantity: Number(s.quantity) || 1,
                        customerName: s.customer_name || '',
                        orderNumber: s.order_number || '',
                        city: s.city || '',
                        date: s.sale_date,
                        notes: s.notes || '',
                        createdAt: s.created_at,
                        updatedAt: s.updated_at
                    }));
                    if (mapped.length > 0 || onlyFromCloud) {
                        return mapped;
                    }
                } else if (error) {
                    console.warn('⚠️ Supabase getCampaignSales error:', error.message || error);
                }
            }
        } catch (error) {
            console.warn('⚠️ Supabase getCampaignSales fallback:', error);
        }
        if (onlyFromCloud) return [];
        const saved = localStorage.getItem('campaignSalesData');
        return saved ? JSON.parse(saved) : [];
    },

    async saveCampaignSale(sale) {
        if (!sale) return;
        try {
            if (supabaseClient) {
                const { error } = await supabaseClient
                    .from('campaign_sales')
                    .upsert({
                        id: String(sale.id),
                        ad_id: String(sale.adId || ''),
                        ad_name: sale.adName || '',
                        campaign_code: sale.campaignCode || '',
                        campaign_name: sale.campaignName || '',
                        product: sale.product || '',
                        price: Number(sale.price) || 0,
                        quantity: Number(sale.quantity) || 1,
                        customer_name: sale.customerName || '',
                        order_number: sale.orderNumber || '',
                        city: sale.city || '',
                        sale_date: this._formatDateStr(sale.date) || sale.date || new Date().toISOString().split('T')[0],
                        notes: sale.notes || '',
                        created_at: sale.createdAt || new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                if (error) {
                    console.warn('⚠️ Supabase saveCampaignSale warning:', error.message || error);
                }
            }
        } catch (error) {
            console.warn('⚠️ Supabase saveCampaignSale exception:', error);
        }
    },

    async deleteCampaignSale(id) {
        try {
            if (supabaseClient) {
                await supabaseClient
                    .from('campaign_sales')
                    .delete()
                    .eq('id', String(id));
            }
        } catch (error) {
            console.warn('⚠️ Supabase deleteCampaignSale fallback:', error);
        }
    },

    // 4. CAMPAIGN PERFORMANCE (REPORTES IMPORTADOS DE EXCEL/CSV)
    async getCampaignPerformance(onlyFromCloud = false) {
        try {
            if (supabaseClient) {
                const { data, error } = await supabaseClient
                    .from('campaign_performance')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && Array.isArray(data)) {
                    const mapped = data.map(p => ({
                        id: p.id,
                        code: p.code,
                        campaignName: p.campaign_name,
                        product: p.product,
                        country: p.country,
                        cost: Number(p.cost) || 0,
                        impressions: Number(p.impressions) || 0,
                        reach: Number(p.reach) || 0,
                        conversations: Number(p.conversations) || 0,
                        purchases: Number(p.purchases) || 0,
                        purchaseValue: Number(p.purchase_value) || 0,
                        startDate: p.start_date,
                        endDate: p.end_date,
                        createdAt: p.created_at,
                        updatedAt: p.updated_at
                    }));
                    if (mapped.length > 0 || onlyFromCloud) {
                        return mapped;
                    }
                } else if (error) {
                    console.warn('⚠️ Supabase getCampaignPerformance error:', error.message || error);
                }
            }
        } catch (error) {
            console.warn('⚠️ Supabase getCampaignPerformance fallback:', error);
        }
        if (onlyFromCloud) return [];
        const saved = localStorage.getItem('campaignPerformanceData');
        return saved ? JSON.parse(saved) : [];
    },

    async saveCampaignPerformance(performanceList) {
        if (!Array.isArray(performanceList)) return;
        try {
            if (supabaseClient && performanceList.length > 0) {
                const rows = performanceList.map(p => ({
                    id: p.id || (p.code ? `perf_${p.code}` : `perf_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`),
                    code: p.code || '',
                    campaign_name: p.campaignName || '',
                    product: p.product || '',
                    country: p.country || '',
                    cost: Number(p.cost) || 0,
                    impressions: Number(p.impressions) || 0,
                    reach: Number(p.reach) || 0,
                    conversations: Number(p.conversations) || 0,
                    purchases: Number(p.purchases) || 0,
                    purchase_value: Number(p.purchaseValue) || 0,
                    start_date: this._formatDateStr(p.startDate) || p.startDate || null,
                    end_date: this._formatDateStr(p.endDate) || p.endDate || null,
                    updated_at: new Date().toISOString()
                }));

                const { data, error } = await supabaseClient
                    .from('campaign_performance')
                    .upsert(rows, { onConflict: 'id' });

                if (error) {
                    console.error('❌ Error guardando campaign_performance en Supabase:', error.message || error);
                } else {
                    console.log('✅ campaign_performance sincronizados con Supabase:', rows.length);
                }
            }
        } catch (error) {
            console.warn('⚠️ Supabase saveCampaignPerformance exception:', error);
        }
        localStorage.setItem('campaignPerformanceData', JSON.stringify(performanceList));
    },

    async deleteCampaignPerformance() {
        try {
            if (supabaseClient) {
                await supabaseClient
                    .from('campaign_performance')
                    .delete()
                    .neq('id', '___non_existent___');
            }
        } catch (error) {
            console.warn('⚠️ Supabase deleteCampaignPerformance fallback:', error);
        }
        localStorage.removeItem('campaignPerformanceData');
    },

    // 5. UNIVERSAL CAMPAIGNS CLOUD SNAPSHOT (Universal Fallback Sync)
    async syncCampaignsSnapshotToCloud(data) {
        if (!supabaseClient || !window.AuthModule || !window.AuthModule.currentUser) return;
        try {
            const userId = window.AuthModule.currentUser.id;
            const { data: existing } = await supabaseClient
                .from('user_journals')
                .select('id, principles')
                .eq('user_id', userId)
                .maybeSingle();

            if (existing && existing.id) {
                const currentPrinciples = existing.principles || {};
                currentPrinciples._campaigns_cloud_backup = {
                    campaigns: data.campaigns || [],
                    ads: data.ads || [],
                    sales: data.sales || [],
                    performance: data.performance || [],
                    syncedAt: new Date().toISOString()
                };
                await supabaseClient
                    .from('user_journals')
                    .update({
                        principles: currentPrinciples,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
                console.log('☁️ Backup global de campañas sincronizado en user_journals');
            }
        } catch (e) {
            console.warn('⚠️ Error en snapshot global de campañas:', e);
        }
    },

    async getCampaignsSnapshotFromCloud() {
        if (!supabaseClient || !window.AuthModule || !window.AuthModule.currentUser) return null;
        try {
            const userId = window.AuthModule.currentUser.id;
            const { data } = await supabaseClient
                .from('user_journals')
                .select('principles')
                .eq('user_id', userId)
                .maybeSingle();

            if (data && data.principles && data.principles._campaigns_cloud_backup) {
                return data.principles._campaigns_cloud_backup;
            }
        } catch (e) {
            console.warn('⚠️ Error obteniendo snapshot de campañas:', e);
        }
        return null;
    }
};

// Make Database available globally
window.Database = Database;
