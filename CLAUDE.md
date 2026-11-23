@AGENTS.md

## Claude Code notes

- The shared rules above come from `AGENTS.md`. Change them there, then run `npm run sync:rules`, never in this file or in the Cursor rule.
- At the start of a session read `Docs/tasks.md` and `git log` to see what Cursor and GPT changed since last time.
- Claude Code owns design-heavy work that spans core, saves and 3D (stage 2 generations: relationships, marriage, children, inheritance). Hand self-contained work to Cursor or GPT as a task in `Docs/tasks.md` with its files listed.
- Save Claude tokens (the user's standing request): for every new feature, first split it. Claude writes the design and does only the core part that needs judgment; screens on an existing core, art, sound and scoped features go to Cursor; reviews, English copy, tests and small isolated features go to GPT. Write each as a task in `Docs/tasks.md` (owner, files touched, paste-ready "전달할 내용"), ordered so core lands first and no two running tasks touch the same files. Prefer writing a task over doing UI or art work yourself, even when it would be quick.
