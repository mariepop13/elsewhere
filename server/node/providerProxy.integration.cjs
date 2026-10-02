const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const { mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { WebSocket, WebSocketServer } = require('ws');
const crypto = require('node:crypto');

const fakeKey = 'fake-provider-key';
const fakePrompt = 'fake-private-prompt';
const proxyPassword = 'fake-node-password';
const received = [];
let provider;
let sink;
let providerOrigin;
let sinkOrigin;
let sinkRequests = 0;
let disconnected = 0;
let child;
let proxyOrigin;
let temporaryDirectory;
let serverLog = '';
let providerSockets;
let socketConnections = 0;
let socketDisconnects = 0;

async function listen(server) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return `http://127.0.0.1:${server.address().port}`;
}

before(async () => {
    sink = http.createServer((_req, res) => { sinkRequests++; res.end('should not be reached'); });
    sinkOrigin = await listen(sink);
    provider = http.createServer(async (req, res) => {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        received.push({ path: req.url, method: req.method, headers: req.headers, body });
        if (req.url === '/redirect-same') { res.writeHead(307, { location: '/echo' }); res.end(); return; }
        if (req.url === '/redirect-get') { res.writeHead(303, { location: '/echo' }); res.end(); return; }
        if (req.url === '/redirect-cross') { res.writeHead(307, { location: `${sinkOrigin}/capture` }); res.end(); return; }
        if (req.url === '/redirect-hub') { res.writeHead(307, { location: 'https://sv.risuai.xyz/proxy2' }); res.end(); return; }
        if (req.url === '/redirect-loop') { res.writeHead(307, { location: '/redirect-loop' }); res.end(); return; }
        if (req.url === '/disconnect') { req.socket.destroy(); return; }
        if (req.url === '/broken-stream') {
            res.writeHead(200, { 'content-type': 'text/event-stream' });
            res.write('data: first\n\n');
            setTimeout(() => res.destroy(), 60);
            return;
        }
        if (req.url === '/error') { res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '3' }); res.end('{"error":"fake provider rate limit"}'); return; }
        if (req.url === '/empty') { res.writeHead(204); res.end(); return; }
        if (req.url === '/slow-headers') {
            const timer = setTimeout(() => res.end('late'), 1000);
            res.on('close', () => { disconnected++; clearTimeout(timer); });
            return;
        }
        if (req.url === '/stream' || req.url === '/slow-stream') {
            res.writeHead(200, { 'content-type': 'text/event-stream', 'set-cookie': 'provider-secret=fake' });
            res.write('data: first\n\n');
            if (req.url === '/stream') { setTimeout(() => res.end('data: second\n\n'), 60); return; }
            const timer = setInterval(() => res.write('data: waiting\n\n'), 1000);
            res.on('close', () => { disconnected++; clearInterval(timer); });
            return;
        }
        res.writeHead(200, { 'content-type': 'application/octet-stream', 'set-cookie': 'provider-secret=fake' });
        res.end(body.length ? body : `${req.method} ${req.url}`);
    });
    providerSockets = new WebSocketServer({ noServer: true });
    provider.on('upgrade', (req, socket, head) => {
        if (req.url === '/redirect-cross') {
            socket.end(`HTTP/1.1 307 Temporary Redirect\r\nLocation: ${sinkOrigin}/capture\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
            return;
        }
        providerSockets.handleUpgrade(req, socket, head, ws => providerSockets.emit('connection', ws, req));
    });
    providerSockets.on('connection', socket => {
        socketConnections++;
        socket.on('message', message => socket.send(message.toString()));
        socket.on('close', () => { socketDisconnects++; });
    });
    providerOrigin = await listen(provider);
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-proxy-test-'));
    await mkdir(path.join(temporaryDirectory, 'save'));
    await mkdir(path.join(temporaryDirectory, 'dist'));
    await writeFile(path.join(temporaryDirectory, 'save', '__password'), proxyPassword);
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey);
    const keyHash = crypto.createHash('sha256').update(JSON.stringify(publicKey)).digest('hex');
    await writeFile(path.join(temporaryDirectory, 'save', '__known_public_key_hashes.json'), JSON.stringify([keyHash]));
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 300, pub: publicKey })).toString('base64url');
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, Buffer.from(`${header}.${payload}`));
    request.jwt = `${header}.${payload}.${Buffer.from(signature).toString('base64url')}`;
    await writeFile(path.join(temporaryDirectory, 'dist', 'index.html'), '<html><head></head><body>Proxy fixture</body></html>');
    // Reserve a free port without assuming a fixed test port is available.
    const reservation = http.createServer();
    proxyOrigin = await listen(reservation);
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    child = spawn(process.execPath, [path.join(__dirname, 'server.cjs')], {
        cwd: temporaryDirectory,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', chunk => { serverLog += chunk.toString(); });
    child.stderr.on('data', chunk => { serverLog += chunk.toString(); });
    await waitUntil(() => serverLog.includes('HTTP server is running'));
});

after(async () => {
    if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    if (providerSockets) { for (const socket of providerSockets.clients) socket.terminate(); await new Promise(resolve => providerSockets.close(resolve)); }
    for (const server of [provider, sink]) {
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    }
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

async function waitUntil(predicate) {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for fixture state');
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

function request(endpoint, options = {}) {
    return fetch(`${proxyOrigin}/proxy2`, {
        method: options.method || 'POST',
        headers: {
            'content-type': 'application/octet-stream',
            'risu-auth': options.auth ?? proxyPassword,
            'risu-url': encodeURIComponent(options.url || `${providerOrigin}${endpoint}`),
            'risu-header': encodeURIComponent(JSON.stringify(options.headers || {
                Authorization: `Bearer ${fakeKey}`, 'Content-Type': 'application/json',
            })),
            ...(options.timeout && { 'risu-timeout-ms': String(options.timeout) }),
        },
        body: options.method === 'GET' || options.method === 'HEAD' ? undefined : options.body ?? `{"prompt":"${fakePrompt}"}`,
        signal: options.signal,
    });
}

test('ordinary requests preserve body and provider credentials without forwarding Node authentication', async () => {
    const body = '{ "prompt" : "fake-private-prompt", "spacing": true }';
    const response = await request('/echo', { body, headers: {
        Authorization: `Bearer ${fakeKey}`, 'X-Api-Key': fakeKey, 'Content-Type': 'application/json',
        'Risu-Auth': proxyPassword, Cookie: 'private=fake', 'Proxy-Authorization': 'fake',
        Connection: 'x-private-header', 'X-Private-Header': 'fake',
    } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-elsewhere-proxy'), '1');
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(await response.text(), body);
    const actual = received.at(-1);
    assert.equal(actual.headers.authorization, `Bearer ${fakeKey}`);
    assert.equal(actual.headers['x-api-key'], fakeKey);
    for (const key of ['risu-auth', 'cookie', 'proxy-authorization', 'x-private-header']) assert.equal(actual.headers[key], undefined);
});

test('form, multipart and binary payloads arrive unchanged', async () => {
    for (const [contentType, body] of [
        ['application/x-www-form-urlencoded', Buffer.from('grant_type=fake&assertion=fake-token')],
        ['multipart/form-data; boundary=fake-boundary', Buffer.from('--fake-boundary\r\nContent-Disposition: form-data; name="prompt"\r\n\r\nfake-private-prompt\r\n--fake-boundary--\r\n')],
        ['application/octet-stream', Buffer.from([0, 255, 1, 128])],
    ]) {
        const response = await request('/echo', { body, headers: { 'Content-Type': contentType } });
        assert.equal(response.status, 200);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), body);
        assert.equal(received.at(-1).headers['content-type'], contentType);
    }
});

test('GET, PUT, DELETE, empty POST and no-content responses are supported', async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
        const response = await request('/echo', { method });
        assert.equal(response.status, 200);
        await response.arrayBuffer();
        assert.equal(received.at(-1).method, method);
    }
    const empty = await request('/echo', { body: '' });
    assert.equal(empty.status, 200);
    assert.equal(await empty.text(), 'POST /echo');
    assert.equal((await request('/empty')).status, 204);
});

test('streaming delivers the first chunk before completion and preserves provider errors', async () => {
    const response = await request('/stream');
    const reader = response.body.getReader();
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: first\n\n');
    let remaining = '';
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; remaining += new TextDecoder().decode(chunk.value); }
    assert.equal(remaining, 'data: second\n\n');
    const error = await request('/error');
    assert.equal(error.status, 429);
    assert.equal(error.headers.get('retry-after'), '3');
    assert.deepEqual(await error.json(), { error: 'fake provider rate limit' });
});

test('cancellation after headers disconnects the provider', async () => {
    const before = disconnected;
    const controller = new AbortController();
    const response = await request('/slow-stream', { signal: controller.signal });
    const reader = response.body.getReader();
    await reader.read();
    controller.abort();
    await assert.rejects(reader.read());
    await waitUntil(() => disconnected > before);
});

test('reader cancellation disconnects the provider', async () => {
    const before = disconnected;
    const response = await request('/slow-stream');
    await response.body.cancel();
    await waitUntil(() => disconnected > before);
});

test('timeouts apply before headers and throughout streaming', async () => {
    const response = await request('/slow-headers', { timeout: 100 });
    assert.equal(response.status, 504);
    assert.match((await response.json()).error, /timed out/);
    const before = disconnected;
    const stream = await request('/slow-stream', { timeout: 100 });
    await assert.rejects(stream.text());
    await waitUntil(() => disconnected > before);
});

test('same-origin redirects work; cross-origin and hub redirects never receive a prompt or key', async () => {
    const same = await request('/redirect-same');
    assert.equal(same.status, 200);
    assert.match(await same.text(), /fake-private-prompt/);
    const get = await request('/redirect-get');
    assert.equal(await get.text(), 'GET /echo');
    for (const endpoint of ['/redirect-cross', '/redirect-hub', '/redirect-loop']) {
        const response = await request(endpoint);
        assert.equal(response.status, 502);
        await response.text();
    }
    assert.equal(sinkRequests, 0);
});

test('invalid destinations, malformed metadata and unauthenticated requests fail without contacting a provider', async () => {
    const count = received.length;
    for (const url of ['https://sv.risuai.xyz/proxy2', 'https://nightly.sv.risuai.xyz/proxy2',
        'https://SV.RISUAI.XYZ./proxy2', 'https://user:fake-secret@localhost/echo', 'file:///etc/passwd']) {
        assert.equal((await request('/echo', { url })).status, 400);
    }
    assert.equal((await request('/echo', { auth: 'fake-invalid-password' })).status, 401);
    const malformed = await fetch(`${proxyOrigin}/proxy2`, { method: 'POST', headers: {
        'risu-auth': proxyPassword, 'risu-url': '%not-encoded', 'risu-header': '%invalid-json',
    } });
    assert.equal(malformed.status, 400);
    assert.equal(received.length, count);
});

test('old hub AI routes are disabled and server logs contain no key or conversation', async () => {
    for (const endpoint of ['/hub-proxy/proxy2', '/hub-proxy/proxy', '/hub-proxy/proxy-stream-jobs']) {
        const response = await fetch(`${proxyOrigin}${endpoint}`);
        assert.equal(response.status, 410);
        await response.text();
    }
    for (const secret of [fakeKey, fakePrompt, proxyPassword, 'fake-secret', 'fake-token']) {
        assert.equal(serverLog.includes(secret), false);
    }
});


test('the browser JWT authenticates ordinary requests without reaching the provider', async () => {
    const response = await request('/echo', { auth: request.jwt });
    assert.equal(response.status, 200);
    await response.text();
    assert.equal(received.at(-1).headers['risu-auth'], undefined);
});

async function openSocket(url, auth = proxyPassword, timeoutMs) {
    const socket = new WebSocket(proxyOrigin.replace('http:', 'ws:') + '/proxy-websocket');
    await once(socket, 'open');
    const first = once(socket, 'message');
    socket.send(JSON.stringify({ url, auth, timeoutMs }));
    const [data] = await first;
    return { socket, message: JSON.parse(data.toString()) };
}

test('legacy LAN WebSocket streaming is authenticated and cancelled through Node', async () => {
    const before = socketDisconnects;
    const { socket, message } = await openSocket(providerOrigin.replace('http:', 'ws:') + '/legacy-stream', request.jwt);
    assert.equal(message.type, 'provider_open');
    const echoed = once(socket, 'message');
    socket.send(JSON.stringify({ prompt: fakePrompt }));
    assert.deepEqual(JSON.parse((await echoed)[0].toString()), { prompt: fakePrompt });
    socket.close();
    await once(socket, 'close');
    await waitUntil(() => socketDisconnects > before);
});

test('legacy sockets block unauthenticated and hub targets without contacting them', async () => {
    const count = socketConnections;
    for (const [url, auth] of [
        [providerOrigin.replace('http:', 'ws:') + '/legacy-stream', 'fake-invalid-password'],
        ['wss://sv.risuai.xyz/legacy-stream', proxyPassword],
        ['wss://nightly.sv.risuai.xyz/legacy-stream', proxyPassword],
    ]) {
        const { socket, message } = await openSocket(url, auth);
        assert.equal(message.type, 'proxy_error');
        socket.close();
    }
    assert.equal(socketConnections, count);
});

test('legacy socket timeout closes the provider and reports an actionable error', async () => {
    const before = socketDisconnects;
    const { socket, message } = await openSocket(providerOrigin.replace('http:', 'ws:') + '/legacy-stream', proxyPassword, 100);
    assert.equal(message.type, 'provider_open');
    const [data] = await once(socket, 'message');
    assert.match(JSON.parse(data.toString()).message, /timed out/);
    await once(socket, 'close');
    await waitUntil(() => socketDisconnects > before);
});


test('provider connection failures and interrupted streams fail without an alternate destination', async () => {
    const failed = await request('/disconnect');
    assert.equal(failed.status, 502);
    assert.match((await failed.json()).error, /could not reach the provider/);
    const count = received.length;
    const broken = await request('/broken-stream');
    await assert.rejects(broken.text());
    assert.equal(received.length, count + 1);
    assert.equal(sinkRequests, 0);
});

test('provider WebSocket redirects are not followed', async () => {
    const { socket, message } = await openSocket(providerOrigin.replace('http:', 'ws:') + '/redirect-cross');
    assert.equal(message.type, 'proxy_error');
    socket.close();
    assert.equal(sinkRequests, 0);
});


test('Node HTML entry aliases preserve the Node platform flag', async () => {
    for (const endpoint of ['/index.html', '/%69ndex.html', '/index.html?test=fake-alias']) {
        const response = await fetch(`${proxyOrigin}${endpoint}`);
        assert.equal(response.url, `${proxyOrigin}/${endpoint.includes('?') ? '?test=fake-alias' : ''}`);
        assert.match(await response.text(), /globalThis.__NODE__ = true/);
    }
});

test('proxy parser errors retain their status and a safe JSON response', async () => {
    const count = received.length;
    const response = await fetch(`${proxyOrigin}/proxy2`, {
        method: 'POST', body: fakePrompt,
        headers: { 'risu-auth': proxyPassword, 'content-type': 'application/octet-stream', 'content-encoding': 'unsupported-fake-encoding' },
    });
    assert.equal(response.status, 415);
    assert.equal(response.headers.get('x-elsewhere-proxy'), '1');
    assert.match(response.headers.get('content-type'), /application\/json/);
    const body = await response.text();
    assert.match(body, /content encoding/);
    assert.equal(body.includes(fakePrompt), false);
    assert.equal(received.length, count);
});
