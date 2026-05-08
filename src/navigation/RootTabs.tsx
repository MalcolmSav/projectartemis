import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Platform } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { MapScreen } from '../screens/MapScreen';
import { CircleScreen } from '../screens/CircleScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { useTheme } from '../theme/ThemeProvider';
import { IconHome, IconMap, IconCircle, IconCal, IconUser } from '../components/icons';
import { palette } from '../theme/tokens';

const Tab = createBottomTabNavigator();

export function RootTabs() {
  const t = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: palette.gold500,
        tabBarInactiveTintColor: t.colors.inkMute,
        tabBarStyle: {
          position: 'absolute',
          left: t.spacing.tabBarEdge,
          right: t.spacing.tabBarEdge,
          bottom: t.spacing.tabBarBottom,
          height: 64,
          paddingTop: t.spacing.tabBarPad,
          paddingBottom: Platform.OS === 'ios' ? 10 : t.spacing.tabBarPad,
          borderRadius: 999,
          backgroundColor: t.colors.parchment,
          borderTopWidth: 0,
          ...t.shadows.card,
        },
        tabBarItemStyle: { borderRadius: 999 },
        tabBarIcon: ({ focused }) => {
          const c = focused ? palette.gold500 : t.colors.inkMute;
          const props = { size: 22, color: c };
          switch (route.name) {
            case 'Home':
              return <IconHome {...props} />;
            case 'Map':
              return <IconMap {...props} />;
            case 'Circle':
              return <IconCircle {...props} />;
            case 'Calendar':
              return <IconCal {...props} />;
            case 'Profile':
              return <IconUser {...props} />;
          }
          return <View />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Circle" component={CircleScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
