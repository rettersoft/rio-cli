import axios from 'axios'
import chalk from 'chalk'
import { gzipSync } from 'zlib'

import { Api } from '../Api'
import { Classes, DeployInput, AnalyzationResult, ProjectContents } from './types'
import _ from 'lodash'
import { sleep } from './utils'

const headerColor = chalk.magentaBright.bold
const subHeaderColor = chalk.cyanBright.bold
const subHeaderColor2 = chalk.cyanBright.bold

const subHeaderTab = '   '
const subHeaderSucces = chalk.greenBright(': Saved ✅')
const subHeaderSuccesCreate = chalk.greenBright(': Created ✅')
const subHeaderNoChange = chalk.gray(': No Action')

interface RioFiles {
  [fileName: string]: { name: string; content?: string }
}

// only send files that have been edited, created, deleted or forced
const setClassFiles = async (api: Api, className: string, analyzationResult: AnalyzationResult) => {
  const comparization = analyzationResult.comparization.classes[className]
  const upsertedFiles = [...comparization.editedFiles, ...comparization.createdFiles, ...comparization.forcedFiles]

  const classFilesContents = analyzationResult.localClasses[className].files

  const files: RioFiles = {}

  for (const fileName of upsertedFiles) {
    const content = classFilesContents[fileName]

    files[fileName] = {
      name: fileName,
      content: gzipSync(Buffer.from(content)).toString('base64'),
    }
  }

  for (const fileName of comparization.deletedFiles) {
    files[fileName] = {
      name: fileName,
      content: undefined,
    }
  }

  await api.setRemoteClassFilesV2(className, files)

  console.log(`${subHeaderTab}${subHeaderColor(className.padEnd(20," "))}${subHeaderSucces}`)
}

// only send files&models that have been edited, created, deleted or forced
const setProjectFiles = async (api: Api, analyzationResult: AnalyzationResult) => {
  const localProjectContents = analyzationResult.localProjectContents
  let files: RioFiles | undefined = {}
  let models: RioFiles | undefined = {}

  const filesChanged = Object.keys(analyzationResult.comparization.files).length > 0
  const modelsChanged = Object.keys(analyzationResult.comparization.models).length > 0

  if (filesChanged) {
    for (const [fileName, comp] of Object.entries(analyzationResult.comparization.files)) {
      if (comp.deleted) {
        files[fileName] = {
          name: fileName,
          content: undefined,
        }
        continue
      }

      const fileContent = localProjectContents.files[fileName]

      files[fileName] = {
        name: fileName,
        content: gzipSync(Buffer.from(fileContent)).toString('base64'),
      }
    }

    console.log(`${subHeaderTab}${subHeaderColor2(('[Files]').padEnd(20," "))}${subHeaderSucces}`)
  } else {
    console.log(`${subHeaderTab}${subHeaderColor2(('[Files]').padEnd(20," "))}${subHeaderNoChange}`)
  }


  if (modelsChanged) {
    for (const [fileName, comp] of Object.entries(analyzationResult.comparization.models)) {
      if (comp.deleted) {
        models[fileName] = {
          name: fileName,
          content: undefined,
        }
        continue
      }

      const fileContent = localProjectContents.models[fileName]

      models[fileName] = {
        name: fileName,
        content: gzipSync(Buffer.from(fileContent)).toString('base64'),
      }
    }
    console.log(`${subHeaderTab}${subHeaderColor2(('[Models]').padEnd(20," "))}${subHeaderSucces}`)
  } else {
    console.log(`${subHeaderTab}${subHeaderColor2(('[Models]').padEnd(20," "))}${subHeaderNoChange}`)
  }


  await api.setProjectFilesV2({
    files: filesChanged ? files : undefined,
    models: modelsChanged ? models : undefined,
  })
}

const deployProject = async (api: Api, force: boolean) => {
  const tab = '         '
  
  console.log(chalk.yellow(`\n${tab}🟡 Deployment STARTED`))
  const deploymentId = await api.deployProjectV2(force)

  console.log(chalk.yellow(`\n${tab}${tab}🔸 Deployment ID: ${deploymentId}`))
  await api.waitDeploymentV2(deploymentId as string)
}

const createClass = async (api: Api, className: string) => {
  await api.createClass(className)
  console.log(`${subHeaderTab}${subHeaderColor(className.padEnd(20," "))}${subHeaderSuccesCreate}`)
}

export const deployV2 = async ({ api, analyzationResult, force, deploy }: DeployInput): Promise<void> => {
  const fileWorkers = []

  if (analyzationResult.deploymentCount > 0) {
      console.log(`${subHeaderTab}${chalk.grey(`📌 Your deployment started but there is ${analyzationResult.deploymentCount} more deployment(s) happening in paralel`)}`)
      console.log(`\n`)
  }

  // ********* FILES *********<
  // ********* MODELS *********

  console.log(headerColor('Project'))

  await setProjectFiles(api, analyzationResult)

  // ********* DEPENDENCIES *********
  // ********* DEPENDENCIES *********

  if (Object.values(analyzationResult.localProjectContents.dependencies).every((e) => !e.shouldDeploy)) {
    console.log(`${subHeaderTab}${subHeaderColor2(('[Dependencies]').padEnd(20," "))}${subHeaderNoChange}`)
  } else {
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
    }

    console.log(`${subHeaderTab}${subHeaderColor2(('[Dependencies]').padEnd(20," "))}${subHeaderSucces}`)
  }

  // ********* CLASSES *********
  // ********* CLASSES *********

  const changed = Object.values(analyzationResult.localClasses).some((e) => e.shouldDeploy || e.newClass)

  if (!changed) {
    console.log(`${subHeaderTab}${subHeaderColor2('[Classes]'.padEnd(20, ' '))}${subHeaderNoChange}`)
  } else {
    console.log(headerColor('Classes'))

    for (const [className, classValues] of Object.entries(analyzationResult.localClasses)) {
      if (!classValues.newClass) continue

      await createClass(api, className)
    }

    // *****
    for (const [className, classValues] of Object.entries(analyzationResult.localClasses)) {
      if (!classValues.shouldDeploy) continue
      fileWorkers.push(setClassFiles(api, className, analyzationResult))
    }

    const chucks = _.chunk(fileWorkers, 10)

    for (const chunk of chucks) {
      await Promise.all(chunk)
    }
  }

  await sleep(5000)

  // ********* PROJECT FILES *********
  // ********* PROJECT FILES *********

  if (deploy) {
    await deployProject(api, force)
  }

  console.log('\n')
}
