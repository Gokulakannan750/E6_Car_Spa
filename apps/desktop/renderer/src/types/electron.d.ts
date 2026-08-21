export interface ElectronAPI {
 getVersion: () => Promise<string>;
 getPath: (name: string) => Promise<string>;
}

declare global {
 interface Window {
 electronAPI: ElectronAPI;
}
}

export {};
