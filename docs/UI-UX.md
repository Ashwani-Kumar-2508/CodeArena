# UI/UX Design Brief — CodeArena

## 1. Design Direction
- **Theme**: Dark-first, minimalist, developer-oriented, high contrast.
- **Palette**:
  - Backgrounds: Obsidian/Slate-950 (`#0b0f19`), Surface Card (`#111827`), Surface Active (`#1f2937`).
  - Accents: Electric Indigo (`#6366f1`), Emerald Green (`#10b981`), Amber Warning (`#f59e0b`), Rose Error (`#f43f5e`).
  - Text: High-contrast Slate-100 (`#f1f5f9`), Muted Slate-400 (`#94a3b8`).
- **Typography**: Clean Sans-Serif (`Inter` / system-ui) for interfaces; Monospace (`Fira Code` / `JetBrains Mono` / Monaco) for code blocks and terminals.

## 2. Key Page Specifications

### A. Landing Page (`/index.html`)
- Value proposition hero ("Collaborative Technical Interviews Built for Developers").
- Architecture highlights, feature cards, and quick role access links.

### B. Authentication Pages (`/views/login.html` & `/views/register.html`)
- Responsive login and registration cards.
- **Quick Demo Account Selector**: One-click autofill buttons for `Interviewer`, `Candidate`, and `Admin` to facilitate immediate local testing and reviews.

### C. Adaptive Dashboard (`/views/dashboard.html`)
- Displays content conditioned on user role:
  - **Candidate**: Upcoming interviews, direct room launch buttons, past completed sessions, solved problems counter.
  - **Interviewer**: Scheduled interviews, button to launch new interview modal, list of assigned candidates, shortcut to completed interview scorecards & replays.
  - **Admin**: Global platform stats, question library shortcut, user account management.

### D. The Interview Room (`/views/interview.html`)
Designed with a full-viewport, 4-quadrant layout:
1. **Header Bar**:
   - Interview Title & Candidate Name.
   - Synchronized live countdown timer with status badge (`ACTIVE`, `PAUSED`, `COMPLETED`).
   - Interview control buttons (Start, Pause, End Interview, Evaluation drawer toggle for interviewer).
2. **Left Panel: Problem & Questions**:
   - Question selector tabs/list (Coding, Technical, Behavioral, MCQ).
   - Problem statement formatted with rich markdown, constraints, and sample inputs/outputs.
   - Expandable hints (Candidate can request hint; Interviewer can reveal hints).
   - Interviewer private scratchpad / notes.
3. **Center Panel: Collaborative Monaco Editor**:
   - Language selector (JavaScript, Python, TypeScript).
   - Integrated Monaco Editor with full syntax highlighting, bracket matching, and remote cursor markers.
   - Action bar: "Run Code" (visible test cases) and "Submit Solution" (complete suite).
4. **Bottom Panel: Test Results & Terminal Console**:
   - Test case tabs (Test 1, Test 2, etc.) showing: Input, Expected Output, Actual Output, Console Stderr, and benchmark execution time.
   - Status indicators (Passed in Green, Failed in Red, Syntax Error in Amber).
5. **Right Panel: Collaboration & Evaluation**:
   - Active participant presence list with connection status.
   - Real-time room chat stream.
   - Slide-out Interviewer Evaluation Drawer with multi-metric rating sliders, strengths/weaknesses inputs, and final hiring recommendation.

### E. Interview Replay UI (`/views/replay.html`)
- Dedicated review screen for past interviews.
- Scrubbable timeline scrubber with play, pause, jump-to-event, and playback speed modifiers (1x, 2x, 4x).
- Event markers along the scrubber indicating:
  - Code edit burst
  - Test case run & outcome
  - Chat message sent
  - Question switched
- Real-time code player showing how the solution evolved line-by-line.

## 3. Accessibility & Usability
- Full keyboard navigability for critical interactions (Ctrl+Enter to Run Code).
- High-contrast text meeting WCAG AA standards.
- Explicit visual badges indicating role and permission boundaries.
