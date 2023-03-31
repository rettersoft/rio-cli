import path from 'path'
import { PROJECT_CLASSES_FOLDER, RIO_CLI_DEPENDENCIES_FOLDER } from '../../config'
import { Api } from '../Api'
import fs from 'fs'
import { ConsoleMessage } from '../v1/ConsoleMessage'
import chalk from 'chalk'
import { RetterCloudObjectState } from '@retter/sdk'
import { ComparizationSummary, Classes, AnalyzationResult, Dependencies, ProjectContents, ProjectState, AnalyzeInput } from './types'
import { fetchLocalClassContents, fetchRemoteClassContents, listClassNames } from './contents-class'
import { fetchLocalProjectFiles, fetchRemoteProjectFiles } from './contents-project'

// ********* Comparization Summary *********

function generateComparizationSummaryV2(
  localProjectContents: ProjectContents,
  remoteProjectContents: ProjectContents,
  remoteClasses: Classes,
  localClasses: Classes,
  skipDiff: boolean,
): ComparizationSummary {
  const summary: ComparizationSummary = {
    classes: {},
    dependencies: {},
    models: {},
    files: {},
  }

  // *********** FILES ***********
  // *********** FILES ***********
  // *********** FILES ***********

  // project files -> like package.json etc ...
  for (const file in localProjectContents.files) {
    const remote = remoteProjectContents.files[file]
    const local = localProjectContents.files[file]

    if (skipDiff) {
      summary.files[file] = {
        forced: true,
      }
    } else if (remote === undefined) {
      // Model exists in local but not remote
      summary.files[file] = {
        created: true,
      }
    } else if (local !== remote) {
      summary.files[file] = {
        edited: true,
      }
    }
  }

  for (const file in remoteProjectContents.files) {
    const local = localProjectContents.files[file]

    if (local === undefined) {
      // Model exists in remote but not local
      summary.files[file] = {
        deleted: true,
      }
    }
  }

  // *********** MODELS ***********
  // *********** MODELS ***********
  // *********** MODELS ***********

  for (const model in localProjectContents.models) {
    const remoteModel = remoteProjectContents.models[model]
    const localModel = localProjectContents.models[model]

    if (skipDiff) {
      summary.models[model] = {
        forced: true,
      }
    } else if (remoteModel === undefined) {
      // Model exists in local but not remote
      summary.models[model] = {
        created: true,
      }
    } else if (localModel !== remoteModel) {
      summary.models[model] = {
        edited: true,
      }
    }
  }

  for (const model in remoteProjectContents.models) {
    const localModel = localProjectContents.models[model]

    if (localModel === undefined) {
      // Model exists in remote but not local
      summary.models[model] = {
        deleted: true,
      }
    }
  }

  // *********** DEPENDENCIES ***********
  // *********** DEPENDENCIES ***********
  // *********** DEPENDENCIES ***********

  for (const dependencyName in localProjectContents.dependencies) {
    const remoteDep = remoteProjectContents.dependencies[dependencyName]

    if (skipDiff) {
      summary.dependencies[dependencyName] = {
        forced: true,
      }
      localProjectContents.dependencies[dependencyName].shouldDeploy = true
    } else if (!remoteDep) {
      summary.dependencies[dependencyName] = {
        new: true,
      }
      localProjectContents.dependencies[dependencyName].shouldDeploy = true
    } else if (localProjectContents.dependencies[dependencyName].hash !== remoteDep.hash) {
      summary.dependencies[dependencyName] = {
        edited: true,
      }
      localProjectContents.dependencies[dependencyName].shouldDeploy = true
    }
  }

  // *********** CLASSES ***********
  // *********** CLASSES ***********
  // *********** CLASSES ***********
  // *********** CLASSES ***********

  for (const className in localClasses) {
    const remoteClass = remoteClasses[className]
    const localClass = localClasses[className]

    if (remoteClass && skipDiff) {
      summary.classes[className] = {
        editedFiles: [],
        createdFiles: [],
        deletedFiles: [],
        forcedFiles: Object.keys(localClass.files),
      }
      localClass.shouldDeploy = true
    } else if (remoteClass === undefined) {
      summary.classes[className] = {
        editedFiles: [],
        createdFiles: Object.keys(localClass.files),
        deletedFiles: [],
        forcedFiles: [],
      }
      localClass.newClass = true
      localClass.shouldDeploy = true
      continue
    }

    const editedFiles: string[] = []
    const createdFiles: string[] = []
    const deletedFiles: string[] = []
    const forcedFiles: string[] = []

    for (const fileName in localClass.files) {
      if (skipDiff && remoteClass.files[fileName]) {
        forcedFiles.push(fileName)
      } else if (remoteClass.files[fileName] === undefined) {
        createdFiles.push(fileName)
      } else if (localClass.files[fileName] !== remoteClass.files[fileName]) {
        editedFiles.push(fileName)
      }
    }

    for (const fileName in remoteClass.files) {
        if (localClass.files[fileName] === undefined) {
          deletedFiles.push(fileName)
      }
    }
  
    if (forcedFiles.length > 0 || createdFiles.length > 0 || editedFiles.length > 0 || deletedFiles.length > 0) {
      summary.classes[className] = {
        createdFiles,
        editedFiles,
        deletedFiles,
        forcedFiles,
      }
      localClass.shouldDeploy = true
    }
  }

  return summary
}

export const printSummaryV2 = async (summary: ComparizationSummary, skipDiff: boolean) => {

  // *********** DEPENDENCIES ***********
  // *********** DEPENDENCIES ***********
  // *********** DEPENDENCIES ***********
  console.log(chalk.magenta.bold('Project'))
  console.log(chalk.cyanBright.bold('   [Dependencies]'))

  for (const name in summary.dependencies) {
    const dependency = summary.dependencies[name]
    if (dependency.new) {
      console.log(chalk.green(`         added : ${name}`))
    } else if (dependency.forced) {
      console.log(chalk.grey(`         forced: ${name}`))
    } else if (dependency.edited) {
      console.log(chalk.blue(`         edited: ${name}`))
    }
  }

  if (Object.keys(summary.dependencies).length === 0) {
    console.log(chalk.gray('         No Changes '))
  }

  // *********** MODELS ***********
  // *********** MODELS ***********
  // *********** MODELS ***********

 
  console.log(chalk.cyanBright.bold('   [Models]'))

  if (skipDiff) {
    console.log(chalk.grey(`         forced: All ${Object.keys(summary.models).length} models are being forced`))
  } else {
    for (const name in summary.models) {
      const model = summary.models[name]
      if (model.deleted) {
        console.log(chalk.red(`         deleted : ${name}`))
      } else if (model.forced) {
        console.log(chalk.grey(`         forced: ${name}`))
      } else if (model.created) {
        console.log(chalk.green(`         created : ${name}`))
      }  else if (model.edited) {
        console.log(chalk.blue(`         edited: ${name}`))
      }
    }
  }

  if (Object.keys(summary.models).length === 0) {
    console.log(chalk.gray('         No Changes '))
  }

  // *********** FILES ***********
  // *********** FILES ***********
  // *********** FILES ***********

  console.log(chalk.cyanBright.bold('   [Files]'))

  for (const name in summary.files) {
    const file = summary.files[name]
    if (file.deleted) {
      console.log(chalk.red(`         deleted : ${name}`))
    } else if (file.forced) {
      console.log(chalk.grey(`         forced: ${name}`))
    } else if (file.created) {
      console.log(chalk.green(`         created : ${name}`))
    } else if (file.edited) {
      console.log(chalk.blue(`         edited: ${name}`))
    }
  }

  if (Object.keys(summary.files).length === 0) {
    console.log(chalk.gray('         No Changes '))
  }

  // *********** CLASSES ***********
  // *********** CLASSES ***********
  // *********** CLASSES ***********
  // *********** CLASSES ***********

  console.log(chalk.magenta.bold('Classes'))

  for (const className in summary.classes) {

    const { createdFiles, editedFiles, deletedFiles, forcedFiles } = summary.classes[className]

    if (createdFiles.length === 0 && editedFiles.length === 0 && deletedFiles.length === 0 && forcedFiles.length === 0) {
      continue
    }

    console.log(chalk.cyanBright.bold('   [' + className + ']'))
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
    console.log(chalk.gray('   No Changes \n'))
  }

  console.log('\n')
}

export const isChanged = (comparization: ComparizationSummary) => {
  return Object.keys(comparization.classes).length > 0 || Object.keys(comparization.models).length > 0 || Object.keys(comparization.dependencies).length > 0 ||   Object.keys(comparization.files).length > 0
}
// ********* END OF Comparization Summary *********

// ********* PRE DEPLOYMENT *********

export const analyze = async ({ api, skipDiff, classes }: AnalyzeInput): Promise<AnalyzationResult> => {
  if (classes && !Array.isArray(classes)) throw new Error('invalid classes input')

  const projectState = (await api.getProjectState()) as ProjectState
  
  const [localProjectContents, remoteProjectContents] = await Promise.all([fetchLocalProjectFiles(process.cwd()), fetchRemoteProjectFiles(projectState)])

  let targetClassNames = classes || listClassNames()
  const targetRemoteClassNames = targetClassNames.filter((className: string) => projectState.public.classes.some((c) => c.classId === className))

  const [remoteClasses, localClasses] = await Promise.all([fetchRemoteClassContents(api, targetRemoteClassNames), fetchLocalClassContents(targetClassNames)])

  const comparization = generateComparizationSummaryV2(localProjectContents, remoteProjectContents, remoteClasses, localClasses, skipDiff)

  return { localProjectContents, remoteProjectContents, remoteClasses, localClasses, comparization }
}
