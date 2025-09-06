import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { 
  Text, 
  Button, 
  TextInput, 
  Portal, 
  Dialog, 
  Chip,
  Surface
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import RNPickerSelect from 'react-native-picker-select';
import { TouchableOpacity } from 'react-native';
import { format, parseISO } from 'date-fns';
import { validateEntry, validatePayment } from '../utils/balance';

export function EditEntryModal({ 
  visible, 
  entry, 
  state, 
  onDismiss, 
  onSave 
}) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Form state
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [status, setStatus] = useState('P');
  const [workType, setWorkType] = useState('A');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [workName, setWorkName] = useState('');
  const [units, setUnits] = useState('');
  const [ratePerUnit, setRatePerUnit] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');

  // Initialize form with entry data
  useEffect(() => {
    if (entry && visible) {
      setDate(parseISO(entry.date));
      setStatus(entry.originalData.status);
      setWorkType(entry.originalData.workType || 'A');
      setSelectedCategory(entry.originalData.categoryId);
      setSelectedSubcategory(entry.originalData.subcategoryId);
      setWorkName(entry.originalData.workName || '');
      setUnits(entry.originalData.units?.toString() || '');
      setRatePerUnit(entry.originalData.ratePerUnit?.toString() || '');
      setAmount(Math.abs(entry.amount).toString());
      setNarration(entry.originalData.narration || '');
      setErrors({});
    }
  }, [entry, visible]);

  // Update subcategories when category changes
  useEffect(() => {
    if (!selectedCategory) {
      setSubcategories([]);
      setSelectedSubcategory(null);
      return;
    }
    const filtered = (state.subcategories || []).filter(s => {
      if (s.categoryIds && Array.isArray(s.categoryIds)) return s.categoryIds.includes(selectedCategory);
      if (s.categoryId) return s.categoryId === selectedCategory;
      return false;
    });
    setSubcategories(filtered);
    if (!filtered.find(s => s.id === selectedSubcategory)) {
      setSelectedSubcategory(null);
    }
  }, [selectedCategory, state.subcategories, selectedSubcategory]);

  // Auto-calculate amount for Work B
  useEffect(() => {
    if (workType === 'B' && units && ratePerUnit) {
      const calculatedAmount = (Number(units) || 0) * (Number(ratePerUnit) || 0);
      setAmount(calculatedAmount.toString());
    }
  }, [workType, units, ratePerUnit]);

  const handleSave = async () => {
    setLoading(true);
    setErrors({});

    const updatedEntry = {
      ...entry.originalData,
      date: format(date, 'yyyy-MM-dd'),
      status,
      workType,
      categoryId: status === 'A' ? null : (workType === 'A' ? selectedCategory : null),
      subcategoryId: status === 'A' ? null : (workType === 'A' ? selectedSubcategory : null),
      workName: workType === 'B' && status !== 'A' ? workName : null,
      units: workType === 'B' && status !== 'A' ? Number(units) || 0 : null,
      ratePerUnit: workType === 'B' && status !== 'A' ? Number(ratePerUnit) || 0 : null,
      amount: status === 'A' ? 0 : Number(amount) || 0,
      narration: status === 'A' ? '' : narration,
    };

    // Validate
    const validation = validateEntry(updatedEntry, state);
    if (!validation.valid) {
      setErrors({ general: validation.error });
      setLoading(false);
      return;
    }

    // Additional validation for Work B
    if (status !== 'A' && workType === 'B') {
      if (!workName.trim()) {
        setErrors({ workName: 'Work name is required' });
        setLoading(false);
        return;
      }
      if (!units || Number(units) <= 0) {
        setErrors({ units: 'Valid units required' });
        setLoading(false);
        return;
      }
      if (!ratePerUnit || Number(ratePerUnit) <= 0) {
        setErrors({ ratePerUnit: 'Valid rate required' });
        setLoading(false);
        return;
      }
    }

    try {
      await onSave(updatedEntry);
      onDismiss();
    } catch (error) {
      setErrors({ general: error.message });
    }
    setLoading(false);
  };

  const isAbsent = status === 'A';

  return (
    <Portal>
      <Dialog 
        visible={visible} 
        onDismiss={onDismiss}
        style={styles.dialog}
      >
        <Dialog.Title>Edit Entry</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent} extraScrollHeight={60} enableOnAndroid={true} keyboardShouldPersistTaps="handled">
            {errors.general && (
              <Surface style={styles.errorSurface} elevation={1}>
                <Text style={styles.errorText}>{errors.general}</Text>
              </Surface>
            )}

            {/* Date */}
            <Text style={styles.label}>Date</Text>
            <TouchableOpacity 
              onPress={() => setShowDatePicker(true)} 
              style={styles.dateButton}
            >
              <Text style={styles.dateText}>
                {format(date, 'dd/MM/yyyy')}
              </Text>
            </TouchableOpacity>

            {/* Attendance */}
            <Text style={styles.label}>Attendance</Text>
            <View style={styles.chipRow}>
              {['P', 'H', 'A'].map(opt => (
                <Chip
                  key={opt}
                  mode={status === opt ? 'flat' : 'outlined'}
                  selected={status === opt}
                  onPress={() => setStatus(opt)}
                  style={styles.chip}
                >
                  {opt === 'P' ? 'Present' : opt === 'H' ? 'Half' : 'Absent'}
                </Chip>
              ))}
            </View>

            {!isAbsent && (
              <>
                {/* Work Type */}
                <Text style={styles.label}>Work Type</Text>
                <View style={styles.chipRow}>
                  <Chip
                    mode={workType === 'A' ? 'flat' : 'outlined'}
                    selected={workType === 'A'}
                    onPress={() => setWorkType('A')}
                    style={styles.chip}
                  >
                    Work A (Category)
                  </Chip>
                  <Chip
                    mode={workType === 'B' ? 'flat' : 'outlined'}
                    selected={workType === 'B'}
                    onPress={() => setWorkType('B')}
                    style={styles.chip}
                  >
                    Work B (Unit)
                  </Chip>
                </View>

                {workType === 'A' && (
                  <>
                    {/* Category */}
                    <Text style={styles.label}>Category</Text>
                    <View style={styles.pickerContainer}>
                      <RNPickerSelect
                        placeholder={{ label: 'Select Category', value: null }}
                        items={state.categories.map(c => ({ 
                          label: c.category, 
                          value: c.id, 
                          key: c.id 
                        }))}
                        onValueChange={setSelectedCategory}
                        value={selectedCategory}
                        style={{
                          inputIOS: styles.pickerInput,
                          inputAndroid: styles.pickerInput,
                        }}
                      />
                    </View>

                    {/* Subcategory */}
                    <Text style={styles.label}>Subcategory</Text>
                    <View style={styles.pickerContainer}>
                      <RNPickerSelect
                        placeholder={{ label: 'Select Subcategory', value: null }}
                        items={subcategories.map(s => ({ 
                          label: s.subcategoryName || s.subcategory, 
                          value: s.id, 
                          key: s.id 
                        }))}
                        onValueChange={setSelectedSubcategory}
                        value={selectedSubcategory}
                        style={{
                          inputIOS: styles.pickerInput,
                          inputAndroid: styles.pickerInput,
                        }}
                        disabled={!selectedCategory}
                      />
                    </View>
                  </>
                )}

                {workType === 'B' && (
                  <>
                    {/* Work Name */}
                    <Text style={styles.label}>Work Name</Text>
                    <TextInput
                      value={workName}
                      onChangeText={setWorkName}
                      style={styles.input}
                      mode="outlined"
                      error={!!errors.workName}
                    />
                    {errors.workName && <Text style={styles.fieldError}>{errors.workName}</Text>}

                    {/* Units and Rate */}
                    <View style={styles.rowInputs}>
                      <View style={styles.halfInput}>
                        <Text style={styles.label}>Units</Text>
                        <TextInput
                          value={units}
                          onChangeText={setUnits}
                          style={styles.input}
                          mode="outlined"
                          keyboardType="numeric"
                          error={!!errors.units}
                        />
                        {errors.units && <Text style={styles.fieldError}>{errors.units}</Text>}
                      </View>
                      <View style={styles.halfInput}>
                        <Text style={styles.label}>Rate/Unit</Text>
                        <TextInput
                          value={ratePerUnit}
                          onChangeText={setRatePerUnit}
                          style={styles.input}
                          mode="outlined"
                          keyboardType="numeric"
                          error={!!errors.ratePerUnit}
                        />
                        {errors.ratePerUnit && <Text style={styles.fieldError}>{errors.ratePerUnit}</Text>}
                      </View>
                    </View>
                  </>
                )}

                {/* Amount */}
                <Text style={styles.label}>
                  Amount {workType === 'B' && units && ratePerUnit ? '(Auto-calculated)' : ''}
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={workType === 'B' && units && ratePerUnit ? undefined : setAmount}
                  style={styles.input}
                  mode="outlined"
                  keyboardType="numeric"
                  editable={!(workType === 'B' && units && ratePerUnit)}
                />

                {/* Narration */}
                <Text style={styles.label}>Narration</Text>
                <TextInput
                  value={narration}
                  onChangeText={setNarration}
                  style={styles.input}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                />
              </>
            )}
          </KeyboardAwareScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button 
            onPress={handleSave} 
            loading={loading}
            mode="contained"
          >
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDate(selectedDate);
          }}
          maximumDate={new Date()}
        />
      )}
    </Portal>
  );
}

export function EditPaymentModal({ 
  visible, 
  payment, 
  onDismiss, 
  onSave 
}) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Form state
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState('Cash');
  const [notes, setNotes] = useState('');

  // Initialize form with payment data
  useEffect(() => {
    if (payment && visible) {
      setDate(parseISO(payment.date));
      setAmount(Math.abs(payment.amount).toString());
      setPaymentType(payment.originalData.paymentType || 'Cash');
      setNotes(payment.originalData.notes || '');
      setErrors({});
    }
  }, [payment, visible]);

  const handleSave = async () => {
    setLoading(true);
    setErrors({});

    const updatedPayment = {
      ...payment.originalData,
      date: format(date, 'yyyy-MM-dd'),
      amount: Number(amount) || 0,
      paymentType,
      notes,
    };

    // Validate
    const validation = validatePayment(updatedPayment);
    if (!validation.valid) {
      setErrors({ general: validation.error });
      setLoading(false);
      return;
    }

    try {
      await onSave(updatedPayment);
      onDismiss();
    } catch (error) {
      setErrors({ general: error.message });
    }
    setLoading(false);
  };

  return (
    <Portal>
      <Dialog 
        visible={visible} 
        onDismiss={onDismiss}
        style={styles.dialog}
      >
        <Dialog.Title>Edit Payment</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent} extraScrollHeight={60} enableOnAndroid={true} keyboardShouldPersistTaps="handled">
            {errors.general && (
              <Surface style={styles.errorSurface} elevation={1}>
                <Text style={styles.errorText}>{errors.general}</Text>
              </Surface>
            )}

            {/* Date */}
            <Text style={styles.label}>Date</Text>
            <TouchableOpacity 
              onPress={() => setShowDatePicker(true)} 
              style={styles.dateButton}
            >
              <Text style={styles.dateText}>
                {format(date, 'dd/MM/yyyy')}
              </Text>
            </TouchableOpacity>

            {/* Amount */}
            <Text style={styles.label}>Amount</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              style={styles.input}
              mode="outlined"
              keyboardType="numeric"
            />

            {/* Payment Type */}
            <Text style={styles.label}>Payment Type</Text>
            <View style={styles.chipRow}>
              {['Cash', 'Bank Transfer', 'UPI', 'Card'].map(type => (
                <Chip
                  key={type}
                  mode={paymentType === type ? 'flat' : 'outlined'}
                  selected={paymentType === type}
                  onPress={() => setPaymentType(type)}
                  style={styles.chip}
                >
                  {type}
                </Chip>
              ))}
            </View>

            {/* Notes */}
            <Text style={styles.label}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={3}
            />
          </KeyboardAwareScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button 
            onPress={handleSave} 
            loading={loading}
            mode="contained"
          >
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDate(selectedDate);
          }}
          maximumDate={new Date()}
        />
      )}
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '95%', // Increased from 80% to 95%
  },
  scrollArea: {
    maxHeight: 600, // Increased from 400 to 600
  },
  scrollContent: {
    paddingBottom: 20,
  },
  errorSurface: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  fieldError: {
    color: '#c62828',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  dateButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    marginBottom: 4,
  },
  pickerContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginBottom: 8,
  },
  pickerInput: {
    fontSize: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    color: '#2c3e50',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  halfInput: {
    flex: 1,
  },
});
