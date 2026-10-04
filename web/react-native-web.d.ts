// react-native-web mirrors react-native's API, except that it runs
// applications in DOM elements.
declare module 'react-native-web' {
  import type { ComponentProvider } from 'react-native';

  export * from 'react-native';

  export const AppRegistry: {
    registerComponent(appKey: string, getComponent: ComponentProvider): string;
    runApplication(
      appKey: string,
      appParameters: { rootTag: HTMLElement | null; initialProps?: object },
    ): void;
  };
}
