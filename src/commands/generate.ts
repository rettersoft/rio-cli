import {GlobalInput, ICommand} from "./ICommand";
import {ProjectManager} from "../lib/ProjectManager";
import afterCommand from "./AfterCommand";

interface Input extends GlobalInput {

}

module.exports = {
    command: 'generate',
    description: `Generate rio class files
     Usage: rio generate`,
    handler: async () => {
        await ProjectManager.generateRioFiles()
        afterCommand()

    }
} as ICommand<Input, Input>

