import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import TodosScreen from './src/screens/TodosScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import HomeScreen from './src/screens/HomeScreen';

const Tab = createBottomTabNavigator();

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: '#00e5ff',
    background: '#1a1a2e',
    card: '#0f0f23',
    text: '#e8e8f0',
    border: '#2a2a4a',
    notification: '#ff2d78',
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={DarkTheme}>
        <Tab.Navigator
          initialRouteName="Todos"
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#00e5ff',
            tabBarInactiveTintColor: '#686888',
            tabBarStyle: {
              backgroundColor: '#0f0f23',
              borderTopColor: '#2a2a4a',
              borderTopWidth: 1,
              paddingBottom: 4,
              paddingTop: 4,
              height: 56,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
            },
          }}
        >
          <Tab.Screen
            name="Todos"
            component={TodosScreen}
            options={{
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="checkmark-circle-outline" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Inventory"
            component={InventoryScreen}
            options={{
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="search-outline" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="home-outline" size={size} color={color} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
