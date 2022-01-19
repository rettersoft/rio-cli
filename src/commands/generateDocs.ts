import {GlobalInput} from "./ICommand";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";
import {Tmp} from "../lib/Tmp";
import {FileExtra} from "../lib/FileExtra";
import path from "path";
import {ProjectManager} from "../lib/ProjectManager";
import {PROJECT_GENERATED_DOCS_FOLDER, PROJECT_RIO_CLASS_FILE} from "../config";
import {execSync, spawn} from "child_process";
import Listr from "listr";
import fs from "fs";

interface Input extends GlobalInput {
    out: string
    open: boolean
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
                            task: async (ctx) => {
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
                                        "entryPoints": ["rio.ts"],
                                        "out": PROJECT_GENERATED_DOCS_FOLDER
                                    }
                                }

                                const packageJson = {
                                    "name": "docs",
                                    "version": "0.0.1",
                                    "scripts": {
                                        "td": "typedoc"
                                    },
                                    "dependencies": {
                                        "@retter/rdk": "^1.0.7",
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
                            task: (ctx) => {
                                return new Promise((resolve, reject) => {
                                    const npmInstall = spawn("npm",
                                        ["install", "--no-warnings"], {
                                            stdio: "ignore",
                                            cwd: path.join(compileTmp)
                                        })
                                    npmInstall.on("close", () => {
                                        resolve(true)
                                    })
                                    npmInstall.on("error", () => {
                                        reject(false)
                                    })
                                })
                            }
                        },
                        {
                            title: "Rendering",
                            task: async (ctx) => {
                                return new Promise((resolve, reject) => {
                                    const npmInstall = spawn("npm",
                                        ["run", "td"], {
                                            stdio: "ignore",
                                            cwd: compileTmp
                                        })
                                    npmInstall.on("close", () => {
                                        resolve(true)
                                    })
                                    npmInstall.on("error", (err) => {
                                        console.error(err)
                                        reject(false)
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

            //Tmp.clearUniqueTmpPath(compileTmp)
        } catch (e) {
            if (compileTmp) {
                //Tmp.clearUniqueTmpPath(compileTmp)
            }
            throw e
        }
        afterCommand()
    }
} as CommandModule<Input, Input>

