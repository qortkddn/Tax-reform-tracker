// 법령 대조 테스트 (데이터마이닝): data/laws.json의 조문 원문에서 세율을 뽑아, 시뮬레이터 계산에 들어간 숫자와 같은지 확인합니다.
// 조문이 개정되면 이 테스트가 실패해서, 계산 코드를 고쳐야 한다는 것을 바로 알 수 있어요.
// 실행: NODE_PATH=$(npm root -g) node tests/law.test.js   (조문 수집: scripts/fetch_laws.py)
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const f=path.resolve(__dirname,'../data/laws.json');
if(!fs.existsSync(f)){console.log('SKIP 조문 데이터가 아직 없어요 (인증키 발급 후 scripts/fetch_laws.py로 수집)');process.exit(0)}
const L=JSON.parse(fs.readFileSync(f,'utf8'));
// 조문에서 비율 뽑기: "6퍼센트", "100분의 11" 같은 표현을 모두 숫자로
function rates(t){const s=new Set();for(const m of t.matchAll(/(\d+(?:\.\d+)?)\s*퍼센트|100분의\s*(\d+(?:\.\d+)?)/g))s.add(+(m[1]||m[2]));return s}
// 조문에서 금액 구간 뽑기: "1,400만원", "2억원", "3천억원" → 만원 단위
// "1억5천만원"처럼 단위가 섞인 표현도 처리
function amounts(t){const s=new Set(),n=x=>x?+x.replace(/,/g,''):0;for(const m of t.replace(/(억|천|만)\s+(?=\d|원)/g,'$1').replace(/(\d)\s+(?=억|천|만|원)/g,'$1').matchAll(/(?:(\d[\d,]*)천억)?(?:(\d[\d,]*)억)?(?:(\d[\d,]*)천만)?(?:(\d[\d,]*)만)?원/g)){if(m[0]=='원')continue;s.add(n(m[1])*1e7+n(m[2])*1e4+n(m[3])*1e3+n(m[4]))}return s}
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('file://'+path.resolve(__dirname,'../index.html'));
 const C=await p.evaluate(()=>({br:BR.map(r=>Math.round(r[1]*100)),brAmt:BR.slice(0,-1).map(r=>r[0]),kbr:KBR.map(r=>Math.round(r[1]*100)),kbrAmt:KBR.slice(0,-1).map(r=>r[0]),mt:[MTR.sme,...MTR.big].map(x=>Math.round(x*100)),gu:Math.round(GU*100)}));
 await b.close();
 const checks=[
  ['inc55','종합소득세 기본세율',rates,C.br],['inc55','종합소득세 과세표준 구간',amounts,C.brAmt],
  ['corp55','법인세율',rates,C.kbr],['corp55','법인세 과세표준 구간',amounts,C.kbrAmt],
  ['sp132','최저한세율',rates,C.mt],['inc17','배당가산율 (Gross-up)',rates,[C.gu]],
 ];
 let fail=0;for(const [k,name,fn,want] of checks){if(!L[k]){console.log('SKIP',name,'(조문 없음)');continue}
  const got=fn(L[k].text),miss=want.filter(x=>!got.has(x));
  if(miss.length){fail++;console.log('FAIL',name,'— 계산에 쓴 값',miss.join(', '),'이(가) '+L[k].law+' 제'+L[k].jo+'조에 없어요. 조문이 개정됐는지 확인하세요.')}else console.log('PASS',name,want.join(', '))}
 console.log(fail?`${fail} FAIL`:`ALL PASS (조문 수집일 ${L._meta&&L._meta.fetched})`);process.exit(fail?1:0)})();
