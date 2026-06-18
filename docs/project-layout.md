# Project layout

What the CLI expects to find in a RIO project on disk, and what it does with each piece.

## Canonical layout

This is what `rio init` scaffolds and what `rio deploy` reads:

```
my-project/
├── rio.json                        # local-only project config
├── package.json                    # baked into the Lambda image
├── pnpm-workspace.yaml             # optional (rioVersion >= 2.4.0 only)
├── tsconfig.json                   # optional, project-local TS config
├── classes/
│   ├── MyClass/
│   │   ├── template.yml            # REQUIRED — marks the dir as a class
│   │   ├── index.ts                # entry — runtime resolves it as the class handler
│   │   ├── authorizer.ts           # convention
│   │   ├── ...                     # any other TS/JS source
│   │   └── __tests__/              # IGNORED by CLI
│   └── AnotherClass/
│       └── template.yml
├── models/
│   ├── User.json                   # Zod-schema JSON
│   ├── Order.json
│   └── nested/                     # nested folders allowed
│       └── Detail.json
├── dependencies/
│   ├── mydep/
│   │   ├── tsconfig.json           # presence → marked isTS=true
│   │   ├── .ignore                 # presence → entire dep skipped on upload
│   │   ├── index.ts
│   │   └── package.json
│   └── otherdep/
│       └── index.js                # JS-only deps work too
├── node_modules/                   # IGNORED
├── scripts/                        # IGNORED
└── readme.md
```

## `rio.json` — local project config

The local source-of-truth for project settings that aren't class source. Schema is `V2ProjectConfig` in `src/lib/v2/types.ts`:

```ts
const V2ProjectConfig = z.object({
    projectId:           z.string().min(1),
    loggingAdapters:     z.array(LogAdapter).optional(),
    stateStreamTargets:  z.array(stateStreamTarget).optional(),
})
```

Example:

```json
{
  "projectId": "abc1234567",
  "loggingAdapters": [
    {
      "id":       "myLogger",
      "endpoint": "https://logs.example.com/ingest",
      "apiKey":   "...",
      "pfactor":  1,
      "retryConfig": { "count": 3, "delay": 50, "rate": 1.5 }
    }
  ],
  "stateStreamTargets": [
    {
      "id":          "myEs",
      "type":        "Elasticsearch",
      "credentials": { "host": "...", "username": "...", "password": "..." },
      "retryConfig": { "count": 3, "delay": 50, "rate": 1.5 }
    }
  ]
}
```

Created by `rio init` with `projectId` populated and empty arrays. Synced via `rio gs` (pull from remote) / `rio ss` (push to remote). Should be committed to version control — it's the declarative spec of project settings.

The CLI also accepts `--project-id` / `--pid` on most commands to override `rio.json.projectId`. Without either, commands that need a projectId error out.

`mappingId` is never written to local `rio.json` — `get-settings` strips it. `set-settings` merges the remote `mappingId` back in before pushing, so existing log-adapter / state-stream subscriptions keep their identity rather than being recreated.

## `package.json` — Lambda image deps

The CLI sends `package.json` to RIO unchanged. The `ec2-project-deployer` then extracts only `dependencies` and `pnpm` keys when building the Lambda image (see [`../ec2-project-deployer/docs/build-pipeline.md`](../../ec2-project-deployer/docs/build-pipeline.md#dockerfile-this-repos-dockerfile)).

Practical implications:

- `devDependencies` are NOT installed in the Lambda image (deployer drops them).
- `scripts` are NOT run during image build (no `prepare` / `postinstall` hooks).
- `engines` is ignored — Node version is baked into the base image.
- `pnpm.patchedDependencies` / `pnpm.pnpmfile` are stripped for `rioVersion >= 2.4.0` (the deployer's `buildImage.ts` removes them with a warning).

If `package.json` is missing, `rio deploy` throws `No package.json found in project` (from `contents-project.ts:fetchLocalFiles`).

## `pnpm-workspace.yaml` — optional

Only relevant for `rioVersion >= 2.4.0` (pnpm 11). Present file is uploaded as-is; absent is fine.

`patchedDependencies` and `pnpmfile` fields are stripped server-side (in the deployer, not the CLI) — they're not supported in the build env.

## `classes/` — class source

Each subdirectory is a class **iff** it contains `template.yml`. Subdirectories without `template.yml` are silently skipped.

```
classes/
├── MyClass/
│   ├── template.yml          ← required marker
│   ├── index.ts              ← runtime resolves this as the class handler
│   ├── authorizer.ts         ← conventionally referenced from template.yml
│   ├── methods/
│   │   ├── createOrder.ts
│   │   └── shipOrder.ts
│   └── utils.ts
```

The CLI reads **all files** recursively under each class dir (except the global exclude list — see below). They get bundled into `{ filename: content }` and sent to `RetterClass.setClassFiles` as a single payload per class.

File path inside the class is preserved using forward slashes: `methods/createOrder.ts` is stored as `"methods/createOrder.ts"` and unpacked by the deployer into the same path.

### Class name = directory name

The class id used everywhere (in API calls, instance IDs, etc.) is the literal directory name. `classes/MyClass/` → `classId = "MyClass"`. Case-sensitive.

## `models/` — Zod schemas

JSON files only. Each becomes a named model in the project. They're referenced from `template.yml` `inputModel` / `outputModel` fields.

```
models/
├── User.json            → modelName "User"
└── nested/
    └── Detail.json      → modelName "nested/Detail.json" (relative path with extension)
```

The CLI reads recursively; nested folders work but you'll get the full relative path as the model name. By convention people keep them flat.

## `dependencies/` — custom Lambda Layers

Each subdirectory is a "dependency" — RIO's term for what AWS calls a Lambda Layer (or a private npm package, depending on how you use it).

Build process:

1. Each `dependencies/<name>/` directory is zipped via `adm-zip` with the layout `nodejs/node_modules/<name>/*` inside the zip.
2. A sha256 hash is computed over the whole tree.
3. If `tsconfig.json` is present at the dep root → `isTS = true` is set (the deployer will run `@swc/core` on the dep's `.ts` files during image build).
4. If `.ignore` is present → the dep is entirely skipped (won't be uploaded or referenced).

The CLI then uploads via:
- `api.upsertDependency(name)` → get presigned S3 URL
- `axios.put(url, zipBuffer)` → upload (100 MB cap)
- `api.commitUpsertDependency(name, hash)` → finalize

Backend stores them at `s3://cos-bucket-<accountId>-prod/dependencies/<projectId>/<dependencyName>/dependency.zip` and adds `state.public.layers[name] = { hash, ... }`.

At image-build time, the deployer downloads each dep zip, unpacks it to `user/dependencies/<name>/` in the build context, transpiles TS (if any), and the result becomes available to user code under `NODE_PATH=/opt/user-extension/user-src/dependencies`.

Example structure:

```
dependencies/
└── analytics-sdk/
    ├── tsconfig.json    → isTS=true
    ├── package.json
    ├── index.ts
    └── lib/
        └── client.ts
```

User code references the dep simply as `import { foo } from 'analytics-sdk'`.

## What gets excluded

`src/lib/v2/utils.ts`:

```ts
const excludedFolders = ['__tests__', 'node_modules', 'scripts', '.turbo', '.nyc_output']
const excludedFiles   = ['.DS_Store', 'package-lock.json', 'yarn.lock']
```

Applies to:
- `classes/<name>/**`
- `models/**`
- (Not applied to top-level files — `package.json` and `pnpm-workspace.yaml` are explicitly named in `PROJECT_FILES`)

There is **no** `.rioignore` support in the v2 path. The constant `RIO_CLI_IGNORE_FILE = '.rioignore'` exists in `src/config.ts` but is only read by the v1 code path. Add custom excludes by editing `excludedFolders` / `excludedFiles` in `utils.ts` (or by structuring your code under one of the existing exclude names like `__tests__`).

## What's local-only (never sent)

- `rio.json` — local config, not part of remote project state
- `node_modules/` — never sent (regenerated by deployer)
- `dist/`, `build/` — wherever your TS build outputs go, the deployer rebuilds from source
- `.git/`, `.vscode/`, IDE configs — not in any include path
- Anything under `__tests__` / `scripts` / `.turbo` / `.nyc_output`

## What's "live" remotely (not on disk)

`state.public.deployments`, `state.public.members`, `state.public.layers`, `state.public.config`, etc. are managed by the platform (or via `rio set-settings` for `loggingAdapters` / `stateStreamTargets`). They're not represented in your local source tree.

If you need to inspect remote state from CI, use the SDK directly (`Project.getState()` via `@retter/sdk`).

## Generated `deploy` script in package.json

`rio init` adds this to `package.json#scripts` (`src/lib/Repo.ts:downloadAndExtractGitRepoV2`):

```json
"scripts": {
  "deploy": "rio d --p <profileName> --pid <projectId> --i"
}
```

So `npm run deploy` is the canonical one-liner after init. The `--i` skips the approval prompt — appropriate for the deploy script's typical use (CI or post-test manual invocation).

If you switch profiles or projects, edit this script accordingly (or pass overrides on the CLI: `npm run deploy -- --p other-profile`).
