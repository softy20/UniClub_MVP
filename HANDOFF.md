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

### ✅ 막힌 지점 — 해결함 (2026-09-18)

기존 `isSameEvent`를 그대로 두고 "가끔 중복 생김"을 감수하자는 잠정 결론
대신, 자동으로 판단하기 애매한 두 경우를 **사람에게 버튼으로 물어보는
확인 단계**를 추가하는 쪽으로 결정함 (사용자가 직접 UX안을 제시함):

1. 이름 같은 일회성 행사인데 파일 원문 월과 기존 저장된 월이 다른 경우
   → "파일엔 X월로 되어 있는데 저장된 일정엔 Y월로 되어 있어요. 행사
   일정이 변경된 건가요?" + 버튼 3개(네, Y월로 변경되었어요 / 아니요, 다른
   행사예요 / 기타)
2. "수영장 훈련"처럼 매주/매달 반복되는 활동은 이름+월이 같아도 자동으로
   안 합치고, 같은 달에 이미 같은 이름의 일정이 있을 때만 "이미 X월에 N개
   일정이 있어요. 추가할까요?"로 확인. 다른 달이면 확인 없이 그대로
   추가(반복 일정은 여러 달에 걸쳐 있는 게 정상이라서).
   - **주의**: 처음엔 "카테고리 라벨에 '정기'가 들어있으면 반복 일정"으로
     판단하려 했는데, 사용자가 스쿠버 동아리의 OW/AOW 같은 반례를 지적함
     ("정기"라는 말이 전혀 안 들어간 분류명도 반복 활동일 수 있음). 그래서
     카테고리 텍스트 대신, **이미 저장된 일정 안에서 같은 핵심 이름이 서로
     다른 달에 2번 이상 나온 적이 있으면 반복 일정으로 판단**하는 구조적
     방식으로 바꿈(`isRecurringEventName`, 카테고리 무관). 처음 한 번만
     있었던 이름은 아직 반복 여부를 모르니 1번의 month_mismatch 질문으로
     확인받고, "다른 행사예요"라고 답하면 그 순간 달이 2개가 되어 다음
     업로드부터는 자동으로 반복 일정으로 인식됨(질문 없이 skip 처리).

**구현 완료** (`src/lib/parse-events.ts`, `src/components/ManualImportWizard.tsx`):
- `planSeasonMerge(existing, incoming, year, today)`: 자동으로 확정된
  `autoEvents`와, 사람 확인이 필요한 `questions`(월 불일치/반복 일정 중복)
  를 함께 반환.
- `resolveSeasonMerge(plan, answers, year, today)`: 답변을 반영해 최종
  행사 목록을 만듦. 답이 없는 질문은 안전한 기본값(따로 추가/그대로 추가)
  으로 처리 — 데이터 유실보다 중복을 택함.
- `mergeSeasonEvents(...)`는 내부적으로 `planSeasonMerge` +
  `resolveSeasonMerge(빈 답변)`으로 재구현(질문 없이 바로 합쳐야 하는 다른
  호출부와의 하위 호환 유지).
- `ManualImportWizard`에 새 단계 `"merge-review"` 추가: 파싱이 끝난 뒤
  `beginSeasonMerge()`가 `planSeasonMerge`를 돌려서 질문이 없으면 바로
  미리보기로, 있으면 질문 카드(clarifying 단계와 같은 스타일)를 하나씩
  보여주고 답변을 다 받으면 `resolveSeasonMerge`로 확정한 뒤 미리보기로
  넘어감.
- "기타" 버튼은 텍스트를 입력받지만, 구조화된 데이터로 반영할 곳이 없어서
  기능적으로는 "다른 행사예요"와 동일하게 처리함(안전한 기본값). 나중에
  이 텍스트를 실제로 활용하고 싶으면(예: AI에게 다시 보내 재확인) 별도
  설계 필요.

**검증**: `src/lib/` 안에 임시 `__scratch_merge_test.ts`를 만들어
`npx esbuild <파일> --bundle --platform=node --format=cjs --outfile=...`
후 `node`로 실행하는 방식으로 케이스(월 불일치 same_event/different_event,
"정기"라는 말이 전혀 없는 카테고리(OW/AOW)로 반복 일정 감지 + 같은 달
add/skip, 반복 일정의 새 달 자동 추가, 완전히 새로운 행사 자동 추가) 모두
통과 확인. 스크래치 파일은 검증 후 삭제함(커밋 안 됨). `npx tsc --noEmit`과
`npm run build` 모두 통과.

### 남은 작업
1. 브라우저에서 실제 흐름(매뉴얼 두 번 업로드 → merge-review 질문 카드
   등장 → 답변 → 미리보기) 육안 확인 — 이 환경엔 헤드리스 브라우저가 없어서
   아직 못 함.
2. 이슈 본문의 "(선택)" 항목(미리보기에 신규/병합/유지 배지 표시)은 이번
   패스에서 일부러 안 함 — 필요하면 별도로 진행.
3. `npm run build` 최종 확인 후, 이슈 #13 관련 파일만 골라서 커밋
   (`src/lib/parse-events.ts`, `src/components/ManualImportWizard.tsx` —
   D-Day 관련 파일은 이번 세션에서 건드리지 않음).

## 실제 LLM 호출이 필요한 부분은 검증 못 함

`parse-manual-with-profile` 종단 흐름(실제 문서 업로드 → AI 파싱 → 미리보기)은
이 환경에 헤드리스 브라우저가 없어서 브라우저로 직접 확인 못 했음. 로직
단위 검증(위 esbuild 스크립트)과 타입체크/빌드까지만 했다는 점 감안할 것.

## 아직 안 한 것 (참고)

- 이슈 #12 D-Day 문구 확정 후 커밋
- 이슈 #13 마무리(위 내용)
- 브랜치 푸시/PR — 사용자가 GitHub 쪽은 직접 리뷰/머지하고 싶어함, 커밋만
  대신 해주는 흐름으로 진행 중
