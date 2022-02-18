interface IProjectTemplateMethod {
    inputModel?: string
    outputModel?: string
    errorModel?: string
}

export interface IProjectTemplate {
    methods?: IProjectTemplateMethod[]
    init: IProjectTemplateMethod
    get: IProjectTemplateMethod
}
