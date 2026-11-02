const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ReadableStream } = require('node:stream/web');

function worker() {
    const self = { addEventListener() {}, registration: { scope: 'https://fixture.invalid/streamsaver/' } };
    vm.runInNewContext(fs.readFileSync(process.env.QA_STREAMSAVER_SW || path.resolve(__dirname, '../../public/streamsaver/sw.js'), 'utf8'), { self, ReadableStream, Response, Headers, console });
    return self;
}
const payload = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const stream = () => new ReadableStream({ start(controller) { controller.enqueue(payload); controller.close(); } });
function download(self, metadata) {
    const port = { postMessage() {} };
    self.onmessage({ data: { ...metadata, url: 'https://fixture.invalid/streamsaver/export.png' }, ports: [port] });
    let response;
    self.onfetch({ request: { url: 'https://fixture.invalid/streamsaver/export.png' }, respondWith(value) { response = Promise.resolve(value); } });
    return { port, response };
}
for (const mode of ['direct', 'delayed-transfer', 'chunks']) {
    test(`StreamSaver preserves actual binary bytes via ${mode}`, async () => {
        const self = worker();
        const { port, response } = download(self, mode === 'direct' ? { readableStream: stream() } : mode === 'delayed-transfer' ? { transferringReadable: true } : {});
        if (mode === 'delayed-transfer') {
            await new Promise(resolve => setImmediate(resolve));
            port.onmessage({ data: { readableStream: stream() } });
        } else if (mode === 'chunks') {
            port.onmessage({ data: payload });
            port.onmessage({ data: 'end' });
        }
        assert.deepEqual(new Uint8Array(await (await response).arrayBuffer()), payload);
        let secondResponse = false;
        self.onfetch({ request: { url: 'https://fixture.invalid/streamsaver/export.png' }, respondWith() { secondResponse = true; } });
        assert.equal(secondResponse, false, 'Completed download must be removed');
    });
}
