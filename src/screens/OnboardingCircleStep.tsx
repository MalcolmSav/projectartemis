import React, { useState } from 'react';
import { View, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Text, Eyebrow, PillButton, Avatar, Card, Divider } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { useCircle } from '../hooks/useCircle';
import { supabase, Profile } from '../lib/supabase';
import { personName } from '../lib/person';
import { useT } from '../i18n';

export function OnboardingCircleStep({ onComplete }: { onComplete: () => void }) {
  const t = useTheme();
  const tr = useT();
  const { profile, refreshProfile } = useAuth();
  const { invite } = useCircle();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPeople, setSelectedPeople] = useState<{ profile: Profile; relation: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const search = async (query: string) => {
    if (!query.trim() || !profile) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setErr(null);
    const trimmed = query.trim().toLowerCase();

    // Search by email or username
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${trimmed}%,name.ilike.%${trimmed}%`)
      .neq('id', profile.id)
      .limit(10);

    if (error) setErr(error.message);
    setSearchResults((data ?? []) as Profile[]);
    setSearching(false);
  };

  const addPerson = (person: Profile) => {
    if (!selectedPeople.find(p => p.profile.id === person.id)) {
      setSelectedPeople([...selectedPeople, { profile: person, relation: 'friend' }]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removePerson = (personId: string) => {
    setSelectedPeople(selectedPeople.filter(p => p.profile.id !== personId));
  };

  const updateRelation = (personId: string, relation: string) => {
    setSelectedPeople(selectedPeople.map(p => 
      p.profile.id === personId ? { ...p, relation } : p
    ));
  };

  const save = async () => {
    if (!profile) return;
    setBusy(true);
    setErr(null);

    // Onboarding shouldn't block on invite failures (offline, etc.) — but it
    // also shouldn't silently claim a circle was created when it wasn't.
    const failed: string[] = [];
    try {
      for (const { profile: person, relation } of selectedPeople) {
        const result = await invite(person.email, relation);
        if (result.error) failed.push(personName(person));
      }
    } catch {
      // Individual invite() calls already catch their own errors — this only
      // guards against something unexpected in the loop itself.
    }

    setBusy(false);
    if (failed.length > 0) {
      Alert.alert(
        selectedPeople.length === failed.length ? "Couldn't send invites" : 'Some invites failed',
        `${failed.join(', ')} — you can invite them again from the Circle tab.`,
        [{ text: 'Continue', onPress: onComplete }],
      );
      return;
    }
    onComplete();
  };

  const relationOptions = ['friend', 'family', 'partner', 'colleague', 'other'];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
    >
      <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 70 }} keyboardShouldPersistTaps="handled">
        <Eyebrow style={{ marginBottom: 6 }}>{tr('BUILD YOUR CIRCLE')}</Eyebrow>
        <Text variant="displayH1" style={{ marginBottom: 8 }}>
          {tr('Add people to your')}{' '}
          <Text variant="displayH1" italic accent>
            {tr('circle.')}
          </Text>
        </Text>
        <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 22 }}>
          {tr('Trusted people who can check on you and see what you choose to share. You can add more anytime.')}
        </Text>

        {/* Search Input */}
        <Eyebrow style={{ marginBottom: 6 }}>{tr('FIND BY USERNAME')}</Eyebrow>
        <View style={{ position: 'relative', marginBottom: 22 }}>
          <TextInput
            value={searchQuery}
            onChangeText={(val) => {
              setSearchQuery(val);
              search(val);
            }}
            placeholder={tr('@username or name')}
            placeholderTextColor={t.colors.inkMute}
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle(t)}
          />
          {searching && (
            <View style={{ position: 'absolute', right: 18, top: 14 }}>
              <ActivityIndicator color={t.colors.forest700} size="small" />
            </View>
          )}
        </View>

        {/* Search Results */}
        {searchResults.length > 0 && searchQuery.trim() && (
          <View style={{ marginBottom: 22 }}>
            <Eyebrow style={{ marginBottom: 8 }}>{tr('RESULTS')}</Eyebrow>
            <Card>
              {searchResults.map((person, i) => (
                <View key={person.id}>
                  <Pressable
                    onPress={() => addPerson(person)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                  >
                    <Avatar name={person.name || person.email} size={40} photoUri={person.avatar_url ?? undefined} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text variant="body" weight="semibold">
                        {person.name || person.email}
                      </Text>
                      {person.username && (
                        <Text variant="small" color={t.colors.inkMute}>
                          @{person.username}
                        </Text>
                      )}
                    </View>
                    <Text variant="small" color={t.colors.gold700} weight="semibold">
                      {tr('Add')}
                    </Text>
                  </Pressable>
                  {i < searchResults.length - 1 && <Divider />}
                </View>
              ))}
            </Card>
          </View>
        )}

        {searchQuery.trim() && searchResults.length === 0 && !searching && (
          <Text variant="small" color={t.colors.inkMute} style={{ marginBottom: 22, textAlign: 'center' }}>
            {tr('No one found. Check the spelling or try their display name.')}
          </Text>
        )}

        {/* Selected People */}
        {selectedPeople.length > 0 && (
          <>
            <Eyebrow style={{ marginBottom: 8 }}>{tr('ADDED TO YOUR CIRCLE ({n})', { n: selectedPeople.length })}</Eyebrow>
            <Card style={{ marginBottom: 22 }}>
              {selectedPeople.map((item, i) => (
                <View key={item.profile.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 }}>
                    <Avatar 
                      name={personName(item.profile)} 
                      size={40} 
                      photoUri={item.profile.avatar_url ?? undefined} 
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text variant="body" weight="semibold">
                        {personName(item.profile)}
                      </Text>
                      {item.profile.username && (
                        <Text variant="small" color={t.colors.inkMute}>
                          @{item.profile.username}
                        </Text>
                      )}
                      {/* Relation Selector */}
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {relationOptions.map(rel => (
                          <Pressable
                            key={rel}
                            onPress={() => updateRelation(item.profile.id, rel)}
                            style={{
                              paddingVertical: 4,
                              paddingHorizontal: 10,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: item.relation === rel ? t.colors.gold700 : t.colors.hairline,
                              backgroundColor: item.relation === rel ? t.colors.parchment : 'transparent',
                            }}
                          >
                            <Text 
                              variant="meta" 
                              color={item.relation === rel ? t.colors.gold700 : t.colors.inkMute}
                            >
                              {rel}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <Pressable onPress={() => removePerson(item.profile.id)} hitSlop={8}>
                      <Text variant="small" color={t.colors.crimson} weight="semibold">
                        {tr('Remove')}
                      </Text>
                    </Pressable>
                  </View>
                  {i < selectedPeople.length - 1 && <Divider />}
                </View>
              ))}
            </Card>
          </>
        )}

        {err && (
          <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10 }}>
            {err}
          </Text>
        )}

        <PillButton size="lg" block onPress={save} disabled={busy}>
          {busy ? tr('Adding…') : selectedPeople.length > 0 ? tr('Create Circle') : tr('Skip for Now')}
        </PillButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function inputStyle(t: ReturnType<typeof useTheme>) {
  return {
    backgroundColor: t.colors.parchment,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    fontFamily: t.type.body,
    color: t.colors.ink,
    borderWidth: 1,
    borderColor: t.colors.hairline,
    marginBottom: 14,
  };
}
