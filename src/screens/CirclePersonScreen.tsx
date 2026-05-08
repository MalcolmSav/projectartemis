import React, { useEffect, useState } from 'react';
import { ScrollView, View, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Text, Eyebrow, Avatar, Card, PillButton, Divider, Row } from '../components';
import { IconChevron, IconPhone, IconMessage, IconShield, BowArrow } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';
import { supabase, Profile } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';

export function CirclePersonScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'CirclePerson'>>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', route.params.id).maybeSingle();
      if (!cancelled) {
        setProfile(data ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route.params.id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.colors.forest700} />
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg, padding: t.spacing.pageH, paddingTop: 80 }}>
        <Text variant="body">Profile not found.</Text>
      </View>
    );
  }

  const displayName = profile.name ?? profile.email;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <LinearGradient colors={[t.colors.moonlight, t.colors.ivoryBg]} style={{ paddingTop: 64, paddingBottom: 22 }}>
        <Pressable onPress={() => nav.goBack()} style={{ position: 'absolute', top: 60, left: 22, padding: 6 }}>
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Avatar name={displayName} size={84} status="ok" ring photoUri={profile.avatar_url ?? undefined} />
          <Text style={{ fontFamily: t.type.display, fontSize: 28, marginTop: 12 }}>{displayName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <BowArrow size={14} />
            <Text variant="small" color={t.colors.gold700}>
              Verified circle member
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          <PillButton style={{ flex: 1 }} iconLeft={<IconPhone size={14} color={palette.gold300} />}>
            Call
          </PillButton>
          <PillButton variant="secondary" style={{ flex: 1 }} iconLeft={<IconMessage size={14} color={t.colors.forest700} />}>
            Message
          </PillButton>
          <PillButton variant="secondary" style={{ width: 52 }}>
            <IconShield color={t.colors.forest700} />
          </PillButton>
        </View>

        <Card>
          <Row label="Email" value={profile.email} />
          <Divider />
          {profile.phone ? (
            <>
              <Row label="Phone" value={profile.phone} />
              <Divider />
            </>
          ) : null}
          {profile.bio ? <Row label="Bio" value={profile.bio} /> : null}
        </Card>
      </ScrollView>
    </View>
  );
}
