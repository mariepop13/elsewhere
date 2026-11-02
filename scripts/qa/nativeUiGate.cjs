/* Isolated production-artifact acceptance. No real backend or provider is used. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { makeDatabase, encodeDatabase } = require('./nativeUiFixtures.cjs');

const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
    assert(['--dist', '--manifest', '--report', '--origin', '--tree'].includes(process.argv[i]), 'Unknown gate option');
    assert(process.argv[i + 1], 'Missing gate option value');
    options[process.argv[i].slice(2)] = process.argv[i + 1];
}
assert(options.dist && options.manifest && options.report && options.tree, 'Pass --dist, --manifest, --report and --tree');
const dist = fs.realpathSync(options.dist), report = path.resolve(options.report);
const manifest = JSON.parse(fs.readFileSync(options.manifest));
assert.equal(manifest.candidate_tree, options.tree, 'Wrong source identity');
assert(manifest.built_files?.length, 'Build hashes are required');
for (const file of manifest.built_files) {
    const relative = file.path.replace(/^build-private\//, '');
    const local = path.resolve(dist, relative);
    assert(local.startsWith(dist + path.sep), 'Unsafe manifest path');
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex'), file.sha256, relative);
}
const origin = new URL(options.origin || manifest.build_preview_origin);
assert(origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname), 'Native download gate needs an explicitly configured loopback HTTP build. Private-preview visual QA uses the supported-route unifiedWorkspaceGate; never bypass TLS or DNS.');
assert(origin.port, 'Use a dedicated fixture port');
fs.mkdirSync(report, { recursive: true });
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const errors = [], unexpected = [], passed = [], providerRequests = [], downloads = [], requests = [];
const saved = new Map([['database/database.bin', encodeDatabase(makeDatabase())]]);
let writes = 0, browser, server, tlsDirectory, failure, activePage;
const observedDownloads = [], cleanupErrors = [];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function respond(res, status, body, type = 'application/json') {
    res.writeHead(status, { 'content-type': type, 'content-security-policy': "connect-src 'self'; worker-src 'self'; frame-src 'self'; form-action 'self'; base-uri 'self'" });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
async function handler(req, res) {
    try {
        const url = new URL(req.url, origin);
        requests.push({ method: req.method, path: url.pathname });
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        const key = Buffer.from(req.headers['file-path'] || '', 'hex').toString('utf8');
        if (url.pathname === '/api/test_auth') return respond(res, 200, { status: 'success' });
        if (url.pathname === '/api/read') return respond(res, 200, saved.get(key) || Buffer.alloc(0), 'application/octet-stream');
        if (url.pathname === '/api/write') { saved.set(key, body); writes++; return respond(res, 200, { success: true }); }
        if (url.pathname === '/api/list') return respond(res, 200, { content: [...saved.keys()] });
        if (url.pathname === '/api/remove') { for (const item of key.split('$$')) saved.delete(item); return respond(res, 200, { success: true }); }
        if (url.pathname === '/proxy2') {
            res.setHeader('x-elsewhere-proxy', '1');
            const payload = JSON.parse(body.toString() || '{}');
            if (!payload.messages) return respond(res, 200, { data: [] });
            providerRequests.push(payload);
            return respond(res, 200, { choices: [{ message: { content: 'Fixture regenerated reply' }, finish_reason: 'stop' }], usage: { prompt_tokens: 30, completion_tokens: 10 } });
        }
        if (req.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/proxy')) {
            unexpected.push(`${req.method} ${url.pathname}`); return respond(res, 503, { error: 'Unexpected fixture route' });
        }
        if (url.pathname.endsWith('/ping')) return respond(res, 200, 'pong', 'text/plain');
        const local = path.resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!local.startsWith(dist + path.sep) || !fs.existsSync(local) || !fs.statSync(local).isFile()) return respond(res, 404, 'No fixture asset', 'text/plain');
        let data = fs.readFileSync(local);
        if (url.pathname === '/') data = Buffer.from(data.toString().replace('<head>', '<head><script>globalThis.__NODE__ = true</script>'));
        return respond(res, 200, data, types[path.extname(local)] || 'application/octet-stream');
    } catch (error) { unexpected.push(error.message); respond(res, 500, { error: 'Fixture handler failure' }); }
}

async function run() {
    try {
        server = http.createServer(handler);
        // Fail if loopback is busy. Never replace, stop or reconfigure an existing listener.
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(origin.port), '127.0.0.1', resolve); });
        browser = await chromium.launch({ headless: true, timeout: 30000,
            ...(process.env.QA_BROWSER_EXECUTABLE ? { executablePath: process.env.QA_BROWSER_EXECUTABLE } : {}),
        });
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US', acceptDownloads: true });
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin === origin.origin) return route.continue();
            if (!['https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'].includes(url.origin)) unexpected.push('External request ' + url.origin);
            return route.abort();
        });
        await context.addInitScript(() => {
            const clipboard = [];
            Object.defineProperty(navigator, 'clipboard', { value: { write: async items => { for (const item of items) clipboard.push(await (await item.getType('text/plain')).text()); }, writeText: async text => clipboard.push(text) }, configurable: true });
            globalThis.__fixtureClipboard = clipboard;
        });
        context.on('serviceworker', worker => { if (worker.url() !== origin.origin + '/streamsaver/sw.js') unexpected.push('Unexpected service worker ' + worker.url()); });
        context.on('page', p => { p.on('pageerror', e => errors.push(e.message)); p.on('download', d => observedDownloads.push(d.suggestedFilename())); });
        const page = await context.newPage(); activePage = page;
        page.setDefaultTimeout(20000);

        const checkpoint = name => { assert.deepEqual(errors, [], 'JavaScript error'); assert.deepEqual(unexpected, [], 'Unplanned network request'); passed.push(name); console.log('PASS', name); };
        const navigationButton = async name => {
            const desktop = page.locator('.world-shell-navigation').getByRole('button', { name: new RegExp('^' + name) });
            return await desktop.isVisible() ? desktop : page.locator('.world-shell-bottomnav').getByRole('button', { name: new RegExp('^' + name) });
        };
        const nav = async name => { await (await navigationButton(name)).click(); };
        const privateChat = page.getByRole('region', { name: 'Private conversation', exact: true });
        const row = index => page.locator(`.world-chat-message[data-chat-index="${index}"]`);
        const menu = page.getByRole('dialog', { name: 'Message actions', exact: true });
        const action = async (index, name) => { await row(index).getByRole('button', { name: /Message actions/ }).click(); await menu.getByRole('button', { name, exact: true }).click(); };
        const ok = async () => { const button = page.getByRole('button', { name: 'OK', exact: true }); if (await button.count()) await button.click(); };
        const openJun = async () => { await nav('Messages'); await page.getByRole('region', { name: 'Private messages', exact: true }).getByRole('button', { name: /^Fixture Jun Direct conversation Fixture/ }).click(); await privateChat.waitFor(); };
        const libraryPanel = name => page.locator('.ew-panel').filter({ has: page.locator('strong').filter({ hasText: new RegExp('^' + name + '$') }) });
        const tools = page.getByRole('dialog', { name: 'Native Elsewhere tools', exact: true });
        const shareToolbar = async () => { await tools.locator('.world-native-panel-body > div.flex.mb-2 > button').last().click(); };
        await page.goto(origin.href, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Continue with local setup', exact: true }).click();
        await page.getByRole('region', { name: 'Elsewhere world', exact: true }).waitFor();
        await openJun(); await row(3).waitFor(); await row(-1).getByText('Fixture card greeting', { exact: false }).waitFor();
        await row(-1).getByRole('button', { name: /Message actions/ }).click();
        for (const name of ['Branch', 'Disable Message', 'Cut Messages for AI', 'Remove', 'Edit']) assert.equal(await menu.getByRole('button', { name, exact: true }).count(), 0, 'Greeting mutation must be absent');
        await menu.getByRole('button', { name: 'Copy', exact: true }).click(); await page.waitForFunction(() => globalThis.__fixtureClipboard.some(text => text.includes('Fixture card greeting'))); await ok();
        assert((await page.evaluate(() => globalThis.__fixtureClipboard)).some(text => text.includes('Fixture card greeting')));
        await action(-1, 'Next reply'); await row(-1).getByText('Fixture alternate greeting', { exact: false }).waitFor();
        checkpoint('Greeting supports copy/alternate reply and exposes no saved-message mutations');

        await action(1, 'Copy'); await page.waitForFunction(() => globalThis.__fixtureClipboard.some(text => text.includes('Fixture legacy reply'))); await ok();
        assert((await page.evaluate(() => globalThis.__fixtureClipboard)).some(text => text.includes('Fixture legacy reply')));
        await action(1, 'Disable Message'); await page.waitForFunction(() => document.querySelectorAll('.border-dashed.border-focus').length === 2);
        await action(1, 'Disable Message'); await page.waitForFunction(() => document.querySelectorAll('.border-dashed.border-focus').length === 0);
        await action(1, 'Cut Messages for AI'); await action(1, 'Cut Messages for AI');
        await action(1, 'Edit'); await row(1).locator('textarea').fill('Fixture edited legacy reply'); await action(1, 'Edit');
        await row(1).getByText('Fixture edited legacy reply', { exact: false }).waitFor();
        await action(1, 'Bookmark'); await page.locator('#alert-input').fill('Fixture bookmark'); await ok();
        checkpoint('Legacy message without chatId/disabled supports copy, edit, disable, cut and bookmark');

        const before = await privateChat.locator('.world-chat-message[data-chat-index]').count();
        await action(2, 'Remove'); await page.getByRole('button', { name: 'NO', exact: true }).click();
        assert.equal(await privateChat.locator('.world-chat-message[data-chat-index]').count(), before);
        await action(2, 'Remove'); await page.getByRole('button', { name: 'YES', exact: true }).click();
        await page.waitForFunction(expected => document.querySelectorAll('.world-chat-message[data-chat-index]').length === expected, before - 1);
        await action(2, 'Regenerate reply'); await privateChat.getByText('Fixture regenerated reply', { exact: false }).waitFor();
        assert.equal(providerRequests.length, 1);
        checkpoint('Message deletion cancel/confirm and regular reply regeneration have meaningful outcomes');

        await action(1, 'Branch'); await nav('Messages');
        await openJun();
        await privateChat.getByRole('button', { name: 'Conversation details for Fixture Jun', exact: true }).click();
        await page.getByRole('dialog', { name: 'Conversation details', exact: true }).getByRole('button', { name: 'Conversation versions', exact: true }).click();
        const versions = page.getByRole('dialog', { name: 'Conversation versions', exact: true });
        await versions.getByRole('button', { name: /Branch/ }).waitFor();
        await versions.getByRole('button', { name: /^Main story / }).click();
        await row(1).getByText('Fixture edited legacy reply', { exact: false }).waitFor();
        checkpoint('Branch creates a separate native history and preserves the original edited message');

        await nav('Library'); await libraryPanel('Fixture Jun').getByRole('button', { name: 'Edit native card', exact: true }).click(); await tools.waitFor(); await shareToolbar();
        await tools.getByRole('button', { name: 'Remove Character', exact: true }).click(); await page.getByRole('button', { name: 'NO', exact: true }).click(); assert(await tools.isVisible());
        await tools.getByRole('button', { name: 'Export Character', exact: true }).click();
        const exportHeading = page.getByRole('heading', { name: /Share\/Export/ }); await exportHeading.waitFor();
        const beforeCancel = observedDownloads.length; await exportHeading.getByRole('button').click(); await exportHeading.waitFor({ state: 'hidden' }); await page.waitForTimeout(300); assert.equal(observedDownloads.length, beforeCancel);
        for (const format of ['json', '']) {
            await tools.getByRole('button', { name: 'Export Character', exact: true }).click(); await exportHeading.waitFor();
            await exportHeading.locator('..').locator('select').selectOption(format);
            const pending = page.waitForEvent('download', { timeout: 30000 }); await exportHeading.locator('..').getByRole('button', { name: 'Export', exact: true }).click();
            const download = await pending; assert.equal(await download.failure(), null); const file = path.join(report, download.suggestedFilename()); await download.saveAs(file); downloads.push(file);
            const bytes = fs.readFileSync(file);
            if (format === 'json') { const card = JSON.parse(bytes); assert.equal(card.spec, 'chara_card_v3'); assert.equal(card.data.name, 'Fixture Jun'); assert.equal(card.data.description, 'Fixture-only private description'); }
            else assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
            await page.getByRole('button', { name: 'OK', exact: true }).click();
        }
        checkpoint('Native JSON/PNG exports produce actual local downloads; export cancellation produces none');
        await tools.getByRole('button', { name: 'Back to your world', exact: true }).click(); await nav('Library');
        const originalJunCount = await libraryPanel('Fixture Jun').count();
        for (const file of downloads) {
            const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Import character cards', exact: true }).click(); await (await chooser).setFiles(file);
            await page.getByRole('button', { name: 'OK', exact: true }).waitFor(); await ok();
        }
        assert.equal(await libraryPanel('Fixture Jun').count(), originalJunCount + 2);
        checkpoint('Both downloaded cards reimport through the actual native importer');

        await libraryPanel('Fixture Nell').getByRole('button', { name: 'Edit native card', exact: true }).click(); await tools.waitFor(); await shareToolbar();
        await tools.getByRole('button', { name: 'Remove Character', exact: true }).click(); await page.getByRole('button', { name: 'YES', exact: true }).click(); await page.getByRole('button', { name: 'NO', exact: true }).click(); assert(await tools.isVisible());
        await tools.getByRole('button', { name: 'Remove Character', exact: true }).click(); await page.getByRole('button', { name: 'YES', exact: true }).click(); await page.getByRole('button', { name: 'YES', exact: true }).click(); await tools.waitFor({ state: 'hidden' });
        await nav('Library'); assert.equal(await libraryPanel('Fixture Nell').count(), 0); assert.equal(await libraryPanel('Fixture Jun').count(), originalJunCount + 2);
        checkpoint('Character deletion respects both cancellations, closes the editor on confirmation and preserves other cards');

        assert(writes > 0, 'No native persistence write observed'); await page.waitForTimeout(1500); await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('region', { name: 'Elsewhere world', exact: true }).waitFor(); await nav('Library');
        assert.equal(await libraryPanel('Fixture Nell').count(), 0); assert.equal(await libraryPanel('Fixture Jun').count(), originalJunCount + 2);
        await nav('Messages'); await page.getByRole('region', { name: 'Private messages', exact: true }).getByRole('button', { name: /^Fixture Jun Direct conversation/ }).first().click(); await row(1).getByText('Fixture edited legacy reply', { exact: false }).waitFor();
        await nav('World');
        const retainedDraft = 'Fixture post draft retained during native settings navigation';
        await page.getByRole('textbox', { name: 'Write a post', exact: true }).fill(retainedDraft);
        const openAdvanced = async () => {
            await nav('Settings');
            await page.getByRole('button', { name: 'Model settings', exact: true }).click();
            await tools.getByRole('button', { name: 'All settings', exact: true }).click();
            await tools.getByRole('button', { name: 'Advanced Settings', exact: true }).click();
            await tools.getByRole('heading', { name: 'Advanced Settings', exact: true, level: 1 }).waitFor();
        };
        for (const width of [1280, 390]) {
            await page.setViewportSize({ width, height: 900 });
            for (const name of ['Library', 'World', 'Messages', 'Settings', 'Library']) {
                await openAdvanced();
                assert.equal(await tools.getAttribute('aria-modal'), 'false', 'Visible shell navigation must remain accessible');
                const setting = tools.locator('[data-setting-id="adv.lbDepth"] input');
                await setting.fill('7'); await setting.press('Tab');
                const target = await navigationButton(name); await target.click();
                await tools.waitFor({ state: 'hidden' });
                assert.equal(await target.getAttribute('aria-current'), 'page', name);
                assert(await target.evaluate(button => document.activeElement === button), 'Focus must stay on the selected shell navigation');
                const visiblePage = page.locator('.world-page-scroll').filter({ visible: true });
                assert.equal(await visiblePage.count(), 1, 'Exactly one actual World page should be visible');
                if (name === 'Library') assert(await page.getByRole('heading', { name: 'Your library', exact: true }).isVisible());
                if (name === 'World') assert.equal(await page.getByRole('textbox', { name: 'Write a post', exact: true }).inputValue(), retainedDraft);
                if (name === 'Messages') assert(await page.getByRole('region', { name: 'Private messages', exact: true }).isVisible());
                if (name === 'Settings') assert(await page.getByRole('heading', { name: 'Your world', exact: true }).isVisible());
            }
            await openAdvanced();
            assert.equal(await tools.locator('[data-setting-id="adv.lbDepth"] input').inputValue(), '7');
            await tools.getByRole('button', { name: 'All settings', exact: true }).click();
            await tools.getByRole('button', { name: 'Elsewords', exact: true }).click();
            const workshop = page.getByRole('dialog', { name: 'Elsewords', exact: true }); await workshop.waitFor();
            await workshop.getByRole('tab', { name: 'Translate', exact: true }).waitFor();
            await workshop.getByRole('tab', { name: 'Generate character', exact: true }).waitFor();
            await page.screenshot({ path: path.join(report, 'accepted-elsewords-' + width + '.png') });
            await workshop.getByRole('button', { name: 'Close Elsewords', exact: true }).click();
            await nav('Library'); await tools.waitFor({ state: 'hidden' });
        }
        // No tab router is introduced: existing browser history must not revive
        // a dismissed native panel or replace the selected workspace page.
        await page.evaluate(() => history.pushState({ fixtureNavigation: true }, '', '?fixture-navigation=1'));
        await page.goBack(); await page.waitForURL(origin.origin + '/');
        await tools.waitFor({ state: 'hidden' });
        await page.goForward(); await page.waitForURL(origin.origin + '/?fixture-navigation=1');
        await tools.waitFor({ state: 'hidden' });
        await page.evaluate(() => history.replaceState(null, '', '/'));
        await page.waitForTimeout(1500); await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('region', { name: 'Elsewhere world', exact: true }).waitFor();
        await nav('World'); assert.equal(await page.getByRole('textbox', { name: 'Write a post', exact: true }).inputValue(), retainedDraft);
        await openAdvanced(); assert.equal(await tools.locator('[data-setting-id="adv.lbDepth"] input').inputValue(), '7');
        await nav('Library'); await tools.waitFor({ state: 'hidden' });
        checkpoint('Desktop/mobile shell navigation exits native settings, retains focus, saved settings and post drafts across repeats/history/reload');
        await openJun();
        await page.setViewportSize({ width: 320, height: 844 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: path.join(report, 'accepted-native-mobile-320.png') });
        checkpoint('Reload preserves native edits, imported cards and deletion; mobile320 has no page overflow');
        await context.close();
    } catch (error) {
        failure = error;
        if (activePage && !activePage.isClosed()) { try { fs.writeFileSync(path.join(report, "failure-page.txt"), await activePage.locator("body").innerText()); await activePage.screenshot({ path: path.join(report, "failure-page.png") }); } catch {} }
    } finally {
        // Cleanup each owned resource even if an earlier cleanup step fails.
        for (const dispose of [
            async () => { if (browser) await browser.close(); },
            async () => { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } },
            async () => { if (tlsDirectory) fs.rmSync(tlsDirectory, { recursive: true, force: true }); },
        ]) { try { await dispose(); } catch (error) { cleanupErrors.push(error.message); } }
        fs.writeFileSync(path.join(report, 'result.json'), JSON.stringify({ status: failure || cleanupErrors.length || errors.length || unexpected.length || observedDownloads.length !== downloads.length ? 'FAIL' : 'PASS', artifact_tree: options.tree, verified_build_files: manifest.built_files.length, passed, errors, unexpected, failure: failure?.message, fixture_provider_requests: providerRequests.length, downloads: downloads.map(file => path.basename(file)), observed_downloads: observedDownloads, storage_writes: writes, streamsaver_requests: requests.filter(r => r.path.startsWith('/streamsaver/')), isolation: 'Disposable database; same-origin fixture CSP and browser external-route denial; owned loopback listener.', limitations: ['Physical device, Tauri/OS save dialog, real providers and exhaustive feature coverage remain outside this gate.'], cleanup: { status: cleanupErrors.length ? 'FAIL' : 'PASS', errors: cleanupErrors } }, null, 2));
    }
    if (failure) throw failure;
    assert.deepEqual(cleanupErrors, [], 'Owned fixture cleanup failed');
    assert.deepEqual(errors, [], 'Late JavaScript error');
    assert.deepEqual(unexpected, [], 'Late unexpected request');
    assert.equal(observedDownloads.length, downloads.length, 'Unexpected or late download');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
