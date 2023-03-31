import path from 'path'
import { PROJECT_CLASSES_FOLDER } from '../../config'
import { Api } from '../Api'
import fs from 'fs'
import { Classes, FileInfo } from './types'
import { listFilesRecursively, readFilesParallelly } from './utils'

export function listClassNames(): string[] {
  const classesFolder = fs.readdirSync(PROJECT_CLASSES_FOLDER, { withFileTypes: true })
  const classesFolderDirectories = classesFolder.filter((l) => l.isDirectory())
  return classesFolderDirectories.map((dir) => dir.name)
}

export const fetchLocalClassContents = async (targetClassNames: string[]): Promise<Classes> => {
  const classesContents: Classes = {}

  if (!targetClassNames.length) {
    return classesContents
  }

  const promises = targetClassNames.map(async (className) => {
    const classPath = path.join(process.cwd(), PROJECT_CLASSES_FOLDER, className)

    const { files } = listFilesRecursively(classPath, classPath)

    const filesWithContent = await readFilesParallelly(files)

    classesContents[className] = {
      files: filesWithContent
    }
  })

  await Promise.allSettled(promises)

  return classesContents
}

export const fetchRemoteClassContents = async (api: Api, targetClassNames: string[]): Promise<Classes> => {
  const remoteClassesContents: Classes = {}

  if (!targetClassNames.length) {
    return remoteClassesContents
  }

  const workers = []
  for (const className of targetClassNames) {
    workers.push(api.getRemoteClassFilesV2(className))
  }
  const responses = await Promise.allSettled(workers)

  for (const response of responses) {
    if (response.status !== 'fulfilled') {
      throw new Error(`failed to fetch remote class files: ${response.reason}`)
    }
    const datas = response.value
    
    for (const file of datas.files) {
      if (!remoteClassesContents[file.classId]) {
        remoteClassesContents[file.classId] = {
          files: {},
        }
      }
      remoteClassesContents[file.classId].files[file.name] = file.content
    }
  }
  return remoteClassesContents
}
