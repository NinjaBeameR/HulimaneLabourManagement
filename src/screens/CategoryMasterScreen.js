import React, { useState } from "react";
import { SafeAreaView, StyleSheet, View, Modal, Alert, FlatList } from "react-native";
import { Text, TextInput, Button, Card, Title, IconButton, Paragraph, Snackbar, ActivityIndicator } from "react-native-paper";
import { useGlobalStore } from "../utils/GlobalStore";

function CategoryMasterScreen({ goBack }) {
  const { state, dispatch } = useGlobalStore();
  const categories = state.categories || [];
  const subcategories = state.subcategories || [];
  
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [form, setForm] = useState({ category: '' });
  const [subForm, setSubForm] = useState({ subcategory: '', categoryIds: [] });
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });

  const validateCategoryForm = () => {
    if (!form.category.trim()) {
      setSnackbar({ visible: true, message: "Category name is required" });
      return false;
    }
    
    // Check for duplicate names
    const isDuplicate = categories.some(c => 
      c.category.toLowerCase().trim() === form.category.toLowerCase().trim() && 
      (!editingCategory || c.id !== editingCategory.id)
    );
    
    if (isDuplicate) {
      setSnackbar({ visible: true, message: "Category name already exists" });
      return false;
    }
    
    return true;
  };

  const addCategory = async () => {
    if (!validateCategoryForm()) return;
    
    setLoading(true);
    try {
      const category = {
        id: Date.now().toString(),
        category: form.category.trim()
      };
      
      dispatch({ type: 'ADD_CATEGORY', payload: category });
      setSnackbar({ visible: true, message: "Category added successfully" });
      resetCategoryForm();
    } catch (error) {
      setSnackbar({ visible: true, message: "Error adding category" });
    }
    setLoading(false);
  };

  const updateCategory = async () => {
    if (!validateCategoryForm()) return;
    
    setLoading(true);
    try {
      const updatedCategory = {
        ...editingCategory,
        category: form.category.trim()
      };
      
      dispatch({ type: 'UPDATE_CATEGORY', payload: updatedCategory });
      setSnackbar({ visible: true, message: "Category updated successfully" });
      resetCategoryForm();
    } catch (error) {
      setSnackbar({ visible: true, message: "Error updating category" });
    }
    setLoading(false);
  };

  const deleteCategory = (categoryId) => {
    Alert.alert(
      "Delete Category",
      "This will permanently delete the category and all related subcategories. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            dispatch({ type: 'DELETE_CATEGORY', payload: categoryId });
            setSnackbar({ visible: true, message: "Category deleted successfully" });
          }
        }
      ]
    );
  };

  const resetCategoryForm = () => {
    setForm({ category: '' });
    setEditingCategory(null);
    setModalVisible(false);
  };

  const validateSubcategoryForm = () => {
    if (!subForm.subcategory.trim()) {
      setSnackbar({ visible: true, message: "Subcategory name is required" });
      return false;
    }

    if (!subForm.categoryIds || subForm.categoryIds.length === 0) {
      setSnackbar({ visible: true, message: "Please select at least one category" });
      return false;
    }

    // Check for duplicate names within any of the selected categories
    const name = subForm.subcategory.toLowerCase().trim();
    const isDuplicate = subcategories.some(s => {
      if (editingSubcategory && s.id === editingSubcategory.id) return false;
      const sName = (s.subcategory || s.subcategoryName || '').toLowerCase().trim();
      if (sName !== name) return false;
      // if any category overlaps, consider duplicate for that category
      const overlap = (s.categoryIds || []).some(cid => subForm.categoryIds.includes(cid));
      return overlap;
    });

    if (isDuplicate) {
      setSnackbar({ visible: true, message: "Subcategory name already exists in one of the selected categories" });
      return false;
    }

    return true;
  };

  const addSubcategory = async () => {
    if (!validateSubcategoryForm()) return;

    setLoading(true);
    try {
      const subcategory = {
        id: Date.now().toString(),
        subcategory: subForm.subcategory.trim(),
        subcategoryName: subForm.subcategory.trim(), // keep backward compatibility
        categoryIds: Array.from(new Set(subForm.categoryIds))
      };

      dispatch({ type: 'ADD_SUBCATEGORY', payload: subcategory });
      setSnackbar({ visible: true, message: "Subcategory added successfully" });
      resetSubcategoryForm();
    } catch (error) {
      setSnackbar({ visible: true, message: "Error adding subcategory" });
    }
    setLoading(false);
  };

  const updateSubcategory = async () => {
    if (!validateSubcategoryForm()) return;

    setLoading(true);
    try {
      const updatedSubcategory = {
        ...editingSubcategory,
        subcategory: subForm.subcategory.trim(),
        subcategoryName: subForm.subcategory.trim(),
        categoryIds: Array.from(new Set(subForm.categoryIds))
      };

      dispatch({ type: 'UPDATE_SUBCATEGORY', payload: updatedSubcategory });
      setSnackbar({ visible: true, message: "Subcategory updated successfully" });
      resetSubcategoryForm();
    } catch (error) {
      setSnackbar({ visible: true, message: "Error updating subcategory" });
    }
    setLoading(false);
  };

  const deleteSubcategory = (subcategoryId) => {
    Alert.alert(
      "Delete Subcategory",
      "This will permanently delete the subcategory. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            dispatch({ type: 'DELETE_SUBCATEGORY', payload: subcategoryId });
            setSnackbar({ visible: true, message: "Subcategory deleted successfully" });
          }
        }
      ]
    );
  };

  const resetSubcategoryForm = () => {
    setSubForm({ subcategory: '', categoryIds: [] });
    setEditingSubcategory(null);
    setSubModalVisible(false);
  };

  const handleCategoryEdit = (category) => {
    setForm({ category: category.category });
    setEditingCategory(category);
    setModalVisible(true);
  };

  const handleSubcategoryEdit = (subcategory) => {
    setSubForm({ 
      subcategory: subcategory.subcategory || subcategory.subcategoryName || '', 
      categoryIds: subcategory.categoryIds ? [...subcategory.categoryIds] : (subcategory.categoryId ? [subcategory.categoryId] : [])
    });
    setEditingSubcategory(subcategory);
    setSubModalVisible(true);
  };

  const renderCategoryItem = ({ item }) => (
    <Card style={styles.catCard}>
      <Card.Content>
        <View style={styles.catRow}>
          <View style={{ flex: 1 }}>
            <Title style={styles.catName}>{item.category}</Title>
            <Paragraph style={styles.subcategoryCount}>
              {(subcategories || []).filter(s => {
                if (s.categoryIds && Array.isArray(s.categoryIds)) return s.categoryIds.includes(item.id);
                if (s.categoryId) return s.categoryId === item.id;
                return false;
              }).length} subcategories
            </Paragraph>
          </View>
          <View style={styles.actionCol}>
            <IconButton 
              icon="pencil" 
              iconColor="blue"
              onPress={() => handleCategoryEdit(item)} 
            />
            <IconButton 
              icon="delete" 
              iconColor="red"
              onPress={() => deleteCategory(item.id)} 
            />
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderSubcategoryItem = ({ item }) => {
    const parentNames = (item.categoryIds && item.categoryIds.length)
      ? item.categoryIds.map(id => categories.find(c => c.id === id)?.category).filter(Boolean).join(', ')
      : (categories.find(c => c.id === item.categoryId)?.category || 'Unknown Category');

    return (
      <Card style={styles.subCard}>
        <Card.Content>
          <View style={styles.catRow}>
            <View style={{ flex: 1 }}>
              <Title style={styles.subName}>{item.subcategory || item.subcategoryName}</Title>
              <Paragraph style={styles.parentCategory}>
                📂 {parentNames}
              </Paragraph>
            </View>
            <View style={styles.actionCol}>
              <IconButton 
                icon="pencil" 
                iconColor="blue"
                onPress={() => handleSubcategoryEdit(item)} 
              />
              <IconButton 
                icon="delete" 
                iconColor="red"
                onPress={() => deleteSubcategory(item.id)} 
              />
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-left" size={28} onPress={goBack} />
        <Title style={styles.title}>Category Master</Title>
        <View style={{ width: 40 }} />
      </View>
      
      <View style={styles.buttonRow}>
        <Button 
          mode="contained" 
          style={[styles.addBtn, { flex: 1, marginRight: 8 }]} 
          onPress={() => setModalVisible(true)}
          icon="plus"
        >
          Add Category
        </Button>
        <Button 
          mode="outlined" 
          style={[styles.addBtn, { flex: 1, marginLeft: 8 }]} 
          onPress={() => setSubModalVisible(true)}
          icon="plus"
        >
          Add Subcategory
        </Button>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 32 }} />
      ) : (
        <View style={styles.listContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories ({categories.length})</Text>
            {categories.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No categories found</Text>
                <Text style={styles.emptySubtext}>Add a category to get started</Text>
              </View>
            ) : (
              <FlatList
                data={categories}
                keyExtractor={(item) => item.id}
                renderItem={renderCategoryItem}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subcategories ({subcategories.length})</Text>
            {subcategories.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No subcategories found</Text>
                <Text style={styles.emptySubtext}>Add a subcategory to get started</Text>
              </View>
            ) : (
              <FlatList
                data={subcategories}
                keyExtractor={(item) => item.id}
                renderItem={renderSubcategoryItem}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      )}
      
      {/* Category Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Title style={{ marginBottom: 12 }}>
              {editingCategory ? "Edit Category" : "Add Category"}
            </Title>
            <TextInput 
              label="Category Name" 
              value={form.category} 
              onChangeText={v => setForm(f => ({ ...f, category: v }))} 
              style={styles.input} 
            />
            <Button 
              mode="contained" 
              style={{ marginTop: 16 }} 
              onPress={editingCategory ? updateCategory : addCategory}
              loading={loading}
              disabled={loading}
            >
              {editingCategory ? "Update" : "Save"}
            </Button>
            <Button 
              style={{ marginTop: 8 }} 
              onPress={resetCategoryForm}
              disabled={loading}
            >
              Cancel
            </Button>
          </View>
        </View>
      </Modal>
      
      {/* Subcategory Modal */}
      <Modal visible={subModalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Title style={{ marginBottom: 12 }}>
              {editingSubcategory ? "Edit Subcategory" : "Add Subcategory"}
            </Title>
            
            {categories.length === 0 ? (
              <View style={styles.noCategoriesWarning}>
                <Text style={styles.warningText}>
                  Please add a category first before creating subcategories.
                </Text>
                <Button 
                  mode="outlined" 
                  style={{ marginTop: 12 }} 
                  onPress={() => {
                    setSubModalVisible(false);
                    setModalVisible(true);
                  }}
                >
                  Add Category First
                </Button>
              </View>
            ) : (
              <>
                            <View style={styles.pickerContainer}>
                              <Text style={styles.pickerLabel}>Select Category(s):</Text>
                              <View style={styles.categoryPicker}>
                                {categories.map(cat => {
                                  const selected = subForm.categoryIds && subForm.categoryIds.includes(cat.id);
                                  return (
                                    <Button
                                      key={cat.id}
                                      mode={selected ? "contained" : "outlined"}
                                      style={styles.categoryOption}
                                      onPress={() => {
                                        setSubForm(f => {
                                          const ids = new Set(f.categoryIds || []);
                                          if (ids.has(cat.id)) ids.delete(cat.id);
                                          else ids.add(cat.id);
                                          return { ...f, categoryIds: Array.from(ids) };
                                        });
                                      }}
                                      compact
                                    >
                                      {cat.category}
                                    </Button>
                                  );
                                })}
                              </View>
                            </View>
                
                <TextInput 
                  label="Subcategory Name" 
                  value={subForm.subcategory} 
                  onChangeText={v => setSubForm(f => ({ ...f, subcategory: v }))} 
                  style={styles.input} 
                />
                
                <Button 
                  mode="contained" 
                  style={{ marginTop: 16 }} 
                  onPress={editingSubcategory ? updateSubcategory : addSubcategory}
                  loading={loading}
                  disabled={loading}
                >
                  {editingSubcategory ? "Update" : "Save"}
                </Button>
              </>
            )}
            
            <Button 
              style={{ marginTop: 8 }} 
              onPress={resetSubcategoryForm}
              disabled={loading}
            >
              Cancel
            </Button>
          </View>
        </View>
      </Modal>
      
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
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  addBtn: {
    borderRadius: 8,
    elevation: 2,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    flex: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 12,
  },
  catCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    backgroundColor: '#fff',
  },
  subCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    backgroundColor: '#f8f9fa',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionCol: {
    flexDirection: 'row',
  },
  catName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
  },
  subName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#34495e',
  },
  subcategoryCount: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  parentCategory: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
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
  noCategoriesWarning: {
    backgroundColor: '#fff3cd',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
    marginBottom: 16,
  },
  warningText: {
    color: '#856404',
    textAlign: 'center',
    fontWeight: '500',
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    marginBottom: 8,
    marginRight: 8,
  },
});

export default CategoryMasterScreen;
