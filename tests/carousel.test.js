// 각 세목의 카드 넘기기에서 상단 칩·번호가 실제로 보이는 카드와 일치하는지, 카드 영역 높이가 현재 카드에 맞는지 검사합니다.
// 실행: NODE_PATH=$(npm root -g) node tests/carousel.test.js
const {chromium,devices}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();let fail=0;
for(const dev of [{viewport:{width:390,height:844},hasTouch:true,isMobile:true},{viewport:{width:1280,height:900}}]){
 const p=await b.newPage(dev);const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../index.html'));await p.click('#demo');
 for(const s of ['home','vat','inc','coin','cg']){await p.click('#st-'+s);const sec=p.locator('#sec-'+s);const n=await sec.locator('.cards > .card').count();if(!n)continue;
  const check=async(how,k)=>{await p.waitForTimeout(700);const r=await sec.evaluate(el=>{const box=el.querySelector('.cards'),L=box.getBoundingClientRect().left;let best=0,bd=1e9;[...box.children].forEach((c,j)=>{const d=Math.abs(c.getBoundingClientRect().left-L);if(d<bd){bd=d;best=j}});return{vis:box.children[best].querySelector('h3').textContent,chip:el.querySelector('.chips [aria-current="true"]').textContent,cnt:el.querySelector('.cnt').textContent,best,hdiff:Math.abs(box.getBoundingClientRect().height-box.children[best].getBoundingClientRect().height)}});
   const ok=r.vis===r.chip&&r.cnt===(r.best+1)+' / '+n&&(k==null||r.best===k)&&r.hdiff<=2;if(!ok){fail++;console.log('FAIL',dev.viewport.width,s,how,k,r)}};
  for(let k=1;k<n;k++){await sec.locator('.arr').nth(1).click();await check('next',k)}
  if(!(await sec.locator('.arr').nth(1).isDisabled())){fail++;console.log('FAIL next not disabled at end',s)}
  for(let k=n-2;k>=0;k--){await sec.locator('.arr').nth(0).click();await check('prev',k)}
  for(let k=n-1;k>=0;k--){await sec.locator('.chips button').nth(k).click();await check('chip',k)}
  for(let k=0;k<n;k++){await sec.evaluate((el,k)=>{const box=el.querySelector('.cards');box.scrollLeft=box.children[k].offsetLeft-box.children[0].offsetLeft},k);await check('swipe',k)}
 }
 if(errs.length){fail++;console.log('JS ERR',errs)}await p.close()}
await b.close();console.log(fail?`${fail} FAIL`:'ALL PASS');process.exit(fail?1:0)})();
