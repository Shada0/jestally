'use strict';

// ═══════════════════════════════════════════════════════════════
//  Jestally v3.1 — Content Script
//  Camera iframe loads from hosted Netlify site → no CSP/eval issues
// ═══════════════════════════════════════════════════════════════

const CAM_URL = 'https://jestally.netlify.app/cam-ext.html';

const LANGUAGES = [
  { code:'en-IN', name:'English', native:'English',  ttsLang:'en-IN', myMemory:'en', quick:true  },
  { code:'hi-IN', name:'Hindi',   native:'हिंदी',    ttsLang:'hi-IN', myMemory:'hi', quick:true  },
  { code:'ta-IN', name:'Tamil',   native:'தமிழ்',    ttsLang:'ta-IN', myMemory:'ta', quick:true  },
  { code:'te-IN', name:'Telugu',  native:'తెలుగు',   ttsLang:'te-IN', myMemory:'te', quick:true  },
  { code:'kn-IN', name:'Kannada', native:'ಕನ್ನಡ',   ttsLang:'kn-IN', myMemory:'kn', quick:false },
  { code:'ml-IN', name:'Malay.',  native:'മലയാളം', ttsLang:'ml-IN', myMemory:'ml', quick:false },
  { code:'mr-IN', name:'Marathi', native:'मराठी',    ttsLang:'mr-IN', myMemory:'mr', quick:false },
  { code:'gu-IN', name:'Gujarati',native:'ગુજરાતી',  ttsLang:'gu-IN', myMemory:'gu', quick:false },
  { code:'bn-IN', name:'Bengali', native:'বাংলা',    ttsLang:'bn-IN', myMemory:'bn', quick:false },
  { code:'pa-IN', name:'Punjabi', native:'ਪੰਜਾਬੀ',  ttsLang:'pa-IN', myMemory:'pa', quick:false },
];

const ISL_ALIAS = {
  'hello':'hello','hi':'hello','hey':'hello','bye':'bye','goodbye':'bye',
  'thanks':'thank you','thank':'thank you','ty':'thank you',
  'yes':'good','okay':'good','ok':'good','no':'not','nope':'not',
  'sorry':'sad','help me':'help','please help':'help',
  'what':'what','where':'where','when':'when','why':'why','who':'who','how':'how',
  'maa':'mother','amma':'mother','baap':'father','pita':'father',
  'bhai':'brother','behen':'sister',
};

const DROP = new Set(['a','an','the','is','are','was','were','am','be','been','do','does','did','will','would','could','should','very','really','just','please','of','in','at','to','for','with','by','from','on','about']);
const WH   = new Set(['who','what','where','when','why','how','which']);
const TIME = new Set(['yesterday','tomorrow','today','now','later','morning','evening','night','always','never']);
const NEG  = new Set(['not','never','no','nobody','nothing']);

const RV_VOICES = {
  'hi':'Hindi Female','ta':'Tamil Female','te':'Telugu Female',
  'kn':'Kannada Female','ml':'Malayalam Female','bn':'Bengali Female',
  'mr':'Marathi Female','gu':'Gujarati Female','pa':'Punjabi Female',
  'ur':'Urdu Female','ne':'Nepali Female','en':'UK English Female',
};

function applyISLGrammar(text) {
  const tokens = text.toLowerCase().replace(/[?!.,;:'"]/g,' ').trim().split(/\s+/).filter(Boolean);
  const t=[],w=[],n=[],m=[];
  for (const tok of tokens) {
    if (DROP.has(tok)) continue;
    if (TIME.has(tok)) t.push(tok);
    else if (WH.has(tok)) w.push(tok);
    else if (NEG.has(tok)) n.push('not');
    else m.push(tok);
  }
  return [...t,...m,...n,...w].filter((x,i,a)=>x!==a[i-1]).join(' ');
}

function normalizeForISL(text) {
  const lower = text.trim().toLowerCase();
  if (ISL_ALIAS[lower]) return ISL_ALIAS[lower];
  return lower.split(/\s+/).map(w=>ISL_ALIAS[w]||w).join(' ');
}

const CFG = { endpoint:'', recognizeEp:'', apiKey:'', active:false };
let activeLang  = { input:LANGUAGES[0], output:LANGUAGES[0] };
let activeTab   = 'out';
let recognition = null, micActive=false, debTimer=null;
let gifQueue=[], gifIdx=0, gifLooping=false, gifTimer=null;
let lastText='', lastSign='', isSpeaking=false;
let signActive=false, isClassifying=false, lastPredTime=0;
let camIframe=null;
const PRED_INTERVAL=2000, SEQ_FRAMES=30, CONF_THRESH=0.55;
const gifCache=new Map(), translCache=new Map();

// ── Boot ─────────────────────────────────────────────────────
async function boot() {
  const s = await chrome.storage.sync.get(['apiEndpoint','recognizeEp','apiKey','active']);
  CFG.endpoint    = s.apiEndpoint || 'https://ahwchrh9z0.execute-api.ap-south-1.amazonaws.com/prod/resolve';
  CFG.recognizeEp = s.recognizeEp || 'https://6n5ur96sk6.execute-api.ap-south-1.amazonaws.com/prod/recognize';
  CFG.apiKey      = s.apiKey      || '3t2XrVzJQP4E9x7S3ksWW5PIconSSPH782gu39XS';
  CFG.active      = s.active      || false;
  injectPanel();
  setStage('listen');
  applyState();
  chrome.runtime.onMessage.addListener(m=>{ if(m.type==='TOGGLE'){CFG.active=m.active;applyState();} });
  window.addEventListener('message', onIframeMsg);
}

// ── Panel HTML ───────────────────────────────────────────────
function injectPanel() {
  if (document.getElementById('jly-panel')) return;
  const ql    = LANGUAGES.filter(l=>l.quick);
  const chips = id => ql.map(l=>`<button class="jly-lchip${l.code==='en-IN'?' jly-lchip-active':''}" data-code="${l.code}" data-panel="${id}">${l.name}</button>`).join('');
  const more  = LANGUAGES.map(l=>`<option value="${l.code}">${l.name} — ${l.native}</option>`).join('');

  const el = document.createElement('div');
  el.id='jly-panel'; el.className='jly-size-m';
  el.innerHTML = `
<div class="jly-hd" id="jly-hd">
  <div class="jly-logo"><img src="https://jestally.netlify.app/logo.png" style="width:24px;height:24px;object-fit:contain;border-radius:6px;" alt="Jestally"/><span class="jly-name">Jestally</span></div>
  <div class="jly-hd-right">
    <div class="jly-sizes">
      <button class="jly-sz" data-sz="s">S</button>
      <button class="jly-sz jly-sz-active" data-sz="m">M</button>
      <button class="jly-sz" data-sz="l">L</button>
    </div>
    <button class="jly-btn jly-sw" id="jly-sw" role="switch" aria-checked="false"></button>
    <button class="jly-btn" id="jly-min">−</button>
  </div>
</div>
<div id="jly-body" class="jly-body">
  <div class="jly-tabs">
    <button class="jly-tab jly-tab-active" data-tab="out">🔊 ISL Out</button>
    <button class="jly-tab" data-tab="in">👁 ISL In</button>
  </div>
  <div class="jly-tab-content" id="jly-pane-out">
    <div class="jly-lang-bar">
      <span class="jly-lang-label">Input lang</span>
      <div class="jly-lchips" id="jly-in-chips">${chips('input')}</div>
      <select class="jly-lang-more" id="jly-in-more"><option value="">More…</option>${more}</select>
    </div>
    <div class="jly-stage" id="jly-stage">
      <div class="jly-wave" id="jly-st-listen" style="display:flex">
        <div class="jly-bars"><span class="jly-bar"></span><span class="jly-bar"></span><span class="jly-bar"></span><span class="jly-bar"></span><span class="jly-bar"></span></div>
        <p class="jly-wave-lbl" id="jly-wave-lbl">Ready</p>
      </div>
      <div class="jly-shimmer-wrap" id="jly-st-load" style="display:none"><div class="jly-shimmer"></div><p class="jly-shimmer-lbl">Translating…</p></div>
      <video class="jly-gif" id="jly-gif" autoplay muted playsinline style="display:none"></video>
      <img id="jly-gif-img" style="display:none;width:100%;max-height:200px;object-fit:contain;border-radius:8px" alt="ISL sign" />
      <div class="jly-err" id="jly-st-err" style="display:none">
        <p class="jly-err-lbl" id="jly-err-msg">Could not connect</p>
        <button class="jly-retry" id="jly-retry">Retry</button>
      </div>
    </div>
    <div class="jly-isl-preview" id="jly-isl-preview" style="display:none">
      <span class="jly-isl-preview-label">ISL</span>
      <span class="jly-isl-preview-text" id="jly-isl-text"></span>
    </div>
    <div class="jly-transcript"><span class="jly-tx-text" id="jly-tx"></span></div>
    <div class="jly-text-input-row">
      <button class="jly-mic-btn" id="jly-mic-btn" title="Speak">🎤</button>
      <input class="jly-text-input" id="jly-text-input" type="text" placeholder="Type or speak…" autocomplete="off" />
      <button class="jly-send-btn" id="jly-send-btn">▶</button>
    </div>
    <div class="jly-prog"><div class="jly-dots" id="jly-dots"></div><span class="jly-counter" id="jly-ctr"></span></div>
  </div>
  <div class="jly-tab-content jly-hidden" id="jly-pane-in">
    <div class="jly-lang-bar">
      <span class="jly-lang-label">Speak in</span>
      <div class="jly-lchips" id="jly-out-chips">${chips('output')}</div>
      <select class="jly-lang-more" id="jly-out-more"><option value="">More…</option>${more}</select>
    </div>
    <div class="jly-cam-wrap" id="jly-cam-wrap">
      <div class="jly-cam-overlay" id="jly-cam-overlay"><span>Camera off</span></div>
    </div>
    <div class="jly-sign-result">
      <span class="jly-sign-label" id="jly-sign-label">—</span>
      <span class="jly-sign-conf" id="jly-sign-conf"></span>
    </div>
    <div class="jly-speech-out" id="jly-speech-out">No sign detected yet…</div>
    <div class="jly-in-controls">
      <button class="jly-ctrl-btn" id="jly-cam-toggle">📷 Start Camera</button>
      <button class="jly-ctrl-btn" id="jly-speak-btn">🔊 Speak Again</button>
    </div>
  </div>
</div>
<div class="jly-resize-handle" id="jly-resize"></div>`;

  document.body.appendChild(el);
  makeDraggable(el);
  makeResizable(el);
  bindEvents(el);
}

function bindEvents(p) {
  p.querySelector('#jly-sw').addEventListener('click', toggle);
  p.querySelector('#jly-min').addEventListener('click', minimise);
  p.querySelector('#jly-retry').addEventListener('click', ()=>{ if(lastText) resolveISL(lastText); });
  p.querySelectorAll('.jly-tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
  p.querySelectorAll('.jly-sz').forEach(b=>b.addEventListener('click',()=>setSize(b.dataset.sz)));
  const inp = p.querySelector('#jly-text-input');
  p.querySelector('#jly-send-btn').addEventListener('click',()=>sendText(inp.value));
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter') sendText(inp.value); });
  p.querySelector('#jly-mic-btn').addEventListener('click', toggleMic);
  p.querySelector('#jly-cam-toggle').addEventListener('click', toggleCamera);
  p.querySelector('#jly-speak-btn').addEventListener('click',()=>{ if(lastSign) speakSign(lastSign); });
  p.querySelectorAll('#jly-in-chips .jly-lchip').forEach(b=>b.addEventListener('click',()=>{
    const l=LANGUAGES.find(x=>x.code===b.dataset.code); if(l) setLang('input',l,p);
  }));
  p.querySelectorAll('#jly-out-chips .jly-lchip').forEach(b=>b.addEventListener('click',()=>{
    const l=LANGUAGES.find(x=>x.code===b.dataset.code); if(l) setLang('output',l,p);
  }));
  p.querySelector('#jly-in-more').addEventListener('change',e=>{
    const l=LANGUAGES.find(x=>x.code===e.target.value); if(l){setLang('input',l,p);e.target.value='';}
  });
  p.querySelector('#jly-out-more').addEventListener('change',e=>{
    const l=LANGUAGES.find(x=>x.code===e.target.value); if(l){setLang('output',l,p);e.target.value='';}
  });
}

// ── iframe messages from cam-ext.html ────────────────────────
function onIframeMsg(e) {
  const msg = e.data; if(!msg?.type) return;
  if (msg.type==='CAM_READY') {
    const ov=document.getElementById('jly-cam-overlay');
    if(ov) ov.style.display='none';
    document.getElementById('jly-speech-out').textContent='Show your hand…';
  }
  if (msg.type==='CAM_ERROR') {
    document.getElementById('jly-speech-out').textContent='Cam error: '+msg.error;
    document.getElementById('jly-cam-toggle').textContent='📷 Start Camera';
    signActive=false;
  }
  if (msg.type==='FRAME_DATA' && msg.ready && !isClassifying) {
    const now=Date.now();
    if(now-lastPredTime>PRED_INTERVAL){ lastPredTime=now; callRecognizeAPI(msg.buffer); }
  }
}

// ── Camera — loads iframe from Netlify hosted page ───────────
function toggleCamera() {
  const btn  = document.getElementById('jly-cam-toggle');
  const ov   = document.getElementById('jly-cam-overlay');
  const wrap = document.getElementById('jly-cam-wrap');

  if (signActive) {
    signActive=false; isClassifying=false;
    if(camIframe) { camIframe.contentWindow?.postMessage({type:'STOP_CAM'},'*'); camIframe.remove(); camIframe=null; }
    ov.style.display='flex';
    btn.textContent='📷 Start Camera';
    document.getElementById('jly-speech-out').textContent='No sign detected yet…';
    return;
  }

  signActive=true;
  btn.textContent='■ Stop Camera';
  document.getElementById('jly-speech-out').textContent='Loading camera…';

  const iframe = document.createElement('iframe');
  iframe.src   = CAM_URL;            // ← hosted on Netlify, not chrome-extension://
  iframe.allow = 'camera; microphone';
  iframe.style.cssText = 'width:100%;height:200px;border:none;border-radius:8px;display:block;background:#0f0d1a;';
  wrap.insertBefore(iframe, ov);
  ov.style.display='none';
  camIframe=iframe;
}

// ── Recognize API ────────────────────────────────────────────
async function callRecognizeAPI(buffer) {
  if(isClassifying) return;
  isClassifying=true;
  const seq=buffer.slice(-SEQ_FRAMES);
  while(seq.length<SEQ_FRAMES) seq.unshift(new Array(63).fill(0));
  try {
    const r=await Promise.race([
      fetch(CFG.recognizeEp,{method:'POST',headers:{'Content-Type':'application/json','x-api-key':CFG.apiKey},body:JSON.stringify({sequence:seq})}),
      new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),8000))
    ]);
    if(!r.ok) return;
    const d=await r.json();
    if(!d.success||!d.sign) return;
    const sign=d.sign.replace(/_/g,' ');
    if((d.confidence||0)<CONF_THRESH) return;
    lastSign=sign;
    document.getElementById('jly-sign-label').textContent=sign.toUpperCase();
    document.getElementById('jly-sign-conf').textContent=Math.round((d.confidence||0)*100)+'%';
    document.getElementById('jly-speech-out').textContent=sign;
    speakSign(sign);
  } catch(e){ console.warn('[Jestally]',e.message); }
  finally{ isClassifying=false; }
}

// ── TTS — ResponsiveVoice injected into page ─────────────────
function ensureRV(cb) {
  if (typeof responsiveVoice !== 'undefined') { cb(); return; }
  // Inject RV script into the page (content scripts can do this)
  const s=document.createElement('script');
  s.src='https://code.responsivevoice.org/responsivevoice.js?key=FREE';
  s.onload=cb; s.onerror=cb;
  document.head.appendChild(s);
}

async function speakSign(text) {
  if(isSpeaking) return;
  isSpeaking=true;
  const lang    = activeLang.output;
  const cleaned = text.replace(/_/g,' ').trim().toLowerCase();
  let spoken    = cleaned;
  if(lang.myMemory!=='en') spoken = await translateText(cleaned,lang)||cleaned;

  ensureRV(()=>{
    if (typeof responsiveVoice!=='undefined' && responsiveVoice.voiceSupport()) {
      const voice=RV_VOICES[lang.myMemory]||'UK English Female';
      responsiveVoice.speak(spoken, voice, {
        rate:0.9,
        onend:   ()=>{ isSpeaking=false; },
        onerror: ()=>{ isSpeaking=false; webSpeechFallback(spoken,lang); },
      });
    } else {
      webSpeechFallback(spoken,lang);
    }
  });
}

function webSpeechFallback(text,lang) {
  const utt=new SpeechSynthesisUtterance(text);
  utt.lang=lang.ttsLang; utt.rate=0.9;
  const v=window.speechSynthesis.getVoices().find(v=>v.lang.startsWith(lang.ttsLang.split('-')[0]));
  if(v) utt.voice=v;
  utt.onend=utt.onerror=()=>{ isSpeaking=false; };
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utt);
}

// ── Translation ──────────────────────────────────────────────
async function translateText(text,toLang) {
  if(toLang.myMemory==='en') return text;
  const key=`${text}__${toLang.myMemory}`;
  if(translCache.has(key)) return translCache.get(key);
  for(let i=0;i<2;i++){
    try{
      const res=await Promise.race([
        fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0,100))}&langpair=en|${toLang.myMemory}`),
        new Promise((_,r)=>setTimeout(()=>r(new Error),4000))
      ]);
      const d=await res.json();
      const t=d?.responseData?.translatedText||'';
      const bad=!t||/MYMEMORY|PLEASE SELECT|KINDLY|INVALID|DAILY|QUOTA/i.test(t)||t.length>text.length*3||(toLang.myMemory!=='en'&&/^[a-zA-Z\s.,!?]+$/.test(t)&&t.split(' ').length>2)||d?.responseStatus!==200;
      if(!bad){translCache.set(key,t);return t;}
    }catch(e){if(i===0) await new Promise(r=>setTimeout(r,800));}
  }
  return text;
}

async function translateToEnglish(text,fromLang) {
  if(fromLang.myMemory==='en') return text;
  const key=`${text}__${fromLang.myMemory}__en`;
  if(translCache.has(key)) return translCache.get(key);
  try{
    const res=await Promise.race([
      fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0,300))}&langpair=${fromLang.myMemory}|en`),
      new Promise((_,r)=>setTimeout(()=>r(new Error),5000))
    ]);
    const d=await res.json();
    const t=d?.responseData?.translatedText||'';
    if(t&&d?.responseStatus===200&&!/MYMEMORY|PLEASE SELECT|KINDLY|INVALID/i.test(t)){translCache.set(key,t);return t;}
  }catch(e){}
  return text;
}

// ── ISL Out pipeline ─────────────────────────────────────────
async function resolveISL(rawText) {
  if(!rawText?.trim()) return;
  lastText=rawText;
  const cacheKey=rawText.toLowerCase().trim()+'__'+activeLang.input.code;
  if(gifCache.has(cacheKey)){renderGifs(gifCache.get(cacheKey));return;}
  setStage('load');
  try{
    let english=rawText;
    if(activeLang.input.myMemory!=='en'){
      document.getElementById('jly-tx').textContent='Translating…';
      english=await translateToEnglish(rawText,activeLang.input);
    }
    const normalized=normalizeForISL(applyISLGrammar(english));
    const prev=document.getElementById('jly-isl-preview'),pt=document.getElementById('jly-isl-text');
    if(prev&&pt&&normalized!==rawText.toLowerCase().trim()){prev.style.display='flex';pt.textContent=normalized.toUpperCase();}
    document.getElementById('jly-tx').textContent=rawText.slice(-80);
    if(!CFG.endpoint){setStage('listen');document.getElementById('jly-wave-lbl').textContent='API not configured';return;}
    const res=await Promise.race([
      fetch(CFG.endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-api-key':CFG.apiKey},body:JSON.stringify({text:normalized,language:'ISL'})}),
      new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),10000))
    ]);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    if(!data?.success||!data.gifs?.length){await resolveWordByWord(normalized);return;}
    const valid=data.gifs.filter(g=>g.url);
    if(!valid.length){await resolveWordByWord(normalized);return;}
    if(gifCache.size>=100) gifCache.delete(gifCache.keys().next().value);
    gifCache.set(cacheKey,valid);
    renderGifs(valid);
  }catch(err){showErr(err.message==='timeout'?'Request timed out':`Error: ${err.message}`);}
}

async function resolveWordByWord(text) {
  const words=text.split(/\s+/).filter(Boolean);
  if(!words.length){setStage('listen');return;}
  const results=[];
  for(const w of words){
    try{
      const res=await Promise.race([
        fetch(CFG.endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-api-key':CFG.apiKey},body:JSON.stringify({text:w,language:'ISL'})}),
        new Promise((_,r)=>setTimeout(()=>r(new Error),5000))
      ]);
      if(!res.ok) continue;
      const d=await res.json();
      if(d?.success&&d.gifs?.length) results.push(...d.gifs.filter(g=>g.url));
    }catch(e){continue;}
  }
  if(results.length) renderGifs(results);
  else{setStage('listen');const p=document.getElementById('jly-isl-preview');if(p)p.style.display='none';}
}

// ── GIF / video player ───────────────────────────────────────
function isGif(url){return url?.toLowerCase().split('?')[0].endsWith('.gif');}
function renderGifs(g){stopLoop();gifQueue=g;gifIdx=0;gifLooping=true;renderDots(g.length);playNext();}
function stopLoop(){
  gifLooping=false;clearTimeout(gifTimer);gifTimer=null;
  const v=document.getElementById('jly-gif'),i=document.getElementById('jly-gif-img');
  if(v){v.onended=null;try{v.pause();}catch(e){}}
  if(i){i.style.display='none';i.src='';}
}
function playNext(){
  if(!gifLooping) return;
  if(gifIdx>=gifQueue.length) gifIdx=0;
  const g=gifQueue[gifIdx]; updateDots(gifIdx);
  const ctr=document.getElementById('jly-ctr'); if(ctr) ctr.textContent=`${gifIdx+1} / ${gifQueue.length}`;
  gifIdx++;
  if(isGif(g.url)){
    const v=document.getElementById('jly-gif'),i=document.getElementById('jly-gif-img');
    if(v) v.style.display='none'; setStage('listen');
    if(i){i.style.display='block';i.src=g.url;}
    gifTimer=setTimeout(()=>{if(!gifLooping)return;if(i)i.style.display='none';playNext();},gifQueue.length===1?2500:2000);
  } else {
    const i=document.getElementById('jly-gif-img'),v=document.getElementById('jly-gif');
    if(i) i.style.display='none'; if(!v) return; setStage('gif');
    v.onended=null;v.onerror=null;v.onloadedmetadata=null;
    v.src=g.url;v.load();v.play().catch(()=>{gifTimer=setTimeout(()=>{if(gifLooping)playNext();},2000);});
    v.onended=()=>{v.onended=null;if(gifLooping)gifTimer=setTimeout(playNext,200);};
    v.onloadedmetadata=()=>{if(!v.duration||!isFinite(v.duration))gifTimer=setTimeout(()=>{v.onended=null;if(gifLooping)playNext();},2000);};
    v.onerror=()=>{if(gifLooping)gifTimer=setTimeout(playNext,500);};
  }
}

function setStage(s){
  ['jly-st-listen','jly-st-load','jly-gif','jly-st-err'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  const map={listen:'jly-st-listen',load:'jly-st-load',gif:'jly-gif',error:'jly-st-err'};
  const show=document.getElementById(map[s]);
  if(show) show.style.display=s==='gif'?'block':'flex';
  if(s==='listen'||s==='error'){stopLoop();const p=document.getElementById('jly-isl-preview');if(p&&s==='listen')p.style.display='none';}
}
function showErr(msg){stopLoop();const el=document.getElementById('jly-err-msg');if(el)el.textContent=msg;setStage('error');setTimeout(()=>{if(document.getElementById('jly-st-err')?.style.display!=='none')setStage('listen');},4000);}
function renderDots(n){const el=document.getElementById('jly-dots');if(!el)return;el.innerHTML=Array.from({length:Math.min(n,20)},(_,i)=>`<span class="jly-dot" data-i="${i}"></span>`).join('');}
function updateDots(a){document.querySelectorAll('#jly-dots .jly-dot').forEach((d,i)=>{d.className='jly-dot'+(i<a?' jly-dot-done':i===a?' jly-dot-active':'');});}

// ── Mic ──────────────────────────────────────────────────────
function toggleMic(){micActive?stopMic():startMic();}
function startMic(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){const lbl=document.getElementById('jly-wave-lbl');if(lbl)lbl.textContent='Use text input below';return;}
  if(recognition){try{recognition.stop();}catch(e){}recognition=null;}
  recognition=new SR();recognition.continuous=false;recognition.interimResults=true;recognition.lang=activeLang.input.code;
  recognition.onstart=()=>{micActive=true;const b=document.getElementById('jly-mic-btn');if(b){b.classList.add('jly-mic-active');b.textContent='🔴';}const l=document.getElementById('jly-wave-lbl');if(l)l.textContent='Listening…';setStage('listen');};
  recognition.onresult=e=>{
    let fin='',int='';
    for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;e.results[i].isFinal?(fin+=t):(int+=t);}
    const d=(fin||int).slice(0,400);
    const tx=document.getElementById('jly-tx');if(tx)tx.textContent=d.slice(-80);
    const inp=document.getElementById('jly-text-input');if(inp&&d)inp.value=d;
    if(fin){clearTimeout(debTimer);debTimer=setTimeout(()=>resolveISL(fin),750);}
  };
  recognition.onerror=e=>{
    const lbl=document.getElementById('jly-wave-lbl');
    if(e.error==='not-allowed'||e.error==='service-not-allowed'){if(lbl)lbl.textContent='Mic blocked — use text input';}
    else if(e.error!=='no-speech'&&e.error!=='aborted'){showErr(`Mic: ${e.error}`);}
    stopMic();
  };
  recognition.onend=()=>stopMic();
  try{recognition.start();}catch(e){const lbl=document.getElementById('jly-wave-lbl');if(lbl)lbl.textContent='Use text input below';stopMic();}
}
function stopMic(){
  micActive=false;if(recognition){try{recognition.stop();}catch(e){}recognition=null;}
  const b=document.getElementById('jly-mic-btn');if(b){b.classList.remove('jly-mic-active');b.textContent='🎤';}
  const l=document.getElementById('jly-wave-lbl');if(l)l.textContent='Ready';
}

// ── UI helpers ───────────────────────────────────────────────
function sendText(t){const v=t?.trim();if(!v)return;const tx=document.getElementById('jly-tx');if(tx)tx.textContent=v;resolveISL(v);const inp=document.getElementById('jly-text-input');if(inp)inp.value='';}
function toggle(){CFG.active=!CFG.active;chrome.storage.sync.set({active:CFG.active});applyState();}
function minimise(){const b=document.getElementById('jly-body'),btn=document.getElementById('jly-min'),h=b.classList.toggle('jly-hidden');btn.textContent=h?'+':'−';}
function applyState(){const p=document.getElementById('jly-panel'),s=document.getElementById('jly-sw');if(!p)return;p.classList.toggle('jly-on',CFG.active);s.classList.toggle('jly-on',CFG.active);s.setAttribute('aria-checked',String(CFG.active));}
function setLang(id,lang,panel){activeLang[id]=lang;const k=id==='input'?'in':'out';panel.querySelector(`#jly-${k}-chips`)?.querySelectorAll('.jly-lchip').forEach(c=>c.classList.toggle('jly-lchip-active',c.dataset.code===lang.code));}
function switchTab(tab){activeTab=tab;document.querySelectorAll('.jly-tab').forEach(b=>b.classList.toggle('jly-tab-active',b.dataset.tab===tab));document.getElementById('jly-pane-out').classList.toggle('jly-hidden',tab!=='out');document.getElementById('jly-pane-in').classList.toggle('jly-hidden',tab!=='in');}
function setSize(sz){const p=document.getElementById('jly-panel');p.className=p.className.replace(/jly-size-\w/g,'').trim();p.classList.add(`jly-size-${sz}`);document.querySelectorAll('.jly-sz').forEach(b=>b.classList.toggle('jly-sz-active',b.dataset.sz===sz));}

function makeDraggable(panel){
  const hd=panel.querySelector('.jly-hd');let drag=false,sx,sy,ol,ot;hd.style.cursor='grab';
  hd.addEventListener('mousedown',e=>{if(e.target.closest('button,.jly-sizes'))return;drag=true;sx=e.clientX;sy=e.clientY;const r=panel.getBoundingClientRect();ol=r.left;ot=r.top;hd.style.cursor='grabbing';e.preventDefault();});
  document.addEventListener('mousemove',e=>{if(!drag)return;panel.style.left=Math.max(0,ol+e.clientX-sx)+'px';panel.style.top=Math.max(0,ot+e.clientY-sy)+'px';panel.style.right='auto';panel.style.bottom='auto';});
  document.addEventListener('mouseup',()=>{drag=false;hd.style.cursor='grab';});
}
function makeResizable(panel){
  const h=panel.querySelector('#jly-resize');let r=false,sx,sy,sw,sh;
  h.addEventListener('mousedown',e=>{r=true;sx=e.clientX;sy=e.clientY;const rc=panel.getBoundingClientRect();sw=rc.width;sh=rc.height;e.preventDefault();e.stopPropagation();});
  document.addEventListener('mousemove',e=>{if(!r)return;panel.style.width=Math.max(280,sw+e.clientX-sx)+'px';panel.style.height=Math.max(200,sh+e.clientY-sy)+'px';});
  document.addEventListener('mouseup',()=>{r=false;});
}

boot();
