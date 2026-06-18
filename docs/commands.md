# Commands

Yargs loads everything from `src/commands/` automatically (the `commandDir` call in `src/index.ts`), excluding `ICommand.ts` and `AfterCommand.ts`. Each file exports a `CommandModule<Input, Input>`.

## `rio init <alias>` — `rio i`

Scaffold a new project from the `rio-cos-templates@v2` GitHub repo.

```bash
rio init my-project --profile DEFAULT
```

| Flag | Type | Required | Default | Notes |
|---|---|---|---|---|
| `alias` (positional) | string | ✅ | — | Folder name + RIO project alias |
| `--profile` / `-p` | string | ✅ | — | Profile name in `~/.rio-cli/rio` |

Flow (`src/commands/init.ts`):

1. Validates that `<alias>` folder doesn't already exist
2. Resolves profile config
3. `Api.createAPI(profile_config)` — connects to RIO without a target projectId
4. `api.createNewProject(alias)` — calls `Project.INIT` (anonymous on the class but `cli` identity is allowed), gets back `{ projectId, detail }`
5. `mkdir <alias>`, `chdir` into it
6. `Repo.downloadAndExtractGitRepoV2(profile, alias, projectId)`:
   - Downloads `https://github.com/rettersoft/rio-cos-templates/archive/refs/heads/v2.zip`
   - Extracts in-place, moves files up one level
   - Writes `rio.json` with the new `projectId`
   - Updates `package.json#name` to `<alias>`
   - Injects `"deploy": "rio d --p <profile> --pid <projectId> --i"` into `package.json#scripts`

After this you can `cd <alias> && npm run deploy`.

## `rio deploy` — `rio d`

Save **and** deploy. The headline command.

```bash
rio deploy [--profile DEFAULT] [--project-id <id>] [--classes <c1> <c2>] [--force] [--skip-diff-check] [--test] [--ignore-approval]
```

| Flag | Alias | Default | Purpose |
|---|---|---|---|
| `--profile` | `-p` | `DEFAULT` | Which `~/.rio-cli` profile to use |
| `--project-id` | `--pid` | from `rio.json` | Override `rio.json` |
| `--classes` | `-c` | (all) | Limit deploy to specific class names |
| `--force` | `-f` | `false` | Sent to `Project.deploy` as `body.force` — tells the backend to deploy even if a deploy is currently in progress for the class |
| `--skip-diff-check` | `-s` | `false` | Skip the local-vs-remote file diff (re-uploads everything, marked as "forced") |
| `--test` | `-t` | `false` | Sent to `Project.deploy` as `body.test` — test environment deploy |
| `--ignore-approval` | `-i` | `false` | Skip the "are you sure?" prompt |

Both `deploy` and `save` route to `saveAndDeploy(args)` in `src/lib/save-and-deploy.ts`. The only difference is `args['save-only']`:

- `deploy.ts` sets `args["save-only"] = false`
- `save.ts` sets `args["save-only"] = true`

Then `saveAndDeploy`:

1. Print "Command Configuration:" table
2. `Api.createAPI(profile_config, projectId)` — auth + `Project.GET` on target
3. Branch on `api.isV2`:
   - v2 → `processV2(api, args)` — uses `lib/v2/analyze.ts` + `lib/v2/deploy.ts`
   - v1 → `processV1(api, args)` (legacy, ignored)
4. v2 flow:
   - **Gather information** → `analyze({ api, skipDiff, classes })` returns the local-vs-remote diff
   - Print summary (`printSummaryV2`) — added/edited/deleted/forced files per class + project files/models/dependencies
   - If `isChanged === false`: print "No Changes" and exit
   - Prompt "Are you sure to proceed?" unless `--ignore-approval`
   - `deployV2({ api, analyzationResult, force, test, deploy })`
     - Sends project files + models in one call (`setContents`)
     - Uploads any new/changed dependencies (zip → presigned URL → commit)
     - Creates new classes via `Project.createClass`
     - Sends class files in chunks of 10 (`Promise.all` per chunk) via `RetterClass.setClassFiles`
     - If `deploy=true`: calls `Project.deploy` and `waitDeploymentV2(deploymentId)`

Full pipeline detail: [`deploy-pipeline.md`](deploy-pipeline.md).

## `rio save` — `rio s`

Same as `deploy` but stops short of triggering the actual Lambda deploy. The files are uploaded into RIO's state (so the console reflects them); the user has to deploy manually from the console afterwards.

Flags are a subset of `deploy`: no `--force`, no `--test`. Internally sets `args["save-only"] = true`.

## `rio get-settings` — `rio gs`

Pull `loggingAdapters` and `stateStreamTargets` from the remote `Project` instance into a local `rio.json`.

```bash
rio get-settings [--profile DEFAULT] [--project-id <id>]
```

Flow (`src/commands/get-settings.ts`):

1. Read profile + projectId
2. Connect API
3. Require `api.isV2` — throws if v1 ("This command is only available for v2 & v projects" — typo in source)
4. Parallel: `api.getStateStreamTargets()` + `api.getLoggingAdapters()`
   - Both strip `mappingId` from the response (it's a backend-managed field; shouldn't be in source-of-truth)
5. Build `{ projectId, loggingAdapters, stateStreamTargets }` object
6. Validate via `V2ProjectConfig.safeParse(...)`
7. Write to `./rio.json` (overwriting any existing file)

The user is expected to commit `rio.json` to their repo — it becomes the declarative source of truth for these settings.

## `rio set-settings` — `rio ss`

Inverse of `get-settings`: read local `rio.json`, push to remote.

```bash
rio set-settings [--profile DEFAULT] [--project-id <id>]
```

Flow (`src/commands/set-setttings.ts` — note the 3 `t`s):

1. Read profile + projectId
2. Read + parse `rio.json` (must exist, must be valid JSON, must satisfy `V2ProjectConfig` zod schema)
3. Connect API
4. Require `api.isV2`
5. Fetch current remote `getStateStreamTargets(false)` / `getLoggingAdapters(false)` — passing `false` keeps the `mappingId`
6. Merge: for each entry in local `rio.json`, find the matching entry on remote by `id`, copy its `mappingId` into the local entry. New entries (no matching `id`) are sent without `mappingId` → backend creates fresh
7. Call `api.setLogginAdaptors({ loggingAdapters })` and/or `api.setStateStreamTargets({ targets })` — only when there are entries to send

Note: the `mappingId` flow is important. Without it, every `set-settings` would create new state-stream subscriptions and orphan the old ones, leaving dead subscriptions accumulating in the backend.

## `rio set-profile` — `rio sp`

Upsert (insert-or-update) a profile in `~/.rio-cli/rio`.

```bash
rio set-profile \
    --profile-name DEFAULT \
    --secret-id <id> \
    --secret-key <key> \
    --endpoint api.<customer-domain> \
    [--no-auth-dump]
```

| Flag | Type | Required | Default | Purpose |
|---|---|---|---|---|
| `--profile-name` | string | — | `DEFAULT` | Name to store under |
| `--secret-id` | string | ✅ | — | From `User.state.public.credentials.secretId` |
| `--secret-key` | string | ✅ | — | From `User.state.public.credentials.secretKey` |
| `--endpoint` | string | — | (uses `RIO_CLI_URL` env at runtime) | Target API host |
| `--no-auth-dump` | boolean | — | `false` | Suppress auth info from console output |

The profile file is created if it doesn't exist (via `bootstrap.ts:install()` which fires on `postinstall`). Otherwise the named profile is merged into the existing `{ profiles: { ... } }` object.

## `rio list-profiles` — `rio lp`

Print the current profile table.

```bash
rio list-profiles
```

No flags. Output:

```
┌────────────────┬─────────────────┬────────────────────────┐
│ Profile Name   │ Secret          │ EndPoint               │
├────────────────┼─────────────────┼────────────────────────┤
│ DEFAULT        │ ABCD-EFGH-...   │ api.cn6mbumkh.retter.io│
│ staging        │ XYZ-...         │ api.stage.example.com  │
└────────────────┴─────────────────┴────────────────────────┘
```

`secretKey` is not shown (only `secretId`).

## `$0` (default)

If no command is given, yargs shows the help and exits. See `src/commands/default.ts`.

## Lifecycle hooks

`AfterCommand.ts` calls `process.exit()` after each handler returns. This avoids hanging on undisposed handles (axios keep-alive sockets, etc.) that the SDK / Listr might leave open.

`bootstrap.ts` is wired into npm's `postinstall` / `preuninstall` via `package.json#scripts`. On postinstall it creates `~/.rio-cli/` with an empty profile file if absent. On preuninstall it does nothing (the cleanup branch is commented out — uninstalling the CLI preserves profiles by design).
