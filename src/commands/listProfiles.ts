import {GlobalInput, ICommand} from "./ICommand";
import {CliConfig} from "../lib/CliConfig";
import afterCommand from "./AfterCommand";

interface Input extends GlobalInput {

}

module.exports = {
    command: 'list-profiles',
    description: 'List local admin profiles',
    handler: () => {
        console.table(CliConfig.listAdminProfiles())

        afterCommand()
    }
} as ICommand<Input, Input>

