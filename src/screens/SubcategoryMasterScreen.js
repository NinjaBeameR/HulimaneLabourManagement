import React, { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, View, Modal, TouchableOpacity, StatusBar, Platform, ActivityIndicator, Alert } from "react-native";
import { Text, TextInput, Button, Card, Title, IconButton } from "react-native-paper";
import { getItem, setItem } from "../utils/storage";

export default function SubcategoryMasterScreen({ goBack }) {
  const topPad = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false); // false | 'edit'
  const [form, setForm] = useState({ subcategory: '', id: null });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const subs = await getItem("subcategories", []);
      // normalize older shape to include categoryIds and subcategoryName
      const normalized = (subs || []).map(s => ({
        ...s,
        categoryIds: s.categoryIds || (s.categoryId ? [s.categoryId] : []),
        subcategoryName: s.subcategoryName || s.subcategory || ''
      }));
      setSubcategories(normalized);
      setLoading(false);
    })();
  }, []);

  const saveSubcategories = async (next) => {
    // ensure stored items are normalized
    const normalized = next.map(s => ({ ...s, categoryIds: s.categoryIds || (s.categoryId ? [s.categoryId] : []), subcategoryName: s.subcategoryName || s.subcategory || '' }));
    setSubcategories(normalized);
    await setItem("subcategories", normalized);
  };

  const addSubcategory = async () => {
  if (!form.subcategory) return alert("Subcategory Name required");
  const s = { id: Date.now().toString(), subcategory: form.subcategory, subcategoryName: form.subcategory, categoryIds: [] };
  await saveSubcategories([s, ...subcategories]);
    setForm({ subcategory: '', id: null });
    setModalVisible(false);
  };

  const handleEdit = (sub) => {
  setForm({ subcategory: sub.subcategoryName || sub.subcategory, id: sub.id });
    setModalVisible('edit');
  };

  const handleDelete = (sub) => {
    Alert.alert('Delete Subcategory?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
    const next = subcategories.filter((s) => s.id !== sub.id);
    await saveSubcategories(next);
      }}
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: topPad }]}> 
      <View style={styles.headerRow}>
        <IconButton icon="arrow-left" size={28} onPress={goBack} />
        <Title style={styles.title}>Subcategory Master</Title>
        <View style={{ width: 40 }} />
      </View>
      <Button mode="contained" style={styles.addBtn} onPress={() => setModalVisible(true)}>Add Subcategory</Button>
      {loading ? <ActivityIndicator size="large" style={{ marginTop: 32 }} /> : (
        <View style={styles.listWrap}>
          {subcategories.map((s) => (
            <Card key={s.id} style={styles.catCard}>
              <View style={styles.catRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName}>{s.subcategory}</Text>
                </View>
                <View style={styles.actionCol}>
                  <IconButton icon="pencil" size={22} onPress={() => handleEdit(s)} />
                  <IconButton icon="delete" size={22} onPress={() => handleDelete(s)} />
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
      <Modal visible={modalVisible === true} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Title style={{ marginBottom: 12 }}>Add Subcategory</Title>
            <TextInput label="Subcategory Name" value={form.subcategory} onChangeText={v => setForm(f => ({ ...f, subcategory: v }))} style={styles.input} />
            <Button mode="contained" style={{ marginTop: 16 }} onPress={addSubcategory}>Save</Button>
            <Button style={{ marginTop: 8 }} onPress={() => setModalVisible(false)}>Cancel</Button>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={modalVisible === 'edit'} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Title style={{ marginBottom: 12 }}>Edit Subcategory</Title>
            <TextInput label="Subcategory Name" value={form.subcategory} onChangeText={v => setForm(f => ({ ...f, subcategory: v }))} style={styles.input} />
            <Button mode="contained" style={{ marginTop: 16 }} onPress={async () => {
              // Save edits - persist normalized
              const next = subcategories.map(s => s.id === form.id ? { ...s, subcategoryName: form.subcategory, subcategory: form.subcategory } : s);
              await saveSubcategories(next);
              setModalVisible(false);
              setForm({ subcategory: '', id: null });
            }}>Save</Button>
            <Button style={{ marginTop: 8 }} onPress={() => { setModalVisible(false); setForm({ subcategory: '', id: null }); }}>Cancel</Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
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
  listWrap: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  catCard: {
    marginBottom: 14,
    borderRadius: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    backgroundColor: '#f7f7fa',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  catName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 2,
  },
  actionCol: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    width: 320,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#f7f7fa',
  },
});
