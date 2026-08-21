import { AppRegistry } from 'react-native';
import App from '../App';

const appName = 'ChatGPTFrontend';

AppRegistry.registerComponent(appName, () => App);

const rootTag = document.getElementById('root');

if (rootTag) {
  AppRegistry.runApplication(appName, {
    initialProps: {},
    rootTag: rootTag as any,
  });
}
