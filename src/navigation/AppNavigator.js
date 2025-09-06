import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import CreatePinScreen from "../screens/CreatePinScreen";
import EnterPinScreen from "../screens/EnterPinScreen";
import MasterScreen from "../screens/MasterScreen";
import EntryScreen from "../screens/EntryScreen";
import PaymentScreen from "../screens/PaymentScreen";
import SummaryScreen from "../screens/SummaryScreen";
import CategorySubcategoryScreen from "../screens/CategorySubcategoryScreen";
import OutboxScreen from "../screens/OutboxScreen";
import LedgerScreen from "../screens/LedgerScreen";
import BackupRestoreScreen from "../screens/BackupRestoreScreen";
import SuggestionsScreen from "../screens/SuggestionsScreen";
import SettingsScreen from "../screens/SettingsScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

import { hasPin } from '../utils/auth';

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = React.useState(null);
  
  React.useEffect(() => {
    (async () => {
      const exists = await hasPin();
      setInitialRoute(exists ? 'EnterPin' : 'CreatePin');
    })();
  }, []);

  if (!initialRoute) return null;

  function MainTabs() {
    return (
      <Tab.Navigator
        initialRouteName="Entry"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#6200ee',
          tabBarInactiveTintColor: '#757575',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.10,
            shadowRadius: 8,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          tabBarItemStyle: {
            borderRadius: 12,
            marginHorizontal: 2,
          },
          animation: 'fade',
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Entry') {
              iconName = focused ? 'add-circle' : 'add-circle-outline';
            } else if (route.name === 'Payment') {
              iconName = focused ? 'cash' : 'cash-outline';
            } else if (route.name === 'Outbox') {
              iconName = focused ? 'mail' : 'mail-outline';
            } else if (route.name === 'Summary') {
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
            } else if (route.name === 'Master') {
              iconName = focused ? 'briefcase' : 'briefcase-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            }
            return <Ionicons name={iconName} size={focused ? size + 2 : size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Entry" component={EntryScreen} />
        <Tab.Screen name="Payment" component={PaymentScreen} />
        <Tab.Screen name="Outbox" component={OutboxScreen} />
        <Tab.Screen name="Summary" component={SummaryScreen} />
        <Tab.Screen name="Master" component={MasterScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName={initialRoute} 
        screenOptions={{ 
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 300,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <Stack.Screen 
          name="CreatePin" 
          component={CreatePinScreen}
          options={{
            animation: 'fade',
            animationDuration: 400,
          }}
        />
        <Stack.Screen 
          name="EnterPin" 
          component={EnterPinScreen}
          options={{
            animation: 'fade',
            animationDuration: 400,
          }}
        />
        <Stack.Screen 
          name="MainTabs" 
          component={MainTabs}
          options={{
            animation: 'slide_from_right',
            animationDuration: 350,
          }}
        />
        <Stack.Screen 
          name="CategorySubcategoryScreen" 
          component={CategorySubcategoryScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen 
          name="LedgerScreen" 
          component={LedgerScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen 
          name="BackupRestoreScreen" 
          component={BackupRestoreScreen}
          options={{
            animation: 'slide_from_bottom',
            animationDuration: 350,
          }}
        />
        <Stack.Screen 
          name="SuggestionsScreen" 
          component={SuggestionsScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen 
          name="SettingsScreen" 
          component={SettingsScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
