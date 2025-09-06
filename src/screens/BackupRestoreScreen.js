import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ScrollView, 
  StyleSheet, 
  View, 
  Alert 
} from 'react-native';
import { 
  Text, 
  Button, 
  Card, 
  Snackbar, 
  IconButton, 
  Surface,
  Portal,
  Dialog,
  ActivityIndicator,
  Chip,
  Divider,
  TextInput
} from 'react-native-paper';
import { useGlobalStore } from '../utils/GlobalStore';
import BackupRestoreManager from '../utils/backupRestore';
import { format, parseISO } from 'date-fns';

export default function BackupRestoreScreen({ navigation }) {
  const { state, dispatch, refreshData } = useGlobalStore();
  
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '', type: 'info' });
  const [backupHistory, setBackupHistory] = useState([]);
  const [restoreDialogVisible, setRestoreDialogVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [restoreData, setRestoreData] = useState(null);
  const [manualInputVisible, setManualInputVisible] = useState(false);
  const [manualBackupText, setManualBackupText] = useState('');

  useEffect(() => {
    loadBackupHistory();
  }, []);

  const loadBackupHistory = async () => {
    try {
      const history = await BackupRestoreManager.getBackupHistory();
      setBackupHistory(history);
    } catch (error) {
      console.error('Failed to load backup history:', error);
    }
  };

  const handleExportBackup = async () => {
    setLoading(true);
    try {
      const result = await BackupRestoreManager.exportBackup(state);
      
      if (result.success) {
        setSnackbar({
          visible: true,
          message: `Backup shared successfully: ${result.fileName}`,
          type: 'success'
        });
        
        // Refresh backup history
        await loadBackupHistory();
      } else {
        setSnackbar({
          visible: true,
          message: `Export failed: ${result.error}`,
          type: 'error'
        });
      }
    } catch (error) {
      setSnackbar({
        visible: true,
        message: `Export failed: ${error.message}`,
        type: 'error'
      });
    }
    setLoading(false);
  };

  const handleExportToDownloads = async () => {
    setLoading(true);
    try {
      const result = await BackupRestoreManager.exportBackupToDownloads(state);
      
      if (result.success) {
        setSnackbar({
          visible: true,
          message: `Backup ready for download: ${result.fileName}`,
          type: 'success'
        });
        
        // Refresh backup history
        await loadBackupHistory();
      } else {
        setSnackbar({
          visible: true,
          message: `Download failed: ${result.error}`,
          type: 'error'
        });
      }
    } catch (error) {
      setSnackbar({
        visible: true,
        message: `Download failed: ${error.message}`,
        type: 'error'
      });
    }
    setLoading(false);
  };

  const handleCopyToClipboard = async () => {
    setLoading(true);
    try {
      const result = await BackupRestoreManager.copyBackupToClipboard(state);
      
      if (result.success) {
        setSnackbar({
          visible: true,
          message: `Backup copied to clipboard (${Math.round(result.size / 1024)}KB)`,
          type: 'success'
        });
      } else {
        setSnackbar({
          visible: true,
          message: `Copy failed: ${result.error}`,
          type: 'error'
        });
      }
    } catch (error) {
      setSnackbar({
        visible: true,
        message: `Copy failed: ${error.message}`,
        type: 'error'
      });
    }
    setLoading(false);
  };

  const handleImportBackup = async () => {
    setLoading(true);
    try {
      const result = await BackupRestoreManager.importBackup();
      
      if (result.canceled) {
        setLoading(false);
        return;
      }
      
      if (result.success) {
        setRestoreData(result);
        setRestoreDialogVisible(true);
      } else {
        setSnackbar({
          visible: true,
          message: `Import failed: ${result.error}`,
          type: 'error'
        });
      }
    } catch (error) {
      setSnackbar({
        visible: true,
        message: `Import failed: ${error.message}`,
        type: 'error'
      });
    }
    setLoading(false);
  };

  const handleManualImport = async () => {
    if (!manualBackupText.trim()) {
      setSnackbar({
        visible: true,
        message: 'Please paste the backup JSON content',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    setManualInputVisible(false);
    
    try {
      const result = await BackupRestoreManager.importBackupFromText(manualBackupText.trim());
      
      if (result.success) {
        setRestoreData(result);
        setRestoreDialogVisible(true);
        setManualBackupText(''); // Clear the text
      } else {
        setSnackbar({
          visible: true,
          message: `Manual import failed: ${result.error}`,
          type: 'error'
        });
      }
    } catch (error) {
      setSnackbar({
        visible: true,
        message: `Manual import failed: ${error.message}`,
        type: 'error'
      });
    }
    setLoading(false);
  };

  const confirmRestore = async () => {
    if (!restoreData) return;
    
    console.log('Starting restore confirmation process...');
    console.log('Restore data:', restoreData);
    console.log('Current state before restore:');
    console.log('- Workers:', state.workers?.length || 0);
    console.log('- Entries:', state.entries?.length || 0);
    console.log('- Payments:', state.payments?.length || 0);
    console.log('- Categories:', state.categories?.length || 0);
    
    setLoading(true);
    setRestoreDialogVisible(false);
    
    try {
      console.log('Calling BackupRestoreManager.restoreBackup...');
      const result = await BackupRestoreManager.restoreBackup(restoreData.data, dispatch);
      
      console.log('Restore result:', result);
      
      if (result.success) {
        // Validate and recalculate balances
        const validation = BackupRestoreManager.validateAndRecalculateBalances({
          ...restoreData.data,
          isInitialized: true
        });
        
        console.log('Post-restore validation:', validation);
        
        let message = 'Backup restored successfully!';
        if (validation.issues && validation.issues.length > 0) {
          message += ` Note: ${validation.issues.length} data integrity issues found.`;
        }
        
        setSnackbar({
          visible: true,
          message,
          type: validation.issues.length > 0 ? 'warning' : 'success'
        });
        
        // Refresh backup history
        await loadBackupHistory();
        
        // Force refresh the global store data
        console.log('Refreshing global store data...');
        if (refreshData) {
          await refreshData();
        }
        
        console.log('Restore process completed successfully');
        console.log('Current state after restore:', state);
      } else {
        console.log('Restore failed:', result.error);
        setSnackbar({
          visible: true,
          message: `Restore failed: ${result.error}`,
          type: 'error'
        });
      }
    } catch (error) {
      console.log('Restore process error:', error);
      setSnackbar({
        visible: true,
        message: `Restore failed: ${error.message}`,
        type: 'error'
      });
    }
    
    setLoading(false);
    setRestoreData(null);
  };

  const cleanupBackups = async () => {
    Alert.alert(
      'Cleanup Old Backups',
      'This will remove old backup files to free up space. Keep the 5 most recent backups?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cleanup',
          style: 'destructive',
          onPress: async () => {
            try {
              await BackupRestoreManager.cleanupOldBackups(5);
              await loadBackupHistory();
              setSnackbar({
                visible: true,
                message: 'Old backups cleaned up successfully',
                type: 'success'
              });
            } catch (error) {
              setSnackbar({
                visible: true,
                message: `Cleanup failed: ${error.message}`,
                type: 'error'
              });
            }
          }
        }
      ]
    );
  };

  const formatBackupDate = (timestamp) => {
    try {
      // Handle different timestamp formats
      if (timestamp.includes('_')) {
        // Format: yyyyMMdd_HHmmss
        const [date, time] = timestamp.split('_');
        const year = date.slice(0, 4);
        const month = date.slice(4, 6);
        const day = date.slice(6, 8);
        const hour = time.slice(0, 2);
        const minute = time.slice(2, 4);
        const second = time.slice(4, 6);
        return format(new Date(year, month - 1, day, hour, minute, second), 'dd/MM/yyyy HH:mm');
      } else {
        // Try parsing as ISO date
        return format(parseISO(timestamp), 'dd/MM/yyyy HH:mm');
      }
    } catch (error) {
      return timestamp; // Return original if parsing fails
    }
  };

  const currentDataSummary = {
    workers: state.workers?.length || 0,
    entries: state.entries?.length || 0,
    payments: state.payments?.length || 0,
    categories: state.categories?.length || 0,
    subcategories: state.subcategories?.length || 0,
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={[styles.headerContainer, { backgroundColor: '#f5f5f5' }]}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
          iconColor="#2c3e50"
        />
        <Text style={styles.screenTitle}>Backup & Restore</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Current Data Summary */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Current Data Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{currentDataSummary.workers}</Text>
                <Text style={styles.summaryLabel}>Workers</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{currentDataSummary.entries}</Text>
                <Text style={styles.summaryLabel}>Entries</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{currentDataSummary.payments}</Text>
                <Text style={styles.summaryLabel}>Payments</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{currentDataSummary.categories}</Text>
                <Text style={styles.summaryLabel}>Categories</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Backup Actions */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Backup Actions</Text>
            <Text style={styles.cardDescription}>
              Export your data to a file or import from a previously exported backup.
            </Text>
            
            <View style={styles.actionButtons}>
              {/* Export Section */}
              <Text style={styles.sectionSubtitle}>Export Options</Text>
              
              <Button
                mode="contained"
                onPress={handleExportBackup}
                disabled={loading}
                icon="share"
                style={styles.actionButton}
                contentStyle={styles.buttonContent}
              >
                Share Backup
              </Button>
              
              <Button
                mode="contained"
                onPress={handleExportToDownloads}
                disabled={loading}
                icon="download"
                style={[styles.actionButton, { backgroundColor: '#03dac6' }]}
                contentStyle={styles.buttonContent}
              >
                Quick Download
              </Button>
              
              <Button
                mode="outlined"
                onPress={handleCopyToClipboard}
                disabled={loading}
                icon="content-copy"
                style={styles.actionButton}
                contentStyle={styles.buttonContent}
              >
                Copy to Clipboard
              </Button>
              
              {/* Import Section */}
              <Text style={[styles.sectionSubtitle, { marginTop: 20 }]}>Import Options</Text>
              
              <Button
                mode="outlined"
                onPress={handleImportBackup}
                disabled={loading}
                icon="import"
                style={styles.actionButton}
                contentStyle={styles.buttonContent}
              >
                Import Backup
              </Button>
              
              <Button
                mode="text"
                onPress={() => setManualInputVisible(true)}
                disabled={loading}
                icon="clipboard-text"
                style={styles.actionButton}
                contentStyle={styles.buttonContent}
              >
                Manual Import
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Backup History */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Backup History</Text>
              {backupHistory.length > 5 && (
                <Button
                  mode="text"
                  onPress={cleanupBackups}
                  compact
                  textColor="#e74c3c"
                >
                  Cleanup
                </Button>
              )}
            </View>
            
            {backupHistory.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No backup history found</Text>
              </View>
            ) : (
              backupHistory.map((backup, index) => (
                <Surface key={backup.key} style={styles.backupItem} elevation={1}>
                  <View style={styles.backupInfo}>
                    <View style={styles.backupHeader}>
                      <Text style={styles.backupDate}>
                        {formatBackupDate(backup.timestamp)}
                      </Text>
                      <Chip 
                        mode="outlined" 
                        compact
                        style={[
                          styles.backupTypeChip,
                          backup.type === 'pre-restore' && { backgroundColor: '#fff3cd' }
                        ]}
                      >
                        {backup.type}
                      </Chip>
                    </View>
                    <Text style={styles.backupSummary}>
                      {backup.workers} workers, {backup.entries} entries, {backup.payments} payments
                    </Text>
                  </View>
                </Surface>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Usage Instructions */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Instructions</Text>
            <View style={styles.instructionsList}>
              <Text style={styles.instructionItem}>
                • <Text style={styles.instructionBold}>Export Backup:</Text> Creates a complete backup file that you can save to cloud storage or share.
              </Text>
              <Text style={styles.instructionItem}>
                • <Text style={styles.instructionBold}>Import Backup:</Text> Restores data from a previously exported backup file. This will replace all current data.
              </Text>
              <Text style={styles.instructionItem}>
                • <Text style={styles.instructionBold}>Auto Backup:</Text> The app automatically creates backups before major operations.
              </Text>
              <Text style={styles.instructionItem}>
                • <Text style={styles.instructionBold}>Data Validation:</Text> After restore, all balances are recalculated to ensure accuracy.
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <Surface style={styles.loadingCard} elevation={4}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Processing...</Text>
          </Surface>
        </View>
      )}

      {/* Restore Confirmation Dialog */}
      <Portal>
        <Dialog visible={restoreDialogVisible} onDismiss={() => setRestoreDialogVisible(false)}>
          <Dialog.Title>Confirm Restore</Dialog.Title>
          <Dialog.Content>
            {restoreData && (
              <View>
                <Text style={styles.dialogText}>
                  This will replace all current data with the backup from:
                </Text>
                <Text style={styles.dialogHighlight}>
                  {restoreData.metadata?.backupDate || 'Unknown date'}
                </Text>
                <Divider style={styles.dialogDivider} />
                <Text style={styles.dialogText}>Backup contains:</Text>
                <Text style={styles.dialogDetail}>
                  • {restoreData.metadata?.totalWorkers || 0} workers
                </Text>
                <Text style={styles.dialogDetail}>
                  • {restoreData.metadata?.totalEntries || 0} entries
                </Text>
                <Text style={styles.dialogDetail}>
                  • {restoreData.metadata?.totalPayments || 0} payments
                </Text>
                <Text style={styles.dialogWarning}>
                  ⚠️ Current data will be backed up automatically before restore.
                </Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRestoreDialogVisible(false)}>Cancel</Button>
            <Button onPress={confirmRestore} buttonColor="#e74c3c" textColor="white">
              Restore
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Manual Import Dialog */}
      <Portal>
        <Dialog visible={manualInputVisible} onDismiss={() => setManualInputVisible(false)}>
          <Dialog.Title>Manual Backup Import</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              If the file picker doesn't work with your cloud storage, you can manually copy and paste the backup JSON content here:
            </Text>
            <TextInput
              label="Paste backup JSON content"
              multiline
              numberOfLines={8}
              value={manualBackupText}
              onChangeText={setManualBackupText}
              mode="outlined"
              style={{ marginTop: 16 }}
              placeholder="Paste the entire content of your backup JSON file here..."
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => {
              setManualInputVisible(false);
              setManualBackupText('');
            }}>
              Cancel
            </Button>
            <Button 
              onPress={handleManualImport}
              disabled={!manualBackupText.trim()}
              buttonColor="#2196F3" 
              textColor="white"
            >
              Import
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Snackbar */}
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: '', type: 'info' })}
        duration={4000}
        style={[
          snackbar.type === 'success' && { backgroundColor: '#4caf50' },
          snackbar.type === 'error' && { backgroundColor: '#f44336' },
          snackbar.type === 'warning' && { backgroundColor: '#ff9800' },
        ]}
      >
        {snackbar.message}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
  },
  headerRight: {
    width: 40,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
    textAlign: 'center',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
    lineHeight: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 8,
  },
  actionButton: {
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  backupItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  backupInfo: {
    flex: 1,
  },
  backupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  backupDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  backupTypeChip: {
    height: 24,
  },
  backupSummary: {
    fontSize: 12,
    color: '#6c757d',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  instructionsList: {
    gap: 8,
  },
  instructionItem: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  instructionBold: {
    fontWeight: '600',
    color: '#2c3e50',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  
  // Section subtitle for better organization
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
    marginTop: 8,
  },
  
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#2c3e50',
  },
  dialogText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 8,
    lineHeight: 20,
  },
  dialogHighlight: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  dialogDivider: {
    marginVertical: 12,
  },
  dialogDetail: {
    fontSize: 14,
    color: '#495057',
    marginLeft: 8,
    marginBottom: 4,
  },
  dialogWarning: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
