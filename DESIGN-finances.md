# 동아리 장부 시스템 설계 (회계 파트)

## 1. 배경 및 목표

기존에는 Notion 데이터시트로 지출 내역을 필터링용으로만 관리해왔음. 문제점:
- 항목을 지나치게 잘게 쪼개 정리함 (예: 20개 구매 시 20행으로 분리)
- 행사(MT, 스승의날, 부스, 면접 등)별로 "지난번엔 뭘 샀었는지" 한눈에 찾아보기 어려움
- 영수증/사진 등 파일은 Google Drive에 흩어져 있고, 동아리 자료(강의자료, 훈련계획서 등)도 전부 Drive에 보관 중

**목표**: Notion을 대체할 자체 웹사이트를 만들되,
1. 장부는 구조화된 DB(Supabase)에 넣어 필터/집계/행사별 조회를 쉽게 하고,
2. 파일 저장소는 계속 Google Drive를 사용 (이미 동아리 전체 자료가 여기 있으므로 이원화하지 않음),
3. 임원/부원 역할에 따라 입력·열람 권한을 구분하고,
4. Google/Kakao 계정으로 로그인 가능하게 하며,
5. 지금은 우리 동아리 전용으로 만들지만, **나중에 다른 동아리도 같은 시스템을 각자 계정으로 로그인해 독립적으로 쓸 수 있도록(멀티테넌시)** 처음부터 구조를 잡음

---

## 2. 아키텍처 개요

```
[웹 프론트엔드 (장부 UI)]
   │
   ├── Supabase Auth (Google + Kakao 로그인)
   │       └─ 로그인한 사용자 → members 테이블에서 club_id 조회
   │
   ├── Supabase DB (Postgres)          ← 지출 레코드, 카테고리/행사 마스터, 회원/역할
   │       모든 테이블에 club_id 존재, RLS가 "로그인한 사람의 club_id와
   │       일치하는 행만" + "permission=write인 사람만 입력 가능" 두 조건을 동시에 강제
   │
   └── 파일 첨부 시 → Supabase Edge Function
                           │ (해당 동아리의 Google 계정 자격으로 인증)
                           ▼
                    Google Drive API 업로드
                           │
                           ▼
                    업로드된 파일 링크 → expenses.proof_links 에 저장
```

핵심 원칙: **구조화된 데이터(언제/얼마/무엇/어떤 행사)는 Supabase, 파일 원본은 Drive**. 사이트 로그인 신원(Google/Kakao)과 "Drive에 실제로 파일을 쓰는 신원"을 분리해서, 로그인 수단에 상관없이 항상 해당 동아리 계정 권한으로 업로드되게 함 (5장 참고). 그리고 "어느 동아리 소속인지"와 "쓰기 권한이 있는지"를 완전히 분리해서, 하나의 시스템을 여러 동아리가 각자 데이터가 섞이지 않게 같이 쓸 수 있게 함 (아래 club_id).

---

## 3. 데이터 모델

### 3.1 `clubs` (동아리) — 멀티테넌시 기준 테이블

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | 동아리 고유 식별자 |
| name | text | 동아리 이름 |
| created_at | timestamptz | |

다른 모든 테이블은 이 테이블의 `id`를 `club_id`로 참조함. 지금은 우리 동아리 1행만 존재하지만, 나중에 다른 동아리가 들어오면 여기 한 행만 추가하면 됨 — 스키마 변경 없이 확장 가능.

### 3.2 `expenses` (지출 내역) — 핵심 테이블

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | 고유 식별자 |
| club_id | uuid (FK → clubs) | 이 지출이 속한 동아리 |
| date | date | 결제일 |
| category_id | uuid (FK → categories) | 분류, 단일 선택 |
| event_ids | uuid[] (FK → events) | 행사 태그, 다중 선택 (한 지출이 여러 행사에 걸칠 수 있음) |
| item | text | 사용처+개수 통합 (예: "다이버 크림 10개") |
| amount | numeric | 금액 (원) |
| proof_links | text[] | Google Drive 증빙 파일 링크 (자동 업로드 결과, 여러 개 가능) |
| purchase_link | text | 온라인 구매처 링크 (선택) |
| memo | text | 비고/상세 사유 |
| created_by | uuid (FK → members) | 작성한 임원 — 감사 추적(누가 등록했는지)용 |
| created_at | timestamptz | 등록 시각 — 정렬/추적용, `date`(결제일)와는 별개 |

기존 Notion 컬럼(태그, 사용처, 개수, 상세, 비용, 결제일, 링크, 영수증, 사진) 9개를 위 스키마로 통합·축소함.

### 3.3 `categories`, `events` — 색상 포함 마스터 목록

Notion의 "다중 선택 속성 색상 지정"과 동일한 경험을 위해, 분류/행사 값을 자유 텍스트가 아니라 **별도 테이블 + 색상 필드**로 관리:

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| club_id | uuid (FK → clubs) | 이 태그가 속한 동아리 (동아리마다 서로 다른 카테고리/행사 목록을 가짐) |
| name | text | 표시 이름 (예: "쇼핑", "MT") |
| color | text | 태그 배지 색상 (hex 코드, 예: `#FDE68A`) |
| sort_order | int | 목록 내 표시 순서 |

`categories`, `events` 둘 다 같은 구조로 별도 테이블 운영. **임원 전용 "목록 관리" 화면**에서 이 두 테이블의 행을 추가/수정/삭제 가능하게 함 (새 행사가 생기면 여기서 태그를 하나 만들고 색을 지정) — 코드 수정 없이 운영 가능.

### 3.4 `budgets` (예산)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | |
| club_id | uuid (FK → clubs) | |
| year | int | 회계연도 |
| starting_amount | numeric | 시작 지원금 (예: 907,000원) |
| note | text | 비고 |

잔액은 `starting_amount - SUM(expenses.amount WHERE club_id = ...)`로 실시간 계산 (별도 저장 안 함).

### 3.5 `members` (회원/역할)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK, = auth.users.id) | Supabase Auth 사용자와 1:1 매핑 |
| club_id | uuid (FK → clubs) | 이 사람이 소속된 동아리 — 로그인 후 이 값을 조회해서 나머지 모든 필터링의 기준으로 씀 |
| name | text | 이름 |
| role | text | 세부 직책 (회장 / 부회장 / 총무 / 기타 임원 직책명 / 부원 등, 자유롭게 추가 가능) |
| permission | text | `write` 또는 `read` — 실제 권한은 이 값 하나로 판정 |
| login_provider | text | google / kakao (참고용) |
| created_at | timestamptz | |

**역할(role)은 여러 개 있어도 되지만 권한(permission)은 write/read 두 단계로만 단순화** — 회장·부회장·총무 및 그 외 임원 직책은 모두 `permission = 'write'`, 부원은 `read`로 설정. 새 임원 직책이 생겨도 역할 이름만 추가하고 permission만 write로 지정하면 됨. 신규 로그인 사용자는 기본적으로 `members`에 없거나 `permission = 'read'` 상태로 시작하고, 회장(혹은 지정된 관리자)이 "임원 관리" 화면에서 role/permission을 부여하는 승인 절차를 둠.

**RLS 정책 예시** (모든 테이블에 공통 적용):
- 조회(SELECT): `club_id = (로그인한 사용자의 members.club_id)` 인 행만
- 입력/수정/삭제(INSERT/UPDATE/DELETE): 위 조건 + `permission = 'write'`인 사용자만

---

## 4. 핵심 기능

1. **전체 장부 테이블** — 정렬/필터(분류, 행사, 날짜 범위, 금액 범위)/검색, 인라인 편집, 카테고리·행사 배지에 지정된 색상 표시
   - `item`, `memo`처럼 길어질 수 있는 텍스트 컬럼은 기본 행/열 높이를 고정하고 넘치는 부분은 말줄임(`...`) 처리
   - 셀을 클릭하면 팝업(또는 토글로 행이 펼쳐지는 방식)으로 전체 텍스트를 보여줌 — Tabulator.js는 커스텀 포매터로 이 동작을 기본 지원
2. **입력/수정 폼** — 새 지출 등록, 파일 첨부 시 자동으로 Google Drive에 업로드 (5장)
3. **행사별 보기** — 행사 태그 선택 → 해당 행사의 과거 지출만 필터링 + 자동 합계 (신규 지출 계획 시 참고용)
4. **요약 대시보드** — 시작 예산 대비 잔액, 분류별·행사별 지출 비중 차트
5. **증빙 갤러리** — `proof_links`만 모아 썸네일로 보기
6. **목록 관리 화면** (임원 전용) — 카테고리/행사 항목 추가·수정·삭제, 색상 지정
7. **임원 관리 화면** (회장 전용 권장) — 회원별 role/permission 부여·수정
8. **권한 제어** — 같은 club_id 내에서만, `permission = 'write'`인 사용자만 입력/수정/삭제 가능
9. **소셜 로그인** — Google, Kakao 계정으로 로그인

---

## 5. Google Drive 자동 업로드 방식

**문제**: 로그인은 Google 또는 Kakao로 다양하게 하는데, Kakao로 로그인한 사용자는 Google Drive에 접근할 자기 명의의 OAuth 토큰이 없음. 반면 Drive 폴더에는 이미 "동아리 통합 계정"이 소유자이고 임원들이 편집자로 초대되어 있음.

**해결**: 사이트 로그인 신원과 Drive 업로드 신원을 분리한다.

1. 최초 설정 시 1회만, 동아리 통합 Google 계정으로 로그인해 Drive 업로드 권한(OAuth refresh token)을 발급받아 **서버(Supabase Edge Function)의 비밀 환경변수로만 저장** (프론트엔드에는 절대 노출 안 함)
2. 사용자가 사이트에서 로그인 수단(Google이든 Kakao든)에 상관없이 지출 등록 폼에서 파일을 첨부하면, 파일이 Edge Function으로 전송됨
3. Edge Function이 `club_id`를 보고 해당 동아리의 Drive 자격 증명으로 Google Drive API를 호출해 지정 폴더(예: `/동아리 자료/영수증/2024/`)에 업로드
4. 업로드된 파일의 공유 링크를 반환받아 `expenses.proof_links`에 저장

여러 동아리를 지원하게 되면, 동아리마다 다른 Drive 계정/폴더를 쓸 수 있으므로 이 자격 증명도 `club_id`별로 구분해서 저장해야 함 (예: `club_drive_credentials` 테이블에 club_id별 refresh token 보관).

---

## 6. 기술 스택 제안

| 영역 | 선택 | 이유 |
|---|---|---|
| 인증 | Supabase Auth (Google + Kakao 프로바이더) | 소셜 로그인 내장 지원, Kakao는 커스텀 OIDC 프로바이더로 연결 |
| DB | Supabase (Postgres + RLS) | club_id + 역할 기반 권한을 RLS로 동시에 강제 |
| 파일 업로드 중계 | Supabase Edge Function | 동아리별 Google 계정 자격 증명을 안전하게 서버 측에만 보관 |
| 파일 저장 | Google Drive (기존 그대로, 동아리별 계정/폴더) | 동아리 전체 자료와 통합 관리 |
| 프론트 테이블 UI | Tabulator.js (또는 AG Grid Community) | 정렬/필터/그룹핑 + 색상 배지 렌더링 커스터마이즈 용이 |
| 배포 | Vercel / Netlify | 정적 프론트엔드 + Supabase 클라이언트 SDK |

---

## 7. 기존 데이터 마이그레이션

Notion → Supabase로 옮길 때 컬럼 매핑 (모두 우리 동아리의 `club_id` 하나로 고정):

| Notion 컬럼 | Supabase 컬럼 | 비고 |
|---|---|---|
| 태그 | category_id | `categories` 테이블 생성 후 매핑 |
| 사용처 + 개수 + 상세 | item | 텍스트로 통합 |
| 비용 | amount | 그대로 |
| 결제일 | date | 그대로 |
| 링크 | purchase_link | 그대로 |
| 구매 영수증 및 거래 명세서, 사진 | proof_links | 배열로 통합, Drive 링크로 변환 |
| (없음) | event_ids | **신규 — 기존 항목은 상세 텍스트 보고 수동으로 태깅 필요** (예: "면접 진행자 저녁 식사" → event: 면접) |

CSV로 내보낸 뒤 Supabase 테이블에 import하는 방식이 가장 간단함.

---

## 8. v1 범위 밖 (향후 검토)

- 강의자료/훈련계획서 등 다른 동아리 자료까지 이 시스템에 통합할지 여부
- 다중 사용자 동시 편집 시 실시간 반영(Supabase Realtime)
- 임원 승인 없이 로그인만으로 자동 role 부여하는 자동화 (현재는 회장 수동 승인 전제)
- 신규 동아리 셀프 가입/온보딩 플로우 (지금은 club_id 구조만 준비해두고, 실제 다른 동아리 추가는 수동으로 진행)
