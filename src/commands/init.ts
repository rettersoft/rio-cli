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
import { RIO_CLI_URL, RIO_CLI_VERSION } from "../config";


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
    Usage: init --alias <project_alias> --profile <profile_name>`,
    builder: yargs => {
        yargs.positional('alias', {
            alias: "a",
            describe: 'Project alias',
            type: 'string',
            demandOption: true
        })
        yargs.positional('profile', {
            alias: "p",
            describe: 'CLI profile name',
            type: 'string',
            demandOption: true,
        })
        return yargs
    },
    handler: async (args) => {
        const { alias, profile } = args
        if (!alias) {
            CustomError.throwError(chalk.redBright('--alias argument is required'))
        }

        if (!profile) {
            CustomError.throwError(chalk.redBright('--profile argument is required'))
        }

        if (fs.existsSync(path.join(process.cwd(), args["alias"]))) {
            CustomError.throwError(`[${chalk.redBright(args["alias"])}] folder already exist`)
        }

        console.log(`[${chalk.greenBright.bold(args["alias"])}] Creating`)

        const profile_config = CliConfig.getAdminConfig(profile)

        const exampleArray = [{ "CLI Version": RIO_CLI_VERSION, Profile: profile, ProjetName: alias, Endpoint: profile_config.endpoint,  }]
        ConsoleMessage.fancyTable(exampleArray, 'Deployment Configuration:')

        console.log(chalk.yellow(`API connecting...`))
        const api = await Api.createAPI(profile_config)
        console.log(chalk.greenBright(`API CONNECTED ✅ ${api.version ? chalk.gray(`v${api.version}`) : ''}\n\n`))

        const project = await api.createNewProject(alias)

        console.log(`[${chalk.greenBright.bold(alias)}] Preparing Folders`)

        fs.mkdirSync(alias)
        process.chdir(alias)

        console.log(`[${chalk.greenBright.bold(alias)}] Cloning Template`)

        if (api.isV2) 
            await Repo.downloadAndExtractGitRepoV2(profile, alias, project.projectId)
        else
            await Repo.downloadAndExtractGitRepo(project.projectId, args["template"])

        ConsoleMessage.table([
            ["Project Id", "Alias"],
            [chalk.greenBright.bold(project.projectId), chalk.whiteBright.bold(project.detail.alias)]
        ], "Project")

        afterCommand()
    }
} as CommandModule<Input, Input>

