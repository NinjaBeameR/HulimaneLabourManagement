import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Centralized Update Manager for Expo OTA Updates
 * Handles checking, downloading, and applying updates
 */
export class UpdateManager {
  static UPDATE_CHECK_KEY = 'last_update_check';
  static UPDATE_INFO_KEY = 'pending_update_info';
  
  /**
   * Check if updates are available and handle the complete update flow
   * @param {Object} options - Update options
   * @param {boolean} options.showProgress - Show progress callbacks
   * @param {Function} options.onProgress - Progress callback function
   * @param {boolean} options.autoReload - Automatically reload after download
   * @returns {Promise<Object>} Update result
   */
  static async checkAndDownloadUpdate(options = {}) {
    const {
      showProgress = false,
      onProgress = () => {},
      autoReload = false
    } = options;

    try {
      // Step 1: Environment validation
      if (__DEV__) {
        throw new Error('Updates not available in development mode');
      }

      if (showProgress) onProgress('Checking for updates...', 10);

      // Step 2: Check for updates
      const checkResult = await this.checkForUpdate();
      
      if (!checkResult.isAvailable) {
        if (showProgress) onProgress('No updates available', 100);
        return {
          success: true,
          hasUpdate: false,
          message: 'Your app is up to date!'
        };
      }

      if (showProgress) onProgress('Update found! Downloading...', 40);

      // Step 3: Download update
      const downloadResult = await this.downloadUpdate();
      
      if (!downloadResult.success) {
        throw new Error(downloadResult.error);
      }

      if (showProgress) onProgress('Update downloaded successfully!', 90);

      // Step 4: Store update info
      await this.storeUpdateInfo({
        updateId: downloadResult.manifest.id,
        downloadedAt: new Date().toISOString(),
        channel: Updates.channel,
        runtimeVersion: Updates.runtimeVersion
      });

      if (showProgress) onProgress('Ready to apply update', 100);

      // Step 5: Apply update if requested
      if (autoReload && downloadResult.isNew) {
        await this.applyUpdate();
      }

      return {
        success: true,
        hasUpdate: true,
        isNew: downloadResult.isNew,
        message: downloadResult.isNew 
          ? 'Update ready! Restart app to apply.' 
          : 'Update already applied.',
        canReload: downloadResult.isNew
      };

    } catch (error) {
      console.error('Update check failed:', error);
      
      if (showProgress) onProgress(`Update failed: ${error.message}`, 0);
      
      return {
        success: false,
        hasUpdate: false,
        error: error.message,
        message: this.getErrorMessage(error)
      };
    }
  }

  /**
   * Check for available updates
   * @returns {Promise<Object>} Check result
   */
  static async checkForUpdate() {
    try {
      // Add timeout for network operations
      const checkPromise = Updates.checkForUpdateAsync();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), 30000)
      );
      
      const result = await Promise.race([checkPromise, timeoutPromise]);
      
      // Store last check time
      await AsyncStorage.setItem(this.UPDATE_CHECK_KEY, Date.now().toString());
      
      return result;
    } catch (error) {
      console.error('Check for update failed:', error);
      throw error;
    }
  }

  /**
   * Download available update
   * @returns {Promise<Object>} Download result
   */
  static async downloadUpdate() {
    try {
      // Add timeout for download operations (2 minutes for large updates)
      const downloadPromise = Updates.fetchUpdateAsync();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Download timeout')), 120000)
      );
      
      const result = await Promise.race([downloadPromise, timeoutPromise]);
      
      return {
        success: true,
        isNew: result.isNew,
        manifest: result.manifest
      };
    } catch (error) {
      console.error('Download update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Apply downloaded update (restart app)
   * @returns {Promise<void>}
   */
  static async applyUpdate() {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.error('Apply update failed:', error);
      throw new Error('Failed to apply update. Please restart the app manually.');
    }
  }

  /**
   * Check if there's a pending update ready to apply
   * @returns {Promise<boolean>}
   */
  static async hasPendingUpdate() {
    try {
      const updateInfo = await AsyncStorage.getItem(this.UPDATE_INFO_KEY);
      return !!updateInfo;
    } catch (error) {
      console.warn('Could not check pending update:', error);
      return false;
    }
  }

  /**
   * Get last update check time
   * @returns {Promise<number|null>}
   */
  static async getLastUpdateCheck() {
    try {
      const timestamp = await AsyncStorage.getItem(this.UPDATE_CHECK_KEY);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
      console.warn('Could not get last update check:', error);
      return null;
    }
  }

  /**
   * Store update information
   * @param {Object} updateInfo - Update information to store
   */
  static async storeUpdateInfo(updateInfo) {
    try {
      await AsyncStorage.setItem(this.UPDATE_INFO_KEY, JSON.stringify(updateInfo));
    } catch (error) {
      console.warn('Could not store update info:', error);
    }
  }

  /**
   * Clear stored update information
   */
  static async clearUpdateInfo() {
    try {
      await AsyncStorage.removeItem(this.UPDATE_INFO_KEY);
    } catch (error) {
      console.warn('Could not clear update info:', error);
    }
  }

  /**
   * Get current update status
   * @returns {Object} Update status information
   */
  static getCurrentStatus() {
    return {
      isEnabled: Updates.isEnabled,
      channel: Updates.channel,
      runtimeVersion: Updates.runtimeVersion,
      updateId: Updates.updateId,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      createdAt: Updates.createdAt
    };
  }

  /**
   * Get user-friendly error message
   * @param {Error} error - Error object
   * @returns {string} User-friendly error message
   */
  static getErrorMessage(error) {
    if (error.code === 'ERR_UPDATES_DISABLED') {
      return 'Updates are disabled. Please check app configuration.';
    } else if (error.code === 'ERR_UPDATES_FETCH') {
      return 'Failed to download update. Please check your internet connection.';
    } else if (error.code === 'ERR_UPDATES_CHECK') {
      return 'Update server unavailable. Please try again later.';
    } else if (error.message?.includes('timeout') || error.message === 'Network timeout') {
      return 'Network timeout. Please check your internet connection and try again.';
    } else if (error.message?.includes('network') || error.message?.includes('connection')) {
      return 'Network error. Please check your internet connection.';
    } else {
      return `Update failed: ${error.message}. Please try again later.`;
    }
  }
}

export default UpdateManager;
