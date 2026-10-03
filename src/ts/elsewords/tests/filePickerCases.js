import assert from 'node:assert/strict';
export async function runFilePickerCases(choose) {
 const original = Object.fromEntries(['document','HTMLElement'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis,key)]));
 let inputs = [], focusCount = 0, clickError = false;
 class Element extends EventTarget { isConnected = true; focus() { focusCount++; } }
 class Input extends Element { files = []; style = {}; listeners = new Map(); addEventListener(type, fn, options) { super.addEventListener(type, fn, options); this.listeners.set(type, fn); } removeEventListener(type, fn) { super.removeEventListener(type, fn); this.listeners.delete(type); } remove() { this.isConnected = false; } click() { if (clickError) throw Error('Synthetic dialog failure'); } }
 const previous = new Element(); globalThis.HTMLElement = Element; globalThis.document = { activeElement: previous, createElement() { const input = new Input(); inputs.push(input); return input; }, body: { appendChild() {} } };
 const latest = () => inputs.at(-1), clean = () => { assert.equal(latest().isConnected,false); assert.equal(latest().listeners.size,0); };
 try {
  for (let i=0;i<3;i++) { const pending = choose(['png']); latest().dispatchEvent(new Event('cancel')); assert.equal(await pending,null); clean(); }
  let pending = choose(['png']); latest().dispatchEvent(new Event('change')); assert.equal(await pending,null); clean();
  pending = choose(['png']); latest().files = [{name:'fixture.PNG',size:3,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer}]; latest().dispatchEvent(new Event('change')); assert.deepEqual([...(await pending).data],[1,2,3]); clean();
  const controller = new AbortController(); pending = choose(['png'],controller.signal); controller.abort(); assert.equal(await pending,null); clean();
  const alreadyAborted = new AbortController(); alreadyAborted.abort(); assert.equal(await choose(['png'],alreadyAborted.signal),null); clean();
  pending = choose(['png']); latest().files = [{name:'fixture.txt',size:3}]; latest().dispatchEvent(new Event('change')); await assert.rejects(pending,/supported extensions/); clean();
  pending = choose(['png']); latest().files = [{name:'fixture.png',size:11*1024*1024,arrayBuffer:()=>{throw Error('Must not read oversized file')}}]; latest().dispatchEvent(new Event('change')); await assert.rejects(pending,/10 MiB/); clean();
  clickError = true; await assert.rejects(choose(['png']),/Synthetic dialog/); clean(); clickError = false;
  let finishRead; const delayed = new AbortController(); pending = choose(['png'],delayed.signal); latest().files = [{name:'fixture.png',size:3,arrayBuffer:()=>new Promise(resolve=>{finishRead=resolve})}]; latest().dispatchEvent(new Event('change')); await Promise.resolve(); delayed.abort(); finishRead(new Uint8Array([1]).buffer); assert.equal(await pending,null); clean();
  await new Promise(resolve=>setTimeout(resolve,5)); assert.equal(focusCount,inputs.length,'Focus restored for cancel/change/abort/failure');
 } finally { for(const [key,descriptor] of Object.entries(original)) { if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]; } }
}
