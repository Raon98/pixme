import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';

import { pixelsApi, qk, type PixelCharacter } from '@/api';
import { errorMessage } from '@/api/errors';
import { copy } from '@/constants/copy';
import { radius, spacing, useTheme } from '@/theme';
import {
  Button,
  ConfirmDialog,
  Icon,
  PixelCharacter as PixelCharacterImage,
  Sheet,
  Text,
  useToast,
} from '@/ui';

import { useDeleteCharacter, useSetCurrentPixel } from './useCollection';

export interface CharacterSheetProps {
  character: PixelCharacter | null;
  onClose: () => void;
}

/**
 * Everything you can do with one owned character.
 *
 * <p>The original photo lives here rather than on a day's status screen,
 * because the photo belongs to the character that was made from it, not to
 * any particular day it was worn. It is fetched only on an explicit tap, via
 * a short-lived signed URL that is deliberately never cached to disk — no
 * list or detail response ever carries a working link to someone's photo.
 */
export function CharacterSheet({ character, onClose }: CharacterSheetProps) {
  const { colors } = useTheme();
  const toast = useToast();

  const setCurrentPixel = useSetCurrentPixel();
  const deleteCharacter = useDeleteCharacter();

  const [showOriginal, setShowOriginal] = useState(false);
  const [deleteOriginalPrompt, setDeleteOriginalPrompt] = useState(false);
  const [deletePrompt, setDeletePrompt] = useState(false);

  const characterId = character?.id ?? null;

  const original = useQuery({
    queryKey: qk.pixels.original(characterId ?? 'none'),
    queryFn: () => pixelsApi.originalUrl(characterId!),
    enabled: !!characterId && showOriginal,
    staleTime: 60_000,
    gcTime: 60_000,
  });

  const close = useCallback(() => {
    setShowOriginal(false);
    onClose();
  }, [onClose]);

  const onDeleteOriginal = useCallback(async () => {
    if (!characterId) return;
    try {
      await pixelsApi.deleteOriginal(characterId);
      setShowOriginal(false);
      setDeleteOriginalPrompt(false);
      toast.show({ message: copy.collection.originalDeleted, tone: 'success' });
      close();
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  }, [characterId, close, toast]);

  const onDeleteCharacter = useCallback(() => {
    if (!characterId) return;
    deleteCharacter.mutate(characterId, {
      onSuccess: () => {
        setDeletePrompt(false);
        toast.show({ message: copy.collection.pixelDeleted, tone: 'success' });
        close();
      },
      onError: (error) =>
        toast.show({ message: errorMessage(error), tone: 'error' }),
    });
  }, [characterId, close, deleteCharacter, toast]);

  return (
    <>
      <Sheet visible={!!character} onClose={close}>
        {character ? (
          <View>
            <View
              style={[
                styles.stage,
                { backgroundColor: colors.stage, borderColor: colors.border },
              ]}
            >
              {showOriginal && original.data ? (
                <Image
                  source={{ uri: original.data.url }}
                  style={styles.original}
                  contentFit="cover"
                  cachePolicy="none"
                  accessibilityLabel={copy.a11y.originalPhoto}
                />
              ) : (
                <PixelCharacterImage
                  uri={character.characterImageUrl}
                  size={140}
                  idle
                  accessibilityLabel={copy.a11y.myPixel}
                />
              )}
            </View>

            {character.isCurrent ? (
              <Text variant="caption" tone="accent" align="center" style={styles.badge}>
                {copy.collection.current}
              </Text>
            ) : (
              <Button
                label={copy.collection.switchCta}
                loading={setCurrentPixel.isPending}
                onPress={() =>
                  setCurrentPixel.mutate(character.id, {
                    onSuccess: () => {
                      toast.show({
                        message: copy.collection.switched,
                        tone: 'success',
                      });
                      close();
                    },
                  })
                }
                style={styles.action}
              />
            )}

            {character.hasOriginal ? (
              <>
                <Button
                  label={showOriginal ? copy.my.hideOriginal : copy.my.showOriginal}
                  variant="secondary"
                  size="md"
                  loading={showOriginal && original.isPending}
                  icon={
                    <Icon
                      name={showOriginal ? 'eye-off' : 'eye'}
                      size={16}
                      color={colors.text}
                    />
                  }
                  onPress={() => setShowOriginal((value) => !value)}
                  style={styles.action}
                />
                <Button
                  label={copy.collection.deleteOriginal}
                  variant="ghost"
                  size="sm"
                  onPress={() => setDeleteOriginalPrompt(true)}
                />
              </>
            ) : (
              <Text variant="micro" tone="tertiary" align="center" style={styles.action}>
                {copy.my.originalDeleted}
              </Text>
            )}

            {!character.isCurrent ? (
              <Button
                label={copy.collection.deletePixel}
                variant="ghost"
                size="sm"
                onPress={() => setDeletePrompt(true)}
              />
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <ConfirmDialog
        visible={deleteOriginalPrompt}
        title={copy.collection.deleteOriginalTitle}
        body={copy.collection.deleteOriginalBody}
        confirmLabel={copy.common.delete}
        destructive
        onConfirm={() => void onDeleteOriginal()}
        onCancel={() => setDeleteOriginalPrompt(false)}
      />

      <ConfirmDialog
        visible={deletePrompt}
        title={copy.collection.deletePixelTitle}
        body={copy.collection.deletePixelBody}
        confirmLabel={copy.common.delete}
        destructive
        loading={deleteCharacter.isPending}
        onConfirm={onDeleteCharacter}
        onCancel={() => setDeletePrompt(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'center',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.base,
  },
  original: { width: 140, height: 186, borderRadius: radius.md },
  badge: { marginBottom: spacing.base },
  action: { marginBottom: spacing.xs },
});
