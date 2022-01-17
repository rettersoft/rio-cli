import {GlobalInput} from "./ICommand";
import {ProjectManager} from "../lib/ProjectManager";
import {ConsoleMessage} from "../lib/ConsoleMessage";
import chalk from "chalk";
import {Deployment} from "../lib/Deployment";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";

interface Input extends GlobalInput {

}

module.exports = {
    command: 'pre-deploy',
    aliases: ['pd'],
    description: 'Show deployment changes',
    handler: async (args) => {
        ConsoleMessage.message(chalk.bgGray('PRE_DEPLOYMENT_STARTED'))

        const deploymentSummary = await ProjectManager.preDeployment(args.profile)
        if (Deployment.isChanged(deploymentSummary))
            ConsoleMessage.preDeployLog(deploymentSummary)
        else
            ConsoleMessage.message(chalk.bgGray('NO_CHANGES'))
        ConsoleMessage.message(chalk.greenBright('PRE_DEPLOYMENT_DONE'))
        afterCommand()
    }
} as CommandModule<Input, Input>

