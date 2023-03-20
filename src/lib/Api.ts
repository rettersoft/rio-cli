import Retter, { RetterCallResponse, RetterCloudObject, RetterCloudObjectState } from '@retter/sdk'
import { RetterRootClasses, RetterRootMethods, authenticateCurrentSession, AuthenticateCurrentSessionResponse } from './Auth'
import { IProjectDetail } from '../Interfaces/IProjectDetail'
import { Project } from './Project'
import { gunzipSync } from 'zlib'
import { ConsoleMessage, DeploymentMessageStatus } from './ConsoleMessage'
import { Deployment, DeploymentObjectItemStatus, DeploymentObjectItemType } from './Deployment'
import { IRemoteDependencyContent } from './Dependencies'
import { IPreDeploymentContext } from './ProjectManager'
import { CliConfig, IRIOCliConfigProfileItemData } from './CliConfig'
import chalk from 'chalk'
import { Transform } from 'stream'
import { Console } from 'console'
export interface RemoteClassFileItem {
  classId: string
  name: string
  content: string
}
export interface GetFilesAndModelsResponse {
  files: RemoteClassFileItem[]
  models: RemoteClassFileItem[]
}

export interface ISaveClassFilesInput {
  name: string
  content?: string
  status: 'EDITED' | 'DELETED' | 'ADDED'
}

function table(input: any) {
  // @see https://stackoverflow.com/a/67859384
  const ts = new Transform({
    transform(chunk, enc, cb) {
      cb(null, chunk)
    },
  })
  const logger = new Console({ stdout: ts })
  logger.table(input)
  const table = (ts.read() || '').toString()
  let result = ''
  for (let row of table.split(/[\r\n]+/)) {
    let r = row.replace(/[^┬]*┬/, '┌')
    r = r.replace(/^├─*┼/, '├')
    r = r.replace(/│[^│]*/, '')
    r = r.replace(/^└─*┴/, '└')
    r = r.replace(/'/g, ' ')
    result += chalk.redBright(`${r}\n`)
  }
  console.log(result.slice(0, -3))
}

export class Api {
  private retter: Retter
  private projectInstance: RetterCloudObject
  private projectState: any
  private classInstances: { [key: string]: RetterCloudObject } = {}

  private root_version: string
  private profile_config: IRIOCliConfigProfileItemData
  // ***********************
  // *  CONSTRUCTOR
  // ***********************

  constructor(retter: Retter, projectInstance: RetterCloudObject, profile_config: any, root_version: string) {
    this.retter = retter
    this.projectInstance = projectInstance
    this.profile_config = profile_config
    this.root_version = root_version
  }

  static async createAPI(profile_config: IRIOCliConfigProfileItemData, projectId?: string) {
    // Use await to perform async operations
    const { retter, root_version } = await authenticateCurrentSession(profile_config)

    let projectInstance: RetterCloudObject | undefined

    try {
      if (projectId) {
        projectInstance = await retter.getCloudObject({
          useLocal: true,
          classId: RetterRootClasses.Project,
          instanceId: projectId,
        })
      }
    } catch (error) {
      Api.handleError(error)
    }

    return new Api(retter, projectInstance as RetterCloudObject, profile_config, root_version)
  }

  // ***********************
  // *  CONSTRUCTOR
  // ***********************

  get getProfile() {
    return this.profile_config
  }

  get v2() {
    return this.root_version === '2.0.0'
  }

  sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  static handleError(error: any) {
    console.log(chalk.redBright('\nUPS ! Something went wrong ! ' + error?.message || ''))

    if (error?.request && error?.response) {
      const reqdata = [
        {
          req_path: error?.request?.host + error?.request?.path.split('?')[0],
        },
      ]
      const resdata = [
        {
          res_status: error?.response?.status,
          res_statusText: error?.response?.statusText,
          res_data: JSON.stringify(error?.response?.data),
        },
      ]

      console.log(chalk.redBright('\nRequest: '))
      table(reqdata)
      console.log(chalk.redBright('\nResponse: '))
      table(resdata)
    }
    throw error
  }

  async getClassInstance(className: string): Promise<RetterCloudObject> {
    if (this.classInstances[className]) {
      return this.classInstances[className]
    }
    try {
      this.classInstances[className] = await this.retter.getCloudObject({
        useLocal: true,
        classId: RetterRootClasses.RetterClass,
        instanceId: `${this.projectInstance.instanceId}_${className}`,
      })
    } catch (error) {
      Api.handleError(error)
    }
    return this.classInstances[className]
  }

  async createClass(className: string, templateId?: string): Promise<void> {
    try {
      await this.projectInstance.call({
        method: RetterRootMethods.createClass,
        body: {
          classId: className,
        },
      })
    } catch (error) {
      Api.handleError(error)
    }
  }

  async saveClassFiles(className: string, input: ISaveClassFilesInput[]): Promise<void> {
    const classInstance = await this.getClassInstance(className)
    try {
      await classInstance.call({
        method: RetterRootMethods.saveClassFiles,
        body: {
          files: input,
        },
      })
    } catch (error) {
      Api.handleError(error)
    }
  }

  async saveAndDeployClass(className: string, input: ISaveClassFilesInput[], deploymentStatus: IPreDeploymentContext, force: boolean): Promise<void> {
    if (input.length) {
      await this.saveClassFiles(className, input)
    }
    if (force || Deployment.isChanged(deploymentStatus)) {
      await this.deployClass(className, force)
    }
  }

  async deployClass(className: string, force: boolean): Promise<void> {
    const classInstance = await this.getClassInstance(className)
    try {
      await classInstance.call({
        method: RetterRootMethods.deployClass,
        body: {
          force,
        },
      })
    } catch (error) {
      Api.handleError(error)
    }

    await new Promise((resolve, reject) => {
      try {
        classInstance.state?.public?.subscribe(
          (event: {
            deployment?: {
              status: 'started' | 'ongoing' | 'failed' | 'finished'
              statusMessage: string
            }
          }) => {
            if (event.deployment) {
              switch (event.deployment.status) {
                case 'failed':
                  ConsoleMessage.deploymentMessage(
                    {
                      type: DeploymentObjectItemType.CLASS,
                      status: DeploymentObjectItemStatus.FAILED,
                      path: className,
                    },
                    DeploymentMessageStatus.FAILED,
                  )
                  reject(event.deployment.statusMessage)
                  break
                case 'finished':
                  ConsoleMessage.deploymentMessage(
                    {
                      type: DeploymentObjectItemType.CLASS,
                      status: DeploymentObjectItemStatus.FINISHED,
                      path: className,
                    },
                    DeploymentMessageStatus.SUCCEED,
                  )
                  resolve(true)
                  break
                case 'started':
                  ConsoleMessage.deploymentMessage(
                    {
                      type: DeploymentObjectItemType.CLASS,
                      status: DeploymentObjectItemStatus.STARTED,
                      path: className,
                    },
                    DeploymentMessageStatus.STARTED,
                  )
                  break
                case 'ongoing':
                  ConsoleMessage.deploymentMessage(
                    {
                      type: DeploymentObjectItemType.CLASS,
                      status: DeploymentObjectItemStatus.ONGOING,
                      path: className,
                    },
                    DeploymentMessageStatus.DEPLOYING,
                  )
                  break
                default:
                  break
              }
              ConsoleMessage.customDeploymentMessage(event.deployment.statusMessage)
            }
          },
        )
      } catch (error) {
        Api.handleError(error)
      }
    }).catch((error) => {
      Api.handleError(error)
    })
  }

  async upsertModel(modelName: string, modelDefinition?: object): Promise<void> {
    try {
      await this.projectInstance.call({
        method: RetterRootMethods.upsertModel,
        body: {
          modelName,
          modelDefinition,
        },
      })
    } catch (error) {
      Api.handleError(error)
    }
  }

  async upsertModels(models: { modelName: string; modelDefinition?: object }[]): Promise<void> {
    try {
      await this.projectInstance.call({
        method: RetterRootMethods.upsertModels,
        body: {
          models,
        },
      })
    } catch (error) {
      Api.handleError(error)
    }
  }

  async createNewProject(alias: string): Promise<{ projectId: string; detail: IProjectDetail }> {
    try {
      const projectInstance = await this.retter.getCloudObject({
        classId: RetterRootClasses.Project,
        body: {
          alias,
        },
      })

      const state = (await projectInstance.getState()).data

      return {
        projectId: projectInstance.instanceId,
        detail: state.public as any,
      }
    } catch (error) {
      console.log('createNewProject error')
      Api.handleError(error)
      return { projectId: '', detail: {} as any }
    }
  }

  async getProjectState(): Promise<RetterCloudObjectState> {
    try {
      if (!this.projectState) {
        const state = await this.projectInstance.getState()
        this.projectState = state.data
      }
    } catch (error) {
      Api.handleError(error)
    }
    return this.projectState
  }

  async getRemoteClassFiles(className: string): Promise<RemoteClassFileItem[]> {
    const classInstance = await this.getClassInstance(className)
    try {
      const response = await classInstance.call<RemoteClassFileItem[]>({
        method: RetterRootMethods.getClassFiles,
      })

      return response.data.map((item) => {
        return {
          ...item,
          classId: className,
          content: gunzipSync(Buffer.from(item.content, 'base64')).toString('utf-8'),
        }
      })
    } catch (error) {
      Api.handleError(error)
      return []
    }
  }

  async getRemoteDependencies(): Promise<IRemoteDependencyContent[]> {
    const state = await this.getProjectState()
    if (!state.public.layers) return []

    const layers = Object.keys(state.public.layers)
    return layers.map((l) => {
      return {
        dependencyName: l,
        hash: state.public.layers[l].hash || '',
      }
    })
  }

  async upsertDependency(dependencyName: string): Promise<string> {
    try {
      const result = await this.projectInstance.call<any>({
        method: RetterRootMethods.upsertDependency,
        body: {
          dependencyName,
        },
      })
      return result.data.url
    } catch (error) {
      Api.handleError(error)
      return ''
    }
  }

  async commitUpsertDependency(dependencyName: string, hash: string): Promise<void> {
    try {
      await this.projectInstance.call<any>({
        method: RetterRootMethods.upsertDependency,
        body: {
          dependencyName,
          commit: true,
          hash,
        },
      })
    } catch (error) {
      Api.handleError(error)
    }
  }

  async deployClassV2(className: string, force: boolean): Promise<void> {
    const classInstance = await this.getClassInstance(className)
    try {
      await classInstance.call({
        method: RetterRootMethods.deployClass,
        body: {
          force,
        },
      })

      const deploymentStarted = Date.now()

      await new Promise((resolve, reject) => {
        try {
          classInstance.state?.public?.subscribe(
            (event: {
              deployment?: {
                status: 'started' | 'ongoing' | 'failed' | 'finished'
                statusMessage: string
                updatedAt: number
              }
            }) => {
              if (event.deployment) {
                switch (event.deployment.status) {
                  case 'failed':
                    console.log(chalk.redBright(` failed: [${className}]`))
                    reject(event.deployment.statusMessage)
                    break
                  case 'finished':
                    const timeSinceDeploymentStarted = (event.deployment.updatedAt || Date.now()) - deploymentStarted
                    if (timeSinceDeploymentStarted < 5000) break

                    console.log(chalk.greenBright(`   finished: [${className}] -> ${event.deployment.statusMessage} ✅ ${(timeSinceDeploymentStarted / 1000).toFixed(1)} seconds`))
                    resolve(true)
                    break
                  case 'started':
                    console.log(chalk.blue(`   started : [${className}] -> ${event.deployment.statusMessage}`))
                    break
                  case 'ongoing':
                    console.log(chalk.blue(`   ongoin  : [${className}] -> ${event.deployment.statusMessage}`))
                    break
                  default:
                    break
                }
              }
            },
          )
        } catch (error) {
          throw error
        }
      }).catch((error) => {
        throw error
      })
    } catch (error: any) {
      console.log(chalk.redBright('\n Error accured while setting models and files ! '))

      const res_status = error?.response?.status || ''
      const res_statusText = error?.response?.statusText || ''
      const res_data = JSON.stringify(error?.response?.data || {})

      console.log(chalk.redBright(`status: ${res_status} statusText: ${res_statusText} data: ${res_data}`))
    }
  }

  async getRemoteClassFilesAndModelsV2(className: string): Promise<GetFilesAndModelsResponse> {
    const classInstance = await this.getClassInstance(className)
    try {
      const response = await classInstance.call<GetFilesAndModelsResponse>({
        method: 'getModelsAndFiles',
      })

      const { models, files } = response.data

      const _models = models.map((item: any) => {
        return {
          ...item,
          classId: className,
          content: gunzipSync(Buffer.from(item.content, 'base64')).toString('utf-8'),
        }
      })

      const _files = files.map((item: any) => {
        return {
          ...item,
          classId: className,
          content: gunzipSync(Buffer.from(item.content, 'base64')).toString('utf-8'),
        }
      })

      return { models: _models, files: _files }
    } catch (error: any) {
      console.log(chalk.redBright('\n Error accured while setting models and files ! '))

      const res_status = error?.response?.status || ''
      const res_statusText = error?.response?.statusText || ''
      const res_data = JSON.stringify(error?.response?.data || {})

      console.log(chalk.redBright(`status: ${res_status} statusText: ${res_statusText} data: ${res_data}`))
      return { models: [], files: [] }
    }
  }

  async setRemoteClassFilesAndModelsV2(className: string, files: object, models: object): Promise<{ success: boolean }> {
    const classInstance = await this.getClassInstance(className)
    try {
      const response = await classInstance.call<{ success: boolean }>({
        method: 'setModelsAndFiles',
        body: {
          files,
          models,
        },
      })
      return { success: response.data.success }
    } catch (error: any) {
      console.log(chalk.redBright('\n Error accured while setting models and files ! '))

      const res_status = error?.response?.status || ''
      const res_statusText = error?.response?.statusText || ''
      const res_data = JSON.stringify(error?.response?.data || {})

      console.log(chalk.redBright(`status: ${res_status} statusText: ${res_statusText} data: ${res_data}`))
      return { success: false }
    }
  }
}
