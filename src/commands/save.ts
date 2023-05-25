import afterCommand from "./AfterCommand";
import { CommandModule } from "yargs";
import { RIO_CLI_PROJECT_ID_KEY } from "../config";
import { Input, saveAndDeploy } from "../lib/save-and-deploy";

module.exports = {
  command: "save",
  description: `
  Description: Save local changes to the rio cloud without deploying them.
    Arguments:
    --profile [p]: Profile name for deployment (type: string)
    --project-id [pid]: Project id for deployment (type: string)
    --classes [c]: Filtered classes for deployment (type: array)
    --skip-diff-check [s]: Skip and dont perform difference checks while deploying.
  `,    
  aliases: ["s"],
  builder: (yargs) => {
    yargs.options("profile", {
      alias: "p",
      describe: " Profile name for deployment (type: string)",
      type: "string",
    });
    yargs.options("project-id", {
      alias: "pid",
      describe: "Project id for Save",
      type: "string",
    });
    yargs.options("classes", {
      alias: "c",
      describe: "Filtered classes for saving",
      type: "array",
    });
    yargs.options("skip-diff-check", {
      alias: "s",
      describe: "This parameter could be used to deploy target classes, even if there have been no changes since the last deployment.  \n Example: rio deploy --skip-diff-check",
      default: false,
      boolean: true,
      type: "boolean",
    });
    yargs.options("ignore-approval", {
      alias: "i",
      describe:
        "Ignore deployment manual approval \n Example: rio deploy --ignore-approval",
      default: false,
      boolean: true,
      type: "boolean",
    });
    return yargs;
  },
  handler: async (args) => {

    process.env[RIO_CLI_PROJECT_ID_KEY] = args["project-id"];
    
    // Only difference with 'deployment' is this line:
    args["save-only"] = true;
        
    await saveAndDeploy(args)
     
    afterCommand()
  },
} as CommandModule<Input, Input>;
