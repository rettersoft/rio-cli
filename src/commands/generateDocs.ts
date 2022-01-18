import {GlobalInput} from "./ICommand";
import afterCommand from "./AfterCommand";
import {CommandModule} from "yargs";
import {Tmp} from "../lib/Tmp";
import {FileExtra} from "../lib/FileExtra";
import path from "path";
import {ProjectManager} from "../lib/ProjectManager";
import {ConsoleMessage} from "../lib/ConsoleMessage";
import {PROJECT_GENERATED_DOCS_FOLDER, PROJECT_RIO_CLASS_FILE} from "../config";
import {execSync} from "child_process";

const TypeDoc = require('typedoc');

interface Input extends GlobalInput {
    out: string
    open: boolean
}

module.exports = {
    command: 'generate-docs',
    description: `Generate project docs
     Usage: rio generate-docs`,
    aliases: ['gd'],
    builder: yargs => {
        yargs.options('out', {
            describe: 'Docs output folder',
            default: PROJECT_GENERATED_DOCS_FOLDER,
            type: 'string'
        })
        yargs.options('open', {
            describe: 'Open docs after generate operation',
            default: false,
            type: 'boolean'
        })
        return yargs
    },
    handler: async (args) => {
        ConsoleMessage.message('Docs generating...')
        let compileTmp;
        try {
            compileTmp = Tmp.getUniqueTmpPath()

            const tsConfig = {
                "compilerOptions": {
                    "lib": ["ES2015", "dom"],
                    "module": "commonjs",
                    "target": "es5",
                    "sourceMap": false,
                    "esModuleInterop": true,
                    "moduleResolution": "node",
                    "downlevelIteration": true
                }
            }

            const packageJson = {
                "name": "docs",
                "version": "0.0.1",
                "dependencies": {
                    "@retter/rdk": "^1.0.7",
                    "@types/node": "^17.0.9"
                }
            }


            await FileExtra.writeFile(path.join(compileTmp, PROJECT_RIO_CLASS_FILE),
                (await ProjectManager.generateRioFile()))

            await FileExtra.writeFile(path.join(compileTmp, "tsconfig.json"), JSON.stringify(tsConfig))

            await FileExtra.writeFile(path.join(compileTmp, "package.json"), JSON.stringify(packageJson))

            execSync('npm i --prefix ' + path.join(compileTmp), {stdio: "ignore"})

            const app = new TypeDoc.Application();

            // If you want TypeDoc to load tsconfig.json / typedoc.json files
            app.options.addReader(new TypeDoc.TSConfigReader());
            app.options.addReader(new TypeDoc.TypeDocReader());

            const outputDir = args.out;

            app.bootstrap({
                // typedoc options here
                entryPoints: [path.join(compileTmp, PROJECT_RIO_CLASS_FILE)],
                tsconfig: path.join(compileTmp, "tsconfig.json")
            });

            const project = app.convert();

            if (project) {
                // Project may not have converted correctly

                // Rendered docs
                await app.generateDocs(project, outputDir);
                // Alternatively generate JSON output
                await app.generateJson(project, outputDir + "/documentation.json");
            }
            Tmp.clearUniqueTmpPath(compileTmp)
            ConsoleMessage.message('Docs generated')

            if (args.open) {
                execSync('open ' + path.join(outputDir, 'index.html'))
            }

        } catch (e) {
            if (compileTmp) {
                Tmp.clearUniqueTmpPath(compileTmp)
            }
            throw e
        }
        afterCommand()
    }
} as CommandModule<Input, Input>

