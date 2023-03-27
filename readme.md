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

Deploy the project.

#### Arguments

* `--project-id`: Project id for deployment (type: string).
* `--classes`: Filtered classes for deployment (type: array).
* `--ignore-approval`: Ignore deployment manual approval.
* `--force`: Send deployment requests with force parameter to RIO.
* `--skip-diff-check`: Skip and don't perform difference checks while deploying.

```shell
rio deploy --project-id myProject --classes class1 class2 --force
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
