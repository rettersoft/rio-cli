import {GlobalInput} from "./ICommand";
import {AdminProfileSummary} from "../lib/CliConfig";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";
import Listr from "listr";
import {Project} from "../lib/Project";

interface Input extends GlobalInput {

}

interface TaskContext {
    profiles: AdminProfileSummary[]
}

module.exports = {
    command: 'build',
    aliases: ['b'],
    description: 'Build project objects',
    handler: async () => {

        const tasks = new Listr([
            {
                title: 'Building project objects',
                task: async (ctx: TaskContext) => {
                    await Project.build()
                }
            }
        ])

        const ctx: TaskContext = await tasks.run()

        afterCommand()
    }
} as CommandModule<Input, Input>

