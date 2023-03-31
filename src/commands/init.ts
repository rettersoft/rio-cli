import {GlobalInput} from "./ICommand";
import chalk from "chalk";
import fs from "fs";
import {Repo} from "../lib/Repo";
import {Api} from "../lib/Api";
import path from "path";
import {CustomError} from "../lib/v1/CustomError";
import {CommandModule} from "yargs";
import Listr from "listr";
import {IProjectDetail} from "../Interfaces/IProjectDetail";
import afterCommand from "./AfterCommand";
import {ConsoleMessage} from "../lib/v1/ConsoleMessage";
import { CliConfig } from "../lib/CliConfig";
import { Project } from "../lib/v1/Project";
import { RIO_CLI_URL } from "../config";


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
        yargs.positional('profile', {
            describe: 'CLI profile name',
            type: 'string',
            demandOption: true,
        })
        yargs.options('template', {
            type: 'string',
            default: 'Default',
            describe: 'Cloud objects template name \n Example: rio init --template Default',
        })
        return yargs
    },
    handler: async (args) => {
        if (!args["alias"]) {
            CustomError.throwError(chalk.redBright('alias argument is required'))
        }

        if (fs.existsSync(path.join(process.cwd(), args["alias"]))) {
            CustomError.throwError(`[${chalk.redBright(args["alias"])}] folder already exist`)
        }

        console.log(`[${chalk.greenBright.bold(args["alias"])}] Creating`)

        const profile_config = CliConfig.getAdminConfig(args.profile)

        const exampleArray = [{ Profile: args.profile, alias: args['alias'], Endpoint: profile_config.endpoint || RIO_CLI_URL }]
        ConsoleMessage.fancyTable(exampleArray, 'Deployment Configuration:')

        const api = await Api.createAPI(profile_config)
        const project = await api.createNewProject(args['alias'])

        console.log(`[${chalk.greenBright.bold(args["alias"])}] Preparing Folders`)

        fs.mkdirSync(args["alias"])
        process.chdir(args["alias"])

        console.log(`[${chalk.greenBright.bold(args["alias"])}] Cloning Template`)

        await Repo.downloadAndExtractGitRepo(project.projectId, args.template)

        ConsoleMessage.table([
            ["Project Id", "Alias"],
            [chalk.greenBright.bold(project.projectId), chalk.whiteBright.bold(project.detail.alias)]
        ], "Project")

        afterCommand()
    }
} as CommandModule<Input, Input>

