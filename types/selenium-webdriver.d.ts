declare module "selenium-webdriver" {
  type BuilderInstance = {
    usingServer(url: string): BuilderInstance;
    forBrowser(name: string): BuilderInstance;
    withCapabilities(capabilities: Record<string, unknown>): BuilderInstance;
    build(): Promise<ThenableWebDriver>;
  };
  export const Builder: new () => BuilderInstance;
  export type ThenableWebDriver = {
    get(url: string): Promise<void>;
    executeScript(script: string): Promise<unknown>;
    takeScreenshot(): Promise<string>;
    quit(): Promise<void>;
  };
}
