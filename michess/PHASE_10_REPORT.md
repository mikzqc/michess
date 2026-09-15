# Michess Phase 10: Accounts & Cloud History

## 1. Authentication Provider Selected
- **Supabase** was selected as the backend provider.
- **Why**: It is an industry-standard BaaS, providing native PostgreSQL with Row Level Security (RLS) and out-of-the-box browser authentication perfectly suited for React + Vite. Its free tier is ideal for this project, and it completely eliminates the need to build a custom backend server.

## 2. Dependencies Added
- `@supabase/supabase-js` (via npm)

## 3. Files Created
- `src/services/supabase.ts`: Initializes the Supabase client using environment variables. Gracefully handles the absence of credentials without crashing the app.
- `src/components/AuthModal.tsx`: A polished modal UI handling Sign In, Sign Up, and error states natively within the Michess dark theme.
- `src/components/ProfileArea.tsx`: A simple profile dashboard where users can view their email, account status, member since date, and securely sign out.
- `src/hooks/useAuth.ts`: A React hook to manage Supabase session states (user, session, loading).
- `.env.example`: A template containing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `SUPABASE_SCHEMA.sql`: The exact PostgreSQL schema required to set up the `history_games` table, including indexes and Row Level Security policies.

## 4. Database Schema
Created the `history_games` table to mirror the local `HistoryGame` architecture. It strictly stores lightweight variables (pgn, white, black, timestamp, accuracy metrics) rather than deeply nested engine lines. This ensures fast fetching and offline capability.

## 5. Security & Row Level Security (RLS)
The database operates under strict RLS policies (included in the `SUPABASE_SCHEMA.sql` file):
- Users can only `SELECT` their own games.
- Users can only `INSERT` games mapped to their own `user_id`.
- Users can only `UPDATE` or `DELETE` their own games.
- No passwords or administrative keys are stored anywhere in the frontend codebase. The application exclusively uses the public Anon key.

## 6. Authentication Flow
- Unauthenticated users remain capable of playing offline, versus computer, importing games, and using Review without disruption.
- Clicking "Log In" spawns a sleek modal for sign-in/up.
- Secure, persistent sessions are automatically maintained via Supabase. Refreshing the browser preserves login state.

## 7. Local → Cloud Migration
- When a user logs in, `useHistory` cross-references their Local Storage cache.
- If it detects purely local games (not tied to any cloud ID), it spawns a clear, un-intrusive prompt: **"Sync Local History"** (Sync Games / Keep Local Only).
- Clicking Sync automatically beams the local games into the Supabase row while preserving all previously calculated stockfish statistics, preventing the need to re-review.

## 8. Offline/Pending-Sync Behavior
- Games natively carry a `syncStatus` tag (`synced`, `pending`, `local`).
- If a logged-in user plays a game without an internet connection, it saves offline with the status `pending` (represented by a yellow sync icon).
- The next time the `useHistory` effect mounts while online, it scoops up all `pending` games and seamlessly pushes them to the cloud.

## 9. Duplicate Handling
- Deduplication leverages the unique hash generator (`hashString`) inside `useHistory`.
- PGN hashes are used as deterministic `game_id`s.
- Duplicate imports or sync-retries correctly perform UPSERTS/updates rather than cluttering the database with identical games.

## 10. Delete & Clear Behavior
- Deleting a single game from the History UI drops it from Local Storage *and* issues a `DELETE` request to Supabase (if logged in).
- "Clear History" wipes the local array and issues a mass `DELETE` targeting only the user's games. 
- Neither action touches the Stockfish Review Cache or Settings.

## 11. Cross-Device Synchronization
- Because Supabase acts as the central source of truth, logging into a secondary device (e.g., iPad) triggers the `fetchAndSync` routine immediately upon login.
- Cloud games merge cleanly into the local cache, rendering instantly in the UI with a green `Synced` cloud icon.

## 12. Review Cache Integration
- The Review Cache was left entirely undisturbed.
- Re-opening any historical game pulled from the Cloud continues to route into `ReviewArea`.
- Because `ReviewArea` still feeds the exact same PGN into `useGameReview`, the `michess_review_cache` natively recognizes the FEN hashes and bypasses the engine completely.

## 13. Build Result
0 Errors. The Vite client environment bundled successfully.
