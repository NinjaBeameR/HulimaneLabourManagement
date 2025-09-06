import React, { useState } from 'react';
import { View, FlatList, Linking, SafeAreaView } from 'react-native';
import { Text, Card, Button, Title, IconButton, Paragraph, Chip, Snackbar } from 'react-native-paper';
import { useGlobalStore } from '../utils/GlobalStore';
import { format, parseISO } from 'date-fns';

export default function OutboxScreen({ navigation }) {
  const { state, dispatch } = useGlobalStore();
  const items = state.deferredMessages || [];
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  // Enhanced phone validation
  const validatePhoneNumber = (phone) => {
    if (!phone || phone.trim().length === 0) return { valid: false, error: 'No phone number' };
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.length < 10) return { valid: false, error: 'Phone too short' };
    return { valid: true, cleaned };
  };

  const openSms = async (item) => {
    console.log(`📱 Attempting to send SMS from outbox for item: ${item.id}`);
    
    const body = item.mode === 'snapshot' ? item.snapshotBody : item.snapshotBody || '';
    if (!body) {
      console.error('❌ No message body found');
      setSnackbar({ visible: true, message: 'No message content to send' });
      return;
    }

    const phoneValidation = validatePhoneNumber(item.phone);
    if (!phoneValidation.valid) {
      console.error('❌ Invalid phone number:', phoneValidation.error);
      setSnackbar({ visible: true, message: `Cannot send SMS: ${phoneValidation.error}` });
      return;
    }

    const url = `sms:${phoneValidation.cleaned}?body=${encodeURIComponent(body)}`;
    
    try {
      console.log(`📱 Opening SMS composer with phone: ${phoneValidation.cleaned}`);
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        console.log('✅ SMS composer opened successfully');
        
        // Update status to sent and add timestamp
        const updatedItem = { 
          ...item, 
          status: 'sent', 
          sentAt: new Date().toISOString(),
          sentVia: 'sms'
        };
        dispatch({ type: 'UPDATE_DEFERRED_MESSAGE', payload: updatedItem });
        setSnackbar({ visible: true, message: '📱 SMS composer opened. Message marked as sent.' });
      } else {
        console.error('❌ SMS composer not supported');
        setSnackbar({ visible: true, message: 'SMS not supported on this device' });
      }
    } catch (e) {
      console.error('❌ Failed to open SMS:', e);
      setSnackbar({ visible: true, message: `Failed to open SMS: ${e.message}` });
    }
  };

  const openWhatsapp = async (item) => {
    console.log(`💬 Attempting to send WhatsApp from outbox for item: ${item.id}`);
    
    const body = item.mode === 'snapshot' ? item.snapshotBody : item.snapshotBody || '';
    if (!body) {
      console.error('❌ No message body found');
      setSnackbar({ visible: true, message: 'No message content to send' });
      return;
    }

    const phoneValidation = validatePhoneNumber(item.phone);
    if (!phoneValidation.valid) {
      console.error('❌ Invalid phone number:', phoneValidation.error);
      setSnackbar({ visible: true, message: `Cannot send WhatsApp: ${phoneValidation.error}` });
      return;
    }

    const encoded = encodeURIComponent(body);
    
    try {
      let url;
      // Format phone number properly for WhatsApp
      if (phoneValidation.cleaned.startsWith('+')) {
        url = `whatsapp://send?phone=${encodeURIComponent(phoneValidation.cleaned)}&text=${encoded}`;
      } else {
        // Add country code if missing (defaulting to +91 for India)
        const formattedPhone = phoneValidation.cleaned.length > 10 ? `+${phoneValidation.cleaned}` : `+91${phoneValidation.cleaned}`;
        url = `whatsapp://send?phone=${encodeURIComponent(formattedPhone)}&text=${encoded}`;
      }
      
      console.log(`💬 Opening WhatsApp with formatted phone`);
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        console.log('✅ WhatsApp opened successfully');
        
        // Update status to sent
        const updatedItem = { 
          ...item, 
          status: 'sent', 
          sentAt: new Date().toISOString(),
          sentVia: 'whatsapp'
        };
        dispatch({ type: 'UPDATE_DEFERRED_MESSAGE', payload: updatedItem });
        setSnackbar({ visible: true, message: '💬 WhatsApp opened. Message marked as sent.' });
      } else {
        // Fallback to web WhatsApp
        console.log('📱 WhatsApp app not available, trying web version');
        const digits = phoneValidation.cleaned.replace(/[^0-9]/g, '');
        if (digits) {
          const webUrl = `https://wa.me/${digits}?text=${encoded}`;
          await Linking.openURL(webUrl);
          console.log('✅ WhatsApp web opened successfully');
          
          const updatedItem = { 
            ...item, 
            status: 'sent', 
            sentAt: new Date().toISOString(),
            sentVia: 'whatsapp-web'
          };
          dispatch({ type: 'UPDATE_DEFERRED_MESSAGE', payload: updatedItem });
          setSnackbar({ visible: true, message: '💬 WhatsApp web opened. Message marked as sent.' });
        } else {
          console.error('❌ WhatsApp not available and phone invalid');
          setSnackbar({ visible: true, message: 'WhatsApp not available and phone number invalid' });
        }
      }
    } catch (e) {
      console.error('❌ Failed to open WhatsApp:', e);
      setSnackbar({ visible: true, message: `Failed to open WhatsApp: ${e.message}` });
    }
  };

  const deleteMessage = (itemId) => {
    console.log(`🗑️ Deleting message: ${itemId}`);
    dispatch({ type: 'DELETE_DEFERRED_MESSAGE', payload: itemId });
    setSnackbar({ visible: true, message: 'Message deleted' });
  };

  // Sort items: pending first, then by creation date (newest first)
  const sortedItems = [...items].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <SafeAreaView style={[{ flex: 1, padding: 16 }, { backgroundColor: '#f5f5f5' }] }>
      <Title style={{ marginBottom: 16, color: '#6200ee' }}>Message Outbox</Title>
      {sortedItems.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Paragraph style={{ color: '#333', textAlign: 'center', fontSize: 16 }}>
            📬 No messages in outbox
          </Paragraph>
          <Paragraph style={{ color: '#666', textAlign: 'center', marginTop: 8 }}>
            Messages will appear here when you choose "Save to Outbox" after making payments
          </Paragraph>
        </View>
      ) : (
        <>
          <Paragraph style={{ color: '#333', marginBottom: 16 }}>
            {sortedItems.filter(i => i.status === 'pending').length} pending • {sortedItems.filter(i => i.status === 'sent').length} sent
          </Paragraph>
          <FlatList
            data={sortedItems}
            keyExtractor={i => i.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const phoneValidation = validatePhoneNumber(item.phone);
              const isPhoneValid = phoneValidation.valid;
              
              return (
                <Card style={{ 
                  marginBottom: 16, 
                  borderRadius: 12, 
                  elevation: 2,
                  backgroundColor: item.status === 'sent' ? '#fafafa' : '#f5f5f5',
                  borderLeftWidth: 4,
                  borderLeftColor: item.status === 'sent' ? '#4caf50' : '#6200ee'
                }}>
                  <Card.Content>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', fontSize: 16, color: '#333' }}>
                          {item.workerName || 'Unknown Worker'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <Text style={{ color: isPhoneValid ? '#4caf50' : '#f44336', fontSize: 14 }}>
                            📱 {item.phone || 'No phone'}
                          </Text>
                          {!isPhoneValid && (
                            <Chip icon="alert" compact style={{ marginLeft: 8, backgroundColor: '#ffebee' }}>
                              Invalid
                            </Chip>
                          )}
                        </View>
                        <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                          Created: {item.createdAt ? format(parseISO(item.createdAt), 'dd/MM/yyyy HH:mm') : 'Unknown'}
                        </Text>
                        {item.sentAt && (
                          <Text style={{ color: '#4caf50', fontSize: 12, fontWeight: '600' }}>
                            ✅ Sent: {format(parseISO(item.sentAt), 'dd/MM/yyyy HH:mm')} via {item.sentVia || item.channel}
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Chip 
                          icon={item.mode === 'snapshot' ? 'content-save' : 'clock'} 
                          compact 
                          style={{ backgroundColor: '#e3f2fd' }}
                        >
                          {item.mode === 'snapshot' ? 'Snapshot' : 'Draft'}
                        </Chip>
                        {item.status === 'sent' && (
                          <Text style={{ color: '#4caf50', fontWeight: '700', marginTop: 6, fontSize: 12 }}>
                            SENT ✓
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    <View style={{ backgroundColor: '#fafafa', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                      <Paragraph style={{ fontSize: 14, lineHeight: 20, color: '#333' }}>
                        {item.snapshotBody}
                      </Paragraph>
                    </View>

                    {item.paymentAmount && (
                      <Text style={{ color: '#666', fontSize: 12 }}>
                        💰 Payment: ₹{item.paymentAmount}
                      </Text>
                    )}
                  </Card.Content>
                  
                  <Card.Actions style={{ paddingTop: 0 }}>
                    {item.status !== 'sent' && isPhoneValid && (
                      <>
                        {(item.channel === 'sms' || !item.channel) && (
                          <Button 
                            mode="contained" 
                            icon="message" 
                            onPress={() => openSms(item)} 
                            style={{ marginRight: 8, backgroundColor: '#6200ee' }}
                          >
                            Send SMS
                          </Button>
                        )}
                        {(item.channel === 'whatsapp' || !item.channel) && (
                          <Button 
                            mode="contained" 
                            icon="whatsapp" 
                            onPress={() => openWhatsapp(item)} 
                            style={{ backgroundColor: '#25D366', marginRight: 8 }}
                          >
                            WhatsApp
                          </Button>
                        )}
                      </>
                    )}
                    
                    <Button 
                      mode="outlined" 
                      icon="delete" 
                      textColor="#f44336"
                      onPress={() => deleteMessage(item.id)}
                      style={{ borderColor: '#f44336' }}
                    >
                      Delete
                    </Button>
                  </Card.Actions>
                </Card>
              );
            }}
          />
        </>
      )}
      
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={3000}
        style={{ backgroundColor: '#6200ee' }}
      >
        {snackbar.message}
      </Snackbar>
    </SafeAreaView>
  );
}
