import {generator as rioGenerator} from "@retter/rio-generator";
import {FileExtra} from "./FileExtra";
import path from "path";
import {PROJECT_CLASSES_FOLDER, PROJECT_RIO_CLASS_FILE} from "../config";
import {IClassContents, Project} from "./Project";
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

    static async preDeployment(profile: string, classes?: string[]): Promise<IPreDeploymentContext> {
        if (classes && !Array.isArray(classes)) throw new Error('invalid classes input')

        const api = Api.getInstance(profile)
        const projectRioConfig = Project.getProjectRioConfig()
        const project = await api.getProject(projectRioConfig.projectId)

        // generate new rio files
        await ProjectManager.generateAndSaveRioFiles()

        const localModelContents = Project.getModelFileContents()
        const localModels = Object.keys(localModelContents).reduce<{ [modelName: string]: object }>((acc, modelName) => {
            acc[modelName] = JSON.parse(localModelContents[modelName])
            return acc
        }, {})
        const localClasses = Project.getLocalClassContents(classes)

        const remoteModels = project.detail.modelDefinitions
        let remoteClasses = await project.detail.classes.reduce<Promise<IClassContents>>(async (acc, classItem) => {
            const className = classItem.classId
            const clonedAcc = await acc
            clonedAcc[className] = (await api.getRemoteClassFiles(projectRioConfig.projectId, className))
                .reduce<{ [fileName: string]: string }>((acc, fileItem) => {
                    acc[fileItem.name] = fileItem.content
                    return acc
                }, {})
            return clonedAcc
        }, Promise.resolve<IClassContents>({}))

        //filter selected classes if defined
        if (classes && classes.length) {
            remoteClasses = classes.reduce<IClassContents>((acc, className) => {
                if (remoteClasses[className]) {
                    acc[className] = remoteClasses[className]
                }
                return acc
            }, {})
        }

        const modelDeploymentsSummary = Deployment.getModelDeploymentsContext(localModels, remoteModels)
        const classDeploymentsSummary = Deployment.getClassDeploymentsContext(localClasses, remoteClasses)

        return {
            profile,
            classDeploymentsSummary,
            modelDeploymentsSummary,
        }
    }

    static async generateAndSaveRioFiles() {
        const rioFile = await ProjectManager.generateRioFile()
        await Promise.all(Project.listClassNames().map(className => {
            return FileExtra.writeFile(path.join(process.cwd(), PROJECT_CLASSES_FOLDER, className, PROJECT_RIO_CLASS_FILE), rioFile)
        }))
    }

    static async generateRioFile() {

        const classNames = Project.listClassNames()

        return await rioGenerator({
            classes: classNames.reduce<{ [className: string]: string }>((acc, className) => {
                acc[className] = Project.readClassTemplateString(className)
                return acc
            }, {}),
            models: Project.listModelNames().reduce<{ [modelName: string]: string }>((acc, modelName) => {
                acc[modelName] = JSON.parse(Project.readModelFile(modelName))
                return acc
            }, {})
        })
    }

}
