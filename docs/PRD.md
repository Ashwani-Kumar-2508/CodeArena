# PRD — Product Requirements Document

## 1. Product Overview
CodeArena is a real-time collaborative technical interview platform designed specifically for the technical interview lifecycle. It combines interview management, real-time collaborative coding, coding problems, multiple interview question types, isolated code execution, visible and hidden test cases, timers, evaluation, interview history, and interview replay. The product is designed around the technical interview workflow rather than as a general-purpose collaborative IDE.

## 2. Problem Statement
Technical interviews in modern engineering teams frequently rely on a fragile patchwork of disconnected tools:
- Screen sharing or video call tools (Zoom/Google Meet)
- Generic online editors (Replit, Google Docs, CoderPad)
- Disjointed private notes and spreadsheets for interviewer scores
- Zero structured recording of how the candidate actually approached, planned, and debugged the problem.

CodeArena addresses this by unifying the interview lifecycle into a single, high-fidelity platform tailored specifically for technical evaluation.

## 3. Target Users
1. **Candidate**:
   - Joins interviews via direct room links or dashboard.
   - Views assigned questions and instructions.
   - Writes code in Monaco Editor with syntax highlighting and auto-complete.
   - Runs code against public visible test cases with immediate feedback.
   - Submits solutions and answers interviewer follow-ups.
   - Interacts via synchronized real-time chat.
2. **Interviewer**:
   - Creates, configures, and schedules interviews.
   - Selects questions across Coding, Technical, Behavioral, MCQ, and Follow-up formats.
   - Controls the interview lifecycle (start, pause, complete, switch questions).
   - Monitors candidate code and cursor in real time.
   - Runs complete test suites including confidential hidden test cases.
   - Takes private interviewer notes and records comprehensive rubric evaluations.
   - Reviews interview replay after session completion.
3. **Admin**:
   - Manages user accounts and roles.
   - Curates the global question bank.
   - Audits interview sessions and evaluation reports.

## 4. Core Features (MVP)
- **Authentication & RBAC**: Candidate, Interviewer, and Admin roles with secure HTTP-only cookies and backend authorization guards.
- **Interview Lifecycle**: Structured state machine: `DRAFT -> SCHEDULED -> ACTIVE -> COMPLETED / CANCELLED`.
- **Question Engine**: Support for 5 question archetypes:
  - *Coding*: Code starter templates, language selection, input/output test cases.
  - *Technical*: Architecture/system design questions with problem briefs.
  - *Behavioral*: Situational questions with interviewer evaluation rubrics.
  - *MCQ*: Multiple choice conceptual questions.
  - *Follow-up*: Real-time bonus constraints and edge cases.
- **Collaborative Editor**: Monaco Editor integrated with Yjs CRDTs for deterministic real-time synchronization.
- **Code Execution**: Disposable sandbox execution runner enforcing 3-second timeouts, memory caps, and process isolation.
- **Dual Test Case Model**: Public visible test cases visible to the candidate, alongside confidential hidden test cases evaluated server-side.
- **Synchronized Session Timer**: Backend-driven countdown timer preventing client-side desync.
- **Real-Time Presence & Chat**: In-room live participant status and chat feed.
- **Interviewer Evaluation**: Structured scorecard with ratings across Problem Solving, Code Quality, Communication, System Design, and final recommendation (`STRONG_HIRE`, `HIRE`, `NO_HIRE`, `STRONG_NO_HIRE`).
- **Interview History & Replay**: Event timeline capturing every code edit, test run, submission, and interaction for retrospective review.

## 5. Post-MVP Roadmap
- Integrated WebRTC audio/video and screen sharing.
- AI interview assistant (automated code complexity analysis, test case generator, candidate summary).
- Organization/team workspace management.
- Multi-region Redis Pub/Sub scaling.
- Calendar integration (Google Calendar, Outlook).

## 6. Success Metrics
- Average time from interview start to candidate onboarding (< 30 seconds).
- Real-time synchronization latency (< 50ms).
- Code execution sandbox round-trip time (< 1.5 seconds).
- Zero leaks of confidential hidden test cases to candidate clients.
- 100% completion rate for interviewer scorecards.
