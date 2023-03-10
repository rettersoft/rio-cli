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
import { RIO_CLI_PROJECT_ID_KEY, RIO_CLI_URL } from "../config";
import { stat } from "fs";
import { Api } from "../lib/Api";
import { Transform } from "stream";
import { Console } from "console";
import { CliConfig } from "../lib/CliConfig";

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
    yargs.options("classes", {
      describe: "Filtered classes for deployment",
      type: "array",
    });
    return yargs;
  },
  handler: async (args) => {
    const start = Date.now()
    
    if (args.force) ConsoleMessage.message(chalk.blueBright.bold("FORCED"));

    process.env[RIO_CLI_PROJECT_ID_KEY] = args["project-id"];

    const profile_config = CliConfig.getAdminConfig(args.profile);
    const config = Project.getProjectRioConfig()
    
    const exampleArray = [{ Profile: args.profile, 'Classes': args.classes?.toString() || 'All Classes', ProjectId: config.projectId, Endpoint: profile_config.endpoint || RIO_CLI_URL }]
    ConsoleMessage.fancyTable(exampleArray, 'Deployment Configuration:')

    console.log(chalk.yellow(`API connecting...`));
    const api = await Api.createAPI(profile_config, config.projectId)
    console.log(chalk.greenBright(`API CONNECTED ✅`));
    
    console.log(chalk.yellow(`PRE-DEPLOYMENT started...`));
    const deploymentSummary = await ProjectManager.preDeployment(api, args.classes)

    const pre_finish = (Date.now() - start) / 1000
    console.log(chalk.greenBright(`PRE-DEPLOYMENT FINISHED ✅ ${pre_finish} seconds`));
    
    if (!args.force && !Deployment.isChanged(deploymentSummary)) {
      if (args["fail-no-changes"]) {
        throw new Error("No Changes");
      } else {
        ConsoleMessage.message(chalk.bold.greenBright("No Changes"));
        process.exit();
      }
    }

    if (args["verbose"])
      ConsoleMessage.message(JSON.stringify(deploymentSummary, null, 2));

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
      `${chalk.greenBright.bold(config.projectId)} ${chalk.green(
        "DEPLOYMENT STARTED"
      )}`
    );
    await Deployment.deploy(api, deploymentSummary, args.force);
    const finish = (Date.now() - start) / 1000
    ConsoleMessage.message(chalk.greenBright(`DEPLOYMENT Finished ✅ ${finish} seconds`));

    afterCommand()
  },
} as CommandModule<Input, Input>;
