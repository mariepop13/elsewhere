const { WebSocket } = require('ws');
const { normalizeForwardHeaders, validateProviderUrl } = require('./providerProxy.cjs');

/** Authenticate in the first frame so tokens never appear in access-log URLs. */
function createProviderWebSocketHandler(isAuthorizedProxyRequest) {
    return client => {
        let provider;
        let timeout;
        const close = () => {
            clearTimeout(timeout);
            if (provider) provider.terminate();
        };
        const fail = message => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'proxy_error', message }));
                client.close(1011);
            }
            close();
        };
        const authTimer = setTimeout(() => client.close(1008), 10000);
        client.on('close', () => { clearTimeout(authTimer); close(); });
        client.on('error', close);
        client.once('message', async (data, isBinary) => {
            clearTimeout(authTimer);
            let request;
            let target;
            let headers;
            try {
                if (isBinary) throw new Error('Invalid authentication frame');
                request = JSON.parse(data.toString());
                if (!await isAuthorizedProxyRequest({ headers: { 'risu-auth': request.auth } })) {
                    fail('Self-hosted proxy authentication failed. Sign in to this Node server again.');
                    return;
                }
                target = new URL(request.url);
                if (!['ws:', 'wss:'].includes(target.protocol)) throw new Error('Invalid WebSocket URL');
                const httpTarget = new URL(target);
                httpTarget.protocol = target.protocol === 'wss:' ? 'https:' : 'http:';
                validateProviderUrl(httpTarget.href);
                headers = normalizeForwardHeaders(request.headers);
                if (request.timeoutMs !== undefined && (!Number.isSafeInteger(request.timeoutMs)
                    || request.timeoutMs <= 0 || request.timeoutMs > 3600000)) throw new Error('Invalid timeout');
            } catch {
                fail('Invalid provider WebSocket URL, headers, or timeout. RisuAI hub destinations are disabled.');
                return;
            }
            if (client.readyState !== WebSocket.OPEN) return;
            provider = new WebSocket(target, {
                headers, followRedirects: false, handshakeTimeout: 10000, maxPayload: 8 * 1024 * 1024,
            });
            if (request.timeoutMs) timeout = setTimeout(() => fail('The self-hosted provider stream timed out.'), request.timeoutMs);
            provider.on('open', () => {
                if (client.readyState !== WebSocket.OPEN) { close(); return; }
                client.send(JSON.stringify({ type: 'provider_open' }));
            });
            client.on('message', (message, binary) => {
                if (provider.readyState === WebSocket.OPEN) provider.send(message, { binary });
            });
            provider.on('message', (message, binary) => {
                if (client.readyState === WebSocket.OPEN) client.send(message, { binary });
            });
            provider.on('error', () => fail('The self-hosted proxy could not open the provider WebSocket. Check its URL and server network access.'));
            provider.on('close', () => {
                clearTimeout(timeout);
                if (client.readyState === WebSocket.OPEN) client.close(1000);
            });
        });
    };
}

module.exports = { createProviderWebSocketHandler };
