# 작업 인계 메모 (2026-09-17)

브랜치: `fix/data`. 이 파일은 다음 세션에서 이어서 작업하기 위한 임시 메모입니다.
읽고 나면 지워도 되고, 커밋해도 됩니다(지금은 커밋 안 된 상태).

## 지금 워킹 트리 상태 (커밋 안 된 변경사항 두 갈래가 섞여 있음)

`git status`에 보이는 수정 파일들은 서로 다른 두 작업이 섞인 것입니다:

1. **이슈 #12 (D-Day 문구, 미완성 — 커밋 금지)**: `concept/UniClub_PRD.md`,
   `src/components/DashboardPage.tsx`, `ManualPreview.tsx`, `RoleTodoGroups.tsx`,
   `TaskList.tsx`, `marks.tsx`, `src/lib/types.ts`, `src/lib/board.ts`(daysBefore 부분)
   - 할 일 배지를 "행사 N일 전"으로 표시하도록 만들어둔 초안인데, **사용자가 이
     문구("행사 N일 전")를 확정한 적 없다고 명확히 말함**. 절대 이 상태로
     커밋하지 말 것. 용어를 다시 정하고 나서 진행.
2. **이슈 #13 (같은 학년도 재업로드 병합, 진행 중)**: `src/App.tsx`,
   `src/components/AiParsePage.tsx`, `src/components/ManualImportWizard.tsx`,
   `src/lib/parse-events.ts`
   - 아래 "이슈 #13 진행 상황" 참고.

두 작업이 여러 파일(`board.ts`, `types.ts`)에서 겹쳐 있진 않아서 커밋 시
분리 가능(이슈 #9 커밋할 때도 `git stash`로 D-Day 파일만 잠깐 빼놓고
season 관련 파일만 커밋했음 — 같은 방식 재사용 가능).

## 완료된 것

- **이슈 #9**(학년도별 데이터 분리): 커밋 `6c2fa34`, 완료. `season-{year}`
  키로 분리, "default" 자동 마이그레이션, `SeasonSwitcher` UI, 완료 체크
  학년도별 localStorage 분리. 아직 원격에 푸시 안 함.

## 이슈 #13 진행 상황 — 여기서부터 이어가면 됨

**GitHub 이슈**: https://github.com/softy20/UniClub_MVP/issues/13
**계획 파일**: `C:\Users\user\.claude\plans\playful-tickling-bubble.md` (이
컴퓨터의 Claude Code 플랜 저장소에 있음 — 아래에 핵심만 다시 옮겨둠)

### 문제
같은 학년도에 매뉴얼을 두 번(상반기 계획서 → 2학기에 새 행사 추가) 올리면
두 번째 업로드가 첫 번째를 통째로 덮어씀. AI 업로드 마법사가 기존 저장된
시즌 데이터를 전혀 모른 채 동작하기 때문.

### 설계 원칙 (사용자와 논의해서 확정)
- 기존 행사는 과거든 미래든 **이름/날짜/월/장소를 절대 안 바꾼다**. 재파싱
  결과가 "더 알찬 쪽"이어도 기존 걸 덮어쓰지 않음 (처음엔 `mergePair`
  재사용하려다가, 메뉴얼 원문이 안 바뀐 채 재업로드하면 이미 확정된 날짜가
  옛날 값으로 되돌아갈 위험이 있어서 폐기함).
- 이미 지난 행사(오늘 기준)는 할 일도 안 건드림(재추출 방지).
- 아직 안 지난 행사는 정말 새로 생긴 할 일만 추가(기존 할 일 내용/순서/id
  그대로 — 완료 체크가 안 풀리게).
- 완전히 매칭 안 되는 새 행사(부스 참여 등)는 그대로 추가.

### 구현된 것 (타입체크/빌드 통과 확인함)
- `src/lib/parse-events.ts`: `mergeSeasonEvents(existing, incoming, academicYear, today)`
  새로 추가·export. 기존 `mergeClubEvents`/`mergePair`/`pickTask`는 안 건드림
  (그건 "한 번의 업로드 안에서 조각 합치기" 용도라 그대로 둬도 됨).
- `src/App.tsx`: `<AiParsePage existingData={seasons.length > 0 ? data : null} .../>`
  — 저장된 시즌이 하나도 없을 때(신규 클럽, 데모 시드만 보이는 상태)는
  반드시 `null`을 넘기게 해뒀음(데모 데이터가 실제 데이터에 섞이는 사고 방지).
- `src/components/AiParsePage.tsx`, `ManualImportWizard.tsx`: `existingData`
  prop을 받아서, 파싱 끝나고 미리보기로 넘어가기 직전(`finishParsePreview`
  호출 두 곳)에 `withSeasonMerge()`로 감싸서 병합.

### 🚧 막힌 지점 — 재개 시 제일 먼저 결정할 것

`mergeSeasonEvents`가 "같은 행사인지" 판단할 때 기존 `isSameEvent`(이름
유사도 + 월 근접도) 함수를 그대로 재사용하는데, 여기서 트레이드오프가
발견됨:

- `isSameEvent`는 "이름이 완전히 똑같은데 월이 다르면 다른 행사"로 취급함
  (반복 행사가 여러 달에 걸쳐 나올 때 잘못 합쳐지는 걸 막으려는 기존 설계).
- 그런데 이 프로젝트 사람이 지적한 두 가지 실제 사례:
  1. 이름 같은 **일회성** 행사인데 메뉴얼 원문은 옛날 월(7월)이고 실제
     확정은 다른 월(8월)이면 → 같은 행사로 안 잡히고 중복 행사가 하나 더
     생길 수 있음 (데이터 유실은 없지만 중복 정리가 필요함)
  2. "수영장 훈련"처럼 매주/매달 반복되는 활동은 애초에 월별로 서로 다른
     `ClubEvent`로 파싱될 가능성이 높음 → 만약 "이름만 같으면 같은 행사"로
     느슨하게 바꾸면 서로 다른 달의 반복 행사들이 하나로 합쳐져서
     사라지는, 훨씬 심각한 데이터 손실이 생김

**결론(잠정)**: 2번이 1번보다 훨씬 위험해서, `isSameEvent`를 그대로 두고
1번의 "가끔 중복 생김" 정도는 감수하자는 쪽으로 기울었음. 근데 사용자에게
최종 확답을 받기 직전에 퇴근하게 되어 **아직 승인 안 받음**. 다음 세션
시작할 때 이 트레이드오프를 다시 한번 확인하고 진행할 것.

### 남은 작업
1. 위 트레이드오프 확정
2. (확정되면 코드 변경 불필요 — `isSameEvent` 그대로 씀. 혹시 다른 방향으로
   결정되면 `mergeSeasonEvents`의 매칭 로직만 다시 설계)
3. 검증: `src/lib/` 안에 임시로 `__scratch_merge_test.ts` 만들어서
   `npx esbuild <파일> --bundle --platform=node --format=cjs --outfile=...`
   로 번들 후 `node`로 실행하는 방식으로 순수 함수 검증함(레포에 tsx 등
   테스트 러너가 없어서 이렇게 함). 케이스 1(지난 행사)·3(완전 새 행사)은
   통과, 케이스 2(이름 같고 월 다른 일회성 행사)는 위 트레이드오프 때문에
   의도적으로 실패 상태로 남겨둠 — 결정 후 테스트 기대값도 그에 맞게 고쳐서
   재검증할 것. 끝나면 스크래치 파일은 삭제(커밋 금지, 이미 한 번은 지웠음).
4. `npm run build` 최종 확인 후, 이슈 #13 관련 파일만 골라서 커밋
   (`src/lib/parse-events.ts`, `src/App.tsx`, `src/components/AiParsePage.tsx`,
   `src/components/ManualImportWizard.tsx` — D-Day 관련 파일은 계속 커밋 제외)
5. 이슈 본문의 "(선택)" 항목(미리보기에 신규/병합/유지 배지 표시)은 이번
   패스에서 일부러 안 함 — 필요하면 별도로 진행

## 실제 LLM 호출이 필요한 부분은 검증 못 함

`parse-manual-with-profile` 종단 흐름(실제 문서 업로드 → AI 파싱 → 미리보기)은
이 환경에 헤드리스 브라우저가 없어서 브라우저로 직접 확인 못 했음. 로직
단위 검증(위 esbuild 스크립트)과 타입체크/빌드까지만 했다는 점 감안할 것.

## 아직 안 한 것 (참고)

- 이슈 #12 D-Day 문구 확정 후 커밋
- 이슈 #13 마무리(위 내용)
- 브랜치 푸시/PR — 사용자가 GitHub 쪽은 직접 리뷰/머지하고 싶어함, 커밋만
  대신 해주는 흐름으로 진행 중
