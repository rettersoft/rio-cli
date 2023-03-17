import path from 'path'
import { PROJECT_CLASSES_FOLDER } from '../../config'
import { Api } from '../Api'
import fs from 'fs'
import chalk from 'chalk'
import { gzipSync } from 'zlib'
import { DeploymentClassContent, DeploymentClasses, DeploymentDependencies } from './types'
import axios from 'axios'

interface RIO_FILE {
  name: string
  content: string
}

const setFiles = async (api: Api, className: string, classContents: DeploymentClassContent, ) => {

  const fileContents = classContents.files
  const modelContents = classContents.models

  const files:{ [fileName: string]: RIO_FILE } = {}
  const models:{ [fileName: string]: RIO_FILE } = {}

  for (const [fileName, fileContent] of Object.entries(fileContents)) {
    files[fileName] = {
      name: fileName,
      content: gzipSync(Buffer.from(fileContent)).toString('base64')
    }
  }

  for (const [fileName, fileContent] of Object.entries(modelContents)) {
    models[fileName] = {
      name: fileName,
      content: gzipSync(Buffer.from(fileContent)).toString('base64')
    }
  }

  await api.setRemoteClassFilesAndModelsV2(className, files, models)
  console.log(chalk.blue(`   saved   : [${className}] `))
}

const createClass = async (api: Api, className: string) => {
  await api.createClass(className)
  console.log(chalk.green(`   created : [${className}] `))
}

export const deployV2 = async (api: Api, classes: DeploymentClasses, dependencies: DeploymentDependencies, force: boolean ): Promise<void> => {
  const fileWorkers = []
  const createClassWorkers = []

  console.log(chalk.magenta.bold('Dependencies'))

  for (const [name, values] of Object.entries(dependencies)) {
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
    console.log(chalk.cyan(`   deployed: [${name}] `))
  }

  if (Object.values(dependencies).every(e => !e.shouldDeploy)) {
    console.log(chalk.gray('   None'))
  }

  console.log(chalk.magenta.bold('Classes'))

  for (const [className, classValues] of Object.entries(classes)) {
    if (!classValues.newClass) continue

    createClassWorkers.push(createClass(api, className))
  }
  await Promise.all(createClassWorkers)
  
  for (const [className, classValues] of Object.entries(classes)) {
    if (!classValues.shouldDeploy) continue
    fileWorkers.push(setFiles(api, className, classValues ))
  }

  await Promise.all(fileWorkers)

  for (const [className, classValues] of Object.entries(classes)) {
    if (!classValues.shouldDeploy) continue

    await api.deployClassV2(className, force)
  }

  console.log('\n\n')
}
  