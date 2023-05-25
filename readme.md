# Retter.io Command Line Tool

Rio CLI is a command-line tool that allows you to interact with the RIO platform. You can use it to deploy your RIO projects, generate class files, create new projects, and more.

## Installation

```shell
npm i -g @retter/rio-cli
```

## Commands

### `rio --`
* `--help`: Show help.
* `--version`: Show version number.

### `rio set-profile [sp]`

Upsert admin profile in local storage.

```shell
rio set-profile --profile-name myProfile --secret-id mySecretId --secret-key mySecretKey --endpoint myRioDomain
```

#### Arguments

* `--profile-name`: Name of this admin profile
* `--secret-id`: Secrect id fetched from console
* `--secret-key`: Secrect key fetched from console
* `--endpoint`: URL to target rio console

### `rio deploy [d]`

Save local changes and deploy the project.

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

Save local changes to but do not deploy the project.

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

Retrieve and synchronize your local project configuration with the remote project, enabling you to effortlessly create or update log adapters, state stream targets, and more.

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
rio init myProject
```
### `rio list-profiles [lp]`

List local admin profiles.
```shell
rio list-profiles
```
### `rio generate [g]`

Generate RIO class files.
```shell
rio generate
```
### `rio generate-docs [gd]`

Generate project documentation.
```shell
rio generate-docs
```
### `rio console [con]`

Open project console.

```shell
rio console
```
