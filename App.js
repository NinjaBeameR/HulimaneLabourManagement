import React, { useState, useEffect } from 'react';
import { View, StatusBar, ScrollView, StyleSheet } from 'react-native';
import { PaperProvider, Dialog, Button, Paragraph, Portal, Surface, Text, Chip, Divider } from 'react-native-paper';
import * as Updates from 'expo-updates';
import AppNavigator from "./src/navigation/AppNavigator";
import { GlobalStoreProvider } from "./src/utils/GlobalStore";
import WhatsNewManager from "./src/utils/whatsNew";

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
    try {
      // Only check for updates in production builds
      if (__DEV__ || !Updates.isEnabled) return;
      
      console.log('Checking for updates from GitHub on app start...');
      
      // For GitHub-based OTA, directly try to fetch updates
      const fetchedUpdate = await Updates.fetchUpdateAsync();
      
      if (fetchedUpdate.isNew) {
        console.log('New update downloaded from GitHub, applying immediately...');
        // Apply the update immediately instead of waiting for next restart
        try {
          await Updates.reloadAsync();
        } catch (reloadError) {
          console.warn('Failed to apply update automatically:', reloadError);
        }
      } else {
        console.log('Connected to GitHub CDN, your app is up to date');
      }
    } catch (error) {
      console.warn('GitHub OTA auto-update check failed:', error);
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
