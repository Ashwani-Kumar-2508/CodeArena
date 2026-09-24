# ⚔️ CodeArena — Real-Time Collaborative Technical Interview Platform

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-indigo.svg)](https://www.prisma.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-black.svg)](https://socket.io/)
[![Yjs](https://img.shields.io/badge/Yjs-CRDT-orange.svg)](https://yjs.dev/)
[![Monaco Editor](https://img.shields.io/badge/Monaco-Editor-blueviolet.svg)](https://microsoft.github.io/monaco-editor/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC.svg)](https://tailwindcss.com/)

**CodeArena** is a production-grade, real-time collaborative technical interview platform built specifically around the end-to-end technical interview lifecycle. It is **not** a generic Replit or online IDE clone; it brings structured candidate/interviewer role workflows, multi-format interview questions, CRDT-based shared editing, sandboxed code execution with hidden test cases, synchronized session timers, real-time chat, structured interviewer evaluations, and granular interview replay into a single, cohesive developer workspace.

---

## 💡 Differentiation & Product Positioning

While tools like Replit, VS Code Live Share, and CodeSandbox provide general collaborative coding, they lack the rigor and specialized tooling necessary for high-stakes technical assessments:

| Feature Area | Generic Collaborative IDEs | CodeArena Interview Platform |
| :--- | :--- | :--- |
| **User Roles & Workflow** | Symmetric peers with identical privileges | Strict RBAC: Interviewer controls session, questions, notes & rating; Candidate answers & codes |
| **Question Catalog** | File-based open workspace | Curated multi-format questions: Coding, Technical, Behavioral, MCQ, and Follow-ups |
| **Test Case Verification** | Manual file execution | Dual-tier testing: Candidate-accessible visible tests + backend-isolated **Hidden Tests** |
| **Candidate Code Sandboxing**| Direct unconstrained terminal access | Restricted disposable sandbox workers with timeout, memory, network, and system call limits |
| **Interview Assessment** | External notes or separate HR tools | Integrated evaluation rubrics, scorecards, and hiring recommendations |
| **Session Auditing** | Only final code saved in Git | **Interview Replay**: Event-sourced timeline recording every edit, test run, hint, and chat message |

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Client Browser (Vanilla JS + Tailwind + Monaco)"]
        UI["UI Layer (Candidate / Interviewer Views)"]
        Monaco["Monaco Editor Instance"]
        YjsClient["Yjs CRDT Document & Cursor Provider"]
        SocketClient["Socket.IO Client (Presence, Timer, Chat)"]
    end

    subgraph Backend["Express & Real-Time Backend (Node.js)"]
        AuthMiddleware["Auth & RBAC Middleware (HTTP-only JWT)"]
        REST["REST API Controllers (Interviews, Questions, Evaluations, Replay)"]
        SocketServer["Socket.IO Server (Room Management & Events)"]
        YjsServer["Yjs Sync Engine (Document Delta Distribution)"]
    end

    subgraph Storage["Persistence & Databases"]
        Postgres[(PostgreSQL via Prisma ORM)]
    end

    subgraph Sandbox["Execution Worker (Isolated Sandbox)"]
        Worker["Runner Process / Docker Worker"]
        TestHarness["Test Case Harness (Visible & Hidden)"]
    end

    UI --> REST
    Monaco <--> YjsClient
    YjsClient <--> YjsServer
    SocketClient <--> SocketServer
    REST --> AuthMiddleware
    AuthMiddleware --> Postgres
    SocketServer --> Postgres
    REST --> Worker
    Worker --> TestHarness
```

---

## 🚀 Key Features

### 1. Role-Based Access Control (RBAC) & Security
- **Roles**: `INTERVIEWER`, `CANDIDATE`, `ADMIN`.
- **Security Invariant**: Sensitive actions (revealing hints, adding private notes, starting/stopping timers, reviewing hidden tests, submitting evaluations) are strictly verified on the backend.
- **Authentication**: Salted password hashing with `bcryptjs` and HTTP-only, SameSite secure JWT cookies preventing XSS token leakage.

### 2. Multi-Format Interview Question Engine
- Supports **Coding Problems** (with starter boilerplate, language specifications, and test cases), **Technical Architecture Questions**, **Behavioral Rubrics**, **Multiple Choice (MCQs)**, and dynamic **Follow-up Questions**.
- Complete separation between candidate view and interviewer answer guides / hidden test suites.

### 3. Real-Time Collaborative Monaco Editor with Yjs (CRDT)
- Conflict-free collaborative code editing powered by **Yjs** CRDTs over WebSocket/Socket.IO.
- Remote cursor position sharing and active presence indicators showing exactly what the candidate and interviewer are inspecting in real time.

### 4. Sandboxed Code Execution with Visible & Hidden Test Cases
- Isolated execution engine with strict CPU execution timeout (e.g., 3000ms protection against infinite loops), process memory barriers, and forbidden API blocking (`child_process`, disk writes, raw sockets).
- **Candidate Run**: Executes only against public visible test cases with detailed inputs, expected vs. actual outputs, diffs, and execution execution benchmarks.
- **Submission**: Executes against the complete test suite including secret boundary conditions and edge cases never exposed to the candidate.

### 5. Synchronized Timer & Real-Time Chat
- High-precision interview countdown timer synchronized from backend timestamps to prevent client-side clock tampering.
- In-room chat stream with system status events (e.g., test runs, question switches).

### 6. Structured Interviewer Evaluation
- Built-in scorecard supporting quantitative criteria (Problem Solving, Code Quality, Communication, System Design), qualitative strengths/weaknesses, and hiring decisions (`STRONG_HIRE`, `HIRE`, `NO_HIRE`, `STRONG_NO_HIRE`).

### 7. Differentiating Feature: Interview Replay Engine
- Records timestamped `InterviewEvent` records across the session (code edits, test runs, hint requests, chat messages).
- Interviewers can playback the candidate's exact thought process, see how they refactored code over time, and analyze debugging patterns post-interview.

---

## 📂 Repository Structure

```
CodeArena/
├── backend/                  # Node.js + Express + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma     # Complete PostgreSQL schema definitions
│   │   └── seed.js           # Database seeder with mock users & interview questions
│   ├── src/
│   │   ├── config/           # Prisma client, JWT, and environment config
│   │   ├── controllers/      # Auth, Interview, Question, Code, Evaluation, Replay
│   │   ├── middlewares/      # Cookie Auth, Role Guard, Rate Limiter, Error Handler
│   │   ├── routes/           # REST endpoints
│   │   ├── services/         # Business logic and execution orchestration
│   │   ├── socket/           # Real-time WebSocket room, presence, timer, & Yjs sync
│   │   └── server.js         # HTTP & Socket.IO server entrypoint
│   ├── .env.example          # Environment variables template
│   └── package.json
├── execution-worker/         # Sandboxed code execution engine
│   ├── runner.js             # Execution harness with safety sandboxing
│   ├── Dockerfile            # Disposable worker container definition
│   └── package.json
├── frontend/                 # Vanilla JS + Tailwind CSS + Monaco Editor client
│   ├── css/
│   │   └── style.css         # Dark theme styling, Monaco editor containers
│   ├── js/
│   │   ├── api.js            # HTTP-only REST API client
│   │   ├── auth.js           # Authentication and route guard logic
│   │   ├── dashboard.js      # Interview management & scheduling UI
│   │   ├── editor.js         # Monaco editor & real-time sync bindings
│   │   ├── interview-room.js # Real-time interview room coordinator
│   │   ├── replay.js         # Interactive replay timeline player
│   │   └── socket.js         # Socket.IO connection & event handlers
│   ├── views/
│   │   ├── login.html        # Authentication with quick demo account buttons
│   │   ├── register.html     # User registration with role selection
│   │   ├── dashboard.html    # Role-adaptive candidate & interviewer dashboard
│   │   ├── interview.html    # Main interview room with code editor & test runner
│   │   ├── problems.html     # Question library browser
│   │   └── replay.html       # Post-interview session playback screen
│   └── index.html            # Landing page
├── docs/                     # Product & Engineering Documentation
│   ├── PRD.md                # Product Requirements Document
│   ├── TRD.md                # Technical Requirements Document
│   ├── UI-UX.md              # UI/UX design brief & specifications
│   ├── APP-FLOW.md           # Application state machine & user journeys
│   ├── architecture.md       # Technical architecture & CRDT sync model
│   └── database.md           # Database entity specifications & ERD
├── brain.md                  # System invariants and development rules
├── docker-compose.yml        # Docker composition for PostgreSQL, Backend, & Worker
├── .gitignore                # Exclusion rules protecting secrets and environment files
└── README.md
```

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher; v20 LTS recommended)
- [PostgreSQL](https://www.postgresql.org/) (v14 or higher) or [Docker Desktop](https://www.docker.com/)

---

### Method 1: Local Development (Quickstart)

#### 1. Setup Backend & Database
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your PostgreSQL connection in .env:
# DATABASE_URL="postgresql://postgres:your_password@localhost:5432/codearena?schema=public"

# Run Prisma migrations & generate client
npx prisma db push

# Seed demo users, interview questions, and test cases
npm run seed

# Start backend server (runs on port 5000)
npm run dev
```

#### 2. Open Frontend
The backend serves the frontend statically at `http://localhost:5000` out of the box, or you can serve `frontend/` using any static server:
```bash
# Visit in your browser:
http://localhost:5000
```

---

### Method 2: Docker Compose Setup
```bash
# Build and launch PostgreSQL, Backend, and Execution Worker in containers:
docker-compose up --build -d
```

---

## 🧪 Pre-configured Demo Accounts

Use the quick-login buttons on the login page or enter the credentials below:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Interviewer** | `interviewer@codearena.dev` | `Password123!` | Create interviews, manage questions, run hidden tests, score candidates |
| **Candidate** | `candidate@codearena.dev` | `Password123!` | Join assigned interviews, code in real-time, execute visible test cases |
| **Admin** | `admin@codearena.dev` | `Password123!` | Full system administration, user management, interview audit |

---

## 🔒 Security Best Practices

1. **Sandboxed Code Execution**: User-submitted code is never evaluated directly in the host application loop. Code runs inside a restricted runner with VM isolation, memory ceiling (128MB), and execution timeout (3 seconds).
2. **Hidden Test Case Masking**: The database TestCase model flags confidential verification tests (`isHidden = true`). The backend question controller guarantees these tests are stripped from candidate API responses.
3. **HTTP-only Cookies**: JWT authentication tokens are written to secure HTTP-only cookies, eliminating script access and preventing credential leakage via XSS.
4. **Rate Limiting**: Authentication endpoints and code execution runners are protected by rate limiters to defend against credential stuffing and DoS attacks.

---

## 👤 Author
- **GitHub**: [@Ashwani-Kumar-2508](https://github.com/Ashwani-Kumar-2508)
- **Repository**: [CodeArena](https://github.com/Ashwani-Kumar-2508/CodeArena)
