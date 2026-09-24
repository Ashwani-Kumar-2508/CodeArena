# Database Design & ERD — CodeArena

## 1. Relational Entity Overview
CodeArena uses **PostgreSQL** configured via **Prisma ORM**. The data model enforces strong relational consistency, cascade deletion where appropriate, and indexing on frequent query filters.

```mermaid
erDiagram
    User ||--o{ Interview : creates_as_interviewer
    User ||--o{ Interview : attends_as_candidate
    Interview ||--o{ InterviewQuestion : contains
    Question ||--o{ InterviewQuestion : assigned_to
    Question ||--o{ TestCase : has
    Interview ||--o{ CodingSession : tracks
    Interview ||--o{ Evaluation : receives
    Interview ||--o{ InterviewEvent : logs
    CodingSession ||--o{ CodeVersion : snapshots
    CodingSession ||--o{ Submission : records

    User {
        string id PK
        string email UK
        string passwordHash
        string name
        enum role "ADMIN, INTERVIEWER, CANDIDATE"
        datetime createdAt
        datetime updatedAt
    }

    Interview {
        string id PK
        string title
        string description
        enum status "DRAFT, SCHEDULED, ACTIVE, COMPLETED, CANCELLED"
        datetime scheduledAt
        datetime startedAt
        datetime endedAt
        int durationMinutes
        string interviewerId FK
        string candidateId FK
        datetime createdAt
        datetime updatedAt
    }

    Question {
        string id PK
        string title
        string description
        enum type "CODING, TECHNICAL, BEHAVIORAL, MCQ, FOLLOW_UP"
        enum difficulty "EASY, MEDIUM, HARD"
        string defaultCodeSnippet
        string language
        json options
        json hints
        json rubric
        datetime createdAt
        datetime updatedAt
    }

    TestCase {
        string id PK
        string questionId FK
        string input
        string expectedOutput
        boolean isHidden
        string explanation
    }

    InterviewQuestion {
        string id PK
        string interviewId FK
        string questionId FK
        int order
        string currentStatus
        string interviewerNotes
        datetime createdAt
    }

    CodingSession {
        string id PK
        string interviewId FK
        string questionId FK
        enum status "CREATED, ACTIVE, SUBMITTED, EVALUATED"
        string language
        string currentCode
        datetime startedAt
        datetime submittedAt
    }

    CodeVersion {
        string id PK
        string codingSessionId FK
        string code
        enum trigger "AUTO_SAVE, RUN_TESTS, SUBMISSION"
        datetime timestamp
    }

    Submission {
        string id PK
        string codingSessionId FK
        string code
        string language
        enum status "PENDING, PASSED, FAILED, ERROR"
        json testResults
        int passedCount
        int totalCount
        int executionTimeMs
        int memoryUsedKb
        datetime submittedAt
    }

    Evaluation {
        string id PK
        string interviewId FK
        string interviewerId FK
        int overallScore
        int problemSolvingScore
        int codeQualityScore
        int communicationScore
        enum recommendation "STRONG_HIRE, HIRE, NO_HIRE, STRONG_NO_HIRE"
        string strengths
        string improvements
        string feedback
        datetime submittedAt
    }

    InterviewEvent {
        string id PK
        string interviewId FK
        string userId FK
        string eventType
        json payload
        datetime timestamp
    }
```

---

## 2. Indexing Strategy
- `User(email)`: Unique index for lightning-fast credential lookup.
- `Interview(interviewerId, status)`: Composite index for interviewer dashboards.
- `Interview(candidateId, status)`: Composite index for candidate dashboards.
- `InterviewQuestion(interviewId, order)`: Sorted question navigation.
- `TestCase(questionId, isHidden)`: Filtered query for visible test cases.
- `InterviewEvent(interviewId, timestamp)`: Sequential time-series retrieval for Interview Replay.
