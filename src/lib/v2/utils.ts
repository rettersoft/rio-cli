import fs from 'fs'
import path from 'path'
import { FileInfo, V2ProjectConfig } from './types'
import { PROJECT_RIO_CONFIG } from '../../config'

const excludedFolders = ['__tests__', 'node_modules', 'scripts', '.turbo', '.nyc_output']
const excludedFiles = ['.DS_Store', 'package-lock.json', 'yarn.lock']

export function listFilesRecursively(ogPath: string, directoryPath: string): { files: FileInfo[] } {
  const fileInfos: FileInfo[] = []
  const filesAndFolders = fs.readdirSync(directoryPath)
  filesAndFolders.forEach((name) => {
    const fullPath = path.join(directoryPath, name)
    const stats = fs.statSync(fullPath)
    if (stats.isDirectory()) {
      if (excludedFolders.includes(name) || excludedFiles.includes(name)) {
        return
      } 
        const { files } = listFilesRecursively(ogPath, fullPath)
        fileInfos.push(...files)  
    } else {
      const relativePath = path.relative(ogPath, fullPath)
      const fileName = relativePath.includes('/') ? relativePath : name
      fileInfos.push({ fileName, filePath: fullPath })
    }
  })
  return { files: fileInfos }
}

// read files parallelly
export async function readFilesParallelly(files: FileInfo[]) {
  const promises: Promise<[string, string]>[] = files.map((fileInfo) =>
    fs.promises.readFile(fileInfo.filePath, 'utf-8').then((fileContents) => [fileInfo.fileName, fileContents])
  )
  const filesArray = await Promise.all(promises)
  return Object.fromEntries(filesArray)
}

export async function getProjectConfig(): Promise<V2ProjectConfig> {
  const projectConfigPath = path.join(process.cwd(), PROJECT_RIO_CONFIG)

  try {
    await fs.promises.access(projectConfigPath, fs.constants.R_OK)
  } catch (err: any) {
    return {} as V2ProjectConfig
  }

  try {
    const projectRioConfigContent = fs.readFileSync(projectConfigPath)

    return JSON.parse(projectRioConfigContent.toString('utf-8')) as V2ProjectConfig
  } catch (e) {
    return {} as V2ProjectConfig
  }
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))