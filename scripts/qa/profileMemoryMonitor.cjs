const fs = require('node:fs');
function systemSample() {
 const mem=fs.readFileSync('/proc/meminfo','utf8'), vm=fs.readFileSync('/proc/vmstat','utf8'), psi=fs.readFileSync('/proc/pressure/memory','utf8');
 const value=(text,key)=>Number(text.match(new RegExp('^'+key+':?\\s+(\\d+)','m'))?.[1]||0);
 return {availableKiB:value(mem,'MemAvailable'),swapFreeKiB:value(mem,'SwapFree'),swapInPages:value(vm,'pswpin'),swapOutPages:value(vm,'pswpout'),oomKills:value(vm,'oom_kill'),fullPressureAvg10:Number(psi.match(/^full avg10=([\d.]+)/m)?.[1]||0),fullPressureTotalUs:Number(psi.match(/^full .*total=(\d+)/m)?.[1]||0)};
}
function ownTree() {
 const found=new Set();const queue=[process.pid];let rssKiB=0,pssKiB=0,pssUnavailable=0;
 while(queue.length){const pid=queue.pop();if(found.has(pid))continue;found.add(pid);try{queue.push(...fs.readFileSync(`/proc/${pid}/task/${pid}/children`,'utf8').trim().split(/\s+/).filter(Boolean).map(Number));const status=fs.readFileSync(`/proc/${pid}/status`,'utf8');rssKiB+=Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1]||0);try{const rollup=fs.readFileSync(`/proc/${pid}/smaps_rollup`,'utf8');pssKiB+=Number(rollup.match(/^Pss:\s+(\d+)/m)?.[1]||0)}catch{pssUnavailable++}}catch{}}
 return {rssKiB,pssKiB,pssUnavailable,processCount:found.size};
}
async function preflight(startKiB) {
 const samples=[];
 for(let i=0;i<7;i++){samples.push({...systemSample(),...ownTree(),elapsedMs:i*5000});if(i<6)await new Promise(resolve=>setTimeout(resolve,5000));}
 const first=samples[0],second=samples.at(-1);
 const report={first,second,startKiB,samples,stableFullPressureDeltaUs:second.fullPressureTotalUs-first.fullPressureTotalUs};
 // PSI totals measure stalls within this actual 30-second observation. avg10
 // can still reflect earlier startup stalls after current pressure has stopped.
 if(Math.min(...samples.map(s=>s.availableKiB))<startKiB||report.stableFullPressureDeltaUs!==0||second.fullPressureAvg10>=1||second.oomKills!==first.oomKills)throw Error('Resource preflight failed: '+JSON.stringify(report));return report;
}
function monitor(onStop,maxMs=30000) {
 const began=Date.now(),baseline=systemSample(),samples=[];let timer,reason='',below=0,pressure=0,closing;
 function stop(why){if(reason)return;reason=why;closing=Promise.resolve().then(()=>onStop(why)).catch(()=>{});}
 function sample(){const now=Date.now();const s={elapsedMs:now-began,...systemSample(),...ownTree()};samples.push(s);below=s.availableKiB<786432?below+1:0;pressure=s.fullPressureAvg10>=1?pressure+1:0;
  const previous=samples.find(item=>item.elapsedMs>=s.elapsedMs-10000);const swapOutKiB=previous?(s.swapOutPages-previous.swapOutPages)*4:0;
  if(s.availableKiB<655360||below>=2)stop('Available memory reserve crossed');else if(pressure>=2)stop('Full memory pressure crossed');else if(s.pssKiB>688128)stop('Owned PSS exceeded 672 MiB');else if(swapOutKiB>16384)stop('Swap-out exceeded 16 MiB per 10 seconds');else if(s.oomKills>baseline.oomKills)stop('New OOM event');else if(now-began>=maxMs)stop('30-second time cap');}
 sample();timer=setInterval(sample,1000);
 return {async finish(){clearInterval(timer);sample();if(closing)await closing;return {stopReason:reason||null,durationMs:Date.now()-began,minAvailableKiB:Math.min(...samples.map(s=>s.availableKiB)),peakOwnedPssKiB:Math.max(...samples.map(s=>s.pssKiB)),peakOwnedRssKiB:Math.max(...samples.map(s=>s.rssKiB)),baseline,samples}}};
}
module.exports={preflight,monitor};
