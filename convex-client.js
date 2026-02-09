/* ========================================
   Life OS - Convex Data Layer
   Handles Convex backend with LocalStorage fallback
   ======================================== */

class ConvexDataLayer {
    constructor(convexUrl) {
        this.convexUrl = convexUrl;
        this.client = null;
        this.connected = false;
        this.listeners = new Map();

        if (convexUrl) {
            this.initConvex(convexUrl);
        }
    }

    async initConvex(url) {
        try {
            // Dynamic import of Convex browser client
            const { ConvexClient } = await import('https://cdn.jsdelivr.net/npm/convex@latest/browser/+esm');
            this.client = new ConvexClient(url);
            this.connected = true;
            console.log('Connected to Convex backend');

            // Notify listeners
            this.emit('connected');
        } catch (e) {
            console.warn('Convex connection failed, using LocalStorage fallback:', e.message);
            this.connected = false;
        }
    }

    isConnected() {
        return this.connected && this.client;
    }

    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => cb(data));
    }

    // ========================================
    // Query/Mutation helpers
    // ========================================
    async query(functionName, args = {}) {
        if (!this.isConnected()) return null;
        try {
            return await this.client.query(functionName, args);
        } catch (e) {
            console.error(`Convex query ${functionName} failed:`, e);
            return null;
        }
    }

    async mutation(functionName, args = {}) {
        if (!this.isConnected()) return null;
        try {
            return await this.client.mutation(functionName, args);
        } catch (e) {
            console.error(`Convex mutation ${functionName} failed:`, e);
            return null;
        }
    }

    // Subscribe to real-time updates
    subscribe(functionName, args, callback) {
        if (!this.isConnected()) return () => {};
        return this.client.onUpdate(functionName, args, callback);
    }

    // ========================================
    // Sync LocalStorage data to Convex
    // ========================================
    async syncFromLocalStorage(localData) {
        if (!this.isConnected()) {
            console.warn('Cannot sync: not connected to Convex');
            return false;
        }

        try {
            const result = await this.mutation('functions:syncFromLocalStorage', {
                data: localData
            });
            console.log('Synced to Convex:', result);
            return true;
        } catch (e) {
            console.error('Sync to Convex failed:', e);
            return false;
        }
    }

    // ========================================
    // Data operations (with fallback)
    // ========================================

    // Weeks
    async getWeeks() {
        return await this.query('functions:getWeeks');
    }

    async saveWeek(startDate, entries) {
        return await this.mutation('functions:upsertWeek', { startDate, entries });
    }

    async updateWeekEntries(id, entries) {
        return await this.mutation('functions:updateWeekEntries', { id, entries });
    }

    // Goals
    async getGoals() {
        return await this.query('functions:getGoals');
    }

    async addGoal(category, name, target, order) {
        return await this.mutation('functions:addGoal', { category, name, target, order });
    }

    async removeGoal(id) {
        return await this.mutation('functions:removeGoal', { id });
    }

    // Transactions
    async getTransactions(limit) {
        return await this.query('functions:getTransactions', { limit });
    }

    async addTransaction(txn) {
        return await this.mutation('functions:addTransaction', txn);
    }

    async bulkAddTransactions(transactions) {
        return await this.mutation('functions:bulkAddTransactions', { transactions });
    }

    // Accounts
    async getAccounts() {
        return await this.query('functions:getAccounts');
    }

    async addAccount(name, type, balance) {
        return await this.mutation('functions:addAccount', { name, type, balance });
    }

    // Budgets
    async getBudgets() {
        return await this.query('functions:getBudgets');
    }

    async saveBudget(category, amount) {
        return await this.mutation('functions:upsertBudget', { category, amount });
    }

    // Habits
    async getHabits() {
        return await this.query('functions:getHabits');
    }

    async addHabit(name, frequency, category, order) {
        return await this.mutation('functions:addHabit', { name, frequency, category, order });
    }

    async getHabitLogs(date) {
        return await this.query('functions:getHabitLogs', { date });
    }

    async toggleHabit(date, habitId, completed) {
        return await this.mutation('functions:toggleHabit', { date, habitId, completed });
    }

    // Health
    async getHealthLogs(limit) {
        return await this.query('functions:getHealthLogs', { limit });
    }

    async saveHealthLog(date, data) {
        return await this.mutation('functions:upsertHealthLog', { date, ...data });
    }

    // Journal
    async getJournalEntries(limit) {
        return await this.query('functions:getJournalEntries', { limit });
    }

    async addJournalEntry(entry) {
        return await this.mutation('functions:addJournalEntry', entry);
    }

    // Evening Reflections
    async addEveningReflection(reflection) {
        return await this.mutation('functions:addEveningReflection', reflection);
    }

    // Weekly Reviews
    async getWeeklyReviews(limit) {
        return await this.query('functions:getWeeklyReviews', { limit });
    }

    async addWeeklyReview(review) {
        return await this.mutation('functions:addWeeklyReview', review);
    }

    // Activity Log
    async logActivity(text) {
        return await this.mutation('functions:addActivity', {
            text,
            timestamp: new Date().toISOString()
        });
    }
}

// Export for use
window.ConvexDataLayer = ConvexDataLayer;
