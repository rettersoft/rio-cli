import {GlobalInput, ICommand} from "./ICommand";
import chalk from "chalk";
import {ConsoleMessage} from "../lib/ConsoleMessage";
import fs from "fs";
import {Repo} from "../lib/Repo";
import {Api} from "../lib/Api";
import afterCommand from "./AfterCommand";


interface Input extends GlobalInput {
    alias: string,
    template: string,
}

module.exports = {
    command: 'init [alias]',
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
    },
    handler: async (args) => {
        ConsoleMessage.message(`[${chalk.greenBright.bold(args["alias"])}] Project creating...`)

        // mkdir and chdir to project folder
        fs.mkdirSync(args["alias"])
        process.chdir(args["alias"])

        const project = await Api.getInstance(args.profile).createNewProject(args["alias"])

        ConsoleMessage.message(`[${chalk.greenBright.bold(args["alias"])}] Project created`)
        console.table({alias: project.detail.alias, projectId: project.projectId})

        await Repo.downloadAndExtractGitRepo(project.projectId, args.template)

        afterCommand()
    }
} as ICommand<Input, Input>

