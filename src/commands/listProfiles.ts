import {GlobalInput, ICommand} from "./ICommand";
import {CliConfig} from "../lib/CliConfig";

interface Input extends GlobalInput {

}

module.exports = {
    command: 'list-profiles',
    description: 'List local admin profiles',
    handler: () => {
        console.table(CliConfig.listAdminProfiles())

        
    }
} as ICommand<Input, Input>

