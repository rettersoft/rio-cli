import {ConsoleMessage} from "./ConsoleMessage";
import {generator as rioGenerator} from "@retter/rio-generator";
import {FileExtra} from "./FileExtra";
import path from "path";
import {PROJECT_CLASSES_FOLDER, PROJECT_RIO_CLASS_FILE} from "../config";
import {IAllClassContents, Project} from "./Project";
import {Api} from "./Api";
import {Deployment, IClassesDeploymentSummary, IDeploymentSummary, IFileChangesByClassName} from "./Deployment";

export interface IPreDeploymentContext {
    profile: string
    classDeploymentsSummary: {
        classDeploymentsSummary: IClassesDeploymentSummary,
        classesFileChanges: IFileChangesByClassName
    },
    modelDeploymentsSummary: IDeploymentSummary
}

export class ProjectManager {

    static async preDeployment(profile: string): Promise<IPreDeploymentContext> {
        const api = Api.getInstance(profile)
        const projectRioConfig = Project.getProjectRioConfig()
        const project = await api.getProject(projectRioConfig.projectId)

        // generate new rio files
        await ProjectManager.generateRioFiles()

        const localModelContents = Project.getModelFileContents()
        const localModels = Object.keys(localModelContents).reduce<{ [modelName: string]: object }>((acc, modelName) => {
            acc[modelName] = JSON.parse(localModelContents[modelName])
            return acc
        }, {})
        const localClasses = Project.getAllLocalClassContents()

        const remoteModels = project.detail.modelDefinitions
        const remoteClasses = await project.detail.classes.reduce<Promise<IAllClassContents>>(async (acc, classItem) => {
            const className = classItem.classId
            const clonedAcc = await acc
            clonedAcc[className] = (await api.getRemoteClassFiles(projectRioConfig.projectId, className))
                .reduce<{ [fileName: string]: string }>((acc, fileItem) => {
                    acc[fileItem.name] = fileItem.content
                    return acc
                }, {})
            return clonedAcc
        }, Promise.resolve<IAllClassContents>({}))

        const modelDeploymentsSummary = Deployment.getModelDeploymentsContext(localModels, remoteModels)
        const classDeploymentsSummary = Deployment.getClassDeploymentsContext(localClasses, remoteClasses)

        return {
            profile,
            classDeploymentsSummary,
            modelDeploymentsSummary,
        }
    }

    static async generateRioFiles() {
        ConsoleMessage.message('Rio class file generating...')

        const classNames = Project.listClassNames()

        const rioFile = await rioGenerator({
            classes: classNames.reduce<{ [className: string]: string }>((acc, className) => {
                acc[className] = Project.readClassTemplateString(className)
                return acc
            }, {}),
            models: Project.listModelNames().reduce<{ [modelName: string]: string }>((acc, modelName) => {
                acc[modelName] = Project.readModelFile(modelName)
                return acc
            }, {})
        })
        ConsoleMessage.message('Rio class file generated')

        ConsoleMessage.message('Rio class files saving...')
        await Promise.all(classNames.map(className => {
            return FileExtra.writeFile(path.join(process.cwd(), PROJECT_CLASSES_FOLDER, className, PROJECT_RIO_CLASS_FILE), rioFile)
        }))
        ConsoleMessage.message('Rio class files saved')
    }

}
