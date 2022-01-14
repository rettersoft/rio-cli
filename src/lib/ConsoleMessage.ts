import {IDeploymentOperationItem, IFileChangesByClassName} from "./Deployment";
import chalk from "chalk";
import {IPreDeploymentContext} from "./ProjectManager";

export enum DeploymentMessageStatus {
    STARTED = "STARTED",
    FAILED = "FAILED",
    SUCCEED = "SUCCEED",
    SAVING = "SAVING",
    SAVED = "SAVED",
    DEPLOYING = "DEPLOYING",
    DEPLOYED = "DEPLOYED",
}

export class ConsoleMessage {

    static message(message: string) {
        console.log(message)
    }

    static deploymentMessage(item: IDeploymentOperationItem, status: DeploymentMessageStatus) {
        let statusStyle;
        switch (status) {
            case DeploymentMessageStatus.FAILED:
                statusStyle = chalk.bold.redBright
                break
            case DeploymentMessageStatus.STARTED:
            case DeploymentMessageStatus.SAVED:
            case DeploymentMessageStatus.SAVING:
            case DeploymentMessageStatus.DEPLOYING:
            case DeploymentMessageStatus.DEPLOYED:
            case DeploymentMessageStatus.SUCCEED:
                statusStyle = chalk.bold.greenBright
                break
            default:
                statusStyle = chalk.bold.gray
                break
        }
        console.log(
            chalk.gray((new Date()).toLocaleString()),
            statusStyle(status),
            chalk.green(item.type),
            chalk.bold.gray(item.status),
            chalk.bold.gray(item.path),
        )
    }

    static preDeployLog(preDeploymentContext: IPreDeploymentContext) {
        const charLimit = 20
        const newPreDeploymentContext: IPreDeploymentContext = {
            profile: preDeploymentContext.profile,
            classDeploymentsSummary: {
                classDeploymentsSummary: {
                    deletedItems: preDeploymentContext.classDeploymentsSummary.classDeploymentsSummary.deletedItems.map(item => {
                        return {
                            ...item,
                            ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                            ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                        }
                    }),
                    createdItems: preDeploymentContext.classDeploymentsSummary.classDeploymentsSummary.createdItems.map(item => {
                        return {
                            ...item,
                            ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                            ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                        }
                    }),
                    noneItems: preDeploymentContext.classDeploymentsSummary.classDeploymentsSummary.noneItems.map(item => {
                        return {
                            ...item,
                            ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                            ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                        }
                    }),
                },
                classesFileChanges: Object.keys(preDeploymentContext.classDeploymentsSummary.classesFileChanges)
                    .reduce<IFileChangesByClassName>((acc, className) => {
                        acc[className] = {
                            fileDeleted: preDeploymentContext.classDeploymentsSummary.classesFileChanges[className].fileDeleted.map(item => {
                                return {
                                    ...item,
                                    ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                                    ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                                }
                            }),
                            fileEdited: preDeploymentContext.classDeploymentsSummary.classesFileChanges[className].fileEdited.map(item => {
                                return {
                                    ...item,
                                    ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                                    ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                                }
                            }),
                            fileNone: preDeploymentContext.classDeploymentsSummary.classesFileChanges[className].fileNone.map(item => {
                                return {
                                    ...item,
                                    ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                                    ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                                }
                            }),
                            fileCreated: preDeploymentContext.classDeploymentsSummary.classesFileChanges[className].fileCreated.map(item => {
                                return {
                                    ...item,
                                    ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                                    ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                                }
                            }),
                        }
                        return acc
                    }, {})
            },
            modelDeploymentsSummary: {
                editedItems: preDeploymentContext.modelDeploymentsSummary.editedItems.map(item => {
                    return {
                        ...item,
                        ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                        ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                    }
                }),
                deletedItems: preDeploymentContext.modelDeploymentsSummary.deletedItems.map(item => {
                    return {
                        ...item,
                        ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                        ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                    }
                }),
                createdItems: preDeploymentContext.modelDeploymentsSummary.createdItems.map(item => {
                    return {
                        ...item,
                        ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                        ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                    }
                }),
                noneItems: preDeploymentContext.modelDeploymentsSummary.noneItems.map(item => {
                    return {
                        ...item,
                        ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                        ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                    }
                }),
            }
        }
        console.log(JSON.stringify(newPreDeploymentContext, null, 2))
    }

}
