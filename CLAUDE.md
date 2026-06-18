# rio-cli

`@retter/rio-cli` — the **command-line tool usercode developers install** to manage their RIO projects from outside the console. Provides scaffolding, save-only and full-deploy paths, profile management, and project-config sync.

```bash
npm install -g @retter/rio-cli
rio --help
```

The binary is `rio` (defined in `package.json#bin`).

## What it does

Talks to a customer's RIO endpoint as the special `cli` identity. Every command:

1. Loads a local **profile** (`~/.rio-cli/rio`) — `{ secretId, secretKey, endpoint }`.
2. Mints a custom token via `User.generateCustomTokenForRioCLI` (in `retter-io-root`, signed with the profile's `secretKey`).
3. Authenticates the `@retter/sdk` (`Retter`) client with that custom token.
4. Calls into `Project` / `RetterClass` methods to read or mutate the project.

Once authenticated, the SDK reports `core_version` via the `x-rio-version` response header. The CLI branches on `2.x` vs older: v1 is legacy (per-class save+deploy) and **all current accounts run v2**. This document focuses on v2.

## Repo layout

```
rio-cli/
├── package.json                       # name: @retter/rio-cli, bin: rio → ./dist/index.js
├── readme.md                          # user-facing docs (commands quick reference)
├── docs/img.png                       # asset for readme
├── src/
│   ├── index.ts                       # yargs entry — auto-loads ./commands/
│   ├── bootstrap.ts                   # postinstall/preuninstall hooks (create ~/.rio-cli/)
│   ├── config.ts                      # constants: paths, env-var names, version
│   ├── commands/
│   │   ├── init.ts                    # rio init <alias> — scaffold new project
│   │   ├── deploy.ts                  # rio deploy / d — save + deploy
│   │   ├── save.ts                    # rio save / s — save only (no deploy)
│   │   ├── get-settings.ts            # rio gs — pull rio.json (logAdapters, stateStreamTargets) from remote
│   │   ├── set-setttings.ts           # rio ss — push rio.json to remote   (yes the filename has 3 't's)
│   │   ├── setProfile.ts              # rio set-profile / sp — upsert ~/.rio-cli profile entry
│   │   ├── listProfiles.ts            # rio list-profiles / lp — list profiles
│   │   ├── default.ts                 # $0 — yargs help fallback
│   │   ├── ICommand.ts                # GlobalInput type
│   │   └── AfterCommand.ts            # process.exit cleanup
│   ├── Interfaces/                    # IProjectDetail, IProjectTemplate
│   └── lib/
│       ├── Api.ts                     # @retter/sdk wrapper: getCloudObject, call methods, subscribe to state
│       ├── Auth.ts                    # generateCustomTokenForRioCLI exchange
│       ├── CliConfig.ts               # read/write ~/.rio-cli/rio (profiles)
│       ├── Repo.ts                    # download project template from rettersoft/rio-cos-templates
│       ├── save-and-deploy.ts         # dispatch v1 vs v2; shared command flow for deploy + save
│       ├── v1/                        # legacy path — kept for old accounts, ignore for new work
│       └── v2/
│           ├── analyze.ts             # local-vs-remote diff (files/models/dependencies/classes)
│           ├── deploy.ts              # apply diff: setProjectFiles, upsertDependency, createClass, setClassFiles, then api.deployProjectV2
│           ├── contents-class.ts      # listClassNames, fetchLocal/RemoteClassContents
│           ├── contents-project.ts    # fetchLocal{Files,ModelContents,Dependencies}, fetchRemoteProjectFiles
│           ├── types.ts               # Zod schemas: V2ProjectConfig, LogAdapter, StateStreamTarget
│           └── utils.ts               # listFilesRecursively, getProjectConfig, sleep
```

## Commands

| Command | Alias | What it does |
|---|---|---|
| `rio init <alias>` | `i` | Create a new RIO project: calls `Project.INIT` to mint a `projectId`, downloads the v2 template from `rettersoft/rio-cos-templates@v2`, writes `rio.json` with the new `projectId`, injects a `deploy` script into `package.json` |
| `rio deploy` | `d` | Save local changes to RIO, then trigger a deployment. Subscribes to `Project.state.public.deployments[<id>]` to stream deploy progress |
| `rio save` | `s` | Same as deploy but `--save-only` — pushes files/models/dependencies/classes to RIO without triggering an actual Lambda deploy |
| `rio get-settings` | `gs` | Fetch `loggingAdapters` and `stateStreamTargets` from the project, write them into local `rio.json` |
| `rio set-settings` | `ss` | Read local `rio.json`, push `loggingAdapters` and `stateStreamTargets` to RIO. Preserves remote `mappingId` for existing entries |
| `rio set-profile` | `sp` | Upsert a named profile in `~/.rio-cli/rio` (`--secret-id`, `--secret-key`, `--endpoint`) |
| `rio list-profiles` | `lp` | Print the profile table |

Global flag: `--profile <name>` (defaults to `DEFAULT`). Most commands also accept `--project-id` / `--pid` to override the `projectId` from `rio.json`.

Detail on each: see [`docs/commands.md`](docs/commands.md).

## Project layout consumed by the CLI

A RIO project on disk (the kind `rio init` creates):

```
my-project/
├── rio.json                  # { projectId, loggingAdapters?, stateStreamTargets? }
├── package.json              # project deps (pnpm) — gets baked into the Lambda image by ec2-project-deployer
├── pnpm-workspace.yaml       # optional, picked up if present (only relevant for rioVersion >= 2.4.0)
├── classes/
│   └── <ClassName>/
│       ├── template.yml      # required for the directory to be recognized as a class
│       ├── index.ts
│       └── ...
├── models/
│   └── <ModelName>.json      # Zod-schema JSON (the runtime parses these)
└── dependencies/
    └── <depName>/            # custom Lambda-Layer-style dependency; zipped + uploaded on deploy
        ├── tsconfig.json     # optional — presence → marks dep as TS, deployer runs swc
        └── .ignore           # optional — skip this dep entirely
```

The deploy hot-path:

```
classes/        →  rio.{save,deploy}  →  Project.setContents / RetterClass.setClassFiles  →  Project.deploy
models/         ↑
dependencies/   ↑  (each zipped, hashed, uploaded via Project.upsertDependency → presigned S3 URL → commitUpsertDependency)
package.json    ↑
```

Files excluded everywhere (`lib/v2/utils.ts:excludedFolders/Files`): `__tests__`, `node_modules`, `scripts`, `.turbo`, `.nyc_output`, `.DS_Store`, `package-lock.json`, `yarn.lock`.

The CLI does **not** honour `.rioignore` in the v2 path — that's a v1 artifact (`RIO_CLI_IGNORE_FILE` constant exists but is unused by v2).

## Authentication

### Profile format

`~/.rio-cli/rio` is a JSON file written by `set-profile`:

```json
{
  "profiles": {
    "DEFAULT": {
      "secretId":  "...",
      "secretKey": "...",
      "endpoint":  "api.<customer-domain>",
      "noAuthDump": false
    },
    "staging": { ... }
  }
}
```

### Env-var override

If the active profile is `DEFAULT` **and** `RIO_CLI_SECRET_ID` + `RIO_CLI_SECRET_KEY` are both set in the environment, those override the file profile. Useful for CI:

```bash
RIO_CLI_SECRET_ID=... RIO_CLI_SECRET_KEY=... rio deploy --i
```

(Endpoint in this case is whatever `RIO_CLI_URL` env var says, otherwise the SDK's default `retter.io`.)

### Token flow

```
profile.secretKey  →  jwt.sign({ projectId: 'root', secretId, expiresIn: 30 })
                  ↓  HTTP POST
https://<endpoint>/root/CALL/User/generateCustomTokenForRioCLI/secretId!<secretId>
   body:    { idToken: <signed jwt> }
   headers: { x-cli-version: <RIO_CLI_VERSION> }
                  ↓
   response: { customToken } + response-header { x-rio-version: '2.x.y' }
                  ↓
   Retter SDK.authenticateWithCustomToken(customToken)
                  ↓
   Subsequent calls go through @retter/sdk with identity = 'cli'
```

Backend side: `User.generateCustomTokenForRioCLI` is the only anonymous method on `User`. It verifies the signed JWT using the User instance's `secretKey` (stored in `state.public.credentials`), and emits a custom token with claims that make the runtime treat the caller as `identity = cli`. See [`../retter-io-root/docs/auth-and-identity.md`](../retter-io-root/docs/auth-and-identity.md).

## v1 vs v2

The CLI determines which path to use from the `core_version` returned in `x-rio-version`:

```ts
get isV2() {
    if (!this.core_version) return false
    const [major] = this.core_version.split('.').map((v) => parseInt(v))
    return major === 2
}
```

When the user said "ignore v1, we only use v2 these days" — that's because every account in production is on `rio-core-extension >= 2.x`. The `src/lib/v1/` directory and the `processV1` branch in `save-and-deploy.ts` exist for backward-compatibility with old accounts that haven't been upgraded yet. New development should never touch v1.

## Common patterns

### Reading the project id

In every command:

```ts
const profile_config = CliConfig.getAdminConfig(args.profile)
const config = await getProjectConfig()                       // reads rio.json
const projectId = args['project-id'] || config.projectId      // flag wins
if (!projectId) { error }
```

### Error reporting

`Api.handleError(err, msg?)` prints a 3-table breakdown (message, request, response) in red and re-throws. Designed for terminal readability of axios errors.

### Long-running deploy subscription

`api.waitDeploymentV2(deploymentId)` races three things:

1. **Live state subscription** via the SDK's RxJS observable on `Project.state.public.deployments[<id>]`. Streams `ongoing` / `finished` / `failed` events with `statusMessage` lines (this is what surfaces "Image builder 🐳: installed lodash@4.17.21" etc. — they come from `ec2-project-deployer`'s `updateDeployment`).
2. **30-minute timeout** — hard fail with `process.exit(1)`.
3. **Stall timer** (every 3 minutes): re-fetches project state via the regular HTTP path. Catches deploys whose state-stream events were lost. Named "stall timer" in honour of Mustafa per code comment.

The first to fire wins.

## Docs

| Doc | Contents |
|---|---|
| [`docs/commands.md`](docs/commands.md) | Every command's flags, usage, behavior |
| [`docs/profiles-and-auth.md`](docs/profiles-and-auth.md) | Profile file format, env-var override, custom-token exchange flow |
| [`docs/deploy-pipeline.md`](docs/deploy-pipeline.md) | analyze → setProjectFiles → upsertDependency → createClass → setClassFiles → deploy → waitDeployment |
| [`docs/api-wrapper.md`](docs/api-wrapper.md) | `Api.ts` method reference — what each backend call maps to and which `Project`/`RetterClass` method it calls |
| [`docs/project-layout.md`](docs/project-layout.md) | What files in a RIO project the CLI cares about, exclude rules, `rio.json` schema (Zod `V2ProjectConfig`) |

## Common tasks

```bash
# Set up a profile (one-time)
rio set-profile --profile-name DEFAULT \
    --secret-id <yours> --secret-key <yours> \
    --endpoint api.<your-customer-domain>

# Scaffold a new project
rio init my-project

# Deploy from inside the project
cd my-project
rio deploy --i              # --i = --ignore-approval
rio deploy --c MyClass      # only deploy one class
rio deploy --s              # --s = --skip-diff-check (force-redeploy unchanged files)

# Save without deploying (for testing in console first)
rio save

# Sync log adapters / state-stream targets via rio.json
rio get-settings            # download
# ...edit rio.json...
rio set-settings            # upload
```

## Environment variables

| Var | Purpose |
|---|---|
| `RIO_CLI_SECRET_ID`, `RIO_CLI_SECRET_KEY` | Override the `DEFAULT` profile (CI use) |
| `RIO_CLI_URL` | Default endpoint when profile doesn't set one |
| `RIO_CLI_STAGE` | `PROD` (default) or `TEST` — shown in `--help` banner; doesn't change behavior much |
| `RIO_CLI_PROJECT_ID` | (Internal) The `deploy`/`save` commands set this from `--project-id` for child processes |

## Versioning

`package.json#version` ⇄ `src/config.ts:RIO_CLI_VERSION` must be kept in sync — the constant is sent as `x-cli-version` on every backend call (and is `TODO`'d to be replaced with a package.json read).

Released to npm via `npm run patch-release` / `minor-release` / `major-release` (these run `npm version`, `npm run build`, and `npm publish --access public`).
