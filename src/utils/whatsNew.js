import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * What's New feature utility
 * Manages version updates and changelog display
 */
export class WhatsNewManager {
  static STORAGE_KEY = 'whatsNewPreferences';

  // Version messages - Add new entries here before each update
  static whatsNewMessages = {
    "1.0.0": {
      title: "🚀 Welcome to HLM!",
      message: "Improvements and Bug Fixes:\n\n• Fixed backup download issues\n• Enhanced export functionality with multiple options\n• Improved UI responsiveness\n• Better error handling\n• Added What's New dialog system",
      priority: "normal", // normal, important, critical
      category: "improvement", // feature, bugfix, improvement, security
      icon: "🛠️"
    },
    "1.0.1": {
      title: "✨ New Features & Fixes",
      message: "• Added Suggestions & Reports feature\n• Improved navigation and animations\n• Enhanced Master screen utilities\n• Better error handling across the app",
      priority: "important",
      category: "feature",
      icon: "✨"
    },
    "1.0.0-update1": {
      title: "🎨 Modern Master Screen",
      message: "New Modern Card Design:\n\n• Beautiful elevated shadows with enhanced depth\n• Larger, more readable typography\n• Rounded corners for a friendly look\n• Better spacing and visual hierarchy\n• Enhanced touch interactions with ripple effects\n• Material Design 3 compliance\n• Improved icon containers and sizing",
      priority: "important",
      category: "improvement",
      icon: "🎨"
    },
  };

  /**
   * Get current app version with update identifier
   * @returns {string} Current app version with update suffix
   */
  static getCurrentVersion() {
    try {
      // For OTA updates, use base version + update identifier
      const baseVersion = Constants.expoConfig?.version || Constants.manifest?.version || "1.0.0";
      
      // Use update1 suffix for the new Master screen update
      const updateVersion = `${baseVersion}-update1`;
      console.log('WhatsNew: Current app version detected as:', updateVersion);
      return updateVersion;
    } catch (error) {
      console.warn('Could not get app version:', error);
      return "1.0.0-update1"; // Default to current update
    }
  }

  /**
   * Get stored user preferences
   * @returns {Promise<Object>} User preferences
   */
  static async getPreferences() {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {
        lastSeenVersion: null,
        dismissedVersions: [],
        remindLaterVersions: {} // { version: timestamp }
      };
    } catch (error) {
      console.warn('Could not load WhatsNew preferences:', error);
      return {
        lastSeenVersion: null,
        neverShow: false,
        dismissedVersions: []
      };
    }
  }

  /**
   * Save user preferences
   * @param {Object} preferences - User preferences to save
   */
  static async savePreferences(preferences) {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Could not save WhatsNew preferences:', error);
    }
  }

  /**
   * Check if should show What's New dialog
   * @returns {Promise<Object>} { shouldShow: boolean, version: string, message: string }
   */
  static async shouldShowWhatsNew() {
    try {
      const currentVersion = this.getCurrentVersion();
      const preferences = await this.getPreferences();

      console.log('WhatsNew Debug:');
      console.log('- Current Version:', currentVersion);
      console.log('- Last Seen Version:', preferences.lastSeenVersion);
      console.log('- Dismissed Versions:', preferences.dismissedVersions);
      console.log('- Remind Later Versions:', preferences.remindLaterVersions);
      console.log('- Available Messages:', Object.keys(this.whatsNewMessages));

      // Don't show if already dismissed for this version
      if (preferences.dismissedVersions.includes(currentVersion)) {
        console.log('WhatsNew: Not showing - already dismissed for version', currentVersion);
        return { shouldShow: false };
      }

      // Check if in "remind later" list and if enough time has passed
      const remindLaterTime = preferences.remindLaterVersions[currentVersion];
      if (remindLaterTime) {
        const daysSinceReminder = (Date.now() - remindLaterTime) / (1000 * 60 * 60 * 24);
        if (daysSinceReminder < 7) {
          console.log('WhatsNew: Not showing - remind later period active');
          return { shouldShow: false };
        }
      }

      // Show if we have a message for this version and haven't seen it
      const messageData = this.whatsNewMessages[currentVersion];
      if (messageData && preferences.lastSeenVersion !== currentVersion) {
        console.log('WhatsNew: Should show dialog for version', currentVersion);
        return {
          shouldShow: true,
          version: currentVersion,
          ...messageData
        };
      }

      // Critical updates bypass normal dismissal (but respect remind later)
      if (messageData && messageData.priority === 'critical' && !remindLaterTime) {
        console.log('WhatsNew: Showing critical update for version', currentVersion);
        return {
          shouldShow: true,
          version: currentVersion,
          ...messageData
        };
      }

      console.log('WhatsNew: Not showing - no message or already seen');
      return { shouldShow: false };
    } catch (error) {
      console.warn('Error checking WhatsNew status:', error);
      return { shouldShow: false };
    }
  }

  /**
   * Mark current version as seen
   * @param {string} version - Version to mark as seen
   */
  static async markVersionSeen(version) {
    try {
      const preferences = await this.getPreferences();
      preferences.lastSeenVersion = version;
      if (!preferences.dismissedVersions.includes(version)) {
        preferences.dismissedVersions.push(version);
      }
      await this.savePreferences(preferences);
    } catch (error) {
      console.warn('Could not mark version as seen:', error);
    }
  }

  /**
   * Set remind later for current version (7 days)
   * @param {string} version - Version to remind later
   */
  static async setRemindLater(version) {
    try {
      const preferences = await this.getPreferences();
      preferences.remindLaterVersions[version] = Date.now();
      await this.savePreferences(preferences);
    } catch (error) {
      console.warn('Could not set remind later preference:', error);
    }
  }

  /**
   * Clear remind later for a version
   * @param {string} version - Version to clear remind later
   */
  static async clearRemindLater(version) {
    try {
      const preferences = await this.getPreferences();
      delete preferences.remindLaterVersions[version];
      await this.savePreferences(preferences);
    } catch (error) {
      console.warn('Could not clear remind later preference:', error);
    }
  }

  /**
   * Get all versions with updates (for manual viewing)
   */
  static getAllVersionUpdates() {
    return Object.entries(this.whatsNewMessages).map(([version, data]) => ({
      version,
      ...data
    })).sort((a, b) => {
      // Sort by version number (newest first)
      return b.version.localeCompare(a.version, undefined, { numeric: true });
    });
  }

  /**
   * Force show What's New for a specific version
   * @param {string} version - Version to show
   */
  static async forceShowVersion(version) {
    const messageData = this.whatsNewMessages[version];
    if (messageData) {
      return {
        shouldShow: true,
        version: version,
        ...messageData
      };
    }
    return { shouldShow: false };
  }

  /**
   * Reset all preferences (for testing)
   */
  static async resetPreferences() {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      console.log('WhatsNew: Preferences reset successfully');
    } catch (error) {
      console.warn('Could not reset WhatsNew preferences:', error);
    }
  }

  /**
   * Force show What's New dialog (for testing)
   */
  static async forceShowWhatsNew() {
    try {
      await this.resetPreferences();
      const currentVersion = this.getCurrentVersion();
      const messageData = this.whatsNewMessages[currentVersion];
      return {
        shouldShow: true,
        version: currentVersion,
        ...messageData
      };
    } catch (error) {
      console.warn('Could not force show WhatsNew:', error);
      return { shouldShow: false };
    }
  }
}

export default WhatsNewManager;
