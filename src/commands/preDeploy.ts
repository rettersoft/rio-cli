import {DeploymentGlobalInput, GlobalInput} from "./ICommand";
import {IPreDeploymentContext, ProjectManager} from "../lib/ProjectManager";
import {ConsoleMessage} from "../lib/ConsoleMessage";
import chalk from "chalk";
import {Deployment} from "../lib/Deployment";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";
import Listr from "listr";

interface Input extends GlobalInput, DeploymentGlobalInput {

}

interface TaskContext {
    deploymentSummary: IPreDeploymentContext
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
        yargs.options('force', {
            describe: 'Force the pre-deployment \n Example: rio pre-deploy --force',
            default: false,
            boolean: true,
            type: "boolean"
        });
        return yargs
    },
    handler: async (args) => {

        if (args.classes) {
            ConsoleMessage.table([
                [chalk.blueBright("Selected Classes")],
                ...args.classes.map(c => {
                    return [c]
                })
            ])
        }

        const tasks = new Listr([
            {
                title: 'Pre-Deployment',
                task: async (ctx: TaskContext) => {
                    ctx.deploymentSummary = await ProjectManager.preDeployment(args.profile, args.classes)
                }
            }
        ])

        const ctx: TaskContext = await tasks.run()

        if (args.force || Deployment.isChanged(ctx.deploymentSummary))
            ConsoleMessage.preDeployLog(ctx.deploymentSummary)
        else
            ConsoleMessage.message(chalk.gray.bold('NO_CHANGES'))

        afterCommand()
    }
} as CommandModule<Input, Input>

