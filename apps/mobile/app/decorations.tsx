import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { DecorationItem } from '@/api';
import { errorMessage } from '@/api/errors';
import { copy } from '@/constants/copy';
import { formatKrw } from '@/lib/format';
import { opacity, radius, spacing, useTheme } from '@/theme';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Header,
  HeartBurst,
  Icon,
  ListSkeleton,
  Screen,
  SectionHeader,
  Text,
  useToast,
} from '@/ui';
import {
  BACKGROUNDS,
  burstFor,
  NICKNAMES,
  RENDERABLE_SLOTS,
  SLOT_LABELS,
} from '@/features/decorations/catalog';
import { DecoFrame } from '@/features/decorations/DecoFrame';
import {
  useApplyDecoration,
  useDecorations,
} from '@/features/decorations/useDecorations';
import { useStoreCatalog } from '@/features/store/useStoreCatalog';
import { usePurchase } from '@/features/store/usePurchase';

/**
 * Decorations — pick one item per slot.
 *
 * <p>Items the user cannot use are shown rather than hidden: seeing the thing
 * you don't have yet is the entire reason the store converts. Tapping one goes
 * to the store instead of failing.
 */
export default function DecorationsRoute() {
  const router = useRouter();
  const toast = useToast();

  const decorations = useDecorations();
  const apply = useApplyDecoration();
  const store = useStoreCatalog();
  const { buy, pendingProductCode } = usePurchase();

  /** The item the user tapped but doesn't own yet — drives the buy dialog. */
  const [buying, setBuying] = useState<DecorationItem | null>(null);

  /** Just bought — drives our own "got it, apply now?" dialog. */
  const [justBought, setJustBought] = useState<DecorationItem | null>(null);

  /**
   * A burst slot is the one decoration whose effect cannot be seen by standing
   * still: it only plays when a heart is sent. Replaying it on the tile when
   * the user picks it is the only way a buyer ever gets to look at what they
   * paid for — especially on a quiet day with nobody to send a heart to.
   */
  const [burstPreview, setBurstPreview] = useState<{
    code: string;
    key: number;
  } | null>(null);

  /**
   * Store SKUs keyed by our internal product code. The price shown in the
   * dialog has to be the store's localised one, never the server fallback,
   * or the user is quoted a number the App Store will not charge.
   */
  const productsByCode = useMemo(() => {
    const all = [
      ...(store.catalog?.decorations ?? []),
      ...(store.catalog?.styles ?? []),
    ];
    return new Map(all.map((product) => [product.code, product]));
  }, [store.catalog]);

  const buyingProduct = buying
    ? productsByCode.get(buying.storeProductCode)
    : undefined;

  const onSelect = useCallback(
    (item: DecorationItem, isActive: boolean) => {
      if (!item.owned) {
        // PIXME+-only items have no store SKU of their own, so quoting a price
        // for them is meaningless (it renders as ₩0). The only way to get one
        // is the subscription, so go straight there.
        if (item.plusOnly) {
          router.push('/store/plus');
          return;
        }
        setBuying(item);
        return;
      }
      if (item.slot === 'PARTICLE' && !isActive) {
        setBurstPreview((previous) => ({
          code: item.unlockCode,
          key: (previous?.key ?? 0) + 1,
        }));
      }

      apply.mutate(
        { slot: item.slot, unlockCode: isActive ? null : item.unlockCode },
        {
          onError: (error) =>
            toast.show({ message: errorMessage(error), tone: 'error' }),
        },
      );
    },
    [apply, router, toast],
  );

  const onConfirmBuy = useCallback(async () => {
    const item = buying;
    const product = buyingProduct;
    setBuying(null);
    if (!item) return;

    // No matching SKU means the catalog hasn't loaded or the product isn't
    // configured in the store yet — send them to the store rather than
    // failing silently against a SKU that doesn't exist.
    if (!product) {
      router.push('/store');
      return;
    }

    const outcome = await buy(product);
    if (outcome.status === 'error') {
      toast.show({ message: outcome.message, tone: 'error' });
      return;
    }
    if (outcome.status === 'cancelled') return;
    if (outcome.status === 'pending') {
      toast.show({ message: copy.store.pending });
      return;
    }

    await decorations.refetch();
    // The App Store's own "구입이 완료되었습니다" says a payment went through,
    // not *what the user now owns*. This names the item and offers the one
    // thing they actually wanted next.
    setJustBought(item);
  }, [buy, buying, buyingProduct, decorations, router, toast]);

  if (decorations.isPending) {
    return (
      <Screen edges={['top']}>
        <Header title={copy.store.decorSection} onBack={() => router.back()} />
        <ListSkeleton />
      </Screen>
    );
  }

  // Without this a failed request falls through to the empty state below and
  // tells the user they own nothing, which is a different thing entirely.
  if (decorations.isError) {
    return (
      <Screen edges={['top']}>
        <Header title={copy.store.decorSection} onBack={() => router.back()} />
        <ErrorState
          error={decorations.error}
          onRetry={() => void decorations.refetch()}
        />
      </Screen>
    );
  }

  const items = decorations.data?.items ?? [];
  const active = decorations.data?.active ?? {};

  if (items.length === 0) {
    return (
      <Screen edges={['top']}>
        <Header title={copy.store.decorSection} onBack={() => router.back()} />
        <EmptyState
          glyph="🎨"
          title={copy.decorations.emptyTitle}
          body={copy.decorations.emptyBody}
          actionLabel={copy.decorations.emptyCta}
          onAction={() => router.push('/store')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Header title={copy.store.decorSection} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {RENDERABLE_SLOTS.map((slot) => {
          const slotItems = items.filter((item) => item.slot === slot);
          if (slotItems.length === 0) return null;

          return (
            <View key={slot} style={styles.section}>
              <SectionHeader title={SLOT_LABELS[slot]} />
              <View style={styles.grid}>
                {slotItems.map((item) => (
                  <DecorationTile
                    key={item.unlockCode}
                    item={item}
                    isActive={active[slot] === item.unlockCode}
                    displayPrice={
                      productsByCode.get(item.storeProductCode)?.displayPrice
                    }
                    burstKey={
                      burstPreview?.code === item.unlockCode
                        ? burstPreview.key
                        : 0
                    }
                    onPress={() => onSelect(item, active[slot] === item.unlockCode)}
                  />
                ))}
              </View>
            </View>
          );
        })}

        <Text variant="micro" tone="tertiary" align="center" style={styles.note}>
          {copy.decorations.note}
        </Text>

        <Button
          label={copy.decorations.moreInStore}
          variant="secondary"
          onPress={() => router.push('/store')}
          style={styles.storeCta}
        />
      </ScrollView>

      <ConfirmDialog
        visible={buying !== null}
        title={buying ? copy.decorations.buyTitle(buying.name) : ''}
        body={
          buying
            ? copy.decorations.buyBody(
                buying.description,
                buyingProduct?.displayPrice ??
                  formatKrw(buying.fallbackPriceKrw),
              )
            : ''
        }
        confirmLabel={
          buyingProduct
            ? copy.decorations.buyCta(buyingProduct.displayPrice)
            : copy.decorations.viewInStore
        }
        cancelLabel={copy.common.cancel}
        loading={pendingProductCode !== null}
        onConfirm={() => void onConfirmBuy()}
        onCancel={() => setBuying(null)}
      />

      <ConfirmDialog
        visible={justBought !== null}
        title={justBought ? copy.decorations.boughtTitle(justBought.name) : ''}
        body={copy.decorations.boughtBody}
        confirmLabel={copy.decorations.boughtApply}
        cancelLabel={copy.decorations.boughtLater}
        onConfirm={() => {
          const item = justBought;
          setJustBought(null);
          if (!item) return;
          // Not `onSelect`: the item in hand is the pre-purchase snapshot,
          // still carrying `owned: false`, which would bounce straight back
          // into the buy dialog it just came from.
          if (item.slot === 'PARTICLE') {
            setBurstPreview((previous) => ({
              code: item.unlockCode,
              key: (previous?.key ?? 0) + 1,
            }));
          }
          apply.mutate(
            { slot: item.slot, unlockCode: item.unlockCode },
            {
              onError: (error) =>
                toast.show({ message: errorMessage(error), tone: 'error' }),
            },
          );
        }}
        onCancel={() => setJustBought(null)}
      />
    </Screen>
  );
}

function DecorationTile({
  item,
  isActive,
  displayPrice,
  burstKey = 0,
  onPress,
}: {
  item: DecorationItem;
  isActive: boolean;
  /** Localised store price when the catalog has loaded. */
  displayPrice?: string;
  /** Non-zero replays this tile's burst — see `burstPreview` above. */
  burstKey?: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const burst = burstFor(item.unlockCode);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={copy.a11y.decorationTile(item.name, isActive)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          borderColor: isActive ? colors.accent : colors.border,
          borderWidth: isActive ? 2 : StyleSheet.hairlineWidth,
          backgroundColor: colors.surface,
          opacity: pressed ? opacity.pressed : 1,
        },
      ]}
    >
      <View>
        <Preview item={item} />
        {item.slot === 'PARTICLE' ? (
          <HeartBurst
            trigger={burstKey}
            particles={burst.particles}
            glyph={burst.glyph}
            color={burst.color}
          />
        ) : null}
      </View>

      <View style={styles.tileText}>
        <Text variant="caption" numberOfLines={2} align="center">
          {item.name}
        </Text>
        {item.owned ? (
          <Text variant="micro" tone={isActive ? 'accent' : 'tertiary'}>
            {isActive
              ? copy.decorations.active
              : item.viaPlus
                ? copy.plus.title
                : copy.store.owned}
          </Text>
        ) : item.plusOnly ? (
          <Text variant="micro" tone="accent">
            {copy.plus.title}
          </Text>
        ) : (
          <Text variant="micro" tone="tertiary">
            {displayPrice ?? formatKrw(item.fallbackPriceKrw)}
          </Text>
        )}
      </View>

      {!item.owned ? (
        <View style={[styles.lock, { backgroundColor: colors.surfaceSubtle }]}>
          <Icon name="lock" size={12} color={colors.textTertiary} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** A small swatch of what the item actually does, built from the same table the card renders from. */
function Preview({ item }: { item: DecorationItem }) {
  const { colors } = useTheme();

  if (item.slot === 'BACKGROUND') {
    const style = BACKGROUNDS[item.unlockCode];
    return (
      <View
        style={[
          styles.preview,
          { backgroundColor: style?.colors[1] ?? colors.surfaceSubtle },
        ]}
      >
        <View
          style={[
            styles.previewTop,
            { backgroundColor: style?.colors[0] ?? colors.surfaceSubtle },
          ]}
        />
      </View>
    );
  }

  if (item.slot === 'FRAME') {
    // The real overlay, not an approximation of it — corner blocks and the
    // inset line are most of what distinguishes one frame from another.
    return (
      <View style={[styles.preview, { backgroundColor: colors.surfaceSubtle }]}>
        <DecoFrame code={item.unlockCode} radius={radius.md} />
      </View>
    );
  }

  if (item.slot === 'NICKNAME') {
    const style = NICKNAMES[item.unlockCode];
    return (
      <View style={[styles.preview, { backgroundColor: colors.surfaceSubtle }]}>
        <Text
          variant="caption"
          style={
            style
              ? {
                  textShadowColor: style.glow,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: style.radius,
                  ...(style.color ? { color: style.color } : null),
                }
              : null
          }
        >
          {copy.decorations.nicknameSample}
        </Text>
      </View>
    );
  }

  if (item.slot === 'PARTICLE') {
    // A frozen frame of the burst: the same marks, at the same spread, so
    // "별 연출" and "하트 연출" are told apart at a glance.
    const burst = burstFor(item.unlockCode);
    return (
      <View style={[styles.preview, { backgroundColor: colors.surfaceSubtle }]}>
        {burst.particles.slice(0, 5).map((particle, index) => (
          <View
            key={index}
            style={{
              position: 'absolute',
              transform: [
                { translateX: particle.dx * 0.42 },
                { translateY: particle.dy * 0.42 + 14 },
              ],
            }}
          >
            <Icon
              name={burst.glyph === 'star' ? 'star-filled' : 'heart-filled'}
              size={particle.size * 0.5}
              color={burst.color ?? colors.heart}
            />
          </View>
        ))}
      </View>
    );
  }

  return <View style={[styles.preview, { backgroundColor: colors.surfaceSubtle }]} />;
}

const styles = StyleSheet.create({
  content: { padding: spacing.base, paddingBottom: spacing.xxxl },
  section: { marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '31%',
    borderRadius: radius.lg,
    padding: spacing.sm,
    alignItems: 'center',
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%' },
  previewChip: { width: '55%', height: '35%', borderRadius: radius.sm },
  tileText: { marginTop: spacing.xs, alignItems: 'center' },
  lock: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { marginTop: spacing.sm, marginBottom: spacing.base },
  storeCta: { marginTop: spacing.xs },
});
