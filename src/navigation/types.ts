export type RootStackParamList = {
  Tabs: undefined;
  CirclePerson: { id: string };
  Chat: { userId: string };
  Conversations: undefined;
  LocationShare: undefined;
  Trip: undefined;
  TripActive: undefined;
  FakeCall: undefined;
  FakeCallIncoming: undefined;
  FakeCallOnCall: undefined;
  WellnessIncoming: { fromName?: string } | undefined;
  AlarmActive: undefined;
  EmergencyCall: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
