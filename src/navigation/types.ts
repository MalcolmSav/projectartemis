export type RootStackParamList = {
  Tabs: undefined;
  CirclePerson: { id: string };
  Chat: { userId: string };
  Conversations: undefined;
  LocationShare: undefined;
  Trip: undefined;
  TripActive: undefined;
  TripFollow: { tripId: string };
  FakeCall: undefined;
  FakeCallIncoming: undefined;
  FakeCallOnCall: undefined;
  WellnessIncoming: { fromName?: string; fromId?: string; checkInId?: string } | undefined;
  AlarmActive: undefined;
  FriendAlarm: { userId: string };
  EmergencyCall: undefined;
  Activity: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
