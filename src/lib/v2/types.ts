import { RetterCloudObjectState } from '@retter/sdk'
import { Api } from '../Api'
import z from 'zod'

export type Files = {
  [fileName: string]: string
}

export interface ComparizationSummary {
  classes: {
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
      isTS?: boolean
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
  isTS?: boolean
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
  dependencies: Dependencies
}

export interface AnalyzationResult {
  localProjectContents: ProjectContents
  remoteProjectContents: ProjectContents
  remoteClasses: Classes
  localClasses: Classes
  comparization: ComparizationSummary
  deploymentCount: number
}

export interface ProjectState extends RetterCloudObjectState {
  public: {
    layers: {
      [dependencyName: string]: {
        version: string
        versionArn: string
        hash: string
      }
    }
    classes: {
      classId: string
    }[]
    alias: string
    deployments: any[]
    projectConfig: {
      loggingAdapters: any[]
      stateStreamTargets: any[]
    }
  }
  private: {
    files: {
      [fileName: string]: {
        name: string
        content: string
      }
    }
    models: {
      [fileName: string]: {
        name: string
        content: string
      }
    }
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
  deploy: boolean
}

export interface AnalyzeInput {
  api: Api
  skipDiff: boolean
  classes?: string[]
}

export const RetryConfig = z.object({
  delay: z.number().int().min(1),
  count: z.number().int().min(1),
  rate: z.number().min(1),
})
export type RetryConfig = z.infer<typeof RetryConfig>

export const LogAdapter = z.object({
  id: z.string().regex(new RegExp('[a-zA-Z0-9_]', 'g')).min(1),
  endpoint: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  pfactor: z.number().min(0).optional(),
  retryConfig: RetryConfig.default({ count: 3, delay: 50, rate: 1.5 }),
  mappingId: z.any().optional(),
})
export type LogAdapter = z.infer<typeof LogAdapter>

export const cloudObjectStateStreamTarget = z.enum(['Elasticsearch', 'Firestore', 'Http'])

export const stateStreamTarget = z.object({
  id: z.string().regex(new RegExp('[a-zA-Z0-9_]', 'g')).min(1),
  type: cloudObjectStateStreamTarget,
  credentials: z.record(z.any()).default({}),
  pfactor: z.number().min(0).optional(),
  retryConfig: RetryConfig.default({ count: 3, delay: 50, rate: 1.5 }),
  transformationTemplate: z.string().optional(),
  mappingId: z.any().optional(),
})
export type StateStreamTarget = z.infer<typeof stateStreamTarget>

export const V2ProjectConfig = z.object({
  projectId: z.string().min(1),
  loggingAdapters: z.array(LogAdapter).optional(),
  stateStreamTargets: z.array(stateStreamTarget).optional(),
})

export type V2ProjectConfig = z.infer<typeof V2ProjectConfig>
