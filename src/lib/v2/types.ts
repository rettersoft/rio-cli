import { RetterCloudObjectState } from "@retter/sdk"

export interface DeploymentClassContent {
    models: { [fileName: string]: string }
    files: { [fileName: string]: string }
    newClass?: boolean
    shouldDeploy?: boolean
}
export interface DeploymentClasses {
  [name: string]: DeploymentClassContent
}

export interface DeploymentDependenciesContent {
  hash: string
  zipContent: Buffer
  shouldDeploy?: boolean
}

export interface DeploymentDependencies {
  [name: string]: DeploymentDependenciesContent
}

export interface ComparizationSummary {
  classes : {
    [name: string]: {
      editedFiles: string[]
      editedModels: string[]
      createdFiles: string[]
      createdModels: string[]
      deletedFiles: string[]
      deletedModels: string[]
      newClass: boolean
    }
  }
  dependencies: {
    [name: string]: {
      new?: boolean
    }
  }
}

export interface DeploymentContents {
  classes: DeploymentClasses
  dependencies: DeploymentDependencies,
  comparization?: ComparizationSummary
}

export interface ProjectState extends RetterCloudObjectState {
    public : {
      layers: {
        [dependencyName: string]: {
          version: string
          versionArn: string
          hash: string
        }
      },
      classes: {
        classId: string
      }[],
    }
  }