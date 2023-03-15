import path from 'path'
import { PROJECT_CLASSES_FOLDER } from '../../config'
import { Api } from '../Api'
import fs from 'fs'

export interface IClassContentsV2 {
  [className: string]: {
    models: { [fileName: string]: string }
    files: { [fileName: string]: string }
  }
}

export interface PreDeploymentSummaryV2 {
  remoteClasses: IClassContentsV2
  localClasses: IClassContentsV2
  changes: IClassContentsV2
}

// ********* LOCAL CLASS CONTENTS *********

interface FileInfo {
  fileName: string
  filePath: string
}

const excludedFolders = ['__tests__', 'node_modules', 'scripts']
const excludedFiles = ['.DS_Store']

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

function listClassNames() {
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

const fetchLocalClassContents = async (targetClassNames: string[]): Promise<IClassContentsV2> => {
  const classesContents: IClassContentsV2 = {}

  if (!targetClassNames.length) {
    return classesContents
  }

  const promises = targetClassNames.map(async (className) => {
    const classPath = path.join(process.cwd(), PROJECT_CLASSES_FOLDER, className)

    const { files, models } = listFilesRecursively(classPath, classPath)

    console.log(`Found ${files.length} files and ${models.length} models for class ${className}`)

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

const fetchRemoteClassContents = async (api: Api, targetClassNames: string[]): Promise<IClassContentsV2> => {
  const remoteClassesContents: IClassContentsV2 = {}

  if (!targetClassNames.length) {
    return remoteClassesContents
  }

  const workers = []
  for (const className of targetClassNames) {
    workers.push(api.getRemoteClassFilesAndModels(className))
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

// ********* PRE DEPLOYMENT *********

function compareClasses(remoteClasses: IClassContentsV2, localClasses: IClassContentsV2): IClassContentsV2 {
  const changedOrNewClasses: IClassContentsV2 = {}

  // Loop over all the classes in the localClasses object
  for (const className in localClasses) {
    if (!remoteClasses[className]) {
      // If the class does not exist in remoteClasses, it is new
      changedOrNewClasses[className] = localClasses[className]
    } else {
      // Compare the files and models in the current class
      const localFiles = localClasses[className].files
      const remoteFiles = remoteClasses[className].files
      const localModels = localClasses[className].models
      const remoteModels = remoteClasses[className].models
      const changedFiles: { [fileName: string]: string } = {}
      const changedModels: { [fileName: string]: string } = {}

      // Loop over all the files in the local class
      for (const fileName in localFiles) {
        if (!remoteFiles[fileName] || remoteFiles[fileName] !== localFiles[fileName]) {
          // If the file does not exist in remoteFiles or the content is different, mark it as changed
          changedFiles[fileName] = localFiles[fileName]
        }
      }

      // Loop over all the models in the local class
      for (const fileName in localModels) {
        if (!remoteModels[fileName] || remoteModels[fileName] !== localModels[fileName]) {
          // If the model does not exist in remoteModels or the content is different, mark it as changed
          changedModels[fileName] = localModels[fileName]
        }
      }

      // If there are any changes in files or models, add the class to changedOrNewClasses
      if (Object.keys(changedFiles).length > 0 || Object.keys(changedModels).length > 0) {
        changedOrNewClasses[className] = {
          files: changedFiles,
          models: changedModels,
        }
      }
    }
  }

  return changedOrNewClasses
}

export const preDeploymentV2 = async (api: Api, classes?: string[]): Promise<PreDeploymentSummaryV2> => {
    if (classes && !Array.isArray(classes)) throw new Error('invalid classes input')
  
    const projectState = await api.getProjectState()
  
    // classes
    let targetClassNames = classes || listClassNames()
    const targetRemoteClassNames = targetClassNames.filter((className) => projectState.public.classes.some((c: any) => c.classId === className))
  
    const [remoteClasses, localClasses] = await Promise.all([
      fetchRemoteClassContents(api, targetRemoteClassNames),
      fetchLocalClassContents(targetClassNames)
    ]);
  
    // if not being forced, we will only deploy classes that have changed
    const changedClasses = compareClasses(remoteClasses, localClasses)
  
    return { remoteClasses, localClasses, changes: changedClasses }
  }

// ********* PRE DEPLOYMENT *********