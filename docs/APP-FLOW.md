# APP-FLOW — Application Flow & User Journeys

## 1. High-Level Flow
```mermaid
flowchart TD
    Landing["Landing Page (index.html)"]
    Auth["Login / Register (/views/login.html)"]
    Dashboard["Dashboard (/views/dashboard.html)"]

    Landing --> Auth
    Auth --> Dashboard

    subgraph InterviewerFlow["Interviewer Journey"]
        CreateInterview["Create Interview Modal"]
        SelectQuestions["Attach Coding / System Design Questions"]
        LaunchRoom["Launch Room (/views/interview.html?id=...)"]
        StartInterview["Start Session & Synchronized Timer"]
        Monitor["Monitor Code & Concurrent Cursors"]
        TakeNotes["Record Private Interviewer Notes"]
        Evaluate["Submit Rubric Evaluation"]
        ReviewReplay["Inspect Interview Replay (/views/replay.html?id=...)"]

        CreateInterview --> SelectQuestions --> LaunchRoom --> StartInterview --> Monitor --> TakeNotes --> Evaluate --> ReviewReplay
    end

    subgraph CandidateFlow["Candidate Journey"]
        JoinInterview["Click Join Interview from Dashboard"]
        WaitingRoom["Enter Room & Verify Audio/Presence"]
        ReadProblem["Inspect Problem Statement & Constraints"]
        CodeCollab["Collaboratively Code in Monaco Editor"]
        RunVisible["Execute Public Test Cases"]
        SubmitCode["Submit Solution (Triggers Hidden Tests)"]
        Chat["Communicate via Real-Time In-Room Chat"]

        JoinInterview --> WaitingRoom --> ReadProblem --> CodeCollab --> RunVisible --> SubmitCode
    end

    Dashboard --> CreateInterview
    Dashboard --> JoinInterview
```

---

## 2. Detailed State Machine Transitions

### Interview State Machine
```
[DRAFT]
   │
   ├── (Scheduled by Interviewer) ──> [SCHEDULED]
   │                                      │
   ├── (Cancelled before start) ──────────┼──> [CANCELLED]
   │                                      │
   └── (Interviewer clicks Start) ────────┴──> [ACTIVE]
                                                  │
   ┌──────────────────────────────────────────────┘
   │
   └── (Interviewer clicks End / Time expires) ──> [COMPLETED]
```

### Coding Session State Machine
```
[CREATED] (When candidate enters question)
   │
   ├── (Candidate types code) ────────────────> [ACTIVE]
   │                                              │
   ├── (Candidate clicks Submit) ─────────────────┴──> [SUBMITTED]
   │                                                      │
   └── (Interviewer scores & completes evaluation) ───────┴──> [EVALUATED]
```

---

## 3. Real-Time Event Sequence (Interview Session)

```mermaid
sequenceDiagram
    autonumber
    actor Candidate
    actor Interviewer
    participant SocketServer as Socket.IO & Yjs Server
    participant Worker as Execution Worker
    participant DB as PostgreSQL (Prisma)

    Interviewer->>SocketServer: join_room(interviewId)
    Candidate->>SocketServer: join_room(interviewId)
    SocketServer-->>Interviewer: user_joined(Candidate)
    SocketServer-->>Candidate: user_joined(Interviewer)

    Interviewer->>SocketServer: start_interview()
    SocketServer->>DB: Update Interview status to ACTIVE
    SocketServer-->>Candidate: interview_started(duration, startedAt)
    SocketServer-->>Interviewer: interview_started(duration, startedAt)

    Candidate->>SocketServer: yjs_sync_step1 / delta update
    SocketServer-->>Interviewer: yjs_sync_step2 / delta update

    Candidate->>SocketServer: cursor_move(lineNumber, column)
    SocketServer-->>Interviewer: remote_cursor(userId, lineNumber, column)

    Candidate->>Worker: POST /api/code/run (code, questionId)
    Worker->>Worker: Execute in isolated VM with timeout
    Worker-->>Candidate: Test results (Visible test cases only)

    Candidate->>SocketServer: POST /api/code/submit (code, questionId)
    SocketServer->>Worker: Run all tests (Visible + Hidden)
    Worker-->>SocketServer: Full test execution score
    SocketServer->>DB: Save Submission record
    SocketServer-->>Interviewer: candidate_submitted(passedCount, totalCount)
    SocketServer-->>Candidate: submission_received(passedCount, totalCount)

    Interviewer->>DB: POST /api/evaluations (scorecard, recommendation)
    Interviewer->>SocketServer: end_interview()
    SocketServer->>DB: Update Interview status to COMPLETED
    SocketServer-->>Candidate: interview_ended()
    SocketServer-->>Interviewer: interview_ended()
```
