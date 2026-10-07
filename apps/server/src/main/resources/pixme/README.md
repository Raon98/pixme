# Master Character Reference

Put the official PIXME character image here:

```
master-character-v1.png
```

That is the file the server sends to the AI provider as **Image B** on every
generation, and the file it measures at startup to fix the character geometry
(height ratio, head ratio, foot baseline, width budget, pixel block size).

## Why it is not committed yet

No placeholder is shipped on purpose. A stand-in image would be *worse* than
nothing: the spec is measured from whatever is here, so a fake reference would
silently fix every character in the product to the wrong proportions. With the
file absent the server logs a loud warning, falls back to the documented
numbers in `CharacterSpec.reference()`, and generates from the prompt alone.

## Requirements

- PNG, square, the character filling most of the frame
- Full body, front-facing, standing, arms down (hands may rest in pockets)
- Any background is fine — the measurement samples the corners and finds the
  character against it, and the prompt explicitly tells the model that the
  reference's background and ground shadow are **not** part of the standard

## After dropping it in

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

The startup log prints the measured spec:

```
Master Character Reference 'PIXME_MASTER_V1' loaded (… bytes); measured spec:
CharacterSpec[canvasSize=1024, characterHeightRatio=0.93, …]
```

Check those numbers look right before shipping — every character in the app
will be conformed to them by `CharacterNormalizer`.

## Changing it later

Bump both the filename and the version:

```
master-character-v2.png
PIXME_MASTER_REFERENCE=classpath:pixme/master-character-v2.png
PIXME_MASTER_REFERENCE_VERSION=PIXME_MASTER_V2
```

Every generation stores its `reference_version`, so a reference swap stays as
comparable after the fact as a prompt change. Set
`PIXME_MASTER_REFERENCE_REQUIRED=true` in production so a bad deploy cannot
quietly ship drifting characters.
