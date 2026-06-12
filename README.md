# FakeProfile

A Kettu/Bunny/Vendetta plugin for client-side profile modifications. Change any user's avatar, banner, display name, bio, pronouns, and status locally - only visible to you.

## Install

Paste this URL into Kettu/Bunny/Vendetta Plugins:
```
https://zenosama0.github.io/fakeprofile-plugin/index.js
```

## Features

- **Avatar Override** - Replace anyone's profile picture with a custom image URL
- **Banner Override** - Replace anyone's profile banner
- **Display Name** - Change the shown name (not username)
- **Bio / About Me** - Customize the profile bio text
- **Custom Status** - Set a custom status text
- **Pronouns** - Override pronouns display
- **Multiple Users** - Add, edit, and remove overrides for any number of users
- **All changes are 100% client-side** - Only you can see the modifications

## How to Use

1. Install the plugin using the URL above
2. Open the plugin settings
3. Fill in the User ID and any fields you want to override
4. Tap "Add Profile"
5. The changes apply immediately - no restart needed

### Finding a User ID

- Enable Developer Mode in Discord settings
- Long-press on a user's profile and copy their ID

## Changelog

### v1.0.0
- Initial release
- Fixed all render errors (UserType, ScrollView)
- Proper metro/component lookups
- Uses vendetta UI components correctly
- Added edit/remove functionality
