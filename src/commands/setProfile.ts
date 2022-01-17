import {GlobalInput} from "./ICommand";
import {CliConfig} from "../lib/CliConfig";
import {RIO_CLI_DEFAULT_ADMIN_PROFILE_NAME} from "../config";
import chalk from "chalk";
import {ConsoleMessage} from "../lib/ConsoleMessage";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";


interface Input extends GlobalInput {
    "profile-name": string,
    "secret-id": string,
    "secret-key": string,
    "no-auth-dump": boolean
}

module.exports = {
    command: 'set-profile',
    aliases: ['sp'],
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
        yargs.options('no-auth-dump', {describe: 'Close authentication info', type: "boolean", default: false})
        return yargs
    },
    handler: async (args) => {
        CliConfig.upsertAdminProfile({
            secretId: args["secret-id"], secretKey: args["secret-key"], profileName: args["profile-name"], noAuthDump: args["no-auth-dump"]
        })
        ConsoleMessage.message(chalk.green(`successfully saved [${args["profile-name"]}]`))
        afterCommand()
    }
} as CommandModule<Input, Input>

