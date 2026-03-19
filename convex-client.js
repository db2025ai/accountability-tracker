/* ========================================
   Life OS - Convex Sync Layer
   Stores the entire data blob in one Convex document.
   Falls back silently to LocalStorage if not configured.
   ======================================== */

class ConvexDataLayer {
    constructor(convexUrl) {
        this.convexUrl = convexUrl;
        this.client = null;
        this.connected = false;
        this._unsub = null;

        if (convexUrl) this._init(convexUrl);
    }

    async _init(url) {
        try {
            const { ConvexClient } = await import('https://cdn.jsdelivr.net/npm/convex@1.17.4/browser/+esm');
            this.client = new ConvexClient(url);
            this.connected = true;
            console.log('[LifeOS] Connected to Convex');
        } catch (e) {
            console.warn('[LifeOS] Convex unavailable, using LocalStorage only:', e.message);
        }
    }

    isConnected() {
        return this.connected && !!this.client;
    }

    // Load data from Convex. Returns null if unavailable.
    async load() {
        if (!this.isConnected()) return null;
        try {
            return await this.client.query('functions:getData', {});
        } catch (e) {
            console.error('[LifeOS] Convex load failed:', e);
            return null;
        }
    }

    // Save data to Convex. Fire-and-forget — LocalStorage is already saved.
    async save(payload) {
        if (!this.isConnected()) return;
        try {
            await this.client.mutation('functions:setData', { payload });
        } catch (e) {
            console.error('[LifeOS] Convex save failed:', e);
        }
    }

    // Subscribe to real-time updates from other devices.
    // callback(payload) is called whenever another device saves.
    subscribe(callback) {
        if (!this.isConnected()) return;
        if (this._unsub) this._unsub();
        this._unsub = this.client.onUpdate('functions:getData', {}, (payload) => {
            if (payload != null) callback(payload);
        });
    }

    unsubscribe() {
        if (this._unsub) { this._unsub(); this._unsub = null; }
    }
}

window.ConvexDataLayer = ConvexDataLayer;
