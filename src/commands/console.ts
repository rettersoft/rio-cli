import {GlobalInput} from "./ICommand";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";
import {RIO_CLI_ROOT_DOMAIN, RIO_CLI_STAGE} from "../config";
import {execSync} from "child_process";
import {Project} from "../lib/v1/Project";

interface Input extends GlobalInput {
    out: string
    open: boolean
    "include-version": boolean
    "rio-file-path"?: string
}

module.exports = {
    command: 'console',
    description: `Open project console`,
    aliases: ['con'],
    builder: yargs => {
        return yargs
    },
    handler: async (args) => {
        const config = Project.getProjectRioConfig()

        execSync('open ' + `https://${RIO_CLI_STAGE === 'PROD' ? 'c' : 'ct'}.${RIO_CLI_ROOT_DOMAIN}/project/${config.projectId}/Dashboard`)
        afterCommand()
    }
} as CommandModule<Input, Input>

