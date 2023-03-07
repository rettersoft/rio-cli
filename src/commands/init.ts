import {GlobalInput} from "./ICommand";
import chalk from "chalk";
import fs from "fs";
import {Repo} from "../lib/Repo";
import {Api} from "../lib/Api";
import path from "path";
import {CustomError} from "../lib/CustomError";
import {CommandModule} from "yargs";
import Listr from "listr";
import {IProjectDetail} from "../Interfaces/IProjectDetail";
import afterCommand from "./AfterCommand";
import {ConsoleMessage} from "../lib/ConsoleMessage";


interface Input extends GlobalInput {
    alias: string,
    template: string,
}

interface TaskContext {
    project: { projectId: string, detail: IProjectDetail }
}

module.exports = {
    command: 'init [alias]',
    aliases: ['i'],
    description: `Create a new project
    Usage: init [alias]`,
    builder: yargs => {
        yargs.positional('alias', {
            describe: 'Project alias',
            type: 'string',
            demandOption: true
        })
        yargs.options('template', {
            type: 'string',
            default: 'Default',
            describe: 'Cloud objects template name \n Example: rio init --template Default',
        })
        return yargs
    },
    handler: async (args) => {
        if (fs.existsSync(path.join(process.cwd(), args["alias"]))) {
            CustomError.throwError(`[${chalk.redBright(args["alias"])}] folder already exist`)
        }

        // const tasks = new Listr([
        //     {
        //         title: 'Project Initialization',
        //         task: () => {
        //             return new Listr([
        //                 {
        //                     title: `[${chalk.greenBright.bold(args["alias"])}] Creating`,
        //                     task: async (ctx: TaskContext) => {
        //                         ctx.project = await Api.getInstance(args.profile).createNewProject(args["alias"])
        //                     }
        //                 },
        //                 {
        //                     title: `[${chalk.greenBright.bold(args["alias"])}] Preparing Folders`,
        //                     task: async (ctx: TaskContext) => {
        //                         // mkdir and chdir to project folder
        //                         fs.mkdirSync(args["alias"])
        //                         process.chdir(args["alias"])
        //                     }
        //                 },
        //                 {
        //                     title: `[${chalk.greenBright.bold(args["alias"])}] Cloning Template`,
        //                     task: async (ctx: TaskContext) => {
        //                         await Repo.downloadAndExtractGitRepo(ctx.project.projectId, args.template)
        //                     }
        //                 }
        //             ])
        //         }
        //     }
        // ])

        // const ctx: TaskContext = await tasks.run()

        // ConsoleMessage.table([
        //     ["Project Id", "Alias"],
        //     [chalk.greenBright.bold(ctx.project.projectId), chalk.whiteBright.bold(ctx.project.detail.alias)]
        // ], "Project")

        afterCommand()
    }
} as CommandModule<Input, Input>

