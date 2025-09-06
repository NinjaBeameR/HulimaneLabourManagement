import React, { useState, useEffect } from 'react';
import { View, StatusBar, ScrollView, StyleSheet, AppState } from 'react-native';
import { PaperProvider, Dialog, Button, Paragraph, Portal, Surface, Text, Chip, Divider } from 'react-native-paper';
import * as Updates from 'expo-updates';
import AppNavigator from "./src/navigation/AppNavigator";
import { GlobalStoreProvider, useGlobalStore } from "./src/utils/GlobalStore";
import WhatsNewManager from "./src/utils/whatsNew";
import AutoBackupManager from "./src/utils/autoBackupManager";

export default function App() {
  const [whatsNewVisible, setWhatsNewVisible] = useState(false);
  const [whatsNewData, setWhatsNewData] = useState(null);

  useEffect(() => {
    // Check for What's New dialog
    checkWhatsNew();
    // Check for updates on app start
    checkForUpdatesOnStart();
  }, []);

  const checkForUpdatesOnStart = async () => {
    // 🔒 BULLETPROOF UPDATE SYSTEM - NEVER MODIFY THIS LOGIC
    // This system is designed to handle all future scenarios without changes
    
    try {
      // ✅ Environment validation - Always check this first
      if (!Updates.isEnabled) {
        console.log('🔄 Updates not enabled in this environment');
        return;
      }
      
      console.log('🔍 Checking for updates from GitHub...');
      
      // 🛡️ STRATEGY 1: Standard check with timeout protection
      let updateFound = false;
      
      try {
        console.log('📡 Step 1: Checking update availability...');
        const checkPromise = Updates.checkForUpdateAsync();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Check timeout')), 15000)
        );
        
        const checkResult = await Promise.race([checkPromise, timeoutPromise]);
        
        if (checkResult.isAvailable) {
          console.log('✅ Update available! Downloading...');
          
          // Download with timeout protection
          const downloadPromise = Updates.fetchUpdateAsync();
          const downloadTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Download timeout')), 60000)
          );
          
          const fetchedUpdate = await Promise.race([downloadPromise, downloadTimeout]);
          
          if (fetchedUpdate.isNew) {
            console.log('🚀 New update downloaded, applying immediately...');
            updateFound = true;
            
            // Apply update with error handling
            try {
              await Updates.reloadAsync();
            } catch (reloadError) {
              console.warn('⚠️ Failed to apply update automatically:', reloadError);
              // Continue execution - app still works with old version
            }
          }
        } else {
          console.log('ℹ️ No updates detected by standard check');
        }
      } catch (checkError) {
        console.warn('⚠️ Standard update check failed:', checkError.message);
      }
      
      // 🛡️ STRATEGY 2: Fallback fetch (only if no update found)
      if (!updateFound) {
        try {
          console.log('🔄 Step 2: Attempting fallback fetch...');
          const fallbackPromise = Updates.fetchUpdateAsync();
          const fallbackTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fallback timeout')), 30000)
          );
          
          const fallbackUpdate = await Promise.race([fallbackPromise, fallbackTimeout]);
          
          if (fallbackUpdate.isNew) {
            console.log('🎉 Fallback found update! Applying...');
            try {
              await Updates.reloadAsync();
            } catch (reloadError) {
              console.warn('⚠️ Fallback reload failed:', reloadError);
            }
          } else {
            console.log('✅ Connected to GitHub CDN, your app is up to date');
          }
        } catch (fallbackError) {
          console.warn('⚠️ Fallback fetch failed:', fallbackError.message);
          console.log('ℹ️ App will continue with current version');
        }
      }
      
      // 📊 Final status log
      console.log('🔄 Update check completed');
      
    } catch (criticalError) {
      // 🚨 Critical error handling - app should never crash
      console.error('🚨 Critical update system error:', criticalError);
      console.log('ℹ️ Update system failed safely - app continues normally');
      
      // Optional: Store error for debugging
      try {
        const errorInfo = {
          error: criticalError.message,
          timestamp: new Date().toISOString(),
          updateId: Updates.updateId || 'unknown',
          runtimeVersion: Updates.runtimeVersion || 'unknown'
        };
        console.log('📝 Error details:', JSON.stringify(errorInfo));
      } catch (logError) {
        // Even error logging failed - but app still works
        console.log('ℹ️ Error logging failed, but app continues');
      }
    }
  };

  const checkWhatsNew = async () => {
    try {
      const result = await WhatsNewManager.shouldShowWhatsNew();
      if (result.shouldShow) {
        setWhatsNewData(result);
        setWhatsNewVisible(true);
      }
    } catch (error) {
      console.warn('Error checking WhatsNew:', error);
    }
  };

  const handleDismissThisVersion = async () => {
    try {
      if (whatsNewData?.version) {
        await WhatsNewManager.markVersionSeen(whatsNewData.version);
        await WhatsNewManager.clearRemindLater(whatsNewData.version);
      }
      setWhatsNewVisible(false);
    } catch (error) {
      console.warn('Error dismissing WhatsNew:', error);
      setWhatsNewVisible(false);
    }
  };

  const handleRemindLater = async () => {
    try {
      if (whatsNewData?.version) {
        await WhatsNewManager.setRemindLater(whatsNewData.version);
      }
      setWhatsNewVisible(false);
    } catch (error) {
      console.warn('Error setting remind later:', error);
      setWhatsNewVisible(false);
    }
  };

  return (
    <GlobalStoreProvider>
      <AutoBackupComponent />
      <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <PaperProvider>
          <AppNavigator />
          
          <WhatsNewDialog
            visible={whatsNewVisible}
            data={whatsNewData}
            onDismissThisVersion={handleDismissThisVersion}
            onRemindLater={handleRemindLater}
          />
        </PaperProvider>
      </View>
    </GlobalStoreProvider>
  );
}

// Auto-backup component that runs inside GlobalStoreProvider
function AutoBackupComponent() {
  const { state } = useGlobalStore();
  
  useEffect(() => {
    // GitHub token is now loaded from environment variable (.env file)
    // No manual token setting needed
    
    let autoBackupInterval;
    
    const startAutoBackup = () => {
      // Clear any existing interval
      if (autoBackupInterval) {
        clearInterval(autoBackupInterval);
      }
      
      // Set up 3-minute interval for auto-backup
      autoBackupInterval = setInterval(async () => {
        try {
          const shouldBackup = await AutoBackupManager.shouldBackup(state);
          
          if (shouldBackup.should) {
            console.log('Performing auto-backup...');
            const result = await AutoBackupManager.performBackup(state);
            
            if (result.success) {
              console.log('✅ Auto-backup successful:', result.message);
            } else {
              console.log('❌ Auto-backup failed:', result.message);
            }
          } else {
            console.log('Auto-backup skipped:', shouldBackup.reason);
          }
        } catch (error) {
          console.log('Auto-backup error:', error);
        }
      }, AutoBackupManager.BACKUP_INTERVAL);
      
      console.log('Auto-backup timer started (3-minute intervals)');
    };
    
    // Start the auto-backup timer
    startAutoBackup();
    
    // Cleanup on unmount
    return () => {
      if (autoBackupInterval) {
        clearInterval(autoBackupInterval);
        console.log('Auto-backup timer stopped');
      }
    };
  }, [state]);
  
  return null; // This component doesn't render anything
}
function WhatsNewDialog({ visible, data, onDismissThisVersion, onRemindLater }) {
  const getCategoryColor = (category) => {
    switch (category) {
      case 'feature': return '#4CAF50';
      case 'bugfix': return '#FF9800';
      case 'security': return '#F44336';
      case 'improvement': return '#2196F3';
      default: return '#6200ee';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'critical': return 'Critical Update';
      case 'important': return 'Important Update';
      default: return 'Update Available';
    }
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={data?.priority === 'critical' ? undefined : onDismissThisVersion}
        style={styles.dialog}
      >
        <Surface style={styles.dialogSurface} elevation={8}>
          {/* Header */}
          <View style={styles.dialogHeader}>
            <Text style={styles.dialogIcon}>{data?.icon || '📱'}</Text>
            <View style={styles.headerText}>
              <Text style={styles.dialogTitle}>
                {data?.title || `What's New in v${data?.version}`}
              </Text>
              <Chip 
                mode="flat" 
                style={[styles.priorityChip, { backgroundColor: getCategoryColor(data?.category) }]}
                textStyle={styles.chipText}
              >
                {getPriorityLabel(data?.priority)}
              </Chip>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Content */}
          <ScrollView style={styles.dialogContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.versionText}>Version {data?.version}</Text>
            <Paragraph style={styles.messageText}>
              {data?.message}
            </Paragraph>
          </ScrollView>

          {/* Actions */}
          <View style={styles.dialogActions}>
            {data?.priority !== 'critical' && (
              <Button 
                onPress={onRemindLater}
                style={styles.secondaryButton}
                labelStyle={styles.secondaryButtonText}
              >
                Remind Me in 7 Days
              </Button>
            )}
            <Button 
              onPress={onDismissThisVersion}
              mode="contained"
              style={[styles.primaryButton, { backgroundColor: getCategoryColor(data?.category) }]}
              labelStyle={styles.primaryButtonText}
            >
              {data?.priority === 'critical' ? 'Got It' : "Don't Show for This Version"}
            </Button>
          </View>
        </Surface>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    margin: 20,
  },
  dialogSurface: {
    borderRadius: 16,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    backgroundColor: '#f8f9fa',
  },
  dialogIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  priorityChip: {
    alignSelf: 'flex-start',
  },
  chipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dialogContent: {
    maxHeight: 300,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  versionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    paddingTop: 8,
    backgroundColor: '#f8f9fa',
    gap: 8,
  },
  secondaryButton: {
    marginRight: 8,
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 14,
  },
  primaryButton: {
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
