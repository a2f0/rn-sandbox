import { AppRegistry } from 'react-native-web';
import App from '../App';
import { name as appName } from '../app.json';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.runApplication(appName, {
  rootTag: document.getElementById('root'),
});
