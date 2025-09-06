import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Text, 
  Surface, 
  Portal, 
  Dialog, 
  Button, 
  Snackbar,
  Appbar,
  ActivityIndicator
} from 'react-native-paper';
import { TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGlobalStore } from '../utils/GlobalStore';
import WhatsNewManager from '../utils/whatsNew';

const { width } = Dimensions.get('window');

export default function SettingsScreen({ navigation }) {
  // State for dialogs and UI
  const [resetDialogVisible, setResetDialogVisible] = useState(false);
  const [appInfoDialogVisible, setAppInfoDialogVisible] = useState(false);
  const [whatsNewDialogVisible, setWhatsNewDialogVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  
  // Update-related state
  const [updateDialogVisible, setUpdateDialogVisible] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const { state, dispatch, refreshData } = useGlobalStore();

  // Utility functions
  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  // Data & Backup Functions
  const handleBackupData = () => {
    try {
      navigation.navigate('BackupRestoreScreen');
    } catch (error) {
      console.error('Error navigating to backup screen:', error);
      showSnackbar('Error opening backup screen');
    }
  };

  // App Management Functions
  const handleReportBug = () => {
    try {
      navigation.navigate('SuggestionsScreen');
    } catch (error) {
      console.error('Error navigating to suggestions screen:', error);
      showSnackbar('Error opening bug report screen');
    }
  };

  const handleResetApp = () => {
    setResetDialogVisible(true);
  };

  const handleResetConfirm = async () => {
    setIsResetting(true);
    try {
      // Clear AsyncStorage completely
      await AsyncStorage.clear();
      
      // Reset global state to initial empty state
      dispatch({ 
        type: 'SET_ALL', 
        payload: {
          workers: [],
          categories: [],
          subcategories: [],
          entries: [],
          payments: [],
          openingBalances: {},
          isInitialized: true,
        }
      });

      // Hide dialog and show success message
      setResetDialogVisible(false);
      showSnackbar('All data has been reset successfully');
    } catch (error) {
      console.error('Error resetting app data:', error);
      setResetDialogVisible(false);
      showSnackbar('Error resetting app data');
    }
    setIsResetting(false);
  };

  const handleAppInfo = () => {
    setAppInfoDialogVisible(true);
  };

  // Updates Functions
  const handleWhatsNew = async () => {
    try {
      const currentVersion = WhatsNewManager.getCurrentVersion();
      const result = await WhatsNewManager.forceShowVersion(currentVersion);
      if (result.shouldShow) {
        setWhatsNewDialogVisible(true);
      } else {
        showSnackbar('No updates available to show');
      }
    } catch (error) {
      console.warn('Error showing What\'s New:', error);
      showSnackbar('Error loading What\'s New');
    }
  };

  const handleCheckForUpdates = async () => {
    // Prevent multiple simultaneous update checks
    if (isCheckingUpdate) return;

    setIsCheckingUpdate(true);
    setUpdateDialogVisible(true);
    setUpdateStatus('Initializing update check...');

    // Add diagnostic information
    console.log('=== UPDATE DIAGNOSTICS ===');
    console.log('Updates.isEnabled:', Updates.isEnabled);
    console.log('Updates.channel:', Updates.channel);
    console.log('Updates.runtimeVersion:', Updates.runtimeVersion);
    console.log('Updates.updateId:', Updates.updateId);
    console.log('Updates.isEmbeddedLaunch:', Updates.isEmbeddedLaunch);
    console.log('__DEV__:', __DEV__);
    console.log('===========================');

    try {
      // Step 0: Technical environment validation
      if (__DEV__) {
        setUpdateStatus('Updates not available in development mode.');
        setTimeout(() => setUpdateDialogVisible(false), 3000);
        return;
      }

      // Step 1: Validate runtime environment before checking (skip isEnabled check)
      setUpdateStatus('Validating app configuration...');
      
      const currentRuntimeVersion = Updates.runtimeVersion;
      const currentChannel = Updates.channel;
      const isEmbeddedLaunch = Updates.isEmbeddedLaunch;
      
      console.log('Update environment check:', {
        runtimeVersion: currentRuntimeVersion,
        channel: currentChannel,
        isEmbeddedLaunch: isEmbeddedLaunch,
        updatesEnabled: Updates.isEnabled,
        updateId: Updates.updateId,
        createdAt: Updates.createdAt
      });

      // Enhanced channel validation with fallback
      const expectedChannel = 'preview';
      if (currentChannel && currentChannel !== expectedChannel) {
        console.error('Channel mismatch:', { expected: expectedChannel, actual: currentChannel });
        setUpdateStatus(`Channel configuration error.\nExpected: ${expectedChannel}\nActual: ${currentChannel}\n\nApp may need reconfiguration.`);
        setTimeout(() => setUpdateDialogVisible(false), 5000);
        return;
      }

      // If channel is undefined, proceed anyway (common in some builds)
      if (!currentChannel) {
        console.warn('Channel undefined, proceeding with update check...');
      }

      // Step 2: Check for updates with proper error handling
      setUpdateStatus('Checking for updates on preview channel...');
      
      let checkResult;
      try {
        // Add explicit timeout for network operations
        const checkPromise = Updates.checkForUpdateAsync();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), 30000)
        );
        
        checkResult = await Promise.race([checkPromise, timeoutPromise]);
        
        console.log('Update check result:', {
          isAvailable: checkResult.isAvailable,
          manifestId: checkResult.manifest?.id,
          createdAt: checkResult.manifest?.createdAt
        });
        
      } catch (checkError) {
        console.error('Update check failed:', checkError);
        
        if (checkError.message === 'NETWORK_TIMEOUT') {
          setUpdateStatus('Network timeout while checking for updates.\nCheck your internet connection and try again.');
        } else if (checkError.code === 'ERR_UPDATES_CHECK') {
          setUpdateStatus('Update server unavailable.\nPlease try again later.');
        } else {
          setUpdateStatus(`Update check failed: ${checkError.message}\nPlease try again.`);
        }
        setTimeout(() => setUpdateDialogVisible(false), 5000);
        return;
      }

      // Validate check result structure
      if (!checkResult || typeof checkResult.isAvailable !== 'boolean') {
        console.error('Invalid check result:', checkResult);
        setUpdateStatus('Invalid response from update server.\nPlease try again later.');
        setTimeout(() => setUpdateDialogVisible(false), 5000);
        return;
      }

      if (!checkResult.isAvailable) {
        console.log('No updates available');
        setUpdateStatus('Your app is up to date!\nNo new updates available.');
        setTimeout(() => setUpdateDialogVisible(false), 3000);
        return;
      }

      // Step 3: Validate update manifest before downloading
      if (!checkResult.manifest || !checkResult.manifest.id) {
        console.error('Invalid update manifest:', checkResult.manifest);
        setUpdateStatus('Update validation failed.\nInvalid update data received.');
        setTimeout(() => setUpdateDialogVisible(false), 5000);
        return;
      }

      // Step 4: Download with robust error handling
      setUpdateStatus('Update found! Downloading...\n\nPlease wait while the update downloads.');
      
      let fetchResult;
      try {
        // Add timeout for download operations (longer for large updates)
        const downloadPromise = Updates.fetchUpdateAsync();
        const downloadTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DOWNLOAD_TIMEOUT')), 120000) // 2 minutes
        );
        
        fetchResult = await Promise.race([downloadPromise, downloadTimeoutPromise]);
        
        console.log('Download result:', {
          isNew: fetchResult.isNew,
          manifestId: fetchResult.manifest?.id,
          downloadSuccess: !!fetchResult
        });
        
      } catch (downloadError) {
        console.error('Download failed:', downloadError);
        
        if (downloadError.message === 'DOWNLOAD_TIMEOUT') {
          setUpdateStatus('Download timeout.\nThe update may be large or your connection is slow.\nPlease try again with a stable connection.');
        } else if (downloadError.code === 'ERR_UPDATES_FETCH') {
          setUpdateStatus('Download failed.\nServer error or network interruption.\nPlease check your connection and try again.');
        } else if (downloadError.message?.includes('network') || downloadError.message?.includes('connection')) {
          setUpdateStatus('Network error during download.\nPlease check your internet connection and try again.');
        } else {
          setUpdateStatus(`Download failed: ${downloadError.message}\nPlease try again later.`);
        }
        setTimeout(() => setUpdateDialogVisible(false), 7000);
        return;
      }

      // Step 5: Validate download result
      if (!fetchResult) {
        console.error('Empty download result');
        setUpdateStatus('Download verification failed.\nNo data received from server.');
        setTimeout(() => setUpdateDialogVisible(false), 5000);
        return;
      }

      if (!fetchResult.isNew) {
        console.log('Update already applied');
        setUpdateStatus('Update downloaded but already applied.\nYour app is up to date!');
        setTimeout(() => setUpdateDialogVisible(false), 3000);
        return;
      }

      // Step 6: Final validation before success
      if (!fetchResult.manifest || !fetchResult.manifest.id) {
        console.error('Invalid download manifest:', fetchResult.manifest);
        setUpdateStatus('Download corrupted.\nInvalid update data.\nPlease try again.');
        setTimeout(() => setUpdateDialogVisible(false), 5000);
        return;
      }

      // Step 7: Success - Log and inform user
      const updateInfo = {
        updateId: fetchResult.manifest.id,
        channel: currentChannel,
        runtimeVersion: currentRuntimeVersion,
        downloadedAt: new Date().toISOString(),
        originalManifestId: checkResult.manifest.id
      };
      
      console.log('Update downloaded successfully:', updateInfo);
      
      setUpdateStatus('Update downloaded successfully!\n\n✅ Ready to Apply\n\nApp will restart in 3 seconds to apply the update...');
      
      // Apply the update by reloading the app
      setTimeout(async () => {
        try {
          await Updates.reloadAsync();
        } catch (reloadError) {
          console.error('Failed to reload app:', reloadError);
          setUpdateStatus('Update downloaded but failed to restart.\nPlease close and reopen the app manually.');
          setTimeout(() => setUpdateDialogVisible(false), 5000);
        }
      }, 3000);

    } catch (error) {
      // Comprehensive error logging for debugging
      console.error('Critical update system error:', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        updateConfig: {
          channel: Updates.channel,
          runtimeVersion: Updates.runtimeVersion,
          isEnabled: Updates.isEnabled,
          isEmbeddedLaunch: Updates.isEmbeddedLaunch
        }
      });

      let errorMessage = 'Update system error.\n';
      
      // Technical error classification
      if (error.code === 'ERR_UPDATES_DISABLED') {
        errorMessage += 'Update system is disabled.\nThis may be a configuration issue.\nTrying to proceed anyway...';
        // Don't return here, try to continue despite disabled status
        console.warn('Updates reported as disabled, attempting anyway...');
      } else if (error.code === 'ERR_UPDATES_FETCH') {
        errorMessage += 'Failed to fetch update from server.\nServer may be down or unreachable.';
      } else if (error.code === 'ERR_UPDATES_CHECK') {
        errorMessage += 'Failed to check for updates.\nUpdate service may be temporarily unavailable.';
      } else if (error.message?.includes('timeout') || error.message === 'NETWORK_TIMEOUT') {
        errorMessage += 'Network operation timed out.\nPlease check your internet connection and try again.';
      } else if (error.message?.includes('network') || error.message?.includes('connection')) {
        errorMessage += 'Network connectivity issue.\nPlease verify your internet connection.';
      } else if (error.message?.includes('manifest') || error.message?.includes('validation')) {
        errorMessage += 'Update validation failed.\nServer may have sent corrupted data.';
      } else if (error.message?.includes('runtime') || error.message?.includes('version')) {
        errorMessage += 'Runtime version mismatch.\nApp may need to be updated from app store.';
      } else if (error.message?.includes('channel')) {
        errorMessage += 'Update channel configuration error.\nApp may be misconfigured.';
      } else {
        errorMessage += `Technical error: ${error.message || 'Unknown system error'}\n\nIf this persists, app may need reinstallation.`;
      }

      setUpdateStatus(errorMessage);
      setTimeout(() => setUpdateDialogVisible(false), 8000); // Longer timeout for complex errors
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // Render section header
  const renderSectionHeader = (title) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  // Render setting item
  const renderSettingItem = (icon, title, description, onPress, iconColor = '#666') => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <Surface style={styles.settingItemSurface} elevation={1}>
        <View style={styles.settingItemContent}>
          <View style={[styles.settingItemIcon, { backgroundColor: `${iconColor}15` }]}>
            <Ionicons name={icon} size={24} color={iconColor} />
          </View>
          <View style={styles.settingItemText}>
            <Text style={styles.settingItemTitle}>{title}</Text>
            <Text style={styles.settingItemDescription}>{description}</Text>
          </View>
          <View style={styles.settingItemArrow}>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </View>
        </View>
      </Surface>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Settings" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          
          {/* Data & Backup Section */}
          {renderSectionHeader('Data & Backup')}
          {renderSettingItem(
            'cloud-outline', 
            'Backup and Restore', 
            'Export data or restore from backup files',
            handleBackupData,
            '#27ae60'
          )}

          {/* App Management Section */}
          {renderSectionHeader('App Management')}
          {renderSettingItem(
            'bug-outline', 
            'Report a Bug / Suggestion', 
            'Send feedback or report issues',
            handleReportBug,
            '#e74c3c'
          )}
          {renderSettingItem(
            'refresh-circle-outline', 
            'Reset App', 
            'Clear all data and start fresh',
            handleResetApp,
            '#f39c12'
          )}
          {renderSettingItem(
            'information-circle-outline', 
            'App Info', 
            'Version, credits, and app details',
            handleAppInfo,
            '#2196F3'
          )}

          {/* Updates Section */}
          {renderSectionHeader('Updates')}
          {renderSettingItem(
            'download-outline', 
            'Check for Updates', 
            'Manually check for app updates',
            handleCheckForUpdates,
            '#6200ee'
          )}
          {renderSettingItem(
            'star-outline', 
            'What\'s New', 
            'View latest updates and features',
            handleWhatsNew,
            '#9C27B0'
          )}

          <View style={styles.footerSpacing} />
        </View>
      </ScrollView>

      {/* Reset Confirmation Dialog */}
      <Portal>
        <Dialog visible={resetDialogVisible} onDismiss={() => setResetDialogVisible(false)}>
          <Dialog.Icon icon="alert-circle-outline" color="#f44336" size={60} />
          <Dialog.Title style={[styles.dialogTitle, { color: '#f44336' }]}>Reset All Data</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogContent}>
              This will permanently delete all workers, categories, subcategories, entries, and payments. 
              This action will also reset opening balances.
              {'\n\n'}
              <Text style={{ fontWeight: '600', color: '#f44336' }}>This action cannot be undone.</Text>
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button 
              onPress={() => setResetDialogVisible(false)} 
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button 
              onPress={handleResetConfirm} 
              loading={isResetting} 
              disabled={isResetting}
              mode="contained"
              buttonColor="#f44336"
            >
              {isResetting ? 'Resetting...' : 'Reset All Data'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* App Info Dialog */}
      <Portal>
        <Dialog visible={appInfoDialogVisible} onDismiss={() => setAppInfoDialogVisible(false)}>
          <Dialog.Icon icon="information" color="#2196F3" size={60} />
          <Dialog.Title style={styles.dialogTitle}>App Information</Dialog.Title>
          <Dialog.Content>
            <View style={styles.versionContent}>
              <Text style={styles.versionLabel}>App Version:</Text>
              <Text style={styles.versionValue}>1.0.0</Text>
              
              <Text style={styles.versionLabel}>Build Number:</Text>
              <Text style={styles.versionValue}>1</Text>
              
              <Text style={styles.versionLabel}>Runtime Version:</Text>
              <Text style={styles.versionValue}>1.0.0</Text>
              
              <Text style={styles.versionLabel}>Developer:</Text>
              <Text style={styles.versionValue}>HLM Team</Text>
              
              <Text style={styles.versionLabel}>Credits:</Text>
              <Text style={[styles.versionValue, { fontSize: 14, lineHeight: 18 }]}>
                Built with React Native & Expo{'\n'}
                UI Components by React Native Paper{'\n'}
                Icons by Expo Vector Icons
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button 
              onPress={() => setAppInfoDialogVisible(false)} 
              textColor="#2196F3"
            >
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* What's New Dialog */}
      <Portal>
        <Dialog visible={whatsNewDialogVisible} onDismiss={() => setWhatsNewDialogVisible(false)}>
          <Dialog.Icon icon="star" color="#9C27B0" size={60} />
          <Dialog.Title style={[styles.dialogTitle, { color: '#9C27B0' }]}>What's New</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.versionLabel, { color: '#333', marginBottom: 16 }]}>
              ✨ Latest Updates & Features
            </Text>
            <Text style={[styles.versionValue, { color: '#555', lineHeight: 20 }]}>
              • Added comprehensive Settings screen{'\n'}
              • Reorganized app management features{'\n'}
              • Enhanced navigation structure{'\n'}
              • Improved user interface design{'\n'}
              • Better organization of utilities and tools
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button 
              onPress={() => setWhatsNewDialogVisible(false)}
              textColor="#9C27B0"
            >
              Got It
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Update Check Dialog */}
      <Portal>
        <Dialog visible={updateDialogVisible} dismissable={false}>
          <Dialog.Icon icon="download" color="#6200ee" size={60} />
          <Dialog.Title style={[styles.dialogTitle, { color: '#6200ee' }]}>App Updates</Dialog.Title>
          <Dialog.Content>
            <View style={styles.updateContent}>
              {isCheckingUpdate && (
                <ActivityIndicator 
                  animating={true} 
                  color="#6200ee" 
                  size="small" 
                  style={styles.updateLoader} 
                />
              )}
              <Text style={[styles.versionLabel, { color: '#333', textAlign: 'center', lineHeight: 20 }]}>
                {updateStatus}
              </Text>
            </View>
          </Dialog.Content>
          {!updateStatus.includes('seconds') && !isCheckingUpdate && (
            <Dialog.Actions>
              <Button 
                onPress={() => setUpdateDialogVisible(false)}
                textColor="#6200ee"
              >
                Close
              </Button>
            </Dialog.Actions>
          )}
        </Dialog>
      </Portal>

      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  scrollContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    marginBottom: 8,
  },
  settingItemSurface: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  settingItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingItemText: {
    flex: 1,
  },
  settingItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  settingItemDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 18,
  },
  settingItemArrow: {
    marginLeft: 8,
  },
  footerSpacing: {
    height: 40,
  },
  
  // Dialog Styles
  dialogTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  dialogContent: {
    fontSize: 16,
    lineHeight: 22,
    color: '#444',
    textAlign: 'center',
  },
  versionContent: {
    paddingVertical: 8,
  },
  versionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  versionValue: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  updateContent: {
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 80,
  },
  updateLoader: {
    marginBottom: 16,
  },
});
