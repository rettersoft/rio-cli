import {GlobalInput, ICommand} from "./ICommand";
import {ProjectManager} from "../lib/ProjectManager";

interface Input extends GlobalInput {

}

module.exports = {
    command: 'generate',
    description: `Generate rio class files
     Usage: rio generate`,
    handler: async () => {
        await ProjectManager.generateRioFiles()

        
    }
} as ICommand<Input, Input>

