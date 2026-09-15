# Import System (User Games) - Implementation Report

## Files Updated/Created
* `src/components/ImportGame.tsx` - Re-architected to support a top-level mode switch between **Import Game** and **Import User**. 
* `src/utils/importUtils.ts` - Fixed regex escaping issues and added `fetchLichessUserGames` / `fetchChesscomUserGames`. Replaced arbitrary hashes with stable identifiers when available (e.g., Lichess Game ID or Chess.com Game URL).
* `src/hooks/useImportQueue.ts` (NEW) - Handles a temporary, persistent queue (Local Storage: `michess_import_queue`) exclusively for imported items pending review. Prevents duplicate imports based on stable `id`.

## 1. Import Game (Existing functionality preserved)
* Still seamlessly allows importing single matches via Paste PGN, `.pgn` file upload, Lichess URL, and Chess.com URL. 
* Instead of immediately loading the game, successfully parsed games are pushed into the **Ready to Review** queue at the bottom of the screen, allowing you to batch imports.

## 2. Import User (New functionality)
* **Platform Toggles**: Select between Chess.com and Lichess.
* **Username Input**: Enter any public username.
* **Max Games Select**: Fetch up to 5, 10, 20, or 50 games.
* **Chess.com Strategy**: Fetches the player's monthly game archives, starting from the most recent month, recursively working backward until the quota is filled, then parsing the JSON for PGNs.
* **Lichess Strategy**: Hits the Lichess bulk game export API (`pgnInJson=true`) requesting `application/x-ndjson`, and parses the newline-delimited stream exactly up to the limit.

## 3. UI and Flow
* Shows a clean loading state while fetching.
* Displays a detailed list of fetched games containing:
  * White and Black player names
  * Match Result (1-0, 1/2-1/2, etc.)
  * Date played
  * Opening (ECO)
* Checkboxes are provided beside every game, alongside a **Select All** toggle at the top of the list.
* Clicking **Import Selected** moves the chosen matches into the **Ready to Review** queue.

## 4. Integration
* Handled the strict scope correctly: No user accounts, database, cloud sync, or full-scale history architecture were built. The temporary local queue serves strictly as a bridge to send games into the existing `ReviewArea.tsx` analysis environment.
* `npm run build` executed flawlessly.
