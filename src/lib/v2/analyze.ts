import chalk from 'chalk'
import { ComparizationSummary, Classes, AnalyzationResult, ProjectContents, ProjectState, AnalyzeInput } from './types'
import { fetchLocalClassContents, fetchRemoteClassContents, listClassNames } from './contents-class'
import { fetchLocalProjectFiles, fetchRemoteProjectFiles } from './contents-project'

const headerColor = chalk.magentaBright.bold
const subHeaderColor = chalk.cyanBright.bold
const subHeaderColor2 = chalk.cyanBright.bold

const subHeaderTab = '   '
const subestHeaderTab = '     '
const subHeaderNoChange = chalk.grey(': No Change')

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

  // project files  like package.json etc ...
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
    const localDep = localProjectContents.dependencies[dependencyName]
    const remoteDep = remoteProjectContents.dependencies[dependencyName]
    summary.dependencies[dependencyName] = {
      isTS: localDep.isTS,
    }
    if (skipDiff) {
      summary.dependencies[dependencyName].forced = true
      localDep.shouldDeploy = true
    } else if (!remoteDep) {
      summary.dependencies[dependencyName].new = true
      localDep.shouldDeploy = true
    } else if (localDep.hash !== remoteDep.hash) {
      summary.dependencies[dependencyName].edited = true
      localDep.shouldDeploy = true
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

    summary.classes[className] = {
      createdFiles,
      editedFiles,
      deletedFiles,
      forcedFiles,
    }

    const someThingChanged = forcedFiles.length > 0 || createdFiles.length > 0 || editedFiles.length > 0 || deletedFiles.length > 0
    localClass.shouldDeploy = someThingChanged 
  }

  return summary
}

export const printSummaryV2 = async (summary: ComparizationSummary) => {

  // *********** PROJECT FILES ***********
  // *********** PROJECT FILES ***********
  // *********** PROJECT FILES ***********

  console.log(headerColor('Project Summary'))

  if (Object.keys(summary.files).length === 0) {
    console.log(`${subHeaderTab}${subHeaderColor2(('[Files]').padEnd(20," "))}${subHeaderNoChange}`)
  } else {
    console.log(`${subHeaderTab}${subHeaderColor2('[Files]')}`)

    for (const name in summary.files) {
      const file = summary.files[name]
      if (file.deleted) {
        console.log(chalk.red(`${subestHeaderTab}${('deleted').padEnd(8, ' ')}: ${name}`))
      } else if (file.forced) {
        console.log(chalk.grey(`${subestHeaderTab}${('forced').padEnd(8, ' ')}: ${name}`))
      } else if (file.created) {
        console.log(chalk.green(`${subestHeaderTab}${('created').padEnd(8, ' ')}: ${name}`))
      } else if (file.edited) {
        console.log(chalk.blue(`${subestHeaderTab}${('edited').padEnd(8, ' ')}: ${name}`))
      }
    }
  }

  // *********** PROJECT MODELS ***********
  // *********** PROJECT MODELS ***********
  // *********** PROJECT MODELS ***********

  if (Object.keys(summary.models).length === 0) {
    console.log(`${subHeaderTab}${subHeaderColor2('[Models]'.padEnd(20, ' '))}${subHeaderNoChange}`)
  } else {
    console.log(`${subHeaderTab}${subHeaderColor2('[Models]')}`)
    for (const name in summary.models) {
      const model = summary.models[name]
      if (model.deleted) {
        console.log(chalk.red(`${subestHeaderTab}${'deleted'.padEnd(8, ' ')}: ${name}`))
      } else if (model.forced) {
        console.log(chalk.grey(`${subestHeaderTab}${'forced'.padEnd(8, ' ')}: ${name}`))
      } else if (model.created) {
        console.log(chalk.green(`${subestHeaderTab}${'created'.padEnd(8, ' ')}: ${name}`))
      } else if (model.edited) {
        console.log(chalk.blue(`${subestHeaderTab}${'edited'.padEnd(8, ' ')}: ${name}`))
      }
    }
  }

  // *********** PROJECT DEPENDENCIES ***********
  // *********** PROJECT DEPENDENCIES ***********
  // *********** PROJECT DEPENDENCIES ***********

  if (Object.keys(summary.dependencies).length > 0) {
    console.log(headerColor('Dependencies Summary'))
  }

  for (const name in summary.dependencies) {
    const dependency = summary.dependencies[name]
    let text = subHeaderNoChange
    if (dependency.new) {
      text = chalk.green(': Created')
    } else if (dependency.forced) {
      text = chalk.grey(': Forced')
    } else if (dependency.edited) {
      text = chalk.blue(': Edited')
    }
    console.log(`${subHeaderTab}${subHeaderColor2(`${name} ${dependency.isTS ? '(TS)' : '(JS)'}`.padEnd(20, ' '))}${text}`)
  }

  // *********** CLASSES ***********
  // *********** CLASSES ***********
  // *********** CLASSES ***********
  // *********** CLASSES ***********

  console.log(headerColor('Classes Summary'))

  for (const className in summary.classes) {
    const { createdFiles, editedFiles, deletedFiles, forcedFiles } = summary.classes[className]

    const someThingChanged = forcedFiles.length > 0 || createdFiles.length > 0 || editedFiles.length > 0 || deletedFiles.length > 0

    if (!someThingChanged) {
      console.log(`${subHeaderTab}${subHeaderColor2(`${className}`.padEnd(20, ' '))}${subHeaderNoChange}`)
    } else {
      console.log(`${subHeaderTab}${subHeaderColor(`${className}`)}`)

      for (const fileName of createdFiles) {
        console.log(chalk.green(`${subestHeaderTab}${'added'.padEnd(8, ' ')}: ${fileName}`))
      }
      for (const fileName of editedFiles) {
        console.log(chalk.blue(`${subestHeaderTab}${'edited'.padEnd(8, ' ')}: ${fileName}`))
      }
      for (const fileName of deletedFiles) {
        console.log(chalk.red(`${subestHeaderTab}${'deleted'.padEnd(8, ' ')}: ${fileName}`))
      }
      for (const fileName of forcedFiles) {
        console.log(chalk.grey(`${subestHeaderTab}${'forced'.padEnd(8, ' ')}: ${fileName}`))
      }
    }
  }

  console.log('\n')
}

export const isChanged = (comparization: ComparizationSummary) => {
  return (
    Object.keys(comparization.models).length > 0 ||
    Object.keys(comparization.files).length > 0 ||
    Object.values(comparization.dependencies).some((dep) => dep.new || dep.edited || dep.forced) ||
    Object.values(comparization.classes).some((cls) => cls.createdFiles.length > 0 || cls.editedFiles.length > 0 || cls.forcedFiles.length > 0 || cls.deletedFiles.length > 0)
  )
}
// ********* END OF Comparization Summary *********

// ********* PRE DEPLOYMENT *********

export const analyze = async ({ api, skipDiff, classes }: AnalyzeInput): Promise<AnalyzationResult> => {
  if (classes && !Array.isArray(classes)) throw new Error('invalid classes input')

  const projectState = (await api.getProjectState()) as ProjectState

  const deploymentCount = Object.values(projectState.public.deployments || {}).filter((d) => d.status === 'ongoing').length

  const [localProjectContents, remoteProjectContents] = await Promise.all([fetchLocalProjectFiles(process.cwd()), fetchRemoteProjectFiles(projectState)])

  let targetClassNames = classes || listClassNames()
  const targetRemoteClassNames = targetClassNames.filter((className: string) => projectState.public.classes.some((c) => c.classId === className))

  const [remoteClasses, localClasses] = await Promise.all([fetchRemoteClassContents(api, targetRemoteClassNames), fetchLocalClassContents(targetClassNames)])

  const comparization = generateComparizationSummaryV2(localProjectContents, remoteProjectContents, remoteClasses, localClasses, skipDiff)

  return { localProjectContents, remoteProjectContents, remoteClasses, localClasses, comparization, deploymentCount }
}
