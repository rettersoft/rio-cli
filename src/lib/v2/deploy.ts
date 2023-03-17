import path from 'path'
import { PROJECT_CLASSES_FOLDER } from '../../config'
import { Api } from '../Api'
import fs from 'fs'
import { IClassContentsV2, PreDeploymentSummaryV2 } from './pre-deployment'
import chalk from 'chalk'
import { gzipSync } from 'zlib'

interface RIO_FILE {
  name: string
  content: string
}

const setFiles = async (api: Api, summary: PreDeploymentSummaryV2, className: string) => {

  const fileContents = summary.localClasses[className].files
  const modelContents = summary.localClasses[className].models

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
  console.log(chalk.magenta(`SAVED [${className}] `))
}

const createClass = async (api: Api, className: string) => {
  await api.createClass(className)
  console.log(chalk.magenta(`CREATED [${className}] `))
}

export const deployV2 = async (api: Api, summary: PreDeploymentSummaryV2, force: boolean ): Promise<void> => {
  const fileWorkers = []
  const createClassWorkers = []

  for (const [className, _summary] of Object.entries(summary.comparization)) {
    if (!_summary.newClass) continue

    createClassWorkers.push(createClass(api, className))
  }
  await Promise.all(createClassWorkers)
  
  for (const [className, _summary] of Object.entries(summary.comparization)) {
    fileWorkers.push(setFiles(api, summary, className))
  }

  await Promise.all(fileWorkers)

  for (const [className, _summary] of Object.entries(summary.comparization)) {
    if (_summary.newClass) continue

    await api.deployClassV2(className, force)
  }
}
  