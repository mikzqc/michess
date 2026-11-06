# Michess ♟️

A lightweight, modern chess platform designed for playing, analyzing games, solving puzzles, and improving as a player. Built with React 19, TypeScript, Tailwind CSS, Stockfish WebAssembly, Supabase Realtime, and an AI-powered chess coach.

---

## ✨ Features

### ⚔️ Gameplay
- **Play vs Computer:** Play against Stockfish running entirely in the browser via WebAssembly, with customizable difficulty levels (from beginner to Grandmaster) and time controls.
- **Play via Link (Multiplayer):** Instant peer-to-peer style match creation via shareable links. Supports seamless guest play without requiring registration, powered by Supabase Realtime and locked Postgres RPCs.
- **Local Pass & Play:** Play over the board locally on the same device.
- **Precision Clocks & Sound:** Accurate chess clocks with configurable increments and immersive audio feedback for moves, captures, checks, and promotions.

### 🧠 AI Chess Coach & Deep Review
- **Interactive AI Coach:** Natural-language tactical explanations powered by a resilient, multi-provider fallback engine (Gemini, OpenAI, Groq, Anthropic). Explains *why* a move was a blunder, mistake, or brilliant.
- **Full Game Review:** Comprehensive move classification (Brilliant, Great, Best, Excellent, Good, Inaccuracy, Mistake, Blunder, Missed Win) with accuracy percentages and centipawn loss analysis.
- **Evaluation Graph:** Interactive move-by-move advantage chart synchronized with the board state.

### 📊 Game Intelligence & Diagnostics
- **Recurring Mistake Detection:** Identifies recurring patterns (e.g., hanging pieces, missed tactics, phase-specific collapses).
- **Phase-by-Phase Performance:** Evaluates performance across Opening, Middlegame, and Endgame stages.
- **Interactive Mistake Trainer:** Practice and replay critical blunders from past games until finding the optimal engine line.
- **Opening Explorer:** Search openings by ECO code and investigate move trees with statistical win rates.

### 🧩 Puzzles & Training
- **Tactical Puzzles:** Curated puzzle database with immediate move verification, dynamic rating updates, and strike/streak tracking.
- **External Account Sync:** Import PGNs directly or automatically fetch and sync match histories from Chess.com and Lichess.

### 👥 Social & Moderation
- **Profiles & Leaderboards:** Public user profiles with Elo tracking across Bullet, Blitz, and Rapid categories.
- **Direct & In-Game Messaging:** Real-time chat with friends and opponents.
- **Admin & Moderation Panel:** Comprehensive review tools, automated report workflows, and temporary/permanent suspension capabilities.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React
- **Chess Engine & Validation:** `chess.js`, `react-chessboard`, Stockfish (WASM / Web Worker)
- **Backend & Database:** Supabase (PostgreSQL, Row Level Security, Realtime subscriptions, RPCs)
- **Serverless APIs:** Vercel Functions (`/api/coach-explain`)
- **Testing:** Node.js native test runner (`node --test`)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mikzqc/michess.git
   cd michess/michess
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file inside the `michess/` folder with the following variables:

   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # Optional: AI Coach API Keys for edge function
   GEMINI_API_KEY=your_gemini_api_key
   OPENAI_API_KEY=your_openai_api_key
   GROQ_API_KEY=your_groq_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

4. **Run Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

5. **Run Tests:**
   ```bash
   node --test tests/*.test.mjs
   ```

6. **Build for Production:**
   ```bash
   npm run build
   ```

---

## 📂 Project Structure

```
Michess/
├── michess/
│   ├── api/                   # Serverless edge functions (AI coach explain)
│   ├── public/                # Static assets, audio, WASM binaries, manifests
│   ├── src/
│   │   ├── components/        # React UI components (board, review, intelligence, admin, etc.)
│   │   ├── contexts/          # App contexts (auth, theme, settings)
│   │   ├── hooks/             # Custom React hooks (matchmaking, clock, game review, engine)
│   │   ├── services/          # Supabase, Stockfish, audio, and linked accounts services
│   │   ├── utils/             # Chess calculations, accuracy math, ECO classification
│   │   └── App.tsx            # Main application router and state management
│   ├── tests/                 # Unit and integration test suites
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## 📜 License

Private personal project. All rights reserved.
