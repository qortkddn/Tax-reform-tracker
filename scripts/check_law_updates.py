"""공공데이터포털 '법제처 국가법령정보 공유서비스'(법령정보 목록 조회)로 시뮬레이터가 쓰는 법령의
공포일자·시행일자를 확인하고, 지난번 기록(data/law_meta.json)과 달라졌으면 개정으로 감지합니다.

실행: LAW_KEY=<공공데이터포털 일반 인증키(Decoding)> python3 scripts/check_law_updates.py
- 개정이 감지되면 data/law_changes.md에 내용을 쓰고 종료코드 2로 끝나요 (GitHub Actions에서 실패 표시 → 메일 알림).
"""
import json, os, sys, urllib.parse, urllib.request, xml.etree.ElementTree as ET, datetime

END = "https://apis.data.go.kr/1170000/law/lawSearchList.do"
LAWS = ["소득세법", "소득세법 시행령", "법인세법", "법인세법 시행령", "조세특례제한법", "조세특례제한법 시행령",
        "부가가치세법", "종합부동산세법", "지방세법", "지방세특례제한법"]
KEEP = ["법령명한글", "법령ID", "법령일련번호", "공포일자", "공포번호", "시행일자", "제개정구분명", "현행연혁코드"]
META = "data/law_meta.json"

def search(key, name):
    q = urllib.parse.urlencode({"serviceKey": key, "target": "law", "query": name, "numOfRows": 100, "pageNo": 1})
    with urllib.request.urlopen(f"{END}?{q}", timeout=30) as r:
        raw = r.read().decode("utf-8")
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        sys.exit(f"응답을 읽지 못했어요 ({name}): {raw[:300]}")
    hits = []
    for el in root.iter():
        kids = {c.tag: (c.text or "").strip() for c in el}
        if kids.get("법령명한글") == name:
            hits.append({k: kids.get(k, "") for k in KEEP})
    if not hits:
        sys.exit(f"'{name}'을 찾지 못했어요. 응답 앞부분: {raw[:300]}")
    cur = [h for h in hits if h.get("현행연혁코드") in ("현행", "")] or hits
    return max(cur, key=lambda h: h.get("공포일자", ""))

def main():
    key = os.environ.get("LAW_KEY")
    if not key:
        sys.exit("LAW_KEY 환경변수가 없어요. 공공데이터포털 일반 인증키(Decoding)를 넣어 주세요.")
    old = json.load(open(META, encoding="utf-8")) if os.path.exists(META) else {}
    new, changes = {}, []
    for name in LAWS:
        h = search(key, name); new[name] = h
        o = old.get(name)
        if o and (o.get("공포일자"), o.get("시행일자")) != (h.get("공포일자"), h.get("시행일자")):
            changes.append(f"- **{name}**: 공포 {o.get('공포일자')} → {h.get('공포일자')} ({h.get('제개정구분명')}), 시행 {o.get('시행일자')} → {h.get('시행일자')}")
        print(name, "공포", h.get("공포일자"), "시행", h.get("시행일자"), h.get("제개정구분명"))
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(timespec="minutes")
    json.dump({**new, "_meta": {"checked": now, "source": "공공데이터포털 법제처 국가법령정보 공유서비스"}}, open(META, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if changes:
        open("data/law_changes.md", "w", encoding="utf-8").write(f"# 법령 개정 감지 ({now})\n\n" + "\n".join(changes) + "\n\n시뮬레이터 계산에 영향이 있는지 확인하세요.\n")
        print("\n".join(changes)); sys.exit(2)
    print("변경 없음" if old else "첫 기록 저장")

if __name__ == "__main__":
    main()
