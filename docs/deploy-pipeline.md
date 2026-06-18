# Deploy pipeline

What `rio deploy` (and `rio save`) actually does, end to end. v2 path only.

The entry point is `saveAndDeploy(args)` in `src/lib/save-and-deploy.ts`. For v2 projects (which is everything in production today), it calls `processV2(api, args)`.

## High-level

```
1. analyze({ api, skipDiff, classes })            → AnalyzationResult { local, remote, comparization }
2. printSummaryV2(comparization)                  → user sees what will change
3. if (!isChanged) exit 0
4. prompt "Are you sure?"                          (unless --ignore-approval)
5. deployV2({ api, analyzationResult, force, test, deploy })
   ├── api.setProjectFilesV2({ files, models })           # Project.setContents
   ├── for changed dependencies: upsert + upload zip + commit
   ├── for new classes:           api.createClass(name)   # Project.createClass
   ├── for classes with diffs:    api.setRemoteClassFilesV2(name, files)   # RetterClass.setClassFiles (chunks of 10)
   └── if deploy:                 api.deployProjectV2(force, test) + waitDeploymentV2(deploymentId)
```

## Stage 1: Analyze (`src/lib/v2/analyze.ts`)

Produces an `AnalyzationResult`:

```ts
{
  localProjectContents:  { files, models, dependencies },   // from cwd
  remoteProjectContents: { files, models, dependencies },   // from Project.state.{private.files, private.models, public.layers}
  remoteClasses:         { [className]: { files: {filename: content} } },
  localClasses:          { [className]: { files: {...}, shouldDeploy?, newClass? } },
  comparization:         ComparizationSummary,
  deploymentCount:       number,                            // count of ongoing deploys on the project
}
```

### Local sources

| Local key | Source on disk |
|---|---|
| `files['package.json']` | Read from cwd |
| `files['pnpm-workspace.yaml']` | Read from cwd if present |
| `models[<name>]` | All files (recursively) under `models/` |
| `dependencies[<name>]` | Each directory under `dependencies/`, zipped with `adm-zip`. `tsconfig.json` → `isTS=true`. `.ignore` file in dep root → skip. `hash` is sha256 of the dep tree |
| `classes[<className>].files[<filename>]` | All files recursively under `classes/<className>/` if it contains `template.yml` (otherwise the directory is silently skipped) |

Excluded everywhere (`src/lib/v2/utils.ts`):
- folders: `__tests__`, `node_modules`, `scripts`, `.turbo`, `.nyc_output`
- files: `.DS_Store`, `package-lock.json`, `yarn.lock`

### Remote sources

`api.getProjectState()` returns the project's full state. Files / models / dependencies come from there:

- `state.private.files[<name>].content` (gzip+base64) → ungzipped to string for comparison
- `state.private.models[<name>].content` (gzip+base64)
- `state.public.layers[<name>].hash` (hash only, not content — content stays in S3 dependency bucket)

Class files come via parallel `RetterClass.getClassFiles` calls (one per `--classes` arg, or all classes from `state.public.classes` if no filter).

### Diff (`generateComparizationSummaryV2`)

For each domain (project files, models, dependencies, classes-files), one of four states is recorded:

| State | Condition |
|---|---|
| `created` | Present locally, missing remotely |
| `edited` | Present in both, content differs |
| `deleted` | Missing locally, present remotely |
| `forced` | `--skip-diff-check` was passed AND remote exists |

For classes, the comparison is file-by-file under each class. For dependencies, it's by `hash`.

A class is marked `localClasses[name].shouldDeploy = true` if any of its files were created/edited/deleted/forced. New classes (no remote counterpart) also get `newClass = true`.

A dependency is marked `localProjectContents.dependencies[name].shouldDeploy = true` similarly.

## Stage 2: Summary print

`printSummaryV2(comparization)` prints colored output by section: Project Summary (files, models), Dependencies Summary, Classes Summary. Each entry is tagged with one of `added` / `edited` / `deleted` / `forced`.

`isChanged(comparization)` returns `true` iff any section has at least one non-no-op entry. If `false`, the command exits with the "No Changes detected" message (and a hint about `--skip-diff-check`).

## Stage 3: Manual approval

Unless `--ignore-approval`/`-i`:

```ts
const response = await prompts({ type: 'confirm', name: 'value', message: 'Are you sure to proceed?', initial: true })
if (!response.value) process.exit()
```

CI uses `--i` to skip this.

## Stage 4: Apply diffs (`src/lib/v2/deploy.ts:deployV2`)

### 4a. Project files + models

`setProjectFiles(api, analyzationResult)`:

For each changed file or model:
- If deleted: send `{ name, content: undefined }`
- Else: send `{ name, content: gzipSync(localContent).toString('base64') }`

One call to `api.setProjectFilesV2({ files, models })` → backend method `Project.setContents`. Sent in a single payload (not chunked).

### 4b. Dependencies

For each `dep` where `shouldDeploy`:

```ts
const url = await api.upsertDependency(name)       // Project.upsertDependency (no commit flag) → returns presigned S3 PUT URL
await axios.put(url, values.zipContent, {
    headers: { 'Content-Type': 'application/zip' },
    maxBodyLength: 100MB, maxContentLength: 100MB
})
await api.commitUpsertDependency(name, values.hash) // Project.upsertDependency (with commit:true, hash) → finalizes
```

100 MB cap on dep size (axios body limit). The hash is checked server-side at commit time; mismatch = rejection.

If no deps changed, prints `[Dependencies] : No Action` and skips.

### 4c. Classes

Two passes:

**Pass 1 — new classes** (sequential, not parallel):
```ts
for (const [className, classValues] of Object.entries(localClasses)) {
    if (!classValues.newClass) continue
    await api.createClass(className)           // Project.createClass → also creates SQS FIFO queue
}
```

Sequential because creating two classes simultaneously can race on the SQS resources.

**Pass 2 — class files** (chunks of 10 concurrent):
```ts
const fileWorkers = []
for (const [className, classValues] of Object.entries(localClasses)) {
    if (!classValues.shouldDeploy) continue
    fileWorkers.push(setClassFiles(api, className, analyzationResult))
}
const chunks = _.chunk(fileWorkers, 10)
for (const chunk of chunks) await Promise.all(chunk)
```

`setClassFiles` sends only changed files (added/edited/forced/deleted) to `RetterClass.setClassFiles` for that class.

After all class file writes: **5-second sleep** (`sleep(5000)`). Gives the backend time to persist before we trigger `deploy` — without it, the deployer occasionally read pre-write state from S3. (Similar to the 10s sleep in `ec2-project-deployer/src/deploy.ts:96` for the same race.)

### 4d. Deploy

Only if `deploy` is true (i.e., not `--save-only`):

```ts
console.log('🟡 Deployment STARTED')
const deploymentId = await api.deployProjectV2(force, test)   // POST Project.deploy → returns requestId
console.log(`Deployment ID: ${deploymentId}`)
await api.waitDeploymentV2(deploymentId)
```

`api.deployProjectV2` calls `Project.deploy` with `{ force, test }`. The backend (`Project.deployment.ts`) enqueues a job to either CodeBuild or — in production — the EC2 deployer Lambda URL. See [`../retter-io-root/docs/project-class.md`](../retter-io-root/docs/project-class.md).

## Stage 5: Wait + stream (`api.waitDeploymentV2`)

The most complex part of the CLI. Subscribes to live deployment state and races three completion signals:

```ts
await Promise.race([racer1, racer2, racer3])
```

### racer1 — live RxJS subscription

```ts
this.projectInstance.state?.public?.subscribe((event: any) => {
    if (!event.deployments) return
    if (!event.deployments[deploymentId]) return

    const deployment = event.deployments[deploymentId]
    if (deployment.statusMessage === lastMessage) return  // dedupe replays
    lastMessage = deployment.statusMessage

    switch (deployment.status) {
        case 'ongoing':  console.log('🔸 ' + statusMessage); break
        case 'finished': console.log('🟢 Deployment FINISHED ✅'); resolve(true); break
        case 'failed':   console.log('🔴 Deployment FAILED ❌');
                         console.log(statusMessage)
                         for (const line of error_stack || []) console.log(line)
                         process.exit(1)
    }
})
```

This uses the SDK's Firestore-backed realtime subscription to `Project.state.public.deployments[<deploymentId>]`. Every status message that the EC2 deployer pushes via `Project.deploymentCallback` flows through Firestore and arrives here in <1 second.

The `lastMessage === current` check de-duplicates: Firestore replays the doc on every subscriber connect, and if you ran `rio deploy` twice in quick succession, the old event would re-fire.

The `finished` status from **any** of the deployments in `event.deployments` is also surfaced — if your deploy completed but others are still ongoing, you see:

> 📌 Your deployment completed but there are 2 more deployment(s) that are still ongoing

### racer2 — 30-minute hard timeout

```ts
setTimeout(async () => {
    console.log('🔴 Deployment FAILED ❌')
    console.log('Deployment timed out after 30 minutes')
    process.exit(1)
}, 1000 * 60 * 30)
```

Hard ceiling. Anything beyond 30 minutes is a runaway deploy.

### racer3 — stall timer (every 3 minutes, HTTP poll)

```ts
while (true) {
    await this.sleep(3000 * 60)                        // every 3 minutes
    const state = await this.getProjectState(false)    // HTTP, not the realtime stream
    const deployment = state?.public?.deployments?.[deploymentId]
    if (!deployment) continue
    if (deployment.status === 'finished') resolve(true); break
    if (deployment.status === 'failed') exit(1)
}
```

Safety net in case the realtime subscription drops events. Named "stall timer" in honour of Mustafa (per code comment).

## Error handling

The deploy flow uses `Api.handleError(error, message?)` for axios-shaped errors. It prints:

```
Message: ┌─────────┐
        │ message │
        └─────────┘
Request: ┌─────────┐
        │ host+path│
        └─────────┘
Response: ┌─────────┐
         │ status   │
         │ data     │
         └─────────┘
```

All in red. Then re-throws. yargs's `.fail()` handler in `src/index.ts` catches the throw and `process.exit(1)`s.

For deploy `failed` status, the CLI explicitly `process.exit(1)`s rather than throwing, because the realtime subscriber is in a non-promise callback path.

## What gets sent vs what stays local

| Local file/folder | Sent on deploy? | How |
|---|---|---|
| `package.json` | ✅ | `Project.setContents` → baked into image by deployer |
| `pnpm-workspace.yaml` | ✅ (if present) | Same |
| `models/*.json` | ✅ | Same (gzipped, base64) |
| `dependencies/<name>/` | ✅ | Zipped, hashed, upload to S3 via presigned URL |
| `classes/<name>/template.yml` | ✅ | `RetterClass.setClassFiles` |
| `classes/<name>/index.ts` + other source | ✅ | Same |
| `classes/<name>/__tests__/` | ❌ | Excluded by `utils.ts:excludedFolders` |
| `node_modules/` anywhere | ❌ | Excluded |
| `.docs/`, `readme.md` | ✅ | Sent as regular files (not specially treated; they end up in S3 but don't affect the image build because the runtime doesn't look for them) |
| `rio.json` | ❌ | Local-only configuration file. Not part of the project state on RIO. |
