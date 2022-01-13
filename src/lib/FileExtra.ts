import fse from "fs-extra";

export class FileExtra {

    static getFileContextOrFail(path: string): Buffer {
        const result = fse.readFileSync(path)
        if (!result) throw new Error(`File not found! [${path}]`)
        return result
    }

    static async writeFile(path: string, content: string) {
        await fse.writeFile(path, content)
    }

    static copySync(src: string, dest: string) {
        fse.copySync(src, dest)
    }

}
