# TRD — Technical Requirements Document

## 1. Technology Stack
- **Frontend**: HTML5, Vanilla JavaScript (ES6+ modular), Tailwind CSS, Monaco Editor (via AMD loader).
- **Backend**: Node.js (v20+ LTS), Express.js.
- **Database & ORM**: PostgreSQL (v14+) with Prisma ORM.
- **Authentication**: Salted password hashing (`bcryptjs`), JWT stored in secure `HTTP-only`, `SameSite=Lax` cookies.
- **Real-Time Collaboration**: Socket.IO + Yjs CRDT document synchronization.
- **Execution Sandbox**: Node.js isolated VM runner with process timeouts, memory limits, and Docker-ready container isolation.
- **Input Validation**: Zod schema validation on all incoming API payloads.

## 2. Architecture Overview
```
Client (Browser)
   │
   ├── REST API (HTTP-only Cookie Auth) ──> Express API Server ──> PostgreSQL (Prisma)
   │                                              │
   ├── WebSockets / Socket.IO (Presence & Sync) ──┤
   │                                              │
   └── Code Execution Requests ───────────────────┴──> Sandboxed Runner
```

## 3. Database Schema Entities
1. `User`: id, email, passwordHash, name, role (`ADMIN`, `INTERVIEWER`, `CANDIDATE`), createdAt, updatedAt.
2. `Interview`: id, title, description, status (`DRAFT`, `SCHEDULED`, `ACTIVE`, `COMPLETED`, `CANCELLED`), scheduledAt, startedAt, endedAt, durationMinutes, interviewerId, candidateId, createdAt, updatedAt.
3. `Question`: id, title, description, type (`CODING`, `TECHNICAL`, `BEHAVIORAL`, `MCQ`, `FOLLOW_UP`), difficulty, defaultCodeSnippet, language, options (JSON for MCQ), hints (JSON), rubric (JSON), createdAt, updatedAt.
4. `InterviewQuestion`: id, interviewId, questionId, order, currentStatus, notes, createdAt.
5. `CodingSession`: id, interviewId, questionId, status (`CREATED`, `ACTIVE`, `SUBMITTED`, `EVALUATED`), language, currentCode, startedAt, submittedAt.
6. `CodeVersion`: id, codingSessionId, code, trigger (`AUTO_SAVE`, `RUN_TESTS`, `SUBMISSION`), timestamp.
7. `TestCase`: id, questionId, input, expectedOutput, isHidden, explanation.
8. `Submission`: id, codingSessionId, code, language, status (`PENDING`, `PASSED`, `FAILED`, `ERROR`), testResults (JSON), passedCount, totalCount, executionTimeMs, memoryUsedKb, submittedAt.
9. `Evaluation`: id, interviewId, interviewerId, overallScore, problemSolvingScore, codeQualityScore, communicationScore, recommendation, strengths, improvements, feedback, submittedAt.
10. `InterviewEvent`: id, interviewId, userId, eventType (`USER_JOINED`, `USER_LEFT`, `CODE_UPDATE`, `CURSOR_UPDATE`, `CHAT_MESSAGE`, `INTERVIEW_STARTED`, `INTERVIEW_ENDED`, `QUESTION_CHANGED`, `EXECUTION_STARTED`, `EXECUTION_COMPLETED`), payload (JSON), timestamp.

## 4. Key API Endpoints
### Authentication (`/api/auth`)
- `POST /register`: Create account.
- `POST /login`: Authenticate and set HTTP-only cookie.
- `POST /logout`: Clear auth cookie.
- `GET /me`: Return current authenticated user profile.

### Interviews (`/api/interviews`)
- `GET /`: List interviews relevant to the authenticated user.
- `POST /`: Create interview (Interviewer/Admin only).
- `GET /:id`: Get interview details, questions, and participant info.
- `POST /:id/start`: Transition interview to `ACTIVE`.
- `POST /:id/end`: Transition interview to `COMPLETED`.
- `POST /:id/questions`: Add or reorder questions.

### Questions (`/api/questions`)
- `GET /`: List catalog questions (hidden tests stripped for candidates).
- `POST /`: Create question (Interviewer/Admin only).
- `GET /:id`: Retrieve single question details.

### Code Execution (`/api/code`)
- `POST /run`: Run candidate code against public visible test cases.
- `POST /submit`: Execute against full test suite (including hidden tests) and record `Submission`.

### Evaluation (`/api/evaluations`)
- `POST /`: Submit interview scorecard (Interviewer only).
- `GET /:interviewId`: Get evaluation results (Interviewer/Admin).

### Replay (`/api/replay`)
- `GET /:interviewId`: Fetch chronological `InterviewEvent` records and `CodeVersion` snapshots.

## 5. Security & Invariant Rules
- Candidate cannot view `TestCase.isHidden == true`.
- Passwords must be hashed using bcrypt (10 rounds).
- Rate-limiting enabled on sensitive endpoints (auth, code execution).
- CORS headers restricted to authorized origins.
