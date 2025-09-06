import React from "react";
import { View, Text, SafeAreaView, StyleSheet, StatusBar, TouchableOpacity, ScrollView, Dimensions, Platform } from "react-native";
import { IconButton, Portal, Dialog, Button, Snackbar, Surface, Title } from "react-native-paper";
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import WorkerMasterScreen from "./WorkerMasterScreen";
import CategoryMasterScreen from "./CategoryMasterScreen";
import { useGlobalStore } from '../utils/GlobalStore';

const { width, height } = Dimensions.get('window');

export default function MasterScreen({ navigation }) {
  const [page, setPage] = React.useState(null); // null, 'worker', 'category'
  const [versionDialogVisible, setVersionDialogVisible] = React.useState(false);
  const [snackbarVisible, setSnackbarVisible] = React.useState(false);
  
  const { state, dispatch, refreshData } = useGlobalStore();

  const handleRefresh = async () => {
    await refreshData();
  };

  // Get data counts for display
  const workerCount = state.workers?.length || 0;
  const categoryCount = state.categories?.length || 0;
  const subcategoryCount = state.subcategories?.length || 0;
  const entryCount = state.entries?.length || 0;
  const paymentCount = state.payments?.length || 0;

  if (page === 'worker') return <WorkerMasterScreen goBack={() => setPage(null)} />;
  if (page === 'category') return <CategoryMasterScreen goBack={() => setPage(null)} />;

  return (
    <SafeAreaView style={styles.safeArea}> 
      <StatusBar
        backgroundColor="#f5f5f5"
        barStyle="dark-content"
      />
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Header Section */}
        <Surface style={styles.headerSurface} elevation={3}>
          <View style={styles.headerContainer}>
            <View style={styles.headerMain}>
              <Title style={styles.headerTitle}>Master Data</Title>
              <Text style={styles.headerSubtitle}>Manage workers and categories</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.infoButton}
                onPress={() => {
                  try {
                    setVersionDialogVisible(true);
                  } catch (error) {
                    console.log('Error showing version dialog:', error);
                  }
                }}
                activeOpacity={0.7}
                android_ripple={{ color: '#e8eaf6', borderless: true, radius: 20 }}
              >
                <Ionicons name="information-circle-outline" size={22} color="#5C6BC0" />
              </TouchableOpacity>
            </View>
          </View>
        </Surface>

        {/* Main Action Cards */}
        <View style={styles.mainSection}>
          <Text style={styles.sectionTitle}>Master Data Management</Text>
          
          <TouchableOpacity 
            style={[styles.primaryActionCard, styles.cardTouchable]} 
            onPress={() => setPage('worker')} 
            activeOpacity={0.92}
            android_ripple={{ color: 'rgba(33, 150, 243, 0.12)', borderless: false }}
          >
            <Surface style={styles.actionCardSurface} elevation={4}>
              <View style={styles.actionCardContent}>
                <View style={styles.actionCardHeader}>
                  <View style={styles.actionCardIconContainer}>
                    <Ionicons name="people-outline" size={32} color="#2196F3" />
                  </View>
                  <View style={styles.actionCardMeta}>
                    <Text style={styles.actionCardCount}>{workerCount}</Text>
                    <Text style={styles.actionCardLabel}>Workers</Text>
                  </View>
                </View>
                <View style={styles.actionCardBody}>
                  <Text style={styles.actionCardTitle}>Worker Master</Text>
                  <Text style={styles.actionCardDescription}>
                    Manage worker profiles, opening balances, and contact details
                  </Text>
                </View>
                <View style={styles.actionCardFooter}>
                  <Ionicons name="chevron-forward" size={20} color="#90A4AE" />
                </View>
              </View>
            </Surface>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.primaryActionCard, styles.cardTouchable]} 
            onPress={() => setPage('category')} 
            activeOpacity={0.92}
            android_ripple={{ color: 'rgba(255, 152, 0, 0.12)', borderless: false }}
          >
            <Surface style={styles.actionCardSurface} elevation={4}>
              <View style={styles.actionCardContent}>
                <View style={styles.actionCardHeader}>
                  <View style={styles.actionCardIconContainer}>
                    <Ionicons name="pricetags-outline" size={32} color="#FF9800" />
                  </View>
                  <View style={styles.actionCardMeta}>
                    <Text style={styles.actionCardCount}>{categoryCount}</Text>
                    <Text style={styles.actionCardLabel}>Categories</Text>
                  </View>
                </View>
                <View style={styles.actionCardBody}>
                  <Text style={styles.actionCardTitle}>Category Master</Text>
                  <Text style={styles.actionCardDescription}>
                    Manage work categories and their subcategories
                  </Text>
                </View>
                <View style={styles.actionCardFooter}>
                  <Ionicons name="chevron-forward" size={20} color="#90A4AE" />
                </View>
              </View>
            </Surface>
          </TouchableOpacity>
        </View>

        {/* Footer Spacing */}
        <View style={styles.footerSpacing} />
      </ScrollView>

      {/* Version Info Dialog */}
      <Portal>
        <Dialog visible={versionDialogVisible} onDismiss={() => setVersionDialogVisible(false)}>
          <Dialog.Icon icon="information" color="#2196F3" size={60} />
          <Dialog.Title style={styles.dialogTitle}>App Version</Dialog.Title>
          <Dialog.Content>
            <View style={styles.versionContent}>
              <Text style={styles.versionLabel}>App Version:</Text>
              <Text style={styles.versionValue}>1.0.0</Text>
              
              <Text style={styles.versionLabel}>Build Number:</Text>
              <Text style={styles.versionValue}>1</Text>
              
              <Text style={styles.versionLabel}>Runtime Version:</Text>
              <Text style={styles.versionValue}>1.0.0</Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button 
              onPress={() => setVersionDialogVisible(false)} 
              textColor="#2196F3"
              style={styles.confirmButton}
            >
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Success Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        Operation completed successfully
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#fafafa' 
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  
  // Modern Header Section
  headerSurface: {
    backgroundColor: '#ffffff',
    marginBottom: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerMain: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '400',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  // Main Section
  mainSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
    marginLeft: 4,
  },
  primaryActionCard: {
    marginBottom: 20,
  },
  cardTouchable: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  actionCardSurface: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: Platform.OS === 'ios' ? '#000' : '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === 'ios' ? 0.15 : 0.18,
    shadowRadius: Platform.OS === 'ios' ? 24 : 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  actionCardContent: {
    padding: 24,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionCardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  actionCardMeta: {
    alignItems: 'flex-end',
  },
  actionCardCount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
    lineHeight: 32,
  },
  actionCardLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionCardBody: {
    marginBottom: 16,
  },
  actionCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  actionCardDescription: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
    fontWeight: '400',
  },
  actionCardFooter: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  actionCardArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Settings Section
  settingsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  settingsCard: {
    marginBottom: 12,
  },
  settingsCardSurface: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#6200ee',
  },
  settingsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  settingsCardIcon: {
    marginRight: 16,
  },
  settingsCardText: {
    flex: 1,
  },
  settingsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  footerSpacing: {
    paddingVertical: 10,
    marginBottom: 20,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  dialogContent: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  cancelButton: {
    marginRight: 8,
  },
  confirmButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  versionContent: {
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  versionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  snackbar: {
    backgroundColor: '#059669',
    borderRadius: 8,
    margin: 16,
  },
  // Settings Section
  settingsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  settingsCard: {
    marginBottom: 12,
  },
  settingsCardSurface: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#6200ee',
  },
  settingsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  settingsCardIcon: {
    marginRight: 16,
  },
  settingsCardText: {
    flex: 1,
  },
  settingsCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  actionCardArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  footerSpacing: {
    height: 40,
  },
  
  // Dialog Styles
  dialogTitle: {
    textAlign: 'center',
    color: '#e74c3c',
    fontWeight: '700',
    fontSize: 20,
  },
  dialogContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2c3e50',
    textAlign: 'center',
  },
  cancelButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  confirmButton: {
    borderRadius: 8,
    backgroundColor: '#fee',
    paddingHorizontal: 16,
  },
  
  // Version Dialog Styles
  versionContent: {
    paddingVertical: 8,
  },
  versionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
    marginTop: 12,
    marginBottom: 4,
  },
  versionValue: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  
  // Snackbar
  snackbar: {
    backgroundColor: '#27ae60',
    marginBottom: 20,
  },
});