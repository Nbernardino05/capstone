import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { Medication } from '../context/OnboardingContext';
import { useAuth } from '../context/AuthContext';

// Auth screens
import LoginScreen from '../screens/LoginScreen';

// Onboarding screens
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import ProfileScreen from '../screens/onboarding/ProfileScreen';
import ConfirmMedsScreen from '../screens/onboarding/ConfirmMedsScreen';
import AddMissingMedicationScreen from '../screens/onboarding/AddMissingMedicationScreen';
import RemindersScreen from '../screens/onboarding/RemindersScreen';

// Main app screens
import HomeScreen from '../screens/HomeScreen';
import TrendsScreen from '../screens/TrendsScreen';
import MedsScreen from '../screens/MedsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import EditMedicationScreen from '../screens/EditMedicationScreen';
import SurveyScreen from '../screens/SurveyScreen';

import { Colors } from '../constants/colors';

export type RootStackParamList = {
  Login: undefined;
  Welcome: undefined;
  Profile: {
    invitationCode: string;
    patientName: string;
    patientEmail: string;
  };
  ConfirmMeds: undefined;
  AddMissingMedication: undefined;
  Reminders: undefined;
  MainTabs: undefined;
  EditMedication: { medication: Medication };
  Survey: undefined;
};

export type TabParamList = {
  Log: undefined;
  Trends: undefined;
  Meds: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Log: { active: 'home', inactive: 'home-outline' },
  Trends: { active: 'bar-chart', inactive: 'bar-chart-outline' },
  Meds: { active: 'medkit', inactive: 'medkit-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.PRIMARY,
        tabBarInactiveTintColor: Colors.DISABLED,
        tabBarStyle: {
          backgroundColor: Colors.SURFACE,
          borderTopColor: Colors.BORDER,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const name = focused ? icons?.active : icons?.inactive;
          return <Ionicons name={name ?? 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Log" component={HomeScreen} />
      <Tab.Screen name="Trends" component={TrendsScreen} />
      <Tab.Screen name="Meds" component={MedsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.BACKGROUND }}>
        <ActivityIndicator size="large" color={Colors.PRIMARY} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      key={token ? 'auth' : 'unauth'}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      {!token ? (
        // Unauthenticated: login + registration flow
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="ConfirmMeds" component={ConfirmMedsScreen} />
          <Stack.Screen name="AddMissingMedication" component={AddMissingMedicationScreen} />
          <Stack.Screen name="Reminders" component={RemindersScreen} />
        </>
      ) : (
        // Authenticated: main app
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="ConfirmMeds" component={ConfirmMedsScreen} />
          <Stack.Screen name="AddMissingMedication" component={AddMissingMedicationScreen} />
          <Stack.Screen name="Reminders" component={RemindersScreen} />
          <Stack.Screen name="EditMedication" component={EditMedicationScreen} />
          <Stack.Screen
            name="Survey"
            component={SurveyScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
