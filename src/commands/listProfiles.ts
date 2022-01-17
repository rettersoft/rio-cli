import {GlobalInput} from "./ICommand";
import {CliConfig} from "../lib/CliConfig";
import afterCommand from "./AfterCommand";
import chalk from "chalk";
import {ConsoleMessage} from "../lib/ConsoleMessage";
import {CommandModule} from "yargs";

interface Input extends GlobalInput {

}

module.exports = {
    command: 'list-profiles',
    aliases: ['lp'],
    description: 'List local admin profiles',
    handler: () => {

        ConsoleMessage.table([
            ["Profile Name", "Secret"],
            ...CliConfig.listAdminProfiles().map(item => {
                return [chalk.whiteBright(item.name), chalk.gray(item.secretId)]
            })
        ], 'Profiles')

        afterCommand()
    }
} as CommandModule<Input, Input>

