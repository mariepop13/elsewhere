const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');

let fixture;
let origin;
before(async () => {
    fixture = spawn(process.execPath, [path.join(__dirname, 'providerFixture.cjs')], {
        env: { ...process.env, FIXTURE_PORT: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    origin = await new Promise((resolve, reject) => {
        let output = '';
        fixture.stdout.on('data', chunk => {
            output += chunk;
            const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
            if (match) resolve(match[0]);
        });
        fixture.once('error', reject);
        fixture.once('exit', code => reject(new Error(`Fixture exited: ${code}`)));
    });
});
after(async () => {
    if (fixture && fixture.exitCode === null) {
        const exited = once(fixture, 'exit');
        fixture.kill();
        await exited;
    }
});

function request(prompt, stream = false, signal, history = []) {
    return fetch(`${origin}/v1/chat/completions`, {
        method: 'POST',
        headers: { authorization: 'Bearer fake-provider-key', 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: prompt }], stream }),
        signal,
    });
}

test('manual fixture provides ordinary replies and provider errors', async () => {
    const ordinary = await request('fake-ordinary');
    assert.equal(ordinary.status, 200);
    assert.equal((await ordinary.json()).choices[0].message.content, 'Fake ordinary reply.');
    const failure = await request('fake-provider-error');
    assert.equal(failure.status, 429);
    assert.equal((await failure.json()).error.message, 'Fake provider rate limit');
});

test('manual fixture emits incremental, parseable SSE events and a DONE event', async () => {
    const response = await request('fake-stream', true);
    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    const reader = response.body.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    assert.ok(first.endsWith('\n\n'), 'Each SSE event must end with real blank lines');
    assert.equal(JSON.parse(first.slice(6).trim()).choices[0].delta.content, 'Fake streamed ');
    let remaining = '';
    while (true) {
        const result = await reader.read();
        if (result.done) break;
        remaining += new TextDecoder().decode(result.value);
    }
    const events = remaining.trim().split('\n\n');
    assert.equal(JSON.parse(events[0].slice(6)).choices[0].delta.content, 'reply.');
    assert.equal(events[1], 'data: [DONE]');
});

test('manual fixture records cancellation after a real streamed event', async () => {
    const controller = new AbortController();
    const response = await request('fake-slow-stream', true, controller.signal);
    const reader = response.body.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    assert.ok(first.includes('\n\n'));
    controller.abort();
    await assert.rejects(reader.read(), { name: 'AbortError' });
    const deadline = Date.now() + 2000;
    let cancelled = false;
    while (Date.now() < deadline) {
        const trace = await (await fetch(`${origin}/trace`)).json();
        cancelled = trace.some(item => item.body.messages[0].content === 'fake-slow-stream' && item.cancelled);
        if (cancelled) break;
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.ok(cancelled, 'Client cancellation must be visible in the fixture trace');
});


test('manual fixture selects the latest user turn rather than an earlier error scenario', async () => {
    const response = await request('fake-ordinary', false, undefined, [
        { role: 'user', content: 'fake-provider-error' },
        { role: 'assistant', content: 'Fake previous turn.' },
    ]);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).choices[0].message.content, 'Fake ordinary reply.');
});


test('manual fixture completes a normal stream after an earlier slow-stream scenario', async () => {
    const response = await request('fake-stream', true, AbortSignal.timeout(5000), [
        { role: 'user', content: 'fake-slow-stream' },
        { role: 'assistant', content: 'Fake cancelled turn.' },
    ]);
    const body = await response.text();
    assert.ok(body.endsWith('data: [DONE]\n\n'));
    assert.ok(!body.includes('waiting '));
});
