
# Hulimane Labour Management

A React Native app built with Expo for managing labour and work entries.

## OTA Updates

This app supports Over-The-Air (OTA) updates using GitHub as the CDN.

### Pushing OTA Updates

To push a new OTA update:

```bash
npm run ota
```

This command will:
1. Generate OTA bundles using `expo export`
2. Commit the bundles to the `ota/` folder
3. Push to GitHub automatically

### Important Notes

- **APK rebuild is NOT needed** for JavaScript/React changes
- **APK rebuild IS needed** for native code changes (dependencies, permissions, etc.)
- The app automatically fetches the latest OTA update on launch
- Users will get updates without downloading a new APK

### Development

```bash
# Start development server
npm start

# Build APK for testing
eas build --platform android --profile preview

# Push OTA update
npm run ota
```

## Setup

x1e68j@powerscrews.com - expo