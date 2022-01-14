import {IAllClassContents} from "./Project";
import {Api, ISaveClassFilesInput} from "./Api";
import {ConsoleMessage, DeploymentMessageStatus} from "./ConsoleMessage";
import {IPreDeploymentContext} from "./ProjectManager";
import {CustomError} from "./CustomError";
import {gzipSync} from "zlib";

enum IDeploymentObjectItemStatus {
    EDITED = 'EDITED',
    DELETED = 'DELETED',
    CREATED = 'CREATED',
    NONE = 'NONE',
}

enum IDeploymentObjectItemType {
    MODEL = 'MODEL',
    CLASS = 'CLASS',
    CLASS_FILE = 'CLASS_FILE',
}

export interface IDeploymentOperationItem {
    status: IDeploymentObjectItemStatus
    type: IDeploymentObjectItemType
    oldContent?: string
    newContent?: string
    path: string // if type eq MODEL and CLASS, it has one path. if type eq CLASS_FILE, it has multiple path with '/' separator
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

interface IProjectModels {
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
            if (item.status !== IDeploymentObjectItemStatus.NONE) return true
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
            ...deploymentSummary.classDeploymentsSummary.classDeploymentsSummary.createdItems,
            ...deploymentSummary.classDeploymentsSummary.classDeploymentsSummary.deletedItems,
        ]) {
            ConsoleMessage.deploymentMessage(item, DeploymentMessageStatus.STARTED)
            try {
                switch (item.type) {
                    case IDeploymentObjectItemType.MODEL:
                        switch (item.status) {
                            case IDeploymentObjectItemStatus.DELETED:
                                await api.upsertModel(item.path)
                                break
                            case IDeploymentObjectItemStatus.EDITED:
                            case IDeploymentObjectItemStatus.CREATED:
                                if (!item.newContent) {
                                    CustomError.throwError('new content not found')
                                } else {
                                    await api.upsertModel(item.path, JSON.parse(item.newContent))
                                }
                                break
                            default:
                                break
                        }
                        break
                    case IDeploymentObjectItemType.CLASS:
                        switch (item.status) {
                            case IDeploymentObjectItemStatus.DELETED:
                                // IGNORED
                                break
                            case IDeploymentObjectItemStatus.CREATED:
                                await api.createClass(item.path, "")
                                break
                            default:
                                break
                        }
                        break
                    case IDeploymentObjectItemType.CLASS_FILE:
                        // IGNORE
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
            ].find(item => item.path === className)
            if (!currentClassDeploymentItem || currentClassDeploymentItem.status === IDeploymentObjectItemStatus.DELETED) continue


            const preparedData: ISaveClassFilesInput[] = []
            const changedFileDeployments = [
                ...deploymentSummary.classDeploymentsSummary.classesFileChanges[className].fileEdited,
                ...deploymentSummary.classDeploymentsSummary.classesFileChanges[className].fileDeleted,
                ...deploymentSummary.classDeploymentsSummary.classesFileChanges[className].fileCreated,
            ]
            for (const item of changedFileDeployments) {
                ConsoleMessage.deploymentMessage(item, DeploymentMessageStatus.SAVING)
                switch (item.status) {
                    case IDeploymentObjectItemStatus.CREATED:
                        preparedData.push({
                            status: 'ADDED',
                            content: gzipSync(Buffer.from(item.newContent!)).toString('base64'),
                            name: item.path.split('/').pop()!
                        })
                        break
                    case IDeploymentObjectItemStatus.EDITED:
                        preparedData.push({
                            status: 'EDITED',
                            content: gzipSync(Buffer.from(item.newContent!)).toString('base64'),
                            name: item.path.split('/').pop()!
                        })
                        break
                    case IDeploymentObjectItemStatus.DELETED:
                        preparedData.push({
                            status: 'DELETED',
                            name: item.path.split('/').pop()!
                        })
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

            if (Deployment.isChanged(deploymentSummary)) {
                ConsoleMessage.deploymentMessage(currentClassDeploymentItem, DeploymentMessageStatus.DEPLOYING)
                await api.deployClass(className)
                ConsoleMessage.deploymentMessage(currentClassDeploymentItem, DeploymentMessageStatus.DEPLOYED)
            }
        }

    }

    static getModelDeploymentsContext(localModels: IProjectModels, remoteModels: IProjectModels): IDeploymentSummary {
        const deleted: IDeploymentOperationItem[] = Object.keys(remoteModels).reduce<IDeploymentOperationItem[]>((acc, modelName) => {
            if (!localModels[modelName]) {
                acc.push({
                    path: modelName,
                    type: IDeploymentObjectItemType.MODEL,
                    status: IDeploymentObjectItemStatus.DELETED,
                    oldContent: JSON.stringify(remoteModels[modelName])
                })
            }
            return acc
        }, [])

        const created = Object.keys(localModels).reduce<IDeploymentOperationItem[]>((acc, modelName) => {
            if (!remoteModels[modelName]) {
                acc.push({
                    path: modelName,
                    type: IDeploymentObjectItemType.MODEL,
                    status: IDeploymentObjectItemStatus.CREATED,
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
                        type: IDeploymentObjectItemType.MODEL,
                        status: IDeploymentObjectItemStatus.EDITED,
                        oldContent: JSON.stringify(remoteModels[modelName]),
                        newContent: JSON.stringify(localModels[modelName])
                    })
                } else {
                    none.push({
                        path: modelName,
                        type: IDeploymentObjectItemType.MODEL,
                        status: IDeploymentObjectItemStatus.NONE,
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

    static getClassDeploymentsContext(localClasses: IAllClassContents, remoteClasses: IAllClassContents): {
        classDeploymentsSummary: IClassesDeploymentSummary,
        classesFileChanges: IFileChangesByClassName
    } {
        const classDeleted: IDeploymentOperationItem[] = []
        const classNone: IDeploymentOperationItem[] = []
        const classCreated: IDeploymentOperationItem[] = []

        const classesFileChanges: IFileChangesByClassName = {}

        // for deleted
        Object.keys(remoteClasses).forEach(className => {
            if (!localClasses[className]) classDeleted.push({
                path: className,
                type: IDeploymentObjectItemType.CLASS,
                status: IDeploymentObjectItemStatus.DELETED
            })
            Object.keys(remoteClasses[className]).forEach(fileName => {
                if (!localClasses[className][fileName]) {
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
                        type: IDeploymentObjectItemType.CLASS_FILE,
                        status: IDeploymentObjectItemStatus.DELETED,
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
                    type: IDeploymentObjectItemType.CLASS,
                    status: IDeploymentObjectItemStatus.CREATED
                })
            } else {
                classNone.push({
                    path: className,
                    type: IDeploymentObjectItemType.CLASS,
                    status: IDeploymentObjectItemStatus.NONE
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
                        type: IDeploymentObjectItemType.CLASS_FILE,
                        status: IDeploymentObjectItemStatus.CREATED,
                        newContent: localClasses[className][fileName]
                    })
                } else {
                    if (localClasses[className][fileName] !== remoteClasses[className][fileName]) {
                        classesFileChanges[className].fileEdited.push({
                            path: [className, fileName].join('/'),
                            type: IDeploymentObjectItemType.CLASS_FILE,
                            status: IDeploymentObjectItemStatus.EDITED,
                            oldContent: remoteClasses[className][fileName],
                            newContent: localClasses[className][fileName]
                        })
                    } else {
                        classesFileChanges[className].fileNone.push({
                            path: [className, fileName].join('/'),
                            type: IDeploymentObjectItemType.CLASS_FILE,
                            status: IDeploymentObjectItemStatus.NONE,
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

}
