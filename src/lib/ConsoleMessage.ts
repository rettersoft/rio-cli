import {IDeploymentOperationItem, IFileChangesByClassName} from "./Deployment";
import chalk from "chalk";
import {IPreDeploymentContext} from "./ProjectManager";
import {createStream, getBorderCharacters, table, WritableStream} from "table"
import {TableUserConfig} from "table/dist/src/types/api";

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

    static deploymentCurrentTableStream: WritableStream;

    static errorMessage(message: string) {
        console.error(chalk.redBright(message))
    }

    static message(message: string) {
        console.log('\n' + message)
    }

    static table(data: unknown[][], title?: string) {
        const tableConfig: TableUserConfig = {
            columnDefault: {},
            header: title ? {
                alignment: 'left',
                content: chalk.blueBright(title),
            } : undefined,
            border: getBorderCharacters('norc')
        }
        console.log(table(data, tableConfig))
    }

    static customDeploymentMessage(message: string) {
        ConsoleMessage.deploymentCurrentTableStream.write([
            '',
            '',
            '',
            '',
            chalk.bold.gray(message),
        ])
    }

    static deploymentMessage(item: IDeploymentOperationItem, status: DeploymentMessageStatus) {
        if (!ConsoleMessage.deploymentCurrentTableStream) {
            ConsoleMessage.deploymentCurrentTableStream = createStream({
                columnDefault: {
                    width: 8
                },
                columnCount: 5,
                columns: [
                    {
                        width: 22,
                        alignment: 'left'
                    },
                    {alignment: 'left', width: 10},
                    {alignment: 'left', width: 10},
                    {alignment: 'left'},
                    {alignment: 'left', width: 30},

                ],
                border: getBorderCharacters('norc')
            })
        }

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
        ConsoleMessage.deploymentCurrentTableStream.write([
            chalk.gray((new Date()).toLocaleString()),
            statusStyle(status),
            chalk.green(item.type),
            chalk.bold.gray(item.status),
            chalk.bold.gray(item.path),
        ])
    }

    static preDeployLog(preDeploymentContext: IPreDeploymentContext) {
        const charLimit = 20
        const newPreDeploymentContext: IPreDeploymentContext = {
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
            },
            dependencyDeploymentsSummary: {
                editedItems: preDeploymentContext.dependencyDeploymentsSummary.editedItems.map(item => {
                    return {
                        ...item,
                        ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                        ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                    }
                }),
                deletedItems: preDeploymentContext.dependencyDeploymentsSummary.deletedItems.map(item => {
                    return {
                        ...item,
                        ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                        ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                    }
                }),
                createdItems: preDeploymentContext.dependencyDeploymentsSummary.createdItems.map(item => {
                    return {
                        ...item,
                        ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                        ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                    }
                }),
                noneItems: preDeploymentContext.dependencyDeploymentsSummary.noneItems.map(item => {
                    return {
                        ...item,
                        ...{newContent: item.newContent ? item.newContent.substr(0, charLimit) + '...' : undefined},
                        ...{oldContent: item.oldContent ? item.oldContent.substr(0, charLimit) + '...' : undefined}
                    }
                }),
            },
        }
        console.log(JSON.stringify(newPreDeploymentContext, null, 2))
    }

}
