import {GlobalInput} from "./ICommand";
import {ProjectManager} from "../lib/ProjectManager";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";

interface Input extends GlobalInput {

}

module.exports = {
    command: 'generate',
    description: `Generate rio class files
     Usage: rio generate`,
    aliases: ['g'],
    handler: async () => {
        await ProjectManager.generateAndSaveRioFiles()
        afterCommand()

    }
} as CommandModule<Input, Input>

