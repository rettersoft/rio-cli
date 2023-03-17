import { GlobalInput } from "./ICommand";
import chalk from "chalk";
import { ConsoleMessage } from "../lib/ConsoleMessage";
import prompts from "prompts";
import { IPreDeploymentContext, ProjectManager } from "../lib/ProjectManager";
import { IProjectRioConfig, Project } from "../lib/Project";
import { Deployment } from "../lib/Deployment";
import afterCommand from "./AfterCommand";
import { CommandModule } from "yargs";
import { RIO_CLI_PROJECT_ID_KEY, RIO_CLI_URL } from "../config";
import { Api } from "../lib/Api";
import { CliConfig } from "../lib/CliConfig";

interface Input extends GlobalInput {
  force: boolean;
  classes?: string[];
  "project-id": string;
  "ignore-approval": boolean;
  "skip-diff": boolean;
}

module.exports = {
  command: "deploy",
  description: `
  Description: Deploy the project
    Arguments:
    --project-id: Project id for deployment (type: string)
    --classes: Filtered classes for deployment (type: array)
    --ignore-approval: Ignore deployment manual approval. 
    --force: Send deployment requests with force parameter to rio.
    --skip-diff: Skip and dont perform difference checks.
  `,    
  aliases: ["d"],
  builder: (yargs) => {
    yargs.options("project-id", {
      describe: "Project id for deployment",
      type: "string",
    });
    yargs.options("classes", {
      describe: "Filtered classes for deployment",
      type: "array",
    });
    yargs.options("ignore-approval", {
      describe:
        "Ignore deployment manual approval \n Example: rio deploy --ignore-approval",
      default: false,
      boolean: true,
      type: "boolean",
    });
    yargs.options("force", {
      describe: "This will be used when pushing deployment requests to RIO, its used for forcing rio to deploy even if class already in a state of deployment, \n Example: rio deploy --force",
      default: false,
      boolean: true,
      type: "boolean",
    });
    yargs.options("skip-diff", {
      describe: "This parameter could be used to deploy target classes, even if there have been no changes since the last deployment.  \n Example: rio deploy --skip-diff",
      default: false,
      boolean: true,
      type: "boolean",
    });
    return yargs;
  },
  handler: async (args) => {

    process.env[RIO_CLI_PROJECT_ID_KEY] = args["project-id"];
    
    const profile_config = CliConfig.getAdminConfig(args.profile);
    const config = Project.getProjectRioConfig()
    
    const exampleArray = [{ Profile: args.profile, 'Classes': args.classes?.toString() || 'All Classes', ProjectId: config.projectId, Endpoint: profile_config.endpoint || RIO_CLI_URL, '--skip-diff': args["skip-diff"] ? 'Yes' : 'No', '--force': args.force ? 'Yes' : 'No',  }]
    ConsoleMessage.fancyTable(exampleArray, 'Deployment Configuration:')
    
    console.log(chalk.yellow(`API connecting...`));
    const api = await Api.createAPI(profile_config, config.projectId)
    console.log(chalk.greenBright(`API CONNECTED ✅`));
    
    let deploymentSummary: IPreDeploymentContext
    
    const start = Date.now()

    if (!api.isV2) {
      console.log(chalk.yellow(`PRE-DEPLOYMENT started...`));
      deploymentSummary = await ProjectManager.preDeploymentV1(api, args.classes)
    } else {
      console.log(chalk.yellow(`PRE-DEPLOYMENT V2 started...`));
      deploymentSummary = await ProjectManager.preDeploymentV1(api, args.classes)
    }

    const pre_finish = (Date.now() - start) / 1000
    console.log(chalk.greenBright(`PRE-DEPLOYMENT FINISHED ✅ ${pre_finish} seconds`));
    
    if (!args["skip-diff"] && !Deployment.isChanged(deploymentSummary)) {
        ConsoleMessage.message(chalk.bold.red("No Changes") + chalk.bold.grey(" -> if you want to ignore diff check use '--skip-diff' flag"));
        process.exit();
    }

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
    await Deployment.deploy(api, deploymentSummary, args["skip-diff"], args.force)
    const finish = (Date.now() - start) / 1000
    ConsoleMessage.message(chalk.greenBright(`DEPLOYMENT Finished ✅ ${finish} seconds`));

    afterCommand()
  },
} as CommandModule<Input, Input>;
