declare module "selenium-webdriver" {
  export const Builder: new () => {
    usingServer(url: string): {
      forBrowser(name: string): { build(): Promise<ThenableWebDriver> };
    };
  };
  export type ThenableWebDriver = {
    get(url: string): Promise<void>;
    executeScript(script: string): Promise<unknown>;
    quit(): Promise<void>;
  };
}
