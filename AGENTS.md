# MicroHub development checkpoints

Use [docs/DEVELOPMENT_PROGRESS.md](docs/DEVELOPMENT_PROGRESS.md) as the canonical development log.

## Resume work

1. Read the latest checkpoint, the relevant product specifications, and any later user decisions. Compare them with the existing implementation.
2. Check `git status -sb`, the current branch, recent commits, and staged and unstaged changes. Preserve unfinished work and verify any conflicts between the log and Git history before editing.
3. Inspect committed Supabase migrations and the migration history of the intended environment if authorized access exists. Identify the target before querying it. If the hosted history is inaccessible, record it as unverified and continue with independent development and local verification. Treat files in Git, local test execution, and hosted application as separate evidence.
4. Continue from the last verified checkpoint or recoverable uncommitted work. Recheck only what changed or what was left unverified. Carry forward the product requirements, technical constraints, security checks, necessary tests, and acceptance criteria.

## Save progress

- After completing an independently verifiable feature, update the development log and commit it with the implementation. Record the branch, completed and remaining work, decisions, verification results, known issues, and the next concrete step. Use the enclosing Git commit as the checkpoint reference once committed.
- For migrations, record filename and version, target environment, execution status, and verification evidence. Before applying a migration, compare its version with the target's history. If something ran outside the CLI, verify the schema and history before resolving a mismatch. Never replay a migration on inference or rewrite migration history without authorization.
- If work is interrupted before a feature is complete, record the partial state when possible, including uncommitted changes, pending tests and the last known good commit. A partial checkpoint cannot be marked complete.
- Preserve the [original product requirements](docs/SOURCE_REQUIREMENTS.zh-CN.txt), [feature matrix](docs/FEATURE_MATRIX.md), and module specifications. Record approved changes to scope or acceptance criteria alongside the original requirements. Do not omit functionality, security checks, or necessary verification to save context.

## Publish finished changes

- Keep the base branch `main` and the GitHub Pages deployment branch `codex/github-pages` current after finishing a change. Run the project checks and fast-forward both branches to the verified release commit.
- Wait for the Pages workflow and confirm that the served commit matches the release. When a database change is pending, keep the existing site usable during the transition and report which features still depend on the migration.
