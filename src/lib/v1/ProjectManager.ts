import { FileExtra } from './FileExtra'
import path from 'path'
import { PROJECT_CLASSES_FOLDER, PROJECT_CLASS_TEMPLATE_FILE, PROJECT_RIO_CLASS_FILE } from '../../config'
import { IClassContents, Project } from './Project'
import { Api } from '../Api'
import YAML from 'yaml'
import { Deployment, IClassesDeploymentSummary, IDeploymentSummary, IFileChangesByClassName, IProjectModels } from './Deployment'
import { Dependencies, IDependencyContent } from './Dependencies'
export interface IPreDeploymentContext {
  classDeploymentsSummary: {
    classDeploymentsSummary: IClassesDeploymentSummary
    classesFileChanges: IFileChangesByClassName
  }
  modelDeploymentsSummary: IDeploymentSummary
  dependencyDeploymentsSummary: IDeploymentSummary
  classUsedModels: { [className: string]: string[] }
}

export class ProjectManager {
  static models: string[] = ['inputModel', 'outputModel', 'errorModel', 'queryStringModel']

  static async fetchRemoteClasses(api: Api, targetClassNames: string[]): Promise<IClassContents> {
    const remoteClasses: IClassContents = {}

    if (!targetClassNames.length) {
      return remoteClasses
    }

    const workers = []
    for (const className of targetClassNames) {
      workers.push(api.getRemoteClassFiles(className))
    }
    const responses = await Promise.allSettled(workers)

    for (const response of responses) {
      if (response.status !== 'fulfilled') {
        throw new Error(`failed to fetch remote class files: ${response.reason}`)
      }

      const files = response.value

      for (const file of files) {
        if (!remoteClasses[file.classId]) {
          remoteClasses[file.classId] = {}
        }
        remoteClasses[file.classId][file.name] = file.content
      }
    }

    return remoteClasses
  }

  static fetchUsedModelNames(localClassFiles: IClassContents, targetClassNames: string[]): { [className: string]: string[] } {
    const usedModels: { [className: string]: string[] } = {}

    for (const className of targetClassNames) {
      const templateFileContent = localClassFiles[className][PROJECT_CLASS_TEMPLATE_FILE]

      if (!templateFileContent) {
        throw new Error(`failed to find template file for class: ${className}`)
      }
      const template = YAML.parse(templateFileContent)

      if (template.methods) {
        template.methods.forEach((m: any) => {
          ProjectManager.models.forEach((model: string) => {
            if (Object.prototype.hasOwnProperty.call(m, model)) {
              const modelName: string = (m as any)[model]
              if (!usedModels[className]) {
                usedModels[className] = []
              }
              usedModels[className].push(modelName)
            }
          })
        })
      }

      if (template.init) {
        ProjectManager.models.forEach((model: string) => {
          if (Object.prototype.hasOwnProperty.call(template.init, model)) {
            const modelName: string = (template.init as any)[model]
            if (!usedModels[className]) {
              usedModels[className] = []
            }
            usedModels[className].push(modelName)
          }
        })
      }
      if (template.get) {
        ProjectManager.models.forEach((model: string) => {
          if (Object.prototype.hasOwnProperty.call(template.get, model)) {
            const modelName: string = (template.get as any)[model]
            if (!usedModels[className]) {
              usedModels[className] = []
            }
            usedModels[className].push(modelName)
          }
        })
      }
    }
    return usedModels
  }

  static filterModelsByUsedModels(models: IProjectModels, usedModels: string[]): IProjectModels {
    const filteredModels: IProjectModels = {}
    for (const modelName of usedModels) {
      if (models[modelName]) {
        filteredModels[modelName] = models[modelName]
      }
    }
    return filteredModels
  }

  static async preDeploymentV1(api: Api, classes?: string[]): Promise<IPreDeploymentContext> {
    if (classes && !Array.isArray(classes)) throw new Error('invalid classes input')

    const projectState = await api.getProjectState()

    // classes
    let targetClassNames = classes || Project.listClassNames()
    let localClasses: IClassContents = Project.getLocalClassContents(targetClassNames)

    const targetRemoteClassNames = targetClassNames.filter((className) => projectState.public.classes.some((c: any) => c.classId === className))
    let remoteClasses: IClassContents = await ProjectManager.fetchRemoteClasses(api, targetRemoteClassNames)

    // models
    const usedModels = ProjectManager.fetchUsedModelNames(localClasses, targetClassNames)

    const justNames = Object.values(usedModels).flat()
    const localModels: IProjectModels = Project.getUsedModelsContents(targetClassNames, justNames)
    const remoteModels = { ...projectState.public.modelDefinitions, ...projectState.private.modelDefinitions }

    // start of "handle dependencies"
    const tsDependencies = Dependencies.checkDependenciesFileTypes()

    if (tsDependencies) {
      throw new Error(
        'In this version of CLI we cannot accept TypeScript dependencies files. Please make sure to include JavaScript files in your dependencies folder instead. Thank you for your understanding.',
      )
    }

    const dependencies = Dependencies.getDependenciesWithContents()
    const listedDependencies = Dependencies.getListedDependencies(Object.keys(localClasses))
    const localDependencies: IDependencyContent[] = []
    const remoteDependencies = await api.getRemoteDependencies()

    for (const listedDependency of listedDependencies) {
      const dependency = dependencies.find((d) => d.dependencyName === listedDependency)
      if (dependency) {
        localDependencies.push(dependency)
      }
    }
    // end of "handle dependencies"

    const modelDeploymentsSummary = Deployment.getModelDeploymentsContext(localModels, remoteModels)
    const classDeploymentsSummary = Deployment.getClassDeploymentsContext(localClasses, remoteClasses)
    const dependencyDeploymentsSummary = Deployment.getDependencyDeploymentsContext(localDependencies, remoteDependencies)

    return {
      classDeploymentsSummary,
      modelDeploymentsSummary,
      dependencyDeploymentsSummary,
      classUsedModels: usedModels,
    }
  }

  // static async generateAndSaveRioFiles() {
  //   // const rioFile = await ProjectManager.generateRioFile()
  //   await Promise.all(
  //     Project.listClassNames().map((className) => {
  //       return FileExtra.writeFile(path.join(process.cwd(), PROJECT_CLASSES_FOLDER, className, PROJECT_RIO_CLASS_FILE), rioFile)
  //     }),
  //   )
  // }

  // static async generateRioFile() {
  //   const classNames = Project.listClassNames()

  //   return await rioGenerator({
  //     classes: classNames.reduce<{ [className: string]: string }>((acc, className) => {
  //       acc[className] = Project.readClassTemplateString(className)
  //       return acc
  //     }, {}),
  //     models: Project.getLocalModelsContents(),
  //   })
  // }
}
