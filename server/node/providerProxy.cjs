const { pipeline } = require('stream/promises');

const blockedProviderHosts = new Set(['sv.risuai.xyz', 'nightly.sv.risuai.xyz']);
const privateHeaders = new Set([
    'host', 'connection', 'content-length', 'transfer-encoding', 'cookie',
    'proxy-authorization', 'proxy-authenticate', 'forwarded', 'x-forwarded-for',
    'x-forwarded-host', 'x-forwarded-proto', 'risu-auth', 'risu-url',
    'risu-header', 'risu-timeout-ms', 'risu-location', 'x-risu-tk',
    'x-risu-node-path', 'upgrade', 'keep-alive', 'te', 'trailer'
]);
const responseHeadersToOmit = new Set([
    'content-encoding', 'content-length', 'transfer-encoding', 'connection',
    'set-cookie', 'clear-site-data', 'content-security-policy',
    'content-security-policy-report-only', 'location', 'keep-alive',
    'proxy-authenticate', 'proxy-authorization', 'upgrade', 'te', 'trailer',
    'x-elsewhere-proxy'
]);

function validateProviderUrl(raw) {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Use an HTTP(S) provider URL without embedded credentials.');
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if ([...blockedProviderHosts].some(host => hostname === host || hostname.endsWith(`.${host}`))) {
        throw new Error('RisuAI hub destinations are disabled for provider requests. Configure the provider endpoint directly.');
    }
    return url;
}

function normalizeForwardHeaders(input) {
    if (input === undefined || input === null) return {};
    if (typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Invalid provider headers.');
    }
    const headers = {};
    const connection = Object.entries(input).find(([name]) => name.toLowerCase() === 'connection')?.[1];
    const connectionTokens = typeof connection === 'string'
        ? connection.toLowerCase().split(',').map(value => value.trim()) : [];
    for (const [name, value] of Object.entries(input)) {
        const key = name.toLowerCase();
        if (privateHeaders.has(key) || connectionTokens.includes(key)) continue;
        if (typeof value !== 'string') throw new Error('Invalid provider header value.');
        headers[key] = value;
    }
    // Validate header syntax before starting a provider request.
    return Object.fromEntries(new Headers(headers));
}

async function fetchProvider(url, options) {
    let target = url;
    let request = options;
    for (let count = 0; count <= 5; count++) {
        const response = await fetch(target, { ...request, redirect: 'manual' });
        if (![301, 302, 303, 307, 308].includes(response.status)) return response;
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new Error('Provider returned a redirect without a destination.');
        const next = validateProviderUrl(new URL(location, target).href);
        if (next.origin !== target.origin) {
            throw new Error('Provider redirect to a different origin was blocked. Configure the final provider URL directly.');
        }
        if (count === 5) throw new Error('Provider redirected too many times. Configure the final provider URL directly.');
        if ((response.status === 303 && request.method !== 'HEAD')
            || ([301, 302].includes(response.status) && request.method === 'POST')) {
            const headers = { ...request.headers };
            delete headers['content-type'];
            request = { ...request, method: 'GET', body: undefined, headers };
        }
        target = next;
    }
}

function createProviderProxy(checkProxyAuth) {
    return async (req, res) => {
        res.setHeader('x-elsewhere-proxy', '1');
        res.setHeader('cache-control', 'no-store');
        if (!await checkProxyAuth(req, res)) return;

        let target;
        let headers;
        let timeoutMs;
        try {
            const raw = req.headers['risu-url'];
            target = validateProviderUrl(typeof raw === 'string' ? decodeURIComponent(raw) : req.query.url);
            const encodedHeaders = req.headers['risu-header'];
            headers = normalizeForwardHeaders(typeof encodedHeaders === 'string'
                ? JSON.parse(decodeURIComponent(encodedHeaders)) : {});
            const rawTimeout = req.headers['risu-timeout-ms'];
            timeoutMs = rawTimeout === undefined ? null : Number(rawTimeout);
            if (timeoutMs !== null && (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 3600000)) {
                throw new Error('Request timeout must be between 1 and 3600000 milliseconds.');
            }
        } catch {
            res.status(400).json({ error: 'Invalid provider URL, headers, or timeout. Use an HTTP(S) provider endpoint without embedded credentials; RisuAI hub endpoints are disabled.' });
            return;
        }

        const controller = new AbortController();
        let timedOut = false;
        const timer = timeoutMs ? setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMs) : null;
        const onDisconnect = () => {
            if (!res.writableFinished) controller.abort();
        };
        req.on('aborted', onDisconnect);
        res.on('close', onDisconnect);
        try {
            const body = ['GET', 'HEAD'].includes(req.method) || !req.headers['content-length'] && !req.headers['transfer-encoding']
                ? undefined : req.body;
            if (body !== undefined && !Buffer.isBuffer(body)) {
                res.status(400).json({ error: 'The self-hosted proxy requires an unmodified request body.' });
                return;
            }
            const response = await fetchProvider(target, {
                method: req.method, headers, body, signal: controller.signal
            });
            for (const [key, value] of response.headers) {
                if (!responseHeadersToOmit.has(key) && key !== 'cache-control') res.setHeader(key, value);
            }
            if (response.headers.get('content-type')?.includes('text/event-stream')) {
                res.setHeader('x-accel-buffering', 'no');
                res.setHeader('cache-control', 'no-store, no-transform');
            }
            res.status(response.status);
            res.flushHeaders();
            if (response.body) await pipeline(response.body, res);
            else res.end();
        } catch (error) {
            if (res.destroyed) return;
            if (res.headersSent) {
                res.destroy();
                return;
            }
            const redirectError = error instanceof Error && error.message.startsWith('Provider redirect');
            const status = timedOut ? 504 : 502;
            const message = timedOut ? 'The self-hosted proxy request timed out. Retry or increase the request timeout.'
                : redirectError ? error.message
                : 'The self-hosted proxy could not reach the provider. Check the provider URL and server network access.';
            res.status(status).json({ error: message });
        } finally {
            if (timer) clearTimeout(timer);
            req.removeListener('aborted', onDisconnect);
            res.removeListener('close', onDisconnect);
        }
    };
}

module.exports = { createProviderProxy, normalizeForwardHeaders, validateProviderUrl };
