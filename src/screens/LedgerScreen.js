import React, { useEffect, useState, useMemo } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ScrollView, 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  FlatList,
  Alert
} from 'react-native';
import Modal from 'react-native-modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  Text, 
  Button, 
  TextInput, 
  Card, 
  Snackbar, 
  IconButton, 
  Chip,
  Surface,
  Portal,
  Dialog
} from "react-native-paper";
import { useGlobalStore } from '../utils/GlobalStore';
import { getWorkerBalance, formatBalance } from "../utils/balance";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { EditEntryModal, EditPaymentModal } from '../components/EditModals';

export default function LedgerScreen({ route, navigation }) {
  const { workerId } = route.params;
  const { state, dispatch } = useGlobalStore();
  
  const worker = state.workers.find(w => w.id === workerId);
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editType, setEditType] = useState(null); // 'entry' or 'payment'
  
  // Build ledger transactions with running balance
  const ledgerTransactions = useMemo(() => {
    if (!worker) return [];
    
    // Combine entries and payments with proper sorting
    const transactions = [];
    
    // Add entries
    state.entries
      .filter(e => e.workerId === workerId)
      .forEach(entry => {
        const category = state.categories.find(c => c.id === entry.categoryId);
        const subcategory = state.subcategories.find(s => s.id === entry.subcategoryId);
        
        transactions.push({
          id: entry.id,
          type: 'entry',
          date: entry.date,
          workType: entry.workType || 'A',
          attendance: entry.status,
          units: entry.units || null,
          amount: Number(entry.amount || 0),
          paymentType: '-',
          narration: entry.narration || '',
          categoryName: category?.category || '',
          subcategoryName: subcategory?.subcategoryName || subcategory?.subcategory || '',
          workName: entry.workName || '',
          ratePerUnit: entry.ratePerUnit || null,
          originalData: entry
        });
      });
    
    // Add payments
    state.payments
      .filter(p => p.workerId === workerId)
      .forEach(payment => {
        transactions.push({
          id: payment.id,
          type: 'payment',
          date: payment.date,
          workType: '-',
          attendance: '-',
          units: null,
          amount: -Number(payment.amount || 0), // Negative for payments
          paymentType: payment.paymentType || 'Cash',
          narration: payment.notes || '',
          categoryName: '-',
          subcategoryName: '-',
          workName: '-',
          ratePerUnit: null,
          originalData: payment
        });
      });
    
    // Sort by date (oldest first)
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate running balance
    let runningBalance = Number(worker.openingBalance || 0);
    transactions.forEach((trans, index) => {
      if (trans.type === 'entry') {
        // Apply attendance logic for entries
        if (trans.attendance === 'P') {
          runningBalance += trans.amount;
        } else if (trans.attendance === 'H') {
          runningBalance += trans.amount / 2;
        }
        // 'A' (absent) doesn't change balance
      } else {
        // Payments always subtract (amount is already negative)
        runningBalance += trans.amount;
      }
      trans.balanceAfter = runningBalance;
    });
    
    return transactions;
  }, [state.entries, state.payments, workerId, worker]);
  
  // Filter transactions based on search and date range
  const filteredTransactions = useMemo(() => {
    let filtered = ledgerTransactions;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(trans => 
        trans.narration.toLowerCase().includes(query) ||
        trans.categoryName.toLowerCase().includes(query) ||
        trans.subcategoryName.toLowerCase().includes(query) ||
        trans.workName.toLowerCase().includes(query) ||
        trans.paymentType.toLowerCase().includes(query)
      );
    }
    
    // Apply date range filter
    if (fromDate) {
      filtered = filtered.filter(trans => 
        isAfter(parseISO(trans.date), startOfDay(fromDate)) || 
        trans.date === format(fromDate, 'yyyy-MM-dd')
      );
    }
    
    if (toDate) {
      filtered = filtered.filter(trans => 
        isBefore(parseISO(trans.date), endOfDay(toDate)) || 
        trans.date === format(toDate, 'yyyy-MM-dd')
      );
    }
    
    // Reverse for latest first display
    return filtered.reverse();
  }, [ledgerTransactions, searchQuery, fromDate, toDate]);
  
  const handleEdit = (transaction) => {
    setSelectedTransaction(transaction);
    setEditType(transaction.type);
    setEditDialogVisible(true);
  };
  
  const handleEditSave = async (updatedData) => {
    if (!selectedTransaction) return;
    
    try {
      if (selectedTransaction.type === 'entry') {
        dispatch({ type: 'UPDATE_ENTRY', payload: updatedData });
        setSnackbar({ visible: true, message: "Entry updated successfully" });
      } else {
        dispatch({ type: 'UPDATE_PAYMENT', payload: updatedData });
        setSnackbar({ visible: true, message: "Payment updated successfully" });
      }
      
      setEditDialogVisible(false);
      setSelectedTransaction(null);
      setEditType(null);
    } catch (error) {
      setSnackbar({ visible: true, message: "Failed to update transaction" });
    }
  };
  
  const handleDelete = (transaction) => {
    setSelectedTransaction(transaction);
    setDeleteDialogVisible(true);
  };
  
  const confirmDelete = () => {
    if (!selectedTransaction) return;
    
    if (selectedTransaction.type === 'entry') {
      dispatch({ type: 'DELETE_ENTRY', payload: selectedTransaction.id });
      setSnackbar({ visible: true, message: "Entry deleted successfully" });
    } else {
      dispatch({ type: 'DELETE_PAYMENT', payload: selectedTransaction.id });
      setSnackbar({ visible: true, message: "Payment deleted successfully" });
    }
    
    setDeleteDialogVisible(false);
    setSelectedTransaction(null);
  };
  
  const currentBalance = getWorkerBalance(workerId, state);
  
  const renderTransaction = ({ item }) => {
    const isEntry = item.type === 'entry';
    const amountColor = isEntry ? '#27ae60' : '#e74c3c';
    const balanceColor = item.balanceAfter >= 0 ? '#27ae60' : '#e74c3c';
    
    return (
      <Surface style={styles.transactionCard} elevation={1}>
        <View style={styles.transactionHeader}>
          <View style={styles.dateAndType}>
            <View style={styles.ledgerBadgeContainer}>
              <View style={[
                styles.ledgerBadge,
                { backgroundColor: isEntry ? '#27ae60' : '#e74c3c' }
              ]}>
                <Text style={styles.ledgerBadgeText}>
                  {isEntry ? 'E' : 'P'}
                </Text>
              </View>
              <Text style={styles.transactionDate}>
                {format(parseISO(item.date), 'dd/MM/yyyy')}
              </Text>
            </View>
          </View>
          <View style={styles.actionButtons}>
            <IconButton
              icon="pencil"
              size={18}
              onPress={() => handleEdit(item)}
              iconColor="#3498db"
            />
            <IconButton
              icon="delete"
              size={18}
              onPress={() => handleDelete(item)}
              iconColor="#e74c3c"
            />
          </View>
        </View>
        
        <View style={styles.transactionDetails}>
          {isEntry && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Work Type:</Text>
                <Text style={styles.detailValue}>
                  {item.workType === 'B' ? 'Work B (Unit-based)' : 'Work A (Category-based)'}
                </Text>
              </View>
              <View style={[styles.detailRow, styles.attendanceRow]}>
                <Text style={styles.detailLabel}>Attendance:</Text>
                <Chip 
                  mode="outlined" 
                  compact
                  style={[
                    styles.attendanceChip,
                    item.attendance === 'P' && { backgroundColor: '#e8f5e8' },
                    item.attendance === 'H' && { backgroundColor: '#fff3cd' },
                    item.attendance === 'A' && { backgroundColor: '#fce8e8' }
                  ]}
                  textStyle={styles.attendanceChipText}
                >
                  {item.attendance === 'P' ? 'Present' : item.attendance === 'H' ? 'Halfday' : 'Absent'}
                </Chip>
              </View>
              {item.workType === 'A' && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category:</Text>
                    <Text style={styles.detailValue}>{item.categoryName}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Subcategory:</Text>
                    <Text style={styles.detailValue}>{item.subcategoryName}</Text>
                  </View>
                </>
              )}
              {item.workType === 'B' && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Work Name:</Text>
                    <Text style={styles.detailValue}>{item.workName}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Units:</Text>
                    <Text style={styles.detailValue}>{item.units}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Rate/Unit:</Text>
                    <Text style={styles.detailValue}>₹{item.ratePerUnit}</Text>
                  </View>
                </>
              )}
            </>
          )}
          
          {!isEntry && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Type:</Text>
              <Text style={styles.detailValue}>{item.paymentType}</Text>
            </View>
          )}
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount:</Text>
            <Text style={[styles.detailValue, { color: amountColor, fontWeight: 'bold' }]}>
              {formatBalance(Math.abs(item.amount))}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Balance After:</Text>
            <Text style={[styles.detailValue, { color: balanceColor, fontWeight: 'bold' }]}>
              {formatBalance(item.balanceAfter)}
            </Text>
          </View>
          
          {item.narration && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Narration:</Text>
              <Text style={styles.detailValue}>{item.narration}</Text>
            </View>
          )}
        </View>
      </Surface>
    );
  };
  
  if (!worker) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Worker not found</Text>
          <Button onPress={() => navigation.goBack()}>Go Back</Button>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: '#f5f5f5' }] }>
      {/* Header */}
      <View style={[styles.headerContainer, { backgroundColor: '#fff' }]}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
          iconColor="#2c3e50"
        />
        <View style={styles.headerCenter}>
          <Text style={[styles.screenTitle, { color: '#333' }]}>Ledger - {worker.name}</Text>
          <Text style={[styles.currentBalance, { color: '#333' }]}>
            Current Balance: {formatBalance(currentBalance)}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>
      
      {/* Filters */}
      <View style={styles.filtersContainer}>
        <TextInput
          placeholder="Search transactions..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          mode="outlined"
          left={<TextInput.Icon icon="magnify" />}
        />
        
        <View style={styles.dateFilters}>
          <TouchableOpacity
            style={styles.dateFilterBtn}
            onPress={() => setShowFromPicker(true)}
          >
            <Text style={styles.dateFilterText}>
              From: {fromDate ? format(fromDate, 'dd/MM/yyyy') : 'All'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.dateFilterBtn}
            onPress={() => setShowToPicker(true)}
          >
            <Text style={styles.dateFilterText}>
              To: {toDate ? format(toDate, 'dd/MM/yyyy') : 'All'}
            </Text>
          </TouchableOpacity>
          
          {(fromDate || toDate) && (
            <TouchableOpacity
              style={styles.clearFiltersBtn}
              onPress={() => {
                setFromDate(null);
                setToDate(null);
              }}
            >
              <Text style={styles.clearFiltersText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Transactions List */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={item => `${item.type}-${item.id}`}
        renderItem={renderTransaction}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        }
      />
      
      {/* Date Pickers */}
      {showFromPicker && (
        <DateTimePicker
          value={fromDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowFromPicker(false);
            if (selectedDate) setFromDate(selectedDate);
          }}
          maximumDate={new Date()}
        />
      )}
      
      {showToPicker && (
        <DateTimePicker
          value={toDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowToPicker(false);
            if (selectedDate) setToDate(selectedDate);
          }}
          maximumDate={new Date()}
        />
      )}
      
      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>Confirm Delete</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete this {selectedTransaction?.type}? This action cannot be undone and will affect the worker's balance.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button onPress={confirmDelete} buttonColor="#e74c3c" textColor="white">
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Edit Modals */}
      {editType === 'entry' && (
        <EditEntryModal
          visible={editDialogVisible}
          entry={selectedTransaction}
          state={state}
          onDismiss={() => {
            setEditDialogVisible(false);
            setSelectedTransaction(null);
            setEditType(null);
          }}
          onSave={handleEditSave}
        />
      )}
      
      {editType === 'payment' && (
        <EditPaymentModal
          visible={editDialogVisible}
          payment={selectedTransaction}
          onDismiss={() => {
            setEditDialogVisible(false);
            setSelectedTransaction(null);
            setEditType(null);
          }}
          onSave={handleEditSave}
        />
      )}
      
      {/* Snackbar */}
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={3000}
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  currentBalance: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
  },
  dateFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateFilterBtn: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    alignItems: 'center',
  },
  dateFilterText: {
    fontSize: 14,
    color: '#495057',
  },
  clearFiltersBtn: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearFiltersText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    minHeight: 32,
  },
  dateAndType: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    flex: 1,
  },
  ledgerBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  ledgerBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    elevation: 2,
  },
  ledgerBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center',
  },
  transactionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  actionButtons: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
  },
  transactionDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  attendanceRow: {
    alignItems: 'flex-start',
    minHeight: 36,
    marginTop: 4,
    marginBottom: 4,
  },
  attendanceChip: {
    minHeight: 28,
    paddingHorizontal: 8,
  },
  attendanceChipText: {
    fontSize: 12,
    lineHeight: 16,
    marginVertical: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    marginBottom: 20,
    textAlign: 'center',
  },
});
