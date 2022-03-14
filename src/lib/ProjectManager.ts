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
import {Dependencies, IDependencyContent} from "./Dependencies";

export interface IPreDeploymentContext {
    profile: string
    classDeploymentsSummary: {
        classDeploymentsSummary: IClassesDeploymentSummary,
        classesFileChanges: IFileChangesByClassName
    },
    modelDeploymentsSummary: IDeploymentSummary,
    dependencyDeploymentsSummary: IDeploymentSummary
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
                        if (m.inputModel) {
                            selectedModels.push(m.inputModel)
                            Project.getModelDefs(m.inputModel).forEach(d => selectedModels.push(d))
                        }
                        if (m.outputModel) {
                            selectedModels.push(m.outputModel)
                            Project.getModelDefs(m.outputModel).forEach(d => selectedModels.push(d))
                        }
                        if (m.errorModel) {
                            selectedModels.push(m.errorModel)
                            Project.getModelDefs(m.errorModel).forEach(d => selectedModels.push(d))
                        }

                    })
                }
                if (template.init && template.init.inputModel) {
                    selectedModels.push(template.init.inputModel)
                    Project.getModelDefs(template.init.inputModel).forEach(d => selectedModels.push(d))
                }
                if (template.get && template.get.inputModel) {
                    selectedModels.push(template.get.inputModel)
                    Project.getModelDefs(template.get.inputModel).forEach(d => selectedModels.push(d))
                }
                if (remoteClasses[className]) {
                    acc[className] = remoteClasses[className]
                }
                return acc
            }, {})

            //uniq models
            selectedModels = Array.from(new Set(selectedModels))

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

        const dependencies = Dependencies.getDependenciesWithContents()
        const listedDependencies = Dependencies.getListedDependencies(Object.keys(localClasses))
        const localDependencies: IDependencyContent[] = []
        const remoteDependencies = await api.getRemoteDependencies()

        for (const listedDependency of listedDependencies) {
            const dependency = dependencies.find(d => d.dependencyName === listedDependency)
            if (dependency) {
                localDependencies.push(dependency)
            }
        }


        const modelDeploymentsSummary = Deployment.getModelDeploymentsContext(localModels, remoteModels)
        const classDeploymentsSummary = Deployment.getClassDeploymentsContext(localClasses, remoteClasses)
        const dependencyDeploymentsSummary = Deployment.getDependencyDeploymentsContext(localDependencies, remoteDependencies)

        return {
            profile,
            classDeploymentsSummary,
            modelDeploymentsSummary,
            dependencyDeploymentsSummary
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
