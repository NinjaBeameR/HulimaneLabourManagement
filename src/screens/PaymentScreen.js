import React, { useEffect, useState } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, View, TouchableOpacity, FlatList } from 'react-native';
import Modal from 'react-native-modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text, Button, TextInput, Snackbar, Card, IconButton, Portal, Dialog } from "react-native-paper";
import { useGlobalStore } from '../utils/GlobalStore';
import BalanceCard from "../components/BalanceCard";
import { getWorkerBalance, validatePayment } from "../utils/balance";
import { format, parseISO, startOfMonth, endOfDay } from 'date-fns';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PaymentScreen({ navigation }) {
  const { state, dispatch, refreshData } = useGlobalStore();
  const workers = state.workers;
  const [selectedWorker, setSelectedWorker] = useState(workers[0]?.id || null);
  const [balance, setBalance] = useState(0);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [workerSheetOpen, setWorkerSheetOpen] = useState(false);
  const [workerSearch, setWorkerSearch] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [narration, setNarration] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Set initial selected worker if not set
    if (workers.length && !selectedWorker) {
      setSelectedWorker(workers[0].id);
    }
  }, [workers]);

  useEffect(() => {
    // Update balance when selectedWorker, entries, or payments change using enhanced function
    if (!selectedWorker) return;
    const newBalance = getWorkerBalance(selectedWorker, state);
    setBalance(newBalance);
  }, [selectedWorker, state.entries, state.payments, workers]);

  const savePaymentHandler = async () => {
    setSaving(true);
    const dateStr = date.toISOString().slice(0, 10);
    
    const payment = {
      id: Date.now().toString(),
      workerId: selectedWorker,
      date: dateStr,
      amount: Number(amount),
      paymentType,
      notes: narration
    };

    // Use enhanced validation
    const validation = validatePayment(payment);
    if (!validation.valid) {
      setSnackbar({ visible: true, message: validation.error });
      setSaving(false);
      return;
    }

    try {
      dispatch({ type: 'ADD_PAYMENT', payload: payment });
      setSnackbar({ visible: true, message: "Payment saved successfully." });
  // After payment saved, ask user about sending SMS
  setPendingSms({ visible: true, workerId: selectedWorker, payment });
      
      // Reset form
      setAmount("");
      setNarration("");
      setPaymentType("Cash");
      setDate(new Date());
    } catch (e) {
      console.error('Error saving payment:', e);
      setSnackbar({ visible: true, message: "Error saving payment. Please try again." });
    }
    setSaving(false);
  };

  // Pending SMS state
  const [pendingSms, setPendingSms] = useState({ visible: false, workerId: null, payment: null });
  const [smsPreviewText, setSmsPreviewText] = useState('');
  const [pendingSaveChannel, setPendingSaveChannel] = useState('whatsapp');

  const buildDetailedMessage = (workerId, paymentObj) => {
    try {
      const worker = workers.find(w => w.id === workerId) || {};
      const balance = getWorkerBalance(workerId, state);

      // Month-to-date attendance counts
      const now = new Date();
      const monthStart = startOfMonth(now);
      const workerEntries = (state.entries || []).filter(e => e.workerId === workerId && e.date);
      let present = 0, half = 0, absent = 0;
      for (const e of workerEntries) {
        const d = parseISO(e.date);
        if (d >= monthStart && d <= endOfDay(now)) {
          if (e.status === 'P') present += 1;
          else if (e.status === 'H') half += 1;
          else if (e.status === 'A') absent += 1;
        }
      }

      const payDate = paymentObj?.date || new Date().toISOString().slice(0,10);
      const payAmount = Number(paymentObj?.amount || 0).toFixed(2);

  // Detailed template (attendance for current month only, each on its own line)
  const monthName = format(now, 'MMMM');
  const attendanceLines = [];
  attendanceLines.push(`For the month ${monthName}:`);
  attendanceLines.push(`Present: ${present}`);
  attendanceLines.push(`Halfday: ${half}`);
  attendanceLines.push(`Absent: ${absent}`);

  const msg = `Date: ${payDate}\nPayment: \u20b9${payAmount}\nRemaining Balance: \u20b9${Number(balance || 0).toFixed(2)}\n${attendanceLines.join('\n')}`;
      return msg;
    } catch (e) {
      console.error('buildDetailedMessage', e);
      return '';
    }
  };

  // Enhanced helper to validate phone numbers
  const validatePhoneNumber = (phone) => {
    if (!phone || phone.trim().length === 0) return { valid: false, error: 'No phone number provided' };
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.length < 10) return { valid: false, error: 'Phone number too short' };
    return { valid: true, cleaned };
  };

  // Enhanced helper to save message to history with proper logging
  const saveToHistory = async (workerId, payment, channel, body, status = 'sent') => {
    try {
      const worker = workers.find(w => w.id === workerId) || {};
      const historyItem = {
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
        workerId,
        workerName: worker.name || 'Unknown',
        phone: worker.phone || null,
        channel,
        mode: 'snapshot',
        template: 'detailed',
        snapshotBody: body,
        createdAt: new Date().toISOString(),
        status,
        paymentId: payment?.id || null,
        paymentAmount: payment?.amount || null
      };
      
      dispatch({ type: 'ADD_DEFERRED_MESSAGE', payload: historyItem });
      console.log(`✅ Message saved to history: ${channel.toUpperCase()} to ${worker.phone} - Status: ${status}`);
      return historyItem;
    } catch (error) {
      console.error('❌ Failed to save message to history:', error);
      throw error;
    }
  };

  // Generalized handler to send or save messages for SMS or WhatsApp with comprehensive error handling
  const handleMessageChoice = async (action, channel) => {
    console.log(`📱 handleMessageChoice called: action=${action}, channel=${channel}`);
    
    // action: 'send' | 'save' | 'dont'
    // channel: 'sms' | 'whatsapp'
    const { workerId, payment } = pendingSms;
    setPendingSms({ visible: false, workerId: null, payment: null });
    
    if (!workerId) {
      console.warn('⚠️ No workerId provided to handleMessageChoice');
      return;
    }

    const worker = workers.find(w => w.id === workerId) || {};
    if (action === 'dont') {
      console.log('ℹ️ User chose not to send message');
      return;
    }

    const body = buildDetailedMessage(workerId, payment);
    if (!body) {
      console.error('❌ Failed to build message body');
      setSnackbar({ visible: true, message: 'Failed to generate message content' });
      return;
    }

    console.log(`📝 Message body generated (${body.length} chars)`);

    if (action === 'send') {
      // Validate phone number
      const phoneValidation = validatePhoneNumber(worker.phone);
      if (!phoneValidation.valid) {
        console.error('❌ Phone validation failed:', phoneValidation.error);
        setSnackbar({ visible: true, message: `Invalid phone number: ${phoneValidation.error}` });
        return;
      }

      console.log(`📞 Validated phone: ${phoneValidation.cleaned}`);

      if (channel === 'sms') {
        try {
          const encoded = encodeURIComponent(body);
          const url = `sms:${phoneValidation.cleaned}?body=${encoded}`;
          
          console.log(`📱 Attempting to open SMS with URL length: ${url.length}`);
          
          const supported = await Linking.canOpenURL(url);
          if (supported) {
            await Linking.openURL(url);
            console.log('✅ SMS composer opened successfully');
            
            // Save to history as "sent" (user will compose and send)
            await saveToHistory(workerId, payment, 'sms', body, 'sent');
            setSnackbar({ visible: true, message: '📱 SMS composer opened. Message saved to history.' });
          } else {
            console.error('❌ SMS composer not supported on this device');
            setSnackbar({ visible: true, message: 'SMS not supported on this device' });
          }
        } catch (e) {
          console.error('❌ SMS opening failed:', e);
          setSnackbar({ visible: true, message: `Failed to open SMS: ${e.message}` });
        }
      } else if (channel === 'whatsapp') {
        try {
          const encoded = encodeURIComponent(body);
          let url = null;
          
          // Build WhatsApp URL with proper phone formatting
          if (phoneValidation.cleaned.startsWith('+')) {
            url = `whatsapp://send?phone=${encodeURIComponent(phoneValidation.cleaned)}&text=${encoded}`;
          } else {
            // Add + if missing for international format
            const formattedPhone = phoneValidation.cleaned.length > 10 ? `+${phoneValidation.cleaned}` : `+91${phoneValidation.cleaned}`;
            url = `whatsapp://send?phone=${encodeURIComponent(formattedPhone)}&text=${encoded}`;
          }
          
          console.log(`💬 Attempting WhatsApp with formatted phone`);
          
          const supported = await Linking.canOpenURL(url);
          if (supported) {
            await Linking.openURL(url);
            console.log('✅ WhatsApp opened successfully');
            
            // Save to history as "sent"
            await saveToHistory(workerId, payment, 'whatsapp', body, 'sent');
            setSnackbar({ visible: true, message: '💬 WhatsApp opened. Message saved to history.' });
          } else {
            // Fallback to web WhatsApp
            console.log('📱 WhatsApp app not available, trying web fallback');
            const digits = phoneValidation.cleaned.replace(/[^0-9]/g, '');
            if (digits) {
              const webUrl = `https://wa.me/${digits}?text=${encoded}`;
              await Linking.openURL(webUrl);
              console.log('✅ WhatsApp web opened successfully');
              
              await saveToHistory(workerId, payment, 'whatsapp', body, 'sent');
              setSnackbar({ visible: true, message: '💬 WhatsApp web opened. Message saved to history.' });
            } else {
              console.error('❌ WhatsApp not available and phone number invalid');
              setSnackbar({ visible: true, message: 'WhatsApp not available and invalid phone number' });
            }
          }
        } catch (e) {
          console.error('❌ WhatsApp opening failed:', e);
          setSnackbar({ visible: true, message: `Failed to open WhatsApp: ${e.message}` });
        }
      }
      return;
    }

    if (action === 'save') {
      console.log('💾 Saving message to outbox for later');
      
      // Validate phone number for outbox too
      const phoneValidation = validatePhoneNumber(worker.phone);
      if (!phoneValidation.valid) {
        console.warn('⚠️ Saving to outbox with invalid phone:', phoneValidation.error);
      }

      try {
        const id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
        const deferred = {
          id,
          workerId,
          workerName: worker.name || 'Unknown',
          phone: phoneValidation.valid ? phoneValidation.cleaned : (worker.phone || null),
          channel: channel || 'sms',
          mode: 'snapshot', // snapshot stores the body now
          template: 'detailed',
          snapshotBody: body,
          createdAt: new Date().toISOString(),
          status: 'pending',
          paymentId: payment?.id || null,
          paymentAmount: payment?.amount || null
        };
        
        dispatch({ type: 'ADD_DEFERRED_MESSAGE', payload: deferred });
        console.log(`✅ Message saved to outbox: ${channel.toUpperCase()} for ${worker.name}`);
        setSnackbar({ visible: true, message: '💾 Message saved to Outbox' });
      } catch (error) {
        console.error('❌ Failed to save to outbox:', error);
        setSnackbar({ visible: true, message: 'Failed to save message to outbox' });
      }
    }
  };


  const handleRefresh = async () => {
    await refreshData();
  };

  return (
    <SafeAreaView style={styles.safeArea}> 
      <ScrollView 
        contentContainerStyle={styles.container} 
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: '#f5f5f5' }}
      >
        {/* Header with refresh button */}
        <View style={styles.headerContainer}>
          <Text style={styles.screenTitle}>Payment Screen</Text>
          <IconButton
            icon="refresh"
            size={24}
            onPress={handleRefresh}
            style={styles.refreshButton}
          />
        </View>

        <View style={styles.stickyBalanceCard}>
          <BalanceCard title="Current Balance" balance={balance} />
          {selectedWorker && (
            <TouchableOpacity
              style={styles.ledgerButton}
              onPress={() => navigation.navigate('LedgerScreen', { workerId: selectedWorker })}
              activeOpacity={0.7}
            >
              <Text style={styles.ledgerButtonText}>📖 View Ledger</Text>
            </TouchableOpacity>
          )}
        </View>
        {workers.length === 0 ? (
          <Card style={[styles.card, { backgroundColor: '#fff' }]}>
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: '#333' }]}>No workers found</Text>
              <Text style={[styles.emptyStateSubtext, { color: '#333' }]}>Add workers from Master section first</Text>
            </View>
          </Card>
        ) : (
          <Card style={[styles.card, { backgroundColor: '#fff' }]}>
            <Card.Content>
              <Text style={[styles.label, { color: '#333' }]}>Worker</Text>
              <TouchableOpacity
                style={styles.workerSelectBtn}
                activeOpacity={0.8}
                onPress={() => setWorkerSheetOpen(true)}
                disabled={workers.length === 0}
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
                  <Text style={[styles.workerSelectText, { color: '#333' }]}>
                    {selectedWorker ? workers.find(w => w.id === selectedWorker)?.name : "Select Worker"}
                  </Text>
                </View>
              </TouchableOpacity>
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
                    <Text style={[styles.workerItemText, { color: '#333' }]}>{item.name}</Text>
                    {selectedWorker === item.id && <Text style={styles.workerCheck}>✔</Text>}
                  </TouchableOpacity>
                )}
                style={{ marginTop: 10, maxHeight: 320 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </Modal>
          {/* Date Picker Button */}
          <Text style={[styles.label, { color: '#333' }]}>Date</Text>
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
              onChange={(e, d) => {
                setShowDatePicker(false);
                if (d) setDate(d);
              }}
              maximumDate={new Date()}
            />
          )}
          {/* Amount Input */}
          <Text style={[styles.label, { color: '#333' }]}>Amount</Text>
          <TextInput
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            style={styles.input}
          />
          {/* Payment Type Selector */}
          <Text style={[styles.label, { color: '#333' }]}>Payment Type</Text>
          <View style={styles.paymentTypeRow}>
            {['Cash', 'UPI'].map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.paymentTypeBtn, paymentType === type && styles.paymentTypeBtnActive]}
                onPress={() => setPaymentType(type)}
              >
                <Text style={[styles.paymentTypeText, paymentType === type && styles.paymentTypeTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Narration Input */}
          <Text style={[styles.label, { color: '#333' }]}>Notes</Text>
          <TextInput
            label="Notes"
            value={narration}
            onChangeText={setNarration}
            multiline
            style={styles.input}
          />
          {/* Save Payment Button */}
          <Button
            mode="contained"
            onPress={savePaymentHandler}
            style={styles.saveBtn}
            loading={saving}
            disabled={saving || !selectedWorker || !amount || !date || !paymentType}
          >
            Save Payment
          </Button>
            </Card.Content>
          </Card>
        )}
          {/* Post-save SMS modal (non-blocking) */}
          <Modal
            isVisible={pendingSms.visible}
            onBackdropPress={() => setPendingSms({ visible: false, workerId: null, payment: null })}
            backdropOpacity={0.3}
            animationIn="zoomIn"
            animationOut="zoomOut"
          >
            <View style={styles.smsModalOverlay}>
                <View style={styles.smsModalCard}>
                  <Text style={[styles.smsModalTitle, { color: '#333' }]}>Notify worker?</Text>
                  <Text style={styles.smsModalSubtitle}>Choose how you want to notify the worker about this payment.</Text>

                  <Button
                    mode="contained"
                    icon="message"
                    onPress={() => handleMessageChoice('send', 'sms')}
                    contentStyle={styles.fullBtnContent}
                    labelStyle={styles.fullBtnLabel}
                    style={styles.fullBtn}
                  >
                    Send SMS
                  </Button>

                  <Button
                    mode="contained"
                    icon="whatsapp"
                    onPress={() => handleMessageChoice('send', 'whatsapp')}
                    contentStyle={[styles.fullBtnContent, { backgroundColor: '#25D366' }]}
                    labelStyle={[styles.fullBtnLabel, { color: '#fff' }]}
                    style={[styles.fullBtn, { backgroundColor: '#25D366' }]}
                  >
                    Send WhatsApp
                  </Button>

                  <View style={{ marginTop: 14 }}>
                    <Text style={{ color: '#666', marginBottom: 8, fontWeight: '600' }}>Save snapshot to Outbox as</Text>
                    <View style={{ flexDirection: 'row' }}>
                      <Button mode={pendingSaveChannel === 'sms' ? 'contained' : 'outlined'} onPress={() => setPendingSaveChannel('sms')} style={{ flex: 1, marginRight: 8 }}>SMS</Button>
                      <Button mode={pendingSaveChannel === 'whatsapp' ? 'contained' : 'outlined'} onPress={() => setPendingSaveChannel('whatsapp')} style={{ flex: 1 }}>WhatsApp</Button>
                    </View>
                    <Button
                      mode="contained"
                      onPress={() => handleMessageChoice('save', pendingSaveChannel)}
                      contentStyle={styles.saveOutboxContent}
                      labelStyle={{ fontWeight: '700' }}
                      style={{ marginTop: 12, borderRadius: 10 }}
                    >
                      Save to Outbox
                    </Button>
                  </View>

                  <Button onPress={() => setPendingSms({ visible: false, workerId: null, payment: null })} style={{ marginTop: 12 }}>Cancel</Button>
                </View>
              </View>
          </Modal>
          <Snackbar
            visible={snackbar.visible}
            onDismiss={() => setSnackbar({ visible: false, message: "" })}
            duration={2500}
          >
            {snackbar.message}
          </Snackbar>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  paymentTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  paymentTypeBtn: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#f7f7fa',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    elevation: 1,
  },
  paymentTypeBtnActive: {
    backgroundColor: '#2c3e50',
  },
  paymentTypeText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  paymentTypeTextActive: {
    color: '#fff',
  },
  smsModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  smsModalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  smsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
  },
  smsModalSubtitle: {
    marginTop: 6,
    color: '#666',
  },
  smsButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  smsPrimaryContent: { paddingVertical: 10 },
  smsSecondaryContent: { paddingVertical: 10 },
  smsPrimaryBtn: { flex: 1, marginRight: 8, borderRadius: 10 },
  smsSecondaryBtn: { flex: 1, marginLeft: 8, borderRadius: 10 },
  smsTertiaryBtn: { marginTop: 12, alignSelf: 'center' },
  smsPrimaryLabel: { color: '#fff', fontWeight: '700' },
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
    width: '100%',
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
  workerSearchInput: {
    marginBottom: 8,
    backgroundColor: '#f7f7fa',
    borderRadius: 8,
  },
  sheetContent: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
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
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
    color: '#2c3e50',
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
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
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
  // Enhanced modal button styles
  fullBtn: {
    marginTop: 12,
    borderRadius: 10,
  },
  fullBtnContent: {
    paddingVertical: 8,
  },
  ledgerButton: {
    backgroundColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  ledgerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  fullBtnLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveOutboxContent: {
    paddingVertical: 8,
  },
});
