/* ========================================
   Life OS - Convex Sync Layer
   Uses Convex HTTP API directly — no WebSocket/SDK needed.
   Falls back silently to LocalStorage if not configured.
   ======================================== */

class ConvexDataLayer {
    constructor(convexUrl, appKey) {
        this.convexUrl = convexUrl ? convexUrl.replace(/\/$/, '') : null;
        this.connected = !!convexUrl;
        // Every app function on the server checks this key (Convex env var APP_KEY). Without
        // the right one nothing loads or saves, and `unauthorized` says why.
        this.appKey = appKey || '';
        this.unauthorized = false;
    }

    isConnected() {
        return !!this.convexUrl;
    }

    async _init() {
        // Nothing to init — HTTP API needs no handshake
        return true;
    }

    unsubscribe() {
        clearInterval(this._pollInterval);
    }

    // One function call over the HTTP API, with the app key. Notes an "Unauthorized" reply.
    async call(kind, path, args = {}) {
        const resp = await fetch(`${this.convexUrl}/api/${kind}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, args: this.appKey ? { ...args, appKey: this.appKey } : args, format: 'json' })
        });
        const result = await resp.json().catch(() => null);
        const ok = resp.ok && result?.status === 'success';
        const error = ok ? '' : String(result?.errorData ?? result?.errorMessage ?? `HTTP ${resp.status}`);
        if (ok) this.unauthorized = false;
        else if (/Unauthorized/.test(error)) this.unauthorized = true;
        return { ok, error, value: ok ? result.value : undefined };
    }

    // Load data from Convex via HTTP query API
    async load() {
        if (!this.convexUrl) return null;
        try {
            const r = await this.call('query', 'functions:getData');
            if (!r.ok) {
                console.error('[LifeOS] Convex load failed:', r.error);
                return null;
            }
            const data = r.value;
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
            const r = await this.call('mutation', 'functions:setData', { payload: JSON.stringify(payload) });
            if (!r.ok) console.error('[LifeOS] Convex save failed:', r.error);
        } catch (e) {
            console.error('[LifeOS] Convex save error:', e);
        }
    }

    // Call any Convex function over HTTP; throws on failure (unlike load/save)
    async run(kind, path, args = {}) {
        if (!this.convexUrl) throw new Error('Convex is not connected');
        const r = await this.call(kind, path, args);
        if (!r.ok) throw new Error(r.error || `Convex ${kind} ${path} failed`);
        return r.value;
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
                const r = await this.call('query', 'functions:getUpdatedAt');
                if (!r.ok) return;
                const updatedAt = r.value;
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
