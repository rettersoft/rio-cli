import {GlobalInput} from "./ICommand";
import {ProjectManager} from "../lib/ProjectManager";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";
import Listr from "listr";
import chokidar from "chokidar"
import {Ignore} from "../lib/Ignore";
import path from "path";
import chalk from "chalk";
import {PROJECT_RIO_CLASS_FILE} from "../config";

interface Input extends GlobalInput {
    watch: boolean
}

interface TaskContext {

}


module.exports = {
    command: 'generate',
    description: `Generate rio class files
     Usage: rio generate`,
    aliases: ['g'],
    builder: yargs => {
        yargs.options('watch', {
            type: 'boolean',
            default: false,
            boolean: true,
            describe: 'Watch file changes',
        })
        return yargs
    },
    handler: async (args) => {
        const tasks = new Listr([
            {
                title: 'Generate & Save Rio Files',
                task: async (ctx: TaskContext) => {
                    await ProjectManager.generateAndSaveRioFiles()
                }
            }
        ])

        if (args.watch) {
            let count = 1
            await new Promise((resolve, reject) => {
                chokidar.watch(process.cwd()).on("all", (event, _path, stats) => {
                    if (event === "addDir" || event === "add") return false
                    if (!_path || _path === '') return false

                    const relativePath = path.relative(process.cwd(), _path)

                    if (path.parse(_path).base === PROJECT_RIO_CLASS_FILE || Ignore.isIgnored(relativePath))
                        return false

                    process.stdout.clearLine(-1)
                    process.stdout.clearLine(0)
                    process.stdout.clearLine(1)
                    process.stdout.cursorTo(0)
                    process.stdout.write(`${chalk.bold.gray(relativePath) + ' ' + chalk.bold.greenBright(count)} `)
                    ProjectManager.generateAndSaveRioFiles().then(d => {
                        process.stdout.write(chalk.bold.greenBright('Done'))
                    }).catch(e => {
                        console.error(e)
                    })
                    ++count
                })
            })
        }

        await tasks.run()

        afterCommand()

    }
} as CommandModule<Input, Input>

