import {GlobalInput, ICommand} from "./ICommand";
import chalk from "chalk";
import {ConsoleMessage} from "../lib/ConsoleMessage";
import prompts from "prompts";
import {ProjectManager} from "../lib/ProjectManager";
import {Project} from "../lib/Project";
import {Deployment} from "../lib/Deployment";

interface Input extends GlobalInput {
    "approval-required": boolean
}

module.exports = {
    command: 'deploy',
    description: 'Deploy the project',
    builder: yargs => {
        yargs.options('approval-required', {
            describe: 'Deployment manual approval is required \n Example: rio deploy --approval-required false',
            default: true,
            boolean: true,
            type: "boolean"
        });
    },
    handler: async (args) => {
        ConsoleMessage.message(`PROFILE: ${chalk.greenBright.bold(args.profile)}`)

        const projectRioConfig = Project.getProjectRioConfig()

        const deploymentSummary = await ProjectManager.preDeployment(args.profile)

        if (Deployment.isChanged(deploymentSummary)) {
            ConsoleMessage.preDeployLog(deploymentSummary)
        } else {
            ConsoleMessage.message(chalk.greenBright('NO_CHANGES'))
            process.exit()
        }


        /**
         * MANUAL-APPROVAL
         */
        if (args["approval-required"]) {
            const response = await prompts({
                type: 'confirm',
                name: 'value',
                message: `Are you sure you want to deploy changes the project id ${chalk.greenBright.bold(projectRioConfig.projectId)}`,
                initial: true
            });
            if (!response.value) {
                ConsoleMessage.message(chalk.gray.bold('Deployment cancelled!'))
                process.exit()
            }
        }

        ConsoleMessage.message(chalk.bgGray('DEPLOYMENT_STARTED'))
        await Deployment.deploy(deploymentSummary)
        ConsoleMessage.message(chalk.greenBright('DEPLOYMENT_DONE'))


        
    }
} as ICommand<Input, Input>

