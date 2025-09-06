import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { BackupRestoreManager } from './backupRestore';
import { GITHUB_TOKEN, BACKUP_REPO_OWNER, BACKUP_REPO_NAME } from '@env';

/**
 * Auto-Backup Manager for GitHub integration
 * Completely separate from existing backup system
 * Safe - will not interfere with local storage
 */
export class AutoBackupManager {
  static GITHUB_CONFIG = {
    owner: BACKUP_REPO_OWNER || 'NinjaBeameR',
    repo: BACKUP_REPO_NAME || 'hlm_backup_private',
    token: GITHUB_TOKEN || '', // Loaded from environment variable
    branch: 'main',
    backupPath: 'auto-backup.json'
  };

  static STORAGE_KEYS = {
    AUTO_BACKUP_ENABLED: 'autoBackupEnabled',
    LAST_BACKUP_TIME: 'lastAutoBackupTime',
    LAST_DATA_HASH: 'lastDataHash',
    RETRY_COUNT: 'autoBackupRetryCount',
    LAST_ERROR: 'autoBackupLastError'
  };

  static BACKUP_INTERVAL = 3 * 60 * 1000; // 3 minutes in milliseconds
  static MAX_RETRIES = 3;

  /**
   * Check if auto-backup is enabled
   */
  static async isEnabled() {
    try {
      const enabled = await AsyncStorage.getItem(this.STORAGE_KEYS.AUTO_BACKUP_ENABLED);
      return enabled === 'true';
    } catch {
      return false; // Default to disabled
    }
  }

  /**
   * Enable or disable auto-backup
   */
  static async setEnabled(enabled) {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.AUTO_BACKUP_ENABLED, enabled.toString());
      if (enabled) {
        console.log('Auto-backup enabled');
      } else {
        console.log('Auto-backup disabled');
      }
    } catch (error) {
      console.log('Failed to save auto-backup setting:', error);
    }
  }

  /**
   * Set GitHub token (you'll call this with your token)
   */
  static setGitHubToken(token) {
    this.GITHUB_CONFIG.token = token;
  }

  /**
   * Check if backup should be performed
   */
  static async shouldBackup(currentState) {
    try {
      // Check if auto-backup is enabled
      if (!(await this.isEnabled())) return { should: false, reason: 'disabled' };

      // Check if GitHub token is set
      if (!this.GITHUB_CONFIG.token) return { should: false, reason: 'no_token' };

      // Check network connectivity
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) return { should: false, reason: 'no_network' };

      // Generate hash of current data to detect changes
      const currentData = BackupRestoreManager.createBackupData(currentState);
      const currentHash = this.generateDataHash(currentData);

      // Check if data changed since last backup
      const lastHash = await AsyncStorage.getItem(this.STORAGE_KEYS.LAST_DATA_HASH);
      if (currentHash === lastHash) return { should: false, reason: 'no_changes' };

      return { should: true, reason: 'ready' };
    } catch (error) {
      console.log('Error checking backup condition:', error);
      return { should: false, reason: 'error' };
    }
  }

  /**
   * Generate simple hash of data to detect changes
   */
  static generateDataHash(data) {
    try {
      const str = JSON.stringify({
        workers: data.appData?.workers?.length || 0,
        entries: data.appData?.entries?.length || 0,
        payments: data.appData?.payments?.length || 0,
        categories: data.appData?.categories?.length || 0,
        timestamp: data.timestamp
      });
      
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString();
    } catch (error) {
      console.log('Error generating hash:', error);
      return Date.now().toString(); // Fallback to timestamp
    }
  }

  /**
   * Get current file SHA from GitHub (needed for updates)
   */
  static async getCurrentFileSHA() {
    try {
      const apiUrl = `https://api.github.com/repos/${this.GITHUB_CONFIG.owner}/${this.GITHUB_CONFIG.repo}/contents/${this.GITHUB_CONFIG.backupPath}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `token ${this.GITHUB_CONFIG.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.sha;
      }
      
      return null; // File doesn't exist yet
    } catch (error) {
      console.log('Error getting current file SHA:', error);
      return null;
    }
  }

  /**
   * Perform the actual backup to GitHub
   */
  static async performBackup(currentState) {
    try {
      console.log('Starting auto-backup to GitHub...');
      
      // Generate backup data using existing method (safe - doesn't modify storage)
      const backupData = BackupRestoreManager.createBackupData(currentState);
      
      // Create commit message with timestamp
      const timestamp = new Date().toISOString();
      const commitMessage = `Auto-backup ${timestamp.split('T')[0]} ${timestamp.split('T')[1].split('.')[0]}`;

      // Get current file SHA (needed for GitHub API updates)
      const currentSHA = await this.getCurrentFileSHA();

      // Prepare GitHub API request
      const apiUrl = `https://api.github.com/repos/${this.GITHUB_CONFIG.owner}/${this.GITHUB_CONFIG.repo}/contents/${this.GITHUB_CONFIG.backupPath}`;
      
      const requestBody = {
        message: commitMessage,
        content: Buffer.from(JSON.stringify(backupData, null, 2)).toString('base64'),
        branch: this.GITHUB_CONFIG.branch,
        ...(currentSHA && { sha: currentSHA })
      };

      // Make GitHub API call
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${this.GITHUB_CONFIG.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Auto-backup successful:', result.commit?.sha);

      // Update success tracking (separate from main app storage)
      const currentHash = this.generateDataHash(backupData);
      await AsyncStorage.multiSet([
        [this.STORAGE_KEYS.LAST_BACKUP_TIME, timestamp],
        [this.STORAGE_KEYS.LAST_DATA_HASH, currentHash],
        [this.STORAGE_KEYS.RETRY_COUNT, '0'],
        [this.STORAGE_KEYS.LAST_ERROR, '']
      ]);

      return { 
        success: true, 
        timestamp, 
        commitSha: result.commit?.sha,
        message: `Backup successful at ${new Date(timestamp).toLocaleTimeString()}`
      };

    } catch (error) {
      console.log('Auto-backup failed:', error);
      
      // Track error and retry count
      await this.handleBackupError(error);
      
      return { 
        success: false, 
        error: error.message,
        message: `Backup failed: ${error.message}`
      };
    }
  }

  /**
   * Handle backup errors and retry logic
   */
  static async handleBackupError(error) {
    try {
      // Get current retry count
      const currentRetryStr = await AsyncStorage.getItem(this.STORAGE_KEYS.RETRY_COUNT);
      const currentRetry = parseInt(currentRetryStr || '0', 10);
      const newRetryCount = currentRetry + 1;

      // Save error info
      await AsyncStorage.multiSet([
        [this.STORAGE_KEYS.RETRY_COUNT, newRetryCount.toString()],
        [this.STORAGE_KEYS.LAST_ERROR, error.message]
      ]);

      console.log(`Auto-backup retry ${newRetryCount}/${this.MAX_RETRIES}`);
    } catch (storageError) {
      console.log('Error saving backup error info:', storageError);
    }
  }

  /**
   * Get auto-backup status for UI display
   */
  static async getStatus() {
    try {
      const [
        enabled,
        lastBackupTime,
        retryCount,
        lastError
      ] = await AsyncStorage.multiGet([
        this.STORAGE_KEYS.AUTO_BACKUP_ENABLED,
        this.STORAGE_KEYS.LAST_BACKUP_TIME,
        this.STORAGE_KEYS.RETRY_COUNT,
        this.STORAGE_KEYS.LAST_ERROR
      ]);

      const isEnabled = enabled[1] === 'true';
      const lastBackup = lastBackupTime[1];
      const retries = parseInt(retryCount[1] || '0', 10);
      const error = lastError[1];

      return {
        enabled: isEnabled,
        lastBackup: lastBackup ? new Date(lastBackup) : null,
        retryCount: retries,
        lastError: error || null,
        hasToken: !!this.GITHUB_CONFIG.token
      };
    } catch (error) {
      console.log('Error getting auto-backup status:', error);
      return {
        enabled: false,
        lastBackup: null,
        retryCount: 0,
        lastError: null,
        hasToken: false
      };
    }
  }

  /**
   * Reset retry counter (call after successful backup or user action)
   */
  static async resetRetryCount() {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.RETRY_COUNT, '0');
    } catch (error) {
      console.log('Error resetting retry count:', error);
    }
  }

  /**
   * Test GitHub connection
   */
  static async testConnection() {
    try {
      if (!this.GITHUB_CONFIG.token) {
        return { success: false, error: 'No GitHub token configured' };
      }

      const apiUrl = `https://api.github.com/repos/${this.GITHUB_CONFIG.owner}/${this.GITHUB_CONFIG.repo}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `token ${this.GITHUB_CONFIG.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (response.ok) {
        return { success: true, message: 'GitHub connection successful' };
      } else {
        return { success: false, error: `GitHub API error: ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default AutoBackupManager;
