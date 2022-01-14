import {RetterRootClasses, RetterRootMethods, RetterSdk} from "./RetterSdk";
import {IProjectDetail} from "../Interfaces/IProjectDetail";
import {Project} from "./Project";
import {gunzipSync} from "zlib";
import {ConsoleMessage} from "./ConsoleMessage";
import chalk from "chalk";


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
        const sdk = await RetterSdk.getRootRetterSdkByAdminProfile(this.profile)
        const projectInstance = await sdk.getCloudObject({
            useLocal: true,
            classId: RetterRootClasses.Project,
            instanceId: projectRioConfig.projectId,
        })
        await projectInstance.call({
            method: RetterRootMethods.createClass,
            body: {
                classId: className
            }
        })
    }

    async saveClassFiles(className: string, input: ISaveClassFilesInput[]): Promise<void> {
        const projectRioConfig = Project.getProjectRioConfig()
        const sdk = await RetterSdk.getRootRetterSdkByAdminProfile(this.profile)
        const classInstance = await sdk.getCloudObject({
            useLocal: true,
            classId: RetterRootClasses.RetterClass,
            instanceId: `${projectRioConfig.projectId}_${className}`,
        })

        await classInstance.call({
            method: RetterRootMethods.saveClassFiles,
            body: {
                files: input
            }
        })
    }

    async deployClass(className: string, force: boolean): Promise<void> {
        const projectRioConfig = Project.getProjectRioConfig()
        const sdk = await RetterSdk.getRootRetterSdkByAdminProfile(this.profile)
        const classInstance = await sdk.getCloudObject({
            useLocal: true,
            classId: RetterRootClasses.RetterClass,
            instanceId: `${projectRioConfig.projectId}_${className}`,
        })

        await classInstance.call({
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
                            ConsoleMessage.message(chalk.redBright('- CLASS_DEPLOYMENT_FAILED::' + className,
                                chalk.bold.gray(event.deployment.statusMessage)))
                            reject(event.deployment.statusMessage)
                            break
                        case "finished":
                            ConsoleMessage.message(chalk.greenBright('- CLASS_DEPLOYMENT_FINISHED::' + className,
                                chalk.bold.gray(event.deployment.statusMessage)))
                            resolve(true)
                            break
                        case "started":
                            ConsoleMessage.message(chalk.greenBright('- CLASS_DEPLOYMENT_STARTED::' + className,
                                chalk.bold.gray(event.deployment.statusMessage)))
                        case "ongoing":
                            ConsoleMessage.message(chalk.greenBright('- CLASS_DEPLOYMENT_ONGOING::' + className,
                                chalk.bold.gray(event.deployment.statusMessage)))
                            break
                        default:
                            break
                    }
                }
            })
        }))
    }

    async upsertModel(modelName: string, modelDefinition?: object): Promise<void> {
        const projectRioConfig = Project.getProjectRioConfig()
        const sdk = await RetterSdk.getRootRetterSdkByAdminProfile(this.profile)
        const projectInstance = await sdk.getCloudObject({
            useLocal: true,
            classId: RetterRootClasses.Project,
            instanceId: projectRioConfig.projectId,
        })
        await projectInstance.call({
            method: RetterRootMethods.upsertModel,
            body: {
                modelName,
                modelDefinition
            }
        })
    }

    async createNewProject(alias: string): Promise<{ projectId: string, detail: IProjectDetail }> {
        const sdk = await RetterSdk.getRootRetterSdkByAdminProfile(this.profile)
        const projectInstance = await sdk.getCloudObject({
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
        const sdk = await RetterSdk.getRootRetterSdkByAdminProfile(this.profile)
        const projectInstance = await sdk.getCloudObject({
            useLocal: true,
            classId: RetterRootClasses.Project,
            instanceId: projectId
        })

        return {
            detail: (await projectInstance.getState()).data.public as any
        }
    }

    async getRemoteClassFiles(projectId: string, className: string): Promise<RemoteClassFileItem[]> {
        const sdk = await RetterSdk.getRootRetterSdkByAdminProfile(this.profile)
        const retterClassInstance = await sdk.getCloudObject({
            useLocal: true,
            classId: RetterRootClasses.RetterClass,
            instanceId: `${projectId}_${className}`
        })
        const response = await retterClassInstance.call<RemoteClassFileItem[]>({
            method: RetterRootMethods.getClassFiles
        })
        return response.data.map(item => {
            return {
                ...item,
                content: gunzipSync(Buffer.from(item.content, 'base64')).toString('utf-8'),
            }
        })
    }

}
