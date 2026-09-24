# Architecture Specification — CodeArena

## 1. High-Level Architecture
CodeArena adopts a modern, decoupled client-server architecture engineered for low-latency collaboration and safe multi-tenant code execution.

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│  - Vanilla JavaScript (ES6 Modules)                         │
│  - Monaco Code Editor (AMD Integration)                     │
│  - Tailwind CSS + Lucide Icons                              │
│  - Yjs CRDT Client Binding + Socket.IO Client               │
└──────────────┬──────────────────────────────▲───────────────┘
               │ HTTP / JSON                  │ WebSockets
               ▼                              │
┌─────────────────────────────────────────────┴───────────────┐
│                   Backend API & Real-Time                   │
│  - Express.js HTTP Server                                   │
│  - Cookie Authentication (JWT + Bcrypt)                     │
│  - Role-Based Access Control (RBAC) Engine                  │
│  - Socket.IO Collaboration Gateway                          │
│  - Yjs Sync Delta Processor                                 │
│  - Interview Event Logging Stream                           │
└──────────────┬──────────────────────────────┬───────────────┘
               │ Prisma ORM                   │ IPC / HTTP
               ▼                              ▼
┌───────────────────────────┐  ┌──────────────────────────────┐
│        PostgreSQL         │  │     Execution Worker         │
│  - Persistent Entities    │  │  - Isolated Sandbox Runner   │
│  - Evaluations & Scores   │  │  - CPU / Memory Throttles    │
│  - Event Replay Streams   │  │  - Test Suite Comparison     │
└───────────────────────────┘  └──────────────────────────────┘
```

---

## 2. Real-Time Collaboration & CRDT (Yjs) Strategy
### Why CRDT (Conflict-Free Replicated Data Types) instead of Operational Transformation (OT)?
1. **P2P & Server Convergence**: Yjs documents converge deterministically regardless of message arrival order or network latency spikes.
2. **No Central Lock**: Unlike OT which requires strict sequence numbering and server-side transformation loops, Yjs handles state commutatively.
3. **Bandwidth Optimization**: Keystrokes are encoded as compressed binary or compact delta byte arrays, avoiding heavy JSON document repaints.
4. **Awareness & Presence**: Yjs awareness protocol natively broadcasts remote cursor positions, selections, and user nicknames.

---

## 3. Sandboxed Code Execution Architecture
Executing unverified user code submitted in an interview presents critical vulnerabilities:
- Infinite loops causing CPU exhaustion (`while(true){}`)
- Memory allocation exploits (`const a = []; while(1) a.push(1)`)
- System call attempts (`require('child_process').exec(...)`, `fs.unlink(...)`)
- Network calls attempting SSRF or crypto mining.

### Sandbox Safeguards
1. **VM Isolation**: Execution runs in a dedicated Node.js `node:vm` context or isolated worker thread with restricted globals (`process`, `require`, `Buffer`, `fetch`, `XMLHttpRequest` are neutralized).
2. **Execution Timeout**: Enforced hard ceiling (default 3,000ms). Any script exceeding this limit triggers `TimeoutError` and is aborted immediately.
3. **Memory Limits**: Max memory heap allocated per run capped at 128 MB.
4. **Output Truncation**: Standard output and error buffers are capped at 50 KB to prevent buffer overflow attacks.
5. **Disposable Containerization**: The `execution-worker/` container is unprivileged, runs without network access (`--network none`), and disposes execution contexts per test suite.

---

## 4. Differentiating Feature: Interview Replay Engine
Traditional platforms store only the candidate's final submitted code. CodeArena introduces high-resolution **Interview Replay**:
- Every code milestone, test case run, submission, chat interaction, and question change is recorded as an `InterviewEvent` with an exact UTC timestamp and delta payload.
- Code versions are snapshotted on test runs, submissions, and timed auto-saves.
- The Replay UI allows hiring managers and interviewers to:
  - Scrub backwards and forwards through the candidate's development session.
  - Observe how the candidate reasoned through bugs and edge cases.
  - Review how many test runs failed before arriving at the final solution.
