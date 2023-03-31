import axios from "axios";
import {PROJECT_RIO_CONFIG, RIO_CLI_COS_TEMPLATES_REPO_NAME} from "../config";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import {FileExtra} from "./v1/FileExtra";
import {Tmp} from "./v1/Tmp";
import {Project} from "./v1/Project";


export class Repo {
    static async downloadAndExtractGitRepo(projectId: string, templateName: string) {
        const response = await axios({
            method: 'get',
            url: `https://github.com/rettersoft/${RIO_CLI_COS_TEMPLATES_REPO_NAME}/archive/refs/heads/main.zip`,
            responseType: 'arraybuffer'
        })

        const dest = Tmp.getUniqueTmpPath()
        const zippedRepoName = RIO_CLI_COS_TEMPLATES_REPO_NAME.concat('-main')
        const zip = new AdmZip(response.data)
        zip.extractAllTo(dest)
        FileExtra.copySync(path.join(dest, zippedRepoName, templateName, '/'), dest)
        fs.rmdirSync(path.join(dest, zippedRepoName), {recursive: true})


        FileExtra.copySync(dest, process.cwd())

        Tmp.clearUniqueTmpPath(dest)


        const projectRioConfig = Project.getProjectRioConfig()
        fs.writeFileSync(path.join(process.cwd(), PROJECT_RIO_CONFIG),
            JSON.stringify(projectRioConfig, null, 2).replace('{{projectId}}', projectId))


    }
}
