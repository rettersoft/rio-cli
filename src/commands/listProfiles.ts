import {GlobalInput} from "./ICommand";
import {AdminProfileSummary, CliConfig} from "../lib/CliConfig";
import afterCommand from "./AfterCommand";
import chalk from "chalk";
import {ConsoleMessage} from "../lib/v1/ConsoleMessage";
import {CommandModule} from "yargs";

interface Input extends GlobalInput {

}

module.exports = {
    command: 'list-profiles',
    aliases: ['lp'],
    description: 'List local admin profiles',
    handler: async () => {

        const profiles: AdminProfileSummary[] = CliConfig.listAdminProfiles()
        console.log(chalk.greenBright('Getting Profile ✅'))

        ConsoleMessage.table([
            ["Profile Name", "Secret", "EndPoint"],
            ...profiles.map(item => {
                return [chalk.whiteBright(item.name), chalk.gray(item.secretId),chalk.gray(item.endpoint || 'Not Configured')]
            })
        ], 'Profiles')

        afterCommand()
    }
} as CommandModule<Input, Input>

