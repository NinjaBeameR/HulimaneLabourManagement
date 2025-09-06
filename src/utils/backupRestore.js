import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { getAllWorkersBalances } from './balance';

/**
 * Backup and Restore utility for the labour management app
 */
export class BackupRestoreManager {
  static BACKUP_VERSION = '1.0';
  static BACKUP_FILE_PREFIX = 'hlm_backup_';
  static BACKUP_EXTENSION = '.json';

  /**
   * Create a complete backup of all app data
   * @param {Object} state - Global state containing all app data
   * @returns {Object} Backup data object
   */
  static createBackupData(state) {
    const timestamp = new Date().toISOString();
    const balances = getAllWorkersBalances(state);
    
    return {
      version: this.BACKUP_VERSION,
      timestamp,
      appData: {
        workers: state.workers || [],
        categories: state.categories || [],
        subcategories: state.subcategories || [],
        entries: state.entries || [],
        payments: state.payments || [],
        openingBalances: state.openingBalances || {},
        deferredMessages: state.deferredMessages || [],
      },
      metadata: {
        totalWorkers: (state.workers || []).length,
        totalEntries: (state.entries || []).length,
        totalPayments: (state.payments || []).length,
        totalCategories: (state.categories || []).length,
        totalSubcategories: (state.subcategories || []).length,
        calculatedBalances: balances,
        backupDate: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      }
    };
  }

  /**
   * Export backup data to a file and share it
   * @param {Object} state - Global state
   * @returns {Promise<boolean>} Success status
   */
  static async exportBackup(state) {
    try {
      const backupData = this.createBackupData(state);
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      const fileName = `${this.BACKUP_FILE_PREFIX}${timestamp}${this.BACKUP_EXTENSION}`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      // Write backup data to file
      await FileSystem.writeAsStringAsync(
        fileUri,
        JSON.stringify(backupData, null, 2),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export HLM Backup',
        });
      }

      return { success: true, fileName, metadata: backupData.metadata };
    } catch (error) {
      console.error('Export backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export backup directly to Downloads folder (Alternative approach)
   * @param {Object} state - Global state
   * @returns {Promise<Object>} Export result
   */
  static async exportBackupToDownloads(state) {
    try {
      const backupData = this.createBackupData(state);
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      const fileName = `${this.BACKUP_FILE_PREFIX}${timestamp}${this.BACKUP_EXTENSION}`;
      
      // Try to write directly to Downloads directory
      let downloadPath = null;
      try {
        // Check if we can access external storage
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          // User selected a directory, write file there
          downloadPath = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'application/json'
          );
          
          await FileSystem.writeAsStringAsync(
            downloadPath,
            JSON.stringify(backupData, null, 2),
            { encoding: FileSystem.EncodingType.UTF8 }
          );
        }
      } catch (safError) {
        console.log('SAF approach failed, trying alternative:', safError.message);
      }

      // If SAF didn't work, fall back to sharing approach
      if (!downloadPath) {
        const fileUri = FileSystem.documentDirectory + fileName;
        
        // Write backup data to file
        await FileSystem.writeAsStringAsync(
          fileUri,
          JSON.stringify(backupData, null, 2),
          { encoding: FileSystem.EncodingType.UTF8 }
        );

        // Use sharing as fallback
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Save HLM Backup to Downloads',
            UTI: 'public.json',
          });
        }

        return { 
          success: true, 
          fileName, 
          location: 'Shared (save to Downloads from share menu)', 
          metadata: backupData.metadata 
        };
      }

      return { 
        success: true, 
        fileName, 
        location: 'Selected folder', 
        metadata: backupData.metadata 
      };
    } catch (error) {
      console.error('Export to Downloads failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Copy backup data to clipboard
   * @param {Object} state - Global state
   * @returns {Promise<Object>} Copy result
   */
  static async copyBackupToClipboard(state) {
    try {
      const backupData = this.createBackupData(state);
      const backupText = JSON.stringify(backupData, null, 2);
      
      await Clipboard.setStringAsync(backupText);
      
      return { 
        success: true, 
        size: backupText.length, 
        metadata: backupData.metadata 
      };
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Import backup data from a file
   * @returns {Promise<Object>} Import result with data or error
   */
  static async importBackup() {
    try {
      // Pick a file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: false, // Don't copy to cache, use original location
      });

      if (result.type === 'cancel') {
        return { success: false, canceled: true };
      }

      // Log for debugging
      console.log('Selected file URI:', result.uri);
      console.log('File info:', result);

      let fileContent;
      
      try {
        // Try to read directly first (works for most file schemes)
        console.log('Attempting to read file directly...');
        fileContent = await FileSystem.readAsStringAsync(result.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        console.log('Direct read successful, content length:', fileContent.length);
      } catch (directReadError) {
        console.log('Direct read failed:', directReadError.message);
        
        // For content:// URIs, try using DocumentPicker with copyToCacheDirectory: true
        console.log('Retrying with cache directory copy...');
        const retryResult = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true,
        });
        
        if (retryResult.type === 'cancel') {
          return { success: false, canceled: true };
        }
        
        try {
          fileContent = await FileSystem.readAsStringAsync(retryResult.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          console.log('Cache copy read successful, content length:', fileContent.length);
        } catch (cacheReadError) {
          console.log('Cache copy read also failed:', cacheReadError.message);
          throw new Error(`Unable to read backup file. This may be due to cloud storage restrictions. Please try downloading the file to local storage first. Error: ${cacheReadError.message}`);
        }
      }
      
      console.log('File content read successfully, parsing backup data...');

      // Parse backup data
      const backupData = JSON.parse(fileContent);
      
      console.log('Parsed backup data successfully');
      console.log('Backup data structure:', Object.keys(backupData));
      console.log('App data structure:', backupData.appData ? Object.keys(backupData.appData) : 'No appData');
      
      // Validate backup format
      const validation = this.validateBackupData(backupData);
      console.log('Validation result:', validation);
      
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      console.log('Backup validation passed, preparing return data...');
      console.log('Workers in backup:', backupData.appData.workers?.length || 0);
      console.log('Entries in backup:', backupData.appData.entries?.length || 0);
      console.log('Payments in backup:', backupData.appData.payments?.length || 0);

      return { 
        success: true, 
        data: backupData.appData, 
        metadata: backupData.metadata,
        version: backupData.version,
        timestamp: backupData.timestamp
      };
    } catch (error) {
      console.error('Import backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Import backup from raw JSON text (alternative method)
   * @param {string} jsonText - Raw JSON backup data
   * @returns {Promise<Object>} Import result with data or error
   */
  static async importBackupFromText(jsonText) {
    try {
      console.log('Importing backup from text, length:', jsonText.length);
      
      // Parse backup data
      const backupData = JSON.parse(jsonText);
      
      // Validate backup format
      const validation = this.validateBackupData(backupData);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      return { 
        success: true, 
        data: backupData.appData, 
        metadata: backupData.metadata,
        version: backupData.version,
        timestamp: backupData.timestamp
      };
    } catch (error) {
      console.error('Import backup from text failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate backup data structure
   * @param {Object} backupData - Backup data to validate
   * @returns {Object} Validation result
   */
  static validateBackupData(backupData) {
    if (!backupData || typeof backupData !== 'object') {
      return { valid: false, error: 'Invalid backup file format' };
    }

    if (!backupData.version) {
      return { valid: false, error: 'Backup version not found' };
    }

    if (!backupData.appData) {
      return { valid: false, error: 'App data not found in backup' };
    }

    // Check required fields
    const requiredFields = ['workers', 'categories', 'subcategories', 'entries', 'payments'];
    for (const field of requiredFields) {
      if (!Array.isArray(backupData.appData[field])) {
        return { valid: false, error: `Invalid or missing ${field} data` };
      }
    }

    return { valid: true };
  }

  /**
   * Restore backup data to the app
   * @param {Object} backupData - Validated backup data
   * @param {Function} dispatch - Redux dispatch function
   * @returns {Promise<boolean>} Success status
   */
  static async restoreBackup(backupData, dispatch) {
    try {
      console.log('Starting restore process...');
      console.log('Backup data keys:', Object.keys(backupData));
      console.log('Workers count:', backupData.workers?.length || 0);
      console.log('Entries count:', backupData.entries?.length || 0);
      console.log('Payments count:', backupData.payments?.length || 0);
      console.log('Categories count:', backupData.categories?.length || 0);
      console.log('Subcategories count:', backupData.subcategories?.length || 0);
      
      // Create a backup of current data before restore
      const currentState = await AsyncStorage.getItem('globalStore');
      if (currentState) {
        const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
        const backupKey = `globalStore_pre_restore_${timestamp}`;
        await AsyncStorage.setItem(backupKey, currentState);
        console.log('Created pre-restore backup:', backupKey);
      }

      // Restore the backup data with proper structure
      const restoredState = {
        workers: backupData.workers || [],
        categories: backupData.categories || [],
        subcategories: backupData.subcategories || [],
        entries: backupData.entries || [],
        payments: backupData.payments || [],
        openingBalances: backupData.openingBalances || {},
        deferredMessages: backupData.deferredMessages || [],
        isInitialized: true,
        schemaVersion: 1,
      };

      console.log('Restored state structure:', Object.keys(restoredState));
      console.log('Restored workers:', restoredState.workers.length);
      console.log('Restored entries:', restoredState.entries.length);
      console.log('Restored payments:', restoredState.payments.length);
      
      console.log('Dispatching SET_ALL action...');
      
      // Update the store
      dispatch({ type: 'SET_ALL', payload: restoredState });

      // Force save to AsyncStorage immediately to ensure persistence
      console.log('Force saving to AsyncStorage...');
      await AsyncStorage.setItem('globalStore', JSON.stringify(restoredState));

      console.log('Restore completed successfully');
      return { success: true };
    } catch (error) {
      console.error('Restore backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get backup history from AsyncStorage
   * @returns {Promise<Array>} List of backup entries
   */
  static async getBackupHistory() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const backupKeys = keys.filter(key => 
        key.startsWith('globalStore_backup_') || key.startsWith('globalStore_pre_restore_')
      );

      const backupHistory = [];
      for (const key of backupKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            const timestamp = key.split('_').pop();
            backupHistory.push({
              key,
              timestamp,
              type: key.includes('pre_restore') ? 'pre-restore' : 'auto-backup',
              workers: (parsed.workers || []).length,
              entries: (parsed.entries || []).length,
              payments: (parsed.payments || []).length,
            });
          }
        } catch (e) {
          console.warn(`Failed to parse backup ${key}:`, e);
        }
      }

      // Sort by timestamp (newest first)
      return backupHistory.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (error) {
      console.error('Get backup history failed:', error);
      return [];
    }
  }

  /**
   * Delete old backup files to free up space
   * @param {number} keepCount - Number of backups to keep (default: 5)
   * @returns {Promise<void>}
   */
  static async cleanupOldBackups(keepCount = 5) {
    try {
      const history = await this.getBackupHistory();
      const toDelete = history.slice(keepCount);
      
      for (const backup of toDelete) {
        await AsyncStorage.removeItem(backup.key);
      }
    } catch (error) {
      console.error('Cleanup old backups failed:', error);
    }
  }

  /**
   * Validate and recalculate all balances after restore
   * @param {Object} state - State after restore
   * @returns {Object} Validation and recalculation results
   */
  static validateAndRecalculateBalances(state) {
    try {
      const balances = getAllWorkersBalances(state);
      const issues = [];

      // Check for data integrity issues
      state.workers.forEach(worker => {
        const entries = state.entries.filter(e => e.workerId === worker.id);
        const payments = state.payments.filter(p => p.workerId === worker.id);
        
        // Check for entries without valid categories (for Work A)
        const invalidEntries = entries.filter(e => 
          e.workType === 'A' && e.status !== 'A' && (!e.categoryId || !e.subcategoryId)
        );
        
        if (invalidEntries.length > 0) {
          issues.push({
            type: 'invalid_entries',
            workerId: worker.id,
            workerName: worker.name,
            count: invalidEntries.length,
            message: `${invalidEntries.length} entries missing category/subcategory data`
          });
        }

        // Check for invalid Work B entries
        const invalidWorkBEntries = entries.filter(e =>
          e.workType === 'B' && e.status !== 'A' && (!e.workName || !e.units || !e.ratePerUnit)
        );

        if (invalidWorkBEntries.length > 0) {
          issues.push({
            type: 'invalid_work_b_entries',
            workerId: worker.id,
            workerName: worker.name,
            count: invalidWorkBEntries.length,
            message: `${invalidWorkBEntries.length} Work B entries missing required data`
          });
        }
      });

      return {
        success: true,
        balances,
        issues,
        summary: {
          totalWorkers: state.workers.length,
          totalEntries: state.entries.length,
          totalPayments: state.payments.length,
          issuesFound: issues.length,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        balances: {},
        issues: [],
      };
    }
  }
}

export default BackupRestoreManager;
