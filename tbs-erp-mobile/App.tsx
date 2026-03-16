/**
 * Root component cua TBS ERP Mobile
 * Boc AppNavigator trong NavigationContainer
 */
import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {StatusBar} from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default App;
