import React, { useEffect, useState, useCallback } from "react";
import RNPickerSelect from 'react-native-picker-select';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  StatusBar, 
  TouchableOpacity, 
  Modal, 
  Animated, 
  Dimensions,
  ScrollView,
  Appearance
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Text, 
  Button, 
  Snackbar, 
  Surface, 
  Divider, 
  Chip, 
  Appbar, 
  ActivityIndicator,
  Portal,
  Dialog,
  RadioButton,
  IconButton
} from "react-native-paper";
import { useGlobalStore } from '../utils/GlobalStore';
import { getWorkerBalance, getAllWorkersBalances } from '../utils/balance';
import * as FileSystem from "expo-file-system";
import Papa from "papaparse";
import Ionicons from '@expo/vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

export default function SummaryScreen({ navigation }) {
  const { state, refreshData } = useGlobalStore();
  const workers = state.workers;
  const categories = state.categories;
  const allSubcategories = state.subcategories;
  
  const [filterWorker, setFilterWorker] = useState("all");
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState([]);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  
  // Export-related states
  const [exportDialog, setExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState('excel'); // 'excel' or 'pdf'
  const [exportWorker, setExportWorker] = useState('all'); // 'all' or specific worker ID
  const [exportFromDate, setExportFromDate] = useState(null);
  const [exportToDate, setExportToDate] = useState(null);
  const [showExportFromPicker, setShowExportFromPicker] = useState(false);
  const [showExportToPicker, setShowExportToPicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportPreview, setExportPreview] = useState(null);

  useEffect(() => {
    buildSummary();
    
    // Listen for color scheme changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    
    return () => subscription.remove();
  }, [workers, state.entries, state.payments, filterWorker, from, to]);

  const updateExportPreview = useCallback(() => {
    try {
      console.log('updateExportPreview called');
      
      // Temporary simple fallback - just set a basic preview
      setExportPreview({
        workers: state?.workers?.length || 0,
        entries: state?.entries?.length || 0,  
        payments: state?.payments?.length || 0,
        totalEarnings: '₹0.00',
        dateRange: 'All_Time'
      });
      
      // TODO: Re-enable full export preview functionality after debugging
      /*
      if (!state || !state.workers) {
        console.log('State not ready for export preview');
        setExportPreview(null);
        return;
      }
      
      const exportManager = new ExportManager(state);
      const workerId = exportWorker === 'all' ? null : exportWorker;
      const preview = exportManager.getExportPreview(workerId, exportFromDate, exportToDate);
      setExportPreview(preview);
      */
    } catch (error) {
      console.error('Error updating export preview:', error);
      setExportPreview({
        workers: 0,
        entries: 0,
        payments: 0,
        totalEarnings: '₹0.00',
        dateRange: 'Error'
      });
    }
  }, [state, exportWorker, exportFromDate, exportToDate]);

  // Update export preview when export options change
  useEffect(() => {
    if (exportDialog) {
      updateExportPreview();
    }
  }, [exportDialog, updateExportPreview]);

  const handleExport = async () => {
    if (exporting) return;
    
    setExporting(true);
    console.log(`📊 Starting ${exportFormat.toUpperCase()} export...`);

    try {
      // Validate state before proceeding
      if (!state || !state.workers || !Array.isArray(state.workers)) {
        throw new Error('Invalid application state for export');
      }

      // Dynamic import to avoid loading issues
      const { ExportManager } = await import('../utils/exportUtils');
      const exportManager = new ExportManager(state);
      const workerId = exportWorker === 'all' ? null : exportWorker;
      
      const exportOptions = {
        workerId,
        fromDate: exportFromDate,
        toDate: exportToDate
      };

      let result;
      if (exportFormat === 'excel') {
        result = await exportManager.exportExcel(exportOptions);
      } else {
        result = await exportManager.exportPDF(exportOptions);
      }

      if (result?.success) {
        setSnackbar({ 
          visible: true, 
          message: `✅ ${exportFormat.toUpperCase()} exported successfully! File: ${result.filename}` 
        });
        setExportDialog(false);
        
        // Reset export options
        setExportWorker('all');
        setExportFromDate(null);
        setExportToDate(null);
        setExportFormat('excel');
      } else {
        setSnackbar({ 
          visible: true, 
          message: `❌ Export failed: ${result?.error || 'Unknown error'}` 
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      setSnackbar({ 
        visible: true, 
        message: `❌ Export failed: ${error.message}` 
      });
    } finally {
      setExporting(false);
    }
  };

  const buildSummary = () => {
    let filteredWorkers = workers;
    
    if (filterWorker !== "all") {
      const selectedWorkerObj = workers.find(w => w.id === filterWorker);
      filteredWorkers = selectedWorkerObj ? [selectedWorkerObj] : [];
    }

    const summaryData = filteredWorkers.map(worker => {
      // Get current balance using correct function signature
      const currentBalance = getWorkerBalance(worker.id, { workers, entries: state.entries, payments: state.payments });
      
      // Filter entries by date range
      let workerEntries = state.entries.filter(e => e.workerId === worker.id);
      let workerPayments = state.payments.filter(p => p.workerId === worker.id);
      
      if (from) {
        const fromDate = from.toISOString().split('T')[0];
        workerEntries = workerEntries.filter(e => e.date >= fromDate);
        workerPayments = workerPayments.filter(p => p.date >= fromDate);
      }
      
      if (to) {
        const toDate = to.toISOString().split('T')[0];
        workerEntries = workerEntries.filter(e => e.date <= toDate);
        workerPayments = workerPayments.filter(p => p.date <= toDate);
      }

      const entryAmount = workerEntries.reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);
      const paymentAmount = workerPayments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
      const openingBalance = parseFloat(worker.openingBalance || 0);
      
      return {
        workerId: worker.id,
        workerName: worker.name,
        openingBalance: openingBalance || 0,
        entryAmount: entryAmount || 0,
        paymentAmount: paymentAmount || 0,
        balance: parseFloat(currentBalance) || 0,
        entries: workerEntries,
        payments: workerPayments,
        attendanceDays: workerEntries.length
      };
    });

    setSummaryRows(summaryData);
  };

  const handleRefresh = async () => {
    await refreshData();
    buildSummary();
  };

  const handleLegacyExport = async (attendanceOnly = false) => {
    setLoading(true);
    let rows = [];
    
    if (attendanceOnly) {
      rows.push(['Worker', 'Date', 'Status', 'Category', 'Subcategory', 'Amount', 'Narration']);
      for (const r of summaryRows) {
        for (const e of r.entries) {
          const category = categories.find(c => c.id === e.categoryId);
          const subcategory = allSubcategories.find(s => s.id === e.subcategoryId);
          rows.push([
            r.workerName,
            e.date,
            e.status === 'P' ? 'Present' : e.status === 'H' ? 'Half Day' : 'Absent',
            category?.category || '',
            subcategory?.subcategoryName || '',
            e.amount || 0,
            e.narration || ''
          ]);
        }
      }
    } else {
      rows.push(['Worker', 'Opening Balance', 'Total Entries', 'Total Payments', 'Current Balance', 'Attendance Days']);
      for (const r of summaryRows) {
        rows.push([
          r.workerName,
          r.openingBalance,
          r.entryAmount,
          r.paymentAmount,
          r.balance,
          r.entries.length
        ]);
      }
    }
    
    const csv = Papa.unparse(rows);
    const filename = attendanceOnly 
      ? `attendance_${new Date().toISOString().slice(0, 10)}.csv`
      : `summary_${new Date().toISOString().slice(0, 10)}.csv`;
    const path = FileSystem.documentDirectory + filename;
    
    try {
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      setSnackbar({ visible: true, message: `Exported to ${filename}` });
    } catch (err) {
      setSnackbar({ visible: true, message: `Export failed: ${err.message}` });
    }
    setLoading(false);
  };

  const openWorkerDetails = (worker) => {
    setSelectedWorker(worker);
    setModalVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeWorkerDetails = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      setSelectedWorker(null);
    });
  };

  const renderWorkerRow = ({ item, index }) => (
    <TouchableOpacity 
      style={styles.workerRow}
      onPress={() => openWorkerDetails(item)}
      activeOpacity={0.7}
    >
      <Surface style={styles.workerCard} elevation={2}>
        <View style={styles.workerCardContent}>
          <View style={styles.workerInfo}>
            <Text variant="titleMedium" style={styles.workerName}>
              {item.workerName}
            </Text>
            <Text variant="bodySmall" style={styles.attendanceText}>
              {item.attendanceDays || 0} working days
            </Text>
          </View>
          
          <View style={styles.amountsSection}>
            <View style={styles.amountItem}>
              <Text variant="bodySmall" style={styles.amountLabel}>Balance</Text>
              <Text variant="titleSmall" style={[
                styles.balanceAmount,
                { color: (item.balance || 0) >= 0 ? '#4CAF50' : '#F44336' }
              ]}>
                ₹{(item.balance || 0).toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.amountItem}>
              <Text variant="bodySmall" style={styles.amountLabel}>Payments</Text>
              <Text variant="titleSmall" style={[styles.paymentAmount, { color: '#F44336' }]}>
                ₹{(item.paymentAmount || 0).toLocaleString()}
              </Text>
            </View>
          </View>
          
          <View style={styles.expandIcon}>
            <Ionicons name="chevron-forward" size={20} color="#666666" />
          </View>
        </View>
      </Surface>
    </TouchableOpacity>
  );

  const renderWorkerDetailsModal = () => {
    if (!selectedWorker) return null;

    return (
      <Portal>
        <Modal
          visible={modalVisible}
          animationType="none"
          transparent={true}
          onRequestClose={closeWorkerDetails}
        >
          <View style={styles.modalOverlay}>
            <Animated.View 
              style={[
                styles.modalContainer,
                { opacity: fadeAnim }
              ]}
            >
              <Surface style={styles.modalSurface} elevation={8}>
                <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <Text variant="headlineSmall" style={styles.modalTitle}>
                      {selectedWorker.workerName}
                    </Text>
                    <TouchableOpacity onPress={closeWorkerDetails} style={styles.closeButton}>
                      <Ionicons name="close" size={24} color="#666666" />
                    </TouchableOpacity>
                  </View>

                  <Divider style={styles.modalDivider} />

                  {/* Balance Summary */}
                  <View style={styles.modalSection}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                      Balance Summary
                    </Text>
                    <View style={styles.balanceGrid}>
                      <View style={styles.balanceCard}>
                        <Text variant="bodySmall" style={styles.balanceCardLabel}>Opening</Text>
                        <Text variant="titleMedium" style={styles.balanceCardValue}>
                          ₹{(selectedWorker.openingBalance || 0).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.balanceCard}>
                        <Text variant="bodySmall" style={styles.balanceCardLabel}>Entries</Text>
                        <Text variant="titleMedium" style={[styles.balanceCardValue, { color: '#4CAF50' }]}>
                          +₹{(selectedWorker.entryAmount || 0).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.balanceCard}>
                        <Text variant="bodySmall" style={styles.balanceCardLabel}>Payments</Text>
                        <Text variant="titleMedium" style={[styles.balanceCardValue, { color: '#F44336' }]}>
                          -₹{(selectedWorker.paymentAmount || 0).toLocaleString()}
                        </Text>
                      </View>
                      <View style={[styles.balanceCard, styles.currentBalanceCard]}>
                        <Text variant="bodySmall" style={styles.balanceCardLabel}>Current</Text>
                        <Text variant="titleMedium" style={[
                          styles.balanceCardValue,
                          { color: (selectedWorker.balance || 0) >= 0 ? '#4CAF50' : '#F44336' }
                        ]}>
                          ₹{(selectedWorker.balance || 0).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Attendance Summary */}
                  <View style={styles.modalSection}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                      Attendance Summary
                    </Text>
                    <View style={styles.attendanceInfo}>
                      <Chip mode="outlined" style={styles.attendanceChip}>
                        {selectedWorker.attendanceDays || 0} working days
                      </Chip>
                      <Text variant="bodyMedium" style={styles.attendanceNote}>
                        Total entries recorded during selected period
                      </Text>
                    </View>
                  </View>

                  {/* Recent Entries */}
                  {selectedWorker.entries && selectedWorker.entries.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text variant="titleMedium" style={styles.sectionTitle}>
                        Recent Entries ({selectedWorker.entries?.length || 0})
                      </Text>
                      {selectedWorker.entries.slice(0, 5).map((entry, index) => (
                        <Surface key={index} style={styles.entryCard} elevation={1}>
                          <View style={styles.entryCardContent}>
                            <Text variant="bodyMedium" style={styles.entryDate}>
                              {new Date(entry.date).toLocaleDateString()}
                            </Text>
                            <Text variant="bodySmall" style={styles.entryStatus}>
                              {entry.status === 'P' ? 'Present' : entry.status === 'H' ? 'Half Day' : 'Absent'}
                            </Text>
                            <Text variant="titleSmall" style={[styles.entryAmount, { color: '#4CAF50' }]}>
                              ₹{parseFloat(entry.amount || 0).toLocaleString()}
                            </Text>
                          </View>
                        </Surface>
                      ))}
                    </View>
                  )}

                  {/* Recent Payments */}
                  {selectedWorker.payments && selectedWorker.payments.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text variant="titleMedium" style={styles.sectionTitle}>
                        Recent Payments ({selectedWorker.payments?.length || 0})
                      </Text>
                      {selectedWorker.payments.slice(0, 5).map((payment, index) => (
                        <Surface key={index} style={styles.paymentCard} elevation={1}>
                          <View style={styles.paymentCardContent}>
                            <Text variant="bodyMedium" style={styles.paymentDate}>
                              {new Date(payment.date).toLocaleDateString()}
                            </Text>
                            <Text variant="bodySmall" style={styles.paymentNarration}>
                              {payment.narration || 'Payment'}
                            </Text>
                            <Text variant="titleSmall" style={[styles.paymentAmount, { color: '#F44336' }]}>
                              -₹{parseFloat(payment.amount || 0).toLocaleString()}
                            </Text>
                          </View>
                        </Surface>
                      ))}
                    </View>
                  )}
                  
                  {/* Action Buttons */}
                  <View style={styles.modalSection}>
                    <Button
                      mode="contained"
                      onPress={() => {
                        closeWorkerDetails();
                        navigation.navigate('LedgerScreen', { workerId: selectedWorker.workerId });
                      }}
                      icon="book-open"
                      style={styles.ledgerButton}
                      contentStyle={styles.buttonContent}
                    >
                      View Transaction Ledger
                    </Button>
                  </View>
                </ScrollView>
              </Surface>
            </Animated.View>
          </View>
        </Modal>
      </Portal>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      
      <StatusBar backgroundColor="#6200EE" barStyle="light-content" />
      
      <Appbar.Header elevated>
        <Appbar.Content title="Worker Summary" />
        <Appbar.Action 
          icon="refresh" 
          onPress={handleRefresh} 
          iconColor="#FFFFFF"
        />
      </Appbar.Header>



      <View style={styles.content}>
        {/* Filter Panel */}
        <Surface style={styles.filterPanel} elevation={2}>
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              <Text variant="bodySmall" style={styles.filterLabel}>Worker</Text>
              <Surface style={styles.pickerSurface} elevation={1}>
                <RNPickerSelect
                  onValueChange={(value) => setFilterWorker(value)}
                  items={[
                    { label: 'All Workers', value: 'all', key: 'filter-all' },
                    ...workers.map((w, index) => ({ label: w.name, value: w.id, key: `filter-worker-${index}` }))
                  ]}
                  style={pickerSelectStyles}
                  value={filterWorker}
                  placeholder={{ label: "Select worker", value: null }}
                />
              </Surface>
            </View>
          </View>

          <View style={styles.dateRow}>
            <TouchableOpacity 
              style={styles.dateButton} 
              onPress={() => setShowFromPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#6200EE" />
              <Text variant="bodyMedium" style={styles.dateText}>
                {from ? from.toLocaleDateString() : "From Date"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.dateButton} 
              onPress={() => setShowToPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#6200EE" />
              <Text variant="bodyMedium" style={styles.dateText}>
                {to ? to.toLocaleDateString() : "To Date"}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.exportButtons}>
            <Button 
              mode="contained" 
              onPress={() => setExportDialog(true)} 
              disabled={summaryRows.length === 0 || loading}
              icon="file-export"
              style={styles.exportButton}
              contentStyle={styles.buttonContent}
            >
              📊 Export Report
            </Button>
            <Button 
              mode="outlined" 
              onPress={() => handleLegacyExport(true)} 
              disabled={summaryRows.length === 0 || loading}
              icon="calendar"
              style={styles.exportButton}
              contentStyle={styles.buttonContent}
            >
              📅 Quick CSV
            </Button>
          </View>
        </Surface>

        {/* Date Pickers */}
        {showFromPicker && (
          <DateTimePicker
            value={from || new Date()}
            mode="date"
            display="default"
            onChange={(e, d) => { setShowFromPicker(false); if (d) setFrom(d); }}
          />
        )}
        {showToPicker && (
          <DateTimePicker
            value={to || new Date()}
            mode="date"
            display="default"
            onChange={(e, d) => { setShowToPicker(false); if (d) setTo(d); }}
          />
        )}

        {/* Main Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6200EE" />
            <Text variant="bodyMedium" style={styles.loadingText}>
              Generating report...
            </Text>
          </View>
        ) : summaryRows.length === 0 ? (
          <Surface style={styles.emptyState} elevation={1}>
            <Ionicons name="document-text-outline" size={64} color="#B0B3B8" />
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              No Data Found
            </Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              {workers.length === 0 
                ? "Add workers and entries from other screens to see summary data" 
                : "No entries match your filter criteria"}
            </Text>
            <Button 
              mode="outlined" 
              onPress={buildSummary}
              icon="refresh"
              style={styles.refreshButton}
            >
              Refresh Data
            </Button>
          </Surface>
        ) : (
          <>
            {/* Summary Stats */}
            <Surface style={styles.statsPanel} elevation={1}>
              <Text variant="titleMedium" style={styles.statsTitle}>
                Summary ({summaryRows.length} workers)
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text variant="bodySmall" style={styles.statLabel}>Total Balance</Text>
                  <Text variant="titleMedium" style={[
                    styles.statValue,
                    { color: summaryRows.reduce((sum, row) => sum + (row.balance || 0), 0) >= 0 ? '#4CAF50' : '#F44336' }
                  ]}>
                    ₹{summaryRows.reduce((sum, row) => sum + (row.balance || 0), 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="bodySmall" style={styles.statLabel}>Total Payments</Text>
                  <Text variant="titleMedium" style={[styles.statValue, { color: '#F44336' }]}>
                    ₹{summaryRows.reduce((sum, row) => sum + (row.paymentAmount || 0), 0).toLocaleString()}
                  </Text>
                </View>
              </View>
            </Surface>

            {/* Worker List */}
            <FlatList
              data={summaryRows}
              renderItem={renderWorkerRow}
              keyExtractor={(item) => item.workerId}
              style={styles.workerList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
            />
          </>
        )}
      </View>
      
      {renderWorkerDetailsModal()}

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbar.message}
      </Snackbar>

      {/* Export Dialog */}
      <Portal>
        <Modal
          visible={exportDialog}
          onDismiss={() => setExportDialog(false)}
          contentContainerStyle={styles.exportModalContainer}
        >
          <SafeAreaView style={styles.exportModalSafeArea}>
            <View style={styles.exportModalContent}>
              {/* Header */}
              <View style={styles.exportModalHeader}>
                <Text variant="headlineSmall" style={styles.exportModalTitle}>
                  📊 Export Report
                </Text>
                <IconButton 
                  icon="close" 
                  onPress={() => setExportDialog(false)}
                  style={styles.closeButton}
                  iconColor="#666"
                />
              </View>

              {/* Scrollable Content */}
              <ScrollView 
                style={styles.exportScrollView}
                contentContainerStyle={styles.exportScrollContent}
                showsVerticalScrollIndicator={true}
                bounces={false}
              >
                {/* Export Format Section */}
                <View style={styles.exportSectionContainer}>
                  <Text variant="titleMedium" style={styles.exportSectionTitle}>
                    📄 Choose Export Format
                  </Text>
                  <View style={styles.formatSelectionContainer}>
                    <TouchableOpacity 
                      style={[
                        styles.formatOptionCard, 
                        exportFormat === 'excel' && styles.formatOptionSelected
                      ]}
                      onPress={() => setExportFormat('excel')}
                    >
                      <View style={styles.formatOptionIcon}>
                        <Text style={styles.formatOptionEmoji}>📊</Text>
                      </View>
                      <Text style={[
                        styles.formatOptionTitle,
                        exportFormat === 'excel' && styles.formatOptionTitleSelected
                      ]}>
                        Excel Report
                      </Text>
                      <Text style={[
                        styles.formatOptionDesc,
                        exportFormat === 'excel' && styles.formatOptionDescSelected
                      ]}>
                        Detailed spreadsheet with all data
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[
                        styles.formatOptionCard, 
                        exportFormat === 'pdf' && styles.formatOptionSelected
                      ]}
                      onPress={() => setExportFormat('pdf')}
                    >
                      <View style={styles.formatOptionIcon}>
                        <Text style={styles.formatOptionEmoji}>📄</Text>
                      </View>
                      <Text style={[
                        styles.formatOptionTitle,
                        exportFormat === 'pdf' && styles.formatOptionTitleSelected
                      ]}>
                        PDF Report
                      </Text>
                      <Text style={[
                        styles.formatOptionDesc,
                        exportFormat === 'pdf' && styles.formatOptionDescSelected
                      ]}>
                        Professional formatted document
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Divider style={styles.exportSectionDivider} />

                {/* Worker Selection Section */}
                <View style={styles.exportSectionContainer}>
                  <Text variant="titleMedium" style={styles.exportSectionTitle}>
                    👥 Select Workers ({workers.length} total)
                  </Text>
                  <RadioButton.Group 
                    onValueChange={setExportWorker} 
                    value={exportWorker}
                  >
                    <View style={styles.radioOptionContainer}>
                      <RadioButton value="all" color="#6200EE" />
                      <Text style={styles.radioOptionText}>All Workers</Text>
                      <Chip mode="outlined" compact style={styles.workerCountChip}>
                        {workers.length}
                      </Chip>
                    </View>
                    
                    <ScrollView 
                      style={styles.workerListScrollContainer}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                    >
                      {workers.map(worker => (
                        <View key={worker.id} style={styles.radioOptionContainer}>
                          <RadioButton value={worker.id} color="#6200EE" />
                          <Text style={styles.radioOptionText} numberOfLines={1}>
                            {worker.name}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </RadioButton.Group>
                </View>

                <Divider style={styles.exportSectionDivider} />

                {/* Date Range Section */}
                <View style={styles.exportSectionContainer}>
                  <Text variant="titleMedium" style={styles.exportSectionTitle}>
                    📅 Date Range (Optional)
                  </Text>
                  <View style={styles.dateRangeRow}>
                    <TouchableOpacity 
                      style={styles.dateSelectionCard}
                      onPress={() => setShowExportFromPicker(true)}
                    >
                      <Text style={styles.dateCardLabel}>From Date</Text>
                      <Text style={styles.dateCardValue}>
                        {exportFromDate ? exportFromDate.toLocaleDateString() : 'Select Date'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.dateSelectionCard}
                      onPress={() => setShowExportToPicker(true)}
                    >
                      <Text style={styles.dateCardLabel}>To Date</Text>
                      <Text style={styles.dateCardValue}>
                        {exportToDate ? exportToDate.toLocaleDateString() : 'Select Date'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {(exportFromDate || exportToDate) && (
                    <View style={styles.dateActionsRow}>
                      {exportFromDate && (
                        <Button 
                          mode="text" 
                          onPress={() => setExportFromDate(null)}
                          compact
                          style={styles.clearDateButton}
                        >
                          Clear From
                        </Button>
                      )}
                      {exportToDate && (
                        <Button 
                          mode="text" 
                          onPress={() => setExportToDate(null)}
                          compact
                          style={styles.clearDateButton}
                        >
                          Clear To
                        </Button>
                      )}
                    </View>
                  )}
                </View>

                {/* Export Preview Section */}
                {exportPreview && (
                  <>
                    <Divider style={styles.exportSectionDivider} />
                    <View style={styles.exportSectionContainer}>
                      <Text variant="titleMedium" style={styles.exportSectionTitle}>
                        📋 Export Preview
                      </Text>
                      <Surface style={styles.previewContainer} elevation={1}>
                        <View style={styles.previewGrid}>
                          <View style={styles.previewCard}>
                            <Text style={styles.previewLabel}>Workers</Text>
                            <Text style={styles.previewValue}>{exportPreview.workers}</Text>
                          </View>
                          <View style={styles.previewCard}>
                            <Text style={styles.previewLabel}>Entries</Text>
                            <Text style={styles.previewValue}>{exportPreview.entries}</Text>
                          </View>
                          <View style={styles.previewCard}>
                            <Text style={styles.previewLabel}>Payments</Text>
                            <Text style={styles.previewValue}>{exportPreview.payments}</Text>
                          </View>
                          <View style={styles.previewCard}>
                            <Text style={styles.previewLabel}>Total</Text>
                            <Text style={styles.previewValueHighlight}>{exportPreview.totalEarnings}</Text>
                          </View>
                        </View>
                      </Surface>
                    </View>
                  </>
                )}
              </ScrollView>

              {/* Fixed Action Buttons */}
              <View style={styles.exportModalActions}>
                <Button 
                  mode="outlined" 
                  onPress={() => setExportDialog(false)}
                  disabled={exporting}
                  style={styles.modalCancelButton}
                  labelStyle={styles.modalButtonLabel}
                >
                  Cancel
                </Button>
                <Button 
                  mode="contained" 
                  onPress={handleExport}
                  loading={exporting}
                  disabled={exporting || !exportPreview}
                  icon={exportFormat === 'excel' ? 'file-excel' : 'file-pdf-box'}
                  style={styles.modalExportButton}
                  labelStyle={styles.modalButtonLabel}
                >
                  {exporting ? 'Exporting...' : `Export ${exportFormat === 'excel' ? 'Excel' : 'PDF'}`}
                </Button>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      </Portal>

      {/* Export Date Pickers */}
      {showExportFromPicker && (
        <DateTimePicker
          value={exportFromDate || new Date()}
          mode="date"
          display="default"
          onChange={(e, d) => { 
            setShowExportFromPicker(false); 
            if (d) setExportFromDate(d); 
          }}
        />
      )}
      {showExportToPicker && (
        <DateTimePicker
          value={exportToDate || new Date()}
          mode="date"
          display="default"
          onChange={(e, d) => { 
            setShowExportToPicker(false); 
            if (d) setExportToDate(d); 
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  content: {
    flex: 1,
    paddingBottom: 16, // Add bottom padding to prevent cutoff
  },
  filterPanel: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  filterRow: {
    marginBottom: 16,
  },
  filterGroup: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 8,
  },
  pickerSurface: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8F9FA',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  dateText: {
    color: '#333333',
    flex: 1,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  exportButton: {
    flex: 1,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    color: '#666666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
    padding: 40,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  refreshButton: {
    borderRadius: 12,
  },
  statsPanel: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#666666',
    marginBottom: 4,
  },
  statValue: {
    fontWeight: '600',
  },
  workerList: {
    flex: 1,
    marginHorizontal: 16,
  },
  listContent: {
    paddingBottom: 40, // Increased padding to ensure nothing is cut off
  },
  listSeparator: {
    height: 12,
  },
  workerRow: {
    marginBottom: 8,
  },
  workerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  workerCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  attendanceText: {
    color: '#666666',
  },
  amountsSection: {
    alignItems: 'flex-end',
    marginRight: 16,
  },
  amountItem: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  amountLabel: {
    color: '#666666',
    fontSize: 12,
  },
  balanceAmount: {
    fontWeight: '600',
    fontSize: 16,
  },
  paymentAmount: {
    fontWeight: '600',
    fontSize: 14,
  },
  expandIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '90%',
  },
  modalSurface: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalScrollView: {
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 8,
  },
  modalDivider: {
    backgroundColor: '#E0E0E0',
  },
  modalSection: {
    padding: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  balanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  balanceCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  currentBalanceCard: {
    backgroundColor: '#E8F5E8',
  },
  balanceCardLabel: {
    color: '#666666',
    marginBottom: 8,
    textAlign: 'center',
  },
  balanceCardValue: {
    fontWeight: '600',
    textAlign: 'center',
  },
  attendanceInfo: {
    alignItems: 'center',
  },
  attendanceChip: {
    backgroundColor: '#E3F2FD',
    marginBottom: 8,
  },
  attendanceNote: {
    color: '#666666',
    textAlign: 'center',
  },
  entryCard: {
    backgroundColor: '#F8FFF8',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  entryCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  entryDate: {
    fontWeight: '500',
    color: '#1A1A1A',
  },
  entryStatus: {
    color: '#666666',
  },
  entryAmount: {
    fontWeight: '600',
  },
  paymentCard: {
    backgroundColor: '#FFF8F8',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  paymentCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  paymentDate: {
    fontWeight: '500',
    color: '#1A1A1A',
  },
  paymentNarration: {
    color: '#666666',
  },
  paymentAmount: {
    fontWeight: '600',
  },
  snackbar: {
    backgroundColor: '#333333',
  },
  
  // Export Modal Styles - Redesigned for full responsiveness
  exportModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  exportModalSafeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    maxHeight: height * 0.9,
  },
  exportModalContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },

  // Modal Header
  exportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  exportModalTitle: {
    color: '#2C3E50',
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    margin: -8,
  },

  // Scrollable Content
  exportScrollView: {
    flex: 1,
  },
  exportScrollContent: {
    paddingVertical: 8,
  },

  // Section Containers
  exportSectionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  exportSectionTitle: {
    color: '#2C3E50',
    fontWeight: '600',
    marginBottom: 12,
  },
  exportSectionDivider: {
    backgroundColor: '#E9ECEF',
    height: 1,
  },

  // Format Selection Cards
  formatSelectionContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  formatOptionCard: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E9ECEF',
  },
  formatOptionSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  formatOptionIcon: {
    marginBottom: 8,
  },
  formatOptionEmoji: {
    fontSize: 24,
  },
  formatOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
    textAlign: 'center',
  },
  formatOptionTitleSelected: {
    color: '#1976D2',
  },
  formatOptionDesc: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'center',
    lineHeight: 16,
  },
  formatOptionDescSelected: {
    color: '#1976D2',
  },

  // Radio Options
  radioOptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  radioOptionText: {
    flex: 1,
    fontSize: 14,
    color: '#2C3E50',
    marginLeft: 8,
  },
  workerCountChip: {
    marginLeft: 8,
  },
  workerListScrollContainer: {
    maxHeight: 120,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 8,
  },

  // Date Selection
  dateRangeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateSelectionCard: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    alignItems: 'center',
  },
  dateCardLabel: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 4,
  },
  dateCardValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500',
  },
  dateActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  clearDateButton: {
    minWidth: 80,
  },

  // Preview Container
  previewContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  previewCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    elevation: 1,
  },
  previewLabel: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '500',
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: 'bold',
  },
  previewValueHighlight: {
    fontSize: 16,
    color: '#28A745',
    fontWeight: 'bold',
  },

  // Fixed Action Buttons
  exportModalActions: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    gap: 12,
  },
  modalCancelButton: {
    flex: 0.4,
    borderColor: '#6C757D',
  },
  modalExportButton: {
    flex: 0.6,
    backgroundColor: '#28A745',
  },
  modalButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  ledgerButton: {
    borderRadius: 12,
    marginTop: 8,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});

// RNPickerSelect styles
const pickerSelectStyles = {
  inputIOS: {
    fontSize: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    color: '#333333',
    backgroundColor: 'transparent',
  },
  inputAndroid: {
    fontSize: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    color: '#333333',
    backgroundColor: 'transparent',
  },
  placeholder: {
    color: '#999999',
  },
};
