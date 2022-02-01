import {generator as rioGenerator} from "@retter/rio-generator";
import {FileExtra} from "./FileExtra";
import path from "path";
import {PROJECT_CLASSES_FOLDER, PROJECT_RIO_CLASS_FILE} from "../config";
import {IClassContents, Project} from "./Project";
import {Api} from "./Api";
import {
    Deployment,
    IClassesDeploymentSummary,
    IDeploymentSummary,
    IFileChangesByClassName,
    IProjectModels
} from "./Deployment";

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
        let localModels: IProjectModels = Object.keys(localModelContents).reduce<{ [modelName: string]: object }>((acc, modelName) => {
            acc[modelName] = JSON.parse(localModelContents[modelName])
            return acc
        }, {})
        const localClasses = Project.getLocalClassContents(classes)

        let remoteModels = project.detail.modelDefinitions
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
            let selectedModels: string[] = []
            remoteClasses = classes.reduce<IClassContents>((acc, className) => {
                const template = Project.getLocalClassTemplate(className)
                if (template.methods) {
                    template.methods.forEach(m => {
                        if (m.inputModel) selectedModels.push(m.inputModel)
                        if (m.outputModel) selectedModels.push(m.outputModel)
                        if (m.errorModel) selectedModels.push(m.errorModel)
                    })
                }
                if (remoteClasses[className]) {
                    acc[className] = remoteClasses[className]
                }
                return acc
            }, {})

            // filter models
            localModels = Object.keys(localModels).reduce<IProjectModels>((acc, modelName) => {
                if (selectedModels.includes(modelName)) {
                    acc[modelName] = localModels[modelName]
                }
                return acc
            }, {})
            remoteModels = Object.keys(remoteModels).reduce<IProjectModels>((acc, modelName) => {
                if (selectedModels.includes(modelName)) {
                    acc[modelName] = remoteModels[modelName]
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
