import {GlobalInput} from "./ICommand";
import {AdminProfileSummary, CliConfig} from "../lib/CliConfig";
import afterCommand from "./AfterCommand";
import chalk from "chalk";
import {ConsoleMessage} from "../lib/ConsoleMessage";
import {CommandModule} from "yargs";
import Listr from "listr";

interface Input extends GlobalInput {

}

interface TaskContext {
    profiles: AdminProfileSummary[]
}

module.exports = {
    command: 'list-profiles',
    aliases: ['lp'],
    description: 'List local admin profiles',
    handler: async () => {

        const tasks = new Listr([
            {
                title: 'Getting Profile',
                task: (ctx: TaskContext) => {
                    ctx.profiles = CliConfig.listAdminProfiles()
                }
            }
        ])

        const ctx: TaskContext = await tasks.run()

        ConsoleMessage.table([
            ["Profile Name", "Secret"],
            ...ctx.profiles.map(item => {
                return [chalk.whiteBright(item.name), chalk.gray(item.secretId)]
            })
        ], 'Profiles')

        afterCommand()
    }
} as CommandModule<Input, Input>

