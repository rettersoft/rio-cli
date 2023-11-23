# Retter.io Command Line Tool

Rio CLI is a command-line tool that allows you to interact with the RIO platform. You can use it to deploy your RIO projects, generate class files, create new projects, and more.

## Installation

```shell
npm i -g @retter/rio-cli
```

## Dependency Support

The RIO CLI supports both `TypeScript` and `JavaScript` dependencies. 

 - Make sure your typescript dependency has `tsconfig.json` file on its path.  
 - If you have a dynamic dependency (a dependency created at runtime) and you want the CLI to ignore that dependency during deployment, add an `.ignore` file to its path

Example: https://github.com/retterio/v2-dependency-example

## Commands

### `rio --`
* `--help`: Show help.
* `--version`: Show version number.

### `rio set-profile [sp]`

Upsert admin profile in local storage.

```shell
rio set-profile --profile-name <PROFILE_NAME> --secret-id <SECRET> --secret-key <SECRETKEY> --endpoint <DOMAIN>
```

#### Arguments

* `--profile-name`: Name of this admin profile
* `--secret-id`: Secrect id fetched from console
* `--secret-key`: Secrect key fetched from console
* `--endpoint`: URL to target rio console

### `rio deploy [d]`

Save local changes to the rio cloud and deploy the project.

#### Arguments

* `--profile [p]`: Profile name for deployment (type: string)
* `--project-id [pid]`: Project id for deployment (type: string).
* `--classes [c]`: Filtered classes for deployment (type: array) (optional).
* `--ignore-approval [i]`: Ignore deployment manual approval (optional).
* `--force [f]`: Send deployment requests with force parameter to RIO (optional).
* `--skip-diff-check [s]`: Skip and don't perform difference checks while deploying (optional).

```shell
rio deploy --profile admin --project-id 77bb3924k --classes Order Product --force --skip-diff-check --ignore-approval
rio d --p admin --pid 77bb3924k --c Order Product --f --s --i
```

### `rio save [s]`

Save local changes to the rio cloud without deploying them

#### Arguments
* `--profile [p]`: Profile name for deployment (type: string)
* `--project-id [pid]`: Project id for deployment (type: string).
* `--classes [c]`: Filtered classes for deployment (type: array)(optional).
* `--ignore-approval [i]`: Ignore deployment manual approval (optional).
* `--skip-diff-check [s]`: Skip and don't perform difference checks while deploying (optional).

```shell
rio save --profile admin --project-id 77bb3924k --classes Order Product --skip-diff-check --ignore-approval
rio s --p admin --pid 77bb3924k --c Order Product --s --i
```

### `rio get-settings [gs]`
Fetches project data and generates a project configuration file on your local disk
#### Arguments
* `--profile [p]`: Profile name for target rio environment (type: string)
* `--project-id [pid]`: Project id for target project (type: string).

```shell
rio get-settings --profile <profile_name> --project-id <project_id>
rio gs --p <profile_name> --pid <project_id>
```
### `rio set-settings [ss]`

Synchronize your local project configuration with the remote project, enabling you to effortlessly create or update log adapters, state stream targets, and more.

#### Arguments
* `--profile [p]`: Profile name for target rio environment (type: string)
* `--project-id [pid]`: Project id for target project (type: string).

```shell
rio set-settings --profile <profile_name> --project-id <project_id>
rio ss --p <profile_name> --pid <project_id>
```

### `rio init [alias]` (`i`)

Create a new project.
```shell
rio init --alias <project_name> --profile <profile_name>
rio i --a <project_name> --p <profile_name>

```
### `rio list-profiles [lp]`

List local admin profiles.
```shell
rio list-profiles
```
### `rio generate [g]`

Generate RIO class files. (deprecated)
```shell
rio generate
```
### `rio generate-docs [gd]`

Generate project documentation.
```shell
rio generate-docs
```