## Retter.io Command Line Tool

Rio Command Line Tool

### Installation

```shell
npm i -g @retter/rio-cli
```

### Before Starting

``Rbs Console > Right Top Dropdown Menu > Settings``

![img.png](docs/img.png)
---
**NOTE**

You should set the admin profile using above credentials by ```rio set-profile``` command

---

#### Example:

```shell
rio set-profile --profile-name PROFILE_NAME --secret-id SECRET_ID --secret-key SECRET_KEY
rio list-profiles
```

### Project Initialization

``rio init``

Create a new project

```shell
rio init PROJECT_ALIAS
```

``rio generate``

Create the rio file for each of classes

```shell
rio generate
```

#### Example:

```shell
rio init TEST
cd TEST
rio generate # optional
rio pre-deploy # optional
rio deploy
```

### Project Pre-Deployment

This step does not make any changes. Just only detects changes

```shell
rio pre-deploy
```

### Project Deployment

```shell
rio deploy
```
