"""시뮬레이터 계산에 쓰는 조문을 국가법령정보 공동활용 Open API(법제처)로 수집해 data/laws.json에 저장합니다.

실행: LAW_OC=<법제처 Open API 인증 ID> python3 scripts/fetch_laws.py
- 인증 ID(OC)는 open.law.go.kr에서 활용 신청 후 발급받아요. 코드나 저장소에 직접 적지 말고 환경변수(GitHub Secret)로만 넘겨요.
- 응답 구조가 바뀌어도 동작하도록, 조문 응답의 모든 문자열을 모아 하나의 텍스트로 저장해요.
"""
import json, os, sys, urllib.parse, urllib.request, datetime

# key: 검사 이름 / law: 법령명 / jo: 조 번호 / what: 이 조문으로 확인하는 것
ARTICLES = [
    {"key": "inc55",  "law": "소득세법",         "jo": 55,  "what": "종합소득세 기본세율 (6~45%)"},
    {"key": "inc17",  "law": "소득세법",         "jo": 17,  "what": "배당가산율 (Gross-up)"},
    {"key": "corp55", "law": "법인세법",         "jo": 55,  "what": "법인세율 (10·20·22·25%)"},
    {"key": "sp132",  "law": "조세특례제한법",   "jo": 132, "what": "최저한세율 (중소 7%, 일반 10·12·17%)"},
    {"key": "sp127",  "law": "조세특례제한법",   "jo": 127, "what": "중복지원 배제 (창업감면 ↔ 통합투자세액공제)"},
    {"key": "sp6",    "law": "조세특례제한법",   "jo": 6,   "what": "창업중소기업 세액감면율"},
]
BASE = "https://www.law.go.kr/DRF"

def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

def texts(o):
    """JSON 안의 모든 문자열을 순서대로 모음"""
    if isinstance(o, str): yield o
    elif isinstance(o, dict):
        for v in o.values(): yield from texts(v)
    elif isinstance(o, list):
        for v in o: yield from texts(v)

def mst(oc, name):
    q = urllib.parse.urlencode({"OC": oc, "target": "law", "type": "JSON", "query": name})
    laws = get(f"{BASE}/lawSearch.do?{q}")["LawSearch"]["law"]
    laws = laws if isinstance(laws, list) else [laws]
    hit = next(l for l in laws if l.get("법령명한글") == name)  # 현행 법령
    return hit["법령일련번호"]

def main():
    oc = os.environ.get("LAW_OC")
    if not oc:
        sys.exit("LAW_OC 환경변수가 없어요. 법제처 Open API 인증 ID를 넣어 주세요.")
    out, cache = {}, {}
    for a in ARTICLES:
        m = cache.get(a["law"]) or mst(oc, a["law"]); cache[a["law"]] = m
        q = urllib.parse.urlencode({"OC": oc, "target": "law", "type": "JSON", "MST": m, "JO": f"{a['jo']:04d}00"})
        body = get(f"{BASE}/lawService.do?{q}")
        out[a["key"]] = {**a, "mst": m, "text": "\n".join(t for t in texts(body) if t.strip())}
        print("수집", a["law"], f"제{a['jo']}조", len(out[a["key"]]["text"]), "자")
    out["_meta"] = {"fetched": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(timespec="minutes"), "source": "법제처 국가법령정보 공동활용 Open API"}
    with open("data/laws.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
