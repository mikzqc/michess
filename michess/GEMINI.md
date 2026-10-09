\# MICHESS — PROJECT RULES



\## 1. Project Overview



Michess is a lightweight, modern chess website focused on playing chess, analyzing games, solving puzzles, and improving as a player.



The goal is to build a reliable, polished chess platform with a distinctive identity, clean code, and excellent usability.



Every new feature must fit into the existing application rather than making it feel like a collection of disconnected features.



\## 2. Development Principles



\* Always inspect the existing implementation before making changes.

\* Understand how the relevant components, hooks, routes, database tables, and utilities work before modifying them.

\* Preserve existing functionality unless the task explicitly requires changing it.

\* Never rebuild the entire project to implement a small feature.

\* Prefer targeted, incremental changes over unnecessary refactoring.

\* Reuse existing components, utilities, hooks, and services.

\* Avoid duplicate implementations of features that already exist.

\* Fix root causes instead of hiding symptoms.

\* Do not implement features with placeholder logic and claim they are complete.

\* Do not stop at a superficial implementation when the task requires a functional feature.

\* If a requirement conflicts with the existing architecture, choose the smallest maintainable solution.

\* If an important change could break existing functionality, inspect its dependencies before proceeding.



\## 3. Existing Technology Stack



Preserve the existing technology stack unless a change is genuinely necessary.



\* React

\* Vite

\* TypeScript

\* Tailwind CSS v4

\* chess.js

\* react-chessboard

\* Stockfish.js / WebAssembly

\* Supabase authentication

\* Supabase database and REST API

\* Supabase Row Level Security (RLS)

\* LocalStorage where already appropriate

\* Lucide icons



Do not migrate frameworks, replace libraries, or introduce a new state-management system without a compelling technical reason.



Do not install new dependencies when existing tools can solve the problem.



\## 4. Visual Identity



Michess must maintain a consistent visual identity.



\### Design direction



\* Dark blue as the primary visual identity.

\* Clean, modern, chess-focused interface.

\* Professional without looking corporate or generic.

\* Clear hierarchy and readable typography.

\* Consistent spacing, borders, radii, and component styles.

\* Minimal unnecessary decoration.

\* Restrained animations and transitions.

\* Responsive layouts across supported devices.



\### Avoid



\* Unnecessary purple gradients.

\* Excessive glassmorphism.

\* Excessive glowing effects.

\* Giant rounded cards everywhere.

\* Excessive animations.

\* Emoji-heavy interfaces.

\* Generic AI-generated-looking designs.

\* Inconsistent button styles.

\* Random colors that conflict with the existing theme.

\* Unnecessary redesigns of working pages.



Before creating a new UI component, check whether an existing component can be reused.



\## 5. Chess Rules and Game Integrity



Chess functionality must follow actual chess rules.



\* Use chess.js for legal move validation and game-state logic where appropriate.

\* Never implement a separate, conflicting chess-rules engine without a compelling reason.

\* Correctly handle check, checkmate, stalemate, castling, en passant, promotion, repetition, and applicable draw conditions.

\* Maintain correct board orientation for each player.

\* Keep move history synchronized with the board position.

\* Ensure clocks and game results are handled consistently.

\* Prevent illegal moves and invalid positions.

\* Handle game completion, resignation, timeouts, and draws correctly.

\* Do not trust client-submitted results without appropriate validation.

\* Ensure rematches and game creation cannot accidentally create duplicate games.



Any changes to chess logic must be tested against existing gameplay.



\## 6. Stockfish and Game Analysis



Reuse the existing Stockfish integration.



\* Avoid creating unnecessary engine workers.

\* Terminate workers and subscriptions when no longer needed.

\* Prevent analysis from freezing the interface.

\* Handle engine initialization failures.

\* Handle cancellation and position changes correctly.

\* Keep engine evaluations synchronized with the selected position.

\* Do not display fabricated evaluations, best moves, accuracy values, or move classifications.

\* Distinguish engine analysis from authoritative game results.

\* Calculate accuracy and move classifications using a consistent, documented methodology.

\* Make deeper analysis optional when it would significantly increase processing time.

\* Keep analysis usable on lower-powered devices.



\## 7. Puzzle System



Puzzles must use valid positions and reliable move sequences.



\* Validate puzzle positions and moves.

\* Use the existing chess logic for move legality.

\* Correctly handle multi-move solutions and opponent responses.

\* Prevent invalid interactions during loading or completion.

\* Provide clear feedback for correct and incorrect moves.

\* Allow retries where appropriate.

\* Handle missing or invalid puzzle data gracefully.

\* Never invent puzzle solutions or statistics.

\* Store user progress using the existing data architecture.

\* Keep puzzle boards responsive.

\* Avoid downloading large puzzle datasets unnecessarily.

\* Ensure daily puzzles, if implemented, remain consistent across users and time zones.



\## 8. React and TypeScript Standards



\* Use TypeScript properly.

\* Avoid `any` unless absolutely necessary and justified.

\* Reuse existing types and interfaces.

\* Keep components focused and maintainable.

\* Extract shared logic into reusable hooks or utilities when appropriate.

\* Avoid excessively large components.

\* Avoid unnecessary abstractions for trivial functionality.

\* Keep React hooks compliant with their rules.

\* Use stable keys for rendered lists.

\* Prevent unnecessary re-renders.

\* Clean up event listeners, subscriptions, and workers.

\* Avoid stale state and race conditions.

\* Do not suppress TypeScript errors merely to make the build pass.

\* Remove unused imports, dead code, and obsolete implementations introduced during development.



\## 9. Supabase and Database Rules



Supabase is the existing backend. Preserve its configuration and established patterns.



\* Reuse the existing Supabase client.

\* Do not create duplicate clients without a clear reason.

\* Reuse existing tables when appropriate.

\* Inspect existing schemas before adding or changing tables.

\* Avoid unnecessary migrations.

\* Use appropriate indexes and constraints.

\* Use transactions or atomic database operations where needed to protect consistency.

\* Handle failed requests and network errors.

\* Avoid redundant queries.

\* Keep database access patterns consistent.

\* Never expose service-role keys or other secrets in client-side code.

\* Do not hardcode credentials.

\* Do not alter production data to make tests pass.

\* Document any required schema or policy changes.



When changing the database, ensure existing features remain compatible with the new schema.



\## 10. Security and Authentication



Security must be enforced by the backend, not just the UI.



\* Use Supabase RLS wherever appropriate.

\* Users must not be able to edit another user's private profile or data.

\* Validate ownership before modifying protected records.

\* Protect friend requests, challenges, notifications, and game records against unauthorized modifications.

\* Do not trust user IDs supplied by the client without verification.

\* Validate and sanitize user-generated content.

\* Prevent unauthorized access through guessed IDs.

\* Do not expose private account information through profiles or guest links.

\* Keep secrets out of source code, logs, and client bundles.

\* Never weaken security policies simply to make a feature work.

\* Treat guest access as a separate permission model that must be explicitly validated.



Review database policies whenever a feature introduces new tables or access patterns.



\## 11. Authentication and User Profiles



\* Preserve existing authentication flows.

\* Handle logged-out, loading, and authenticated states properly.

\* Prevent duplicate or inconsistent profile records.

\* Restrict profile editing to the profile owner.

\* Avoid exposing private email addresses or account metadata.

\* Handle expired sessions and authentication failures gracefully.

\* Keep guest functionality working where supported.

\* Do not require an account for existing guest features unless explicitly requested.



\## 12. Friends, Challenges, and Notifications



Keep social features lightweight and chess-focused.



\* Validate friend requests and challenge permissions.

\* Prevent duplicate or contradictory requests.

\* Ensure accepted challenges create only one game.

\* Restrict notifications to their intended recipients.

\* Track read/unread notification state reliably.

\* Clean up realtime subscriptions.

\* Avoid duplicate notifications caused by repeated events.

\* Make notification actions navigate to the correct destination.

\* Handle unavailable opponents and expired challenges.

\* Do not introduce fake users, fake online status, or fake activity.

\* Do not implement leaderboards or an opening explorer unless explicitly requested.



\## 13. Responsive Design



All new features must work with the existing responsive design.



Test relevant pages at:



\* Desktop resolutions.

\* Smaller laptop resolutions.

\* iPad/tablet resolutions.

\* Mobile portrait.

\* Mobile landscape.



Pay special attention to the chessboard, move list, engine panel, navigation, modals, forms, profiles, puzzles, and notifications.



\* Prevent horizontal overflow.

\* Keep interactive controls accessible.

\* Avoid unreadably small text.

\* Ensure dialogs fit within the viewport.

\* Preserve usable board proportions.

\* Avoid fixed widths that break smaller screens.

\* Prefer responsive CSS and existing layout patterns.

\* Do not fix mobile layouts by breaking desktop layouts.



\## 14. Performance



\* Keep initial page loads lightweight.

\* Avoid unnecessary dependencies.

\* Avoid redundant database requests.

\* Avoid excessive realtime subscriptions.

\* Load large resources only when needed.

\* Keep Stockfish work off the main thread where the existing architecture supports it.

\* Avoid unnecessary re-renders and expensive calculations.

\* Clean up unused workers and resources.

\* Do not sacrifice correctness or security for marginal performance improvements.



\## 15. Error Handling



Every major feature must have appropriate loading, success, empty, and error states.



\* Never leave the user on a permanently spinning loader.

\* Never silently swallow important failures.

\* Show concise, understandable error messages.

\* Keep technical details in development logs when appropriate.

\* Avoid exposing secrets, internal stack traces, or sensitive data to users.

\* Provide retry options when retrying is safe.

\* Handle offline states and expired sessions gracefully.

\* Prevent failed requests from leaving the UI in an inconsistent state.



\## 16. Accessibility and Usability



\* Use semantic HTML.

\* Provide accessible labels for icon-only buttons.

\* Support keyboard navigation where appropriate.

\* Provide visible focus indicators.

\* Maintain adequate contrast.

\* Use clear button labels and feedback.

\* Avoid relying exclusively on color to communicate chess or game states.

\* Respect reduced-motion preferences where practical.

\* Make errors understandable and actionable.



\## 17. Testing and Verification



After implementing a feature:



1\. Run the relevant build or development checks.

2\. Check TypeScript errors.

3\. Check the browser console.

4\. Test the changed feature's main flow.

5\. Test important failure states.

6\. Check related existing features for regressions.

7\. Verify database permissions when backend access changes.

8\. Verify responsive behavior when the UI changes.

9\. Fix errors caused by the implementation.

10\. Report anything that remains untested.



Do not claim tests passed unless they were actually run.



Do not claim a feature is fully functional if only its interface has been implemented.



Prefer targeted tests for the affected functionality, followed by broader regression testing for major changes.



\## 18. Git and Change Management



\* Inspect the current working tree before making changes.

\* Do not overwrite unrelated user changes.

\* Do not delete files without understanding their purpose.

\* Keep changes focused and reviewable.

\* Avoid committing secrets or generated junk.

\* Do not automatically force-push, reset, or discard user work.

\* Do not deploy changes unless explicitly authorized.

\* Keep environment configuration intact.

\* Explain any manual setup required after implementation.



\## 19. Working With Existing Code



Before modifying a feature:



1\. Locate the relevant files.

2\. Read the existing implementation.

3\. Identify dependencies and related components.

4\. Determine which existing utilities can be reused.

5\. Make the smallest maintainable change.

6\. Test the result.

7\. Check for regressions.



Do not assume a feature is missing simply because its implementation is not in the first file inspected.



Do not recreate existing functionality under a different name.



Do not perform broad refactors unrelated to the task.



\## 20. Final Response Requirements



After completing a task, provide a concise report containing:



\* What changed.

\* Which important files or components changed.

\* Any database migrations or configuration changes required.

\* What tests were actually performed.

\* Any known bugs or remaining limitations.

\* Any manual steps the user must complete.



Be honest about incomplete work.



Do not dump the entire codebase into the response.



Do not provide lengthy explanations of trivial changes.



\## 21. Final Priority Order



When making engineering decisions, prioritize:



1\. Correctness and chess-rule accuracy.

2\. Security and data integrity.

3\. Reliability.

4\. Preservation of existing functionality.

5\. User experience and responsive design.

6\. Maintainability.

7\. Performance.

8\. New features and visual polish.

A smaller feature that works reliably is better than a large feature that only appears to work.

## 22. Mandatory Localhost Verification

**Always run the local development server after completing development work. This is mandatory for every task.**

1. Finish implementing the requested changes.
2. Run the relevant build and TypeScript checks.
3. Start the local development server using the project's existing setup, typically `npm run dev`.
4. Keep the server running so the user can access the site locally.
5. Open the local website in a browser and verify that it loads correctly.
6. Test the modified features and check the browser console for errors.
7. Fix any issues caused by the changes and repeat verification.
8. Report the local URL, such as `http://localhost:5173/`, and summarize what was tested.

**Important rules:**

* Never skip starting the development server after finishing a task.
* Do not start duplicate development servers if one is already running.
* Reuse the existing terminal session when possible.
* If the default port is occupied, use the next available port and report the actual URL.
* Do not claim the site was tested locally unless it was actually opened and checked.
* If the server cannot start, investigate and fix the issue before declaring the task complete.
* If an external service such as Supabase prevents full testing, explain the limitation honestly.
* Do not stop the development server immediately after verification. Leave it running for the user.
* Do not deploy the site unless explicitly instructed.

**Definition of done:** The requested changes are implemented, relevant checks have been performed, and the local Michess website is running and accessible.


\*\*Core rule: Improve Michess incrementally. Preserve what works, understand what exists, and never sacrifice correctness, security, or usability just to add more features.\*\*



