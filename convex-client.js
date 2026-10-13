/* ========================================
   Life OS - Convex Sync Layer
   Uses Convex HTTP API directly — no WebSocket/SDK needed.
   Falls back silently to LocalStorage if not configured.
   ======================================== */

class ConvexDataLayer {
    constructor(convexUrl) {
        this.convexUrl = convexUrl ? convexUrl.replace(/\/$/, '') : null;
        this.connected = !!convexUrl;
    }

    isConnected() {
        return !!this.convexUrl;
    }

    async _init() {
        // Nothing to init — HTTP API needs no handshake
        return true;
    }

    unsubscribe() {
        // No-op — HTTP API has no persistent subscription
    }

    // Load data from Convex via HTTP query API
    async load() {
        if (!this.convexUrl) return null;
        try {
            const resp = await fetch(`${this.convexUrl}/api/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: 'functions:getData', args: {}, format: 'json' })
            });
            if (!resp.ok) {
                console.error('[LifeOS] Convex load HTTP error:', resp.status);
                return null;
            }
            const result = await resp.json();
            if (result.status !== 'success') {
                console.error('[LifeOS] Convex load failed:', result);
                return null;
            }
            const data = result.value;
            if (!data) return null;
            return typeof data === 'string' ? JSON.parse(data) : data;
        } catch (e) {
            console.error('[LifeOS] Convex load error:', e);
            return null;
        }
    }

    // Save data to Convex via HTTP mutation API — fire and forget
    async save(payload) {
        if (!this.convexUrl) return;
        try {
            const resp = await fetch(`${this.convexUrl}/api/mutation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: 'functions:setData',
                    args: { payload: JSON.stringify(payload) },
                    format: 'json'
                })
            });
            if (!resp.ok) console.error('[LifeOS] Convex save HTTP error:', resp.status);
        } catch (e) {
            console.error('[LifeOS] Convex save error:', e);
        }
    }

    // Call any Convex function over HTTP; throws on failure (unlike load/save)
    async run(kind, path, args = {}) {
        if (!this.convexUrl) throw new Error('Convex is not connected');
        const resp = await fetch(`${this.convexUrl}/api/${kind}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, args, format: 'json' })
        });
        const result = await resp.json().catch(() => null);
        if (!resp.ok || !result || result.status !== 'success') {
            throw new Error(result?.errorMessage || `Convex ${kind} ${path} failed (HTTP ${resp.status})`);
        }
        return result.value;
    }

    query(path, args) { return this.run('query', path, args); }
    mutation(path, args) { return this.run('mutation', path, args); }
    action(path, args) { return this.run('action', path, args); }

    // Polling-based subscribe — checks for changes every 30s
    subscribe(callback) {
        if (!this.convexUrl) return;
        let lastUpdatedAt = null;
        this._pollInterval = setInterval(async () => {
            try {
                const resp = await fetch(`${this.convexUrl}/api/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: 'functions:getUpdatedAt', args: {}, format: 'json' })
                });
                if (!resp.ok) return;
                const result = await resp.json();
                if (result.status !== 'success') return;
                const updatedAt = result.value;
                if (updatedAt && updatedAt !== lastUpdatedAt) {
                    if (lastUpdatedAt !== null) {
                        // Something changed — load full data
                        const data = await this.load();
                        if (data) callback(data);
                    }
                    lastUpdatedAt = updatedAt;
                }
            } catch (e) { /* silent */ }
        }, 30000);
    }
}

window.ConvexDataLayer = ConvexDataLayer;
