import path from 'path'
import { Api } from '../Api'
import fs from 'fs'
import { Classes } from './types'
import { listFilesRecursively, readFilesParallelly } from './utils'

export function listClassNames(): string[] {
  const classesFolder = fs.readdirSync("classes", { withFileTypes: true })
  const classesFolderDirectories = classesFolder.filter((l) => l.isDirectory())
  return classesFolderDirectories.map((dir) => dir.name)
}

export const fetchLocalClassContents = async (targetClassNames: string[], projectPath = process.cwd()): Promise<Classes> => {
  const classesContents: Classes = {}

  if (!targetClassNames.length) {
    return classesContents
  }

  const promises = targetClassNames.map(async (className) => {
    const classPath = path.join(projectPath, "classes", className)

    try {
      await fs.promises.access(path.join(classPath, "template.yml") , fs.constants.R_OK)
    } catch (err: any) {
      return Promise.resolve()
    }

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
