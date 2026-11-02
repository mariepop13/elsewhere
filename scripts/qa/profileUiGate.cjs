/* Isolated production-artifact acceptance. No real backend or provider is used. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { makeDatabase, encodeDatabase } = require('./profileUiFixtures.cjs');

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
const verificationChunk = Buffer.allocUnsafe(65536);
for (const file of manifest.built_files) {
    const relative = file.path.replace(/^build-private\//, '');
    const local = path.resolve(dist, relative);
    assert(local.startsWith(dist + path.sep), 'Unsafe manifest path');
    // Reuse a small buffer so manifest verification does not retain whole assets
    // in the browser owner's Node process on a memory-constrained host.
    const hash = crypto.createHash('sha256'), chunk = verificationChunk;
    const descriptor = fs.openSync(local, 'r');
    try { let bytes; while ((bytes = fs.readSync(descriptor, chunk, 0, chunk.length, null))) hash.update(chunk.subarray(0, bytes)); }
    finally { fs.closeSync(descriptor); }
    assert.equal(hash.digest('hex'), file.sha256, relative);
}
const origin = new URL(options.origin || manifest.build_preview_origin);
assert(['http:', 'https:'].includes(origin.protocol));
assert(origin.port, 'Use a dedicated fixture port');
assert.equal(manifest.usage_mode, 'private-preview');
assert.equal(origin.origin, new URL(manifest.build_preview_origin).origin);
fs.mkdirSync(report, { recursive: true });
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const errors = [], unexpected = [], passed = [], providerRequests = [], downloads = [], requests = [];
const fixtureDatabase = makeDatabase();
const saved = new Map([['database/database.bin', encodeDatabase(fixtureDatabase)]]);
let writes = 0, browser, server, tlsDirectory, failure, activePage;
const observedDownloads = [], cleanupErrors = [];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function respond(res, status, body, type = 'application/json') {
    res.writeHead(status, { 'content-type': type, 'content-security-policy': "connect-src 'self'; worker-src 'self'; frame-src 'self'; form-action 'self'; base-uri 'self'" });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
let fixtureMode = 'valid';
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
            await new Promise(resolve => setTimeout(resolve, 4000));
            return respond(res, 200, { choices: [{ message: { content: fixtureMode === 'malformed' ? 'Fixture invalid card response' : JSON.stringify({spec:'chara_card_v3',spec_version:'3.0',data:{name:'Fixture generated Jun',description:'{{char}} walks with {{user}}.',personality:'Calm',scenario:'A fictional meadow',first_mes:'Hello {{user}}',mes_example:'{{char}}: Hello',extensions:{fixture:true}}}) }, finish_reason: 'stop' }], usage: { prompt_tokens: 30, completion_tokens: 10 } });
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



const {preflight,monitor}=require('./profileMemoryMonitor.cjs');
const batch=process.env.QA_BATCH||'pilot';
async function runUnified() {
 const captures=[],fixtureRequests=[];let resourceMonitor,resourceReport,preflightReport;
 preflightReport=await preflight(Number(process.env.QA_START_KIB||1572864));console.log('RESOURCE preflight',JSON.stringify(preflightReport));
 try{
  resourceMonitor=monitor(async reason=>{console.error('RESOURCE_STOP',reason);if(browser)await browser.close()});
  browser=await chromium.launch({chromiumSandbox:true,headless:true,timeout:30000,executablePath:process.env.QA_BROWSER_EXECUTABLE,args:['--disable-gpu']});
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'en-US',serviceWorkers:'block'});
  await context.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==origin.origin){if(!['https://fonts.googleapis.com','https://fonts.gstatic.com','https://cdn.jsdelivr.net'].includes(url.origin))unexpected.push(url.origin);return route.abort()}
   fixtureRequests.push({method:request.method(),path:url.pathname});let status=200,headers={},output;await handler({url:url.pathname+url.search,method:request.method(),headers:request.headers(),async *[Symbol.asyncIterator](){const body=request.postDataBuffer();if(body)yield body}}, {writeHead(code,h){status=code;headers={...headers,...h}},setHeader(k,v){headers[k]=v},end(data){output=data}});await route.fulfill({status,headers,body:output});});
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));const page=await context.newPage();activePage=page;page.setDefaultTimeout(15000);
  const check=name=>{assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);passed.push(name);console.log('PASS',name)};
  const shot=async name=>{const file=path.join(report,name+'.png');await page.screenshot({path:file});captures.push(file)};
  const navButton=async name=>{const d=page.locator('.world-shell-navigation').getByRole('button',{name:new RegExp('^'+name)});return await d.isVisible()?d:page.locator('.world-shell-bottomnav').getByRole('button',{name:new RegExp('^'+name)})};const nav=async name=>{await(await navButton(name)).click()};
  const profile=page.getByRole('dialog',{name:'Fixture Jun',exact:true});
  const close=async()=>{await profile.getByRole('button',{name:'Close profile',exact:true}).click();await profile.waitFor({state:'hidden'})};
  await page.goto(origin.href,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Continue with local setup',exact:true}).click();await page.getByRole('region',{name:'Elsewhere world',exact:true}).waitFor();
  assert.equal(await page.locator('.world-shell-navigation,.world-shell-bottomnav').getByRole('button',{name:'Relationships',exact:true}).count(),0);
  const fromFeed=async()=>{await nav('World');await page.getByRole('button',{name:"View Fixture Jun's profile",exact:true}).click();await profile.waitFor()};
  const fromDm=async()=>{await nav('Messages');await page.getByRole('region',{name:'Private messages',exact:true}).getByRole('button',{name:/^Fixture Jun Direct conversation/}).click();await page.getByRole('region',{name:'Private conversation',exact:true}).getByRole('button',{name:'View profile for Fixture Jun',exact:true}).first().click();await profile.waitFor()};
  if(batch==='inflight'){
   await nav('Messages');await page.getByRole('region',{name:'Private messages',exact:true}).getByRole('button',{name:/^Fixture Jun Direct conversation/}).click();const conversation=page.getByRole('region',{name:'Private conversation',exact:true});await conversation.locator('textarea.text-input-area').fill('Fixture request to cancel');await conversation.locator('.button-icon-send').click();const cancel=conversation.locator('button[aria-labelledby="cancel"]');await cancel.waitFor();
   await conversation.getByRole('button',{name:'View profile for Fixture Jun',exact:true}).first().click();await profile.waitFor();assert(await profile.getByRole('button',{name:'Record a private interaction',exact:true}).isDisabled());await close();await cancel.waitFor();await conversation.getByRole('button',{name:'View profile for Fixture Jun',exact:true}).last().click();await profile.waitFor();assert(await profile.getByRole('button',{name:'Record a private interaction',exact:true}).isDisabled());await close();await cancel.click();await conversation.locator('.button-icon-send').waitFor();await conversation.getByRole('button',{name:'View profile for Fixture Jun',exact:true}).first().click();await profile.waitFor();assert(await profile.getByRole('button',{name:'Record a private interaction',exact:true}).isEnabled());await close();check('Opening/closing character profile preserves active generation; recording blocked until explicit cancellation');
  }else if(batch==='mobile'){
   await page.setViewportSize({width:390,height:844});
   await page.locator('.world-shell-mobile-setup').click();await page.getByRole('region',{name:'World setup',exact:true}).waitFor();await page.getByRole('button',{name:'Return to feed',exact:true}).click();
   await page.locator('.world-shell-mobile-action[aria-label="View profile for Fixture player"]').click();const own=page.getByRole('dialog',{name:'Fixture player',exact:true});await own.waitFor();assert.equal(await own.getByRole('region',{name:'Character relationship'}).count(),0);await own.getByRole('button',{name:'Close profile',exact:true}).click();
   await fromDm();await profile.getByRole('article',{name:'Relationship: Fixture alternate persona and Fixture Jun'}).waitFor();await shot('character-profile-mobile-390');await page.setViewportSize({width:320,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('character-profile-mobile-320');await close();check('Mobile World gear edits setup; own avatar opens only own profile; character profile fits 320px');
  }else if(batch==='private'){
   await fromDm();await profile.getByRole('article',{name:'Relationship: Fixture alternate persona and Fixture Jun'}).waitFor();assert((await profile.innerText()).includes('ALT AUTHORIZED MEMORY'));assert(!(await profile.innerText()).includes('MAIN AUTHORIZED MEMORY'));await shot('character-profile-dm');await close();
   const conversation=page.getByRole('region',{name:'Private conversation',exact:true});const openVersions=async()=>{await conversation.getByRole('button',{name:'Conversation details for Fixture Jun',exact:true}).click();await page.getByRole('dialog',{name:'Conversation details',exact:true}).getByRole('button',{name:'Conversation versions',exact:true}).click()};await openVersions();const versions=page.getByRole('dialog',{name:'Conversation versions',exact:true});await versions.locator('select').first().selectOption('fixture-player');await versions.getByRole('button',{name:'Close Conversation versions',exact:true}).click();await conversation.getByRole('button',{name:'View profile for Fixture Jun',exact:true}).first().click();await profile.waitFor();await profile.getByRole('article',{name:'Relationship: Fixture player and Fixture Jun'}).waitFor();assert((await profile.innerText()).includes('MAIN AUTHORIZED MEMORY'));assert(!(await profile.innerText()).includes('ALT AUTHORIZED MEMORY'));await close();
   await page.waitForTimeout(1500);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('region',{name:'Elsewhere world',exact:true}).waitFor();await fromDm();assert((await profile.innerText()).includes('MAIN AUTHORIZED MEMORY'));await close();check('DM uses exact bound persona; switch/reopen/reload preserves independent relationship memories');
  }else{
   await fromFeed();await profile.getByRole('article',{name:'Relationship: Fixture player and Fixture Jun'}).waitFor();let text=await profile.innerText();assert(text.includes('MAIN AUTHORIZED MEMORY'));assert(!text.includes('ALT AUTHORIZED MEMORY')&&!text.includes('UNAUTHORIZED MEMORY')&&!text.includes('PRIVATE STARTING')&&!text.includes('CIRCLE ONLY'));await shot('character-profile-feed');
   await profile.getByRole('combobox',{name:'View',exact:true}).selectOption('public');text=await profile.innerText();assert(!text.includes('MAIN AUTHORIZED MEMORY'));await profile.getByRole('button',{name:'View source: PUBLIC EXPLANATION',exact:true}).click();await profile.waitFor({state:'hidden'});await page.locator('#social-post-fixture-public').waitFor();
   await fromFeed();await close();await fromFeed();await page.keyboard.press('Escape');await profile.waitFor({state:'hidden'});check('Feed character profile is selected-persona scoped; public view excludes private and restricted sources; source closes profile; repeated close/Escape works');
  }
  assert.equal(providerRequests.length,batch==='inflight'?1:0);check('Only the explicitly requested local fixture generation can create a model request');
 }catch(e){failure=e;console.error(e);if(activePage&&!activePage.isClosed())try{fs.writeFileSync(path.join(report,'failure-page.txt'),await activePage.locator('body').innerText());await activePage.screenshot({path:path.join(report,'failure-page.png')})}catch{}}
 finally{if(browser)try{await browser.close()}catch(e){cleanupErrors.push(e.message)};if(resourceMonitor)resourceReport=await resourceMonitor.finish();fs.writeFileSync(path.join(report,'result.json'),JSON.stringify({status:resourceReport?.stopReason?'RESOURCE_STOP':failure||errors.length||unexpected.length||cleanupErrors.length?'FAIL':'PASS',batch,preflight:preflightReport,resource:resourceReport,artifact_tree:options.tree,verified_build_files:manifest.built_files.length,passed,errors,unexpected,failure:failure?.message,captures,fixture_requests:fixtureRequests,fixture_writes:writes,fixture_provider_requests:providerRequests.length,cleanup:{status:cleanupErrors.length?'FAIL':'PASS',errors:cleanupErrors},isolation:'Supported route fulfillment on build origin; disposable save; service workers blocked; no DNS/certificate exceptions or live backend requests',limitations:['Fixture bootstrap uses Node HTML injection; service workers blocked; does not test real TLS/auth','Does not cover real providers, service-worker downloads or physical devices']},null,2));}
 if(failure)process.exitCode=1;
}
runUnified().catch(e=>{console.error(e);process.exitCode=1});
