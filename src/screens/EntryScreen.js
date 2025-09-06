import React, { useEffect, useState, useRef, useCallback } from "react";
import { useFocusEffect } from '@react-navigation/native';
import RNPickerSelect from 'react-native-picker-select';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Platform, View, KeyboardAvoidingView, TouchableOpacity, FlatList } from "react-native";
import Modal from 'react-native-modal';
import { Text, Button, TextInput, Snackbar, Card, IconButton, Portal, Dialog, Switch } from "react-native-paper";
import { useGlobalStore } from '../utils/GlobalStore';
import BalanceCard from "../components/BalanceCard";
import DateTimePicker from '@react-native-community/datetimepicker';
import { validateEntry, getWorkerBalance } from '../utils/balance';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EntryScreen({ navigation }) {
  const { state, dispatch } = useGlobalStore();
  const scrollRef = useRef(null);
  const workers = state.workers;
  const categories = state.categories;
  const allSubcategories = state.subcategories;
  
  // State management
  const [workerSheetOpen, setWorkerSheetOpen] = useState(false);
  const [workerSearch, setWorkerSearch] = useState("");
  const [subcategories, setSubcategories] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(workers[0]?.id || null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [status, setStatus] = useState("P");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [balance, setBalance] = useState(0);
  const [duplicateDialogVisible, setDuplicateDialogVisible] = useState(false);
  
  // Work Type states (Work A / Work B)
  const [workType, setWorkType] = useState("A"); // "A" or "B"
  const [workName, setWorkName] = useState("");
  const [units, setUnits] = useState("");
  const [ratePerUnit, setRatePerUnit] = useState("");


  // Set initial selected worker if not set
  useEffect(() => {
    if (workers.length && !selectedWorker) {
      setSelectedWorker(workers[0].id);
    }
  }, [workers]);

  // Update balance when selectedWorker, entries, or payments change using centralized logic
  useEffect(() => {
    if (!selectedWorker) return;
    // Use getWorkerBalance to keep logic consistent with SummaryScreen and PaymentScreen
    const newBal = getWorkerBalance(selectedWorker, { workers, entries: state.entries, payments: state.payments });
    setBalance(newBal);
  }, [selectedWorker, state.entries, state.payments, workers]);

  // Update subcategories when category changes - support many-to-many mapping via categoryIds
  useEffect(() => {
    if (!selectedCategory) {
      setSubcategories([]);
      setSelectedSubcategory(null);
      return;
    }
    const filtered = (allSubcategories || []).filter(s => {
      // handle older shape with categoryId
      if (s.categoryIds && Array.isArray(s.categoryIds)) return s.categoryIds.includes(selectedCategory);
      if (s.categoryId) return s.categoryId === selectedCategory;
      return false;
    });
    setSubcategories(filtered);
    setSelectedSubcategory(null);
  }, [selectedCategory, allSubcategories]);

  // Auto-calculate amount for Work B when units or rate changes
  useEffect(() => {
    if (workType === "B" && units && ratePerUnit) {
      const calculatedAmount = (Number(units) || 0) * (Number(ratePerUnit) || 0);
      setAmount(calculatedAmount.toString());
    }
  }, [workType, units, ratePerUnit]);

  const handleSave = async () => {
    if (!selectedWorker) {
      setSnackbar({ visible: true, message: "Please select a worker." });
      return;
    }
    
    setSaving(true);
    const dateStr = date.toISOString().slice(0, 10);
    
    const entry = {
      id: Date.now().toString(),
      workerId: selectedWorker,
      date: dateStr,
      status,
      workType, // Add work type to entry
      categoryId: status === 'A' ? null : (workType === 'A' ? selectedCategory : null),
      subcategoryId: status === 'A' ? null : (workType === 'A' ? selectedSubcategory : null),
      // Work B specific fields
      workName: workType === 'B' && status !== 'A' ? workName : null,
      units: workType === 'B' && status !== 'A' ? Number(units) || 0 : null,
      ratePerUnit: workType === 'B' && status !== 'A' ? Number(ratePerUnit) || 0 : null,
      amount: status === 'A' ? 0 : Number(amount) || 0,
      narration: status === 'A' ? '' : narration,
    };

    // Enhanced validation for Work B
    if (status !== 'A') {
      if (workType === 'A') {
        // Existing Work A validation
        if (!selectedCategory) {
          setSnackbar({ visible: true, message: "Category is required for Work A." });
          setSaving(false);
          return;
        }
        if (!selectedSubcategory) {
          setSnackbar({ visible: true, message: "Subcategory is required for Work A." });
          setSaving(false);
          return;
        }
      } else if (workType === 'B') {
        // New Work B validation
        if (!workName || workName.trim() === '') {
          setSnackbar({ visible: true, message: "Work name is required for Work B." });
          setSaving(false);
          return;
        }
        if (!units || Number(units) <= 0) {
          setSnackbar({ visible: true, message: "Valid units completed is required for Work B." });
          setSaving(false);
          return;
        }
        if (!ratePerUnit || Number(ratePerUnit) <= 0) {
          setSnackbar({ visible: true, message: "Valid rate per unit is required for Work B." });
          setSaving(false);
          return;
        }
      }
      
      if (!amount || Number(amount) <= 0) {
        setSnackbar({ visible: true, message: "Valid amount is required for non-absent entries." });
        setSaving(false);
        return;
      }
    }

    // Use enhanced validation (but skip category/subcategory validation for Work B)
    const validation = validateEntry(entry, state);
    if (!validation.valid) {
      // Show a friendly dialog specifically for duplicate attendance
      if (validation.error && validation.error.toLowerCase().includes('attendance already recorded')) {
        setDuplicateDialogVisible(true);
        setSaving(false);
        return;
      }

      setSnackbar({ visible: true, message: validation.error });
      setSaving(false);
      return;
    }

    // Additional validation: ensure selectedSubcategory is actually mapped to selectedCategory (only for Work A)
    if (entry.status !== 'A' && entry.workType === 'A') {
      const subObj = (allSubcategories || []).find(s => s.id === entry.subcategoryId);
      if (!subObj) {
        setSnackbar({ visible: true, message: 'Selected subcategory not found' });
        setSaving(false);
        return;
      }
      const mapped = (subObj.categoryIds && subObj.categoryIds.includes(entry.categoryId)) || (subObj.categoryId && subObj.categoryId === entry.categoryId);
      if (!mapped) {
        setSnackbar({ visible: true, message: 'Selected subcategory is not associated with the chosen category' });
        setSaving(false);
        return;
      }
    }

    try {
      dispatch({ type: 'ADD_ENTRY', payload: entry });
      setSnackbar({ visible: true, message: "Entry saved successfully." });
      
      // Reset form
      setAmount("");
      setNarration("");
      setSelectedCategory(null);
      setSelectedSubcategory(null);
      // Reset Work B fields
      setWorkName("");
      setUnits("");
      setRatePerUnit("");
      setStatus("P");
      setDate(new Date());
    } catch (e) {
      console.error('Error saving entry:', e);
      setSnackbar({ visible: true, message: "Error saving entry. Please try again." });
    }
    setSaving(false);
  };

  const handleRefresh = async () => {
    await refreshData();
  };

  const isAbsent = status === 'A';

  // When screen becomes focused (navigated back to), reset scroll to top to avoid header offset
  useFocusEffect(
    useCallback(() => {
      try {
        if (scrollRef.current && scrollRef.current.scrollTo) {
          scrollRef.current.scrollTo({ y: 0, animated: false });
        }
      } catch (e) {
        // ignore
      }
    }, [])
  );

  return (
    <SafeAreaView style={styles.safeArea}> 
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {/* Header with refresh button */}
        <View style={styles.headerContainer}>
          <Text style={styles.screenTitle}>Entry Screen</Text>
          <IconButton
            icon="refresh"
            size={24}
            onPress={handleRefresh}
            style={styles.refreshButton}
            iconColor="#666"
          />
        </View>

        {/* Modern Worker Balance Card - sticky at top, animated, color-coded */}
        <View style={styles.stickyBalanceCard}>
          <BalanceCard balance={balance} />
        </View>
        {/* Worker Selection Button & Modal */}
        <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
          <Text style={styles.label}>Worker</Text>
          <TouchableOpacity
            style={styles.workerSelectBtn}
            activeOpacity={0.8}
            onPress={() => setWorkerSheetOpen(true)}
            disabled={loading}
          >
            <View style={styles.workerSelectRow}>
              <View style={styles.workerAvatar}>
                {selectedWorker ? (
                  <Text style={styles.workerAvatarText}>
                    {workers.find(w => w.id === selectedWorker)?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "W"}
                  </Text>
                ) : (
                  <Text style={styles.workerAvatarText}>?</Text>
                )}
              </View>
              <Text style={styles.workerSelectText}>
                {selectedWorker ? workers.find(w => w.id === selectedWorker)?.name : "Select Worker"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        {/* Modal for Worker Selection */}
        <Modal
          isVisible={workerSheetOpen}
          onBackdropPress={() => setWorkerSheetOpen(false)}
          onBackButtonPress={() => setWorkerSheetOpen(false)}
          style={styles.modal}
          animationIn="slideInUp"
          animationOut="slideOutDown"
          backdropTransitionOutTiming={0}
        >
          <View style={styles.sheetContent}>
            <TextInput
              placeholder="Search worker..."
              value={workerSearch}
              onChangeText={setWorkerSearch}
              style={styles.workerSearchInput}
              mode="outlined"
            />
            <FlatList
              data={workers.filter(w => w.name.toLowerCase().includes(workerSearch.toLowerCase()))}
              keyExtractor={w => w.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.workerItem, selectedWorker === item.id && styles.workerItemSelected]}
                  onPress={() => {
                    setSelectedWorker(item.id);
                    setWorkerSheetOpen(false);
                  }}
                >
                  <View style={styles.workerAvatarSmall}>
                    <Text style={styles.workerAvatarTextSmall}>
                      {item.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.workerItemText}>{item.name}</Text>
                  {selectedWorker === item.id && <Text style={styles.workerCheck}>2714</Text>}
                </TouchableOpacity>
              )}
              style={{ marginTop: 10, maxHeight: 320 }}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            />
          </View>
  </Modal>
  <ScrollView 
    ref={scrollRef} 
    contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} 
    keyboardShouldPersistTaps="handled"
    style={{ backgroundColor: '#f5f5f5' }}
  >
          <View style={styles.container}>
            {workers.length === 0 ? (
              <Card style={styles.card}>
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No workers found</Text>
                  <Text style={styles.emptyStateSubtext}>Add workers from Master section first</Text>
                </View>
              </Card>
            ) : (
      <Card style={styles.card}>
              {/* ...existing code... (Date, Attendance, Category, Subcategory, Amount, Narration, Save) */}

              {/* ...existing code... (Date, Attendance, Category, Subcategory, Amount, Narration, Save) */}
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerBtn} activeOpacity={0.7}>
                <Text style={styles.dateText}>
                  {date ? `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')}/${date.getFullYear()}` : 'Select Date'}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={date || new Date()}
                  mode="date"
                  display="default"
                  onChange={(e, d) => { setShowDatePicker(false); if (d) setDate(d); }}
                  maximumDate={new Date()}
                />
              )}

              <Text style={styles.label}>Attendance</Text>
              <View style={styles.toggleRow}>
                {['P', 'A', 'H'].map(opt => {
                  let bg = '#fff';
                  let border = '#d1d1d1';
                  let color = '#222';
                  if (status === opt) {
                    if (opt === 'P') { bg = '#27ae60'; color = '#fff'; border = '#27ae60'; }
                    else if (opt === 'A') { bg = '#e74c3c'; color = '#fff'; border = '#e74c3c'; }
                    else if (opt === 'H') { bg = '#fdcb6e'; color = '#222'; border = '#fdcb6e'; }
                  }
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.toggleBtn, { backgroundColor: bg, borderColor: border, borderWidth: 1 }]}
                      onPress={() => setStatus(opt)}
                    >
                      <Text style={[styles.toggleText, { color }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!isAbsent && (
                <>
                  <Text style={styles.label}>Work Type</Text>
                  <View style={styles.toggleRow}>
                    {[
                      { key: 'A', label: 'Work A', desc: 'Category Based' },
                      { key: 'B', label: 'Work B', desc: 'Unit Based' }
                    ].map(opt => {
                      let bg = '#fff';
                      let border = '#d1d1d1';
                      let color = '#222';
                      if (workType === opt.key) {
                        bg = '#3498db';
                        color = '#fff';
                        border = '#3498db';
                      }
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.workTypeBtn, { backgroundColor: bg, borderColor: border, borderWidth: 1 }]}
                          onPress={() => {
                            setWorkType(opt.key);
                            // Reset relevant fields when switching work type
                            if (opt.key === 'A') {
                              setWorkName("");
                              setUnits("");
                              setRatePerUnit("");
                              setAmount("");
                            } else {
                              setSelectedCategory(null);
                              setSelectedSubcategory(null);
                              setAmount("");
                            }
                          }}
                        >
                          <Text style={[styles.workTypeLabel, { color }]}>{opt.label}</Text>
                          <Text style={[styles.workTypeDesc, { color: color === '#fff' ? '#e8f4f8' : '#666' }]}>{opt.desc}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {workType === 'A' && (
                    <>
                      <Text style={styles.label}>Category</Text>
                      <View style={styles.dropdownRow}>
                        <RNPickerSelect
                          placeholder={{ label: 'Select Category', value: null, color: '#888' }}
                          items={categories.map(c => ({ label: c.category, value: c.id, key: c.id }))}
                          onValueChange={value => setSelectedCategory(value)}
                          value={selectedCategory}
                          style={{
                            inputIOS: [styles.dropdownInput, { backgroundColor: '#f7f7fa', color: '#333' }],
                            inputAndroid: [styles.dropdownInput, { backgroundColor: '#f7f7fa', color: '#333' }],
                            placeholder: { color: '#888' },
                          }}
                          disabled={categories.length === 0}
                          useNativeAndroidPickerStyle={false}
                        />
                      </View>

                      <Text style={styles.label}>Subcategory</Text>
                      <View style={styles.dropdownRow}>
                        <RNPickerSelect
                          placeholder={{ label: 'Select Subcategory', value: null, color: '#888' }}
                          items={subcategories.map(s => ({ label: s.subcategory || s.subcategoryName || s.subcategoryName, value: s.id, key: s.id }))}
                          onValueChange={value => setSelectedSubcategory(value)}
                          value={selectedSubcategory}
                          style={{
                            inputIOS: [styles.dropdownInput, { backgroundColor: '#f7f7fa', color: '#333' }],
                            inputAndroid: [styles.dropdownInput, { backgroundColor: '#f7f7fa', color: '#333' }],
                            placeholder: { color: '#888' },
                          }}
                          disabled={!selectedCategory || subcategories.length === 0}
                          useNativeAndroidPickerStyle={false}
                        />
                      </View>
                    </>
                  )}

                  {workType === 'B' && (
                    <>
                      <Text style={styles.label}>Work Name</Text>
                      <TextInput
                        placeholder="Enter work description"
                        value={workName}
                        onChangeText={setWorkName}
                        style={[styles.textInput, { backgroundColor: '#f7f7fa' }]}
                        mode="outlined"
                      />

                      <View style={styles.rowInputs}>
                        <View style={styles.halfInput}>
                          <Text style={styles.label}>Units Completed</Text>
                          <TextInput
                            placeholder="0"
                            value={units}
                            onChangeText={setUnits}
                            keyboardType="numeric"
                            style={[styles.textInput, { backgroundColor: '#f7f7fa' }]}
                            mode="outlined"
                          />
                        </View>
                        <View style={styles.halfInput}>
                          <Text style={styles.label}>Rate per Unit</Text>
                          <TextInput
                            placeholder="0.00"
                            value={ratePerUnit}
                            onChangeText={setRatePerUnit}
                            keyboardType="numeric"
                            style={[styles.textInput, { backgroundColor: '#f7f7fa' }]}
                            mode="outlined"
                          />
                        </View>
                      </View>
                    </>
                  )}

                  <Text style={styles.label}>
                    Amount {workType === 'B' && units && ratePerUnit ? '(Auto-calculated)' : ''}
                  </Text>
                  <TextInput
                    label="Amount"
                    value={amount}
                    onChangeText={workType === 'B' && units && ratePerUnit ? undefined : setAmount}
                    keyboardType="numeric"
                    style={[
                      styles.input, 
                      { backgroundColor: '#f7f7fa' },
                      workType === 'B' && units && ratePerUnit && { opacity: 0.7 }
                    ]}
                    editable={!(workType === 'B' && units && ratePerUnit)}
                  />

                  <Text style={styles.label}>Narration</Text>
                  <TextInput
                    label="Narration"
                    value={narration}
                    onChangeText={setNarration}
                    multiline
                    style={[styles.input, { backgroundColor: '#f7f7fa' }]}
                  />
                </>
              )}

              {isAbsent && (
                <View style={styles.absentNotice}>
                  <Text style={styles.absentText}>
                    Worker is marked as absent. No additional details required.
                  </Text>
                </View>
              )}

              <Button
                mode="contained"
                style={styles.saveBtn}
                onPress={handleSave}
                loading={saving}
                disabled={loading || saving || !selectedWorker || !date}
              >
                Save Entry
              </Button>
            </Card>
            )}
          </View>
        </ScrollView>
        <Portal>
          <Dialog visible={duplicateDialogVisible} onDismiss={() => setDuplicateDialogVisible(false)}>
            <Dialog.Title>Duplicate Attendance</Dialog.Title>
            <Dialog.Content>
              <Text>Attendance cannot be made more than once per day</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setDuplicateDialogVisible(false)}>OK</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <Snackbar
          visible={snackbar.visible}
          onDismiss={() => setSnackbar({ visible: false, message: "" })}
          duration={2500}
        >
          {snackbar.message}
        </Snackbar>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dropdownRow: {
    marginBottom: 8,
  },
  dropdownInput: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f7f7fa',
    color: '#2c3e50',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 4,
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  workerSelectBtn: {
    backgroundColor: '#f7f7fa',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  workerSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2c3e50',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  workerAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  workerSelectText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  sheetContent: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  workerSearchInput: {
    marginBottom: 8,
    backgroundColor: '#f7f7fa',
    borderRadius: 8,
  },
  workerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#f7f7fa',
  },
  workerItemSelected: {
    backgroundColor: '#e0f7fa',
    borderColor: '#2c3e50',
    borderWidth: 1,
  },
  workerAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2c3e50',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  workerAvatarTextSmall: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  workerItemText: {
    fontSize: 15,
    color: '#2c3e50',
    flex: 1,
  },
  workerCheck: {
    fontSize: 18,
    color: '#00796b',
    marginLeft: 8,
  },
  safeArea: { flex: 1, backgroundColor: '#fff' },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    position: 'relative',
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
  },
  refreshButton: {
    position: 'absolute',
    right: 4,
  },
  container: { flexGrow: 1, padding: 20, backgroundColor: '#fff', justifyContent: 'flex-start' },
  stickyBalanceCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: 0,
    zIndex: 999,
    position: 'relative',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
    color: '#2c3e50',
  },
  dropdown: {
    borderRadius: 8,
    borderColor: '#ddd',
    marginBottom: 8,
    backgroundColor: '#f7f7fa',
  },
  datePickerBtn: {
    backgroundColor: '#f7f7fa',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  toggleBtn: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#f7f7fa',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    elevation: 1,
  },
  toggleBtnActive: {
    backgroundColor: '#2c3e50',
  },
  toggleText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#f7f7fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  saveBtn: {
    marginTop: 18,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarIcon: {
    fontSize: 20,
    marginLeft: 8,
    color: '#00796b',
  },
  absentNotice: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 16,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  absentText: {
    color: '#856404',
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  // Work Type Toggle Styles
  workTypeBtn: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#f7f7fa',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    elevation: 1,
    minHeight: 60,
    justifyContent: 'center',
  },
  workTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  workTypeDesc: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Row Input Styles
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  halfInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  textInput: {
    backgroundColor: '#f7f7fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  dropdownRow: {
    marginBottom: 8,
  },
  dropdownInput: {
    backgroundColor: '#f7f7fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
});
