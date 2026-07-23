import React, { useState } from 'react';
import { View, Pressable, TextInput, ScrollView, Alert } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Text, Eyebrow } from './Text';
import { PillButton } from './PillButton';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/ThemeProvider';
import { useT } from '../i18n';
import { palette } from '../theme/tokens';
import { useGroups, CircleGroup } from '../hooks/useGroups';
import { personName } from '../lib/person';
import type { CircleMember } from '../hooks/useCircle';

/**
 * Create and manage circle groups ("Family", "Roommates"). A group bundles
 * circle members so a whole group can follow a trip in one tap.
 */
export function GroupsSheet({
  visible,
  onClose,
  members,
}: {
  visible: boolean;
  onClose: () => void;
  members: CircleMember[];
}) {
  const t = useTheme();
  const tr = useT();
  const { groups, createGroup, setMembers, renameGroup, deleteGroup } = useGroups();

  // null = list view; 'new' = create; a group = edit that group.
  const [editing, setEditing] = useState<CircleGroup | 'new' | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const openNew = () => {
    setEditing('new');
    setName('');
    setSelected([]);
  };
  const openEdit = (g: CircleGroup) => {
    setEditing(g);
    setName(g.name);
    setSelected(g.memberIds);
  };
  const closeEdit = () => setEditing(null);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    if (editing === 'new') {
      await createGroup(name, selected);
    } else if (editing) {
      if (name.trim() !== editing.name) await renameGroup(editing.id, name);
      await setMembers(editing.id, selected);
    }
    setBusy(false);
    closeEdit();
  };

  const confirmDelete = (g: CircleGroup) => {
    Alert.alert(tr('Delete group?'), tr('“{name}” will be removed. Members stay in your circle.', { name: g.name }), [
      { text: tr('Cancel'), style: 'cancel' },
      { text: tr('Delete'), style: 'destructive', onPress: async () => { await deleteGroup(g.id); closeEdit(); } },
    ]);
  };

  return (
    <BottomSheet visible={visible} onClose={editing ? closeEdit : onClose}>
      {editing ? (
        <View>
          <Text style={{ fontFamily: t.type.display, fontSize: 22, lineHeight: 28, marginBottom: 14 }}>
            {editing === 'new' ? tr('New group') : tr('Edit group')}
          </Text>
          <Eyebrow style={{ marginBottom: 6 }}>{tr('NAME')}</Eyebrow>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={tr('e.g. Family')}
            placeholderTextColor={t.colors.inkMute}
            style={{
              backgroundColor: t.colors.moonlight,
              borderRadius: t.radii.md,
              padding: 14,
              fontFamily: t.type.body,
              color: t.colors.ink,
              marginBottom: 16,
            }}
          />
          <Eyebrow style={{ marginBottom: 8 }}>{tr('MEMBERS')}</Eyebrow>
          <ScrollView style={{ maxHeight: 260 }}>
            {members.map((m) => {
              const on = selected.includes(m.profile.id);
              return (
                <Pressable
                  key={m.edgeId}
                  onPress={() => toggle(m.profile.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
                >
                  <Avatar name={personName(m.profile)} size={36} photoUri={m.profile.avatar_url ?? undefined} />
                  <Text variant="body" weight="semibold" style={{ flex: 1 }}>
                    {personName(m.profile)}
                  </Text>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: on ? t.colors.forest700 : t.colors.hairline,
                      backgroundColor: on ? t.colors.forest700 : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {on && <Text style={{ color: palette.gold300, fontSize: 13, fontWeight: '700' }}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <PillButton size="lg" block onPress={save} disabled={busy || !name.trim()} style={{ marginTop: 16 }}>
            {busy ? tr('Saving…') : editing === 'new' ? tr('Create group') : tr('Save changes')}
          </PillButton>
          {editing !== 'new' && (
            <PillButton variant="ghost" block style={{ marginTop: 8 }} onPress={() => confirmDelete(editing)}>
              <Text variant="small" weight="semibold" color={t.colors.crimson}>{tr('Delete group')}</Text>
            </PillButton>
          )}
          <PillButton variant="ghost" block style={{ marginTop: 2 }} onPress={closeEdit}>
            {tr('Cancel')}
          </PillButton>
        </View>
      ) : (
        <View>
          <Text style={{ fontFamily: t.type.display, fontSize: 24, lineHeight: 30, marginBottom: 4 }}>
            {tr('Groups')}
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 16 }}>
            {tr('Bundle people so a whole group can follow a trip in one tap.')}
          </Text>

          {groups.length === 0 ? (
            <Text variant="small" color={t.colors.inkMute} style={{ textAlign: 'center', paddingVertical: 20 }}>
              {tr('No groups yet.')}
            </Text>
          ) : (
            <View style={{ gap: 8, marginBottom: 12 }}>
              {groups.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => openEdit(g)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: t.colors.moonlight,
                    borderRadius: t.radii.md,
                    padding: 14,
                  }}
                >
                  <Text variant="body" weight="semibold">{g.name}</Text>
                  <Text variant="meta" color={t.colors.inkMute}>
                    {tr('{n} members', { n: g.memberIds.length })}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <PillButton block onPress={openNew} style={{ marginTop: 4 }}>
            {tr('+ New group')}
          </PillButton>
        </View>
      )}
    </BottomSheet>
  );
}
