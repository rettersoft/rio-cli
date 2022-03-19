import fs from "fs";
import {
    PROJECT_CLASS_TEMPLATE_FILE,
    PROJECT_CLASSES_FOLDER,
    PROJECT_MODEL_FILE_EXTENSION,
    PROJECT_MODELS_FOLDER,
    PROJECT_RIO_CONFIG,
    RIO_CLI_PROJECT_ID_KEY
} from "../config";
import path from "path";
import {FileExtra} from "./FileExtra";
import * as process from "process";
import YAML from "yaml"
import {IProjectTemplate} from "../Interfaces/IProjectTemplate";

export interface IProjectRioConfig {
    projectId: string
}

export interface IClassContents {
    [className: string]: { [fileName: string]: string }
}

export class Project {

    static getLocalClassTemplate(className: string): IProjectTemplate {
        const template = Project.readClassFile(className, PROJECT_CLASS_TEMPLATE_FILE)
        return YAML.parse(template)
    }

    static getLocalClassContents(classes?: string[]) {
        return (classes || Project.listClassNames()).reduce<IClassContents>(
            (acc, className) => {
                acc[className] = Project.getClassFileContents(className)
                return acc
            }, {})
    }

    static getProjectRioConfig(): IProjectRioConfig {
        const envProjectId = !process.env[RIO_CLI_PROJECT_ID_KEY] || process.env[RIO_CLI_PROJECT_ID_KEY] === 'undefined' ? undefined : process.env[RIO_CLI_PROJECT_ID_KEY]
        let projectConfig: IProjectRioConfig
        try {
            const projectRioConfigContent = FileExtra.getFileContextOrFail(path.join(process.cwd(), PROJECT_RIO_CONFIG))
            projectConfig = JSON.parse(projectRioConfigContent.toString('utf-8'))
            if (envProjectId) {
                projectConfig.projectId = envProjectId
            }
        } catch (e) {
            if (!envProjectId) throw new Error('Project id is required')
            projectConfig = {
                projectId: envProjectId
            }
        }
        return projectConfig
    }

    static getModelFileContents(exclude: string[] = []) {
        return Project.listModelNames().reduce<{ [modelName: string]: string }>((acc, modelName) => {
            if (!exclude.includes(modelName)) {
                acc[modelName] = Project.readModelFile(modelName)
            }
            return acc
        }, {})
    }

    static getClassFileContents(className: string) {
        return Project.listAllClassFileKeys(className).reduce<{ [fileName: string]: string }>((acc, fileKey) => {
            acc[fileKey] = Project.readClassFile(className, fileKey)
            return acc
        }, {})
    }

    static listModelNames() {
        const modelsFolder = fs.readdirSync(PROJECT_MODELS_FOLDER, {withFileTypes: true})
        const modelFiles = modelsFolder.filter(l => l.isFile() && l.name.endsWith(PROJECT_MODEL_FILE_EXTENSION))
        return modelFiles.map(file => file.name.replace(PROJECT_MODEL_FILE_EXTENSION, ''))
    }

    static listAllClassFileKeys(className: string) {
        const keys = FileExtra.getAllFiles(path.join(PROJECT_CLASSES_FOLDER, className))
        return keys.map(k => k.replace(path.join(PROJECT_CLASSES_FOLDER, className, path.sep).toString(), '')
            .split(path.sep).join('/'))
    }

    static listClassNames() {
        const classesFolder = fs.readdirSync(PROJECT_CLASSES_FOLDER, {withFileTypes: true})
        const classesFolderDirectories = classesFolder.filter(l => l.isDirectory())
        return classesFolderDirectories.map(dir => dir.name)
    }

    static readClassFile(className: string, fileKey: string) {
        if (!FileExtra.isClassFile(className, fileKey)) {
            throw new Error(`${className}, ${fileKey} is not a class file`)
        }
        return FileExtra.getFileContextOrFail(path.join(process.cwd(), PROJECT_CLASSES_FOLDER, className, fileKey)).toString('utf-8')
    }

    static readClassTemplateString(className: string) {
        return FileExtra.getFileContextOrFail(path.join(process.cwd(), PROJECT_CLASSES_FOLDER, className, PROJECT_CLASS_TEMPLATE_FILE)).toString('utf-8')
    }

    static readModelFile(modelName: string) {
        return FileExtra.getFileContextOrFail(path.join(process.cwd(), PROJECT_MODELS_FOLDER, `${modelName + PROJECT_MODEL_FILE_EXTENSION}`)).toString('utf-8')
    }

    static getModelDefs(modelName: string): string[] {
        const modelContent = Project.readModelFile(modelName)
        const models = Array.from(new Set(modelContent.match(/("#\/\$defs\/)[A-Za-z0-9_-].*(")/g) || []))
            .map(r => r.replace(/"/g, '').replace('#/$defs/', ''))
        if (models.length < 1) {
            return []
        } else {
            return models.concat(models.map(m => {
                return Project.getModelDefs(m)
            }).join())
        }
    }
}
