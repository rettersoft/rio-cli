import {DeploymentGlobalInput, GlobalInput} from "./ICommand";
import {ProjectManager} from "../lib/ProjectManager";
import {ConsoleMessage} from "../lib/ConsoleMessage";
import chalk from "chalk";
import {Deployment} from "../lib/Deployment";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";

interface Input extends GlobalInput, DeploymentGlobalInput {

}

module.exports = {
    command: 'pre-deploy',
    aliases: ['pd'],
    description: 'Show deployment changes',
    builder: yargs => {
        yargs.options('classes', {
            describe: 'Filtered classes for deployment',
            type: "array"
        });
        return yargs
    },
    handler: async (args) => {
        ConsoleMessage.message(chalk.bgGray('PRE_DEPLOYMENT_STARTED'))

        console.log(typeof args.classes,args.classes)

        const deploymentSummary = await ProjectManager.preDeployment(args.profile, args.classes)
        if (Deployment.isChanged(deploymentSummary))
            ConsoleMessage.preDeployLog(deploymentSummary)
        else
            ConsoleMessage.message(chalk.bgGray('NO_CHANGES'))
        ConsoleMessage.message(chalk.greenBright('PRE_DEPLOYMENT_DONE'))
        afterCommand()
    }
} as CommandModule<Input, Input>

