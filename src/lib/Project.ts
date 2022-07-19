import fs from "fs";
import {
    PROJECT_CLASS_TEMPLATE_FILE,
    PROJECT_CLASSES_FOLDER,
    PROJECT_MODEL_FILE_EXTENSION, PROJECT_MODEL_NAME_SEP,
    PROJECT_MODELS_FOLDER,
    PROJECT_RIO_CONFIG,
    RIO_CLI_DEPENDENCIES_FOLDER,
    RIO_CLI_OUTPUT_DIR,
    RIO_CLI_PROJECT_ID_KEY
} from "../config";
import path from "path";
import {FileExtra} from "./FileExtra";
import * as process from "process";
import YAML from "yaml"
import {IProjectTemplate} from "../Interfaces/IProjectTemplate";
import {Tmp} from "./Tmp";
import {spawn} from "child_process";
import {Dependencies} from "./Dependencies";

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

    static listModelNames(folder: string = PROJECT_MODELS_FOLDER, previousData: string[] = []): string[] {
        const modelsFolder = fs.readdirSync(folder, {withFileTypes: true})
        modelsFolder.forEach(l => {
            if (l.isDirectory()) {
                previousData = Project.listModelNames(path.join(folder, l.name), previousData)
            } else if (l.isFile()) {
                const prefix = folder === PROJECT_MODELS_FOLDER ? '' : folder.replace(
                    PROJECT_MODELS_FOLDER + path.sep, '').replace(new RegExp(path.sep, 'g'), PROJECT_MODEL_NAME_SEP) + PROJECT_MODEL_NAME_SEP
                previousData.push(prefix + l.name.replace(PROJECT_MODEL_FILE_EXTENSION, ''))
            }
        })
        return previousData
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
        if(modelName.includes(PROJECT_MODEL_NAME_SEP)){
            modelName = modelName.replace(new RegExp(PROJECT_MODEL_NAME_SEP, 'g'), path.sep)
        }
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

    static async build() {
        const buildTmp = Tmp.getUniqueTmpPath()

        try {
            const dependenciesPath = path.join(process.cwd(), 'dependencies')

            if (fs.existsSync(dependenciesPath)) {
                const dependencyNames = Dependencies.getAllLocalDependencyNames()

                if (dependencyNames.length < 1) {
                    return true
                }

                const tsConfig = {
                    "compilerOptions": {
                        "baseUrl": ".",
                        "lib": ["ES2017", "dom"],
                        "module": "commonjs",
                        "target": "es5",
                        "sourceMap": false,
                        "esModuleInterop": true,
                        "moduleResolution": "node",
                        "skipLibCheck": true,
                        "downlevelIteration": true,
                        "resolveJsonModule": true,
                        "experimentalDecorators": true,
                        "emitDecoratorMetadata": true,
                        "strictNullChecks": true,
                        "removeComments": true,
                        "rootDir": "dependencies/",
                        "types": ["node"],
                        "outDir": "dist",
                        "typeRoots": ["node_modules/@types"]
                    },
                    "exclude": ["**/node_modules/*", "**/dist/**", "test/*", "classes/**/node_modules/**", "classes/CDH/**"]
                }

                const packageJson = {
                    "name": "project",
                    "version": "0.0.1",
                    "scripts": {
                        "build": "tsc -b"
                    },
                    "dependencies": {
                        "@retter/rdk": "^1.1.15",
                        "@types/node": "^17.0.9",
                        "typedoc": "^0.22.13",
                        "typescript": "^4.3.5"
                    }
                }

                await FileExtra.writeFile(path.join(buildTmp, "tsconfig.json"), JSON.stringify(tsConfig))

                await FileExtra.writeFile(path.join(buildTmp, "package.json"), JSON.stringify(packageJson))

                await FileExtra.copySync(path.join(process.cwd(), 'dependencies'), path.join(buildTmp, 'dependencies'))

                const npmInstall = (cwd?: string) => {
                    return new Promise((resolve, reject) => {
                        const npmInstall = spawn("npm",
                            ["install", "--loglevel=error", "--no-progress", "--no-fund"], {
                                stdio: "inherit",
                                cwd: cwd ? cwd : path.join(buildTmp)
                            })
                        npmInstall.on("close", () => {
                            resolve(true)
                        })
                        npmInstall.on("error", (e) => {
                            reject(e)
                        })
                        npmInstall.on("exit", (code, signal) => {
                                if (code !== 0) {
                                    reject('npm i error :: ' + cwd)
                                } else {
                                    resolve(true)
                                }
                            }
                        )
                    })
                }

                for (const dependencyName of dependencyNames) {
                    const subPackageJsonPath = path.join(buildTmp, RIO_CLI_DEPENDENCIES_FOLDER, dependencyName, "package.json")
                    if (fs.existsSync(subPackageJsonPath)) {
                        await npmInstall(path.join(buildTmp, RIO_CLI_DEPENDENCIES_FOLDER, dependencyName))
                    }
                }

                const npmBuild = () => {
                    return new Promise((resolve, reject) => {
                        const buildCommand = spawn("npm",
                            ["run", "build", "--silent"],
                            {
                                stdio: 'inherit',
                                cwd: buildTmp
                            })
                        buildCommand.on("close", () => {
                            resolve(true)
                        })
                        buildCommand.on("error", (err) => {
                            reject(err)
                        })
                        buildCommand.on("exit", (code, signal) => {
                                if (code !== 0) {
                                    reject('tsc build error')
                                } else {
                                    resolve(true)
                                }
                            }
                        )
                    })
                }

                await npmInstall()
                await npmBuild()

                await FileExtra.copySync(path.join(buildTmp, 'dist'), path.join(process.cwd(), RIO_CLI_OUTPUT_DIR, RIO_CLI_DEPENDENCIES_FOLDER))

            }
            //Tmp.clearUniqueTmpPath(buildTmp)
        } catch (e) {
            //Tmp.clearUniqueTmpPath(buildTmp)
            throw e
        }

    }
}
