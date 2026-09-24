# brain.md - CodeArena System Invariants & Architecture Manifesto

## 1. Identity
CodeArena is a real-time collaborative technical interview platform.
Core user personas: **Admin**, **Interviewer**, and **Candidate**.

## 2. Core Principle
> **CodeArena is an interview platform first and a collaborative editor second.**

It is not designed as a generic Replit or VS Code clone. Its single focus is solving the technical interview workflow end-to-end: role authorization, structured question lifecycle, sandboxed execution with hidden tests, time management, interviewer notes, live evaluation, and interview replay.

## 3. Core Objects
- **User**: Authentication, role definitions (`ADMIN`, `INTERVIEWER`, `CANDIDATE`).
- **Interview**: Session envelope, lifecycle states, scheduling, participants.
- **Question**: Interview problem catalog spanning Coding, Technical, Behavioral, MCQ, and Follow-up types.
- **InterviewQuestion**: Active question assignment in an interview session with order and notes.
- **CodingSession**: Real-time coding workspace associated with an interview problem.
- **CodeVersion**: Historical snapshots of code tied to execution and auto-save triggers.
- **TestCase**: Input/output definitions with strict `isHidden` flags.
- **Submission**: Execution results across full test suites with CPU and memory benchmarks.
- **Evaluation**: Quantitative scores, qualitative rubric feedback, and hiring recommendations.
- **InterviewEvent**: High-resolution event log driving real-time presence and the Interview Replay timeline.

## 4. Source of Truth
- **PostgreSQL**: Persistent relational database for all core entities, states, submissions, and evaluation records.
- **Yjs / CRDTs**: Active shared document state in memory, synchronized over WebSocket/Socket.IO.
- **Redis (Post-MVP)**: Ephemeral room presence, rate-limiting counters, and cross-instance Pub/Sub.
- **Object Storage (Post-MVP)**: Resumes, exported reports, and long-term recorded artifacts.

## 5. Invariant Security & Integrity Rules
1. **Never send the whole editor buffer on every keystroke**: Always use delta / CRDT incremental updates (Yjs) to prevent race conditions and network bloat.
2. **Never trust frontend authorization**: All endpoints must validate JWT tokens and user roles on the backend before executing actions.
3. **Never execute arbitrary candidate code in the main Node.js process**: Execution must happen in isolated workers with strict time, memory, filesystem, and network constraints.
4. **Never expose hidden test cases to candidates**: Hidden test case inputs, outputs, and descriptions must be stripped before sending problem data to candidate clients.
5. **Never store plaintext passwords**: Passwords must be hashed using bcrypt with salt rounds >= 10.
6. **HTTP-only Cookies**: Authentication tokens must be transported via secure, HTTP-only cookies to eliminate XSS token theft.

## 6. State Machines

### Interview Lifecycle
```
DRAFT ──> SCHEDULED ──> ACTIVE ──> COMPLETED
   │           │
   └───┬───────┴──> CANCELLED
```

### Coding Session Lifecycle
```
CREATED ──> ACTIVE ──> SUBMITTED ──> EVALUATED
```

## 7. Architecture Rules
- **Frontend**: Clean separation of UI (`views/`), Styling (`css/`), State & APIs (`js/api.js`, `js/socket.js`, `js/editor.js`). Keep business validation and secrets strictly off the frontend.
- **Backend**: Strict layered pattern:
  `Route -> Auth / Role Guard -> Input Validation (Zod) -> Controller -> Service -> Database (Prisma)`.

## 8. Technology Decision Records (TDR)
- **Why WebSockets / Socket.IO?** Low latency bidirectional events for presence, shared timer, question changes, and chat.
- **Why Yjs / CRDT?** Conflict-free Replicated Data Types resolve concurrent edits deterministically without a central operational transformation lock.
- **Why PostgreSQL + Prisma?** Strong relational consistency, foreign key constraints, ACID compliance for interviews, submissions, and evaluations.
- **Why HTTP-only Cookies?** Mitigates XSS attacks and ensures secure token storage across page navigations.
- **Why Isolate Code Execution?** Prevents untrusted user code from causing denial-of-service, accessing server secrets, or compromising the hosting environment.

## 9. Definition of Done
A feature is complete only when:
- Backend routes, validation, and role authorization are implemented.
- Database models and migrations/indexes are synchronized.
- Frontend UI displays real-time state with responsive, accessible feedback.
- Edge cases and error states (network loss, timeout, invalid input) are handled gracefully.
- Replay events are captured for downstream audit and review.

## 10. Golden Rule
> **Build a smaller system completely before building a larger system incompletely.**
