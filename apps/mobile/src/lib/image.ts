import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { logger } from './logger';

const log = logger('image');

/**
 * Upload budget. The AI provider only needs enough resolution to read hair,
 * garments and accessories; shipping a 12MP original wastes the user's data
 * and increases how long their most sensitive asset is in flight.
 */
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
  /** bytes, after compression */
  size: number;
  mimeType: string;
}

export type PickerOutcome =
  | { status: 'picked'; image: PickedImage }
  | { status: 'cancelled' }
  | { status: 'permission-denied'; source: 'camera' | 'library' };

async function compress(
  uri: string,
  originalWidth: number,
  originalHeight: number,
): Promise<PickedImage> {
  const longestEdge = Math.max(originalWidth, originalHeight);
  const actions: ImageManipulator.Action[] = [];

  if (longestEdge > MAX_EDGE) {
    actions.push(
      originalWidth >= originalHeight
        ? { resize: { width: MAX_EDGE } }
        : { resize: { height: MAX_EDGE } },
    );
  }

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    size: 0, // filled by the uploader, which already stats the file
    mimeType: 'image/jpeg',
  };
}

/**
 * Camera capture. We allow (and encourage) free-form framing — the product
 * accepts selfies; a full-body shot simply yields a richer outfit.
 */
export async function captureFromCamera(): Promise<PickerOutcome> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return { status: 'permission-denied', source: 'camera' };
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    exif: false, // never carry GPS / device metadata off the device
  });

  if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
  const asset = result.assets[0];
  return {
    status: 'picked',
    image: await compress(asset.uri, asset.width, asset.height),
  };
}

export async function pickFromLibrary(): Promise<PickerOutcome> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { status: 'permission-denied', source: 'library' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    exif: false,
    selectionLimit: 1,
  });

  if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
  const asset = result.assets[0];
  return {
    status: 'picked',
    image: await compress(asset.uri, asset.width, asset.height),
  };
}

/** Applies the user's crop rectangle from the preview screen. */
export async function cropImage(
  uri: string,
  crop: { originX: number; originY: number; width: number; height: number },
): Promise<PickedImage> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop }],
      { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );
    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      size: 0,
      mimeType: 'image/jpeg',
    };
  } catch (error) {
    log.warn('crop failed, falling back to uncropped image', error);
    const info = await ImageManipulator.manipulateAsync(uri, [], {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return {
      uri: info.uri,
      width: info.width,
      height: info.height,
      size: 0,
      mimeType: 'image/jpeg',
    };
  }
}
