import path from 'path'
import { PROJECT_CLASSES_FOLDER } from '../../config'
import { Api } from '../Api'
import fs from 'fs'
import { ConsoleMessage } from '../ConsoleMessage'
import chalk from 'chalk'
import { RetterCloudObjectState } from '@retter/sdk'
import { DeploymentClasses } from './types'

// ********* LOCAL CLASS CONTENTS *********

interface FileInfo {
  fileName: string
  filePath: string
}

const excludedFolders = ['__tests__', 'node_modules', 'scripts', '.turbo', '.nyc_output']
const excludedFiles = ['.DS_Store', 'package-lock.json', 'yarn.lock']

function listFilesRecursively(ogPath: string, directoryPath: string): { files: FileInfo[]; models: FileInfo[] } {
  const fileInfos: FileInfo[] = []
  const modelInfos: FileInfo[] = []
  const filesAndFolders = fs.readdirSync(directoryPath)
  filesAndFolders.forEach((fileOrFolder) => {
    const fullPath = path.join(directoryPath, fileOrFolder)
    const stats = fs.statSync(fullPath)
    if (stats.isDirectory()) {
      if (excludedFolders.includes(fileOrFolder) || excludedFiles.includes(fileOrFolder)) {
        return
      }
      if (fileOrFolder === 'models') {
        const modelFiles = listFilesRecursivelyForModelsFolder(fullPath)
        modelInfos.push(...modelFiles)
      } else {
        const { files, models } = listFilesRecursively(ogPath, fullPath)
        fileInfos.push(...files)
        models.push(...models)
      }
    } else {
      const relativePath = path.relative(ogPath, fullPath)
      const fileName = relativePath.includes('/') ? relativePath : fileOrFolder
      fileInfos.push({ fileName, filePath: fullPath })
    }
  })
  return { files: fileInfos, models: modelInfos }
}

function listFilesRecursivelyForModelsFolder(directoryPath: string): FileInfo[] {
  const fileInfos: FileInfo[] = []
  const files = fs.readdirSync(directoryPath)
  files.forEach((file) => {
    const fullPath = path.join(directoryPath, file)
    const stats = fs.statSync(fullPath)
    if (!stats.isDirectory()) {
      fileInfos.push({ fileName: file, filePath: fullPath })
    }
  })
  return fileInfos
}

export function listClassNames(): string[] {
  const classesFolder = fs.readdirSync(PROJECT_CLASSES_FOLDER, { withFileTypes: true })
  const classesFolderDirectories = classesFolder.filter((l) => l.isDirectory())
  return classesFolderDirectories.map((dir) => dir.name)
}

function readFileContents(filePath: string): string {
  const fileContents = fs.readFileSync(filePath, 'utf-8')
  return fileContents
}

function readContents(files: FileInfo[]) {
  const filesObject: { [fileName: string]: string } = {}
  files.forEach((fileInfo) => {
    const fileContents = readFileContents(fileInfo.filePath)
    filesObject[fileInfo.fileName] = fileContents
  })
  return filesObject
}

export const fetchLocalClassContents = async (targetClassNames: string[]): Promise<DeploymentClasses> => {
  const classesContents: DeploymentClasses = {}

  if (!targetClassNames.length) {
    return classesContents
  }

  const promises = targetClassNames.map(async (className) => {
    const classPath = path.join(process.cwd(), PROJECT_CLASSES_FOLDER, className)

    const { files, models } = listFilesRecursively(classPath, classPath)

    // console.log(`Found ${files.length} files and ${models.length} models for class ${className}`)

    const [filesWithContent, modelsWithContent] = await Promise.allSettled([readContents(files), readContents(models)])

    classesContents[className] = {
      files: filesWithContent.status === 'fulfilled' ? filesWithContent.value : {},
      models: modelsWithContent.status === 'fulfilled' ? modelsWithContent.value : {},
    }
  })

  await Promise.allSettled(promises)

  return classesContents
}
// ********* END OF LOCAL CLASS CONTENTS *********

// ********* REMOTE CLASS CONTENTS *********

export const fetchRemoteClassContents = async (api: Api, targetClassNames: string[]): Promise<DeploymentClasses> => {
  const remoteClassesContents: DeploymentClasses = {}

  if (!targetClassNames.length) {
    return remoteClassesContents
  }

  const workers = []
  for (const className of targetClassNames) {
    workers.push(api.getRemoteClassFilesAndModelsV2(className))
  }
  const responses = await Promise.allSettled(workers)

  for (const response of responses) {
    if (response.status !== 'fulfilled') {
      throw new Error(`failed to fetch remote class files: ${response.reason}`)
    }
    const datas = response.value

    for (const model of datas.models) {
      if (!remoteClassesContents[model.classId]) {
        remoteClassesContents[model.classId] = {
          models: {},
          files: {},
        }
      }

      remoteClassesContents[model.classId].models[model.name] = model.content
    }

    for (const file of datas.files) {
      if (!remoteClassesContents[file.classId]) {
        remoteClassesContents[file.classId] = {
          models: {},
          files: {},
        }
      }
      remoteClassesContents[file.classId].files[file.name] = file.content
    }
  }
  return remoteClassesContents
}

// ********* END OF REMOTE CLASS CONTENTS *********
