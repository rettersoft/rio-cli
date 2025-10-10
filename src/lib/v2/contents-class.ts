import path from 'path'
import { Api } from '../Api'
import fs from 'fs'
import { Classes } from './types'
import { listFilesRecursively, readFilesParallelly } from './utils'
import YAML from 'yaml'
import { zodToJsonSchema } from 'zod-to-json-schema'

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

    const zodModels = await extractZodModels(className, classPath, filesWithContent)
  
    classesContents[className] = {
      files: filesWithContent,
      zodModels
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
          zodModels: {}
        }
      }
      remoteClassesContents[file.classId].files[file.name] = file.content
    }
  }
  return remoteClassesContents
}

/**
 * Extract ZOD models from template.yml and handler files
 * Handles both JSON models (direct references) and ZOD schemas (file.exportName)
 */
async function extractZodModels(className: string, classPath: string, filesWithContent: { [fileName: string]: string }): Promise<{ [modelName: string]: string }> {
  const zodModels: { [modelName: string]: string } = {}
  
  // Get template.yml content
  const templateContent = filesWithContent['template.yml']
  if (!templateContent) {
    return zodModels
  }

  try {
    const template = YAML.parse(templateContent)
    const modelTypes = ['inputModel', 'outputModel', 'errorModel', 'queryStringModel']
    const zodModelReferences: Set<string> = new Set()

    // Extract model references from methods
    if (template.methods && Array.isArray(template.methods)) {
      template.methods.forEach((method: any) => {
        modelTypes.forEach((modelType) => {
          if (method[modelType]) {
            const modelRef = method[modelType]
            // Check if it's a ZOD schema reference (contains a dot)
            if (typeof modelRef === 'string' && modelRef.includes('.')) {
              zodModelReferences.add(modelRef)
            }
          }
        })
      })
    }

    // Extract model references from init, get methods
    ['init', 'get'].forEach((methodType) => {
      if (template[methodType]) {
        modelTypes.forEach((modelType) => {
          if (template[methodType][modelType]) {
            const modelRef = template[methodType][modelType]
            if (typeof modelRef === 'string' && modelRef.includes('.')) {
              zodModelReferences.add(modelRef)
            }
          }
        })
      }
    })

    // Process each ZOD model reference
    for (const zodRef of zodModelReferences) {
      const [fileName, exportName] = zodRef.split('.')
      const handlerFileName = `${fileName}.ts`
      
      if (filesWithContent[handlerFileName]) {        
        // Extract the ZOD schema and convert to JSON schema
        const jsonSchema = await extractZodSchemaAsJson(classPath, fileName, exportName)
        if (jsonSchema) {
          zodModels[className + '.' + zodRef] = jsonSchema
        }
      }
    }

  } catch (error) {
    console.warn(`Warning: Failed to parse template.yml for class ${className}:`, error)
  }

  return zodModels
}

/**
 * Extract ZOD schema from file and convert to JSON schema using zodToJsonSchema
 */
async function extractZodSchemaAsJson(classPath: string, fileName: string, exportName: string): Promise<string | null> {
  try {
    const filePath = path.join(classPath, `${fileName}.ts`)
    
    // Read the TypeScript file content
    const tsContent = await fs.promises.readFile(filePath, 'utf-8')
    
    // Create a temporary JavaScript version that can be required
    const tempDir = path.join(process.cwd(), '.temp-zod-eval')
    const tempFile = path.join(tempDir, `${Date.now()}-${fileName}.js`)
    
    // Ensure temp directory exists
    await fs.promises.mkdir(tempDir, { recursive: true })
    
    try {
      // Convert TypeScript to JavaScript by replacing import/export syntax
      let jsContent = tsContent
        .replace(/import\s+{\s*([^}]+)\s*}\s+from\s+['"]([^'"]+)['"]/g, 'const { $1 } = require("$2")')
        .replace(/import\s+([^{][^'"\s]*)\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = require("$2")')
        .replace(/export\s+const\s+/g, 'const ')
        .replace(/export\s+/g, '')
      
      // Add module.exports at the end
      jsContent += `\nmodule.exports = { ${exportName} };`
      
      // Write temporary JavaScript file
      await fs.promises.writeFile(tempFile, jsContent)
      
      // Clear require cache to ensure fresh evaluation
      delete require.cache[require.resolve(tempFile)]
      
      // Require the temporary JavaScript file
      const module = require(tempFile)
      const zodSchema = module[exportName]
      
      if (zodSchema) {
        // Use zodToJsonSchema to convert the ZOD schema to JSON schema
        const jsonSchema = zodToJsonSchema(zodSchema, exportName)
        return JSON.stringify(jsonSchema.definitions, null, 2)
      }
      
      return null
    } finally {
      // Clean up temporary file
      try {
        await fs.promises.unlink(tempFile)
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.warn(`Warning: Failed to extract ZOD schema ${exportName} from ${fileName}:`, error)
    return null
  }
}
