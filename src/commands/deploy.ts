import afterCommand from "./AfterCommand";
import { CommandModule } from "yargs";
import { RIO_CLI_PROJECT_ID_KEY } from "../config";
import { Input, saveAndDeploy } from "../lib/save-and-deploy";

module.exports = {
  command: "deploy",
  description: `
  Description: Save local changes to the rio cloud and deploy the project.
    Arguments:
    --profile [p]: Profile name for deployment (type: string)
    --project-id [pid]: Project id for deployment (type: string)
    --classes [c]: Filtered classes for deployment (type: array)
    --ignore-approval [i]: Ignore deployment manual approval. 
    --force [f]: Send deployment requests with force parameter to rio.
    --skip-diff-check [s]: Skip and dont perform difference checks while deploying.
  `,    
  aliases: ["d"],
  builder: (yargs) => {
    yargs.options("profile", {
      alias: "p",
      describe: " Profile name for deployment (type: string)",
      type: "string",
    });
    yargs.options("project-id", {
      alias: "pid",
      describe: "Project id for deployment (type: string)",
      type: "string",
    });
    yargs.options("classes", {
      alias: "c",
      describe: "Filtered classes for deployment (type: array)",
      type: "array",
    });
    yargs.options("ignore-approval", {
      alias: "i",
      describe:
        "Ignore deployment manual approval \n Example: rio deploy --ignore-approval",
      default: false,
      boolean: true,
      type: "boolean",
    });
    yargs.options("force", {
      alias: "f",
      describe: "This will be used when pushing deployment requests to RIO, its used for forcing rio to deploy even if class already in a state of deployment, \n Example: rio deploy --force",
      default: false,
      boolean: true,
      type: "boolean",
    });
    yargs.options("skip-diff-check", {
      alias: "s",
      describe: "This parameter could be used to deploy target classes, even if there have been no changes since the last deployment.  \n Example: rio deploy --skip-diff-check",
      default: false,
      boolean: true,
      type: "boolean",
    });
    return yargs;
  },
  handler: async (args) => {

    process.env[RIO_CLI_PROJECT_ID_KEY] = args["project-id"];
    
     // Only difference with 'save' is this line:
     args["save-only"] = false;
         
     await saveAndDeploy(args)

    afterCommand()
  },
} as CommandModule<Input, Input>;
