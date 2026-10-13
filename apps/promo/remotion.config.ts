import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// 캡처 PNG가 3배율이라 JPEG 품질을 넉넉히.
Config.setJpegQuality(92);
