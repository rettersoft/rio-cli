import {GlobalInput} from "./ICommand";
import {AdminProfileSummary} from "../lib/CliConfig";
import afterCommand from "./AfterCommand";
import yargs, {CommandModule} from "yargs";

interface Input extends GlobalInput {

}

interface TaskContext {
    profiles: AdminProfileSummary[]
}

module.exports = {
    command: '$0',
    description: 'Default',
    handler: async (args) => {
        yargs.showHelp()
        afterCommand()
    }
} as CommandModule<Input, Input>

