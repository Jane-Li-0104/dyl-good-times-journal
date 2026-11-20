(() => {
  'use strict';
  const root = document.querySelector('#odyssey-page');
  const $ = s => root.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `o-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const years = [2027,2028,2029,2030,2031];
  const definitions = {
    A: ['現在的方向','按照目前的方向，未來五年可能如何發展？','以自己現在的主要人生規劃為基礎，想像接下來五年的生活。'],
    B: ['另一種可能','如果不走目前的主要方向，還有哪些可能？','暫時撇除 Plan A 的主要發展方向，探索另一種人生道路；主要方向不同即可，不必讓每件事都不同。'],
    C: ['夢想的生活','如果暫時放下現實限制，你最想過什麼樣的生活？','放下現有資源的限制，自由想像自己真正嚮往的生活。']
  };
  const metrics = [['resources','資源','時間、金錢與支持是否足夠？'],['liking','喜歡','有多期待這樣的五年生活？'],['confidence','自信','有多大信心實現這個計畫？'],['coherence','一致性','與自己的價值觀及方向一致嗎？']];
  const values = ['自由','成長','成就','穩定','安全感','創造力','家庭','友誼','愛與親密','健康','財務自主','探索','學習','貢獻','社會影響力','自我實現','平衡','冒險','真誠','幸福'];
  const blankPlan = id => ({id,title:'',events:[],dashboard:Object.fromEntries(metrics.map(([k])=>[k,null])),coreValues:[],customValues:[],questions:['','',''],satisfaction:null});
  const blank = () => ({format:'dyl-odyssey',version:1,plans:Object.fromEntries(['A','B','C'].map(id=>[id,blankPlan(id)]))});
  let state=blank(), active='overview', account=null, epoch=0, ready=false, dirty=false, pending=0, saveFailed=false;
  let queue=Promise.resolve(), loading=Promise.resolve(), dbPromise;
  function db() {
    if (!dbPromise) dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open('dyl-odyssey-v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('canvases');
      request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
    });
    return dbPromise;
  }
  async function storage(mode,key,data) {
    const database=await db();
    return new Promise((resolve,reject)=>{
      const tx=database.transaction('canvases',mode), os=tx.objectStore('canvases');
      const req=mode==='readonly'?os.get(key):os.put(data,key);
      tx.oncomplete=()=>resolve(req.result); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
    });
  }
  function status(message) { const el=$('#o-status'); if(el) el.textContent=message; }
  function notice(message) { const el=$('#o-notice'); if(el) {el.textContent=message;el.hidden=false;} }
  function persist() {
    dirty=true; pending++; status('儲存中…');
    const snapshot=structuredClone(state), key=account, generation=epoch;
    queue=queue.catch(()=>{}).then(()=>storage('readwrite',key,snapshot)).then(()=>{
      if(generation===epoch){ pending--; if(!pending){dirty=false;saveFailed=false;status('已儲存');} }
    }).catch(()=>{ if(generation===epoch){pending--;saveFailed=true;status('儲存失敗');notice('無法保存，請先下載 JSON 備份，避免關閉頁面後遺失資料。');} });
    return queue;
  }
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  const noteText = e => typeof e.text==='string'?e.text:[e.title,e.description].filter(Boolean).join('\n');
  const completed = p => p.events.filter(e=>noteText(e).trim()).length;
  const score = n => n===null?'尚未評估':`${n} / 100`;
  function shell() {
    root.innerHTML=`<div class="o-shell"><aside class="o-sidebar"><div class="o-brand">奧德賽計劃<small>5-YEAR ODYSSEY CANVAS</small></div><button id="o-menu" class="o-menu" aria-expanded="false" aria-controls="o-navigation">計畫選單</button><div id="o-navigation"><nav class="o-nav" aria-label="奧德賽計劃導覽"><button data-plan="overview">總覽 <small>OVERVIEW</small></button>${Object.entries(definitions).map(([id,d])=>`<button data-plan="${id}"><span class="o-plan-letter">${id}</span>${d[0]}</button>`).join('')}</nav><nav class="o-nav o-guide-nav"><button data-plan="guide">使用指引</button></nav><span id="o-status" class="sr-only" role="status" aria-live="polite">載入中…</span><input id="o-import" type="file" accept="application/json,.json" hidden></div></aside><main class="o-main"><div class="o-topbar"><span>奧德賽計劃 / <strong id="o-current">總覽</strong></span><span>2027 — 2031</span></div><div id="o-notice" role="status" hidden></div><div id="o-content"></div></main></div>`;
  }
  function render() {
    if(!ready)return;
    root.querySelectorAll('[data-plan]').forEach(b=>{b.classList.toggle('active',b.dataset.plan===active);if(b.dataset.plan===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    $('#o-current').textContent=active==='overview'?'三個計畫總覽':active==='guide'?'使用指引':`Plan ${active} · ${definitions[active][0]}`;
    $('#o-content').innerHTML=active==='overview'?overview():active==='guide'?guide():editor(state.plans[active]);
    if(!saveFailed)$('#o-notice').hidden=true;
    status(saveFailed?'儲存失敗':pending?'儲存中…':'已儲存');
  }
  function overview() {
    return `<div class="o-overviews">${Object.entries(state.plans).map(([id,p])=>`<article class="o-overview o-tone-${id}" role="button" tabindex="0" data-plan="${id}" aria-label="開啟 Plan ${id}：${esc(p.title||definitions[id][0])}"><div class="o-card-label">PLAN ${id}<span>${definitions[id][0]}</span></div><h2>${esc(p.title||'尚未命名的計畫')}</h2><p class="o-definition">${definitions[id][1]}</p><div class="o-mini-years">${years.map(y=>`<span>${y}<b>${p.events.filter(e=>e.year===y).length}</b></span>`).join('')}</div><div class="o-progress-label"><span>完成事件</span><strong>${completed(p)} / 15</strong></div><progress max="15" value="${completed(p)}"></progress><div class="o-score-list">${metrics.map(([k,n])=>`<div><span>${n}</span><strong>${score(p.dashboard[k])}</strong></div>`).join('')}<div class="o-satisfaction-row"><span>整體滿意程度</span><strong>${score(p.satisfaction)}</strong></div></div><div class="o-value-summary">${p.coreValues.length?p.coreValues.map(v=>`<span>${esc(v)}</span>`).join(''):'<p>尚未選擇核心價值觀</p>'}</div></article>`).join('')}</div><div class="o-overview-note">每個計畫以 15 件完整事件為目標。你可以自由分配五年的事件，隨時切換計畫。</div>`;
  }
  function rating(key,label,help,n) {
    return `<div class="o-rating"><label for="o-rating-${key}">${label}</label>${help?`<p>${help}</p>`:''}<input id="o-rating-${key}" type="range" min="0" max="100" step="1" value="${n??50}" data-rating="${key}" aria-label="${label}" aria-valuetext="${score(n)}"></div>`;
  }
  function guide() {
    return `<header class="o-page-heading"><span class="eyebrow">QUICK GUIDE</span><h1>使用指引</h1></header><div class="guide-grid"><article class="guide-card"><h2>想像三種五年生活</h2><p>A 是現在的方向，B 是另一種主要發展方向，C 是暫時放下限制後最想過的生活。點選總覽卡牌或側欄即可切換。</p></article><article class="guide-card"><h2>用便利貼安排時間</h2><p>在年份下新增便利貼，寫下規劃，也可以加入圖片。拖曳便利貼上方的把手調整位置，左右位置代表大約的年份與月份，上下可自由整理。選取把手後也能用方向鍵微調，Shift 可加大移動幅度。</p></article><article class="guide-card"><h2>評估與探索</h2><p>拖動滑桿評估資源、喜歡、自信與一致性，再選擇價值觀、寫下三個好奇問題與整體滿意度。各項評估獨立記錄。</p></article><article class="guide-card"><h2>持續調整計畫</h2><p>每個計畫以 15 件有文字的便利貼為目標，圖片選填。文字、圖片與位置會自動保存；你可以隨時回來修改。</p></article></div><section class="data-panel"><h2>紀錄備份</h2><div class="data-actions"><button class="primary-btn" data-action="export">下載 JSON 備份</button><button class="outline-btn" data-action="import">匯入 JSON 備份</button><button class="outline-btn" data-action="print">列印／匯出 PDF</button></div><p>備份包含三個計畫、圖片與便利貼位置。匯入會取代目前帳號的奧德賽計畫，建議先下載備份。</p></section><section class="demo-panel"><h3>想先看看怎麼規劃？</h3><p>示範三種生活：研究與生活平衡、轉向設計工作、旅行與創作。只填入尚未開始的計畫，不覆蓋已有內容。</p><button class="outline-btn" data-action="demo">載入示範資料</button></section>`;
  }
  function position(e,p) {
    if(e.position)return e.position;
    const i=p.events.filter(x=>x.year===e.year).indexOf(e);
    return {x:(e.year-2027)*20+7.2+(i%2)*6,y:30+Math.floor(i/2)*370+(i%2)*150};
  }
  function canvas(p) {
    const height=Math.max(740,...p.events.map(e=>position(e,p).y+390));
    return `<div class="o-timeline o-canvas-scroll" tabindex="0" aria-label="五年規劃板，可水平捲動"><div class="o-canvas-years">${years.map(y=>`<div><h3>${y}</h3><button class="o-add" data-add-year="${y}">＋ 新增便利貼</button><div class="o-months"><span>1 月</span><span>6 月</span><span>12 月</span></div></div>`).join('')}</div><div class="o-canvas" style="height:${height}px"><div class="o-year-lines">${years.map(()=>'<div></div>').join('')}</div>${p.events.map(e=>eventCard(e,p)).join('')}</div></div>`;
  }
  function editor(p) {
    return `<header class="o-page-heading"><span class="eyebrow">PLAN ${p.id} / ${definitions[p.id][0]}</span><h1 id="o-live-title">${esc(p.title||definitions[p.id][0])}</h1><p>${definitions[p.id][1]}</p><p class="o-context">${definitions[p.id][2]}</p><label class="sr-only" for="o-title">計畫名稱</label><input id="o-title" data-field="title" value="${esc(p.title)}" placeholder="為你的五年計畫取一個名字…"></header><section class="o-section o-timeline-section"><div class="o-section-head"><div><h2>五年時間軸</h2><p>把每一年的想像，放進事件卡裡。</p></div><div class="o-timeline-actions"><strong id="o-progress">已記錄 ${completed(p)} / 15 件規劃</strong><button class="outline-btn o-expand" data-action="expand-canvas" aria-label="全螢幕展示五年時間軸" title="全螢幕展示"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/></svg><span>放大</span></button></div></div><p id="o-progress-help" class="o-meta">拖曳便利貼上方把手，安排大約的時間；圖片選填。</p>${canvas(p)}</section><section class="o-section"><div class="o-section-head"><div><p>以 0–100 分評估此刻的感受。</p></div></div><div class="o-ratings">${metrics.map(([k,n,h])=>rating(k,n,h,p.dashboard[k])).join('')}</div></section><section class="o-section"><h2>核心價值觀</h2><p>這個五年計畫最能實現哪些你重視的價值？</p><div class="o-values">${[...new Set([...values,...p.customValues,...p.coreValues])].map(v=>`<button data-value="${esc(v)}" aria-pressed="${p.coreValues.includes(v)}" class="${p.coreValues.includes(v)?'selected':''}">${esc(v)}</button>`).join('')}</div><form id="o-custom-form" class="o-custom-form"><label class="sr-only" for="o-custom">自訂價值觀</label><input id="o-custom" maxlength="40" placeholder="輸入自訂價值觀" required><button class="outline-btn">＋ 自訂價值觀</button></form></section><section class="o-section"><h2>三個好奇的問題</h2><p>關於這個五年計畫，你最想知道什麼？</p><div class="o-questions">${['我真的會喜歡這樣的工作方式嗎？','這樣的生活能帶給我想要的自由嗎？','如果遇到挫折，我會怎麼調整？'].map((text,i)=>`<label><span>0${i+1}</span><textarea rows="4" data-question="${i}" placeholder="${text}" aria-label="第 ${i+1} 個好奇的問題">${esc(p.questions[i])}</textarea></label>`).join('')}</div></section><section class="o-section o-final-rating">${rating('satisfaction','你對這個五年計畫有多滿意？','',p.satisfaction)}</section>`;
  }
  function eventCard(e,p) {
    const pos=position(e,p);
    return `<article class="o-event o-sticky" data-event="${esc(e.id)}" style="left:${pos.x}%;top:${pos.y}px"><div class="o-sticky-head"><button class="o-drag-handle" aria-label="移動便利貼；方向鍵調整位置" title="拖曳調整位置">⠿ <span>${e.year} · 約 ${Math.min(12,Math.floor((pos.x%20)/20*12)+1)} 月</span></button><button data-action="delete" class="o-delete" aria-label="刪除便利貼">×</button></div><label class="o-image-picker ${e.imageData?'has-image':''}" title="上傳或更換圖片">${e.imageData?`<img src="${e.imageData}" alt="規劃圖片">`:'<span>＋ 加入圖片</span>'}<input type="file" data-image="${esc(e.id)}" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="${e.imageData?'更換':'上傳'}事件圖片"></label>${e.imageData?'<button class="o-remove-image" data-action="remove-image">移除圖片</button>':''}<textarea data-event-field="text" rows="5" placeholder="寫下這段時間想做的事…" aria-label="便利貼內容">${esc(noteText(e))}</textarea></article>`;
  }
  function redrawTimeline(focusId) {
    const scroll=$('.o-timeline')?.scrollLeft||0, y=window.scrollY;
    render(); const timeline=$('.o-timeline');if(timeline)timeline.scrollLeft=scroll;
    window.scrollTo(0,y);
    if(focusId) $(`[data-event="${focusId}"] [data-event-field="text"]`)?.focus({preventScroll:true});
  }
  function updateProgress() { const n=completed(state.plans[active]);$('#o-progress').textContent=`已記錄 ${n} / 15 件規劃`; }
  function setRating(key,n) {
    const p=state.plans[active]; if(key==='satisfaction')p.satisfaction=n;else p.dashboard[key]=n;
    $(`#o-rating-${key}`).setAttribute('aria-valuetext',score(n));persist();
  }
  root.addEventListener('input',e=>{
    if(!ready||!state.plans[active])return;
    const el=e.target,p=state.plans[active];
    if(el.matches('[data-event-field="text"]')) { const event=p.events.find(x=>x.id===el.closest('[data-event]').dataset.event);event.text=el.value;event.title='';event.description=el.value;updateProgress();persist(); }
    if(el.matches('#o-title')) {p.title=el.value;$('#o-live-title').textContent=p.title||definitions[active][0];persist();}
    if(el.matches('[data-rating]'))setRating(el.dataset.rating,Number(el.value));
    if(el.matches('[data-question]')){p.questions[Number(el.dataset.question)]=el.value;persist();}
  });
  root.addEventListener('submit',e=>{
    if(e.target.id!=='o-custom-form')return;e.preventDefault();const v=$('#o-custom').value.trim();if(!v)return;
    const p=state.plans[active];if(!values.includes(v)&&!p.customValues.includes(v))p.customValues.push(v);if(!p.coreValues.includes(v))p.coreValues.push(v);persist();redrawTimeline();$('#o-custom').focus({preventScroll:true});
  });
  root.addEventListener('click',async e=>{
    const b=e.target.closest('button,[data-plan]');if(!b)return;
    if(b.id==='o-menu'){const expanded=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!expanded));$('#o-navigation').classList.toggle('expanded',!expanded);return;}
    if(b.dataset.action==='retry'){account=null;await changeAccount(sessionStorage.getItem('dyl-user')||'');return;}
    if(!ready)return;
    if(b.dataset.plan){active=b.dataset.plan;render();$('#o-navigation').classList.remove('expanded');$('#o-menu').setAttribute('aria-expanded','false');window.scrollTo(0,0);return;}
    if(b.dataset.action==='export'){downloadBackup();return;}
    if(b.dataset.action==='import'){$('#o-import').click();return;}
    if(b.dataset.action==='print'){await printAll();return;}
    if(b.dataset.action==='expand-canvas'){showCanvas();return;}
    if(b.dataset.action==='demo'){loadDemo();return;}
    if(!state.plans[active])return;
    const p=state.plans[active];
    if(b.dataset.addYear){const year=Number(b.dataset.addYear),same=p.events.filter(e=>e.year===year);const event={id:uid(),year,title:'',description:'',text:'',imageData:null,position:{x:(year-2027)*20+10,y:same.length?Math.max(...same.map(e=>position(e,p).y))+370:30}};p.events.push(event);persist();redrawTimeline(event.id);return;}
    if(b.dataset.value){const v=b.dataset.value;p.coreValues=p.coreValues.includes(v)?p.coreValues.filter(x=>x!==v):[...p.coreValues,v];b.classList.toggle('selected',p.coreValues.includes(v));b.setAttribute('aria-pressed',String(p.coreValues.includes(v)));persist();return;}
    if(b.dataset.rateStart){setRating(b.dataset.rateStart,Number($(`#o-rating-${b.dataset.rateStart}`).value));return;}
    const card=b.closest('[data-event]');if(!card)return;const event=p.events.find(x=>x.id===card.dataset.event);if(!event)return;
    if(b.dataset.action==='delete'){if(!confirm('刪除這件事件及其圖片？'))return;p.events=p.events.filter(x=>x!==event);}
    else if(b.dataset.action==='remove-image'){event.imageData=null;}
    else if(['up','down'].includes(b.dataset.action)){const same=p.events.filter(x=>x.year===event.year),index=same.indexOf(event),other=same[index+(b.dataset.action==='up'?-1:1)];if(!other)return;const a=p.events.indexOf(event),c=p.events.indexOf(other);[p.events[a],p.events[c]]=[p.events[c],p.events[a]];}
    else return;
    persist();redrawTimeline();
  });
  root.addEventListener('change',async e=>{
    const el=e.target;
    if(el.id==='o-import'){const f=el.files?.[0];el.value='';if(f)await importBackup(f);return;}
    if(!ready||!state.plans[active])return;
    const p=state.plans[active];
    if(el.matches('[data-event-field="year"]')){const event=p.events.find(x=>x.id===el.closest('[data-event]').dataset.event);event.year=Number(el.value);p.events=p.events.filter(x=>x!==event);p.events.push(event);persist();redrawTimeline();}
    if(el.matches('[data-image]')){
      const file=el.files?.[0],generation=epoch,planId=active,eventId=el.dataset.image; if(!file)return;
      if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>5*1024*1024){notice('請選擇 5 MB 以下的 PNG、JPG、WebP 或 GIF 圖片。');el.value='';return;}
      try{
        const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
        await new Promise((res,rej)=>{const i=new Image();i.onload=res;i.onerror=rej;i.src=data;});
        if(epoch!==generation)return;const event=state.plans[planId].events.find(x=>x.id===eventId);if(!event)return;
        event.imageData=data;persist();if(active===planId){const card=$(`[data-event="${eventId}"]`);if(card){const picker=card.querySelector('.o-image-picker');picker.classList.add('has-image');picker.querySelector('span')?.remove();let image=picker.querySelector('img');if(!image){image=document.createElement('img');picker.prepend(image);}image.src=data;image.alt=event.title||'事件圖片';picker.querySelector('input').setAttribute('aria-label','更換事件圖片');if(!card.querySelector('.o-remove-image')){const remove=document.createElement('button');remove.className='o-remove-image';remove.dataset.action='remove-image';remove.textContent='移除圖片';picker.after(remove);}}}
      }catch{notice('圖片無法讀取，請改用其他圖片。');}
    }
  });
  let drag=null;
  function applyPosition(card,event,x,y) {
    const board=card.parentElement,w=board.clientWidth;
    x=Math.max(card.offsetWidth/2/w*100,Math.min(100-card.offsetWidth/2/w*100,x));
    y=Math.max(0,Math.min(100000,y));
    event.position={x,y};event.year=2027+Math.min(4,Math.floor(x/20));
    card.style.left=x+'%';card.style.top=y+'px';
    const month=Math.min(12,Math.floor((x%20)/20*12)+1);
    card.querySelector('.o-drag-handle span').textContent=`${event.year} · 約 ${month} 月`;
    board.style.height=Math.max(board.clientHeight,y+card.offsetHeight+60)+'px';
  }
  root.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('.o-drag-handle');if(!handle||!ready||(e.pointerType==='mouse'&&e.button!==0))return;
    const card=handle.closest('[data-event]'),p=state.plans[active],event=p.events.find(x=>x.id===card.dataset.event),pos=position(event,p);
    drag={handle,card,event,epoch,plan:active,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,pos:{...pos},scroll:$('.o-timeline').scrollLeft};
    handle.setPointerCapture(e.pointerId);card.classList.add('dragging');e.preventDefault();
  });
  root.addEventListener('pointermove',e=>{
    if(!drag||drag.pointer!==e.pointerId)return;
    const scroller=$('.o-timeline'),rect=scroller.getBoundingClientRect();
    if(e.clientX>rect.right-45)scroller.scrollLeft+=18;else if(e.clientX<rect.left+45)scroller.scrollLeft-=18;
    applyPosition(drag.card,drag.event,drag.pos.x+(e.clientX-drag.startX+scroller.scrollLeft-drag.scroll)/drag.card.parentElement.clientWidth*100,drag.pos.y+e.clientY-drag.startY);
  });
  function endDrag(e,cancel=false){if(!drag||drag.pointer!==e.pointerId)return;const d=drag;drag=null;d.card.classList.remove('dragging');if(d.epoch!==epoch)return;if(cancel)applyPosition(d.card,d.event,d.pos.x,d.pos.y);persist();}
  root.addEventListener('pointerup',e=>endDrag(e));root.addEventListener('pointercancel',e=>endDrag(e,true));root.addEventListener('lostpointercapture',e=>endDrag(e,true));
  root.addEventListener('keydown',e=>{
    const plan=e.target.closest('.o-overview[data-plan]');if(plan&&['Enter',' '].includes(e.key)){e.preventDefault();plan.click();return;}
    const handle=e.target.closest('.o-drag-handle');if(!handle||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
    const card=handle.closest('[data-event]'),p=state.plans[active],event=p.events.find(x=>x.id===card.dataset.event),pos=position(event,p),step=e.shiftKey?60:12;
    applyPosition(card,event,pos.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0)/card.parentElement.clientWidth*100,pos.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));persist();
  });
  root.addEventListener('pointerup',e=>{if(e.target.matches('[data-rating]')&&state.plans[active])setRating(e.target.dataset.rating,Number(e.target.value));});
  function loadDemo(){
    const examples={
      A:{title:'在研究與生活之間找到平衡',values:['成長','健康','平衡'],ratings:[65,80,70,85],satisfaction:80,questions:['我喜歡長期投入同一個研究問題嗎？','怎樣的工作節奏能讓我保留生活？','我需要向誰尋求支持？'],notes:[['春天探索研究主題，與老師討論方向。','暑假參與研究助理工作，了解實際研究流程。','年底建立每週運動兩次的習慣。'],['年初完成研究計畫與第一輪資料蒐集。','夏天參加研討會，練習介紹自己的研究。','秋天安排一週旅行，好好休息。'],['春天完成論文，整理自己學會的能力。','夏天探索研究或分析相關工作。','年底搬到通勤方便的地方，建立新的生活節奏。'],['年初獨立負責一個小專案。','年中持續進修資料分析與溝通技巧。','秋天固定留時間陪伴家人與朋友。'],['春天檢視目前的工作是否適合自己。','夏天嘗試帶領新同事或分享研究經驗。','年底回顧五年，重新安排下一個階段。']]},
      B:{title:'轉向設計，從小作品開始',values:['創造力','學習','自由'],ratings:[50,85,60,75],satisfaction:78,questions:['我享受設計的日常工作嗎？','如何建立穩定的收入來源？','我的研究經驗能怎樣幫助設計？'],notes:[['春天修一門使用者體驗設計入門課。','夏天訪談三位不同領域的設計工作者。','年底完成第一個個人作品。'],['年初整理作品集，參與設計社群。','暑假嘗試短期實習或小型合作。','年底記錄接案與團隊工作的差異。'],['春天申請產品設計相關職位。','夏天學習與工程師協作。','秋天為收入與休息建立界線。'],['年初發展自己擅長的設計領域。','年中參與一個有社會意義的專案。','年底把學到的方法整理成文章。'],['春天評估自由工作與固定工作的取捨。','夏天與夥伴共同策劃一個作品展。','年底留下足夠存款與彈性，選擇下一步。']]},
      C:{title:'在不同城市旅行與創作',values:['探索','自由','創造力','友誼'],ratings:[35,95,55,90],satisfaction:92,questions:['慢旅行真的是我喜歡的生活嗎？','移動之中如何維持重要關係？','我想用什麼創作方式記錄世界？'],notes:[['春天開始寫旅行與生活觀察手帳。','夏天到海邊住一個月，練習攝影。','年底規劃第一段長住旅行。'],['年初在喜歡的城市學習語言。','夏天參加當地的創作課程，認識朋友。','秋天完成一本小型攝影誌。'],['春天搭火車慢慢旅行，記錄沿途故事。','夏天與不同城市的創作者合作。','年底回家住一段時間，陪伴家人。'],['年初安排一場小型作品分享。','夏天在山城住幾個月，練習寫作。','年底探索可以遠距完成的工作方式。'],['春天選擇一個喜歡的地方作為生活基地。','夏天邀請朋友一起策劃旅行與創作活動。','年底整理五年的故事，出版自己的作品集。']]}
    };
    let added=0;for(const id of ['A','B','C']){const p=state.plans[id];if(p.title.trim()||p.events.length||p.coreValues.length||p.customValues.length||p.questions.some(q=>q.trim())||p.satisfaction!==null||Object.values(p.dashboard).some(n=>n!==null))continue;const d=examples[id];p.title=d.title;p.coreValues=d.values;p.questions=d.questions;p.satisfaction=d.satisfaction;metrics.forEach(([k],i)=>p.dashboard[k]=d.ratings[i]);d.notes.forEach((notes,i)=>notes.forEach((text,j)=>p.events.push({id:uid(),year:2027+i,title:'',description:text,text,imageData:null,position:{x:i*20+7.2+j*3,y:30+j*340}})));added++;}
    if(added){persist();notice(`已加入 ${added} 個空白計畫的示範資料；原有內容未被覆蓋。`);}else notice('三個計畫都已有內容，未加入示範資料。');
  }
  function showCanvas() {
    const p=state.plans[active];if(!p)return;
    document.querySelector('#o-canvas-dialog')?.remove();
    const trigger=$('[data-action="expand-canvas"]');
    const dialog=document.createElement('dialog');dialog.id='o-canvas-dialog';
    dialog.setAttribute('aria-labelledby','o-share-title');
    dialog.innerHTML=`<header class="o-share-header"><div><span>PLAN ${active} · 2027 — 2031</span><h2 id="o-share-title">${esc(p.title||definitions[active][0])}</h2></div><button class="outline-btn o-share-close" aria-label="關閉全螢幕展示">關閉 <span aria-hidden="true">×</span></button></header><div class="o-share-viewport">${canvas(p)}</div>`;
    // A read-only presentation of the saved positions, without editing controls.
    dialog.querySelectorAll('.o-drag-handle').forEach(handle=>{const date=document.createElement('span');date.className='o-share-date';date.textContent=handle.textContent.replace('⠿','').trim();handle.replaceWith(date);});
    dialog.querySelectorAll('textarea').forEach(input=>{const text=document.createElement('div');text.className='o-share-note';text.textContent=input.value||'尚未填寫';input.replaceWith(text);});
    dialog.querySelectorAll('.o-canvas-scroll button,.o-canvas-scroll input,.o-remove-image').forEach(el=>el.remove());
    dialog.querySelectorAll('[data-event]').forEach(el=>el.removeAttribute('data-event'));
    const viewport=dialog.querySelector('.o-share-viewport'),board=dialog.querySelector('.o-canvas-scroll');
    // Scale the entire five-year board together so positions stay comparable.
    const fit=()=>{const style=getComputedStyle(viewport),width=viewport.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);board.style.zoom=String(Math.min(1,Math.max(0.15,width/2100)));};
    let nativeFullscreen=false;
    const fullscreenChanged=()=>{if(document.fullscreenElement===dialog)nativeFullscreen=true;else if(nativeFullscreen&&dialog.open)dialog.close();fit();};
    document.addEventListener('fullscreenchange',fullscreenChanged);
    const resize=new ResizeObserver(fit);
    dialog.addEventListener('close',()=>{resize.disconnect();document.removeEventListener('fullscreenchange',fullscreenChanged);if(document.fullscreenElement===dialog)document.exitFullscreen().catch(()=>{});dialog.remove();trigger?.focus({preventScroll:true});},{once:true});
    dialog.querySelector('.o-share-close').onclick=()=>dialog.close();
    document.body.append(dialog);dialog.showModal();resize.observe(viewport);fit();
    if(dialog.requestFullscreen)dialog.requestFullscreen().catch(()=>{});
  }
  function downloadBackup() {
    const data={...state,exportedAt:new Date().toISOString()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`DYL-奧德賽計劃-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function validate(raw) {
    if(raw?.format!=='dyl-odyssey'||raw.version!==1||!raw.plans)throw Error('不是有效的奧德賽計劃備份。');
    const result=blank(),ids=new Set();
    const str=(s,max=200000)=>{if(typeof s!=='string'||s.length>max)throw Error('文字格式不正確或過長。');return s;};
    const rating=n=>{if(n!==null&&(!Number.isInteger(n)||n<0||n>100))throw Error('評分必須為 0–100 或未評估。');return n;};
    const list=xs=>{if(!Array.isArray(xs)||xs.length>200)throw Error('價值觀格式不正確。');return [...new Set(xs.map(x=>str(x,100)))];};
    for(const id of ['A','B','C']){
      const source=raw.plans[id],p=result.plans[id];if(!source||!Array.isArray(source.events)||source.events.length>1000)throw Error('缺少計畫或事件格式不正確。');
      p.title=str(source.title);p.events=source.events.map(event=>{
        if(!years.includes(event.year))throw Error('事件年份必須介於 2027–2031。');
        const eventId=str(event.id,100);if(!/^[\w-]+$/.test(eventId)||ids.has(eventId))throw Error('事件識別碼不正確或重複。');ids.add(eventId);
        const image=event.imageData??null;if(image!==null&&(typeof image!=='string'||image.length>7100000||!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(image)))throw Error('圖片格式不正確。');
        const pos=event.position;const validPos=pos&&Number.isFinite(pos.x)&&pos.x>=0&&pos.x<=100&&Number.isFinite(pos.y)&&pos.y>=0&&pos.y<=100000;
        return {id:eventId,year:event.year,title:str(event.title??''),description:str(event.description??''),text:typeof event.text==='string'?str(event.text):[event.title,event.description].filter(Boolean).join('\n'),imageData:image,position:validPos?{x:pos.x,y:pos.y}:null};
      });
      for(const [k] of metrics)p.dashboard[k]=rating(source.dashboard?.[k]);
      p.coreValues=list(source.coreValues);p.customValues=list(source.customValues);
      if(!Array.isArray(source.questions)||source.questions.length!==3)throw Error('需要三個問題欄位。');p.questions=source.questions.map(s=>str(s));p.satisfaction=rating(source.satisfaction);
    }
    return result;
  }
  async function importBackup(file) {
    const generation=epoch;
    try{
      if(file.size>100*1024*1024)throw Error('請選擇 100 MB 以下的備份。');
      const imported=validate(JSON.parse(await file.text()));if(epoch!==generation)return;
      if(!confirm('匯入將取代目前帳號的三個奧德賽計畫及圖片。建議先備份；確定匯入？'))return;
      state=imported;await persist();active='overview';render();notice(saveFailed?'已載入，但儲存失敗；請保留原備份。':'已完整匯入三個計畫與圖片。');
    }catch(error){notice(error.message||'無法匯入，原資料未變更。');}
  }
  function printDocument() {
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>五年奧德賽計畫</title><style>@page{size:A4 landscape;margin:14mm}*{box-sizing:border-box}body{font:12px/1.65 "PingFang TC","Microsoft JhengHei",sans-serif;color:#293724;margin:0}h1{font-size:25px}h2{font-size:18px;margin:20px 0 10px}h3{font-size:15px}p{white-space:pre-wrap;overflow-wrap:anywhere}header{border-bottom:2px solid #6e8e23;margin-bottom:20px}.plan{break-before:page}.plan:first-child{break-before:auto}.year-title{break-after:avoid;border-bottom:1px solid #cbd5b8;padding:8px 0}.events{display:block}.event{border:1px solid #dbe1d0;padding:12px;margin:0 0 12px;break-inside:avoid;display:flow-root}.event img{width:38mm;height:38mm;object-fit:cover;float:left;margin:0 16px 6px 0}.event p{margin:4px 0}.event h3{margin:0 0 6px}.ratings{display:flex;gap:12px;flex-wrap:wrap}.ratings span,.values span{display:inline-block;background:#edf3df;border:1px solid #cbd5b8;padding:5px 12px;margin:3px;border-radius:15px}.question{break-inside:avoid}small{color:#657250}@media screen{body{max-width:1050px;margin:30px auto;padding:20px}.plan{margin-bottom:60px}}</style></head><body>${Object.entries(state.plans).map(([id,p])=>`<section class="plan"><header><small>DESIGN YOUR LIFE · PLAN ${id} · 2027–2031</small><h1>${esc(p.title||definitions[id][0])}</h1><p>${definitions[id][1]}</p><p>已記錄 ${completed(p)} / 15 件規劃</p></header><h2>五年時間軸</h2>${years.map(y=>`<h3 class="year-title">${y}</h3><div class="events">${p.events.filter(e=>e.year===y).map(e=>`<article class="event">${e.imageData?`<img src="${e.imageData}" alt="事件圖片">`:''}<p>${esc(noteText(e)||'尚未填寫')}</p></article>`).join('')||'<p>尚無事件</p>'}</div>`).join('')}<div class="ratings">${metrics.map(([k,n])=>`<span>${n}：${score(p.dashboard[k])}</span>`).join('')}</div><h2>核心價值觀</h2><div class="values">${p.coreValues.map(v=>`<span>${esc(v)}</span>`).join('')||'尚未選擇'}</div><h2>三個好奇的問題</h2>${p.questions.map((q,i)=>`<div class="question"><h3>0${i+1}</h3><p>${esc(q||'尚未填寫')}</p></div>`).join('')}<h2>整體滿意程度</h2><p>${score(p.satisfaction)}</p></section>`).join('')}</body></html>`;
  }
  async function printAll() {
    document.querySelector('#o-print-dialog')?.remove();
    const dialog=document.createElement('dialog');dialog.id='o-print-dialog';
    dialog.innerHTML='<div class="o-print-toolbar"><div><h2>完整計畫列印預覽</h2><p>包含 Plan A、B、C；選擇 A4 橫式另存為 PDF。</p></div><button class="primary-btn" id="o-print-confirm">列印／另存 PDF</button><button class="outline-btn" id="o-print-close">關閉</button></div>';
    const frame=document.createElement('iframe');frame.id='o-print-frame';frame.title='奧德賽計畫列印版';
    dialog.append(frame);document.body.append(dialog);dialog.showModal();
    document.querySelector('#o-print-close').onclick=()=>dialog.close();
    const button=document.querySelector('#o-print-confirm');button.disabled=true;
    frame.onload=async()=>{const doc=frame.contentDocument;await Promise.all([...doc.images].map(im=>im.decode().catch(()=>{})));await doc.fonts.ready;button.disabled=false;};
    button.onclick=()=>{try{frame.contentWindow.focus();frame.contentWindow.print();}catch{notice('請使用瀏覽器的列印功能，或先下載 JSON 備份。');}};
    frame.srcdoc=printDocument();
  }
  async function changeAccount(name) {
    const key=name?`user:${name}`:'guest';if(key===account)return loading;
    const generation=++epoch;account=key;ready=false;pending=0;dirty=false;saveFailed=false;active='overview';shell();
    loading=(async()=>{try{await queue;const saved=await storage('readonly',key);if(generation!==epoch)return;state=saved?validate(saved):blank();ready=true;render();}catch{if(generation!==epoch)return;ready=false;$('#o-content').innerHTML='<div class="o-section"><h2>暫時無法讀取計畫</h2><p>請確認瀏覽器允許儲存，原有資料未被改寫。</p><button class="outline-btn" data-action="retry">重新載入</button></div>';notice('無法讀取本機資料，已暫停編輯以保護原有紀錄。');status('儲存服務未就緒');}})();
    return loading;
  }
  window.DYLOdyssey={open:async()=>{await changeAccount(sessionStorage.getItem('dyl-user')||'');await loading;render();window.scrollTo(0,0);},changeAccount};
  shell();
})();
