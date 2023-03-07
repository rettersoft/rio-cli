import { DeploymentGlobalInput, GlobalInput } from "./ICommand";
import chalk from "chalk";
import { ConsoleMessage } from "../lib/ConsoleMessage";
import prompts from "prompts";
import { IPreDeploymentContext, ProjectManager } from "../lib/ProjectManager";
import { IProjectRioConfig, Project } from "../lib/Project";
import { Deployment } from "../lib/Deployment";
import afterCommand from "./AfterCommand";
import { CommandModule } from "yargs";
import Listr from "listr";
import { RIO_CLI_PROJECT_ID_KEY } from "../config";

interface Input extends GlobalInput, DeploymentGlobalInput {
  "ignore-approval": boolean;
  "fail-no-changes": boolean;
  verbose: boolean;
}

interface TaskContext {
  config: IProjectRioConfig;
  deploymentSummary: IPreDeploymentContext;
}

module.exports = {
  command: "deploy",
  description: "Deploy the project",
  aliases: ["d"],
  builder: (yargs) => {
    yargs.options("project-id", {
      describe: "Project id for deployment",
      type: "string",
    });
    yargs.options("verbose", {
      describe: "Show change-set",
      type: "boolean",
      boolean: false,
    });
    yargs.options("fail-no-changes", {
      describe: "Fail on no changes",
      type: "boolean",
      boolean: true,
    });
    yargs.options("ignore-approval", {
      describe:
        "Ignore deployment manual approval \n Example: rio deploy --ignore-approval",
      default: false,
      boolean: true,
      type: "boolean",
    });
    yargs.options("force", {
      describe: "Force the deployment \n Example: rio deploy --force",
      default: 0,
      number: true,
      type: "number",
    });
    yargs.options("parallel", {
      describe: "Parallel deployment \n Example: rio deploy --parallel",
      boolean: true,
      default: false,
      type: "boolean",
    });
    yargs.options("classes", {
      describe: "Filtered classes for deployment",
      type: "array",
    });
    return yargs;
  },
  handler: async (args) => {
    const start = Date.now();
    
    if (args.force) ConsoleMessage.message(chalk.blueBright.bold("FORCED"));

    process.env[RIO_CLI_PROJECT_ID_KEY] = args["project-id"];

    const preTasks = new Listr([
      {
        title: "Prepare",
        task: () => {
          return new Listr([
            {
              title: "Getting Config",
              task: async (ctx: TaskContext) => {
                ctx.config = Project.getProjectRioConfig();
              },
            },
            {
              title: "Preparing Deployment Summary",
              task: async (ctx: TaskContext) => {
                ctx.deploymentSummary = await ProjectManager.preDeployment(
                  args.profile,
                  args.classes
                );
              },
            },
          ]);
        },
      },
    ]);

    const ctx: TaskContext = await preTasks.run();

    if (!args.force && !Deployment.isChanged(ctx.deploymentSummary)) {
      if (args["fail-no-changes"]) {
        throw new Error("No Changes");
      } else {
        ConsoleMessage.message(chalk.bold.greenBright("No Changes"));
        process.exit();
      }
    }

    if (args["verbose"])
      ConsoleMessage.message(JSON.stringify(ctx.deploymentSummary, null, 2));

    /**
     * MANUAL-APPROVAL
     */
    if (!args["ignore-approval"]) {
      const response = await prompts({
        type: "confirm",
        name: "value",
        message: `Are you sure to proceed?`,
        initial: true,
      });
      if (!response.value) {
        ConsoleMessage.message("Deployment cancelled!");
        process.exit();
      }
    }

    ConsoleMessage.message(
      `${chalk.greenBright.bold(ctx.config.projectId)} ${chalk.green(
        "DEPLOYMENT STARTED"
      )}`
    );
    await Deployment.deploy(ctx.deploymentSummary, args.force, args.parallel);
    const finish = (Date.now() - start) / 1000
    ConsoleMessage.message(chalk.greenBright(`DEPLOYMENT FINISHED in ${finish} seconds`));

    afterCommand();
  },
} as CommandModule<Input, Input>;
