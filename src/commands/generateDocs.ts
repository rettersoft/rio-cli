import {GlobalInput} from "./ICommand";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";
import {Tmp} from "../lib/Tmp";
import {FileExtra} from "../lib/FileExtra";
import path from "path";
import {ProjectManager} from "../lib/ProjectManager";
import {
    PROJECT_DOCUMENTATION_NAME,
    PROJECT_GENERATED_DOCS_FOLDER,
    PROJECT_PACKAGE_JSON_FILE,
    PROJECT_README_FILE,
    PROJECT_RIO_CLASS_FILE
} from "../config";
import {execSync, spawn} from "child_process";
import Listr from "listr";
import fs from "fs";

interface Input extends GlobalInput {
    out: string
    open: boolean
    "include-version": boolean
}

interface TaskContext {
}

module.exports = {
    command: 'generate-docs',
    description: `Generate project docs
     Usage: rio generate-docs`,
    aliases: ['gd'],
    builder: yargs => {
        yargs.options('out', {
            describe: 'Docs output folder',
            default: PROJECT_GENERATED_DOCS_FOLDER,
            type: 'string'
        })
        yargs.options('include-version', {
            describe: 'Include version',
            default: false,
            boolean: true,
            type: 'boolean'
        })
        yargs.options('open', {
            describe: 'Open docs after generate operation',
            default: false,
            type: 'boolean'
        })
        return yargs
    },
    handler: async (args) => {
        const compileTmp = Tmp.getUniqueTmpPath()
        const outputDir = args.out;

        const tasks = new Listr([
            {
                title: 'Docs',
                task: () => {
                    return new Listr([
                        {
                            title: "Preparing Files",
                            task: async (ctx: TaskContext) => {
                                const tsConfig = {
                                    "compilerOptions": {
                                        "lib": ["ES2015", "dom"],
                                        "module": "commonjs",
                                        "target": "es5",
                                        "sourceMap": false,
                                        "esModuleInterop": true,
                                        "moduleResolution": "node",
                                        "downlevelIteration": true
                                    },
                                    "typedocOptions": {
                                        "entryPoints": [PROJECT_RIO_CLASS_FILE],
                                        "out": PROJECT_GENERATED_DOCS_FOLDER
                                    }
                                }

                                // get project name and version from package.json
                                let projectPackageJson;
                                const projectPackageJsonPath = path.join(process.cwd(), PROJECT_PACKAGE_JSON_FILE)
                                if (fs.existsSync(projectPackageJsonPath)) {
                                    try {
                                        projectPackageJson = JSON.parse(fs.readFileSync(projectPackageJsonPath).toString('utf-8'))
                                    } catch (e) {
                                    }
                                }

                                //copy readme.md if exist
                                let localReadmeMdPath = "none"
                                const readmeMdPath = path.join(process.cwd(), PROJECT_README_FILE)
                                if (fs.existsSync(readmeMdPath)) {
                                    localReadmeMdPath = path.join(compileTmp, PROJECT_README_FILE)
                                    FileExtra.copySync(path.join(process.cwd(), PROJECT_README_FILE), path.join(compileTmp, PROJECT_README_FILE))
                                }

                                const packageJson = {
                                    "name": projectPackageJson && projectPackageJson.name ? projectPackageJson.name : PROJECT_DOCUMENTATION_NAME,
                                    "version": projectPackageJson && projectPackageJson.version ? projectPackageJson.version : "0.0.1",
                                    "scripts": {
                                        "td": "typedoc " + [
                                            "--hideGenerator",
                                            args["include-version"] ? '--includeVersion' : undefined,
                                            `--readme ${localReadmeMdPath}`].filter(Boolean).join(' ')
                                    },
                                    "dependencies": {
                                        "@retter/rdk": "^1.1.1",
                                        "@types/node": "^17.0.9",
                                        "typedoc": "^0.22.11",
                                        "typescript": "^4.3.5"
                                    }
                                }

                                fs.mkdirSync(path.join(compileTmp, PROJECT_GENERATED_DOCS_FOLDER))

                                await FileExtra.writeFile(path.join(compileTmp, PROJECT_RIO_CLASS_FILE),
                                    (await ProjectManager.generateRioFile()))

                                await FileExtra.writeFile(path.join(compileTmp, "tsconfig.json"), JSON.stringify(tsConfig))

                                await FileExtra.writeFile(path.join(compileTmp, "package.json"), JSON.stringify(packageJson))
                            }
                        },
                        {
                            title: "Loading Dependencies",
                            task: (ctx: TaskContext) => {
                                return new Promise((resolve, reject) => {
                                    const npmInstall = spawn("npm",
                                        ["install", "--no-warnings"], {
                                            stdio: "ignore",
                                            cwd: path.join(compileTmp)
                                        })
                                    npmInstall.on("close", () => {
                                        resolve(true)
                                    })
                                    npmInstall.on("error", (e) => {
                                        reject(e)
                                    })
                                })
                            }
                        },
                        {
                            title: "Rendering",
                            task: async (ctx: TaskContext) => {
                                return new Promise((resolve, reject) => {
                                    const typedoc = spawn("npm",
                                        ["run", "td"],
                                        {
                                            stdio: 'ignore',
                                            cwd: compileTmp
                                        })
                                    typedoc.on("close", () => {
                                        resolve(true)
                                    })
                                    typedoc.on("error", (err) => {
                                        reject(err)
                                    })
                                })
                            }
                        },
                        {
                            title: "Final",
                            task: async (ctx) => {
                                FileExtra.copySync(path.join(compileTmp, PROJECT_GENERATED_DOCS_FOLDER), outputDir)
                            }
                        }
                    ])
                }
            }
        ])
        try {
            await tasks.run()

            if (args.open) {
                execSync('open ' + path.join(outputDir, 'index.html'))
            }

            Tmp.clearUniqueTmpPath(compileTmp)
        } catch (e) {
            if (compileTmp) {
                Tmp.clearUniqueTmpPath(compileTmp)
            }
            throw e
        }
        afterCommand()
    }
} as CommandModule<Input, Input>

