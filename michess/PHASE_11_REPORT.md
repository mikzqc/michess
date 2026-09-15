# Phase 11: Play via Link Implementation (Updated: Anonymous Guest Play)

## Summary
The "Play via Link" feature has been refactored to support fully anonymous gameplay. Login is strictly optional.
Players can instantly generate links and join matches without ever creating an account. The system tracks guests via a randomly generated persistent UUID in `localStorage`. Logged-in players and anonymous players can seamlessly play together. 

## Files Modified
1. `SUPABASE_SCHEMA.sql`: 
    - Transformed `white_player` and `black_player` to `TEXT` (removing the strict `auth.users` foreign key constraint) to accept guest UUIDs.
    - Updated RLS Policies: Reads are open (`USING (true)`) so unauthenticated clients can subscribe to Realtime.
    - Added **Security Definer RPCs** (`create_link_game`, `join_link_game`, `update_link_game`, `cancel_link_game`). Direct `INSERT/UPDATE/DELETE` capabilities are revoked for clients. Clients must use these strict RPCs which enforce player identity validation (you can only move if your guest ID / auth ID matches the row).
2. `src/hooks/useLinkGame.ts`: 
    - Dynamically generates and retrieves `michess_guest_id` from `localStorage`.
    - Swapped all `.update()` and `.insert()` Supabase calls to use the secure RPC endpoints (`.rpc('update_link_game', {...})`).
3. `src/components/LinkPlayArea.tsx`: 
    - Refactored `isPlayer` checks to use the new unified `playerId` rather than `user?.id`.
    - When a guest is invited, the "Join Game" button is completely unblocked. Added a lightweight, non-blocking label: "Playing as Guest — Sign in to save this game to your history".
    - Game saves natively intercept completion and push to `history_games` ONLY if the user is authenticated.
4. `src/App.tsx`: 
    - The "Play via Link" button no longer strictly demands authentication before launching a lobby. 

## Testing Instructions (Localhost)
1. Run the newest version of `SUPABASE_SCHEMA.sql` in your Supabase SQL Editor. This will drop the old schema, rebuild the table to accept text UUIDs, and compile the RPCs.
2. Run `npm run dev` to start the app at `http://localhost:5173`.
3. Open the browser as an unauthenticated guest and click **Play via Link**. It works instantly.
4. Copy the link into an Incognito window. You can instantly join as Player B without an account.
5. If one of the players logs in, the game will automatically be pushed to their permanent `history_games` when it ends.

## Security Considerations
- Even though users are anonymous and RLS reads are permissive, writes are incredibly secure. The Postgres RPCs strictly lock the row (`FOR UPDATE`) and refuse mutations unless the provided `playerId` exactly matches the `white_player` or `black_player`.
- Because UUIDs (v4) are 128-bit unguessable tokens, anonymous identities act as secure bearer tokens for the game session.
