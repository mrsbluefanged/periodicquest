/* ============================================================
   PERIODIC QUEST — app logic
   Modules: state · audio · confetti · rewards · tables · games
   ============================================================ */
'use strict';

/* ---------- tiny helpers ---------- */
const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const rand = n => Math.floor(Math.random()*n);
const shuffle = a => { a=[...a]; for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; };
const sample = (a,n) => shuffle(a).slice(0,n);
const byNum = {}; PQ_DATA.ELEMENTS.forEach(e => byNum[e.n]=e);
const bySym = {}; PQ_DATA.ELEMENTS.forEach(e => bySym[e.sym]=e);
const COMP_BY_KEY = {}; PQ_DATA.COMPOUNDS.forEach(c => COMP_BY_KEY[c.key]=c);

const CAT_LABEL = {
  alkali:'Alkali metal 🔥', alkaline:'Alkaline earth metal ✨', transition:'Transition metal 🔧',
  'post-transition':'Soft metal 🥄', metalloid:'Metalloid (half & half) 🌗', nonmetal:'Nonmetal 🌱',
  halogen:'Halogen (salt maker) 🧂', noble:'Noble gas 👑', lanthanide:'Rare-earth metal 💫', actinide:'Radioactive metal ⚛️'
};
const CAT_KIDTEXT = {
  alkali:"I'm a soft metal that goes WILD in water!", alkaline:"I'm a metal that loves making sparks and flames!",
  transition:"I'm a tough metal used to build and make things!", 'post-transition':"I'm a soft metal that melts easily!",
  metalloid:"I'm half metal, half not — the best of both worlds!", nonmetal:"I'm a building block of life and air!",
  halogen:"I'm super reactive and love making salts!", noble:"I'm a calm gas that almost never reacts. A loner!",
  lanthanide:"I'm a rare-earth metal hiding inside gadgets!", actinide:"I'm radioactive — scientists handle me carefully!"
};
const STATE_KID = { gas:"I'm a gas — you can't hold me!", liquid:"I'm a liquid at room temperature — very rare!", solid:"I'm a solid you could hold (some of me carefully!)" };
const COMMON = [1,2,3,6,7,8,9,10,11,12,13,14,15,16,17,19,20,26,28,29,30,47,50,79,80,82];
const FAMOUS = [...Array.from({length:54},(_,i)=>i+1), 74,78,79,80,82,88,92];

/* ---------- persistent state ---------- */
const DEFAULTS = {
  big:false,
  name:'', avatar:'🦊', mode:'beginner', sound:true,
  stars:0, coins:0, xp:0, ledger:[], hinted:[],
  discovered:[],            // compound keys
  badges:[],
  encySeen:[],
  stats:{ correct:0, wrong:0, games:{}, recent:[], oxy:0, placedBest:0, builtAll:false, speedBest:0 },
  daily:{ date:'', type:'', progress:0, done:false }
};
let S;
function loadState(){
  try { S = Object.assign({}, structuredClone(DEFAULTS), JSON.parse(localStorage.getItem('pq-save')||'{}')); }
  catch(e){ S = structuredClone(DEFAULTS); }
  S.stats = Object.assign({}, structuredClone(DEFAULTS.stats), S.stats||{});
  S.daily = Object.assign({}, structuredClone(DEFAULTS.daily), S.daily||{});
  if(!Array.isArray(S.ledger)) S.ledger=[];
  if(!Array.isArray(S.hinted)) S.hinted=[];
  if(S.stars>0){ const c=S.stars*2; S.coins+=c; logCoins(c,'Stars converted to coins'); S.stars=0; }
}
function save(){ localStorage.setItem('pq-save', JSON.stringify(S)); }

/* ---------- levels ---------- */
const LEVELS = [
  {xp:0,    name:'Level 1 · Names',        unlock:'You can learn element names!'},
  {xp:50,   name:'Level 2 · Symbols',      unlock:'Symbols unlocked! H, He, Li…'},
  {xp:120,  name:'Level 3 · Atomic Numbers',unlock:'Atomic numbers unlocked!'},
  {xp:220,  name:'Level 4 · Groups',       unlock:'Groups (columns) unlocked!'},
  {xp:350,  name:'Level 5 · Periods',      unlock:'Periods (rows) unlocked!'},
  {xp:520,  name:'Level 6 · States',       unlock:'Solid, liquid & gas unlocked!'},
  {xp:750,  name:'Level 7 · Properties',   unlock:'Element properties unlocked!'},
  {xp:1000, name:'Level 8 · Compounds',    unlock:'Compound master! You know it all!'}
];
function levelIndex(){ let li=0; LEVELS.forEach((l,i)=>{ if(S.xp>=l.xp) li=i; }); return li; }

/* ---------- audio (WebAudio synth, no assets) ---------- */
let AC=null;
function ac(){ if(!AC) AC = new (window.AudioContext||window.webkitAudioContext)(); return AC; }
function tone(freq, dur=0.12, type='sine', when=0, vol=0.18){
  if(!S.sound) return;
  try{
    const ctx=ac(), o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(vol, ctx.currentTime+when);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+when+dur);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime+when); o.stop(ctx.currentTime+when+dur+0.02);
  }catch(e){}
}
const sfx = {
  pop:   () => tone(520,0.08,'triangle'),
  pick:  () => { tone(440,0.07,'triangle'); tone(660,0.07,'triangle',0.06); },
  good:  () => { [523,659,784,1047].forEach((f,i)=>tone(f,0.12,'triangle',i*0.07)); },
  bad:   () => { tone(220,0.18,'sawtooth',0,0.1); tone(180,0.2,'sawtooth',0.12,0.1); },
  coin:  () => { tone(988,0.07,'square',0,0.08); tone(1319,0.14,'square',0.07,0.08); },
  fanfare:() => { [392,523,659,784,1047,1319].forEach((f,i)=>tone(f,0.16,'triangle',i*0.09)); },
  tick:  () => tone(880,0.04,'square',0,0.05),
  whoosh:() => { for(let i=0;i<8;i++) tone(300+i*90,0.05,'sine',i*0.02,0.06); }
};

/* ---------- confetti ---------- */
const confettiCanvas = $('#confetti');
const cctx = confettiCanvas.getContext('2d');
let confs = [];
function resizeConfetti(){ confettiCanvas.width=innerWidth; confettiCanvas.height=innerHeight; }
addEventListener('resize', resizeConfetti); resizeConfetti();
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
function confetti(n=80){
  if(REDUCED) return;
  const colors=['#FF5D8F','#FFC53D','#2FC98C','#4D7CFE','#8C52F5','#FF8A5C'];
  for(let i=0;i<n;i++) confs.push({
    x:innerWidth/2+(Math.random()-0.5)*200, y:innerHeight*0.35,
    vx:(Math.random()-0.5)*12, vy:-Math.random()*11-3,
    s:5+Math.random()*7, c:colors[rand(colors.length)], r:Math.random()*Math.PI, vr:(Math.random()-0.5)*0.3, life:110
  });
  if(confs.length===n) confettiLoop();
}
function confettiLoop(){
  cctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
  confs.forEach(p=>{
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.32; p.r+=p.vr; p.life--;
    cctx.save(); cctx.translate(p.x,p.y); cctx.rotate(p.r);
    cctx.fillStyle=p.c; cctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.6); cctx.restore();
  });
  confs = confs.filter(p=>p.life>0 && p.y<innerHeight+40);
  if(confs.length) requestAnimationFrame(confettiLoop);
  else cctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
}

/* ---------- toast ---------- */
let toastTimer=null;
function toast(msg, ms=2200){
  const t=$('#toast'); t.textContent=msg; t.hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.hidden=true, ms);
}

/* ---------- rewards ---------- */
function logCoins(delta, why){
  if(!delta || !why) return;
  S.ledger.unshift({t:Date.now(), d:delta, why});
  if(S.ledger.length>40) S.ledger.length=40;
}
function spend(cost, why){
  if(S.coins < cost){ sfx.bad(); toast(`🪙 Not enough coins — you need ${cost-S.coins} more!`); return false; }
  S.coins -= cost;
  logCoins(-cost, why);
  refreshHud(); save(); sfx.coin();
  return true;
}
function award({stars=0, coins=0, xp=0, quiet=false, why=''}={}){
  const before=levelIndex();
  coins += stars*2;               // legacy: any star amounts become coins
  S.coins+=coins; S.xp+=xp;
  logCoins(coins, why);
  const after=levelIndex();
  refreshHud(); save();
  if(!quiet && coins) sfx.coin();
  if(after>before){
    sfx.fanfare(); confetti(120);
    toast(`🎉 Level up! ${LEVELS[after].name.split('·')[1].trim()} unlocked!`, 3200);
  }
  checkBadges();
}
function trackCorrect(el){
  S.stats.correct++;
  if(el){
    S.stats.recent.unshift(el.name);
    S.stats.recent = [...new Set(S.stats.recent)].slice(0,12);
    if(el.n===8) S.stats.oxy++;
  }
  bumpDaily('correct');
  save();
}
function trackWrong(){ S.stats.wrong++; save(); }
function trackGame(g){ S.stats.games[g]=(S.stats.games[g]||0)+1; save(); }

/* ---------- badges ---------- */
const BADGES = [
  {id:'first_compound', e:'🧫', n:'First Compound',    d:'Discover your first compound',      t:()=>S.discovered.length>=1},
  {id:'ten_compounds',  e:'⚗️', n:'Junior Chemist',    d:'Discover 10 compounds',             t:()=>S.discovered.length>=10},
  {id:'collector',      e:'🃏', n:'Super Collector',   d:'Discover 30 compounds',             t:()=>S.discovered.length>=30},
  {id:'first_ten',      e:'🧩', n:'First 10 Elements', d:'Place the first 10 elements',       t:()=>S.stats.placedBest>=10},
  {id:'builder',        e:'🏗️', n:'Table Master',      d:'Build the entire periodic table',   t:()=>S.stats.builtAll},
  {id:'oxygen_master',  e:'💨', n:'Master of Oxygen',  d:'Get Oxygen right 5 times',          t:()=>S.stats.oxy>=5},
  {id:'explorer',       e:'🗺️', n:'Periodic Explorer', d:'Read about 20 elements',            t:()=>S.encySeen.length>=20},
  {id:'hundred',        e:'✅', n:'100 Club',          d:'100 correct answers',               t:()=>S.stats.correct>=100},
  {id:'perfect',        e:'🌟', n:'Perfect Round',     d:'Get a streak of 5',                 t:()=>S.stats.perfect},
  {id:'speedster',      e:'⚡', n:'Speedster',         d:'Score 15+ in a Speed Round',        t:()=>S.stats.speedBest>=15},
  {id:'daily',          e:'🌞', n:'Daily Hero',        d:'Complete a daily challenge',        t:()=>S.stats.dailyDone},
  {id:'level5',         e:'🎓', n:'Halfway Genius',    d:'Reach Level 5',                     t:()=>levelIndex()>=4},
];
function checkBadges(){
  BADGES.forEach(b=>{
    if(!S.badges.includes(b.id) && b.t()){
      S.badges.push(b.id); save();
      sfx.fanfare(); confetti(90);
      toast(`🏆 Badge earned: ${b.e} ${b.n}!`, 3000);
    }
  });
}

/* ---------- daily challenge ---------- */
const DAILY_TYPES = [
  {id:'compounds', n:2, text:'Discover 2 new compounds in Mix Lab'},
  {id:'correct',   n:6, text:'Get 6 answers right in any game'},
  {id:'placed',    n:8, text:'Place 8 elements in Build the Table'},
];
function initDaily(){
  const today = new Date().toISOString().slice(0,10);
  if(S.daily.date!==today){
    const seed = [...today].reduce((a,c)=>a+c.charCodeAt(0),0);
    S.daily = { date:today, type:DAILY_TYPES[seed%DAILY_TYPES.length].id, progress:0, done:false };
    save();
  }
  renderDaily();
}
function bumpDaily(kind){
  if(S.daily.done || S.daily.type!==kind) return;
  const def = DAILY_TYPES.find(d=>d.id===kind);
  S.daily.progress++;
  if(S.daily.progress>=def.n){
    S.daily.done=true; S.stats.dailyDone=true;
    award({coins:25, why:'Daily challenge'}); confetti(100); sfx.fanfare();
    toast('📅 Daily challenge complete! +25 🪙', 3000);
  }
  save(); renderDaily();
}
function renderDaily(){
  const def = DAILY_TYPES.find(d=>d.id===S.daily.type) || DAILY_TYPES[0];
  $('#dailyText').textContent = def.text;
  $('#dailyFill').style.width = Math.min(100, S.daily.progress/def.n*100)+'%';
  $('#dailyReward').textContent = S.daily.done ? '✅ Done!' : '+25 🪙';
}

/* ---------- HUD ---------- */
function refreshHud(){
  $('#statCoins').textContent=S.coins;
  const li=levelIndex();
  $('#statLevel').textContent=li+1;
  $('#avatarEmoji').textContent=S.avatar;
  $('#btnSound').textContent = S.sound?'🔊':'🔇';
  $('#btnSound').setAttribute('aria-pressed', S.sound);
  // home cards
  $('#pcCollection').textContent = `${S.discovered.length} / ${PQ_DATA.COMPOUNDS.length}`;
  $('#pcXp').textContent = `${S.xp} XP · ${LEVELS[li].name}`;
  const next = LEVELS[li+1];
  const pct = next ? Math.min(100,(S.xp-LEVELS[li].xp)/(next.xp-LEVELS[li].xp)*100) : 100;
  $('#xpFill').style.width = pct+'%';
  $('#pcUnlock').textContent = next ? `Next: ${next.name} at ${next.xp} XP` : '👑 Max level reached!';
  $$('.mode-btn').forEach(b=>b.setAttribute('aria-checked', b.dataset.mode===S.mode));
  $('#greeting').textContent = S.name ? `Ready to explore, ${S.name}?` : 'Ready to explore, scientist?';
}

/* ---------- element search (dims non-matching tiles) ---------- */
function attachSearch(input, getTiles, statusEl){
  const run = ()=>{
    const q = input.value.trim().toLowerCase();
    let hits = 0;
    getTiles().forEach(t=>{
      const el = byNum[t.dataset.n];
      if(!el || t.classList.contains('empty-slot')){ t.classList.remove('search-miss'); return; }
      const hit = !q
        || el.name.toLowerCase().includes(q)
        || el.sym.toLowerCase().startsWith(q)
        || String(el.n) === q;
      t.classList.toggle('search-miss', !hit);
      if(hit) hits++;
    });
    if(statusEl) statusEl.textContent = q ? `${hits} element${hits===1?'':'s'} match "${input.value.trim()}"` : '';
  };
  input.addEventListener('input', run);
  return run;
}

/* ---------- navigation (with hardware/browser back support) ---------- */
let CUR_SCREEN='home', IGNORE_POP=false;
function go(id, push=true){
  $$('.screen').forEach(s=>s.classList.remove('active'));
  $('#screen-'+id).classList.add('active');
  sfx.whoosh();
  window.scrollTo({top:0, behavior: REDUCED?'auto':'smooth'});
  if(id==='home') refreshHud();
  if(id==='mixlab') MixLab.enter();
  if(id==='guess') Guess.enter();
  if(id==='build') Build.enter();
  if(id==='detective') Detective.enter();
  if(id==='atomic') Atomic.enter();
  if(id==='multi') Multi.enter();
  if(id==='encyclopedia') Ency.enter();
  if(id==='collection') Coll.enter();
  if(id==='badges') renderBadges();
  CUR_SCREEN = id;
  if(push) history.pushState({s:id}, '');
}
window.addEventListener('popstate', e=>{
  if(IGNORE_POP){ IGNORE_POP=false; return; }
  const st = e.state || {s:'home'};
  if(!$('#modalVeil').hidden){        // back closes an open modal first
    closeModal(true);
    if(st.m) return;
  }
  if(st.m) return;
  if(st.s && st.s !== CUR_SCREEN) go(st.s, false);
});
document.addEventListener('click', e=>{
  const b = e.target.closest('[data-go]');
  if(b){ go(b.dataset.go); }
});

/* ---------- modal ---------- */
function openModal(html){
  if($('#modalVeil').hidden) history.pushState({s:CUR_SCREEN, m:true}, '');
  $('#modalContent').innerHTML = html;
  $('#modalVeil').hidden = false;
  $('#modalClose').focus();
}
function closeModal(fromPop=false){
  const veil=$('#modalVeil');
  if(veil.hidden) return;
  veil.hidden = true;
  if(!fromPop && history.state && history.state.m){ IGNORE_POP=true; history.back(); }
}
$('#modalClose').addEventListener('click', closeModal);
$('#modalVeil').addEventListener('click', e=>{ if(e.target.id==='modalVeil') closeModal(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

/* ---------- periodic table renderer ---------- */
/*  opts: { shelf:false, empty:false, onTap(el|pos), dimFn(el)=>bool, showNames:auto } */
function renderTable(container, opts={}){
  container.innerHTML='';
  container.classList.toggle('shelf', !!opts.shelf);
  const els = opts.shelf ? COMMON.map(n=>byNum[n]) : PQ_DATA.ELEMENTS;
  if(opts.shelf){
    els.forEach(el=>container.appendChild(makeTile(el, opts)));
    return;
  }
  els.forEach(el=>{
    const t = makeTile(el, opts);
    t.style.gridColumn = el.col;
    t.style.gridRow = el.row;
    container.appendChild(t);
  });
}
function makeTile(el, opts){
  const t=document.createElement('button');
  t.type='button';
  t.className='ptile cat-'+el.cat;
  t.dataset.n=el.n;
  t.setAttribute('aria-label', `${el.name}, number ${el.n}`);
  if(opts.empty){
    t.classList.add('empty-slot');
    t.innerHTML='';
    t.setAttribute('aria-label', `Empty spot, column ${el.col}, row ${el.row}`);
    t.className='ptile empty-slot';
  } else {
    t.innerHTML=`<span class="tn">${el.n}</span><span class="ts">${el.sym}</span><span class="tname">${el.name}</span>`;
  }
  if(opts.dimFn && opts.dimFn(el)) t.classList.add('dim');
  if(opts.onTap) t.addEventListener('click', ()=>opts.onTap(el, t));
  return t;
}

/* ---------- element info modal ---------- */
function elementModal(el){
  if(!S.encySeen.includes(el.n)){ S.encySeen.push(el.n); save(); checkBadges(); }
  openModal(`
    <div class="comp-card">
      <div class="ele-head">
        <div class="ele-tile-big cat-${el.cat}"><span class="s">${el.sym}</span><span class="n">#${el.n}</span></div>
        <div style="text-align:left">
          <h3 class="comp-name" style="font-size:1.6rem">${el.emoji} ${el.name}</h3>
          <span style="color:var(--ink-soft)">${CAT_LABEL[el.cat]}</span>
        </div>
      </div>
      <div class="comp-fact">💡 ${el.fact}</div>
      <ul class="ele-facts">
        <li><span>Atomic number</span><b>${el.n}</b></li>
        <li><span>Atomic mass</span><b>${el.mass}</b></li>
        <li><span>Group (column)</span><b>${el.group}</b></li>
        <li><span>Period (row)</span><b>${el.period}</b></li>
        <li><span>At room temp</span><b>${el.state==='gas'?'💨 Gas':el.state==='liquid'?'💧 Liquid':'🧊 Solid'}</b></li>
        <li><span>Where it's found</span><b>${el.found}</b></li>
        <li><span>Used for</span><b>${el.uses}</b></li>
      </ul>
    </div>`);
  sfx.pop();
}

/* ============================================================
   GAME 1 — MIX LAB
   ============================================================ */
const MixLab = (() => {
  const MAX = 4;
  let picks=[], shelf=true, searchRun=null;
  function enter(){
    shelf = (S.mode==='beginner');
    picks=[]; renderSlots(); renderGrid();
    $('#mixShelfToggle').textContent = shelf ? 'Full table' : 'Easy shelf';
    $('#mixShelfToggle').setAttribute('aria-pressed', String(!shelf));
    $('#mixHint').textContent='Tap 2 to 4 elements, then hit MIX!';
    trackGame('mixlab');
  }
  function renderGrid(){
    renderTable($('#mixTable'), { shelf, onTap: pick });
    syncSelected();
    if(searchRun) searchRun();
  }
  function renderSlots(){
    const wrap=$('#beakerSlots'); wrap.innerHTML='';
    const plus=()=>{ const p=document.createElement('span'); p.className='beaker-plus'; p.setAttribute('aria-hidden','true'); p.textContent='＋'; wrap.appendChild(p); };
    picks.forEach((p,i)=>{
      if(i>0) plus();
      const s=document.createElement('button');
      s.type='button';
      s.className='beaker-slot filled cat-'+p.cat;
      s.textContent=p.sym;
      s.setAttribute('aria-label', p.name+' in the beaker — tap to remove');
      s.addEventListener('click', ()=>{ sfx.pop(); picks.splice(i,1); renderSlots(); syncSelected(); });
      wrap.appendChild(s);
    });
    if(picks.length<MAX){
      if(picks.length) plus();
      const e=document.createElement('div');
      e.className='beaker-slot'; e.textContent='?';
      e.setAttribute('aria-label','Empty beaker slot');
      wrap.appendChild(e);
    }
    $('#btnMix').disabled = picks.length<2;
  }
  function syncSelected(){
    $$('#mixTable .ptile').forEach(t=>{
      t.classList.toggle('selected', picks.some(p=>p.n==t.dataset.n));
    });
  }
  function pick(el){
    if(picks.length>=MAX){ sfx.bad(); toast('🧪 Beaker is full! Tap an element in the beaker to remove it.'); return; }
    sfx.pick();
    picks.push(el);
    renderSlots(); syncSelected();
  }
  function whyNotMulti(list){
    const metals=['alkali','alkaline','transition','post-transition','lanthanide','actinide'];
    const noble=list.find(e=>e.cat==='noble');
    if(noble) return `👑 ${noble.name} is a noble gas — the loner of the table! Noble gases have a full set of electrons, so they almost never hold hands with other elements.`;
    if(list.every(e=>metals.includes(e.cat)))
      return `🔧 Metals alone don't make a compound — but they CAN melt together into an alloy, like bronze (copper + tin) or steel!`;
    if(list.length>2)
      return `🔬 ${list.map(e=>e.name).join(' + ')} isn't a famous team. Big compounds are picky about their members — try swapping one out, or start from a pair that works and add oxygen or hydrogen!`;
    return `🔬 ${list[0].name} and ${list[1].name} don't usually team up in everyday life. Scientists might force them together in a lab, but it's not a famous combo. Try another mix!`;
  }
  function mix(){
    if(picks.length<2) return;
    const syms = picks.map(p=>p.sym);
    const uniq = [...new Set(syms)].sort();
    const key = (uniq.length===1) ? uniq[0]+'-'+uniq[0] : uniq.join('-');
    const c = COMP_BY_KEY[key];
    sfx.whoosh();
    setTimeout(()=>{
      if(c){
        const isNew=!S.discovered.includes(key);
        if(isNew){
          S.discovered.push(key); save();
          award({coins:10, xp:8, why:'Discovered '+c.name});
          bumpDaily('compounds');
          confetti(100); sfx.good();
        } else { sfx.pop(); }
        trackCorrect(picks[0]);
        openModal(`
          <div class="comp-card">
            ${isNew?'<span class="new-ribbon">✨ NEW DISCOVERY! ✨</span>':''}
            <div class="comp-emoji">${c.emoji}</div>
            <h3 class="comp-name">${c.name}</h3>
            <div class="comp-formula">${uniq.join(' + ')} → ${c.formula}</div>
            <div class="comp-fact">💡 Fun fact: ${c.fact}</div>
            <b>Used for:</b>
            <ul class="comp-uses">${c.uses.map(u=>`<li>${u}</li>`).join('')}</ul>
            ${isNew?'<p>+10 🪙 · +8 XP</p>':'<p>Already in your collection! 🃏</p>'}
          </div>`);
        checkBadges();
      } else {
        sfx.bad();
        const uniqEls = uniq.map(s=>bySym[s]);
        openModal(`
          <div class="comp-card">
            <div class="comp-emoji">🤔</div>
            <h3 class="comp-name">Hmm, no reaction!</h3>
            <div class="comp-formula">${uniq.join(' + ')}</div>
            <div class="comp-fact">${whyNotMulti(uniqEls)}</div>
            <p>Keep experimenting — real scientists learn from every try! 🧑‍🔬</p>
          </div>`);
      }
      picks=[]; renderSlots(); syncSelected();
    }, 250);
  }
  $('#btnMix').addEventListener('click', mix);
  $('#mixShelfToggle').addEventListener('click', ()=>{ shelf=!shelf; picks=[]; renderSlots(); enterKeepShelf(); });
  function enterKeepShelf(){
    $('#mixShelfToggle').textContent = shelf ? 'Full table' : 'Easy shelf';
    $('#mixShelfToggle').setAttribute('aria-pressed', String(!shelf));
    renderGrid();
  }
  searchRun = attachSearch($('#mixSearch'), ()=>$$('#mixTable .ptile'), $('#mixSearchStatus'));
  return { enter };
})();

/* ============================================================
   GAME 2 — GUESS THE ELEMENT
   ============================================================ */
const Guess = (() => {
  let target=null, clues=[], clueIdx=0, wrongs=new Set(), diff='easy';
  const POOLS = {
    easy: COMMON,
    medium: FAMOUS,
    hard: PQ_DATA.ELEMENTS.map(e=>e.n)
  };
  function makeClues(el){
    const list=[
      {t:STATE_KID[el.state], f:c=>c.state===el.state},
      {t:CAT_KIDTEXT[el.cat], f:c=>c.cat===el.cat},
      {t:`💡 Hint: I'm used for… ${el.uses.split(',')[0].toLowerCase()}!`, f:null},
      {t:`You'll find me in row (period) ${el.period} of the table.`, f:c=>c.period===el.period},
      {t:`My symbol starts with "${el.sym[0]}".`, f:c=>c.sym[0]===el.sym[0]},
      {t:`My atomic number is between ${Math.max(1,el.n-5)} and ${el.n+5}.`, f:c=>Math.abs(c.n-el.n)<=5},
      {t:`My atomic number is exactly ${el.n}!`, f:c=>c.n===el.n},
    ];
    if(diff==='hard') return [list[1],list[3],list[4],list[5],list[6]]; // scientific only
    return list;
  }
  function enter(){
    setDiff(diff); trackGame('guess');
  }
  function setDiff(d){
    diff=d;
    $$('#guessDiff button').forEach(b=>b.setAttribute('aria-checked', b.dataset.d===d));
    newRound();
  }
  function newRound(){
    const pool=POOLS[diff].map(n=>byNum[n]);
    target=pool[rand(pool.length)];
    clues=makeClues(target); clueIdx=0; wrongs=new Set();
    showClue();
    renderTable($('#guessTable'), { onTap: guess, dimFn: dimFn });
    $('#guessStatus').textContent='Tap the element you think it is!';
  }
  function dimFn(el){
    if(wrongs.has(el.n)) return true;
    if(S.mode==='beginner'){
      for(let i=0;i<=clueIdx && i<clues.length;i++){
        const c=clues[i];
        if(c.f && !c.f(el)) return true;
      }
    }
    return false;
  }
  function showClue(){
    $('#guessClueCount').textContent=`Clue ${clueIdx+1} of ${clues.length}`;
    $('#guessClue').textContent=clues[clueIdx].t;
  }
  function guess(el, tile){
    if(el.n===target.n){
      sfx.good(); confetti(90);
      const coins=Math.max(2, (5-clueIdx)*3);
      award({coins, xp:5+coins, why:'Guessed '+target.name});
      trackCorrect(el);
      openModal(`
        <div class="comp-card">
          <div class="comp-emoji">${el.emoji}</div>
          <h3 class="comp-name">It's ${el.name}!</h3>
          <div class="comp-formula">${el.sym} · #${el.n}</div>
          <div class="comp-fact">💡 ${el.fact}</div>
          <p>+${coins} 🪙 for solving it in ${clueIdx+1} clue${clueIdx?'s':''}!</p>
          <button class="pill-btn brick" id="guessAgain">🔁 Play again</button>
        </div>`);
      $('#guessAgain').addEventListener('click', ()=>{ closeModal(); newRound(); });
    } else {
      sfx.bad(); trackWrong();
      wrongs.add(el.n);
      tile.classList.add('wrong');
      setTimeout(()=>tile.classList.add('dim'), 300);
      if(clueIdx<clues.length-1){ clueIdx++; showClue(); $('#guessStatus').textContent=`Not ${el.name}! Here's another clue…`; }
      else $('#guessStatus').textContent=`Not ${el.name}! You've got all the clues — keep trying!`;
      if(S.mode==='beginner') renderTable($('#guessTable'), { onTap: guess, dimFn });
    }
  }
  $('#guessDiff').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(b) setDiff(b.dataset.d);
  });
  return { enter };
})();

/* ============================================================
   GAME 3 — BUILD THE TABLE
   ============================================================ */
const Build = (() => {
  let queue=[], current=null, placedCount=0, wrongsInRow=0, diff='10', timer=null, timeLeft=0;
  function enter(){ setDiff(diff); trackGame('build'); }
  function setDiff(d){
    diff=d;
    $$('#buildDiff button').forEach(b=>b.setAttribute('aria-checked', b.dataset.d===d));
    start();
  }
  function start(){
    clearInterval(timer);
    const n = diff==='10'?10 : diff==='20'?20 : diff==='timed'?36 : 118;
    queue = shuffle(PQ_DATA.ELEMENTS.slice(0,n));
    placedCount=0; wrongsInRow=0;
    $('#buildScore').textContent='0 placed';
    $('#buildTimer').hidden = diff!=='timed';
    if(diff==='timed'){ timeLeft=90; $('#buildTimer').textContent=timeLeft+'s';
      timer=setInterval(()=>{
        timeLeft--; $('#buildTimer').textContent=timeLeft+'s';
        if(timeLeft<=10) sfx.tick();
        if(timeLeft<=0) finish(true);
      },1000);
    }
    renderTable($('#buildTable'), { empty:true, onTap: place });
    next();
  }
  function next(){
    current = queue.shift();
    if(!current){ finish(false); return; }
    $('#buildSym').textContent=current.sym;
    $('#buildName').textContent=current.name;
    $('#buildNum').textContent='#'+current.n;
    $('#buildStatus').textContent='Where does it belong? Tap the spot!';
    wrongsInRow=0;
  }
  function place(el, tile){
    if(!current) return;
    if(el.n===current.n){
      sfx.good();
      tile.className='ptile placed cat-'+current.cat;
      tile.innerHTML=`<span class="tn">${current.n}</span><span class="ts">${current.sym}</span><span class="tname">${current.name}</span>`;
      tile.setAttribute('aria-label', `${current.name} placed`);
      tile.disabled=true;
      placedCount++;
      $('#buildScore').textContent=placedCount+' placed';
      award({coins:1, xp:2, quiet:true});
      trackCorrect(current);
      bumpDaily('placed');
      if(placedCount>S.stats.placedBest){ S.stats.placedBest=placedCount; save(); checkBadges(); }
      next();
    } else {
      sfx.bad(); trackWrong(); wrongsInRow++;
      tile.classList.add('wrong');
      setTimeout(()=>tile.classList.remove('wrong'), 400);
      $('#buildStatus').textContent = wrongsInRow>=2
        ? `Almost! ${current.name} is #${current.n} — need a hint? 💡`
        : `Not quite! ${current.name} goes somewhere ${el.n<current.n?'further along':'earlier'}.`;
    }
  }
  function hint(){
    if(!current) return;
    const tile=$(`#buildTable .ptile[data-n="${current.n}"]`);
    if(tile){ tile.classList.add('hint-glow'); setTimeout(()=>tile.classList.remove('hint-glow'), 1600); sfx.pop(); }
  }
  function finish(timed){
    clearInterval(timer);
    if(!timed && diff==='118'){ S.stats.builtAll=true; save(); }
    checkBadges();
    sfx.fanfare(); confetti(130);
    const coins = placedCount + Math.round(placedCount/3);
    award({coins, xp:placedCount*2, why:'Build the Table'});
    openModal(`
      <div class="comp-card">
        <div class="comp-emoji">🏗️</div>
        <h3 class="comp-name">${timed?"Time's up!":"Table complete!"}</h3>
        <div class="comp-fact">You placed <b>${placedCount}</b> element${placedCount===1?'':'s'}! +${coins} 🪙</div>
        <button class="pill-btn brick" id="buildAgain">🔁 Build again</button>
      </div>`);
    $('#buildAgain').addEventListener('click', ()=>{ closeModal(); start(); });
    current=null;
  }
  $('#buildDiff').addEventListener('click', e=>{ const b=e.target.closest('button'); if(b) setDiff(b.dataset.d); });
  $('#buildHint').addEventListener('click', hint);
  return { enter };
})();

/* ============================================================
   GAME 4 — PROPERTY DETECTIVE
   ============================================================ */
const Detective = (() => {
  let target=null, streak=0, diff='easy', extraUsed=false;
  const POOLS={ easy:COMMON, medium:FAMOUS, hard:PQ_DATA.ELEMENTS.map(e=>e.n) };
  function clueSet(el){
    const easy=[
      STATE_KID[el.state],
      CAT_KIDTEXT[el.cat],
      `I'm used for ${el.uses.split(',')[0].toLowerCase()}.`
    ];
    const hard=[
      `I live in group ${el.group}, period ${el.period}.`,
      `My atomic mass is about ${Math.round(el.mass)}.`,
      `I'm found in: ${el.found.toLowerCase()}.`
    ];
    if(diff==='easy') return easy;
    if(diff==='medium') return [easy[0], hard[0], easy[2]];
    return hard;
  }
  function enter(){ setDiff(diff); trackGame('detective'); }
  function setDiff(d){
    diff=d;
    $$('#detDiff button').forEach(b=>b.setAttribute('aria-checked', b.dataset.d===d));
    streak=0; updateScore(); newRound();
  }
  function newRound(){
    extraUsed=false;
    const pool=POOLS[diff].map(n=>byNum[n]);
    target=pool[rand(pool.length)];
    $('#detClues').innerHTML=clueSet(target).map(c=>`<p>${c}</p>`).join('');
    $('#detMore').disabled=false;
    const distractors=sample(pool.filter(e=>e.n!==target.n),3);
    const choices=shuffle([target,...distractors]);
    const grid=$('#detChoices'); grid.innerHTML='';
    choices.forEach(c=>{
      const b=document.createElement('button');
      b.className='choice-btn'; b.textContent=`${c.emoji} ${c.name}`;
      b.addEventListener('click',()=>answer(c,b));
      grid.appendChild(b);
    });
  }
  function answer(c,btn){
    if(c.n===target.n){
      btn.classList.add('correct'); sfx.good(); confetti(60);
      streak++;
      if(streak>=5 && !S.stats.perfect){ S.stats.perfect=true; save(); }
      const coins=extraUsed?4:6;
      award({coins, xp:6, why:'Detective case solved'});
      trackCorrect(c); updateScore(); checkBadges();
      setTimeout(newRound, 900);
    } else {
      btn.classList.add('wrong'); btn.disabled=true;
      sfx.bad(); trackWrong(); streak=0; updateScore();
    }
  }
  function moreClue(){
    extraUsed=true; $('#detMore').disabled=true; sfx.pop();
    const p=document.createElement('p');
    p.textContent=`My atomic number is ${target.n}.`;
    $('#detClues').appendChild(p);
  }
  function updateScore(){ $('#detScore').textContent=`Streak: ${streak} ${streak>=3?'🔥':'⭐'}`; }
  $('#detDiff').addEventListener('click', e=>{ const b=e.target.closest('button'); if(b) setDiff(b.dataset.d); });
  $('#detMore').addEventListener('click', moreClue);
  return { enter };
})();

/* ============================================================
   GAME 5 — ATOMIC NUMBER CHALLENGE
   ============================================================ */
const Atomic = (() => {
  let mode='A', score=0, timer=null, timeLeft=0, answered=false;
  const POOL = FAMOUS.map(n=>byNum[n]);
  function enter(){ showModes(); trackGame('atomic'); }
  function showModes(){
    clearInterval(timer);
    $('#atomicModes').hidden=false; $('#atomicPlay').hidden=true;
  }
  function startMode(m){
    mode=m; score=0; answered=false;
    $('#atomicModes').hidden=true; $('#atomicPlay').hidden=false;
    $('#atomicScore').textContent='0 ✔';
    $('#memoryGrid').hidden = m!=='D';
    $('#atomicPrompt').hidden = m==='D';
    $('#atomicChoices').hidden = m==='D';
    $('#atomicTimer').hidden = m!=='E';
    clearInterval(timer);
    if(m==='E'){
      timeLeft=60; $('#atomicTimer').textContent='60s';
      timer=setInterval(()=>{
        timeLeft--; $('#atomicTimer').textContent=timeLeft+'s';
        if(timeLeft<=10) sfx.tick();
        if(timeLeft<=0) endSpeed();
      },1000);
    }
    if(m==='D') memoryStart(); else question();
  }
  function question(){
    answered=false;
    const el=POOL[rand(POOL.length)];
    const qm = mode==='E' ? ['A','C'][rand(2)] : mode;
    const prompt=$('#atomicPrompt'), grid=$('#atomicChoices');
    grid.innerHTML='';
    let choices, label;
    if(qm==='A'){
      prompt.innerHTML=`${el.n}<small>Which element has this atomic number?</small>`;
      choices=shuffle([el,...sample(POOL.filter(e=>e.n!==el.n),3)]);
      label=c=>c.name;
    } else if(qm==='B'){
      prompt.innerHTML=`${el.emoji} ${el.name} (${el.sym})<small>What's my atomic number?</small>`;
      choices=shuffle([el,...sample(POOL.filter(e=>Math.abs(e.n-el.n)<12 && e.n!==el.n),3)]);
      while(choices.length<4) choices.push(POOL[rand(POOL.length)]);
      choices=shuffle([...new Set(choices)]).slice(0,4);
      if(!choices.includes(el)) choices[0]=el, choices=shuffle(choices);
      label=c=>'#'+c.n;
    } else {
      prompt.innerHTML=`${el.sym}<small>Which element is this?</small>`;
      choices=shuffle([el,...sample(POOL.filter(e=>e.n!==el.n && (e.name[0]===el.name[0]||rand(2))),3)]);
      label=c=>c.name;
    }
    choices.forEach(c=>{
      const b=document.createElement('button');
      b.className='choice-btn'; b.textContent=label(c);
      b.addEventListener('click',()=>{
        if(answered) return;
        if(c.n===el.n){
          answered=true; b.classList.add('correct'); sfx.good();
          score++; $('#atomicScore').textContent=score+' ✔';
          award({coins:1, xp:3, quiet:true}); trackCorrect(el);
          setTimeout(question, mode==='E'?350:700);
        } else {
          b.classList.add('wrong'); b.disabled=true; sfx.bad(); trackWrong();
        }
      });
      grid.appendChild(b);
    });
  }
  function endSpeed(){
    clearInterval(timer);
    if(score>S.stats.speedBest){ S.stats.speedBest=score; save(); }
    checkBadges(); sfx.fanfare(); confetti(110);
    const coins=score + Math.floor(score/2);
    award({coins, why:'Speed Round'});
    openModal(`
      <div class="comp-card">
        <div class="comp-emoji">⏱️</div>
        <h3 class="comp-name">Speed Round over!</h3>
        <div class="comp-fact">You answered <b>${score}</b> correctly! +${coins} 🪙</div>
        <button class="pill-btn brick" id="speedAgain">🔁 Again!</button>
      </div>`);
    $('#speedAgain').addEventListener('click', ()=>{ closeModal(); startMode('E'); });
  }
  /* memory match */
  let memFirst=null, memLock=false, memPairs=0;
  function memoryStart(){
    memFirst=null; memLock=false; memPairs=0;
    const els=sample(POOL.filter(e=>e.n<=54),6);
    const cards=shuffle(els.flatMap(e=>[{e,face:e.sym},{e,face:e.name}]));
    const grid=$('#memoryGrid'); grid.innerHTML='';
    cards.forEach(c=>{
      const b=document.createElement('button');
      b.className='mem-card'; b.textContent=c.face; b.dataset.n=c.e.n;
      b.setAttribute('aria-label','Hidden card');
      b.addEventListener('click',()=>flip(b,c));
      grid.appendChild(b);
    });
  }
  function flip(b,c){
    if(memLock||b.classList.contains('flipped')) return;
    b.classList.add('flipped'); b.setAttribute('aria-label', c.face); sfx.pick();
    if(!memFirst){ memFirst=b; return; }
    memLock=true;
    if(memFirst.dataset.n===b.dataset.n && memFirst!==b){
      setTimeout(()=>{
        memFirst.classList.add('matched'); b.classList.add('matched');
        sfx.good(); memPairs++; score++; $('#atomicScore').textContent=score+' ✔';
        award({coins:2, xp:4, quiet:true}); trackCorrect(c.e);
        memFirst=null; memLock=false;
        if(memPairs===6){
          confetti(120); sfx.fanfare(); award({coins:6, why:'Memory match'});
          openModal(`<div class="comp-card"><div class="comp-emoji">🃏</div>
            <h3 class="comp-name">All pairs found!</h3>
            <div class="comp-fact">Amazing memory! +6 🪙</div>
            <button class="pill-btn brick" id="memAgain">🔁 New board</button></div>`);
          $('#memAgain').addEventListener('click',()=>{ closeModal(); memoryStart(); });
        }
      },450);
    } else {
      sfx.bad();
      setTimeout(()=>{
        memFirst.classList.remove('flipped'); b.classList.remove('flipped');
        memFirst.setAttribute('aria-label','Hidden card'); b.setAttribute('aria-label','Hidden card');
        memFirst=null; memLock=false;
      },800);
    }
  }
  $('#atomicModes').addEventListener('click', e=>{ const b=e.target.closest('[data-am]'); if(b) startMode(b.dataset.am); });
  $('#atomicBack').addEventListener('click', showModes);
  return { enter };
})();

/* ============================================================
   MULTIPLAYER — pass & play
   ============================================================ */
const Multi = (() => {
  const AVATARS=['🦊','🐸','🐼','🦄','🐙','🦖','🐧','🚀'];
  let P=[{name:'Player 1',av:'🦊',score:0},{name:'Player 2',av:'🐸',score:0}];
  let mode=null, turn=0, round=0, totalRounds=10, raceFound=[];
  function enter(){
    $('#multiSetup').hidden=false; $('#multiPlay').hidden=true;
    $$('.avatar-row').forEach(row=>{
      if(row.children.length) return;
      const p=+row.dataset.p-1;
      AVATARS.forEach(a=>{
        const b=document.createElement('button');
        b.type='button'; b.textContent=a;
        b.setAttribute('aria-label','Avatar '+a);
        b.setAttribute('aria-pressed', String(P[p].av===a));
        b.addEventListener('click',()=>{
          P[p].av=a; sfx.pick();
          $$('button',row).forEach(x=>x.setAttribute('aria-pressed', String(x===b)));
        });
        row.appendChild(b);
      });
    });
    trackGame('multi');
  }
  function begin(m){
    mode=m; turn=0; round=0; raceFound=[];
    P[0].name=$('#p1name').value||'Player 1'; P[1].name=$('#p2name').value||'Player 2';
    P[0].score=0; P[1].score=0;
    totalRounds = m==='duel'||m==='quiz' ? 10 : m==='mixrace' ? 24 : 2;
    $('#multiSetup').hidden=true; $('#multiPlay').hidden=false;
    syncBar(); passScreen();
  }
  function syncBar(){
    [0,1].forEach(i=>{
      const v=$('#vsP'+(i+1));
      $('.vs-av',v).textContent=P[i].av;
      $('.vs-name',v).textContent=P[i].name;
      $('.vs-score',v).textContent=P[i].score;
      v.classList.toggle('turn', turn===i);
    });
  }
  function passScreen(){
    const st=$('#multiStage');
    st.innerHTML=`<div class="pass-veil">
      <div class="big">${P[turn].av}</div>
      <h3>Pass to ${P[turn].name}!</h3>
      <p class="hint-text">${roundLabel()}</p>
      <button class="pill-btn brick" id="multiReady">I'm ready! 👍</button>
    </div>`;
    $('#multiReady').addEventListener('click', playTurn);
  }
  function roundLabel(){
    if(mode==='speedbuild') return 'You get 60 seconds to place as many elements as you can!';
    if(mode==='mixrace') return 'Pick two elements that make a real compound. First to 4 discoveries wins!';
    return `Question ${Math.floor(round/2)+1} of ${totalRounds/2}`;
  }
  function playTurn(){
    if(mode==='duel') duelQ();
    else if(mode==='quiz') quizQ();
    else if(mode==='speedbuild') speedTurn();
    else if(mode==='mixrace') raceTurn();
  }
  function nextTurn(){
    round++;
    if((mode==='duel'||mode==='quiz') && round>=totalRounds) return endGame();
    if(mode==='mixrace' && (P[0].score>=4||P[1].score>=4||round>=totalRounds)) return endGame();
    if(mode==='speedbuild' && round>=2) return endGame();
    turn=1-turn; syncBar(); passScreen();
  }
  /* duel: detective-style */
  function duelQ(){
    const pool=FAMOUS.map(n=>byNum[n]);
    const t=pool[rand(pool.length)];
    const clues=[STATE_KID[t.state], CAT_KIDTEXT[t.cat], `I'm used for ${t.uses.split(',')[0].toLowerCase()}.`];
    const choices=shuffle([t,...sample(pool.filter(e=>e.n!==t.n),3)]);
    mcq(clues.map(c=>`🔍 ${c}`).join('<br>'), choices, c=>c.emoji+' '+c.name, c=>c.n===t.n);
  }
  /* quiz: atomic-style */
  function quizQ(){
    const pool=FAMOUS.map(n=>byNum[n]);
    const t=pool[rand(pool.length)];
    const kind=rand(2);
    const choices=shuffle([t,...sample(pool.filter(e=>e.n!==t.n),3)]);
    if(kind===0) mcq(`<b style="font-size:2rem">${t.n}</b><br>Which element has this atomic number?`, choices, c=>c.name, c=>c.n===t.n);
    else mcq(`<b style="font-size:2rem">${t.sym}</b><br>Which element is this?`, choices, c=>c.name, c=>c.n===t.n);
  }
  function mcq(promptHtml, choices, labelFn, isCorrect){
    const st=$('#multiStage');
    st.innerHTML=`<div class="clue-box brick" style="text-align:center">${promptHtml}</div><div class="choice-grid" id="mcqGrid"></div>`;
    let done=false;
    choices.forEach(c=>{
      const b=document.createElement('button');
      b.className='choice-btn'; b.textContent=labelFn(c);
      b.addEventListener('click',()=>{
        if(done) return; done=true;
        if(isCorrect(c)){ b.classList.add('correct'); sfx.good(); P[turn].score++; confetti(50); }
        else { b.classList.add('wrong'); sfx.bad(); }
        syncBar();
        setTimeout(nextTurn, 1000);
      });
      $('#mcqGrid').appendChild(b);
    });
  }
  /* speed build turn */
  function speedTurn(){
    const st=$('#multiStage');
    st.innerHTML=`<p class="hint-text"><b id="sbTime">60s</b> — <span id="sbCard"></span></p>
      <div class="ptable-wrap"><div class="ptable" id="sbTable"></div></div>`;
    let q=shuffle(PQ_DATA.ELEMENTS.slice(0,36)), cur=q.shift(), t=60;
    const show=()=>$('#sbCard').innerHTML=`Place: <b>${cur.name} (${cur.sym})</b>`;
    show();
    renderTable($('#sbTable'), { empty:true, onTap:(el,tile)=>{
      if(el.n===cur.n){
        tile.className='ptile placed cat-'+cur.cat;
        tile.innerHTML=`<span class="ts">${cur.sym}</span>`;
        tile.disabled=true; sfx.good(); P[turn].score++; syncBar();
        cur=q.shift(); if(!cur){ clearInterval(tm); nextTurn(); return; } show();
      } else { tile.classList.add('wrong'); setTimeout(()=>tile.classList.remove('wrong'),350); sfx.bad(); }
    }});
    const tm=setInterval(()=>{
      t--; $('#sbTime').textContent=t+'s';
      if(t<=10) sfx.tick();
      if(t<=0){ clearInterval(tm); nextTurn(); }
    },1000);
  }
  /* mix race turn */
  function raceTurn(){
    const st=$('#multiStage');
    st.innerHTML=`<p class="hint-text">Pick two elements that make a real compound!
      <span id="racePicks" style="font-family:'Baloo 2'"></span></p>
      <div style="text-align:center;margin-bottom:10px"><button class="pill-btn brick" id="raceMix" disabled>MIX! ⚗️</button></div>
      <div class="ptable-wrap"><div class="ptable shelf" id="raceTable"></div></div>`;
    let picks=[];
    renderTable($('#raceTable'), { shelf:true, onTap:(el)=>{
      sfx.pick();
      if(picks.length>=2) picks=[];
      picks.push(el);
      $('#racePicks').textContent=' '+picks.map(p=>p.sym).join(' + ');
      $('#raceMix').disabled=picks.length<2;
      $$('#raceTable .ptile').forEach(t=>t.classList.toggle('selected', picks.some(p=>p.n==t.dataset.n)));
    }});
    $('#raceMix').addEventListener('click',()=>{
      const key=[picks[0].sym,picks[1].sym].sort().join('-');
      const c=COMP_BY_KEY[key];
      if(c && !raceFound.includes(key)){
        raceFound.push(key); P[turn].score++; syncBar();
        sfx.good(); confetti(60);
        toast(`${P[turn].av} ${P[turn].name} made ${c.name}! ${c.emoji}`);
      } else if(c){ sfx.pop(); toast('Already discovered this round! Turn passes.'); }
      else { sfx.bad(); toast('No reaction! Turn passes.'); }
      setTimeout(nextTurn, 900);
    });
  }
  function endGame(){
    const [a,b]=P;
    const winner = a.score===b.score ? null : (a.score>b.score?a:b);
    sfx.fanfare(); confetti(150);
    award({coins:5, xp:5, quiet:true, why:'Read about '+el.name});
    $('#multiStage').innerHTML=`<div class="pass-veil">
      <div class="big">${winner?winner.av+'🏆':'🤝'}</div>
      <h3>${winner? winner.name+' wins!' : "It's a tie!"}</h3>
      <p class="hint-text">${a.av} ${a.name}: <b>${a.score}</b> &nbsp;·&nbsp; ${b.av} ${b.name}: <b>${b.score}</b></p>
      <button class="pill-btn brick" id="multiAgain">🔁 Play again</button>
    </div>`;
    turn=-1; syncBar();
    $('#multiAgain').addEventListener('click', enter);
  }
  document.addEventListener('click', e=>{
    const b=e.target.closest('[data-mm]'); if(b) begin(b.dataset.mm);
  });
  return { enter };
})();

/* ============================================================
   ENCYCLOPEDIA · COLLECTION · BADGES
   ============================================================ */
const Ency = (() => {
  function enter(){
    const leg=$('#encyLegend');
    if(!leg.children.length){
      Object.entries(CAT_LABEL).forEach(([k,v])=>{
        const s=document.createElement('span');
        s.className='cat-'+k; s.textContent=v;
        leg.appendChild(s);
      });
    }
    renderTable($('#encyTable'), { onTap: elementModal });
    encySearchRun();
  }
  const encySearchRun = attachSearch($('#encySearch'), ()=>$$('#encyTable .ptile'), $('#encySearchStatus'));
  return { enter };
})();

const Coll = (() => {
  const HINT_COST=10, UNLOCK_COST=30;
  function enter(){
    $('#collCount').textContent=`You've discovered ${S.discovered.length} of ${PQ_DATA.COMPOUNDS.length} compounds. Can you find them all?`;
    const g=$('#collGrid'); g.innerHTML='';
    PQ_DATA.COMPOUNDS.forEach(c=>{
      const owned=S.discovered.includes(c.key);
      const hinted=S.hinted.includes(c.key);
      const d=document.createElement('button');
      d.className='coll-card brick'+(owned?'':hinted?' locked hinted':' locked');
      const ing=(c.els||[c.a,c.b]).join(' + ');
      d.innerHTML= owned
        ? `<div class="ce">${c.emoji}</div><div class="cn">${c.name}</div><div class="cf">${c.formula}</div>`
        : hinted
          ? `<div class="ce">${c.emoji}</div><div class="cn">${c.name}</div><div class="cf">${ing}</div>`
          : `<div class="ce">❓</div><div class="cn">???</div><div class="cf">${ing}</div>`;
      d.setAttribute('aria-label', owned ? c.name : hinted ? c.name+' — mix it to collect, or unlock with coins' : 'Mystery compound made of '+ing+' — tap for options');
      d.addEventListener('click', ()=> owned ? openCard(c) : openLocked(c));
      g.appendChild(d);
    });
  }
  function openCard(c){
    openModal(`
      <div class="comp-card">
        <div class="comp-emoji">${c.emoji}</div>
        <h3 class="comp-name">${c.name}</h3>
        <div class="comp-formula">${c.formula}</div>
        <div class="comp-fact">💡 ${c.fact}</div>
        <b>Used for:</b><ul class="comp-uses">${c.uses.map(u=>`<li>${u}</li>`).join('')}</ul>
      </div>`);
  }
  function openLocked(c){
    const hinted=S.hinted.includes(c.key);
    const ing=(c.els||[c.a,c.b]).join(' + ');
    openModal(`
      <div class="comp-card">
        <div class="comp-emoji">${hinted?c.emoji:'❓'}</div>
        <h3 class="comp-name">${hinted?c.name:'Mystery compound'}</h3>
        <div class="comp-formula">${ing}</div>
        <div class="comp-fact">${hinted
          ? '💡 You bought the name — now mix '+ing+' in the Mix Lab to collect it for free!'
          : '🕵️ Mix these elements in the Mix Lab to discover it — or spend coins below!'}</div>
        ${hinted?'':`<button class="pill-btn brick" id="buyHint">💡 Reveal name — ${HINT_COST} 🪙</button>`}
        <button class="pill-btn brick" id="buyUnlock">✨ Unlock card — ${UNLOCK_COST} 🪙</button>
        <p style="opacity:.75">You have ${S.coins} 🪙</p>
      </div>`);
    const bH=$('#buyHint');
    if(bH) bH.addEventListener('click', ()=>{
      if(!spend(HINT_COST, 'Hint: '+c.name)) return;
      S.hinted.push(c.key); save();
      closeModal(); enter(); toast('💡 It\'s '+c.name+'! Now mix '+ing+' to collect it!');
    });
    $('#buyUnlock').addEventListener('click', ()=>{
      if(!spend(UNLOCK_COST, 'Unlocked '+c.name)) return;
      S.discovered.push(c.key); save();
      confetti(90); sfx.good(); checkBadges();
      closeModal(); enter(); openCard(c);
    });
  }
  return { enter };
})();

function renderBadges(){
  const g=$('#badgeGrid'); g.innerHTML='';
  BADGES.forEach(b=>{
    const owned=S.badges.includes(b.id);
    const d=document.createElement('div');
    d.className='badge-card brick'+(owned?'':' locked');
    d.innerHTML=`<div class="be">${b.e}</div><div class="bn">${b.n}</div><div class="bd">${b.d}</div>`;
    g.appendChild(d);
  });
}

/* ============================================================
   PARENT / TEACHER ZONE
   ============================================================ */
const Parent = (() => {
  let ans=0;
  function gate(){
    const a=6+rand(4), b=6+rand(4); ans=a*b;
    $('#gateQ').textContent=`${a} × ${b} = ?`;
    $('#gateA').value='';
    $('#parentGate').hidden=false; $('#parentStats').hidden=true;
  }
  function open(){
    $('#parentGate').hidden=true;
    const st=S.stats, g=st.games;
    const total=st.correct+st.wrong;
    const acc= total? Math.round(st.correct/total*100) : 0;
    $('#parentStats').hidden=false;
    $('#parentStats').innerHTML=`
      <div class="pstat-grid">
        <div class="pstat brick"><b>${LEVELS[levelIndex()].name}</b><span>Current level · ${S.xp} XP</span></div>
        <div class="pstat brick"><b>${acc}%</b><span>Answer accuracy (${st.correct} ✔ / ${st.wrong} ✘)</span></div>
        <div class="pstat brick"><b>${S.discovered.length}</b><span>Compounds discovered</span></div>
        <div class="pstat brick"><b>${S.encySeen.length}</b><span>Encyclopedia entries read</span></div>
        <div class="pstat brick"><b>${S.badges.length} / ${BADGES.length}</b><span>Badges earned</span></div>
        <div class="pstat brick"><b>${st.placedBest}</b><span>Best table-building run</span></div>
      </div>
      <div class="clue-box brick">
        <b>Games played:</b>
        <p>${Object.entries(g).map(([k,v])=>`${k}: ${v}`).join(' · ')||'None yet'}</p>
        <b>Recently learned elements:</b>
        <p>${st.recent.join(', ')||'None yet'}</p>
        <b>Mode:</b> <p>${S.mode==='beginner'?'🐣 Beginner (6–8)':'🚀 Explorer (9–12)'}</p>
      </div>
      <button class="pill-btn brick danger-btn" id="resetAll">🗑️ Reset all progress</button>`;
    $('#resetAll').addEventListener('click',()=>{
      if(confirm('Really erase all progress? This cannot be undone.')){
        localStorage.removeItem('pq-save'); location.reload();
      }
    });
  }
  $('#gateGo').addEventListener('click',()=>{
    if(+$('#gateA').value===ans){ open(); }
    else { toast('Not quite — try again!'); gate(); }
  });
  $('#gateA').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#gateGo').click(); });
  return { gate };
})();

/* ============================================================
   AVATAR · SETTINGS · MODE · INIT
   ============================================================ */
const AVATAR_CHOICES=['🦊','🐸','🐼','🦄','🐙','🦖','🐧','🚀','🐝','🦁','🐳','👾','🤖','🐨','🦉','⭐'];
$('#btnAvatar').addEventListener('click',()=>{
  openModal(`
    <div class="comp-card">
      <h3 class="comp-name" style="font-size:1.4rem">Pick your scientist!</h3>
      <div class="avatar-row" id="avatarPick" style="justify-content:center;margin:12px 0"></div>
      <label for="playerName" style="font-weight:800">Your name:</label><br>
      <input id="playerName" maxlength="14" value="${S.name.replace(/"/g,'&quot;')}"
        style="border:2.5px solid var(--ink);border-radius:12px;padding:10px;font-weight:800;margin-top:6px" aria-label="Your name">
      <br><button class="pill-btn brick" id="saveAvatar" style="margin-top:12px">Save ✅</button>
    </div>`);
  const row=$('#avatarPick');
  AVATAR_CHOICES.forEach(a=>{
    const b=document.createElement('button');
    b.type='button'; b.textContent=a;
    b.setAttribute('aria-pressed', String(S.avatar===a));
    b.addEventListener('click',()=>{
      S.avatar=a; sfx.pick();
      $$('button',row).forEach(x=>x.setAttribute('aria-pressed', String(x===b)));
    });
    row.appendChild(b);
  });
  $('#saveAvatar').addEventListener('click',()=>{
    S.name=$('#playerName').value.trim(); save(); refreshHud(); closeModal(); sfx.good();
  });
});


/* ---------- coin bank & level map ---------- */
function timeAgo(t){
  const s=Math.floor((Date.now()-t)/1000);
  if(s<60) return 'just now';
  const m=Math.floor(s/60); if(m<60) return m+'m ago';
  const h=Math.floor(m/60); if(h<24) return h+'h ago';
  const d=Math.floor(h/24); return d===1?'yesterday':d+'d ago';
}
function openBank(){
  const rows = S.ledger.slice(0,15).map(e=>`
    <li class="ledger-row">
      <span class="ledger-why">${e.why}</span>
      <span class="ledger-amt ${e.d>=0?'plus':'minus'}">${e.d>=0?'+':''}${e.d} 🪙</span>
      <span class="ledger-when">${timeAgo(e.t)}</span>
    </li>`).join('');
  openModal(`
    <div class="comp-card">
      <div class="comp-emoji">🪙</div>
      <h3 class="comp-name">Coin Bank</h3>
      <div class="comp-formula">${S.coins} coins</div>
      <div class="comp-fact" style="text-align:left">💰 <b>Earn coins</b> by discovering compounds, winning games, and finishing the daily challenge.<br>🛍️ <b>Spend them</b> in My Collection — buy a name hint (10 🪙) or unlock a compound card (30 🪙)!</div>
      ${rows ? `<b>Recent history</b><ul class="ledger">${rows}</ul>` : '<p>No coin history yet — go play and earn some! 🎮</p>'}
      <button class="pill-btn brick" data-go="collection" id="bankToColl">🃏 Go to My Collection</button>
    </div>`);
  $('#bankToColl').addEventListener('click', ()=>closeModal());
}
const LEVEL_EMOJI = ['🔤','🔣','🔢','📊','📈','🧊','🧠','⚗️'];
function openLevelMap(){
  const cur = levelIndex();
  const nodes = LEVELS.map((l,i)=>{
    const [lv, topic] = l.name.split('·').map(s=>s.trim());
    let state='locked', extra='🔒 '+l.xp+' XP';
    if(i<cur){ state='done'; extra='✅ Complete'; }
    if(i===cur){
      state='current';
      const next=LEVELS[i+1];
      extra = next
        ? `<div class="lvl-bar"><i style="width:${Math.min(100,Math.round((S.xp-l.xp)/(next.xp-l.xp)*100))}%"></i></div>${S.xp} / ${next.xp} XP`
        : '👑 Max level!';
    }
    return `
      <li class="lvl-node ${state}">
        <span class="lvl-dot">${state==='locked'?'🔒':LEVEL_EMOJI[i]}</span>
        <div class="lvl-info">
          <b>${lv} — ${topic}</b>
          <small>${l.unlock}</small>
          <span class="lvl-extra">${extra}</span>
        </div>
      </li>`;
  }).join('');
  openModal(`
    <div class="comp-card">
      <h3 class="comp-name">🗺️ Your Quest Map</h3>
      <p>${LEVELS.length} levels of element mastery — earn XP in any game to climb!</p>
      <ol class="lvlmap">${nodes}</ol>
    </div>`);
}
$('#chipCoins').addEventListener('click', openBank);
$('#chipLevel').addEventListener('click', openLevelMap);

$('#btnSound').addEventListener('click',()=>{
  S.sound=!S.sound; save(); refreshHud();
  if(S.sound) sfx.pop();
});

$('#btnSettings').addEventListener('click',()=>{
  openModal(`
    <div class="comp-card">
      <h3 class="comp-name" style="font-size:1.4rem">⚙️ Settings</h3>
      <p style="text-align:left">Periodic Quest saves your progress on this device — no account, no internet needed after the first visit. Install it from your browser menu to play like a real app!</p>
      <button class="pill-btn brick" id="toggleBig" aria-pressed="${S.big}">🔍 Big text: ${S.big?'ON':'OFF'}</button>
      <button class="pill-btn brick" id="goParent">👩‍🏫 Grown-Up Zone</button>
    </div>`);
  $('#toggleBig').addEventListener('click',()=>{
    S.big=!S.big; save(); applyBigText(); sfx.pick();
    $('#toggleBig').textContent = '🔍 Big text: '+(S.big?'ON':'OFF');
    $('#toggleBig').setAttribute('aria-pressed', String(S.big));
  });
  $('#goParent').addEventListener('click',()=>{ closeModal(); Parent.gate(); go('parent'); });
});

$$('.mode-btn').forEach(b=>b.addEventListener('click',()=>{
  S.mode=b.dataset.mode; save(); refreshHud(); sfx.pick();
  toast(S.mode==='beginner' ? '🐣 Beginner mode: bigger hints, friendlier tables!' : '🚀 Explorer mode: the full periodic table awaits!');
}));

/* animated home background */
function paintBg(){
  const bg=$('#tableBg');
  const picks=sample(PQ_DATA.ELEMENTS, 40);
  bg.innerHTML='';
  picks.forEach((e,i)=>{
    const s=document.createElement('span');
    s.className='cat-'+e.cat; s.textContent=e.sym;
    s.style.animationDelay=(i%7*0.5)+'s';
    bg.appendChild(s);
  });
}

/* boot */
function applyBigText(){ document.body.classList.toggle('big-text', !!S.big); }
loadState();
applyBigText();
initDaily();
refreshHud();
paintBg();
history.replaceState({s:'home'}, '');
go('home', false);
