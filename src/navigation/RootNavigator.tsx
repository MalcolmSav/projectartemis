import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootTabs } from './RootTabs';
import { RootStackParamList } from './types';
import { CirclePersonScreen } from '../screens/CirclePersonScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { LocationShareScreen } from '../screens/LocationShareScreen';
import { TripSetupScreen } from '../screens/TripSetupScreen';
import { TripActiveScreen } from '../screens/TripActiveScreen';
import { TripFollowScreen } from '../screens/TripFollowScreen';
import { FakeCallSetupScreen } from '../screens/FakeCallSetupScreen';
import { FakeCallIncomingScreen } from '../screens/FakeCallIncomingScreen';
import { FakeCallOnCallScreen } from '../screens/FakeCallOnCallScreen';
import { WellnessIncomingScreen } from '../screens/WellnessIncomingScreen';
import { AlarmActiveScreen } from '../screens/AlarmActiveScreen';
import { FriendAlarmScreen } from '../screens/FriendAlarmScreen';
import { EmergencyCallScreen } from '../screens/EmergencyCallScreen';
import { ActivityScreen } from '../screens/ActivityScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={RootTabs} />
      <Stack.Screen name="CirclePerson" component={CirclePersonScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Conversations" component={ConversationsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="LocationShare" component={LocationShareScreen} />
      <Stack.Screen name="Trip" component={TripSetupScreen} />
      <Stack.Screen name="TripActive" component={TripActiveScreen} />
      <Stack.Screen name="TripFollow" component={TripFollowScreen} />
      <Stack.Screen name="FakeCall" component={FakeCallSetupScreen} />
      <Stack.Screen
        name="FakeCallIncoming"
        component={FakeCallIncomingScreen}
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="FakeCallOnCall"
        component={FakeCallOnCallScreen}
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="WellnessIncoming"
        component={WellnessIncomingScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="AlarmActive"
        component={AlarmActiveScreen}
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="FriendAlarm"
        component={FriendAlarmScreen}
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="EmergencyCall"
        component={EmergencyCallScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Activity" component={ActivityScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}
