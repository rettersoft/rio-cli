import {RetterRootClasses, RetterRootMethods, RetterSdk} from "./RetterSdk";
import {IProjectDetail} from "../Interfaces/IProjectDetail";
import {Project} from "./Project";
import {gunzipSync} from "zlib";
import {ConsoleMessage, DeploymentMessageStatus} from "./ConsoleMessage";
import {DeploymentObjectItemStatus, DeploymentObjectItemType} from "./Deployment";


export interface RemoteClassFileItem {
    name: string
    content: string
    _updateToken: string
}

export interface ISaveClassFilesInput {
    name: string
    content?: string
    status: 'EDITED' | 'DELETED' | 'ADDED'
}

interface IApi {
    createNewProject(alias: string): Promise<{ projectId: string, detail: IProjectDetail }>

    getProject(projectId: string): Promise<{ detail: IProjectDetail }>

    getRemoteClassFiles(projectId: string, className: string): Promise<RemoteClassFileItem[]>

    upsertModel(modelName: string, modelDefinition?: object): Promise<void>

    createClass(className: string, templateId?: string): Promise<void>

    saveClassFiles(className: string, input: ISaveClassFilesInput[]): Promise<void>

    deployClass(className: string, force: boolean): Promise<void>
}

export class Api implements IApi {
    private static instance: IApi
    private readonly profile: string;

    constructor(profile: string) {
        this.profile = profile
    }

    static getInstance(profile: string): IApi {
        if (this.instance) return Api.instance
        Api.instance = <IApi><unknown>new Api(profile)
        return Api.instance
    }

    async createClass(className: string, templateId?: string): Promise<void> {
        const projectRioConfig = Project.getProjectRioConfig()
        const projectInstance = await RetterSdk.getCloudObject(await RetterSdk.getRootRetterSdkByAdminProfile(this.profile), {
            useLocal: true,
            classId: RetterRootClasses.Project,
            instanceId: projectRioConfig.projectId,
        })
        await RetterSdk.callMethod(projectInstance, {
            method: RetterRootMethods.createClass,
            body: {
                classId: className
            }
        })
    }

    async saveClassFiles(className: string, input: ISaveClassFilesInput[]): Promise<void> {
        const projectRioConfig = Project.getProjectRioConfig()
        const classInstance = await RetterSdk.getCloudObject(await RetterSdk.getRootRetterSdkByAdminProfile(this.profile),
            {
                useLocal: true,
                classId: RetterRootClasses.RetterClass,
                instanceId: `${projectRioConfig.projectId}_${className}`,
            })

        await RetterSdk.callMethod(classInstance, {
            method: RetterRootMethods.saveClassFiles,
            body: {
                files: input
            }
        })
    }

    async deployClass(className: string, force: boolean): Promise<void> {
        const projectRioConfig = Project.getProjectRioConfig()
        const classInstance = await RetterSdk.getCloudObject(await RetterSdk.getRootRetterSdkByAdminProfile(this.profile), {
            useLocal: true,
            classId: RetterRootClasses.RetterClass,
            instanceId: `${projectRioConfig.projectId}_${className}`,
        })

        await RetterSdk.callMethod(classInstance, {
            method: RetterRootMethods.deployClass,
            body: {
                force
            }
        })

        await (new Promise((resolve, reject) => {
            classInstance.state?.public?.subscribe((event: {
                deployment?: {
                    status: 'started' | 'ongoing' | 'failed' | 'finished',
                    statusMessage: string
                }
            }) => {
                if (event.deployment) {
                    switch (event.deployment.status) {
                        case "failed":
                            ConsoleMessage.deploymentMessage({
                                type: DeploymentObjectItemType.CLASS,
                                status: DeploymentObjectItemStatus.FAILED,
                                path: className
                            }, DeploymentMessageStatus.FAILED)
                            reject(event.deployment.statusMessage)
                            break
                        case "finished":
                            ConsoleMessage.deploymentMessage({
                                type: DeploymentObjectItemType.CLASS,
                                status: DeploymentObjectItemStatus.FINISHED,
                                path: className
                            }, DeploymentMessageStatus.SUCCEED)
                            resolve(true)
                            break
                        case "started":
                            ConsoleMessage.deploymentMessage({
                                type: DeploymentObjectItemType.CLASS,
                                status: DeploymentObjectItemStatus.STARTED,
                                path: className
                            }, DeploymentMessageStatus.STARTED)
                            break
                        case "ongoing":
                            ConsoleMessage.deploymentMessage({
                                type: DeploymentObjectItemType.CLASS,
                                status: DeploymentObjectItemStatus.ONGOING,
                                path: className
                            }, DeploymentMessageStatus.DEPLOYING)
                            break
                        default:
                            break
                    }
                    ConsoleMessage.customDeploymentMessage(event.deployment.statusMessage)
                }
            })
        }))
    }

    async upsertModel(modelName: string, modelDefinition?: object): Promise<void> {
        const projectRioConfig = Project.getProjectRioConfig()
        const projectInstance = await RetterSdk.getCloudObject(await RetterSdk.getRootRetterSdkByAdminProfile(this.profile),
            {
                useLocal: true,
                classId: RetterRootClasses.Project,
                instanceId: projectRioConfig.projectId,
            })
        await RetterSdk.callMethod(projectInstance, {
            method: RetterRootMethods.upsertModel,
            body: {
                modelName,
                modelDefinition
            }
        })
    }

    async createNewProject(alias: string): Promise<{ projectId: string, detail: IProjectDetail }> {
        const projectInstance = await RetterSdk.getCloudObject(await RetterSdk.getRootRetterSdkByAdminProfile(this.profile),
            {
                classId: RetterRootClasses.Project,
                body: {
                    alias
                }
            })

        return {
            projectId: projectInstance.instanceId,
            detail: (await projectInstance.getState()).data?.public as any
        }
    }

    async getProject(projectId: string): Promise<{ detail: IProjectDetail }> {
        const projectInstance = await RetterSdk.getCloudObject(await RetterSdk.getRootRetterSdkByAdminProfile(this.profile),
            {
                useLocal: true,
                classId: RetterRootClasses.Project,
                instanceId: projectId
            })

        return {
            detail: (await projectInstance.getState()).data.public as any
        }
    }

    async getRemoteClassFiles(projectId: string, className: string): Promise<RemoteClassFileItem[]> {
        const retterClassInstance = await RetterSdk.getCloudObject(await RetterSdk.getRootRetterSdkByAdminProfile(this.profile),
            {
                useLocal: true,
                classId: RetterRootClasses.RetterClass,
                instanceId: `${projectId}_${className}`
            })
        const response = await RetterSdk.callMethod<RemoteClassFileItem[]>(retterClassInstance, {
            method: RetterRootMethods.getClassFiles
        })

        return response.map(item => {
            return {
                ...item,
                content: gunzipSync(Buffer.from(item.content, 'base64')).toString('utf-8'),
            }
        })
    }

}
