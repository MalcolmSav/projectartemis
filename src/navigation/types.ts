export type RootStackParamList = {
  Tabs: undefined;
  CirclePerson: { id: string };
  LocationShare: undefined;
  Trip: undefined;
  TripActive: undefined;
  FakeCall: undefined;
  FakeCallIncoming: undefined;
  FakeCallOnCall: undefined;
  WellnessIncoming: { fromName?: string } | undefined;
  AlarmActive: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
