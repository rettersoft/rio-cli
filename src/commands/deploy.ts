import {DeploymentGlobalInput, GlobalInput} from "./ICommand";
import chalk from "chalk";
import {ConsoleMessage} from "../lib/ConsoleMessage";
import prompts from "prompts";
import {ProjectManager} from "../lib/ProjectManager";
import {Project} from "../lib/Project";
import {Deployment} from "../lib/Deployment";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";

interface Input extends GlobalInput, DeploymentGlobalInput {
    "ignore-approval": boolean
}

module.exports = {
    command: 'deploy',
    description: 'Deploy the project',
    aliases: ['d'],
    builder: (yargs) => {
        yargs.options('ignore-approval', {
            describe: 'Ignore deployment manual approval \n Example: rio deploy --ignore-approval',
            default: false,
            boolean: true,
            type: "boolean"
        });
        yargs.options('force', {
            describe: 'Force the deployment \n Example: rio deploy --force',
            boolean: true,
            default: false,
            type: "boolean"
        });
        yargs.options('classes', {
            describe: 'Filtered classes for deployment',
            type: "array"
        });
        return yargs
    },
    handler: async (args) => {
        if (args.force) ConsoleMessage.message(chalk.blueBright.bold('FORCED'))

        ConsoleMessage.message(`PROFILE: ${chalk.greenBright.bold(args.profile)}`)

        const projectRioConfig = Project.getProjectRioConfig()

        ConsoleMessage.message(`PROJECT_ID: ${chalk.greenBright.bold(projectRioConfig.projectId)}`)

        const deploymentSummary = await ProjectManager.preDeployment(args.profile, args.classes)

        if (Deployment.isChanged(deploymentSummary)) {
            ConsoleMessage.preDeployLog(deploymentSummary)
        } else {
            ConsoleMessage.message(chalk.greenBright('NO_CHANGES'))
            process.exit()
        }


        /**
         * MANUAL-APPROVAL
         */
        if (!args["ignore-approval"]) {
            const response = await prompts({
                type: 'confirm',
                name: 'value',
                message: `Are you sure to proceed?`,
                initial: true
            });
            if (!response.value) {
                ConsoleMessage.message(chalk.gray.bold('Deployment cancelled!'))
                process.exit()
            }
        }

        ConsoleMessage.message(chalk.bgGray('DEPLOYMENT_STARTED'))
        await Deployment.deploy(deploymentSummary, args.force)
        ConsoleMessage.message(chalk.greenBright('DEPLOYMENT_DONE'))

        afterCommand()

    }
} as CommandModule<Input, Input>

