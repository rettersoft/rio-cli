import path from 'path'
import { PROJECT_CLASSES_FOLDER } from '../../config'
import { Api } from '../Api'
import fs from 'fs'
import chalk from 'chalk'
import { gzipSync } from 'zlib'
import { Classes, DeployInput, AnalyzationResult, ProjectContents } from './types'
import axios from 'axios'

import ora from 'ora';


// ********* ORA *********
// ********* ORA *********

const spinner = ora({
  text: '',
  spinner: 'dots',
  interval: 800,
});

const spinner_object = {} as { [className: string]: boolean }

const stopOra = () => {
  spinner.stop()
  spinner.render()
}

const initOra = (classes: Classes) => {
  for (const [key, value] of Object.entries(classes)) {
    if (!value.shouldDeploy) continue
    spinner_object[key] = false
  }

  spinner.text = getOraText()
  spinner.start()
}

const getOraText = () => {
  let text = '\n'

  const spinner_array = Object.entries(spinner_object);

  // Sort the array by status
  spinner_array.sort(([className1, status1], [className2, status2]) => {
    if (status1 === status2) {
      // If the statuses are the same, sort by class name
      return className1.localeCompare(className2);
    } else if (status1 === true) {
      // Put saved classes at the beginning
      return -1;
    } else {
      // Put unsaved classes at the end
      return 1;
    }
  });
  
  // Convert the sorted array back to an object
  const sorted_spinner_object = Object.fromEntries(spinner_array);
  
  for (const [className, status] of Object.entries(sorted_spinner_object)) {
    const statusText = status === true ? chalk.greenBright('Saved ✅     ') : chalk.yellow('Saving...    ')
    text += `         ${statusText} : ${chalk.cyanBright.bold(className)}  \n`
  }
  return text
}

// ********* ORA *********
// ********* ORA *********

interface RIO_FILE {
  name: string
  content: string
}

const setClassFiles = async (api: Api, className: string, analyzationResult: AnalyzationResult, oraDisabled: boolean ) => {
  const classFiles = analyzationResult.localClasses[className].files
  const files:{ [fileName: string]: RIO_FILE | undefined } = {}

  for (const [fileName, fileContent] of Object.entries(classFiles)) {
    files[fileName] = {
      name: fileName,
      content: gzipSync(Buffer.from(fileContent)).toString('base64')
    }
  }

  await api.setRemoteClassFilesV2(className, files)
  if (oraDisabled) {
    console.log(chalk.blue(`   saved   : [${className}] `))
  } else {
    spinner_object[className] = true
    spinner.text = getOraText()
  }
}

const createClass = async (api: Api, className: string) => {
  await api.createClass(className)
  console.log(chalk.green(`   Project class created: [${className}]`))
}

const setProjectFiles = async (api: Api, analyzationResult: AnalyzationResult) => {
  const localProjectContents = analyzationResult.localProjectContents
  let files: { [fileName: string]: RIO_FILE } | undefined = {}
  let models: { [fileName: string]: RIO_FILE } | undefined = {}

  
  if (Object.keys(analyzationResult.comparization.files).length > 0) {
    for (const [fileName, fileContent] of Object.entries(localProjectContents.files)) {
      files[fileName] = {
        name: fileName,
        content: gzipSync(Buffer.from(fileContent)).toString('base64'),
      }
    }
    console.log(`${chalk.cyanBright.bold('   [Files]        ')}${chalk.blue(': Saved')}`)
  } else {
    files = undefined
    console.log(`${chalk.cyanBright.bold('   [Files]        ')}${chalk.grey(': None')}`)
  }
  
  
  if (Object.keys(analyzationResult.comparization.models).length > 0) {
    for (const [fileName, fileContent] of Object.entries(localProjectContents.models)) {
      models[fileName] = {
        name: fileName,
        content: gzipSync(Buffer.from(fileContent)).toString('base64'),
      }
    }
    console.log(`${chalk.cyanBright.bold('   [Models]       ')}${chalk.blue(': Saved')}`)
  } else {
    models = undefined
    console.log(`${chalk.cyanBright.bold('   [Models]       ')}${chalk.grey(': None')}`)
  }
  
  await api.setProjectFiles({ files, models })
}

const deployProject = async (api: Api, force: boolean) => {
  console.log(chalk.yellow(`         🟡 Deploying Project ... (might take a few minutes)`))
  await api.deployProjectV2(force)
  await api.waitDeployment()
}

export const deployV2 = async ({ api, analyzationResult, force, oraDisabled }: DeployInput ): Promise<void> => {
  const fileWorkers = []

  // ********* FILES *********
  // ********* MODELS *********

  console.log(chalk.magenta.bold('Project'))

  if (Object.keys(analyzationResult.comparization.files).length > 0 || Object.keys(analyzationResult.comparization.models).length > 0) {
    await setProjectFiles(api, analyzationResult)
  } else {    
    console.log(`${chalk.cyanBright.bold('   [Files]        ')}${chalk.cyanBright.grey(': None')}`)
    console.log(`${chalk.cyanBright.bold('   [Models]       ')}${chalk.cyanBright.grey(': None')}`)
  }

  // ********* DEPENDENCIES *********
  // ********* DEPENDENCIES *********

  if (Object.values(analyzationResult.localProjectContents.dependencies).every((e) => !e.shouldDeploy)) {
    console.log(`${chalk.cyanBright.bold('   [Dependencies] ')}${chalk.cyanBright.grey(': None')}`)
  } else {
    console.log(chalk.cyanBright.bold('   [Dependencies]'))

    for (const [name, values] of Object.entries(analyzationResult.localProjectContents.dependencies)) {
      if (!values.shouldDeploy) continue
  
      const url = await api.upsertDependency(name)
      await axios.put(url, values.zipContent, {
        headers: {
          'Content-Type': 'application/zip',
        },
        maxBodyLength: 104857600, //100mb
        maxContentLength: 104857600, //100mb
      })
      await api.commitUpsertDependency(name, values.hash)
 
      console.log(`${chalk.greenBright(`                  : Deployed  `)}${chalk.cyanBright.bold('[' + name + ']')}`)
    }
  }

  // ********* CLASSES *********
  // ********* CLASSES *********

  console.log(chalk.magenta.bold('Classes'))

  for (const [className, classValues] of Object.entries(analyzationResult.localClasses)) {
    if (!classValues.newClass) continue

    await createClass(api, className)
  }

  // *****

  if (Object.values(analyzationResult.localClasses).every((e) => !e.shouldDeploy && !e.newClass)) {
    console.log(chalk.gray('   None'))
  } else {

    if (!oraDisabled) {
      initOra(analyzationResult.localClasses)
    }
  
    for (const [className, classValues] of Object.entries(analyzationResult.localClasses)) {
      if (!classValues.shouldDeploy) continue
      fileWorkers.push(setClassFiles(api, className, analyzationResult, oraDisabled))
    }

    await Promise.all(fileWorkers)

    if (!oraDisabled) {
      stopOra()
    }
  }
  
  // ********* PROJECT FILES *********
  // ********* PROJECT FILES *********

  console.log(chalk.magenta.bold('\nProject Deployment'))
  console.log('\n')

  await deployProject(api, force)

  console.log('\n\n')
}
  