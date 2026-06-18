# Api wrapper

`src/lib/Api.ts` is a typed facade over `@retter/sdk`'s generic `RetterCloudObject.call()`. It hides:

- Per-call retry config (mostly `{ count: 30, delay: 2000, rate: 1 }` for write-paths)
- `x-cli-version` header injection
- The `cli` identity (managed by the SDK once authenticated)
- gzip+base64 decoding of file content returned by the backend
- Error normalization via `Api.handleError`

Only the v2-relevant methods are documented here. v1 helpers (`saveClassFiles`, `deployClass` with its own subscribe loop, `upsertModel`, `getRemoteClassFiles`, `getRemoteDependencies`) are kept in the same file for legacy accounts but should be ignored for new work.

## Construction

```ts
const api = await Api.createAPI(profile_config, projectId?)
```

`createAPI`:
1. Calls `authenticateCurrentSession(profile_config)` → custom-token + SDK setup (see [`profiles-and-auth.md`](profiles-and-auth.md))
2. If `projectId` is given: `retter.getCloudObject({ classId: 'Project', instanceId: projectId, useLocal: true })`
3. Returns an `Api` instance holding the `Retter` SDK, the `Project` cloud object, and the `core_version` discovered from `x-rio-version`

`useLocal: true` means the SDK won't INIT the instance — it'll fail if it doesn't exist remotely (which is the right behavior for any command other than `init`).

`api.isV2` is `true` when `core_version` major is `2`.

## Reading project state

### `api.getProjectState(useCache = true)`

```ts
const state = await api.getProjectState(false)  // force a fresh GET
state.public.deployments[...]
state.public.classes[...]
state.public.layers[...]                          // dependencies
state.private.files[...]                           // gzipped+b64
state.private.models[...]
```

Maps to `Project.STATE` (the platform's state-projection method). Cached on the `Api` instance — pass `false` to bypass.

### `api.getRemoteClassFilesV2(className)`

```ts
const { files } = await api.getRemoteClassFilesV2('MyClass')
// files: [{ classId, name, content }, ...]    content is UTF-8 string (decoded from gzip+b64)
```

Maps to `RetterClass.getClassFiles`. Decodes `content` from gzip+base64 automatically.

### `api.getStateStreamTargets(cleanMappingId = true)`

```ts
const targets = await api.getStateStreamTargets()   // [{ id, type, credentials, retryConfig, ... }]
```

Maps to `Project.getStateStreamTargets`. With `cleanMappingId = true` (default), strips the `mappingId` from each target — appropriate for `get-settings` where you want to dump a clean source-of-truth file. Pass `false` from `set-settings` so you can later merge mappingIds back from the existing remote entries.

### `api.getLoggingAdapters(cleanMappingId = true)`

Same shape as `getStateStreamTargets` but for `Project.getLoggingAdapters`.

> Both have the comment `(ps: this function exists only in rio v2.0.9+)` — earlier 2.x versions error here.

## Writing project state

### `api.setProjectFilesV2({ files, models })`

```ts
await api.setProjectFilesV2({
    files: {
        'package.json': { name: 'package.json', content: '<gzip+b64>' },
        'someOldFile.js': { name: 'someOldFile.js', content: undefined }    // delete
    },
    models: { ... }
})
```

Maps to `Project.setContents`. Setting `content: undefined` deletes the file. Sends both `files` and `models` in one call.

Retry: `{ count: 30, delay: 2000, rate: 1 }` — for a brief network hiccup the SDK retries up to 30× over a minute.

### `api.setRemoteClassFilesV2(className, files)`

```ts
await api.setRemoteClassFilesV2('MyClass', {
    'index.ts': { name: 'index.ts', content: '<gzip+b64>' },
    'oldHelper.ts': { name: 'oldHelper.ts', content: undefined }
})
```

Maps to `RetterClass.setClassFiles`. Same delete-via-undefined semantic. Called in chunks of 10 by `deployV2` for parallel write throughput.

### `api.setLogginAdaptors({ loggingAdapters })`

Note the typo `Loggin` in the function name. Maps to `Project.updateLogAdaptors`.

```ts
await api.setLogginAdaptors({
    loggingAdapters: [
        { id, endpoint, apiKey?, retryConfig, mappingId? }
    ]
})
```

`mappingId` should be carried over from the existing remote entry (if any) — see `set-settings` command for the merge logic.

### `api.setStateStreamTargets({ targets })`

Maps to `Project.updateStateStreamTargets`.

```ts
await api.setStateStreamTargets({
    targets: [
        { id, type: 'Firestore'|'Elasticsearch'|'Http', credentials, retryConfig, mappingId? }
    ]
})
```

## Class management

### `api.getClassInstance(className)`

Memoized fetch of a `RetterClass` instance:

```ts
const classInstance = await this.retter.getCloudObject({
    useLocal: true,
    classId: 'RetterClass',
    instanceId: `${projectId}_${className}`    // RetterClass uses composite instanceId
})
```

Returned `RetterCloudObject` from `@retter/sdk` is what gets re-used for all `RetterClass.<method>` calls per class. Stored on `this.classInstances[className]`.

### `api.createClass(className)`

Maps to `Project.createClass`. Calls with `{ classId: className }`. Retry 30×.

Backend-side this also provisions the per-class SQS FIFO queue and event-source mapping — see `Project.classes.ts:create`.

## Dependency management

### `api.upsertDependency(dependencyName)`

Two-phase. First phase (no `commit`):

```ts
const url = await api.upsertDependency('mydep')   // returns presigned S3 PUT URL
```

Maps to `Project.upsertDependency`. Backend creates an S3 presigned URL (under `dependencies/<projectId>/<dependencyName>/`) and returns it.

### `api.commitUpsertDependency(dependencyName, hash)`

After uploading the zip to the presigned URL:

```ts
await api.commitUpsertDependency('mydep', dep.hash)
```

Maps to `Project.upsertDependency` again, this time with `body.commit = true` and `body.hash`. Backend verifies the uploaded zip matches the hash and adds the dep to `state.public.layers`.

The deployer (`ec2-project-deployer/src/buildImage.ts`) reads this dependency from S3 during the next deploy.

## Deploy + wait

### `api.deployProjectV2(force, test)`

Maps to `Project.deploy({ force, test })`.

```ts
const response = await this.projectInstance.call({
    method: 'deploy',
    body: { force, test },
    headers: { 'cli-version': ..., 'x-cli-version': ... }    // both for back-compat
})
const deploymentId = response.data.requestId
```

Returns the `requestId` string. This is the deployment id used by everything downstream.

### `api.waitDeploymentV2(deploymentId)`

The complex one. Races 3 completion signals (full detail in [`deploy-pipeline.md`](deploy-pipeline.md#stage-5-wait--stream-apiwaitdeploymentv2)):

1. Realtime RxJS subscription to `Project.state.public.deployments[deploymentId]`
2. 30-minute hard timeout
3. 3-minute polling (HTTP) for stalled deploys

Returns `true` on `finished`, `process.exit(1)`s on `failed` or any of the timeouts.

## Project creation (init command only)

### `api.createNewProject(alias)`

```ts
const projectInstance = await this.retter.getCloudObject({
    classId: 'Project',
    body: { alias },
    headers: { 'x-cli-version': ... }
})
const state = (await projectInstance.getState()).data
return { projectId: projectInstance.instanceId, detail: state.public }
```

Without `useLocal`, the SDK INITs the instance (creates it remotely). `Project.INIT` generates a new projectId (random hex), creates the Project state with `state.public.alias = alias`, and stores it. Returns `{ projectId, detail }` to the caller.

## Error format

`Api.handleError(error, message?)` is called from every catch. It tries to print:

| Section | Source |
|---|---|
| Message table | `error.message` |
| Request table | `error.request.host + error.request.path` (without query string) |
| Response table | `error.response.{status, statusText, data}` |

Then re-throws. The format is designed for axios errors specifically. Non-axios errors print only the Message table.

## Versioning headers

Every call sends `x-cli-version: <RIO_CLI_VERSION>` (and `cli-version` on `deploy` for legacy backend support — has a TODO to remove).

The backend `Project.authorizer` checks `x-cli-version` to gate which features are exposed to which CLI versions. If you're working on a feature that depends on a newer backend, increment the major or minor version of both repos and gate accordingly.
