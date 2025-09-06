import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, SafeAreaView } from 'react-native';
import { setPin } from '../utils/auth';

export default function CreatePinScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNext = () => {
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }
    setStep(2);
    setError('');
  };

  const handleConfirm = async () => {
    if (pin !== confirmPin) {
      setError('PINs do not match');
      setConfirmPin('');
      return;
    }
    setLoading(true);
    try {
      await setPin(pin);
      setLoading(false);
      navigation.replace('MainTabs');
    } catch {
      setLoading(false);
      setError('Failed to save PIN. Try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        <Text style={styles.title}>Create PIN</Text>
        <Text style={styles.subtitle}>Set a 4-digit PIN to secure your app.</Text>
        {step === 1 ? (
          <>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              value={pin}
              onChangeText={setPinValue}
              placeholder="Enter PIN"
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.button} onPress={handleNext} disabled={loading}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="Confirm PIN"
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.button} onPress={handleConfirm} disabled={loading}>
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
          </>
        )}
        {loading && <ActivityIndicator style={{ marginTop: 16 }} color="#2196F3" />}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, color: '#000' },
  subtitle: { fontSize: 16, marginBottom: 24, color: '#666' },
  input: { 
    width: 180, 
    fontSize: 24, 
    textAlign: 'center', 
    borderBottomWidth: 2, 
    borderColor: '#2196F3',
    backgroundColor: '#f5f5f5',
    marginBottom: 16, 
    padding: 8 
  },
  button: { 
    paddingVertical: 12, 
    paddingHorizontal: 32, 
    borderRadius: 8, 
    marginTop: 8,
    backgroundColor: '#2196F3'
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  error: { marginTop: 12, fontSize: 16, color: '#f44336' },
});
