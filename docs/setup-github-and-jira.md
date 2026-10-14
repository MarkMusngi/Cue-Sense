# Setup: GitHub Actions, GitHub Protections, and Jira

Do these steps once, in order. Menu names in GitHub and Jira change occasionally, so if a label differs slightly, look for the nearest match.

The Jira project key is `CUE`. Replace `@your-github-username` with your handle wherever it appears in the repo files.

## Order of operations

1. Create the GitHub repo and push the starter files (Part A)
2. Turn on repo security features (Part B)
3. Run Prompts 0 to 2 in Claude Code to get the scaffold and `ci.yml` (Part C)
4. Add branch protection once CI job names exist (Part D)
5. Create the Jira project and connect it to GitHub (Part E)
6. Connect Claude to Jira and create the backlog (Part F)
7. Verify everything (Part G)

---

## Part A: Create the repo and push the starter files

1. On GitHub: **New repository**. Choose private or public, default branch `main`. Do not add a README, `.gitignore`, or license there; this kit and your own `README.md` provide those.
2. Copy these files from the kit into a local folder, alongside your own `README.md` and `docs/` (including `docs/architecture.md`):
   - `AGENTS.md`, `CONTRIBUTING.md`, `.gitignore`, `.editorconfig`
   - `.github/` (PR template, CODEOWNERS, dependabot, workflows)
   - `docs/decisions/` and `docs/SETUP-GITHUB-AND-JIRA.md`
3. Edit `.github/CODEOWNERS`: replace `@your-github-username`.
4. Initialize and push:
   ```bash
   git init -b main
   git add .
   git commit -m "chore: add repo workflow files"
   git remote add origin git@github.com:<you>/<repo>.git
   git push -u origin main
   ```
   The initial push to `main` is the only direct commit. After Part D, everything goes through PRs.

> **Check before committing:** `git status` should show no `.env` files. `.gitignore` already blocks them.

## Part B: Turn on GitHub Actions and security features

### Actions settings
**Settings → Actions → General**
1. **Actions permissions:** allow actions. If you restrict to "GitHub and verified creators", also allow `gitleaks/gitleaks-action@*`.
2. **Workflow permissions:** select **Read repository contents and packages permissions**.
3. Leave **Allow GitHub Actions to create and approve pull requests** unchecked.

### Security settings
**Settings → Code security** (called "Advanced Security" on some plans)
1. Enable **Dependency graph**.
2. Enable **Dependabot alerts** and **Dependabot security updates**.
3. Enable **Secret scanning** and **Push protection**.
4. Enable **Code scanning** (the `security.yml` workflow uploads CodeQL results here).

> **Private repos:** secret scanning, push protection, code scanning, and dependency review may require GitHub Advanced Security, which is a paid add-on on private repos (free on public repos). If a feature is greyed out, the matching job in `security.yml` may fail or be skipped. Either enable the add-on, make the repo public, or remove that job.

### Secrets for workflows
1. **Settings → Secrets and variables → Actions.**
2. No secrets are required right now.
3. **Only if the repo is owned by a GitHub organization:** the gitleaks action needs a license key. Get a free one from gitleaks.io and add it as a repository secret named `GITLEAKS_LICENSE`. Personal-account repos do not need this.

Never put database passwords, API keys, or Jira tokens into workflow files. CI uses a throwaway Postgres service container with test-only credentials.

## Part C: Get `ci.yml` created

Your Prompt 2 already asks Claude Code to create the lint, type-check, pytest, and web-build workflow, so it is not included in this kit.

1. Run Prompts 0, 1, and 2 from your prompts file.
2. **Before Prompt 0:** change it so `CLAUDE.md` begins with an import of this file instead of duplicating it. Add this line to the prompt:
   > "Start CLAUDE.md with the line `@AGENTS.md` so the rules in AGENTS.md are loaded, then add only Claude-specific notes. Do not copy rules from AGENTS.md into CLAUDE.md."
3. **Before Prompt 2:** add this line:
   > "Name the CI jobs clearly (for example `api-test`, `api-lint`, `web-build`) and tell me the exact job names when done. Do not modify the other workflows in `.github/workflows/`."
4. Fill in the command placeholders in `AGENTS.md` section 7 once the scaffold exists.
5. Open the scaffold as a PR (from a branch) and confirm the workflow runs under the **Actions** tab.
6. Now that `apps/web` and `apps/api` exist, Dependabot will stop erroring. Check **Insights → Dependency graph → Dependabot**.

## Part D: Branch protection (rulesets)

Do this after the first CI run, because required checks can only be chosen once GitHub has seen them.

**Settings → Rules → Rulesets → New ruleset → New branch ruleset**
1. **Name:** `protect-main`. **Enforcement:** Active.
2. **Target branches:** add target → Include default branch.
3. Enable:
   - **Restrict deletions**
   - **Block force pushes**
   - **Require a pull request before merging**
     - Required approvals: `1` if someone else can review; `0` if you are working solo (you cannot approve your own PR, so `1` would block you).
     - Require review from Code Owners (optional, useful with the CODEOWNERS file)
   - **Require status checks to pass**
     - Add: `pr-hygiene`, `secret-scan`, `dependency-review`, `codeql (python)`, `codeql (javascript-typescript)`, plus your CI job names from Part C.
     - Enable "Require branches to be up to date before merging".
   - **Require linear history** (optional)
4. Create the ruleset.

If a check never appears in the list, it has not run yet. Open a throwaway PR so it runs once, then return.

## Part E: Jira setup

### 1. Create the project
1. In Jira: **Projects → Create project → Software development** (Scrum or Kanban; Kanban is simpler to start).
2. Name it, and set the **project key** to `CUE`, which this repo already uses.
3. Confirm the workflow has statuses along the lines of **To Do → In Progress → In Review → Done**. Add **In Review** if missing (**Project settings → Workflow**).

### 2. Connect GitHub to Jira
1. In Jira: **Apps → Explore more apps**, search for **GitHub for Jira** (by Atlassian), and install it.
2. Open it, choose **Get started**, sign in to GitHub, and authorize the app for your account or organization.
3. When GitHub asks which repositories to give access to, pick **only this repository**.
4. Wait for the initial sync. Then check that a test branch named `chore/CUE-1-test` (using a real issue key) shows up in the **Development** panel of that Jira issue.

Jira links work by finding the issue key in branch names, commit messages, and PR titles. That is why `AGENTS.md` and `pr-hygiene.yml` require it.

### 3. Add automation rules (no GitHub secrets needed)
**Project settings → Automation → Create rule.** Create three rules:

| Trigger | Action |
|---|---|
| Branch created | Transition issue to **In Progress** |
| Pull request created | Transition issue to **In Review** |
| Pull request merged | Transition issue to **Done** |

These triggers appear once GitHub for Jira is connected. If one is missing, re-check Step 2.

### 4. Suggested issue structure
- **Epics:** one per major area (for example Infrastructure & CI, Data Model, Layout Validation, Drill API, Table Editor, Drill UI, Sessions, E2E Tests, Dashboard).
- **Tasks/Stories:** small enough for one focused agent session, each with acceptance criteria and dependency links.
- **Out of scope:** keep computer vision and AI coaching in a separate "Later" epic or do not create them yet.

## Part F: Connect Claude to Jira and create the backlog

1. **In Claude (claude.ai or the app):** **Settings → Connectors**, find **Atlassian**, and connect it. Sign in with OAuth and grant access to your Jira site.
2. **In Claude Code (optional):** run
   ```bash
   claude mcp add --transport http atlassian https://mcp.atlassian.com/v2/mcp
   ```
   then run `/mcp` inside Claude Code and authenticate. Authentication uses OAuth in the browser; no token goes in the repo.
3. In a new chat, attach `README.md`, `docs/architecture.md`, your prompts file, and `AGENTS.md`, and tell Claude your Jira project key.
4. Ask Claude to review the existing backlog and show you the proposed Epics and issues first. Review the duplicates and the ambiguous-requirement flags, then approve.
5. Only after you approve will Claude create the issues. It should report the created issue keys and any failures.

## Part G: Verify everything

Run through this checklist once:

- [ ] Push a branch named `feat/CUE-1-test` and open a PR titled `feat(api): test (CUE-1)`. The `pr-hygiene` check passes.
- [ ] Change the PR title to `test pr`. `pr-hygiene` fails with a clear message. Change it back.
- [ ] The Jira issue shows the branch and PR under **Development**, and its status moves automatically.
- [ ] `ci.yml` jobs run on the PR and appear as required checks.
- [ ] You cannot push directly to `main` (try it; it should be rejected).
- [ ] **Security → Code scanning** shows CodeQL results after the first run.
- [ ] `git ls-files | grep -E '\.env($|\.)' ` shows only `.env.example`.

## Troubleshooting

| Problem | Likely cause |
|---|---|
| Required check never shows in the ruleset | It has not run on the repo yet; open a PR to trigger it |
| `secret-scan` fails with a license error | Org-owned repo: add `GITLEAKS_LICENSE` (Part B) |
| `dependency-review` or CodeQL errors about Advanced Security | Private repo without the add-on; enable it or make the repo public |
| Dependabot errors about a missing manifest | Directory does not exist yet; goes away after the scaffold |
| PR not linked in Jira | Issue key missing from branch, title, or commits, or repo not authorized in GitHub for Jira |
| Jira automation does not trigger | GitHub for Jira not connected to this repo, or the rule is not enabled |
| You are blocked by your own required review | Set required approvals to `0` for solo work |
