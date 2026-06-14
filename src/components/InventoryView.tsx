import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, Scan, Filter, Trash2, Edit2, AlertCircle, X, Upload, CheckCircle2, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Product, Category, Subcategory } from '../types';
import { Scanner } from './Scanner';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import React from 'react';
import * as XLSX from 'xlsx';

export function InventoryView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [suggestedSku, setSuggestedSku] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // New States for pagination, counts and sorting
  const [limit, setLimit] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [sortField, setSortField] = useState<'name' | 'sku' | 'category' | 'subcategory' | 'stock' | 'cost_price' | 'price'>('name');
  const [sortAscending, setSortAscending] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const txtInputRef = useRef<HTMLInputElement>(null);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'error') => {
    setAlertConfig({ title, message, type });
  };

  const limitRef = useRef(limit);
  const sortFieldRef = useRef(sortField);
  const sortAscendingRef = useRef(sortAscending);
  const selectedCategoryRef = useRef(selectedCategory);
  const selectedSubcategoryRef = useRef(selectedSubcategory);
  const searchTermRef = useRef(searchTerm);

  useEffect(() => { limitRef.current = limit; }, [limit]);
  useEffect(() => { sortFieldRef.current = sortField; }, [sortField]);
  useEffect(() => { sortAscendingRef.current = sortAscending; }, [sortAscending]);
  useEffect(() => { selectedCategoryRef.current = selectedCategory; }, [selectedCategory]);
  useEffect(() => { selectedSubcategoryRef.current = selectedSubcategory; }, [selectedSubcategory]);
  useEffect(() => { searchTermRef.current = searchTerm; }, [searchTerm]);

  const fetchCategoriesAndSubcategories = async () => {
    try {
      const [categoriesRes, subcategoriesRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('subcategories').select('*').order('name')
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (subcategoriesRes.error) throw subcategoriesRes.error;

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (subcategoriesRes.data) setSubcategories(subcategoriesRes.data);
    } catch (err) {
      console.error('Error fetching categories/subcategories:', err);
    }
  };

  const fetchProducts = async (
    search: string = '',
    currentLimit: number = 100,
    sortBy: string = 'name',
    isAsc: boolean = true,
    cat: string = 'all',
    sub: string = 'all'
  ) => {
    try {
      let query = supabase.from('products').select('*', { count: 'exact' });

      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        const term = `%${trimmedSearch}%`;
        query = query.or(`name.ilike.${term},sku.ilike.${term}`);
      }

      if (cat !== 'all') {
        query = query.eq('category', cat);
      }

      if (sub !== 'all') {
        query = query.eq('subcategory', sub);
      }

      query = query.order(sortBy, { ascending: isAsc });

      const { data, error, count } = await query.range(0, currentLimit - 1);

      if (error) throw error;
      if (data) {
        setProducts(data);
        if (count !== null) setTotalCount(count);
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchData = async () => {
    await fetchCategoriesAndSubcategories();
    await fetchProducts(
      searchTermRef.current,
      limitRef.current,
      sortFieldRef.current,
      sortAscendingRef.current,
      selectedCategoryRef.current,
      selectedSubcategoryRef.current
    );
  };

  const handleSort = (field: 'name' | 'sku' | 'category' | 'subcategory' | 'stock' | 'cost_price' | 'price') => {
    if (sortField === field) {
      setSortAscending(!sortAscending);
    } else {
      setSortField(field);
      setSortAscending(true);
    }
  };

  useEffect(() => {
    fetchCategoriesAndSubcategories();

    // Subscribe to changes
    const productChannel = supabase.channel('products_all').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
      fetchProducts(
        searchTermRef.current,
        limitRef.current,
        sortFieldRef.current,
        sortAscendingRef.current,
        selectedCategoryRef.current,
        selectedSubcategoryRef.current
      );
    }).subscribe();

    const categoryChannel = supabase.channel('categories_all').on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
      fetchCategoriesAndSubcategories();
    }).subscribe();

    const subcategoryChannel = supabase.channel('subcategories_all').on('postgres_changes', { event: '*', schema: 'public', table: 'subcategories' }, () => {
      fetchCategoriesAndSubcategories();
    }).subscribe();

    return () => {
      supabase.removeChannel(productChannel);
      supabase.removeChannel(categoryChannel);
      supabase.removeChannel(subcategoryChannel);
    };
  }, []);

  // Handle debounced search term
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setLimit(100);
      fetchProducts(searchTerm, 100, sortField, sortAscending, selectedCategory, selectedSubcategory);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Handle category/subcategory/sorting changes
  useEffect(() => {
    fetchProducts(searchTerm, limit, sortField, sortAscending, selectedCategory, selectedSubcategory);
  }, [sortField, sortAscending, selectedCategory, selectedSubcategory]);

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      category: formData.get('category') as string,
      subcategory: formData.get('subcategory') as string,
      price: Number(formData.get('price')),
      cost_price: Number(formData.get('costPrice')),
      stock: Number(formData.get('stock')),
      wholesale_price: Number(formData.get('wholesalePrice') || 0),
      wholesale_min_qty: Number(formData.get('wholesaleMinQty') || 0)
    };

    try {
      if (editingProduct) {
        let { error } = await supabase.from('products').update(data).eq('id', editingProduct.id);
        if (error && (error.message.includes('cost_price') || error.message.includes('wholesale') || error.message.includes('column'))) {
          const fallbackData = { ...data };
          if (error.message.includes('wholesale')) {
            delete (fallbackData as any).wholesale_price;
            delete (fallbackData as any).wholesale_min_qty;
          }
          if (error.message.includes('cost_price')) {
            delete (fallbackData as any).cost_price;
          }
          const retry = await supabase.from('products').update(fallbackData).eq('id', editingProduct.id);
          error = retry.error;
        }
        if (error) throw error;
      } else {
        let { error } = await supabase.from('products').insert([data]);
        if (error && (error.message.includes('cost_price') || error.message.includes('wholesale') || error.message.includes('column'))) {
          const fallbackData = { ...data };
          if (error.message.includes('wholesale')) {
            delete (fallbackData as any).wholesale_price;
            delete (fallbackData as any).wholesale_min_qty;
          }
          if (error.message.includes('cost_price')) {
            delete (fallbackData as any).cost_price;
          }
          const retry = await supabase.from('products').insert([fallbackData]);
          error = retry.error;
        }
        if (error) throw error;
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      showAlert("Éxito", editingProduct ? 'Producto actualizado con éxito' : 'Producto creado con éxito', "success");
      fetchData();
    } catch (err: any) {
      console.error('Save Product Error:', err);
      showAlert("Error", 'No se pudo guardar el producto: ' + (err.message || 'Error desconocido'));
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      showAlert("Éxito", 'Producto eliminado con éxito', "success");
      fetchData();
    } catch (err: any) {
      console.error('Error deleting product:', err);
      showAlert("Error", 'Error al eliminar producto: ' + (err.message || 'Error desconocido'), "error");
    }
  };

  const handleClearInventory = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar TODO el inventario? Esta acción no se puede deshacer.')) return;
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); 
      
      if (error) throw error;
      alert('Inventario vaciado con éxito.');
      fetchData();
    } catch (err: any) {
      alert('Error clearing inventory: ' + err.message);
    }
  };

  const handleImportTXT = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        if (lines.length === 0) {
          alert('El archivo está vacío.');
          setIsImporting(false);
          return;
        }

        const CHUNK_SIZE = 100;
        let importedCount = 0;

        // Deduplicate locally to avoid "ON CONFLICT" batch errors
        const uniqueProducts = new Map();
        lines.forEach(line => {
          const separator = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
          const parts = line.split(separator).map(p => p.trim());
          const sku = parts[1] || `TEMP-${Math.random().toString(36).substr(2, 9)}`;
          
          uniqueProducts.set(sku.toLowerCase(), {
            name: parts[0] || 'Sin Nombre',
            sku: sku,
            category: parts[2] || 'General',
            subcategory: parts[3] || '',
            price: Number(parts[4] || 0),
            cost_price: Number(parts[5] || 0),
            stock: Number(parts[6] || 0),
            unit: parts[8] || 'Unidad'
          });
        });

        const productList = Array.from(uniqueProducts.values());
        let costPriceErrorDetected = false;

        for (let i = 0; i < productList.length; i += CHUNK_SIZE) {
          const chunk = productList.slice(i, i + CHUNK_SIZE);
          let { error } = await supabase.from('products').upsert(chunk, { onConflict: 'sku' });
          
          if (error && (error.message.includes('cost_price') || error.message.includes('column'))) {
            const fallbackChunk = chunk.map(({ cost_price, ...rest }) => rest);
            const retry = await supabase.from('products').upsert(fallbackChunk, { onConflict: 'sku' });
            error = retry.error;
          }

          if (error) throw error;

          importedCount += chunk.length;
          setImportProgress(Math.round((importedCount / productList.length) * 100));
        }

        alert(`${importedCount} productos únicos importados/actualizados con éxito.`);
        if (txtInputRef.current) txtInputRef.current.value = '';
        fetchData();
      } catch (err: any) {
        alert('Error al importar TXT: ' + err.message);
      } finally {
        setIsImporting(false);
        setImportProgress(0);
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo es demasiado grande (máx 10MB).');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result;
        if (!arrayBuffer) throw new Error("No se pudo leer el archivo");
        
        const data = new Uint8Array(arrayBuffer as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

        if (jsonData.length === 0) {
          alert('El archivo está vacío o no tiene el formato correcto.');
          setIsImporting(false);
          return;
        }

        setImportProgress(10);

        const CHUNK_SIZE = 50; 
        let importedCount = 0;

        // Deduplicate globally to avoid "ON CONFLICT" errors in same batch
        const uniqueProducts = new Map();
        jsonData.forEach((row) => {
          const getValue = (keys: string[], fallback: any = '') => {
            const key = keys.find(k => row[k] !== undefined && row[k] !== null);
            return key !== undefined ? row[key] : fallback;
          };

          const sku = String(getValue(['SKU', 'sku', 'Codigo', 'codigo', 'Code', 'code', 'CÓDIGO', 'ITEM CODE', 'Item Code', 'ID'], `TEMP-${Math.random().toString(36).substr(2, 9)}`));
          
          uniqueProducts.set(sku.toLowerCase().trim(), {
            name: String(getValue(['Nombre', 'nombre', 'Name', 'name', 'Producto', 'producto', 'Product', 'product', 'ITEM', 'item', 'DESCRIPCION'], 'Sin Nombre')),
            sku: sku,
            category: String(getValue(['Categoria', 'categoria', 'Category', 'category', 'FAMILIA', 'familia', 'DEPARTAMENTO', 'DEPARTAMIENTO', 'DPTO'], 'General')),
            subcategory: String(getValue(['Subcategoria', 'subcategoria', 'Subcategory', 'subcategory', 'SUBFAMILIA', 'subfamilia'], '')),
            price: Number(getValue(['Precio', 'precio', 'Price', 'price', 'VALOR', 'valor', 'COSTO', 'costo', 'VENTA', 'P. VENTA', 'PRECIO VENTA'], 0)),
            cost_price: Number(getValue(['Costo', 'costo', 'Cost', 'CostPrice', 'CostPrice', 'PRECIO COSTO', 'P. COSTO', 'VALOR COSTO'], 0)),
            stock: Number(getValue(['Stock', 'stock', 'Existencia', 'existencia', 'CANTIDAD', 'cantidad', 'QUANTITY', 'qty', 'STOCK ACTUAL'], 0)),
            unit: String(getValue(['Unidad', 'unidad', 'Unit', 'unit', 'UM', 'U.M.', 'FORMATO'], 'Unidad')),
          });
        });

        const productList = Array.from(uniqueProducts.values());
        for (let i = 0; i < productList.length; i += CHUNK_SIZE) {
          const chunk = productList.slice(i, i + CHUNK_SIZE);
          let { error } = await supabase.from('products').upsert(chunk, { onConflict: 'sku' });
          
          if (error && (error.message.includes('cost_price') || error.message.includes('column'))) {
            const fallbackChunk = chunk.map(({ cost_price, ...rest }) => rest);
            const retry = await supabase.from('products').upsert(fallbackChunk, { onConflict: 'sku' });
            error = retry.error;
          }

          if (error) throw error;

          importedCount += chunk.length;
          setImportProgress(Math.round((importedCount / productList.length) * 100));
        }

        alert(`${importedCount} productos únicos importados/actualizados con éxito.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchData();
      } catch (err: any) {
        console.error('Import error:', err);
        alert('Error al importar productos: ' + (err.message || 'Error desconocido'));
      } finally {
        setIsImporting(false);
        setImportProgress(0);
      }
    };
    reader.onerror = (err) => {
      alert('Error al leer el archivo');
    };
    reader.readAsArrayBuffer(file);
  };

  const uniqueCategories = categories.map(c => c.name);
  const uniqueSubcategories = (() => {
    if (selectedCategory === 'all') {
      return subcategories.map(s => s.name);
    }
    const catObj = categories.find(c => c.name === selectedCategory);
    if (!catObj) return [];
    return subcategories.filter(s => s.category_id === catObj.id).map(s => s.name);
  })();

  useEffect(() => {
    if (isModalOpen && !editingProduct) {
      const accProducts = products.filter(p => p.sku && p.sku.startsWith('ACC-'));
      if (accProducts.length > 0) {
        const numbers = accProducts.map(p => {
          const match = p.sku.match(/ACC-(\d+)/);
          return match ? parseInt(match[1]) : 0;
        }).filter(n => !isNaN(n));
        
        const maxNum = numbers.length > 0 ? Math.max(...numbers) : 100;
        const nextNum = Math.max(maxNum, 100) + 1;
        setSuggestedSku(`ACC-${nextNum}`);
      } else {
        setSuggestedSku('ACC-101');
      }
    }
  }, [isModalOpen, editingProduct, products]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight uppercase">Maestro de Productos</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 px-1">Gestión centralizada de catálogo y existencias</p>
        </div>
        <div className="flex flex-wrap justify-center sm:justify-end gap-2">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-sky-600 text-white px-4 py-2.5 rounded-xl sm:rounded-lg text-xs font-bold shadow-lg shadow-sky-900/10 hover:bg-sky-700 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
          
          <button 
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center justify-center gap-2 bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl sm:rounded-lg text-xs font-bold shadow-sm hover:bg-slate-200 transition-all active:scale-95"
          >
            <Scan className="w-4 h-4 text-slate-500" />
            <span>Escanear Código</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Section Removed */}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-3 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Buscar SKU o nombre..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 sm:py-2 bg-white border border-slate-200 rounded-lg sm:rounded-md text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            
            <select 
              value={selectedCategory}
              onChange={(e) => { 
                setSelectedCategory(e.target.value); 
                setSelectedSubcategory('all');
                setLimit(100);
              }}
              className="px-3 py-2.5 sm:py-2 bg-white border border-slate-200 rounded-lg sm:rounded-md text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="all">Todas las Categorías</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select 
              value={selectedSubcategory}
              onChange={(e) => {
                setSelectedSubcategory(e.target.value);
                setLimit(100);
              }}
              className="px-3 py-2.5 sm:py-2 bg-white border border-slate-200 rounded-lg sm:rounded-md text-xs focus:ring-1 focus:ring-sky-500 outline-none"
            >
              <option value="all">Todas las Subcategorías</option>
              {uniqueSubcategories.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th 
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 text-[10px] uppercase font-black tracking-widest text-slate-400 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group"
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>SKU / Producto</span>
                    <span className="inline-flex">
                      {sortField === 'name' ? (
                        sortAscending ? <ChevronUp className="w-3.5 h-3.5 text-sky-600" /> : <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('category')}
                  className="px-4 py-3 text-[10px] uppercase font-black tracking-widest text-slate-400 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group"
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Categoría / Sub</span>
                    <span className="inline-flex">
                      {sortField === 'category' ? (
                        sortAscending ? <ChevronUp className="w-3.5 h-3.5 text-sky-600" /> : <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('stock')}
                  className="px-4 py-3 text-[10px] uppercase font-black tracking-widest text-slate-400 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group text-center"
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    <span>Existencias</span>
                    <span className="inline-flex">
                      {sortField === 'stock' ? (
                        sortAscending ? <ChevronUp className="w-3.5 h-3.5 text-sky-600" /> : <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('cost_price')}
                  className="px-4 py-3 text-[10px] uppercase font-black tracking-widest text-slate-400 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group text-right"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>P. Costo</span>
                    <span className="inline-flex">
                      {sortField === 'cost_price' ? (
                        sortAscending ? <ChevronUp className="w-3.5 h-3.5 text-sky-600" /> : <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('price')}
                  className="px-4 py-3 text-[10px] uppercase font-black tracking-widest text-slate-400 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group text-right"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>P. Venta</span>
                    <span className="inline-flex">
                      {sortField === 'price' ? (
                        sortAscending ? <ChevronUp className="w-3.5 h-3.5 text-sky-600" /> : <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 text-[10px] uppercase font-black tracking-widest text-slate-400 text-right">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="text-xs md:text-sm font-bold text-slate-700 leading-tight">{p.name}</div>
                      <div className="text-[9px] md:text-[10px] font-mono text-slate-400 mt-0.5 uppercase tracking-tighter">SKU: {p.sku}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">{p.category}</div>
                      <div className="text-[9px] text-slate-400 uppercase">{p.subcategory || 'Sin Subcategoría'}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-block px-2 py-1 rounded text-xs font-black bg-slate-100 text-slate-700">
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-[11px] md:text-xs font-medium text-slate-500 italic whitespace-nowrap">
                      {formatCurrency(p.cost_price || 0)}
                    </td>
                    <td className="px-4 py-4 text-right text-xs md:text-sm font-black text-slate-700 whitespace-nowrap">
                      <div>{formatCurrency(p.price)}</div>
                      {p.wholesale_price && p.wholesale_price > 0 ? (
                        <div className="text-[9px] md:text-[10px] text-emerald-600 font-bold whitespace-nowrap mt-0.5 uppercase tracking-tighter">
                          Mayorista: {formatCurrency(p.wholesale_price || 0)} (desde {p.wholesale_min_qty || 3} uds)
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => { setEditingProduct(p); setIsModalOpen(true); }}
                          className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg border border-slate-100 md:border-transparent"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setProductToDelete(p)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-100 md:border-transparent"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {products.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xs italic">
              No se encontraron resultados para la búsqueda.
            </div>
          )}
        </div>
      </div>

      {totalCount > limit && (
        <div className="flex justify-center items-center gap-3 pt-6 flex-wrap">
          <button 
            type="button"
            onClick={() => {
              const newLimit = limit + 100;
              setLimit(newLimit);
              fetchProducts(searchTerm, newLimit, sortField, sortAscending, selectedCategory, selectedSubcategory);
            }}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-755 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            Cargar más productos ({totalCount - limit} restantes)
          </button>
          
          <button 
            type="button"
            onClick={() => {
              setLimit(totalCount);
              fetchProducts(searchTerm, totalCount, sortField, sortAscending, selectedCategory, selectedSubcategory);
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer border border-transparent"
          >
            Mostrar todos
          </button>
        </div>
      )}

      <AnimatePresence>
        {isImporting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-xs rounded-2xl p-8 text-center shadow-2xl border border-slate-200"
            >
              <div className="w-16 h-16 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-sky-600 animate-bounce" />
              </div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1">Importando</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-4">Por favor espere...</p>
              
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                <motion.div 
                  className="bg-sky-600 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${importProgress}%` }}
                />
              </div>
              <div className="text-[10px] font-black text-sky-600">{importProgress}%</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isScannerOpen && (
          <Scanner 
            onScan={(sku) => {
              setSearchTerm(sku);
              setIsScannerOpen(false);
            }} 
            onClose={() => setIsScannerOpen(false)} 
          />
        )}
      </AnimatePresence>

      {/* Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6 px-1">
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">
                    {editingProduct ? 'Editar' : 'Nuevo'} Producto
                  </h2>
                  <button onClick={() => { setIsModalOpen(false); setEditingProduct(null); }} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleSaveProduct} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Nombre del Producto</label>
                      <input name="name" defaultValue={editingProduct?.name} required className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">SKU / Cód. Barras</label>
                      <div className="relative">
                        <input 
                          name="sku" 
                          defaultValue={editingProduct?.sku || suggestedSku} 
                          key={editingProduct?.id || suggestedSku}
                          required 
                          className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" 
                        />
                        <button type="button" onClick={() => setIsScannerOpen(true)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-sky-600">
                          <Scan className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Categoría</label>
                      <select 
                        name="category" 
                        defaultValue={editingProduct?.category} 
                        required 
                        className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none"
                      >
                        <option value="">Seleccionar</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Subcategoría</label>
                      <select 
                        name="subcategory" 
                        defaultValue={editingProduct?.subcategory} 
                        className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none"
                      >
                        <option value="">Otras</option>
                        {subcategories
                          .filter(sub => {
                            const cat = (editingProduct?.category || '');
                            const parent = categories.find(c => c.name === cat);
                            return parent ? sub.category_id === parent.id : true;
                          })
                          .map(sub => (
                            <option key={sub.id} value={sub.name}>{sub.name}</option>
                          ))
                        }
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Stock Actual</label>
                      <input name="stock" type="number" defaultValue={editingProduct?.stock ?? 0} className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">P. Costo</label>
                      <input name="costPrice" type="number" defaultValue={editingProduct?.cost_price ?? 0} className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">P. Venta</label>
                      <input name="price" type="number" defaultValue={editingProduct?.price ?? 0} className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">P. Venta Mayorista</label>
                      <input name="wholesalePrice" type="number" defaultValue={editingProduct?.wholesale_price ?? 0} className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Cant. Mínima Mayorista</label>
                      <input name="wholesaleMinQty" type="number" defaultValue={editingProduct?.wholesale_min_qty ?? 0} className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-slate-900 text-white py-3.5 md:py-2.5 rounded-xl md:rounded-lg text-xs font-bold shadow-lg shadow-slate-900/10 mt-2 active:scale-95 transition-all uppercase">
                    {editingProduct ? 'Actualizar Producto' : 'Guardar Producto'}
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {alertConfig && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 text-center p-8"
            >
              <div className={cn(
                "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center",
                alertConfig.type === 'success' ? "bg-emerald-100 text-emerald-600" : 
                alertConfig.type === 'warning' ? "bg-amber-100 text-amber-600" :
                "bg-red-100 text-red-600"
              )}>
                {alertConfig.type === 'success' ? <CheckCircle2 className="w-8 h-8" /> : 
                 alertConfig.type === 'warning' ? <AlertCircle className="w-8 h-8" /> :
                 <X className="w-8 h-8" />}
              </div>
              
              <h3 className="text-lg font-black text-slate-800 mb-2">{alertConfig.title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
                {alertConfig.message}
              </p>
              
              <button 
                onClick={() => setAlertConfig(null)}
                className={cn(
                  "w-full py-3 rounded-xl font-bold transition-all active:scale-95 text-white shadow-lg",
                  alertConfig.type === 'success' ? "bg-emerald-600 shadow-emerald-200" : 
                  alertConfig.type === 'warning' ? "bg-amber-600 shadow-amber-200" :
                  "bg-slate-900 shadow-slate-200"
                )}
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {productToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden border border-slate-100 p-6 text-center"
            >
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600 animate-pulse" />
              </div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-wide mb-2">¿Eliminar Producto?</h3>
              <p className="text-xs text-slate-500 font-bold mb-6">
                ¿Está seguro de que desea eliminar el producto <span className="text-slate-800 font-extrabold">{productToDelete.name}</span>? esta acción no se puede deshacer.
              </p>
              
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 py-2.5 text-slate-500 hover:text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    const id = productToDelete.id;
                    setProductToDelete(null);
                    await handleDeleteProduct(id);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase shadow-lg shadow-red-650/10 active:scale-95 transition-all cursor-pointer"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
