import { RetterCloudObjectState } from "@retter/sdk"
import { Api } from "../Api"

export type Files = {
  [fileName: string]: string
}

export interface ComparizationSummary {
  classes : {
    [name: string]: {
      editedFiles: string[]
      createdFiles: string[]
      deletedFiles: string[]
      forcedFiles: string[]
    }
  }
  dependencies: {
    [name: string]: {
      new?: boolean
      edited?: boolean
      forced?: boolean
    }
  }
  models: {
    [name: string]: {
      created?: boolean
      edited?: boolean
      deleted?: boolean
      forced?: boolean
    }
  }
  files: {
    [name: string]: {
      created?: boolean
      edited?: boolean
      deleted?: boolean
      forced?: boolean
    }
  }
}

export interface ClassContent {
    files: Files
    newClass?: boolean
    shouldDeploy?: boolean
}

export interface DependenciesContent {
  hash: string
  zipContent?: Buffer
  shouldDeploy?: boolean
}

export interface Classes {
  [name: string]: ClassContent
}

export interface Dependencies {
  [name: string]: DependenciesContent
}

export interface ProjectContents {
  files: Files
  models: Files
  dependencies: Dependencies,
}

export interface AnalyzationResult {
  localProjectContents: ProjectContents
  remoteProjectContents: ProjectContents
  remoteClasses: Classes
  localClasses: Classes
  comparization: ComparizationSummary
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
      alias: string
    },
    private: {
      files: {
        [fileName: string]: {
          name: string
          content: string
        }
      },
      models: {
        [fileName: string]: {
          name: string
          content: string
        }
      },
    }
  }

  export interface FileInfo {
    fileName: string
    filePath: string
  }

  export interface DeployInput {
    api: Api
    analyzationResult: AnalyzationResult
    force: boolean
    oraDisabled: boolean
  }

  export interface AnalyzeInput {
    api: Api
    skipDiff: boolean
    classes?: string[]
  }
  