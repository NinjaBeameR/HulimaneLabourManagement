import React, { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, View, Modal, StatusBar, Platform, ActivityIndicator, Alert, ScrollView } from "react-native";
import { Text, TextInput, Button, Card, Title, IconButton } from "react-native-paper";
import { getItem, setItem } from "../utils/storage";
import { saveSubcategories } from '../utils/GlobalStore';

export default function CategorySubcategoryScreen({ route, navigation }) {
  const { categoryId, categoryName } = route.params;
  const topPad = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false); // false | 'edit'
  const [form, setForm] = useState({ subcategoryName: '', id: null });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const subs = await getItem("subcategories", []);
      // Show subcategories that belong to this category (support both old and new shapes)
      setSubcategories((subs || []).filter(s => {
        if (s.categoryIds && Array.isArray(s.categoryIds)) return s.categoryIds.includes(categoryId);
        if (s.categoryId) return s.categoryId === categoryId;
        return false;
      }));
      setLoading(false);
    })();
  }, [categoryId]);

  // Save changed subcategories into storage while preserving other categories' subcategories
  const persistSubcategories = async (next) => {
    const allSubs = await getItem("subcategories", []);
    const filtered = allSubs.filter(s => {
      // remove subcategories that belong exclusively to this categoryId (old shape) or that include this category
      if (s.categoryIds && Array.isArray(s.categoryIds)) {
        return !s.categoryIds.includes(categoryId);
      }
      if (s.categoryId) return s.categoryId !== categoryId;
      return true;
    });
    // ensure new ones have categoryIds set
    const normalized = next.map(s => ({ ...s, categoryIds: s.categoryIds || (s.categoryId ? [s.categoryId] : [categoryId]), subcategoryName: s.subcategoryName || s.subcategory || '' }));
    await setItem("subcategories", [...normalized, ...filtered]);
    setSubcategories(next);
  };

  const addSubcategory = async () => {
  if (!form.subcategoryName) return alert("Subcategory Name required");
  const s = { id: Date.now().toString(), subcategoryName: form.subcategoryName, categoryIds: [categoryId], subcategory: form.subcategoryName };
  await persistSubcategories([s, ...subcategories]);
    setForm({ subcategoryName: '', id: null });
    setModalVisible(false);
  };

  const handleEdit = (sub) => {
    setForm({ subcategoryName: sub.subcategoryName, id: sub.id });
    setModalVisible('edit');
  };

  const handleDelete = (sub) => {
    Alert.alert('Delete Subcategory?', 'This will remove this subcategory association from the current category. If the subcategory is used by other categories it will remain there. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        // Load all subs and update
        const all = await getItem('subcategories', []);
        const nextAll = all.map(s => {
          if (s.id !== sub.id) return s;
          // if categoryIds present, remove this categoryId from list
          if (s.categoryIds && Array.isArray(s.categoryIds)) {
            const ids = s.categoryIds.filter(id => id !== categoryId);
            if (ids.length === 0) return null; // drop entirely
            return { ...s, categoryIds: ids };
          }
          if (s.categoryId && s.categoryId === categoryId) {
            // old shape: drop
            return null;
          }
          return s;
        }).filter(Boolean);
        await setItem('subcategories', nextAll);
        setSubcategories(nextAll.filter(s => (s.categoryIds || []).includes(categoryId) || s.categoryId === categoryId));
      }}
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: topPad }]}> 
      <View style={styles.headerRow}>
        <IconButton icon="arrow-left" size={28} onPress={() => navigation.goBack()} />
        <Title style={styles.title}>{categoryName}</Title>
        <View style={{ width: 40 }} />
      </View>
      <Button mode="contained" style={styles.addBtn} onPress={() => setModalVisible(true)}>Add Subcategory</Button>
      {loading ? <ActivityIndicator size="large" style={{ marginTop: 32 }} /> : (
        <ScrollView style={styles.listWrap}>
          {subcategories.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#888', marginTop: 24 }}>No subcategories yet.</Text>
          ) : (
            subcategories.map((s) => (
              <Card key={s.id} style={styles.catCard}>
                <View style={styles.catRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catName}>{s.subcategoryName}</Text>
                  </View>
                  <View style={styles.actionCol}>
                    <IconButton icon="pencil" size={22} onPress={() => handleEdit(s)} />
                    <IconButton icon="delete" size={22} onPress={() => handleDelete(s)} />
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}
      <Modal visible={modalVisible === true} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Title style={{ marginBottom: 12 }}>Add Subcategory</Title>
            <TextInput label="Subcategory Name" value={form.subcategoryName} onChangeText={v => setForm(f => ({ ...f, subcategoryName: v }))} style={styles.input} />
            <Button mode="contained" style={{ marginTop: 16 }} onPress={addSubcategory}>Save</Button>
            <Button style={{ marginTop: 8 }} onPress={() => setModalVisible(false)}>Cancel</Button>
          </View>
        </View>
      </Modal>
      <Modal visible={modalVisible === 'edit'} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Title style={{ marginBottom: 12 }}>Edit Subcategory</Title>
            <TextInput label="Subcategory Name" value={form.subcategoryName} onChangeText={v => setForm(f => ({ ...f, subcategoryName: v }))} style={styles.input} />
            <Button mode="contained" style={{ marginTop: 16 }} onPress={async () => {
              // Save edits - update global storage preserving other entries
              const all = await getItem('subcategories', []);
              const nextAll = all.map(s => s.id === form.id ? { ...s, subcategoryName: form.subcategoryName, subcategory: form.subcategoryName } : s);
              await setItem('subcategories', nextAll);
              setSubcategories(nextAll.filter(s => (s.categoryIds || []).includes(categoryId) || s.categoryId === categoryId));
              setModalVisible(false);
              setForm({ subcategoryName: '', id: null });
            }}>Save</Button>
            <Button style={{ marginTop: 8 }} onPress={() => { setModalVisible(false); setForm({ subcategoryName: '', id: null }); }}>Cancel</Button>
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
