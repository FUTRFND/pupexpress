# PupXpress Android release signing

The Google Play upload key is intentionally stored outside this repository:

- Keystore: `/Users/adamarellano/Library/Application Support/PupXpress/signing/pupexpress-upload.jks`
- Public certificate: `/Users/adamarellano/Library/Application Support/PupXpress/signing/pupexpress-upload-certificate.pem`
- Alias: `pupexpress-upload`
- Password storage: macOS Keychain service `com.pupxpress.app.upload-keystore`, account `android-upload`
- SHA-1: `A1:DB:F1:15:E9:3E:8B:69:70:C5:D9:CC:8B:56:C4:4A:B8:28:63:C8`
- SHA-256: `D0:C0:19:7A:65:7D:9C:9C:0A:2E:6E:F4:F0:CA:C7:5C:C6:EF:79:97:1A:07:6B:2B:12:6C:E7:54:36:BA:2F:42`

Back up the keystore securely before the first Google Play upload. Never commit
the keystore or export its password into source control.

The production Firebase client configuration is downloaded from Firebase
project `pupxpress-26ceb` and installed locally at
`android/app/google-services.json`. The file is ignored by Git and must be
injected into that path by any future release CI job.

## Local release build

Read the password from Keychain and expose it only to the Gradle process:

```sh
signing_password="$(security find-generic-password \
  -a android-upload \
  -s com.pupxpress.app.upload-keystore \
  -w)"

PUPXPRESS_STORE_FILE="/Users/adamarellano/Library/Application Support/PupXpress/signing/pupexpress-upload.jks" \
PUPXPRESS_STORE_PASSWORD="$signing_password" \
PUPXPRESS_KEY_ALIAS="pupexpress-upload" \
PUPXPRESS_KEY_PASSWORD="$signing_password" \
ANDROID_HOME="/Users/adamarellano/Library/Android/sdk" \
./gradlew clean bundleRelease

unset signing_password
```

The signed bundle is generated at
`android/app/build/outputs/bundle/release/app-release.aab`.

Google Play App Signing should manage the app-signing key. This locally stored
certificate is the upload key used to authenticate future bundles.
