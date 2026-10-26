// 계산 결과 검산 테스트: 손으로 검산한 예시의 세액이 바뀌지 않았는지 확인합니다.
// 실행: NODE_PATH=$(npm root -g) node tests/calc.test.js
const {chromium}=require('playwright');const path=require('path');
const CASES=[
 // [이름, 계산식(브라우저에서 실행), 기대값(만원 또는 원), 허용오차]
 ['종소세 산출세액: 과세표준 3,500만원','prog(3500)',399,0.01],
 ['종소세 산출세액: 과세표준 3,200만원','prog(3200)',354,0.01],
 ['근로장려금 홑벌이 총소득 3,000만원 (현행)','eitcRaw("one",3000,false)[0]',31.6667,0.01],
 ['근로장려금 홑벌이 총소득 3,000만원 (정부안)','eitcRaw("one",3000,true)[0]',94.3478,0.01],
 ['근로장려금 맞벌이 총소득 3,000만원 (현행)','eitcRaw("two",3000,false)[0]',171.1111,0.01],
 ['근로장려금 맞벌이 총소득 5,000만원 (현행: 대상 아님)','eitcRaw("two",5000,false)[0]',0,0],
 ['코인: 5,000만원에 팔고 취득가 2,000만원','coin({sell:"5000",buy:"2000",fmv:"",cost:""}).tax',605,0.01],
 ['코인: 취득가 모름 (판 금액 50% 인정)','coin({sell:"5000",buy:"",fmv:"",cost:""}).tax',495,0.01],
 ['취득세: 9억원 1주택 생애최초 45세','acq(HH({}),false).tot',2770,0.01],
 ['취득세: 9억원 2주택 조정대상지역 (8% 중과)','acq(HH({cnt:"2",adj:true,first:false}),false).tot',7560,0.01],
 ['재산세: 공시가격 15억원 1주택','prop(150000,true).tot',248.4,0.01],
 ['종부세 2028년: 15억원 1주택 실거주 (현행)','comp(HH({}),2028,false).tot',41.472,0.01],
 ['종부세 2028년: 15억원 1주택 실거주 (정부안)','comp(HH({}),2028,true).tot',21.504,0.01],
 ['종부세 2028년: 2주택 합계 20억원 조정 (현행)','comp(HH({cnt:"2",other:"50000",adj:true}),2028,false).tot',313.92,0.01],
 ['종부세 2028년: 2주택 합계 20억원 조정 (정부안)','comp(HH({cnt:"2",other:"50000",adj:true}),2028,true).tot',742.56,0.01],
 ['양도세: 20억원 1주택 12년 보유·6년 거주 (현행)','cgCalc(CP({}),CUR).tax',4744.564,0.01],
 ['양도세: 같은 집 2029년 양도 (정부안)','cgCalc(CP({}),GOV,"2029").tax',7874.548,0.01],
 ['양도세: 2주택 조정대상지역 2027년 (현행 +20%p)','cgCalc(CP({cnt:"2",adj:true,one:false}),CUR,"2027").tax',76222.85,0.01],
 ['양도세: 2주택 조정대상지역 2027년 (정부안 +5%p)','cgCalc(CP({cnt:"2",adj:true,one:false}),GOV,"2027").tax',56959.1,0.01],
 ['양도세: 미등기 70%','cgCalc(CP({reg:"n"}),CUR).tax',90090,0.01],
 ['장특공제율: 비조정 다주택 12년 보유·6년 거주 (현행)','cgCalc(CP({cnt:"2",one:false}),CUR).rate',0.24,0.0001],
 ['장특공제율: 같은 집 2028년 (정부안: 보유 1%·거주 2% 중 큰 쪽)','cgCalc(CP({cnt:"2",one:false}),only("lt","Y"),"2028").rate',0.12,0.0001],
 ['법인세 산출세액: 과세표준 10억원','ktax(100000)',18000,0.01],
 ['최저한세: 중견·일반 과세표준 150억원','kmin(1500000,"big")',160000,0.01],
 ['법인세 통합: 과세표준 9.64억, 공제 8,450만원 → 최저한세에 걸림','kCalc({k:{tb:"96400",size:"big"}},0,5200,3250).tot',11368,0.01],
 ['법인세 통합: 중소기업은 R&D 공제가 최저한세 제외','kCalc({k:{tb:"96400",size:"sme"}},0,5200,3250).tot',10558,0.01],
 ['주주: 회사에 판 주식 2억 차익 (현행 양도세 10%)','shTax({sell:"30000",buy:"10000",fin:"500",pur:"other",co:"sme",big:false},false,3500).tax',2172.5,0.01],
 ['주주: 같은 거래 정부안 (의제배당 종합과세)','shTax({sell:"30000",buy:"10000",fin:"500",pur:"other",co:"sme",big:false},true,3500).tax',6794.7,0.01],
 ['주주: 같은 거래가 양도소득세 탭에서 빠지는 금액','shCg({sell:"30000",buy:"10000",fin:"500",pur:"other",co:"sme",big:false})',2172.5,0.01],
 ['주주: 이익소각이면 지금도 배당소득 (양도세 0)','shCg({sell:"30000",buy:"10000",fin:"500",pur:"cancel",co:"sme",big:false})',0,0],
 ['주주: 이익소각 의제배당 (Gross-up 11%, 2027년 지급분부터)','shDiv({sell:"30000",buy:"10000",fin:"500",pur:"cancel",co:"sme",big:false},true,3500)',5406.83,0.01],
 ['창업감면: 기타 비수도권 일반 중소기업 (현행 50%)','suCalc({k:{tb:"100000",coef:1.3}},{type:"sme",dense:false},false).tot',9900,0.01],
 ['창업감면: 같은 기업 정부안 (60%)','suCalc({k:{tb:"100000",coef:1.3}},{type:"sme",dense:false},true).tot',7920,0.01],
];
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../index.html'));
 await p.evaluate(()=>{
  window.HH=o=>Object.assign({kind:"house",buy:"90000",pub:"150000",sell:"200000",y:"2029",age:"45",hold:"12",live:"6",res:true,first:true,big:false,cnt:"1",other:"",adj:false},o);
  window.CP=o=>({c:Object.assign({sell:"200000",buy:"80000",exp:"3000",y:"2029",hold:"12",live:"6",cnt:"1",reg:"y",adj:false,one:true,sen:false},o)});
 });
 let fail=0;for(const [name,expr,want,tol] of CASES){const got=await p.evaluate(e=>eval(e),expr);const ok=Math.abs(got-want)<=tol;if(!ok)fail++;console.log((ok?'PASS':'FAIL')+'  '+name+'  기대 '+want+' / 결과 '+(Math.round(got*10000)/10000))}
 if(errs.length){fail++;console.log('JS ERR',errs)}
 await b.close();console.log(fail?`${fail} FAIL`:`ALL PASS (${CASES.length}건)`);process.exit(fail?1:0)})();
