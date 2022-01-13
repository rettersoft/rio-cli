import {GlobalInput, ICommand} from "./ICommand";
import {CliConfig} from "../lib/CliConfig";
import {RIO_CLI_DEFAULT_ADMIN_PROFILE_NAME} from "../config";
import chalk from "chalk";
import {ConsoleMessage} from "../lib/ConsoleMessage";
import afterCommand from "./AfterCommand";


interface Input extends GlobalInput {
    "profile-name": string,
    "secret-id": string,
    "secret-key": string
}

module.exports = {
    command: 'set-profile',
    description: `Upsert admin profile in local storage
    Usage: rio set-profile --profile-name PROFILE_NAME --secret-id SECRET_ID --secret-key SECRET_KEY
    `,
    builder: yargs => {
        yargs.options('profile-name', {
            describe: 'Profile Name',
            type: 'string',
            default: RIO_CLI_DEFAULT_ADMIN_PROFILE_NAME
        })
        yargs.options('secret-id', {describe: 'Secret Id', type: 'string', demandOption: true})
        yargs.options('secret-key', {describe: 'Secret Key', type: 'string', demandOption: true})
    },
    handler: async (args) => {
        CliConfig.upsertAdminProfile({
            secretId: args["secret-id"], secretKey: args["secret-key"], profileName: args["profile-name"],
        })
        ConsoleMessage.message(chalk.green(`successfully saved [${args["profile-name"]}]`))

        afterCommand()
    }
} as ICommand<Input, Input>

