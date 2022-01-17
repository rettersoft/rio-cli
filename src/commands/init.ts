import {GlobalInput} from "./ICommand";
import chalk from "chalk";
import {ConsoleMessage} from "../lib/ConsoleMessage";
import fs from "fs";
import {Repo} from "../lib/Repo";
import {Api} from "../lib/Api";
import path from "path";
import {CustomError} from "../lib/CustomError";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";


interface Input extends GlobalInput {
    alias: string,
    template: string,
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
        ConsoleMessage.message(`[${chalk.greenBright.bold(args["alias"])}] Project creating...`)

        if (fs.existsSync(path.join(process.cwd(), args["alias"]))) {
            CustomError.throwError(`[${chalk.redBright(args["alias"])}] folder already exist`)
        }

        const project = await Api.getInstance(args.profile).createNewProject(args["alias"])

        ConsoleMessage.message(`[${chalk.greenBright.bold(args["alias"])}] Project created`)
        console.table({alias: project.detail.alias, projectId: project.projectId})

        // mkdir and chdir to project folder
        fs.mkdirSync(args["alias"])
        process.chdir(args["alias"])

        await Repo.downloadAndExtractGitRepo(project.projectId, args.template)
        afterCommand()

    }
} as CommandModule<Input, Input>

