const http = require('node:http');
const { WebSocketServer } = require('ws');

// Development-only simulated provider. Bind only to loopback and accept fake credentials.
const requests = [];
const server = http.createServer(async (req, res) => {
    if (req.url === '/trace') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(requests));
        return;
    }
    if (req.headers.authorization !== 'Bearer fake-provider-key') {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end('{"error":"Use only the fake-provider-key for this local fixture."}');
        return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString();
    let body;
    try { body = JSON.parse(rawBody); }
    catch { res.writeHead(400); res.end('Expected JSON'); return; }
    const request = { method: req.method, url: req.url, headers: req.headers, body, cancelled: false };
    requests.push(request);
    res.on('close', () => { request.cancelled = !res.writableFinished; });
    // Earlier fixture scenarios must not change the current user turn's response.
    const prompt = JSON.stringify(Array.isArray(body.messages)
        ? body.messages.findLast(message => message?.role === 'user')?.content ?? ''
        : body.prompt ?? '');
    if (!prompt.includes('fake-')) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end('{"error":"Use a prompt starting with fake- in this development fixture."}');
        return;
    }
    if (prompt.includes('fake-provider-error')) {
        res.writeHead(429, { 'content-type': 'application/json' });
        res.end('{"error":{"message":"Fake provider rate limit"}}');
        return;
    }
    if (!body.stream) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Fake ordinary reply.' }, finish_reason: 'stop' }] }));
        return;
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const chunk = text => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text }, finish_reason: null }] })}\n\n`;
    res.write(chunk('Fake streamed '));
    if (prompt.includes('fake-slow-stream')) {
        const timer = setInterval(() => res.write(chunk('waiting ')), 500);
        res.on('close', () => clearInterval(timer));
    } else {
        setTimeout(() => res.end(chunk('reply.') + 'data: [DONE]\n\n'), 500);
    }
});
const sockets = new WebSocketServer({ server });
sockets.on('connection', socket => {
    socket.on('message', () => {
        socket.send(JSON.stringify({ event: 'text_stream', text: 'Fake legacy stream.' }));
        socket.send(JSON.stringify({ event: 'stream_end' }));
    });
});
server.listen(Number(process.env.FIXTURE_PORT || 6602), '127.0.0.1', () => {
    console.log('Fake provider ready on http://127.0.0.1:' + server.address().port + '/v1/chat/completions');
});
