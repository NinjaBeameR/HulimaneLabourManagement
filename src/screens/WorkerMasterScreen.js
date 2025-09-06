import React, { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, View, Modal, TouchableOpacity, StatusBar, Platform, ActivityIndicator, Alert, FlatList } from "react-native";
import { Text, TextInput, Button, Card, Title, IconButton, Snackbar, Paragraph } from "react-native-paper";
import { useGlobalStore } from "../utils/GlobalStore";

function WorkerMasterScreen({ goBack }) {
  const topPad = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
  const { state, dispatch } = useGlobalStore();
  const workers = state.workers;
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', openingBalance: '' });
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });
  // SMS moved to Payment flow; per-worker SMS removed

  const validateForm = () => {
    if (!form.name.trim()) {
      setSnackbar({ visible: true, message: "Worker name is required" });
      return false;
    }
    if (!editingWorker && !form.openingBalance.trim()) {
      setSnackbar({ visible: true, message: "Opening balance is required" });
      return false;
    }
    if (!editingWorker && isNaN(Number(form.openingBalance))) {
      setSnackbar({ visible: true, message: "Opening balance must be a valid number" });
      return false;
    }
    
    // Check for duplicate names
    const isDuplicate = workers.some(w => 
      w.name.toLowerCase().trim() === form.name.toLowerCase().trim() && 
      (!editingWorker || w.id !== editingWorker.id)
    );
    
    if (isDuplicate) {
      setSnackbar({ visible: true, message: "Worker name already exists" });
      return false;
    }
    
    return true;
  };

  const addWorker = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const worker = {
        id: Date.now().toString(),
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        openingBalance: Number(form.openingBalance),
        locked: true
      };
      
      dispatch({ type: 'ADD_WORKER', payload: worker });
      setSnackbar({ visible: true, message: "Worker added successfully" });
      resetForm();
    } catch (error) {
      setSnackbar({ visible: true, message: "Error adding worker" });
    }
    setLoading(false);
  };

  const updateWorker = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const updatedWorker = {
        ...editingWorker,
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        // Keep original opening balance - cannot be edited
      };
      
      dispatch({ type: 'UPDATE_WORKER', payload: updatedWorker });
      setSnackbar({ visible: true, message: "Worker updated successfully" });
      resetForm();
    } catch (error) {
      setSnackbar({ visible: true, message: "Error updating worker" });
    }
    setLoading(false);
  };

  const deleteWorker = (workerId) => {
    Alert.alert(
      "Delete Worker",
      "This will permanently delete the worker and all related data. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            dispatch({ type: 'DELETE_WORKER', payload: workerId });
            setSnackbar({ visible: true, message: "Worker deleted successfully" });
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setForm({ name: '', address: '', phone: '', openingBalance: '' });
    setEditingWorker(null);
    setModalVisible(false);
  };

  const handleEdit = (worker) => {
    // Only allow editing address/phone/name, not openingBalance
    setForm({
      name: worker.name,
      address: worker.address,
      phone: worker.phone,
      openingBalance: worker.openingBalance?.toString() || '' // Display only, not editable
    });
    setEditingWorker(worker);
    setModalVisible(true);
  };

  const renderWorkerItem = ({ item }) => (
    <Card style={styles.workerCard}>
      <Card.Content>
        <View style={styles.workerHeader}>
          <Title style={styles.workerName}>{item.name}</Title>
          <View style={styles.workerActions}>
            <IconButton 
              icon="pencil" 
              iconColor="blue"
              onPress={() => handleEdit(item)} 
            />
            <IconButton 
              icon="delete" 
              iconColor="red"
              onPress={() => deleteWorker(item.id)} 
            />
          </View>
        </View>
        {item.address ? <Paragraph>📍 {item.address}</Paragraph> : null}
        {item.phone ? <Paragraph>📞 {item.phone}</Paragraph> : null}
        <Paragraph style={styles.balanceText}>
          💰 Opening Balance: ₹{item.openingBalance?.toFixed(2) || '0.00'}
        </Paragraph>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-left" size={28} onPress={goBack} />
        <Title style={styles.title}>Worker Master</Title>
        <View style={{ width: 40 }} />
      </View>
      
      <Button 
        mode="contained" 
        style={styles.addBtn} 
        onPress={() => setModalVisible(true)}
        icon="plus"
      >
        Add Worker
      </Button>
      
      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 32 }} />
      ) : workers.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No workers found</Text>
          <Text style={styles.emptySubtext}>Add a worker to get started</Text>
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(item) => item.id}
          renderItem={renderWorkerItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
      
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Title style={{ marginBottom: 12 }}>
              {editingWorker ? "Edit Worker" : "Add Worker"}
            </Title>
            <TextInput 
              label="Name" 
              value={form.name} 
              onChangeText={v => setForm(f => ({ ...f, name: v }))} 
              style={styles.input} 
            />
            <TextInput 
              label="Address" 
              value={form.address} 
              onChangeText={v => setForm(f => ({ ...f, address: v }))} 
              style={styles.input} 
            />
            <TextInput 
              label="Phone" 
              value={form.phone} 
              onChangeText={v => setForm(f => ({ ...f, phone: v }))} 
              style={styles.input} 
              keyboardType="phone-pad" 
            />
            <TextInput 
              label="Opening Balance" 
              value={form.openingBalance} 
              onChangeText={v => setForm(f => ({ ...f, openingBalance: v }))} 
              style={[styles.input, editingWorker && { backgroundColor: '#eee' }]} 
              keyboardType="numeric"
              editable={!editingWorker}
              placeholder={editingWorker ? "Cannot be changed" : "0.00"}
            />
            <Button 
              mode="contained" 
              style={{ marginTop: 16 }} 
              onPress={editingWorker ? updateWorker : addWorker}
              loading={loading}
              disabled={loading}
            >
              {editingWorker ? "Update" : "Save"}
            </Button>
            <Button 
              style={{ marginTop: 8 }} 
              onPress={resetForm}
              disabled={loading}
            >
              Cancel
            </Button>
          </View>
        </View>
      </Modal>
      
  {/* per-worker SMS preview removed (SMS now handled from Payment flow) */}

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: '' })}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbar({ visible: false, message: '' }),
        }}
      >
        {snackbar.message}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#2c3e50',
  },
  addBtn: {
    marginHorizontal: 20,
    marginBottom: 18,
    marginTop: 8,
    borderRadius: 8,
    elevation: 2,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  workerCard: {
    marginBottom: 14,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    backgroundColor: '#fff',
  },
  workerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    flex: 1,
  },
  workerActions: {
    flexDirection: 'row',
  },
  balanceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#27ae60',
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#7f8c8d',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  input: {
    marginBottom: 12,
  },
});

export default WorkerMasterScreen;
