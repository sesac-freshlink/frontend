# Claude Code 사용법 (frontend)

> **2026-11-13 변경:** 이 레포에 있던 서브에이전트 8개(pm, architect, designer, coder, tester, reviewer, qa, docs)와 그 파이프라인을 없앴다. 쉬운 요청도 에이전트를 차례로 거치느라 너무 오래 걸렸기 때문이다. 지금은 **Claude 하나(Opus 5.5)가 `freshlink-pipeline` 스킬 순서대로 직접** 이해 → 계획 → 구현 → 검증 → 자체 리뷰 → 커밋·PR을 한다. 작은 일은 계획·리뷰를 건너뛴다. 팀 공통 설명은 `.github` 레포 [`docs/팀원-가이드/ai-agents.md`](https://github.com/sesac-freshlink/.github/blob/main/docs/%ED%8C%80%EC%9B%90-%EA%B0%80%EC%9D%B4%EB%93%9C/ai-agents.md).

## 1. 메모리: Claude가 규칙을 기억하는 방법

Claude는 대화가 끝나면 내용을 잊는다. 다음 대화에서도 지켜야 할 규칙은 아래 파일 중 하나에 적어 둔다. Claude Code는 세션을 시작할 때 이 파일들을 자동으로 읽는다.

| 파일 | 범위 | 커밋 | 언제 쓰나 |
| --- | --- | --- | --- |
| `CLAUDE.md` (레포 루트) | 이 레포, 팀 전체 | O | 팀 규칙. 폴더 구조, 금지 사항 |
| `.claude/skills/freshlink-pipeline/` | 팀 공용 작업 순서 | O | 원본은 `.github` 레포 `claude-agents/`. 여기서 고치지 않는다 |
| `CLAUDE.local.md` (레포 루트) | 이 레포, 나만 | X | 개인 취향. 답변 말투, 내 로컬 환경 |
| `~/.claude/CLAUDE.md` | 내 모든 프로젝트 | X | 프로젝트와 상관없는 내 습관 |
| 자동 메모리 (`~/.claude/projects/<프로젝트>/memory/`) | 이 레포, 나만 | X | 대화 중 "기억해"라고 한 것을 Claude가 직접 저장 |

### 기억시키는 방법

- **팀 규칙으로 남기기:** `CLAUDE.md`를 직접 고치거나 Claude에게 "CLAUDE.md 핵심 규칙에 ~ 추가해줘"라고 한다. 커밋하면 팀원도 같은 규칙으로 작업한다.
- **나만 기억시키기:** 대화 중 "앞으로 ~ 해줘, 기억해"라고 말한다. Claude가 자동 메모리에 한 줄로 저장하고, 다음 세션부터 지킨다. 내 컴퓨터에만 남는다.
- **확인·수정:** `/memory` 명령으로 지금 읽고 있는 메모리 파일을 열어 보고 고칠 수 있다. 틀린 기억은 "그거 잊어줘"라고 하거나 파일에서 지운다.

### 처음 쓸 때, 규칙을 바꾼 뒤

`CLAUDE.md`는 **세션을 시작할 때 한 번** 읽힌다. 세션 도중에 만들거나 고친 내용은 그 세션에 자동으로 반영되지 않는다 (예: 답변 말투 규칙을 추가했는데 계속 길게 답한다).

이럴 때 입력창에 아래 명령을 친다.

```
/reread
```

`CLAUDE.md`와 `freshlink-pipeline` 스킬을 다시 읽고 바로 다음 답변부터 그 규칙을 따른다. 명령 정의는 `.claude/commands/reread.md`에 있다.

| 상황 | 할 일 |
| --- | --- |
| 레포를 처음 받아 Claude Code를 연다 | 따로 할 일 없다. 첫 세션부터 자동으로 읽는다 |
| 세션 도중 `CLAUDE.md`를 만들었거나 고쳤다 | `/reread` |
| Claude가 규칙(말투 등)을 안 지킨다 | `/reread` |
| 제대로 읽었는지 확인하고 싶다 | `/memory`로 읽고 있는 파일 목록을 본다 |

`CLAUDE.md 내용을 메모리에 기억해줘`라고 할 필요는 없다 (`/reread`를 쓴다). 이미 매 세션 읽히는 파일이라, 메모리에 복사하면 같은 규칙이 두 곳에 생기고 나중에 `CLAUDE.md`를 고쳤을 때 옛 내용이 남는다. 이렇게 요청하면 Claude는 `CLAUDE.md`에 없는 사실만 골라 저장한다.

### 어디에 적을지 고르는 기준

- 팀원 모두가 지켜야 하면 `CLAUDE.md`
- 모든 레포의 작업 순서·검증 방법을 바꾸려면 `.github` 레포 `claude-agents/` 원본
- 나만 원하는 것이면 "기억해" 또는 `CLAUDE.local.md`
- README·`docs/`에 이미 있는 사실은 다시 적지 않는다. `CLAUDE.md`는 그 문서를 가리키기만 한다.

## 2. 일 시키기

평소처럼 부탁한다. 따로 명령은 없다.

| 부탁 | Claude가 하는 순서 |
| --- | --- |
| "로그인 버튼 문구 바꿔줘" (작은 일) | 바로 고침 → `npx tsc -b`·`npm run lint` → 커밋 전 확인 |
| "점주 폐기 화면 만들어줘" (화면 하나) | 계획을 보여 주고 ok → Types → api.ts → MSW → Page → 라우트·README → 타입·lint·포맷·테스트 → 자체 리뷰 → 커밋 전 확인 |
| "이 PR 리뷰해줘" | `frontend.md` 점검표로 리뷰만 |

- "끝까지 쭉"이라고 하면 계획 확인도 건너뛴다. 커밋·PR 전 확인은 그래도 묻는다.
- 순서를 안 지키면 `/reread` 또는 "freshlink-pipeline 스킬대로 해줘".
- 예전 방식으로 내 PC에 남은 `.claude/agents/`, `_workspace/`가 있으면 지운다(`.github` 문서 2장).
