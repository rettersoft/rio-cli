export interface IProjectConfig {
    accessTokenSecret: string;
    refreshTokenSecret: string;
}

export interface IProjectRolePermissions {
    sends: string[];
    receives: string[];
}

export interface IProjectRole {
    key: string;
    roleName: string;
    delegatedBy: string[];
    permissions: IProjectRolePermissions;
}

export interface IProjectMember {
    userId: string;
    email: string;
    roleNames: string[];
}

export interface IProjectConfig {
    refreshTokenSecret: string;
    accessTokenSecret: string;
    customTokenSecret: string;
}

export interface IProjectClass {
    classId: string;
}

export interface IProjectDetail {
    members: IProjectMember[];
    projectConfig: IProjectConfig;
    attachedRoles: any[];
    classes: IProjectClass[];
    alias: string;
    envVars: { [key: string]: string };
    modelDefinitions: {[modelName: string]: object};
    projectRoles: IProjectRole[];
}
