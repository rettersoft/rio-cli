import {IClassContents} from "./Project";
import {Api, ISaveClassFilesInput} from "./Api";
import {ConsoleMessage, DeploymentMessageStatus} from "./ConsoleMessage";
import {IPreDeploymentContext} from "./ProjectManager";
import {CustomError} from "./CustomError";
import {gzipSync} from "zlib";
import {Ignore} from "./Ignore";
import path from "path";
import process from "process";
import {PROJECT_MODEL_FILE_EXTENSION, PROJECT_MODELS_FOLDER} from "../config";
import {IDependencyContent, IRemoteDependencyContent} from "./Dependencies";
import axios from "axios";

export enum DeploymentObjectItemStatus {
    EDITED = 'EDITED',
    DELETED = 'DELETED',
    CREATED = 'CREATED',
    NONE = 'NONE',

    ONGOING = 'ONGOING',
    FINISHED = 'FINISHED',
    FAILED = 'FAILED',
    STARTED = 'STARTED',
}

export enum DeploymentObjectItemType {
    DEPENDENCY = 'DEPENDENCY',
    MODEL = 'MODEL',
    CLASS = 'CLASS',
    CLASS_FILE = 'CLASS_FILE',
}

export interface IDeploymentOperationItem {
    status: DeploymentObjectItemStatus
    type: DeploymentObjectItemType
    oldContent?: string
    newContent?: string
    path: string // if type eq MODEL and CLASS, it has one path. if type eq CLASS_FILE, it has multiple path with '/' separator
    hash?: string
}

export interface IDeploymentSummary {
    editedItems: IDeploymentOperationItem[]
    deletedItems: IDeploymentOperationItem[]
    createdItems: IDeploymentOperationItem[]
    noneItems: IDeploymentOperationItem[]
}

export interface IFileChangesByClassName {
    [className: string]: {
        fileDeleted: IDeploymentOperationItem[]
        fileEdited: IDeploymentOperationItem[]
        fileNone: IDeploymentOperationItem[]
        fileCreated: IDeploymentOperationItem[]
    }
}

export type IClassesDeploymentSummary = Omit<IDeploymentSummary, 'editedItems'>

export interface IProjectModels {
    [modelName: string]: object
}

export class Deployment {

    static isChanged(deploymentSummary: IPreDeploymentContext) {
        for (const item of [
            ...deploymentSummary.modelDeploymentsSummary.createdItems,
            ...deploymentSummary.modelDeploymentsSummary.editedItems,
            ...deploymentSummary.modelDeploymentsSummary.deletedItems,
            ...deploymentSummary.classDeploymentsSummary.classDeploymentsSummary.createdItems,
            ...deploymentSummary.classDeploymentsSummary.classDeploymentsSummary.deletedItems,
        ]) {
            if (item.status !== DeploymentObjectItemStatus.NONE) return true
        }

        for (const className of Object.keys(deploymentSummary.classDeploymentsSummary.classesFileChanges)) {
            const changedFileDeployments = [
                ...deploymentSummary.classDeploymentsSummary.classesFileChanges[className].fileEdited,
                ...deploymentSummary.classDeploymentsSummary.classesFileChanges[className].fileDeleted,
                ...deploymentSummary.classDeploymentsSummary.classesFileChanges[className].fileCreated,
            ]
            if (changedFileDeployments.length) return true
        }
        return false

    }

    static async deploy(deploymentSummary: IPreDeploymentContext, force: boolean) {
        const api = Api.getInstance(deploymentSummary.profile)

        for (const item of [
            ...deploymentSummary.modelDeploymentsSummary.createdItems,
            ...deploymentSummary.modelDeploymentsSummary.editedItems,
            ...deploymentSummary.modelDeploymentsSummary.deletedItems,
            ...(force ? deploymentSummary.modelDeploymentsSummary.noneItems : []),
            ...deploymentSummary.classDeploymentsSummary.classDeploymentsSummary.createdItems,
            ...deploymentSummary.classDeploymentsSummary.classDeploymentsSummary.deletedItems,
            ...deploymentSummary.dependencyDeploymentsSummary.createdItems,
            ...deploymentSummary.dependencyDeploymentsSummary.editedItems,
            ...deploymentSummary.dependencyDeploymentsSummary.deletedItems,
        ]) {
            ConsoleMessage.deploymentMessage(item, DeploymentMessageStatus.STARTED)
            try {
                switch (item.type) {
                    case DeploymentObjectItemType.MODEL:
                        switch (item.status) {
                            case DeploymentObjectItemStatus.DELETED:
                                // IGNORED
                                // await api.upsertModel(item.path)
                                break
                            case DeploymentObjectItemStatus.EDITED:
                            case DeploymentObjectItemStatus.CREATED:
                                if (!item.newContent) {
                                    CustomError.throwError('new content not found')
                                } else {
                                    await api.upsertModel(item.path, JSON.parse(item.newContent))
                                }
                                break
                            case DeploymentObjectItemStatus.NONE:
                                if (!item.oldContent) {
                                    CustomError.throwError('old content not found')
                                } else {
                                    await api.upsertModel(item.path, JSON.parse(item.oldContent))
                                }
                                break
                            default:
                                break
                        }
                        break
                    case DeploymentObjectItemType.CLASS:
                        switch (item.status) {
                            case DeploymentObjectItemStatus.DELETED:
                                // IGNORED
                                break
                            case DeploymentObjectItemStatus.CREATED:
                                await api.createClass(item.path, "")
                                break
                            default:
                                break
                        }
                        break
                    case DeploymentObjectItemType.CLASS_FILE:
                        // IGNORE
                        break
                    case DeploymentObjectItemType.DEPENDENCY:
                        switch (item.status) {
                            case DeploymentObjectItemStatus.DELETED:
                                // IGNORED
                                break
                            case DeploymentObjectItemStatus.CREATED:
                            case DeploymentObjectItemStatus.EDITED:
                                if (!item.newContent) throw new Error('Dependency new content not found' + item.path)
                                if (!item.hash) throw new Error('Dependency hash not found' + item.path)
                                const url = await api.upsertDependency(item.path)
                                await axios.put(url, Buffer.from(item.newContent, 'base64'), {
                                    headers: {
                                        'Content-Type': 'application/zip',
                                    }
                                })
                                await api.commitUpsertDependency(item.path, item.hash)
                                break
                            default:
                                break
                        }
                        break
                    default:
                        CustomError.throwError('Unsupported deployment item type')
                        break
                }
                ConsoleMessage.deploymentMessage(item, DeploymentMessageStatus.SUCCEED)
            } catch (e) {
                ConsoleMessage.deploymentMessage(item, DeploymentMessageStatus.FAILED)
                throw e
            }
        }

        for (const className of Object.keys(deploymentSummary.classDeploymentsSummary.classesFileChanges)) {

            //ignore deleted class
            const currentClassDeploymentItem = [
                ...deploymentSummary.classDeploymentsSummary.classDeploymentsSummary.noneItems,
                ...deploymentSummary.classDeploymentsSummary.classDeploymentsSummary.deletedItems,
                ...deploymentSummary.classDeploymentsSummary.classDeploymentsSummary.createdItems,
                ...deploymentSummary.classDeploymentsSummary.classDeploymentsSummary.noneItems,
            ].find(item => item.path === className)
            if (!currentClassDeploymentItem || currentClassDeploymentItem.status === DeploymentObjectItemStatus.DELETED) continue


            const preparedData: ISaveClassFilesInput[] = []
            const changedFileDeployments = [
                ...deploymentSummary.classDeploymentsSummary.classesFileChanges[className].fileEdited,
                ...deploymentSummary.classDeploymentsSummary.classesFileChanges[className].fileDeleted,
                ...deploymentSummary.classDeploymentsSummary.classesFileChanges[className].fileCreated,
                ...(force ? deploymentSummary.classDeploymentsSummary.classesFileChanges[className].fileNone : [])
            ]
            for (const item of changedFileDeployments) {
                ConsoleMessage.deploymentMessage(item, DeploymentMessageStatus.SAVING)
                const classFileName = item.path.replace(className + '/', '')
                switch (item.status) {
                    case DeploymentObjectItemStatus.CREATED:
                        preparedData.push({
                            status: 'ADDED',
                            content: gzipSync(Buffer.from(item.newContent!)).toString('base64'),
                            name: classFileName
                        })
                        break
                    case DeploymentObjectItemStatus.EDITED:
                        preparedData.push({
                            status: 'EDITED',
                            content: gzipSync(Buffer.from(item.newContent!)).toString('base64'),
                            name: classFileName
                        })
                        break
                    case DeploymentObjectItemStatus.DELETED:
                        preparedData.push({
                            status: 'DELETED',
                            name: classFileName,
                            content: ''
                        })
                        break
                    case DeploymentObjectItemStatus.NONE:
                        // force save
                        if (force) {
                            preparedData.push({
                                status: 'EDITED',
                                name: item.path.split('/').pop()!,
                                content: gzipSync(Buffer.from(item.oldContent!)).toString('base64'),
                            })
                        }
                        break
                    default:
                        break
                }
            }

            if (preparedData.length) {
                await api.saveClassFiles(className, preparedData)
            }

            for (const item of changedFileDeployments) {
                ConsoleMessage.deploymentMessage(item, DeploymentMessageStatus.SAVED)
            }

            if (force || Deployment.isChanged(deploymentSummary)) {
                ConsoleMessage.deploymentMessage(currentClassDeploymentItem, DeploymentMessageStatus.DEPLOYING)
                await api.deployClass(className, force)
                ConsoleMessage.deploymentMessage(currentClassDeploymentItem, DeploymentMessageStatus.DEPLOYED)
            }
        }

    }

    static getModelDeploymentsContext(localModels: IProjectModels, remoteModels: IProjectModels): IDeploymentSummary {

        /**
         * IGNORE LOCAL FILES
         */
        localModels = Object.keys(localModels).reduce<IProjectModels>((acc, localModelName) => {
            if (!Ignore.isIgnored(
                path.relative(process.cwd(), path.join(PROJECT_MODELS_FOLDER, localModelName + PROJECT_MODEL_FILE_EXTENSION))
            )) {
                acc[localModelName] = localModels[localModelName]
            }
            return acc
        }, {})

        /**
         * IGNORE REMOTE FILES
         */
        remoteModels = Object.keys(remoteModels).reduce<IProjectModels>((acc, remoteModelName) => {
            if (!Ignore.isIgnored(
                path.relative(process.cwd(), path.join(PROJECT_MODELS_FOLDER, remoteModelName + PROJECT_MODEL_FILE_EXTENSION))
            )) {
                acc[remoteModelName] = remoteModels[remoteModelName]
            }
            return acc
        }, {})


        const deleted: IDeploymentOperationItem[] = Object.keys(remoteModels).reduce<IDeploymentOperationItem[]>((acc, modelName) => {
            if (!localModels[modelName]) {
                acc.push({
                    path: modelName,
                    type: DeploymentObjectItemType.MODEL,
                    status: DeploymentObjectItemStatus.DELETED,
                    oldContent: JSON.stringify(remoteModels[modelName])
                })
            }
            return acc
        }, [])

        const created = Object.keys(localModels).reduce<IDeploymentOperationItem[]>((acc, modelName) => {
            if (!remoteModels[modelName]) {
                acc.push({
                    path: modelName,
                    type: DeploymentObjectItemType.MODEL,
                    status: DeploymentObjectItemStatus.CREATED,
                    newContent: JSON.stringify(localModels[modelName])
                })
            }
            return acc
        }, [])

        const edit: IDeploymentOperationItem[] = []
        const none: IDeploymentOperationItem[] = []

        Object.keys(localModels).map((modelName) => {
            if (remoteModels[modelName]) {
                if (JSON.stringify(localModels[modelName]) !== JSON.stringify(remoteModels[modelName])) {
                    edit.push({
                        path: modelName,
                        type: DeploymentObjectItemType.MODEL,
                        status: DeploymentObjectItemStatus.EDITED,
                        oldContent: JSON.stringify(remoteModels[modelName]),
                        newContent: JSON.stringify(localModels[modelName])
                    })
                } else {
                    none.push({
                        path: modelName,
                        type: DeploymentObjectItemType.MODEL,
                        status: DeploymentObjectItemStatus.NONE,
                        oldContent: JSON.stringify(remoteModels[modelName])
                    })
                }
            }
        })

        return {
            createdItems: created,
            editedItems: edit,
            deletedItems: deleted,
            noneItems: none
        }
    }

    static getClassDeploymentsContext(localClasses: IClassContents, remoteClasses: IClassContents): {
        classDeploymentsSummary: IClassesDeploymentSummary,
        classesFileChanges: IFileChangesByClassName
    } {

        /**
         * IGNORE LOCAL FILES
         */
        localClasses = Object.keys(localClasses).reduce<IClassContents>((acc, localClassName) => {
            acc[localClassName] = Object.keys(localClasses[localClassName]).reduce<{ [fileName: string]: string }>((subAcc, localClassFileName) => {
                if (!Ignore.isIgnored(
                    path.relative(process.cwd(), localClassFileName)
                )) {
                    subAcc[localClassFileName] = localClasses[localClassName][localClassFileName]
                }
                return subAcc
            }, {})
            return acc
        }, {})

        /**
         * IGNORE REMOTE FILES
         */
        remoteClasses = Object.keys(remoteClasses).reduce<IClassContents>((acc, remoteClassName) => {
            acc[remoteClassName] = Object.keys(remoteClasses[remoteClassName]).reduce<{ [fileName: string]: string }>((subAcc, remoteClassFileName) => {
                if (!Ignore.isIgnored(
                    path.relative(process.cwd(), remoteClassFileName)
                )) {
                    subAcc[remoteClassFileName] = remoteClasses[remoteClassName][remoteClassFileName]
                }
                return subAcc
            }, {})
            return acc
        }, {})

        const classDeleted: IDeploymentOperationItem[] = []
        const classNone: IDeploymentOperationItem[] = []
        const classCreated: IDeploymentOperationItem[] = []

        const classesFileChanges: IFileChangesByClassName = {}

        // for deleted
        Object.keys(remoteClasses).forEach(className => {
            if (!localClasses[className]) classDeleted.push({
                path: className,
                type: DeploymentObjectItemType.CLASS,
                status: DeploymentObjectItemStatus.DELETED
            })
            Object.keys(remoteClasses[className]).forEach(fileName => {
                if (!localClasses[className] || !localClasses[className][fileName]) {
                    if (!classesFileChanges[className]) {
                        classesFileChanges[className] = {
                            fileNone: [],
                            fileEdited: [],
                            fileCreated: [],
                            fileDeleted: []
                        }
                    }
                    classesFileChanges[className].fileDeleted.push({
                        path: [className, fileName].join('/'),
                        type: DeploymentObjectItemType.CLASS_FILE,
                        status: DeploymentObjectItemStatus.DELETED,
                        oldContent: remoteClasses[className][fileName]
                    })

                }
            })
        })

        // for created
        Object.keys(localClasses).forEach(className => {
            if (!remoteClasses[className]) {
                classCreated.push({
                    path: className,
                    type: DeploymentObjectItemType.CLASS,
                    status: DeploymentObjectItemStatus.CREATED
                })
            } else {
                classNone.push({
                    path: className,
                    type: DeploymentObjectItemType.CLASS,
                    status: DeploymentObjectItemStatus.NONE
                })
            }
            Object.keys(localClasses[className]).forEach(fileName => {
                if (!classesFileChanges[className]) {
                    classesFileChanges[className] = {
                        fileNone: [],
                        fileEdited: [],
                        fileCreated: [],
                        fileDeleted: []
                    }
                }
                if (!remoteClasses[className] || !remoteClasses[className][fileName]) {
                    classesFileChanges[className].fileCreated.push({
                        path: [className, fileName].join('/'),
                        type: DeploymentObjectItemType.CLASS_FILE,
                        status: DeploymentObjectItemStatus.CREATED,
                        newContent: localClasses[className][fileName]
                    })
                } else {
                    if (localClasses[className][fileName] !== remoteClasses[className][fileName]) {
                        classesFileChanges[className].fileEdited.push({
                            path: [className, fileName].join('/'),
                            type: DeploymentObjectItemType.CLASS_FILE,
                            status: DeploymentObjectItemStatus.EDITED,
                            oldContent: remoteClasses[className][fileName],
                            newContent: localClasses[className][fileName]
                        })
                    } else {
                        classesFileChanges[className].fileNone.push({
                            path: [className, fileName].join('/'),
                            type: DeploymentObjectItemType.CLASS_FILE,
                            status: DeploymentObjectItemStatus.NONE,
                            oldContent: remoteClasses[className][fileName]
                        })
                    }
                }
            })
        })

        return {
            classDeploymentsSummary: {
                deletedItems: classDeleted,
                createdItems: classCreated,
                noneItems: classNone
            },
            classesFileChanges
        }

    }

    static getDependencyDeploymentsContext(localDependencies: IDependencyContent[], remoteDependencies: IRemoteDependencyContent[]): IDeploymentSummary {

        const editedItems: IDeploymentOperationItem[] = []
        const deletedItems: IDeploymentOperationItem[] = []
        const createdItems: IDeploymentOperationItem[] = []
        const noneItems: IDeploymentOperationItem[] = []

        remoteDependencies.forEach(rd => {
            if (!localDependencies.find(ld => ld.dependencyName === rd.dependencyName)) {
                deletedItems.push({
                    path: rd.dependencyName,
                    status: DeploymentObjectItemStatus.DELETED,
                    type: DeploymentObjectItemType.DEPENDENCY
                })
            }
        })

        localDependencies.forEach(ld => {
            const remoteModel = remoteDependencies.find(rd => rd.dependencyName === ld.dependencyName)
            if (!remoteModel) {
                createdItems.push({
                    path: ld.dependencyName,
                    status: DeploymentObjectItemStatus.CREATED,
                    type: DeploymentObjectItemType.DEPENDENCY,
                    newContent: ld.zip.toString('base64'),
                    hash: ld.hash
                })
            } else if (remoteModel.hash !== ld.hash) {
                editedItems.push({
                    path: ld.dependencyName,
                    status: DeploymentObjectItemStatus.EDITED,
                    type: DeploymentObjectItemType.DEPENDENCY,
                    newContent: ld.zip.toString('base64'),
                    hash: ld.hash
                })
            } else {
                noneItems.push({
                    path: ld.dependencyName,
                    status: DeploymentObjectItemStatus.NONE,
                    type: DeploymentObjectItemType.DEPENDENCY,
                    hash: ld.hash
                })
            }
        })

        return {
            editedItems,
            deletedItems,
            createdItems,
            noneItems
        }

    }

}
