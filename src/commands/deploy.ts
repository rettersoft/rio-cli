import { GlobalInput } from "./ICommand";
import chalk from "chalk";
import { ConsoleMessage } from "../lib/v1/ConsoleMessage";
import prompts from "prompts";
import { IPreDeploymentContext, ProjectManager } from "../lib/v1/ProjectManager";
import { IProjectRioConfig, Project } from "../lib/v1/Project";
import { Deployment } from "../lib/v1/Deployment";
import afterCommand from "./AfterCommand";
import { CommandModule } from "yargs";
import { RIO_CLI_PROJECT_ID_KEY, RIO_CLI_URL } from "../config";
import { Api } from "../lib/Api";
import { CliConfig } from "../lib/CliConfig";
import { deployV2 } from "../lib/v2/deploy";
import { analyze, isChanged, printSummaryV2 } from "../lib/v2/analyze";

interface Input extends GlobalInput {
  force: boolean;
  classes?: string[];
  "project-id": string;
  "ignore-approval": boolean;
  "skip-diff-check": boolean;
}

function addAsterisks(string: string): string {
  const totalLength = 60;
  const line = "*".repeat(string.length);
  const remainingLength = totalLength - string.length;
  const spaces = " ".repeat(remainingLength / 2);
  return `${spaces}${line}${spaces}\n${spaces}${string}${spaces}\n${spaces}${line}${spaces}`;
}

const processDeployV1 = async (api: Api, args: Input) => {
  const start = Date.now()
  console.log(chalk.yellow(`PRE-DEPLOYMENT started...`))
  const deploymentSummary = await ProjectManager.preDeploymentV1(api, args.classes)

  const pre_finish = (Date.now() - start) / 1000
  console.log(chalk.greenBright(`PRE-DEPLOYMENT FINISHED ✅ ${pre_finish} seconds`))

  if (!args["skip-diff-check"] && !Deployment.isChanged(deploymentSummary)) {
    ConsoleMessage.message(chalk.bold.red('No Changes') + chalk.bold.grey(" -> if you want to ignore diff check use '--skip-diff-check' flag"))
    process.exit()
  }

  /**
   * MANUAL-APPROVAL
   */
  if (!args['ignore-approval']) {
    const response = await prompts({
      type: 'confirm',
      name: 'value',
      message: `Are you sure to proceed?`,
      initial: true,
    })
    if (!response.value) {
      ConsoleMessage.message('Deployment cancelled!')
      process.exit()
    }
  }

  ConsoleMessage.message(`${chalk.green('DEPLOYMENT STARTED')}`)
  await Deployment.deploy(api, deploymentSummary, args["skip-diff-check"], args.force)
  const finish = (Date.now() - start) / 1000
  ConsoleMessage.message(chalk.greenBright(`DEPLOYMENT Finished ✅ ${finish} seconds`))
}

const processDeployV2 = async (api: Api, args: Input, projectId: string) => {
  const skipDiff = args["skip-diff-check"]
  const force = args.force

  const start = Date.now()
  console.log(chalk.yellow(addAsterisks(`Gathering information`) + '\n'));

  const analyzationResult = await analyze({
    api, 
    skipDiff, 
    classes: args.classes
  });

  const pre_finish = ((Date.now() - start) / 1000).toFixed(1)

  if (!skipDiff && !isChanged(analyzationResult.comparization)) {
    console.log(chalk.bold.redBright('No Changes') + chalk.bold.grey(" -> if you want to ignore diff check use '--skip-diff-check' flag\n"))
    console.log(chalk.greenBright(addAsterisks(`Gathered information ✅ ${pre_finish} seconds `)))
    process.exit()
  }

  await printSummaryV2(analyzationResult.comparization, skipDiff)
  console.log(chalk.greenBright(addAsterisks(`Gathered information ✅ ${pre_finish} seconds `)))
  
  console.log(chalk.yellow(addAsterisks('Starting deployment') + '\n\n'))

  await deployV2({ 
    api, 
    analyzationResult, 
    force, 
  })
  
  const finish = ((Date.now() - start) / 1000).toFixed(1)
  console.log(chalk.greenBright(addAsterisks(`Deployed ✅ ${finish} seconds `)))
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
    --skip-diff-check: Skip and dont perform difference checks while deploying.
    --disable-ora: Disable ora spinner. (simpler console output for github actions etc...)
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
    yargs.options("skip-diff-check", {
      describe: "This parameter could be used to deploy target classes, even if there have been no changes since the last deployment.  \n Example: rio deploy --skip-diff-check",
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

    const exampleArray = [{ 
      'Profile': args.profile, 
      'Classes': args.classes?.toString() || 'All Classes', 
      'ProjectId': config.projectId, 
      'Endpoint': profile_config.endpoint || RIO_CLI_URL, 
      'Skip Diff Check': args["skip-diff-check"] ? 'Yes' : 'No', 
      'Force': args.force ? 'Yes' : 'No',  }]
    ConsoleMessage.fancyTable(exampleArray, 'Deployment Configuration:')
    
    console.log(chalk.yellow(`API connecting...`));
    const api = await Api.createAPI(profile_config, config.projectId)
    console.log(chalk.greenBright(`API CONNECTED ✅ ${api.v2 ? chalk.gray('v2') : ''}\n\n`));
    
    if (api.v2) {  
      await processDeployV2(api, args, config.projectId)
    } else {
      await processDeployV1(api, args)
    }

    afterCommand()
  },
} as CommandModule<Input, Input>;
