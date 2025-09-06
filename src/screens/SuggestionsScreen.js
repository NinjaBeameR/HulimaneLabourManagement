import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Text, 
  Button, 
  Portal, 
  Dialog, 
  ActivityIndicator,
  Surface,
  Appbar
} from 'react-native-paper';
import { WebView } from 'react-native-webview';
import NetInfo from '@react-native-community/netinfo';

export default function SuggestionsScreen({ navigation }) {
  const [isConnected, setIsConnected] = useState(true);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState(false);
  
  // Your Netlify form URL - replace with your actual form URL
  const FORM_URL = "https://hlmadmin.netlify.app/";

  useEffect(() => {
    // Check internet connection when screen loads
    const checkConnection = async () => {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        setIsConnected(false);
        setShowConnectionDialog(true);
      }
    };
    
    checkConnection();

    // Listen for connection changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      if (!state.isConnected && !showConnectionDialog) {
        setShowConnectionDialog(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleRetry = () => {
    setWebViewError(false);
    setWebViewLoading(true);
    setShowConnectionDialog(false);
  };

  if (!isConnected) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Suggestions & Bug Reports" />
        </Appbar.Header>
        
        <View style={styles.centerContent}>
          <Surface style={styles.errorSurface} elevation={2}>
            <Text style={styles.errorText}>
              📡 No Internet Connection
            </Text>
            <Text style={styles.errorSubtext}>
              This feature requires internet access to load the feedback form.
            </Text>
            <Button 
              mode="contained" 
              onPress={handleRetry}
              style={styles.retryButton}
            >
              Check Connection
            </Button>
          </Surface>
        </View>

        <Portal>
          <Dialog 
            visible={showConnectionDialog} 
            onDismiss={() => setShowConnectionDialog(false)}
          >
            <Dialog.Title>Internet Connection Required</Dialog.Title>
            <Dialog.Content>
              <Text>
                The Suggestions & Bug Report feature requires an active internet connection to load the feedback form. 
                Please connect to Wi-Fi or mobile data and try again.
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowConnectionDialog(false)}>
                OK
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </SafeAreaView>
    );
  }

  if (webViewError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Suggestions & Bug Reports" />
        </Appbar.Header>
        
        <View style={styles.centerContent}>
          <Surface style={styles.errorSurface} elevation={2}>
            <Text style={styles.errorText}>
              ⚠️ Failed to Load Form
            </Text>
            <Text style={styles.errorSubtext}>
              Unable to load the feedback form. Please check your internet connection.
            </Text>
            <Button 
              mode="contained" 
              onPress={handleRetry}
              style={styles.retryButton}
            >
              Retry
            </Button>
          </Surface>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Suggestions & Bug Reports" />
      </Appbar.Header>
      
      {webViewLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.loadingText}>Loading feedback form...</Text>
          <Text style={styles.loadingSubtext}>Requires internet connection</Text>
        </View>
      )}
      
      <WebView
        source={{ uri: FORM_URL }}
        style={styles.webview}
        onLoadStart={() => setWebViewLoading(true)}
        onLoadEnd={() => setWebViewLoading(false)}
        onError={() => {
          setWebViewError(true);
          setWebViewLoading(false);
        }}
        onHttpError={() => {
          setWebViewError(true);
          setWebViewLoading(false);
        }}
        startInLoadingState={true}
        scalesPageToFit={true}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        allowsBackForwardNavigationGestures={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="compatibility"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorSurface: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: 300,
    width: '100%',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 8,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
  },
});
