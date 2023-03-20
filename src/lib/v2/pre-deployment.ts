import path from 'path'
import { PROJECT_CLASSES_FOLDER, RIO_CLI_DEPENDENCIES_FOLDER } from '../../config'
import { Api } from '../Api'
import fs from 'fs'
import { ConsoleMessage } from '../ConsoleMessage'
import chalk from 'chalk'
import { RetterCloudObjectState } from '@retter/sdk'
import { ComparizationSummary, DeploymentClasses, DeploymentContents, DeploymentDependencies, ProjectState } from './types'
import { fetchLocalClassContents, fetchRemoteClassContents, listClassNames } from './class-contents'
import { readLocalDependencies } from './dependency-content'

// ********* Comparization Summary *********

function generateComparizationSummary(localClasses: DeploymentClasses, LocalDependencies: DeploymentDependencies, remoteClasses: DeploymentClasses, projectState: ProjectState): ComparizationSummary {
  const summary: ComparizationSummary = {
    classes: {},
    dependencies: {},
  }

  const remoteLayers = projectState.public?.layers || {}
  for (const dependencyName in LocalDependencies) {
    const remoteDep = remoteLayers[dependencyName]

    if (!remoteDep) {
      summary.dependencies[dependencyName] = {
        new: true,
      }
      LocalDependencies[dependencyName].shouldDeploy = true
      continue
    }

    if (LocalDependencies[dependencyName].hash !== remoteDep.hash) {
      summary.dependencies[dependencyName] = {}
      LocalDependencies[dependencyName].shouldDeploy = true
    }
  }

  for (const className in localClasses) {
    const remoteClass = remoteClasses[className]
    const localClass = localClasses[className]

    if (!remoteClass) {
      // Class exists in local but not remote
      summary.classes[className] = {
        editedFiles: [],
        editedModels: [],
        createdFiles: Object.keys(localClass.files),
        createdModels: Object.keys(localClass.models),
        deletedFiles: [],
        deletedModels: [],
        forcedFiles: [],
        forcedModels: [],
        newClass: true,
      }
      localClass.newClass = true
      localClass.shouldDeploy = true
      continue
    }

    const editedFiles = []
    const editedModels = []
    const createdFiles = []
    const createdModels = []
    const deletedFiles = []
    const deletedModels = []
    const forcedFiles: string[] = []
    const forcedModels: string[] = []

    for (const fileName in localClass.files) {
      if (!remoteClass.files[fileName]) {
        createdFiles.push(fileName)
      } else if (localClass.files[fileName] !== remoteClass.files[fileName]) {
        editedFiles.push(fileName)
      }
    }

    for (const modelName in localClass.models) {
      if (!remoteClass.models[modelName]) {
        createdModels.push(modelName)
      } else if (localClass.models[modelName] !== remoteClass.models[modelName]) {
        editedModels.push(modelName)
      }
    }

    for (const fileName in remoteClass.files) {
      if (!localClass.files[fileName]) {
        deletedFiles.push(fileName)
      }
    }

    for (const modelName in remoteClass.models) {
      if (!localClass.models[modelName]) {
        deletedModels.push(modelName)
      }
    }

    if (createdFiles.length > 0 || createdModels.length > 0 || editedFiles.length > 0 || editedModels.length > 0 || deletedFiles.length > 0 || deletedModels.length > 0) {
      summary.classes[className] = {
        createdFiles,
        createdModels,
        editedFiles,
        editedModels,
        deletedFiles,
        deletedModels,
        forcedFiles,
        forcedModels,
        newClass: false,
      }
      localClass.shouldDeploy = true
    }
  }

  return summary
}

function generateForcedComparizationSummary(localClasses: DeploymentClasses, LocalDependencies: DeploymentDependencies): ComparizationSummary {
  const summary: ComparizationSummary = {
    classes: {},
    dependencies: {},
  }

  for (const dependencyName in LocalDependencies) {
      summary.dependencies[dependencyName] = {
        forced: true
      }
      LocalDependencies[dependencyName].shouldDeploy = true
  }

  for (const className in localClasses) {
    const localClass = localClasses[className]

    const forcedFiles: string[] = []
    const forcedModels: string[] = []

    for (const fileName in localClass.files) {
        forcedFiles.push(fileName)
    }

    for (const modelName in localClass.models) {
        forcedModels.push(modelName)
    }

    if (forcedFiles.length > 0 || forcedModels.length > 0) {
      summary.classes[className] = {
        createdFiles: [],
        createdModels: [],
        editedFiles: [],
        editedModels: [],
        deletedFiles: [],
        deletedModels: [],
        forcedFiles,
        forcedModels,
        newClass: false,
      }
      localClass.shouldDeploy = true
    }
  }

  return summary
}

export const printSummaryV2 = async (summary: ComparizationSummary) => {

  console.log(chalk.magenta.bold('Dependencies'))

  for (const name in summary.dependencies) {
    const dependency = summary.dependencies[name]
    if (dependency.new) {
      console.log(chalk.green(`   added : ${name}`))
    } else if (dependency.forced) {
      console.log(chalk.grey(`   forced: ${name}`))
    } else {
      console.log(chalk.blue(`   edited: ${name}`))
    }
  }

  if (Object.keys(summary.dependencies).length === 0) {
    console.log(chalk.gray('   There has been no change in any dependencies'))
  }

  console.log(chalk.magenta.bold('Classes'))

  for (const className in summary.classes) {
    const { createdFiles, createdModels, editedFiles, editedModels, deletedFiles, deletedModels, forcedFiles, forcedModels } = summary.classes[className]

    if (createdModels.length === 0 && createdFiles.length === 0 && editedModels.length === 0 && editedFiles.length === 0 && deletedModels.length === 0 && deletedFiles.length === 0 && forcedModels.length === 0 && forcedFiles.length === 0) {
      continue
    }

    console.log(chalk.cyanBright.bold('   [' + className + ']'))
    console.log(chalk.cyan('       Models:'))
    if (createdModels.length === 0 && editedModels.length === 0 && deletedModels.length === 0 && forcedModels.length === 0) {
      console.log(chalk.dim('         None'))
    } else {
      for (const fileName of createdModels) {
        console.log(chalk.green(`         added  : ${fileName}`))
      }
      for (const fileName of editedModels) {
        console.log(chalk.blue(`         edited : ${fileName}`))
      }
      for (const fileName of deletedModels) {
        console.log(chalk.red(`         deleted: ${fileName}`))
      }
      for (const fileName of forcedModels) {
        console.log(chalk.grey(`         forced : ${fileName}`))
      }
    }
    console.log(chalk.cyan('       Files:'))
    if (createdFiles.length === 0 && editedFiles.length === 0 && deletedFiles.length === 0 && forcedFiles.length === 0) {
      console.log(chalk.dim('         None'))
    } else {
      for (const fileName of createdFiles) {
        console.log(chalk.green(`         added  : ${fileName}`))
      }
      for (const fileName of editedFiles) {
        console.log(chalk.blue(`         edited : ${fileName}`))
      }
      for (const fileName of deletedFiles) {
        console.log(chalk.red(`         deleted: ${fileName}`))
      }
      for (const fileName of forcedFiles) {
        console.log(chalk.grey(`         forced : ${fileName}`))
      }
    }
  }

  if (Object.keys(summary.classes).length === 0) {
    console.log(chalk.gray('   There has been no change in any class \n'))
  }

  console.log('\n')
}

export const isChanged = (comparization: ComparizationSummary) => {
  return Object.keys(comparization.dependencies).length > 0 || Object.keys(comparization.classes).length > 0
}
// ********* END OF Comparization Summary *********

// ********* PRE DEPLOYMENT *********

export const fetchDeploymentContents = async (api: Api, dontPerformComparization: boolean, classes?: string[]): Promise<DeploymentContents> => {
  if (classes && !Array.isArray(classes)) throw new Error('invalid classes input')

  const dependencyPath = path.join(process.cwd(), RIO_CLI_DEPENDENCIES_FOLDER)
  const projectState = (await api.getProjectState()) as ProjectState

  // classes
  let targetClassNames = classes || listClassNames()
  const targetRemoteClassNames = targetClassNames.filter((className: string) => projectState.public.classes.some((c) => c.classId === className))

  if (dontPerformComparization) {
    const [localClasses, LocalDependencies] = await Promise.all([fetchLocalClassContents(targetClassNames), readLocalDependencies(dependencyPath)])

    const comparization = generateForcedComparizationSummary(localClasses, LocalDependencies)

    return { classes: localClasses, dependencies: LocalDependencies, comparization }
  } else {
    const [remoteClasses, localClasses, LocalDependencies] = await Promise.all([
      fetchRemoteClassContents(api, targetRemoteClassNames),
      fetchLocalClassContents(targetClassNames),
      readLocalDependencies(dependencyPath),
    ])

    // this will decide which classes and dependencies should be deployed
    const comparization = generateComparizationSummary(localClasses, LocalDependencies, remoteClasses, projectState)

    return { classes: localClasses, dependencies: LocalDependencies, comparization }
  }
}

// ********* PRE DEPLOYMENT *********
