import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Category, Subcategory } from '../types';
import { Plus, Trash2, Edit2, Layers, Tag, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export function ParametersView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [cats, subcats] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('subcategories').select('*').order('name')
    ]);
    if (cats.data) setCategories(cats.data);
    if (subcats.data) setSubcategories(subcats.data);
    setLoading(false);
  };

  const handleSaveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;

    try {
      if (editingCategory) {
        const { error } = await supabase.from('categories').update({ name }).eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert([{ name }]);
        if (error) throw error;
      }
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      fetchData();
    } catch (err: any) {
      alert('Error al guardar categoría: ' + err.message);
    }
  };

  const handleSaveSubcategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const category_id = formData.get('category_id') as string;

    try {
      if (editingSubcategory) {
        const { error } = await supabase.from('subcategories').update({ name, category_id }).eq('id', editingSubcategory.id);
        if (error) {
          if (error.message.includes('schema cache')) {
            throw new Error('Supabase no reconoce la columna "category_id". Ejecute en SQL Editor: NOTIFY pgrst, \'reload schema\';');
          }
          throw error;
        }
      } else {
        const { error } = await supabase.from('subcategories').insert([{ name, category_id }]);
        if (error) {
          if (error.message.includes('schema cache')) {
            throw new Error('Supabase no reconoce la columna "category_id". Ejecute en SQL Editor: NOTIFY pgrst, \'reload schema\';');
          }
          throw error;
        }
      }
      setIsSubcategoryModalOpen(false);
      setEditingSubcategory(null);
      fetchData();
    } catch (err: any) {
      alert('Error al guardar subcategoría: ' + err.message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar esta categoría? Se eliminarán todas sus subcategorías.')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Error al eliminar categoría: ' + err.message);
    }
  };

  const handleDeleteSubcategory = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar esta subcategoría?')) return;
    try {
      const { error } = await supabase.from('subcategories').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Error al eliminar subcategoría: ' + err.message);
    }
  };

  const handleImportSubcategories = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        const toInsertMap = new Map<string, { category_id: string; name: string }>();
        const missingCategories = new Set<string>();

        for (const line of lines) {
          // Detect separator: Try tab first, then semicolon, then comma
          const separator = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
          const parts = line.split(separator).map(p => p.trim());
          
          if (parts.length < 2) continue;
          const [catName, subName] = parts;
          
          const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
          if (!cat) {
            missingCategories.add(catName);
            continue;
          }
          
          // Use a Map to keep only unique category_id + name pairs
          const key = `${cat.id}-${subName.toLowerCase()}`;
          toInsertMap.set(key, { category_id: cat.id, name: subName });
        }

        const toInsert = Array.from(toInsertMap.values());

        if (missingCategories.size > 0) {
          alert(`Las siguientes categorías no existen y fueron omitidas: ${Array.from(missingCategories).join(', ')}. Por favor créelas primero.`);
        }

        if (toInsert.length > 0) {
          const { error } = await supabase.from('subcategories').upsert(toInsert, { onConflict: 'category_id,name' });
          if (error) {
            if (error.message.includes('schema cache')) {
              throw new Error('Supabase no reconoce la nueva columna "category_id". Por favor, en el Editor SQL de Supabase ejecute: NOTIFY pgrst, \'reload schema\';');
            }
            throw error;
          }
          alert(`Se importaron/actualizaron ${toInsert.length} subcategorías con éxito.`);
          fetchData();
        } else if (missingCategories.size === 0) {
          alert('No se encontraron datos válidos en el archivo. Use el formato: Categoría;Subcategoría o Categoría[TAB]Subcategoría');
        }
      } catch (err: any) {
        alert('Error al importar: ' + err.message);
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Parámetros del Sistema</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Configuración de Categorías y Subcategorías</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Categories Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Categorías</h3>
            </div>
            <button 
              onClick={() => {
                setEditingCategory(null);
                setIsCategoryModalOpen(true);
              }}
              className="p-1 px-3 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Agregar
            </button>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-white transition-all shadow-sm">
                  <span className="text-sm font-black text-slate-700 uppercase tracking-tight">{cat.name}</span>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => {
                        setEditingCategory(cat);
                        setIsCategoryModalOpen(true);
                      }}
                      className="p-2 bg-white text-sky-600 border border-slate-100 rounded-lg shadow-sm hover:bg-sky-600 hover:text-white transition-all"
                      title="Editar Categoría"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-2 bg-white text-red-600 border border-slate-100 rounded-lg shadow-sm hover:bg-red-600 hover:text-white transition-all"
                      title="Eliminar Categoría"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-widest">No hay categorías</p>
              )}
            </div>
          </div>
        </div>

        {/* Subcategories Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden text-center">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Subcategorías</h3>
            </div>
            <div className="flex gap-2">
              <label className="p-1 px-3 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-1 cursor-pointer">
                <Plus className="w-3 h-3" /> Importar TXT
                <input type="file" accept=".txt" onChange={handleImportSubcategories} className="hidden" />
              </label>
              <button 
                onClick={() => {
                  setEditingSubcategory(null);
                  setIsSubcategoryModalOpen(true);
                }}
                disabled={categories.length === 0}
                className="p-1 px-3 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> Agregar
              </button>
            </div>
          </div>
          <div className="p-4 text-left">
            <div className="space-y-4">
              {categories.map((cat) => {
                const subCats = subcategories.filter(s => s.category_id === cat.id);
                if (subCats.length === 0) return null;
                return (
                  <div key={cat.id} className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 border-b border-slate-100 pb-1">{cat.name}</div>
                    <div className="space-y-1">
                      {subCats.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-100 group">
                          <span className="text-xs font-bold text-slate-600">{sub.name}</span>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setEditingSubcategory(sub);
                                setIsSubcategoryModalOpen(true);
                              }}
                              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition-all"
                              title="Editar Subcategoría"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteSubcategory(sub.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-all"
                              title="Eliminar Subcategoría"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {subcategories.length === 0 && (
                <p className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-widest">No hay subcategorías</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                    {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                  </h3>
                  <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleSaveCategory}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Nombre</label>
                      <input 
                        name="name" 
                        defaultValue={editingCategory?.name}
                        required 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-1 focus:ring-blue-500 outline-none" 
                        placeholder="Ej: Abarrotes"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-bold shadow-lg shadow-slate-900/10 mt-6 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Guardar Categoría
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Subcategory Modal */}
      <AnimatePresence>
        {isSubcategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSubcategoryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                    {editingSubcategory ? 'Editar Subcategoría' : 'Nueva Subcategoría'}
                  </h3>
                  <button onClick={() => setIsSubcategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleSaveSubcategory}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Categoría Padre</label>
                      <select 
                        name="category_id" 
                        defaultValue={editingSubcategory?.category_id}
                        required 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Nombre</label>
                      <input 
                        name="name" 
                        defaultValue={editingSubcategory?.name}
                        required 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-1 focus:ring-blue-500 outline-none" 
                        placeholder="Ej: Arroz"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-bold shadow-lg shadow-slate-900/10 mt-6 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Guardar Subcategoría
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
