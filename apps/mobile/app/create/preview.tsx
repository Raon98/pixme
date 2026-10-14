import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import type { PixelStyle } from '@/api';
import { errorMessage } from '@/api/errors';
import { copy } from '@/constants/copy';
import { formatKrw } from '@/lib/format';
import { cropImage } from '@/lib/image';

import { layout, radius, spacing, useTheme } from '@/theme';
import { Button, Chip, Header, Screen, Text, useToast } from '@/ui';
import { useAuthStore, selectEntitlements } from '@/features/auth/authStore';
import { useGenerationStore } from '@/features/generation/generationStore';
import { usePurchase } from '@/features/store/usePurchase';
import { useStoreCatalog } from '@/features/store/useStoreCatalog';

/**
 * Basic is always available; the rest are bought once and then owned. Listed
 * here rather than driven off the store catalog so the picker still renders
 * the full set (locked included) when the catalog request has not landed.
 */
const STYLE_ORDER: PixelStyle[] = [
  'PIXME_BASIC',
  'SOFT_PIXEL',
  'MINI_PIXEL',
  'BIT_16',
  'RETRO_PC',
  'ARCADE',
  'Y2K_PIXEL',
];

/** Portrait 3:4 frame — tall enough for a full body, forgiving for a selfie. */
const FRAME_RATIO = 4 / 3;

/**
 * Photo preview and framing.
 *
 * The user drags the photo vertically inside a 3:4 frame; we crop to exactly
 * what they see. Framing is a *suggestion*, never a requirement — the product
 * explicitly accepts selfies, so there is no "full body required" gate here.
 */
export default function PreviewRoute() {
  const router = useRouter();
  const { colors } = useTheme();

  const draft = useGenerationStore((state) => state.draft);
  const startDraft = useGenerationStore((state) => state.startDraft);
  const setStyle = useGenerationStore((state) => state.setStyle);
  const toast = useToast();
  const entitlements = useAuthStore(selectEntitlements);
  const unlockedStyles = useMemo(
    () => entitlements?.unlockedStyles ?? [],
    [entitlements],
  );
  const refreshUser = useAuthStore((state) => state.refreshUser);

  // `unlockedStyles` only changes in memory when something explicitly calls
  // `refreshUser()` (after a purchase, a profile edit…). A session that's
  // been open a while without hitting one of those can land here holding a
  // stale entitlements snapshot — showing 🔒 on a style already owned, and
  // then genuinely trying to buy it again. Refetch on arrival so the lock
  // state is never older than "whenever I opened this screen".
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // Belt and braces for the same problem: whatever the draft is carrying, a
  // style this account does not own cannot stay selected — the server rejects
  // it at submit, so silently falling back to the house style beats letting
  // someone frame a photo against a style that will fail.
  const draftStyle = draft?.style;
  useEffect(() => {
    if (!draftStyle || draftStyle === 'PIXME_BASIC') return;
    if (!unlockedStyles.includes(draftStyle)) {
      setStyle('PIXME_BASIC');
    }
  }, [draftStyle, setStyle, unlockedStyles]);

  /**
   * A locked style is bought here rather than in the store. Sending someone to
   * the store mid-framing means losing the photo they just set up, and the one
   * thing they wanted was to see *this* photo in *that* style.
   */
  const { catalog } = useStoreCatalog();
  const { buy, pendingProductCode } = usePurchase();
  const [buyingStyle, setBuyingStyle] = useState<PixelStyle | null>(null);

  const styleProduct = useMemo(
    () =>
      buyingStyle
        ? (catalog?.styles.find((item) => item.unlockCode === buyingStyle) ?? null)
        : null,
    [buyingStyle, catalog],
  );

  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  const frameWidth = Math.min(
    Dimensions.get('window').width - layout.gutter * 2,
    layout.maxContentWidth,
  );
  /**
   * How tall the hint line and the wrapped style chips actually are, measured
   * rather than guessed.
   *
   * <p>This used to be a single hand-tuned constant covering everything that
   * isn't the frame. It kept breaking, because the one part of it that is not
   * fixed is exactly the part a constant cannot know: how many rows the style
   * chips wrap onto depends on the rendered width of translated labels. The
   * estimate said two rows, Korean labels wrapped to three, and the last row
   * was painted under the footer. Measuring removes the guess entirely — any
   * number of rows, any language, any font scale.
   */
  const [belowFrameHeight, setBelowFrameHeight] = useState(170);

  /**
   * Only an opening estimate, used for the single frame before the real
   * measurement below lands. Deriving the frame from the window like this was
   * the whole bug: this route is presented as a sheet, so the card is shorter
   * than the window, and every term here (the top inset the sheet doesn't
   * actually clear, the footer's padding) is an assumption about chrome this
   * screen does not own. The frame came out taller than the space it had and,
   * because `styles.body` centres it, overflowed *both* ends — painting over
   * the header title above and the hint below.
   */
  const estimatedBodyHeight =
    Dimensions.get('window').height -
    insets.top -
    layout.headerHeight -
    (layout.buttonHeight * 2 +
      spacing.xs +
      spacing.md +
      Math.max(insets.bottom, spacing.base)) -
    belowFrameHeight;

  /**
   * What the frame area is actually given. `styles.body` is `flex: 1`, so its
   * height is decided by the layout, never by this frame — measuring it is a
   * one-way read with no feedback loop, and it is true on any presentation
   * style, device and font scale.
   */
  const [bodyHeight, setBodyHeight] = useState(0);
  const available = bodyHeight > 0 ? bodyHeight : estimatedBodyHeight;

  /** The photo at frame width — what there actually is to show and pan. */
  const displayHeight = draft
    ? (frameWidth * draft.source.height) / draft.source.width
    : available;

  /**
   * Never taller than the photo itself: a portrait shot less tall than 4:3
   * left an empty band of frame background under it, which reads as a broken
   * image rather than a deliberate letterbox.
   */
  const frameHeight = Math.max(
    1,
    Math.min(frameWidth * FRAME_RATIO, available, displayHeight),
  );

  /** Negative range: how far up the image may be dragged. */
  const minTranslate = Math.min(0, frameHeight - displayHeight);

  const translateY = useSharedValue(minTranslate / 2);
  const startY = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          startY.value = translateY.value;
        })
        .onUpdate((event) => {
          const next = startY.value + event.translationY;
          translateY.value = Math.min(0, Math.max(minTranslate, next));
        }),
    [minTranslate, startY, translateY],
  );

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  /**
   * The sheet stays up, spinner running, until the purchase actually settles
   * — closing it first left several seconds of nothing at all before Apple's
   * own sheet appeared, which read as "the button did nothing". Closing is
   * done in `finally` so no outcome, including a thrown one, can strand it.
   */
  const onConfirmStyleBuy = useCallback(async () => {
    const style = buyingStyle;
    const product = styleProduct;
    if (!style) return;

    // No SKU means the catalog hasn't landed yet; the store is the only place
    // that can resolve it.
    if (!product) {
      setBuyingStyle(null);
      router.push('/store');
      return;
    }

    try {
      const outcome = await buy(product);
      if (outcome.status === 'granted') {
        // `buy` already refreshed entitlements, so the chip unlocks with it.
        setStyle(style);
        toast.show({ message: copy.store.applied, tone: 'success' });
        return;
      }
      if (outcome.status === 'pending') {
        toast.show({ message: copy.store.pending });
        return;
      }
      if (outcome.status === 'cancelled') return;
      toast.show({ message: outcome.message, tone: 'error' });
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    } finally {
      setBuyingStyle(null);
    }
  }, [buy, buyingStyle, router, setStyle, styleProduct, toast]);

  const onConfirm = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    try {
      // Map the on-screen frame back to source pixels.
      const scale = draft.source.height / displayHeight;
      const originY = Math.round(Math.max(0, -translateY.value) * scale);
      const cropHeight = Math.round(
        Math.min(draft.source.height - originY, frameHeight * scale),
      );

      const needsCrop =
        cropHeight > 0 && cropHeight < draft.source.height - 1;

      const image = needsCrop
        ? await cropImage(draft.source.uri, {
            originX: 0,
            originY,
            width: draft.source.width,
            height: cropHeight,
          })
        : draft.source;

      startDraft(image, draft.style);
      router.replace('/create/generating');
    } finally {
      setBusy(false);
    }
  }, [displayHeight, draft, frameHeight, router, startDraft, translateY]);

  if (!draft) {
    // Defensive: a cold start into this route has no photo to show.
    return (
      <Screen>
        <Header title={copy.create.previewTitle} />
        <View style={styles.center}>
          <Text variant="body" tone="secondary" align="center">
            {copy.create.missingPhoto}
          </Text>
          <Button
            label={copy.create.retake}
            fullWidth={false}
            style={styles.retake}
            onPress={() => router.replace('/create')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <>
    <Screen
      footer={
        <View>
          <Button
            label={copy.create.previewCta}
            loading={busy}
            onPress={() => void onConfirm()}
          />
          <Button
            label={copy.create.retake}
            variant="ghost"
            onPress={() => router.replace('/create')}
            style={styles.ghost}
          />
        </View>
      }
    >
      <Header title={copy.create.previewTitle} onBack={() => router.back()} />

      <View
        style={styles.body}
        onLayout={(event) => setBodyHeight(event.nativeEvent.layout.height)}
      >
        <GestureDetector gesture={pan}>
          <View
            style={[
              styles.frame,
              {
                width: frameWidth,
                height: frameHeight,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSubtle,
              },
            ]}
          >
            <Animated.View style={imageStyle}>
              <Image
                source={{ uri: draft.source.uri }}
                style={{ width: frameWidth, height: displayHeight }}
                contentFit="cover"
                accessibilityLabel={copy.a11y.selectedPhoto}
              />
            </Animated.View>

            {/* Framing guide: head area and body area, hinted not enforced. */}
            <View pointerEvents="none" style={styles.guides}>
              <View
                style={[
                  styles.guideLine,
                  { borderColor: colors.borderStrong, top: frameHeight * 0.28 },
                ]}
              />
              <View
                style={[
                  styles.guideLine,
                  { borderColor: colors.borderStrong, top: frameHeight * 0.72 },
                ]}
              />
            </View>
          </View>
        </GestureDetector>
      </View>

      {/*
        A sibling of the frame area, not a child of it. `styles.body` is
        `flex: 1`, so it yields space to this block rather than the other way
        around — which is what makes it structurally impossible for the style
        chips to end up painted underneath the footer, however many rows they
        wrap onto. Its measured height then feeds `belowFrameHeight` so the
        frame takes exactly what is left.
      */}
      <View
        style={styles.belowFrame}
        onLayout={(event) => setBelowFrameHeight(event.nativeEvent.layout.height)}
      >
        <Text variant="caption" tone="secondary" align="center" style={styles.hint}>
          {copy.create.previewHint}
        </Text>

        {/*
          The six paid styles were purchasable and correctly unlocked on the
          server, but nothing in the app ever set `draft.style` — every render
          used the house style. This is where the choice is made.

          Wrapping, not a horizontal ScrollView: on iOS the first tap after a
          scroll is consumed to stop the scroll, so every locked style — all
          of which sat off the right edge — needed two taps to open the buy
          sheet and felt broken. Nothing scrolls here, so every tap counts.
        */}
        <View style={styles.styleRow}>
          {STYLE_ORDER.map((style) => {
            const locked = style !== 'PIXME_BASIC' && !unlockedStyles.includes(style);
            return (
              <Chip
                key={style}
                label={copy.create.styles[style]}
                prefix={locked ? '🔒' : undefined}
                selected={draft.style === style}
                onPress={() => {
                  if (locked) {
                    setBuyingStyle(style);
                    return;
                  }
                  setStyle(style);
                }}
              />
            );
          })}
        </View>
      </View>
    </Screen>

    {/*
      Not `ConfirmDialog`: this whole screen is already a native modal
      (`presentation: 'modal'` on the route), and a second RN `Modal` stacked
      on top of an already-open one silently fails to present on iOS — the
      button looked like it did nothing. A plain absolutely-positioned
      overlay works because we're already inside that modal's own layer.
    */}
    {buyingStyle ? (
      <View style={[StyleSheet.absoluteFill, styles.overlayRoot, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={copy.common.cancel}
          onPress={() => setBuyingStyle(null)}
        />
        <View style={[styles.overlayCard, { backgroundColor: colors.backgroundElevated }]}>
          <Text variant="title3" align="center">
            {copy.create.styleBuyTitle(copy.create.styles[buyingStyle])}
          </Text>
          <Text variant="caption" tone="secondary" align="center" style={styles.overlayBody}>
            {copy.create.styleBuyBody}
          </Text>
          <Button
            label={
              styleProduct
                ? copy.decorations.buyCta(
                    styleProduct.displayPrice || formatKrw(styleProduct.fallbackPriceKrw),
                  )
                : copy.decorations.viewInStore
            }
            loading={pendingProductCode !== null}
            onPress={() => void onConfirmStyleBuy()}
            style={styles.overlayConfirm}
          />
          <Button
            label={copy.common.cancel}
            variant="ghost"
            disabled={pendingProductCode !== null}
            onPress={() => setBuyingStyle(null)}
          />
        </View>
      </View>
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // `overflow: hidden` is the backstop, not the fix: the frame is measured to
  // fit. But this area centres its child, so anything taller than it would
  // spill over the header *and* the hint rather than simply running past one
  // edge, which is a uniquely bad-looking failure. Clip instead.
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  belowFrame: { alignItems: 'center' },
  styleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  frame: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  guides: { ...StyleSheet.absoluteFill },
  guideLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    opacity: 0.4,
  },
  hint: { marginTop: spacing.lg, maxWidth: 300 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retake: { marginTop: spacing.lg, minWidth: 180, alignSelf: 'center' },
  ghost: { marginTop: spacing.xs },
  overlayRoot: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  overlayBody: { marginTop: spacing.md },
  overlayConfirm: { marginTop: spacing.xl },
});
