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
        // Don't auto-init — caller must await _init() explicitly
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
    load() {
        if (!this.isConnected()) return Promise.resolve(null);
        return new Promise((resolve) => {
            let done = false;
            const unsub = this.client.onUpdate('functions:getData', {}, (data) => {
                if (done) return;
                done = true;
                if (unsub) unsub();
                resolve(data ?? null);
            });
            // Timeout after 8s in case Convex never fires
            setTimeout(() => {
                if (!done) { done = true; resolve(null); }
            }, 8000);
        });
    }

    // Save data to Convex. Fire-and-forget — LocalStorage is already saved.
    async save(payload) {
        if (!this.isConnected()) return;
        try {
            await this.client.mutation('functions:setData', { payload: JSON.stringify(payload) });
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
