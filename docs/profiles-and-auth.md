# Profiles and auth

Every command authenticates as the `cli` identity against a target RIO endpoint. The credentials come from a **named profile** stored in `~/.rio-cli/rio`.

## Profile file location

`~/.rio-cli/rio` — yes, the file is literally called `rio`, no extension. Plain JSON.

`~/.rio-cli/` is created on `npm install -g @retter/rio-cli` via the `postinstall` hook (`src/bootstrap.ts:install`). If the file already exists, install doesn't touch it.

The constant lives at `src/config.ts:RIO_CLI_CONFIG_PATH = path.join(os.homedir(), '.rio-cli')` and `RIO_CLI_CONFIG_FILE_NAME = 'rio'`.

## Profile schema

```json
{
  "profiles": {
    "DEFAULT": {
      "secretId":   "<from User.state.public.credentials.secretId>",
      "secretKey":  "<from User.state.public.credentials.secretKey>",
      "endpoint":   "api.<customer-domain>",       // optional, falls back to RIO_CLI_URL env
      "noAuthDump": false                           // optional, suppresses some auth output
    },
    "staging": {
      "secretId":  "...",
      "secretKey": "...",
      "endpoint":  "api.staging.example.com",
      "noAuthDump": false
    }
  }
}
```

Defined as `IRIOCliConfigProfileItemData` in `src/lib/CliConfig.ts`.

## Where credentials come from

`secretId` + `secretKey` are issued by the backend when a `User` is created. They're stored at `User.state.public.credentials.{secretId, secretKey}` and exposed to the user via:

- The console (after login, in the user settings panel)
- `User.resetCredentials` — rotate them

You **must** be a member of the target project to use that user's credentials against it. The auth flow in `User.generateCustomTokenForRioCLI` validates that.

## Default profile env override

If the active profile is `DEFAULT` *and* both `RIO_CLI_SECRET_ID` and `RIO_CLI_SECRET_KEY` are set in the environment, those override the file values:

```ts
// src/lib/CliConfig.ts:getAdminConfig
if (profileName === RIO_CLI_DEFAULT_ADMIN_PROFILE_NAME && RIO_CLI_SECRET_ID && RIO_CLI_SECRET_KEY) {
    return { noAuthDump: false, secretKey: RIO_CLI_SECRET_KEY, secretId: RIO_CLI_SECRET_ID }
}
```

The override does **not** include an endpoint. The CLI falls back to `RIO_CLI_URL` env, and if that's missing, to whatever default the SDK provides (`retter.io`).

CI pattern:

```bash
export RIO_CLI_SECRET_ID=... RIO_CLI_SECRET_KEY=... RIO_CLI_URL=api.prod.retter.io
rio deploy --i
```

Named profiles ignore the env override — you have to use `DEFAULT`.

## Token exchange flow

```
                              src/lib/Auth.ts:getRootAdminCustomToken
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │                                                                              │
   │  jwt.sign(                                                                   │
   │      { projectId: 'root', secretId: <profile.secretId>, expiresIn: 30 },     │
   │      <profile.secretKey>                                                     │
   │  )                                          ┌────► signed idToken            │
   │                                             │                                │
   │                                             ▼                                │
   │  POST https://<endpoint>/root/CALL/User/generateCustomTokenForRioCLI/        │
   │       secretId!<secretId>                                                    │
   │       Body:    { idToken }                                                   │
   │       Headers: { x-cli-version: <RIO_CLI_VERSION> }                          │
   │                                                                              │
   │  Backend:                                                                    │
   │    1. Looks up User by lookup key (secretId)                                 │
   │    2. Verifies the JWT signature with that User's secretKey                  │
   │    3. Returns { customToken } + response-header x-rio-version: '2.x.y'       │
   │                                                                              │
   │                                             ┌────► customToken               │
   │                                             │                                │
   │                                             ▼                                │
   │  Retter.getInstance({ projectId: 'root', url, region, platform: 'RIO' })     │
   │    .authenticateWithCustomToken(customToken)                                 │
   │                                                                              │
   │  → SDK now holds an access token with claims that make the runtime treat     │
   │    the caller as identity = 'cli'                                            │
   │                                                                              │
   └──────────────────────────────────────────────────────────────────────────────┘
```

Implementation in `src/lib/Auth.ts:authenticateCurrentSession`.

### The byKeyValue lookup-key path

Note the URL: `/CALL/User/generateCustomTokenForRioCLI/secretId!<secretId>`. The `key!value` instanceId form means RIO resolves `instanceId` via the **lookup key** `secretId`, not by the user's primary `instanceId`. This is how a CLI user can authenticate without knowing their own userId — they just need to know their own `secretId` (and prove they hold the matching `secretKey` by signing the JWT).

See [`../retter-io-root/docs/classes.md`](../retter-io-root/docs/classes.md) for `User` lookup-key semantics.

### core_version discovery

The backend's `rio-core-extension` adds an `x-rio-version` header to every response. The CLI reads it from the auth response and stores it on the `Api` instance as `core_version`. `Api.isV2` is `true` when `major === 2`.

There's also a quirk for environments with `VERSION_HEADER_DISABLED=on`: if `x-srv-time` is present but `x-rio-version` is not, the CLI assumes `2.0.0` (`Auth.ts:63`). This is a transitional safety net.

### Why a custom-token round trip and not just an API key

RIO doesn't have static API keys for end users. Tokens are short-lived; every call is authenticated with an access token, which is derived from a custom token, which is derived from credentials. The flow exists so:

- Credentials never go over the wire (only a JWT signed *with* them)
- The custom token has a 30-second expiry (`expiresIn: 30` in the JWT payload)
- The access token derived from it has the RIO default TTL (the runtime applies the project's `authenticationRules`)

This is the same pattern customer frontends use via `@retter/sdk` — just here the "credentials" are `secretId`/`secretKey` instead of email/password+OTP.

## CLI profile management commands

| Command | What it does |
|---|---|
| `rio set-profile --profile-name X --secret-id ... --secret-key ... --endpoint ...` | Insert or update profile `X` |
| `rio list-profiles` | Print all profiles (no `secretKey` shown) |

There is **no** `rio delete-profile` — to remove a profile, edit `~/.rio-cli/rio` directly.

## Security notes

- `secretKey` is sensitive. Treat the `~/.rio-cli/rio` file like an SSH private key. The file is created with default umask (typically `0644`); restrict manually if needed.
- Don't commit `~/.rio-cli/rio` to version control.
- Don't paste full profile content into chat / issue trackers — the `set-profile` command was deliberately designed to take secrets as flags rather than reading from a file you'd accidentally share.
- The signed `idToken` is short-lived (30s expiry from `jwt.sign`), but if it leaks during that window it grants `cli` access on the project. Don't log raw HTTP requests.

## Common failures

| Symptom | Cause |
|---|---|
| `Admin profile not found [X]` | No profile named `X` in `~/.rio-cli/rio`. Run `rio list-profiles`. |
| `rio config not found` | `~/.rio-cli/rio` doesn't exist. Run `rio set-profile` to create it, or reinstall the CLI to trigger `postinstall`. |
| `There is no endpoint provided!, please check your rio profile` | Profile has no `endpoint` and `RIO_CLI_URL` env is unset. |
| `Custom token error!` | Backend returned a 200 but the body has no `customToken`. Usually means the `secretId`/`secretKey` pair is wrong or the User was deleted. |
| `There has been a problem with your credentials ❌` | Catch-all for any failure in `authenticateCurrentSession`. Look at the printed message/request/response tables. |
