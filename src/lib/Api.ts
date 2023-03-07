import { RetterRootClasses, RetterRootMethods, RetterSdk } from "./RetterSdk";
import { IProjectDetail } from "../Interfaces/IProjectDetail";
import { Project } from "./Project";
import { gunzipSync } from "zlib";
import { ConsoleMessage, DeploymentMessageStatus } from "./ConsoleMessage";
import {
  Deployment,
  DeploymentObjectItemStatus,
  DeploymentObjectItemType,
} from "./Deployment";
import { IRemoteDependencyContent } from "./Dependencies";
import { IPreDeploymentContext } from "./ProjectManager";
import Retter, { RetterCloudObject, RetterCloudObjectState } from "@retter/sdk";

export interface RemoteClassFileItem {
  name: string;
  content: string;
  _updateToken: string;
}

export interface ISaveClassFilesInput {
  name: string;
  content?: string;
  status: "EDITED" | "DELETED" | "ADDED";
}

// interface IApi {
//   createNewProject(
//     alias: string
//   ): Promise<{ projectId: string; detail: IProjectDetail }>;

//   getProject(projectId: string): Promise<{ detail: IProjectDetail }>;

//   getRemoteClassFiles(
//     projectId: string,
//     className: string
//   ): Promise<RemoteClassFileItem[]>;

//   upsertModel(modelName: string, modelDefinition?: object): Promise<void>;

//   upsertModels(
//     models: { modelName: string; modelDefinition?: object }[]
//   ): Promise<void>;

//   createClass(className: string, templateId?: string): Promise<void>;

//   saveClassFiles(
//     className: string,
//     input: ISaveClassFilesInput[]
//   ): Promise<void>;

//   deployClass(className: string, force: boolean): Promise<void>;

//   saveAndDeployClass(
//     className: string,
//     input: ISaveClassFilesInput[],
//     deploymentStatus: IPreDeploymentContext,
//     force: boolean
//   ): Promise<void>;

//   getRemoteDependencies(): Promise<IRemoteDependencyContent[]>;

//   upsertDependency(dependencyName: string): Promise<string>;

//   commitUpsertDependency(dependencyName: string, hash: string): Promise<void>;
// }

export class Api {
  private retter: Retter
  private projectInstance: RetterCloudObject
  private projectState: any
  private classInstances: { [key: string]: RetterCloudObject } = {}
  
  // ***********************
  // *  CONSTRUCTOR
  // ***********************

  constructor(retter: Retter, projectInstance: RetterCloudObject) {
    this.retter = retter
    this.projectInstance = projectInstance
  }

  static async createAPI(profile: string, projectId: string) {
    // Use await to perform async operations
    const retter = await RetterSdk.getRootRetterSdkByAdminProfile(profile)
    const projectInstance = await RetterSdk.getCloudObject(retter, {
      useLocal: true,
      classId: RetterRootClasses.Project,
      instanceId: projectId,
    })

    return new Api(retter, projectInstance)
  }

  // ***********************
  // *  CONSTRUCTOR
  // ***********************

  async getClassInstance(className: string): Promise<RetterCloudObject> {
    if (this.classInstances[className]) {
      return this.classInstances[className]
    }
    
    this.classInstances[className] = await RetterSdk.getCloudObject(
      this.retter,
      {
        useLocal: true,
        classId: RetterRootClasses.RetterClass,
        instanceId: `${this.projectInstance.instanceId}_${className}`,
      }
    )
    return this.classInstances[className]
  }

  async createClass(className: string, templateId?: string): Promise<void> {
    await RetterSdk.callMethod(this.projectInstance, {
      method: RetterRootMethods.createClass,
      body: {
        classId: className,
      },
    })
  }

  async saveClassFiles(className: string, input: ISaveClassFilesInput[]): Promise<void> {
    const classInstance = await this.getClassInstance(className)
    await RetterSdk.callMethod(classInstance, {
      method: RetterRootMethods.saveClassFiles,
      body: {
        files: input,
      },
    })
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
    await RetterSdk.callMethod(classInstance, {
      method: RetterRootMethods.deployClass,
      body: {
        force,
      },
    })

    await new Promise((resolve, reject) => {
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
    })
  }

  async upsertModel(modelName: string, modelDefinition?: object): Promise<void> {
    await RetterSdk.callMethod(this.projectInstance, {
      method: RetterRootMethods.upsertModel,
      body: {
        modelName,
        modelDefinition,
      },
    })
  }

  async upsertModels(models: { modelName: string; modelDefinition?: object }[]): Promise<void> {
    await RetterSdk.callMethod(this.projectInstance, {
      method: RetterRootMethods.upsertModels,
      body: {
        models,
      },
    })
  }

  async createNewProject(alias: string): Promise<{ projectId: string; detail: IProjectDetail }> {
    const projectInstance = await RetterSdk.getCloudObject(
     this.retter, {
      classId: RetterRootClasses.Project,
      body: {
        alias,
      },
    })

    let state
    try {
      state = (await projectInstance.getState()).data
    } catch (e) {
      throw new Error('Project state error')
    }
    if (!state) throw new Error('Project state not found')

    return {
      projectId: projectInstance.instanceId,
      detail: state.public as any,
    }
  }

  async getProjectState(): Promise<RetterCloudObjectState> {
    if (!this.projectState) {
      this.projectState = (await this.projectInstance.getState()).data
    }
    return this.projectState
  }

  async getProjectStatePublic(): Promise<{ detail: IProjectDetail }> {
    return {
      detail: (await this.projectInstance.getState()).data.public as any,
    }
  }

  async getRemoteClassFiles(className: string): Promise<RemoteClassFileItem[]> {
    const classInstance = await this.getClassInstance(className)
    const response = await RetterSdk.callMethod<RemoteClassFileItem[]>(classInstance, {
      method: RetterRootMethods.getClassFiles,
    })

    return response.map((item) => {
      return {
        ...item,
        content: gunzipSync(Buffer.from(item.content, 'base64')).toString('utf-8'),
      }
    })
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
    const result = await RetterSdk.callMethod(this.projectInstance, {
      method: RetterRootMethods.upsertDependency,
      body: {
        dependencyName,
      },
    })
    return result.url
  }

  async commitUpsertDependency(dependencyName: string, hash: string): Promise<void> {
    const result = await RetterSdk.callMethod(this.projectInstance, {
      method: RetterRootMethods.upsertDependency,
      body: {
        dependencyName,
        commit: true,
        hash,
      },
    })
    return result.url
  }
}
