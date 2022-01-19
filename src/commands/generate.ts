import {GlobalInput} from "./ICommand";
import {ProjectManager} from "../lib/ProjectManager";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";
import Listr from "listr";

interface Input extends GlobalInput {

}

interface TaskContext {

}


module.exports = {
    command: 'generate',
    description: `Generate rio class files
     Usage: rio generate`,
    aliases: ['g'],
    handler: async () => {
        const tasks = new Listr([
            {
                title: 'Generate & Save Rio Files',
                task: async (ctx: TaskContext) => {
                    await ProjectManager.generateAndSaveRioFiles()
                }
            }
        ])

        await tasks.run()

        afterCommand()

    }
} as CommandModule<Input, Input>

