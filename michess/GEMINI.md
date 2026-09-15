IMPORTANT — EXISTING PROJECT



This project has already been created and is located at:



C:\\Users\\mikzqc\\Documents\\Michess\\michess



Do NOT recreate the Vite project, reinstall dependencies unnecessarily, or delete working files.



Current installed dependencies include:



React + Vite + TypeScript

Tailwind CSS v4

chess.js

react-chessboard v5.12.1

lucide-react



The current Phase 1 UI already renders. Copy PGN works, but chess pieces currently cannot be moved. Fix this existing issue first before proceeding to Phase 2.



First inspect the actual files and installed package APIs. Do not assume an API based on an older version.



After fixing the chessboard, test that:



Pieces can be dragged.

Legal moves work.

Illegal moves are rejected.

Move history updates.

FEN updates.

PGN updates.

Flip Board works.

New Game works.



Only after all of these work should you proceed to the next phase.




# Build a complete chess website with Stockfish AI and game review



Create a polished, fully functional chess website called \*\*Michess\*\*.



The website should feel like a modern chess platform, with a clean dark theme, smooth interactions, responsive design, and a professional chessboard.



\## CORE TECHNOLOGY



Use:



\* React + Vite

\* TypeScript

\* Tailwind CSS

\* chess.js for legal move validation, game state, FEN, PGN and SAN notation

\* Stockfish.js WebAssembly running inside a Web Worker

\* LocalStorage for saving settings and completed games



Do not create a fake chess engine or pretend to analyze games. Use a real Stockfish engine.



Use a browser-compatible single-threaded Stockfish build for the first version. Keep the engine implementation modular so it can be upgraded later.



\## PAGE 1: HOME



Create a modern chess homepage with:



\* Logo: Checkmate Arena

\* Play vs Computer button

\* Game Review button

\* Recent Games section

\* Settings button

\* Dark chess-themed background

\* Responsive layout for desktop and mobile



\## PAGE 2: PLAY VS COMPUTER



Create a full chess gameplay screen.



Layout:



Left/main area:



\* Interactive chessboard

\* Standard chess pieces

\* Board coordinates

\* Last-move highlight

\* Legal-move indicators

\* Check and checkmate indication

\* Selected-square highlight

\* Promotion dialog

\* Board flip button



Right panel:



\* Opponent name: Stockfish

\* Opponent rating / difficulty

\* Current evaluation bar

\* Move list

\* New Game button

\* Resign button

\* Undo button

\* Settings



Gameplay requirements:



1\. User can play as White, Black, or Random.

2\. Stockfish makes legal moves.

3\. User cannot move the opponent's pieces.

4\. Detect checkmate, stalemate, threefold repetition, insufficient material and other draw conditions supported by chess.js.

5\. Disable moves while Stockfish is thinking.

6\. Show a thinking indicator.

7\. Store the entire game move history.

8\. Record every move in SAN notation.

9\. Export the game as PGN.

10\. Allow the user to copy the PGN.

11\. Add a difficulty selector.



Difficulty presets:



\* Beginner

\* Easy

\* Medium

\* Hard

\* Master



Use appropriate Stockfish UCI settings such as UCI\_LimitStrength, UCI\_Elo, Skill Level or a configurable search limit. Do not claim that these settings represent exact human ratings.



\## STOCKFISH ENGINE



Create a reusable StockfishEngine service.



Requirements:



\* Load the engine in a Web Worker.

\* Initialize with the UCI protocol.

\* Support isready.

\* Support position fen.

\* Support go depth and/or go movetime.

\* Parse bestmove.

\* Parse info depth, score cp, score mate, pv and nodes where available.

\* Support stop.

\* Handle engine loading errors.

\* Handle engine crashes gracefully.

\* Never block the React UI.

\* Prevent stale engine responses from being applied to the wrong position.

\* Queue or cancel analysis requests safely.



The engine should support two separate modes:



1\. Playing mode: limited search time or depth.

2\. Review mode: stronger analysis of each move.



\## PAGE 3: POST-GAME REVIEW



After a match ends, automatically open a Game Review page.



The review must use Stockfish to analyze the actual game move by move.



Do not merely show a fake score or randomly assign blunders.



\### Review screen layout



Top section:



\* Game result

\* White player

\* Black player

\* Total moves

\* Overall accuracy for White

\* Overall accuracy for Black

\* Game result summary

\* Review progress indicator



Main section:



\* Interactive chessboard

\* Evaluation bar

\* Move list

\* Evaluation graph

\* Current move details

\* Best move arrow

\* Engine principal variation



\### MOVE REVIEW



For every move:



1\. Load the position before the move.

2\. Analyze the position with Stockfish.

3\. Get the best engine move.

4\. Evaluate the position before the move.

5\. Apply the actual move.

6\. Evaluate the resulting position.

7\. Calculate the evaluation loss.

8\. Classify the move.

9\. Display the appropriate review symbol.

10\. Store the result.



Keep separate analysis data for White and Black.



Use centipawn evaluations and mate scores internally.



Normalize the evaluation so positive means good for White and negative means good for Black.



Do not incorrectly classify a move merely because the engine evaluation is negative. A move must be judged relative to the player who made it.



\### REVIEW SYMBOLS



Use the following symbols from the reference image.



Create a reusable MoveClassification component.



Symbols:



!! Brilliant

! Great Move

★ Best Move

👍 Excellent

✓ Good

📖 Book Move

?! Inaccuracy

!? Mistake

? Blunder

?? Missed Win

= Equal

∞ Unclear Position

± White is Slightly Better

∓ White is Winning

+− White is Clearly Better

−+ Black is Winning

−= Black is Slightly Better

⇄ Space Advantage

G Development Advantage

↔ Counterplay

≠ White Win



The UI must use actual chess review symbols, not only colored text labels.



For the main review move list, show:



Move number | White SAN | White symbol | Black SAN | Black symbol



Example:



1\. e4 ★ e5 ✓

2\. Nf3 ! Nc6 ✓

3\. Bb5 !? a6 ✓

4\. Ba4 ?? Nf6 !!



The example above is illustrative only. Classifications must be generated from Stockfish analysis.



\### CLASSIFICATION LOGIC



Create a move classification algorithm based on evaluation loss.



Use configurable thresholds.



For example:



\* Best Move: negligible loss and close to the engine's top move.

\* Excellent: very small loss.

\* Good: small loss.

\* Inaccuracy: noticeable loss.

\* Mistake: substantial loss.

\* Blunder: severe loss.

\* Missed Win: a winning opportunity was lost.

\* Brilliant: only assign when the move meets a strong tactical or positional criterion, not just because it is the engine's first choice.



Do not present arbitrary thresholds as official Chess.com or Lichess standards.



Make thresholds configurable in one file.



Handle:



\* Forced moves

\* Checkmates

\* Tactical positions

\* Promotions

\* Captures

\* Forced sacrifices

\* Mate scores

\* Winning positions

\* Losing positions

\* Drawn positions



Do not mark a move as a blunder simply because it changes the engine's numerical evaluation from positive to negative without accounting for perspective and mate scores.



\### GAME REVIEW GRAPH



Create a chess evaluation graph below or beside the board.



Requirements:



\* X-axis: move number

\* Y-axis: evaluation

\* White advantage above zero

\* Black advantage below zero

\* Draw at zero

\* Mate values displayed separately as M1, M2, etc.

\* Plot the evaluation after each move.

\* Highlight inaccuracies, mistakes and blunders.

\* Clicking a graph point jumps to that move.

\* Clicking a move in the move list jumps to that position.

\* Use a smooth but accurate graph.

\* Do not hide meaningful evaluation changes.



\### REVIEW MOVE DETAILS



When selecting a move, show:



\* Move number

\* SAN notation

\* Classification

\* Evaluation before

\* Evaluation after

\* Evaluation loss

\* Best engine move

\* Principal variation

\* Short explanation



Example:



Move 18. Qxd5?



Blunder



You lost approximately 2.4 pawns of evaluation.



Best move: Nxd5



Engine line: Nxd5 Qxd5 Qxd5



Keep explanations based on the engine's actual analysis. Do not invent tactical reasons.



\### REVIEW CONTROLS



Add:



\* Previous move

\* Next move

\* First move

\* Last move

\* Play through game

\* Pause review

\* Board flip

\* Show best move arrow

\* Copy PGN

\* Download PGN

\* Review again



\## ACCURACY



Calculate separate accuracy scores for White and Black.



Use a clearly documented evaluation-to-accuracy formula.



Do not claim that the scores exactly match Chess.com or Lichess.



Display:



White Accuracy: 87%

Black Accuracy: 74%



These are example formats, not hardcoded results.



\## DESIGN



Style:



\* Professional chess platform

\* Dark navy / charcoal theme

\* Green for good moves

\* Yellow for inaccuracies

\* Orange for mistakes

\* Red for blunders

\* White / neutral for normal moves

\* Clean typography

\* Smooth hover and click interactions

\* Accessible controls

\* Responsive layout

\* No excessive gradients

\* No unnecessary animations



The chessboard should be the main focus.



\## ENGINE PERFORMANCE



Do not run expensive analysis for the entire game all at once on the main UI thread.



Use a review queue.



Show:



Analyzing game... 12 / 42 positions



Allow the user to cancel analysis.



Cache analysis results by FEN and analysis settings.



Use a lower search depth or time for quick reviews and a higher limit for deep reviews.



\## IMPORTANT FUNCTIONAL REQUIREMENTS



\* No fake buttons.

\* No fake Stockfish responses.

\* No placeholder review data once the game is finished.

\* All chess moves must be legal.

\* SAN must be generated from chess.js.

\* Engine must return actual legal best moves.

\* Handle engine loading failures.

\* Handle refreshes safely.

\* Keep all game data consistent.

\* Write clean reusable components.

\* Include a README with setup instructions.



\## IMPLEMENTATION ORDER



Build the project in this order:



1\. Project setup and theme.

2\. Chessboard and legal moves.

3\. Local chess game.

4\. Stockfish Web Worker.

5\. Play vs computer.

6\. Move history and PGN.

7\. Game completion detection.

8\. Review engine queue.

9\. Move classification.

10\. Accuracy calculation.

11\. Evaluation graph.

12\. Review navigation.

13\. Settings and polish.



Start by implementing the complete playable chess game. Then implement real Stockfish review.



At the end, provide the complete working project with all files and setup instructions.



You are my lead developer. Build this project with me step by step.



Start by creating the complete playable chess website with React, TypeScript, chess.js and Stockfish.js.



Do not just explain how to build it. Write the actual code.



After each major feature, make sure the existing features still work.



When you finish the first version, tell me exactly how to run it locally on Windows 11 using VS Code.



Use the attached image as the reference for the chess move review symbols.



Begin with Phase 1: Create the project and implement a fully playable chessboard with legal moves, move history and PGN.





Do not attempt to generate the entire project in a single response. Work phase-by-phase. For each phase, create the required files, explain what was implemented briefly, and verify that the existing functionality remains intact before moving to the next phase. If a response would become too large, stop at a clean checkpoint and continue from that checkpoint when asked. Never replace working functionality with placeholders just to move forward.

