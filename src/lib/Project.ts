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
        const envProjectId = process.env[RIO_CLI_PROJECT_ID_KEY]
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

    static getClassFileContents(className: string, exclude: string[] = []) {
        return Project.listClassFileNames(className).reduce<{ [fileName: string]: string }>((acc, fileName) => {
            if (!exclude.includes(fileName)) {
                acc[fileName] = Project.readClassFile(className, fileName)
            }
            return acc
        }, {})
    }

    static listModelNames() {
        const modelsFolder = fs.readdirSync(PROJECT_MODELS_FOLDER, {withFileTypes: true})
        const modelFiles = modelsFolder.filter(l => l.isFile() && l.name.endsWith('.json'))
        return modelFiles.map(file => file.name.replace('.json', ''))
    }

    static listClassFileNames(className: string) {
        const classFolder = fs.readdirSync(path.join(PROJECT_CLASSES_FOLDER, className), {withFileTypes: true})
        const classesFolderDirectories = classFolder.filter(l => l.isFile())
        return classesFolderDirectories.map(dir => dir.name)
    }

    static listClassNames() {
        const classesFolder = fs.readdirSync(PROJECT_CLASSES_FOLDER, {withFileTypes: true})
        const classesFolderDirectories = classesFolder.filter(l => l.isDirectory())
        return classesFolderDirectories.map(dir => dir.name)
    }

    static readClassFile(className: string, fileName: string) {
        return FileExtra.getFileContextOrFail(path.join(process.cwd(), PROJECT_CLASSES_FOLDER, className, fileName)).toString('utf-8')
    }

    static readClassTemplateString(className: string) {
        return FileExtra.getFileContextOrFail(path.join(process.cwd(), PROJECT_CLASSES_FOLDER, className, PROJECT_CLASS_TEMPLATE_FILE)).toString('utf-8')
    }

    static readModelFile(modelName: string) {
        return FileExtra.getFileContextOrFail(path.join(process.cwd(), PROJECT_MODELS_FOLDER, `${modelName + PROJECT_MODEL_FILE_EXTENSION}`)).toString('utf-8')
    }
}
