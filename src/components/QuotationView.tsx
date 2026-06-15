import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, FileText, Send, ShoppingCart, Trash2, X, ChevronRight, UserPlus, Edit2, Minus, AlertCircle, CheckCircle2, Printer, Truck } from 'lucide-react';
import { Quotation, Customer, Product, QuotationItem, Category, Subcategory } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import React from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';


const normText = (str: string | undefined | null) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n');
};

export function QuotationView({ globalSearch }: { globalSearch?: string }) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New/Edit Quote State
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [quoteItems, setQuoteItems] = useState<QuotationItem[]>([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  
  // Customer Modal State (within Quotation)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [suggestedSku, setSuggestedSku] = useState('');
  const [selectedProductCategory, setSelectedProductCategory] = useState('');
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Mobile actions state
  const [mobileActionQuotation, setMobileActionQuotation] = useState<{ q: Quotation; correlative: number } | null>(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Custom Alert & Delete State
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [quotationToDelete, setQuotationToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Transport State
  const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);
  const [transportValue, setTransportValue] = useState<string>('');

  // Customer Correlative State (replicated from CustomerView)
  const [nextCorrelativeCode, setNextCorrelativeCode] = useState('2368');

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'error') => {
    setAlertConfig({ title, message, type });
  };

  const openTransportModal = () => {
    const existing = quoteItems.find(i => i.sku?.toUpperCase() === 'TRANSPORTE' || i.productId === 'TRANSPORTE_ITEM');
    if (existing) {
      setTransportValue(existing.price.toString());
    } else {
      setTransportValue('');
    }
    setIsTransportModalOpen(true);
  };

  const handleAddTransportItem = (value: number) => {
    const transportProduct = products.find(p => p.sku?.toUpperCase() === 'TRANSPORTE' || p.name?.toLowerCase().includes('transporte'));
    
    const productId = transportProduct ? transportProduct.id : 'TRANSPORTE_ITEM';
    const name = transportProduct ? transportProduct.name : 'TRANSPORTE';
    const sku = transportProduct ? transportProduct.sku : 'TRANSPORTE';
    
    const existing = quoteItems.find(i => i.productId === productId || i.sku?.toUpperCase() === 'TRANSPORTE');
    if (existing) {
      setQuoteItems(quoteItems.map(i => 
        (i.productId === productId || i.sku?.toUpperCase() === 'TRANSPORTE') 
          ? { ...i, price: value, subtotal: value * i.qty } 
          : i
      ));
    } else {
      setQuoteItems([...quoteItems, {
        productId,
        name,
        sku,
        qty: 1,
        price: value,
        subtotal: value
      }]);
    }
  };

  const handleSaveTransport = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const val = Number(transportValue);
    if (isNaN(val) || val < 0) {
      showAlert("Error", "Por favor ingrese un valor de transporte válido.");
      return;
    }
    handleAddTransportItem(val);
    setIsTransportModalOpen(false);
  };

  const loadNextCorrelative = async () => {
    try {
      const rutsSet = new Set<string>();

      // 1. Get exact total count of customers in the database
      const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      const totalRows = count || 2500; // Fallback to 2500 if count query fails
      const chunkSize = 1000;
      const numPages = Math.ceil(totalRows / chunkSize);

      // 2. Fetch all customer RUTs in parallel pages to be absolutely sure we scan the entire database
      const promises = [];
      for (let i = 0; i < numPages; i++) {
        const from = i * chunkSize;
        const to = from + chunkSize - 1;
        promises.push(
          supabase
            .from('customers')
            .select('rut')
            .range(from, to)
        );
      }

      const results = await Promise.all(promises);
      results.forEach(({ data, error }) => {
        if (!error && data) {
          data.forEach(c => {
            if (c.rut) {
              rutsSet.add(c.rut);
            }
          });
        }
      });

      if (rutsSet.size > 0) {
        let maxNum = 1000;

        rutsSet.forEach(rut => {
          const trimmed = rut.trim();

          // Parse CLI-XXXX or CLIXXXX (case-insensitive, with or without hyphen)
          const matchCLI = trimmed.match(/^cli-?(\d+)$/i);
          if (matchCLI) {
            const num = parseInt(matchCLI[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
            return;
          }

          // Parse pure numeric values (under 1,000,000 to avoid conflicts with Chilean RUTs)
          const matchPureNumeric = trimmed.match(/^(\d+)$/);
          if (matchPureNumeric) {
            const num = parseInt(matchPureNumeric[1], 10);
            if (!isNaN(num) && num > maxNum && num < 1000000) {
              maxNum = num;
            }
          }
        });

        // Always suggest the next code formatted as a pure numeric value as requested
        setNextCorrelativeCode(`${maxNum + 1}`);
      } else {
        setNextCorrelativeCode('2368');
      }
    } catch (err) {
      console.error('Error loading next correlative:', err);
      setNextCorrelativeCode('2368');
    }
  };

  const getNextCorrelativeCode = () => {
    return nextCorrelativeCode;
  };

  useEffect(() => {
    fetchData();

    const qChannel = supabase.channel('quotations_all').on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => fetchData()).subscribe();
    const cChannel = supabase.channel('customers_all').on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchData()).subscribe();
    const pChannel = supabase.channel('products_all').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData()).subscribe();
    const catChannel = supabase.channel('categories_all').on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchData()).subscribe();
    const subChannel = supabase.channel('subcategories_all').on('postgres_changes', { event: '*', schema: 'public', table: 'subcategories' }, () => fetchData()).subscribe();

    return () => {
      supabase.removeChannel(qChannel);
      supabase.removeChannel(cChannel);
      supabase.removeChannel(pChannel);
      supabase.removeChannel(catChannel);
      supabase.removeChannel(subChannel);
    };
  }, []);

  useEffect(() => {
    if (isProductModalOpen) {
      // Find the highest ACC- number among all products (not just those already in state if they haven't loaded yet)
      const accProducts = products.filter(p => p.sku && p.sku.startsWith('ACC-'));
      if (accProducts.length > 0) {
        const numbers = accProducts.map(p => {
          const match = p.sku.match(/ACC-(\d+)/);
          return match ? parseInt(match[1]) : 0;
        }).filter(n => !isNaN(n));
        
        const maxNum = numbers.length > 0 ? Math.max(...numbers) : 100;
        // Ensure starting at 101 if no valid numbers found
        const nextNum = Math.max(maxNum, 100) + 1;
        setSuggestedSku(`ACC-${nextNum}`);
      } else {
        setSuggestedSku('ACC-101');
      }
    }
  }, [isProductModalOpen, products]);

  // Unified Label Logic
  const getCustomerLabels = (customer?: Customer, fallbackName?: string) => {
    let mainLabel = 'Cliente (Sin Registro)';
    let subLabel = '';

    if (customer) {
      const nameClean = (customer.name || '').trim();
      const rutClean = (customer.rut || '').trim();

      // Robust Chilean RUT detection: Numeric, points, hyphens, and can end in 'K'
      const looksLikeRut = (str: string) => {
        const clean = str.replace(/[.-]/g, '');
        return /^[0-9]+[0-9kK]?$/.test(clean) && clean.length >= 7 && clean.length <= 10;
      };

      const isNameLikeRut = looksLikeRut(nameClean);
      const isRutLikeName = rutClean && !looksLikeRut(rutClean);
      
      // If name field looks like a RUT and RUT field looks like a Name, swap them for display
      if (isNameLikeRut && isRutLikeName) {
        mainLabel = rutClean;
        subLabel = nameClean;
      } else if (isNameLikeRut && !rutClean) {
        // Only RUT provided in Name field
        mainLabel = 'Cliente (RUT: ' + nameClean + ')';
        subLabel = nameClean;
      } else {
        mainLabel = nameClean || 'Cliente (Sin Nombre)';
        subLabel = rutClean || '';
      }
      
      // Override for subLabel in list views if address is available
      if (customer.address) subLabel = customer.address;
    } else if (fallbackName) {
      mainLabel = fallbackName;
    }

    return { mainLabel, subLabel };
  };

  // Use global search if provided (e.g. from global dashboard), otherwise use local search
  const effectiveSearch = globalSearch || searchTerm;

  const filteredQuotations = quotations.filter(q => {
    const customer = customers.find(c => c.id === q.customer_id);
    const { mainLabel, subLabel } = getCustomerLabels(customer, q.customer_name);
    
    const qIndex = quotations.findIndex(x => x.id === q.id);
    const qNumber = 20100 + (quotations.length - qIndex);
    
    // Normalization helper to handle Spanish accents/tildes
    const norm = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    const searchNorm = norm(effectiveSearch);
    if (!searchNorm) return true;

    const mainLabelNorm = norm(mainLabel);
    const subLabelNorm = norm(subLabel);
    
    // Additional fields on customer object
    const customerNameNorm = customer ? norm(customer.name || '') : '';
    const customerRutNorm = customer ? norm(customer.rut || '') : '';
    const customerEmailNorm = customer ? norm(customer.email || '') : '';
    const customCustomerNameNorm = norm(q.customer_name || '');
    
    // Clean search string for numerical match to handle searches like "#20101", "n° 20101", etc.
    let numberSearch = searchNorm;
    if (numberSearch.startsWith('#')) {
      numberSearch = numberSearch.slice(1).trim();
    } else if (numberSearch.startsWith('n°') || numberSearch.startsWith('nº')) {
      numberSearch = numberSearch.slice(2).trim();
    } else if (numberSearch.startsWith('no')) {
      numberSearch = numberSearch.startsWith('no.') ? numberSearch.slice(3).trim() : numberSearch.slice(2).trim();
    }
    
    return mainLabelNorm.includes(searchNorm) || 
           subLabelNorm.includes(searchNorm) || 
           customerNameNorm.includes(searchNorm) ||
           customerRutNorm.includes(searchNorm) ||
           customerEmailNorm.includes(searchNorm) ||
           customCustomerNameNorm.includes(searchNorm) ||
           qNumber.toString().includes(searchNorm) ||
           (numberSearch && qNumber.toString().includes(numberSearch));
  });

  const fetchData = async () => {
    try {
      console.log('Fetching all necessary data for QuotationView...');
      
      // Fetch products in chunks to bypass the Supabase 1000-row limit
      let allProducts: Product[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name')
          .range(from, from + limit - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          allProducts = [...allProducts, ...data];
          if (data.length < limit) {
            hasMore = false;
          } else {
            from += limit;
          }
        } else {
          hasMore = false;
        }
      }

      // Fetch customers in chunks to bypass the Supabase 1000-row limit
      let allCustomers: Customer[] = [];
      let cFrom = 0;
      const cLimit = 1000;
      let cHasMore = true;

      while (cHasMore) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('name')
          .range(cFrom, cFrom + cLimit - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          allCustomers = [...allCustomers, ...data];
          if (data.length < cLimit) {
            cHasMore = false;
          } else {
            cFrom += cLimit;
          }
        } else {
          cHasMore = false;
        }
      }

      const [qRes, catRes, subRes] = await Promise.all([
        supabase.from('quotations').select('*').order('date', { ascending: false }),
        supabase.from('categories').select('*').order('name'),
        supabase.from('subcategories').select('*').order('name')
      ]);

      if (qRes.error) console.error('Error fetching quotations:', qRes.error);
      if (catRes.error) console.error('Error fetching categories:', catRes.error);
      if (subRes.error) console.error('Error fetching subcategories:', subRes.error);

      if (qRes.data) setQuotations(qRes.data);
      setCustomers(allCustomers);
      setProducts(allProducts);
      if (catRes.data) setCategories(catRes.data);
      if (subRes.data) setSubcategories(subRes.data);

      console.log('Data loaded:', {
        quotations: qRes.data?.length,
        customers: allCustomers.length,
        products: allProducts.length,
        categories: catRes.data?.length,
        subcategories: subRes.data?.length
      });
      loadNextCorrelative();
    } catch (err: any) {
      console.error('Error fetching quotation data:', err);
    }
  };

  const total = quoteItems.reduce((acc, item) => acc + item.subtotal, 0);

  const getEffectivePrice = (product: Product | undefined, qty: number): number => {
    if (!product) return 0;
    const normalPrice = product.price || 0;
    const wholesalePrice = product.wholesale_price;
    const minQty = product.wholesale_min_qty;
    
    if (wholesalePrice && wholesalePrice > 0 && minQty && minQty > 0 && qty >= minQty) {
      return wholesalePrice;
    }
    return normalPrice;
  };

  const handleAddItem = (p: Product) => {
    const existing = quoteItems.find(i => i.productId === p.id);
    if (existing) {
      const newQty = existing.qty + 1;
      const unitPrice = getEffectivePrice(p, newQty);
      setQuoteItems(quoteItems.map(i => 
        i.productId === p.id ? { ...i, qty: newQty, price: unitPrice, subtotal: newQty * unitPrice } : i
      ));
    } else {
      const unitPrice = getEffectivePrice(p, 1);
      setQuoteItems([...quoteItems, {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        qty: 1,
        price: unitPrice,
        subtotal: unitPrice
      }]);
    }
  };

  const handleRemoveItem = (productId: string) => {
    setQuoteItems(quoteItems.filter(i => i.productId !== productId));
  };

  const updateItemQty = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    setQuoteItems(quoteItems.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.qty + delta);
        const unitPrice = getEffectivePrice(product, newQty);
        return { ...item, qty: newQty, price: unitPrice, subtotal: newQty * unitPrice };
      }
      return item;
    }));
  };

  const updateItemPrice = (productId: string, newPrice: number) => {
    setQuoteItems(quoteItems.map(item => {
      if (item.productId === productId) {
        return { ...item, price: newPrice, subtotal: item.qty * newPrice };
      }
      return item;
    }));
  };

  const handleEditQuotation = (q: Quotation) => {
    setEditingQuotationId(q.id);
    const customer = customers.find(c => c.id === q.customer_id);
    setSelectedCustomer(customer || null);
    setQuoteItems(q.items);
    setIsModalOpen(true);
  };

  const handleSaveQuotation = async () => {
    if (!selectedCustomer) {
      showAlert("Validación", "Debe seleccionar un cliente para generar la cotización.", "warning");
      return;
    }
    if (quoteItems.length === 0) {
      showAlert("Validación", "Debe agregar al menos un producto a la cotización.", "warning");
      return;
    }

    const data: any = {
      customer_id: selectedCustomer.id,
      customer_name: selectedCustomer.name,
      date: new Date().toISOString(),
      items: quoteItems,
      total,
      status: "sent"
    };

    try {
      let error;
      console.log('Attempting to save quotation...', { ...data, editingId: editingQuotationId });

      if (editingQuotationId) {
        const { error: updateError } = await supabase.from('quotations').update(data).eq('id', editingQuotationId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('quotations').insert([data]);
        error = insertError;
      }
      
      // If we have a column error, try to be specific about what's missing
      if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
        console.warn('Schema issues detected, trying partial save...', error.message);
        
        let partialData = { ...data };
        
        // Remove columns that might not exist based on error message
        if (error.message.includes('customer_name')) {
          delete partialData.customer_name;
        } 
        if (error.message.includes('customer_id')) {
          delete partialData.customer_id;
        }

        let retry;
        if (editingQuotationId) {
          retry = await supabase.from('quotations').update(partialData).eq('id', editingQuotationId);
        } else {
          retry = await supabase.from('quotations').insert([partialData]);
        }
        
        if (!retry.error) {
          error = null;
          showAlert("Aviso de Esquema", "Cotización guardada (algunas columnas de cliente no existen en su base de datos).", "warning");
        } else {
          error = retry.error;
        }
      }

      if (error) throw error;

      showAlert("Éxito", `Cotización ${editingQuotationId ? 'actualizada' : 'guardada'} correctamente.`, "success");
      setIsModalOpen(false);
      resetForm();
      await fetchData();
    } catch (err: any) {
      console.error('Save Quotation Error:', err);
      showAlert("Error Crítico", 'No se pudo guardar la cotización: ' + (err.message || 'Error desconocido'));
    }
  };

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const productData = {
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
      let { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select();

      if (error && (error.message.includes('cost_price') || error.message.includes('wholesale') || error.message.includes('column'))) {
        const fallbackData = { ...productData };
        if (error.message.includes('wholesale')) {
          delete (fallbackData as any).wholesale_price;
          delete (fallbackData as any).wholesale_min_qty;
        }
        if (error.message.includes('cost_price')) {
          delete (fallbackData as any).cost_price;
        }
        const retry = await supabase.from('products').insert([fallbackData]).select();
        error = retry.error;
        data = retry.data;
      }

      if (error) throw error;
      
      const newProduct = data[0] as Product;
      setProducts(prev => [newProduct, ...prev]);
      setIsProductModalOpen(false);
      setSearchProduct(newProduct.sku);
      showAlert("Éxito", "Producto creado correctamente en el inventario.", "success");
    } catch (error: any) {
      console.error('Error saving product:', error);
      showAlert("Error", "No se pudo guardar el producto: " + (error.message || "Error desconocido"));
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    let rutVal = (formData.get('rut') as string || '').trim();
    if (!rutVal) {
      rutVal = getNextCorrelativeCode();
    }
    const data = {
      name: formData.get('name') as string,
      rut: rutVal,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
    };

    try {
      if (editingCustomer) {
        const { error } = await supabase.from('customers').update(data).eq('id', editingCustomer.id);
        if (error) throw error;
        // Update selected customer if we edited the one we were using
        if (selectedCustomer?.id === editingCustomer.id) {
          setSelectedCustomer({ ...editingCustomer, ...data } as Customer);
          setSearchCustomer(data.name);
        }
      } else {
        let success = false;
        let attempt = 0;
        let currentRut = data.rut;
        let errToThrow = null;
        let createdCustomer = null;

        while (!success && attempt < 5) {
          const { data: newCustomer, error } = await supabase
            .from('customers')
            .insert([{ ...data, rut: currentRut }])
            .select()
            .single();

          if (!error) {
            success = true;
            createdCustomer = newCustomer;
          } else {
            const isDuplicate = error.code === '23505' || (error.message && error.message.toLowerCase().includes('duplicate'));
            const isAutogeneratedPattern = /^cli-?(\d+)$/i.test(currentRut) || (/^\d+$/.test(currentRut) && parseInt(currentRut, 10) < 1000000);
            
            if (isDuplicate && isAutogeneratedPattern) {
              attempt++;
              let prefix = 'CLI';
              let numStr = '';
              const matchWithHyphen = currentRut.match(/^cli-(\d+)$/i);
              const matchNoHyphen = currentRut.match(/^cli(\d+)$/i);
              const matchPureNumeric = currentRut.match(/^(\d+)$/);

              if (matchWithHyphen) {
                prefix = 'CLI-';
                numStr = matchWithHyphen[1];
              } else if (matchNoHyphen) {
                prefix = 'CLI';
                numStr = matchNoHyphen[1];
              } else if (matchPureNumeric) {
                prefix = '';
                numStr = matchPureNumeric[1];
              }

              const nextNum = parseInt(numStr, 10) + 1;
              currentRut = `${prefix}${nextNum}`;
              console.log(`Duplicate customer code detected, retrying with incremented code: ${currentRut} (attempt ${attempt})`);
            } else {
              errToThrow = error;
              break;
            }
          }
        }
        if (!success && errToThrow) throw errToThrow;
        if (createdCustomer) {
          setSelectedCustomer(createdCustomer);
          setSearchCustomer(createdCustomer.name);
        }
      }
      setIsCustomerModalOpen(false);
      setEditingCustomer(null);
      await fetchData();
      showAlert("Cliente Guardado", `El cliente ha sido ${editingCustomer ? 'actualizado' : 'registrado'} correctamente.`, "success");
    } catch (err: any) {
      showAlert("Error", 'Error al guardar cliente: ' + err.message);
    }
  };

  const resetForm = () => {
    setEditingQuotationId(null);
    setSelectedCustomer(null);
    setQuoteItems([]);
    setSearchCustomer('');
    setSearchProduct('');
    setIsMobileSearchOpen(false);
    setIsMobileCartOpen(false);
  };

  const sendWhatsApp = (q: Quotation) => {
    const customer = customers.find(c => c.id === q.customer_id);
    if (!customer?.phone) {
      showAlert("Aviso", "El cliente no tiene un teléfono registrado.", "warning");
      return;
    }
    
    const qIndex = quotations.findIndex(x => x.id === q.id);
    const qNumber = 20100 + (quotations.length - qIndex);
    
    const { mainLabel } = getCustomerLabels(customer, q.customer_name);
    const firstName = (mainLabel || '').split(' ')[0].toUpperCase();
    
    const text = `👋 Hola ${firstName}, adjuntamos su cotización *N° ${qNumber}* de TH Comercial:\n\n` +
      q.items.map(i => `* ${i.name.toUpperCase()} (${i.qty} x ${formatCurrency(i.price)})`).join('\n') +
      `\n💰 *TOTAL: ${formatCurrency(q.total)}*\n\n` +
      `Desde ya, agradecemos su preferencia 🙌\n` +
      `Comparto datos para el pago de cotización:\n\n` +
      `🏦\n` +
      `BANCO ESTADO\n` +
      `CTA VISTA N° 29870066587\n` +
      `TH SpA\n` +
      `77.042.984-6\n` +
      `contacto@thspa.cl`;
    
    const phone = customer.phone.replace(/\D/g, '');
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const generatePDF = async (q: Quotation, correlative: number) => {
    const customer = customers.find(c => c.id === q.customer_id);
    const doc = new jsPDF();
    
    // Fetch general conditions from localStorage (with fallback to old key)
    const conditions = localStorage.getItem('general_conditions') || localStorage.getItem('commercial_conditions') || 'Esta cotización tiene una validez de 5 días hábiles.';
    
    // Brand Colors
    const primaryColor = [100, 116, 139]; // Gray/Slate for the "Huincha"
    const accentColor = [56, 189, 248]; // Sky Blue for brand accents
    const grayColor = [100, 116, 139]; // Slate 500
    
    // Table Config
    const startYTable = 90;

    // Header - TH SpA
    doc.setFontSize(22);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('TH SpA', 20, 25);
    
    // Company Info (Left)
    doc.setFontSize(9);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('77.042.984-6', 20, 32);
    doc.text('Comercializadora de Articulos para el Hogar, Lanas y Accesorios.', 20, 37);
    doc.text('De Las Alondras 11259, La Florida, Santiago.', 20, 42);
    doc.text('+569 71744262 | contacto@thspa.cl', 20, 47);
    
    // Quotation Header (Right) - Replacing black/sky box with Gray (primaryColor)
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(140, 15, 50, 20, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('COTIZACIÓN', 165, 24, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`N° ${correlative}`, 165, 31, { align: 'center' });
    
    // Date
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFontSize(9);
    const dateStr = new Date(q.date).toLocaleDateString();
    doc.text(`Fecha: ${dateStr}`, 145, 42);

    // Divider
    doc.setDrawColor(241, 245, 249);
    doc.line(20, 55, 190, 55);
    
    // Client Info (Name, Phone, Address only)
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE', 20, 65);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    // Use detection logic for PDF name
    const { mainLabel: pdfCustomerName } = getCustomerLabels(customer, q.customer_name);
    
    doc.setFont('helvetica', 'bold');
    doc.text(`Nombre: ${pdfCustomerName}`, 20, 72);
    doc.setFont('helvetica', 'normal');
    doc.text(`Teléfono: ${customer?.phone || 'N/A'}`, 20, 77);
    doc.text(`Dirección: ${customer?.address || 'N/A'}`, 20, 82);
    
    // Draw rounded background for table header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(20, startYTable, 170, 10, 3, 3, 'F');

    // Items Table
    autoTable(doc, {
      startY: startYTable,
      head: [['SKU', 'PRODUCTO', 'CANT', 'PRECIO', 'SUBTOTAL']],
      body: q.items.map(i => [
        i.sku,
        i.name,
        i.qty.toString(),
        formatCurrency(i.price),
        formatCurrency(i.subtotal)
      ]),
      headStyles: {
        fillColor: false, // Set to false to allow the roundedRect background to show
        textColor: [255, 255, 255],
        fontSize: 9,
        halign: 'center',
        fontStyle: 'bold',
        minCellHeight: 10
      },
      styles: {
        cellPadding: 3,
        fontSize: 8,
        lineColor: [241, 245, 249],
      },
      columnStyles: {
        0: { cellWidth: 25 },
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      },
      margin: { left: 20, right: 20 },
      theme: 'grid',
      tableLineColor: [241, 245, 249],
      tableLineWidth: 0.1,
    });
    
    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`TOTAL: ${formatCurrency(q.total)}`, 190, finalY, { align: 'right' });
    
    // Bank Details Footer
    const footerY = doc.internal.pageSize.height - 65;
    doc.setDrawColor(240, 240, 240);
    doc.line(20, footerY - 5, 190, footerY - 5);
    
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS PARA TRANSFERENCIA BANCARIA', 20, footerY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text('BANCO ESTADO', 20, footerY + 6);
    doc.text('CTA VISTA N° 29870066587', 20, footerY + 11);
    doc.text('TH SpA', 20, footerY + 16);
    doc.text('77.042.984-6', 20, footerY + 21);
    doc.text('Contacto@thspa.cl', 20, footerY + 26);
    
    // Commercial Conditions (Smaller text at bottom)
    const conditionsY = doc.internal.pageSize.height - 25;
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate 400
    const splitConditions = doc.splitTextToSize(conditions, 170);
    doc.text(splitConditions, 20, conditionsY);
 
    // Save PDF
    doc.save(`Cotizacion_TH_${correlative}_${pdfCustomerName.replace(/ /g, '_')}.pdf`);
  };

  const handleAcceptQuote = async (q: Quotation) => {
    try {
      // 1. Update quote status
      const { error: qError } = await supabase.from('quotations').update({ status: 'accepted' }).eq('id', q.id);
      if (qError) throw qError;
      
      // 2. Create Sale
      const saleData = {
        quotation_id: q.id,
        customer_id: q.customer_id,
        date: new Date().toISOString(),
        items: q.items,
        total: q.total,
        status: 'paid'
      };

      let { error: sError } = await supabase.from('sales').insert([saleData]);
      
      if (sError && (sError.message.includes('column') || sError.message.includes('schema cache'))) {
        console.warn('Sales schema mismatch, attempting robust fallback...', sError.message);
        
        let fallbackData = { ...saleData };
        
        // Remove quotation_id if it's the one causing issues
        if (sError.message.includes('quotation_id')) {
          delete (fallbackData as any).quotation_id;
        }
        // Remove customer_id if it's the one causing issues
        if (sError.message.includes('customer_id')) {
          delete (fallbackData as any).customer_id;
        }

        let retry = await supabase.from('sales').insert([fallbackData]);
        
        // If it still fails, try a minimal version (no relations)
        if (retry.error && (retry.error.message.includes('column') || retry.error.message.includes('schema cache'))) {
           const { quotation_id, customer_id, ...minimalSale } = saleData as any;
           retry = await supabase.from('sales').insert([minimalSale]);
        }
        
        if (!retry.error) {
          sError = null;
          console.log('Sale created via fallback mechanism');
        } else {
          sError = retry.error;
        }
      }

      if (sError) throw sError;

      // 3. Update Inventory (Subtract stock)
      for (const item of q.items) {
        const { data: productsData } = await supabase.from('products').select('stock').eq('sku', item.sku).single();
        if (productsData) {
          await supabase.from('products').update({
            stock: Math.max(0, (productsData.stock || 0) - item.qty)
          }).eq('sku', item.sku);
        }
      }

      showAlert("¡Venta Realizada!", "Cotización aceptada. Se ha generado un Ticket de Venta e inventario actualizado.", "success");
      fetchData();
    } catch (err: any) {
      showAlert("Error", 'Error al procesar la venta: ' + err.message);
    }
  };

  const handleDeleteQuotation = async () => {
    if (!quotationToDelete) return;
    
    setIsDeleting(true);
    try {
      console.log('--- START DELETE OPERATION ---');
      console.log('ID to delete:', quotationToDelete);
      
      const { error, status } = await supabase
        .from('quotations')
        .delete()
        .eq('id', quotationToDelete);
      
      if (error) {
        console.error('Supabase Delete Error:', error);
        throw error;
      }

      console.log('Delete successful, status:', status);
      
      // Close delete modal first to not obscure the alert
      setQuotationToDelete(null);
      showAlert("Eliminado", "La cotización ha sido borrada exitosamente.", "success");
      
      // Force refresh
      await fetchData();
    } catch (err: any) {
      console.error('CRITICAL DELETE ERROR:', err);
      showAlert("Error de Eliminación", `No se pudo eliminar: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsDeleting(false);
      // Ensure it's closed even on error
      setQuotationToDelete(null);
    }
  };

  const handleResetStatus = async (q: Quotation) => {
    try {
      const { error } = await supabase.from('quotations').update({ status: 'sent' }).eq('id', q.id);
      if (error) throw error;
      showAlert("Estado Reiniciado", "La cotización ha vuelto a estado 'Enviada' y puede procesarse nuevamente.", "success");
      fetchData();
    } catch (err: any) {
      showAlert("Error", "No se pudo reiniciar el estado: " + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 p-2 rounded-2xl border border-slate-100 sm:border-0 sm:bg-transparent sm:p-0">
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight shrink-0 text-center md:text-left">Cotizaciones</h1>
        
        <div className="flex-1 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-end w-full">
          {/* Multimodal Search Input */}
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <input 
              type="text" 
              placeholder="Buscar por N° de cotización o cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium text-slate-800"
            />
            {searchTerm && (
              <button 
                type="button" 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-sky-900/10 hover:bg-sky-600 transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generar Cotización</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-3 md:px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16 text-center">N°</th>
                <th className="px-3 md:px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="px-3 md:px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Fecha</th>
                <th className="px-3 md:px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</th>
                <th className="px-3 md:px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Estado</th>
                <th className="px-3 md:px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotations.map((q) => {
                const index = quotations.findIndex(x => x.id === q.id);
                const correlative = 20100 + (quotations.length - index);
                const customer = customers.find(c => c.id === q.customer_id);
                
                const { mainLabel, subLabel } = getCustomerLabels(customer, q.customer_name);

                return (
                  <tr 
                    key={q.id} 
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer md:cursor-default active:bg-slate-100/70"
                    onClick={(e) => {
                      if (window.innerWidth < 768) {
                        if ((e.target as HTMLElement).closest('button')) {
                          return;
                        }
                        setMobileActionQuotation({ q, correlative });
                      }
                    }}
                  >
                    <td className="px-3 md:px-4 py-4 font-mono text-[13px] md:text-[14px] text-slate-500 font-extrabold whitespace-nowrap text-center">
                      {correlative}
                    </td>
                    <td className="px-3 md:px-4 py-4 min-w-[150px]">
                      <div className="flex flex-col">
                        <span className="font-bold text-xs md:text-sm text-slate-900 leading-tight">
                          {mainLabel}
                        </span>
                        {subLabel && (
                          <span className="text-[9px] md:text-[10px] text-slate-400 font-medium truncate max-w-[200px] mt-0.5">
                            {subLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 md:px-4 py-4 text-[10px] md:text-[11px] text-slate-500 font-medium whitespace-nowrap text-center">{new Date(q.date).toLocaleDateString()}</td>
                    <td className="px-3 md:px-4 py-4 font-black text-xs md:text-sm text-slate-800 whitespace-nowrap">{formatCurrency(q.total)}</td>
                    <td className="px-3 md:px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] md:text-[9px] font-black uppercase tracking-wider",
                          q.status === 'accepted' ? "bg-emerald-100 text-emerald-700" :
                          q.status === 'rejected' ? "bg-red-100 text-red-700" :
                          "bg-sky-100 text-sky-700"
                        )}>
                          {q.status}
                        </span>
                        {q.status === 'accepted' && (
                          <button 
                            onClick={() => handleResetStatus(q)}
                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-all"
                            title="Forzar Reinicio a Enviada"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 md:px-4 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 md:gap-1">
                        <button 
                          onClick={() => generatePDF(q, correlative)}
                          className="p-2 md:p-1.5 text-blue-500 hover:bg-sky-50 hover:text-sky-600 rounded-lg transition-colors border border-slate-100 md:border-transparent"
                          title="Descargar PDF"
                        >
                          <Printer className="w-4 h-4 md:w-4 md:h-4" />
                        </button>
                        <button 
                          onClick={() => sendWhatsApp(q)}
                          className="p-2 md:p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-slate-100 md:border-transparent"
                          title="Enviar por WhatsApp"
                        >
                          <Send className="w-4 h-4 md:w-4 md:h-4" />
                        </button>
                        {q.status !== 'accepted' && (
                          <>
                            <button 
                              onClick={() => handleAcceptQuote(q)}
                              className="p-2 md:p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg border border-slate-100 md:border-transparent"
                              title="Confirmar Venta"
                            >
                              <ShoppingCart className="w-4 h-4 md:w-4 md:h-4" />
                            </button>
                            <button 
                              onClick={() => handleEditQuotation(q)}
                              className="p-2 md:p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-100 md:border-transparent"
                              title="Editar Cotización"
                            >
                              <Edit2 className="w-4 h-4 md:w-4 md:h-4" />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => setQuotationToDelete(q.id)}
                          className="p-2 md:p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-90 border border-slate-100 md:border-transparent"
                          title="Eliminar Permanente"
                        >
                          <Trash2 className="w-4 h-4 md:w-4 md:h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Quote Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]"
            >
              <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-lg md:text-2xl font-bold text-slate-900">
                  {editingQuotationId ? 'Editar Cotización' : 'Nueva Cotización'}
                </h2>
                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                {/* Left Side: selection */}
                <div className="space-y-5 md:space-y-6">
                  <section>
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                      <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">1. Cliente Solicitante</h3>
                    </div>
                    
                    {!selectedCustomer ? (
                      <button 
                        onClick={() => setIsCustomerPickerOpen(true)}
                        className="w-full flex flex-col items-center justify-center p-5 md:p-8 border-2 border-dashed border-slate-200 rounded-2xl md:rounded-3xl hover:border-sky-400 hover:bg-sky-50 transition-all group"
                      >
                        <div className="bg-sky-100 p-2 md:p-3 rounded-full text-sky-600 mb-1.5 md:mb-3 group-hover:scale-110 transition-transform">
                          <UserPlus className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <p className="font-bold text-slate-800 text-xs md:text-sm">Seleccionar Cliente</p>
                        <p className="text-[8px] md:text-[9px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Obligatorio</p>
                      </button>
                    ) : (
                      <div className="bg-slate-900 p-2.5 md:p-3 rounded-xl shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-5">
                          <UserPlus className="w-10 h-10 md:w-12 md:h-12 text-white" />
                        </div>
                        <div className="relative z-10 flex justify-between items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[8px] md:text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Cliente Seleccionado</p>
                            {(() => {
                              const labels = getCustomerLabels(selectedCustomer);
                              return (
                                <>
                                  <h4 className="text-white font-bold text-xs md:text-sm leading-tight truncate">{labels.mainLabel}</h4>
                                  <p className="text-slate-400 text-[9px] md:text-[10px] font-medium truncate mt-0.5">{labels.subLabel}</p>
                                </>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                             <button 
                              onClick={() => {
                                setEditingCustomer(selectedCustomer);
                                setIsCustomerModalOpen(true);
                              }}
                              className="p-1 px-2 text-[8px] md:text-[9px] bg-white/10 text-white border border-white/20 rounded uppercase font-bold hover:bg-white/20 transition-all cursor-pointer"
                            >
                              Editar
                            </button>
                            <button 
                              onClick={() => setSelectedCustomer(null)}
                              className="p-1 px-2 text-[8px] md:text-[9px] bg-red-500/20 text-red-300 border border-red-500/30 rounded uppercase font-bold hover:bg-red-500/40 transition-all cursor-pointer"
                            >
                              Cambiar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Desktop Only Product list */}
                  <section className="hidden md:block">
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <h3 className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest">2. Productos</h3>
                      <button 
                        onClick={() => setIsProductModalOpen(true)}
                        className="flex items-center gap-1.5 text-sky-600 hover:text-sky-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-[10px] md:text-xs font-bold uppercase">Nuevo</span>
                      </button>
                    </div>
                     <div className="relative mb-3 md:mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input 
                          type="text" 
                          placeholder="Buscar SKU o Nombre..."
                          value={searchProduct}
                          onChange={(e) => setSearchProduct(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 md:py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs md:text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                        />
                     </div>
                     <div className="space-y-2 max-h-48 md:max-h-60 overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                        {products
                          .filter(p => !searchProduct || 
                            (p.name || '').toLowerCase().indexOf(searchProduct.toLowerCase()) !== -1 || 
                            (p.sku || '').toLowerCase().indexOf(searchProduct.toLowerCase()) !== -1
                          )
                          .slice(0, 30)
                          .map(p => (
                          <button
                            key={p.id}
                            onClick={() => handleAddItem(p)}
                            className="w-full flex items-center justify-between p-2.5 md:p-3 bg-white border border-gray-100 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all group"
                          >
                            <div className="text-left flex-1 min-w-0 mr-2">
                              <p className="font-bold text-slate-900 text-xs md:text-sm truncate">{p.name}</p>
                              <p className="text-[9px] md:text-[10px] text-gray-400 font-mono tracking-tighter uppercase">
                                {p.sku} • {formatCurrency(p.price)}
                                {p.wholesale_price && p.wholesale_price > 0 ? (
                                  <span className="text-emerald-600 font-semibold ml-1">
                                    • MAYORISTA: {formatCurrency(p.wholesale_price)} (DESDE {p.wholesale_min_qty || 3} UDS)
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <div className="bg-slate-50 p-1.5 md:p-2 rounded-lg group-hover:bg-sky-600 group-hover:text-white transition-all text-slate-400">
                              <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </div>
                          </button>
                        ))}
                     </div>
                  </section>

                  {/* Mobile Only triggers */}
                  <section className="block md:hidden space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Productos</h3>
                        <button 
                          onClick={() => setIsProductModalOpen(true)}
                          className="flex items-center gap-1 text-sky-600 font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span className="text-[9px] uppercase">Nuevo</span>
                        </button>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setIsMobileSearchOpen(true)}
                        className="w-full flex items-center justify-center gap-2 p-3 bg-sky-50 border border-sky-100 text-sky-700 hover:bg-sky-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                      >
                        <Search className="w-4 h-4 text-sky-600" />
                        Añadir / Buscar Productos
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">3. Resumen carro</h3>
                      </div>
                      
                      {quoteItems.length === 0 ? (
                        <div className="p-5 text-center border border-dashed border-slate-200 bg-slate-50/50 rounded-xl text-slate-400 text-xs font-bold uppercase tracking-wide">
                          Carrito Vacío
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex justify-between items-center shadow-sm">
                            <div className="text-left">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Elegidos</p>
                              <p className="text-xs font-black text-slate-800">{quoteItems.length} {quoteItems.length === 1 ? 'ítem' : 'ítems'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Total Estimado</p>
                              <p className="text-sm font-black text-emerald-600">{formatCurrency(total)}</p>
                            </div>
                          </div>

                          <div className="flex gap-2.5">
                            <button
                              type="button"
                              onClick={() => setIsMobileCartOpen(true)}
                              className="flex-1 flex items-center justify-center gap-1.5 p-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                            >
                              <ShoppingCart className="w-3.5 h-3.5 text-sky-400" />
                              Ver Carrito
                            </button>
                            
                            <button
                              type="button"
                              onClick={handleSaveQuotation}
                              disabled={!selectedCustomer}
                              className={cn(
                                "flex-1 p-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm",
                                !selectedCustomer ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"
                              )}
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Right Side: Cart (Desktop only) */}
                <div className="hidden md:flex bg-slate-900 text-slate-100 rounded-2xl md:rounded-3xl p-4 md:p-6 flex-col">
                  <div className="flex justify-between items-center mb-3 md:mb-4">
                    <h3 className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest">Resumen</h3>
                    {quoteItems.length > 0 && (
                      <button
                        type="button"
                        onClick={openTransportModal}
                        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-[9px] uppercase font-black tracking-wider transition-all cursor-pointer shadow-sm border border-slate-700/50"
                        title="Agregar Transporte"
                      >
                        <Truck className="w-3.5 h-3.5 text-sky-400" />
                        <span>+ Transporte</span>
                      </button>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 md:space-y-3 mb-4 md:mb-6 overflow-y-auto">
                    {quoteItems.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-8">
                        <ShoppingCart className="w-8 h-8 md:w-10 md:h-10 opacity-30 text-slate-400" />
                        <p className="text-xs md:text-sm">Sin productos seleccionados</p>
                      </div>
                    )}
                    {quoteItems.map(item => (
                      <div key={item.productId} className="flex items-center justify-between bg-slate-800 p-2 md:p-3 rounded-lg md:rounded-xl shadow-sm border border-slate-700/50 group">
                        <div className="flex-1 min-w-0 mr-2 md:mr-4">
                          <p className="font-bold text-slate-100 text-[11px] md:text-sm truncate leading-none uppercase">{item.name}</p>
                          <div className="flex items-center gap-1.5 md:gap-2 mt-1 md:mt-0.5">
                            <button 
                              onClick={() => updateItemQty(item.productId, -1)}
                              className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white rounded transition-colors"
                            >
                              <Minus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            </button>
                            <span className="text-[10px] md:text-xs font-black text-slate-200 w-4 md:w-5 text-center">{item.qty}</span>
                            <button 
                               onClick={() => updateItemQty(item.productId, 1)}
                               className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white rounded transition-colors"
                            >
                              <Plus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            </button>
                            <span className="text-[9px] md:text-[10px] text-slate-400 ml-1">x</span>
                            <div className="flex items-center bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 max-w-[85px] md:max-w-[105px]">
                              <span className="text-[9px] md:text-[10px] font-bold text-slate-500 mr-0.5">$</span>
                              <input 
                                type="number" 
                                value={item.price}
                                onChange={(e) => updateItemPrice(item.productId, Math.max(0, Number(e.target.value)))}
                                className="w-full bg-transparent outline-none text-[10px] md:text-xs font-bold text-slate-200 p-0 focus:ring-0"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                          <span className="font-bold text-white text-xs md:text-sm">{formatCurrency(item.subtotal)}</span>
                          <button onClick={() => handleRemoveItem(item.productId)} className="text-slate-400 hover:text-rose-400 p-1 transition-colors">
                            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 md:space-y-4 pt-3 md:pt-4 border-t border-slate-850">
                    <div className="flex justify-between items-center text-base md:text-lg font-extrabold text-white px-1 md:px-2">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                    <button
                      onClick={handleSaveQuotation}
                      className="w-full bg-sky-600 text-white hover:bg-sky-500 py-3.5 md:py-4 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold shadow-xl shadow-sky-950/20 transition-all active:scale-95"
                    >
                      Generar y Guardar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile-Only Product Search Modal */}
      <AnimatePresence>
        {isMobileSearchOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-[150] bg-white flex flex-col p-2.5 pt-2 md:hidden"
          >
            {/* Super-Compact Header & Search Bar combined */}
            <div className="flex items-center gap-2 pb-2 border-b border-slate-150 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                <input 
                  type="text" 
                  placeholder="Buscar SKU o Nombre..."
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none font-medium text-slate-800 focus:border-slate-400 transition-colors"
                />
              </div>
              <button 
                onClick={() => setIsMobileSearchOpen(false)}
                className="p-1 px-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer shrink-0 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List with maximized space */}
            <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1 pb-20 custom-scrollbar">
              {products
                .filter(p => !searchProduct || 
                  (p.name || '').toLowerCase().indexOf(searchProduct.toLowerCase()) !== -1 || 
                  (p.sku || '').toLowerCase().indexOf(searchProduct.toLowerCase()) !== -1
                )
                .slice(0, 50)
                .map(p => {
                  const existing = quoteItems.find(i => i.productId === p.id);
                  const itemQty = existing?.qty || 0;
                  
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "flex flex-col p-2.5 bg-white border rounded-xl transition-all",
                        itemQty > 0 ? "border-sky-550 bg-sky-50/10 shadow-sm" : "border-slate-100 hover:border-slate-200"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-[11px] truncate leading-tight">{p.name}</p>
                          <p className="text-[8.5px] text-gray-400 font-mono tracking-tighter uppercase mt-0.5">
                            {p.sku} • <span className="text-slate-700 font-bold">{formatCurrency(p.price)}</span>
                            {p.wholesale_price && p.wholesale_price > 0 ? (
                              <span className="text-emerald-600 font-semibold ml-1">
                                • MAY. {formatCurrency(p.wholesale_price)} (+{p.wholesale_min_qty || 3})
                              </span>
                            ) : null}
                          </p>
                        </div>
                        
                        <button
                          onClick={() => handleAddItem(p)}
                          className={cn(
                            "p-1 px-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0",
                            itemQty > 0 ? "bg-sky-600 text-white shadow-md shadow-sky-600/10" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          )}
                        >
                          {itemQty > 0 ? (
                            <>
                              <span>{itemQty}</span>
                              <Plus className="w-3 h-3" />
                            </>
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Controls inside result box if added */}
                      {itemQty > 0 && (
                        <div className="flex items-center justify-between border-t border-slate-100/80 mt-2 pt-2 gap-2">
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => updateItemQty(p.id, -1)}
                              className="w-5 h-5 flex items-center justify-center bg-slate-100 text-slate-600 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-[11px] font-black text-slate-800 w-4.5 text-center">{itemQty}</span>
                            <button 
                              onClick={() => updateItemQty(p.id, 1)}
                              className="w-5 h-5 flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded transition-colors cursor-pointer"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>

                          <div className="flex items-center bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 max-w-[100px]">
                            <span className="text-[9px] font-bold text-slate-400 mr-0.5">$</span>
                            <input 
                              type="number" 
                              value={existing?.price}
                              onChange={(e) => updateItemPrice(p.id, Math.max(0, Number(e.target.value)))}
                              className="w-full bg-transparent outline-none text-[11px] font-bold text-slate-800 p-0 focus:ring-0 text-right"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Tally & closing overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-slate-900 p-2.5 px-3 flex justify-between items-center shadow-2xl border-t border-slate-850 shrink-0">
              <div className="text-left text-white">
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wide">Total ({quoteItems.reduce((acc, i) => acc + i.qty, 0)} uds)</p>
                <p className="text-xs font-black text-emerald-400">{formatCurrency(total)}</p>
              </div>
              <button
                onClick={() => setIsMobileSearchOpen(false)}
                className="bg-sky-600 text-white hover:bg-sky-500 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Listo ({quoteItems.length} prod.)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile-Only Summary Cart Modal */}
      <AnimatePresence>
        {isMobileCartOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-[150] bg-slate-950 flex flex-col p-4 md:hidden text-slate-100"
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/80 shrink-0">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-sky-400" />
                  Resumen de la Cotización
                </h3>
                <p className="text-[10px] font-bold text-slate-400">Verifica cantidades, precios y genera la cotización</p>
              </div>
              <div className="flex items-center gap-1">
                {quoteItems.length > 0 && (
                  <button
                    type="button"
                    onClick={openTransportModal}
                    className="p-2 bg-slate-900 border border-slate-850 text-slate-300 hover:text-white rounded-lg flex items-center justify-center cursor-pointer transition-all shrink-0"
                    title="Agregar Transporte"
                  >
                    <Truck className="w-4 h-4 text-sky-450" />
                  </button>
                )}
                <button 
                  onClick={() => setIsMobileCartOpen(false)}
                  className="p-1.5 hover:bg-slate-900 rounded-full text-slate-400 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Cart items */}
            <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1 pb-28 custom-scrollbar">
              {quoteItems.length > 0 && (
                <button
                  type="button"
                  onClick={openTransportModal}
                  className="w-full flex items-center justify-center gap-2 p-2.5 bg-slate-900/60 hover:bg-slate-900 border border-dashed border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm mb-1"
                >
                  <Truck className="w-4 h-4 text-sky-400" />
                  Configurar Valor Transporte
                </button>
              )}
              {quoteItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-12">
                  <ShoppingCart className="w-10 h-10 opacity-30 text-slate-500" />
                  <p className="text-xs">Sin productos seleccionados</p>
                </div>
              ) : (
                quoteItems.map(item => (
                  <div key={item.productId} className="flex flex-col bg-slate-900/60 p-3 rounded-xl shadow-sm border border-slate-800/80">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-100 text-xs truncate uppercase leading-none">{item.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono tracking-tighter uppercase mt-1">
                          Ref: Subtotal - <span className="text-emerald-400 font-bold">{formatCurrency(item.subtotal)}</span>
                        </p>
                      </div>
                      <button 
                        onClick={() => handleRemoveItem(item.productId)} 
                        className="text-slate-400 hover:text-rose-400 p-1 transition-colors shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60">
                      {/* Quantity Selector */}
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => updateItemQty(item.productId, -1)}
                          className="w-7 h-7 flex items-center justify-center bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-black text-slate-100 w-5 text-center">{item.qty}</span>
                        <button 
                          onClick={() => updateItemQty(item.productId, 1)}
                          className="w-7 h-7 flex items-center justify-center bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Price input */}
                      <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 max-w-[130px]">
                        <span className="text-xs font-bold text-slate-500 mr-1">$</span>
                        <input 
                          type="number" 
                          value={item.price}
                          onChange={(e) => updateItemPrice(item.productId, Math.max(0, Number(e.target.value)))}
                          className="w-full bg-transparent outline-none text-xs font-bold text-slate-200 p-0 focus:ring-0 text-right"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom save/checkout panel */}
            <div className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4 space-y-3 pb-safe shrink-0">
              <div className="flex justify-between items-center text-base font-extrabold text-white px-1">
                <span>Total Cotización</span>
                <span className="text-emerald-400 font-black">{formatCurrency(total)}</span>
              </div>
              <button
                onClick={() => {
                  setIsMobileCartOpen(false);
                  handleSaveQuotation();
                }}
                disabled={!selectedCustomer || quoteItems.length === 0}
                className={cn(
                  "w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer text-center",
                  (!selectedCustomer || quoteItems.length === 0)
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-sky-600 text-white hover:bg-sky-550 shadow-xl shadow-sky-950/20 active:scale-95"
                )}
              >
                {!selectedCustomer 
                  ? "Falta Elegir Cliente" 
                  : quoteItems.length === 0 
                    ? "Carrito Vacío" 
                    : "Generar y Guardar"
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer Modal (Nested in Quotation) */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6 px-1">
                  <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">
                      {editingCustomer ? 'Editar' : 'Nuevo'} Cliente
                    </h2>
                  </div>
                  <button onClick={() => { setIsCustomerModalOpen(false); setEditingCustomer(null); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form 
                  key={editingCustomer ? `edit-${editingCustomer.id}` : `new-${nextCorrelativeCode}`} 
                  id="customerForm" 
                  onSubmit={handleSaveCustomer} 
                  className="space-y-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                       <div>
                         <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Nombre Completo</label>
                         <input name="name" defaultValue={editingCustomer?.name} required className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none transition-all" />
                       </div>
                       <div>
                         <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">RUT o Código (Opcional - Sugerido)</label>
                         <input name="rut" defaultValue={editingCustomer ? editingCustomer.rut : getNextCorrelativeCode()} placeholder="12.345.678-9 o Autogenerado" className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none transition-all" />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <div>
                         <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Teléfono Móvil</label>
                         <input name="phone" type="tel" defaultValue={editingCustomer?.phone} placeholder="+569..." className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none transition-all" />
                       </div>
                       <div>
                         <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Email (Opcional)</label>
                         <input name="email" type="email" defaultValue={editingCustomer?.email} placeholder="ejemplo@correo.com" className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none transition-all" />
                       </div>
                    </div>
                    
                    <div className="md:col-span-2">
                       <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Dirección de Despacho</label>
                       <input 
                         name="address" 
                         defaultValue={editingCustomer?.address} 
                         placeholder="Calle, Número, Comuna"
                         className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none transition-all" 
                       />
                    </div>
                  </div>
 
                  <div className="flex gap-2 pt-2">
                    <button 
                      type="button" 
                      onClick={() => { setIsCustomerModalOpen(false); setEditingCustomer(null); }}
                      className="flex-1 px-4 py-3 md:py-2 text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest hover:text-slate-700 transition-all border border-transparent"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="flex-[2] bg-slate-900 text-white py-3.5 md:py-2.5 rounded-xl md:rounded-lg text-xs font-bold shadow-lg shadow-slate-900/10 active:scale-95 transition-all uppercase"
                    >
                      {editingCustomer ? 'Actualizar Ficha' : 'Guardar Cliente'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Add Product Modal */}
        <AnimatePresence>
          {isProductModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h2 className="text-lg md:text-xl font-bold text-slate-900">Crear Nuevo Producto</h2>
                  <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form onSubmit={handleSaveProduct} className="p-4 md:p-6 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Nombre del Producto</label>
                      <input name="name" required className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">SKU / Código</label>
                      <input 
                        name="sku" 
                        defaultValue={suggestedSku} 
                        key={suggestedSku}
                        required 
                        className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Stock Actual</label>
                      <input name="stock" type="number" defaultValue="0" className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Categoría</label>
                      <select 
                        name="category" 
                        required
                        value={selectedProductCategory}
                        onChange={(e) => setSelectedProductCategory(e.target.value)}
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
                        className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none"
                      >
                        <option value="">Otras</option>
                        {subcategories
                          .filter(sub => {
                            if (!selectedProductCategory) return true;
                            const cat = categories.find(c => c.name === selectedProductCategory);
                            return cat ? sub.category_id === cat.id : true;
                          })
                          .map(sub => (
                            <option key={sub.id} value={sub.name}>{sub.name}</option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">P. Costo</label>
                      <input name="costPrice" type="number" defaultValue="0" className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">P. Venta</label>
                      <input name="price" type="number" defaultValue="0" className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">P. Venta Mayorista</label>
                      <input name="wholesalePrice" type="number" defaultValue="0" className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Cant. Mínima Mayorista</label>
                      <input name="wholesaleMinQty" type="number" defaultValue="0" className="w-full px-3 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-md text-[13px] md:text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setIsProductModalOpen(false)}
                      className="flex-1 px-4 py-3 md:py-2 text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest hover:text-slate-700 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="flex-[2] bg-slate-900 text-white py-3.5 md:py-2.5 rounded-xl md:rounded-lg text-xs font-bold shadow-lg shadow-slate-900/10 active:scale-95 transition-all uppercase"
                    >
                      Guardar Producto
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Customer Selection Modal */}
      <AnimatePresence>
        {isCustomerPickerOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-start md:items-center justify-center p-2 md:p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: -15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white w-full max-w-xl rounded-xl md:rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[95vh] md:max-h-[85vh] mt-1 md:mt-0"
            >
              <div className="p-3 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                <div>
                   <h2 className="text-sm md:text-xl font-black text-slate-800 tracking-tight">Seleccionar Cliente</h2>
                   <p className="text-[10px] md:text-xs text-slate-500 font-medium tracking-wide">Busque un cliente registrado o cree uno nuevo</p>
                </div>
                <button 
                  onClick={() => setIsCustomerPickerOpen(false)} 
                  className="p-1.5 md:p-3 hover:bg-slate-200/50 text-slate-400 rounded-full transition-all cursor-pointer"
                >
                  <X className="w-4 h-4 md:w-6 md:h-6" />
                </button>
              </div>

              <div className="p-3 md:p-8 flex-1 overflow-y-auto">
                <div className="flex gap-1.5 md:gap-2 mb-3 md:mb-6 shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 md:w-5 md:h-5" />
                    <input 
                      type="text"
                      placeholder="Buscar por Nombre, RUT o Email..."
                      className="w-full pl-9 pr-3 py-2 md:pl-12 md:pr-4 md:py-4 bg-slate-50 border border-slate-150 rounded-lg md:rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none font-medium text-xs md:text-sm text-slate-700 placeholder:text-slate-300 transition-all shadow-inner"
                      value={searchCustomer}
                      onChange={(e) => setSearchCustomer(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <button 
                    onClick={() => {
                      setEditingCustomer(null);
                      setIsCustomerModalOpen(true);
                    }}
                    className="p-2 md:p-4 bg-sky-600 text-white rounded-lg md:rounded-2xl shadow-lg hover:bg-sky-700 active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                    title="Nuevo Cliente"
                  >
                    <UserPlus className="w-4 h-4 md:w-6 md:h-6" />
                  </button>
                </div>

                <div className="space-y-1 md:space-y-2">
                  {customers
                    .filter(c => {
                      if (!searchCustomer) return true;
                      const qNorm = normText(searchCustomer);
                      const { mainLabel, subLabel } = getCustomerLabels(c);
                      return normText(c.name).includes(qNorm) || 
                             normText(c.rut).includes(qNorm) || 
                             normText(c.email).includes(qNorm) || 
                             normText(c.address).includes(qNorm) ||
                             normText(mainLabel).includes(qNorm) ||
                             normText(subLabel).includes(qNorm);
                    })
                    .slice(0, 50)
                    .map(c => {
                      const { mainLabel, subLabel } = getCustomerLabels(c);
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setIsCustomerPickerOpen(false);
                          }}
                          className="w-full group hover:bg-slate-50 p-2 md:p-4 border border-slate-50 hover:border-slate-200 rounded-lg md:rounded-2xl transition-all text-left flex items-center justify-between cursor-pointer"
                        >
                           <div className="flex items-center gap-2 md:gap-4">
                             <div className="w-7 h-7 md:w-10 md:h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-extrabold text-[10px] md:text-sm shrink-0 group-hover:bg-sky-100 group-hover:text-sky-600 transition-colors">
                               {mainLabel.charAt(0)}
                             </div>
                             <div className="ml-2.5 min-w-0">
                                <p className="font-bold text-slate-800 text-[11px] md:text-sm truncate leading-tight">{mainLabel}</p>
                                <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">{subLabel}</p>
                             </div>
                           </div>
                           <ChevronRight className="w-3.5 h-3.5 md:w-5 md:h-5 text-slate-200 group-hover:text-slate-400 group-hover:translate-x-1 transition-all shrink-0" />
                        </button>
                      )})}
                  
                  {customers.filter(c => {
                    if (!searchCustomer) return true;
                    const qNorm = normText(searchCustomer);
                    const { mainLabel, subLabel } = getCustomerLabels(c);
                    return normText(c.name).includes(qNorm) || 
                           normText(c.rut).includes(qNorm) || 
                           normText(c.email).includes(qNorm) || 
                           normText(c.address).includes(qNorm) ||
                           normText(mainLabel).includes(qNorm) ||
                           normText(subLabel).includes(qNorm);
                  }).length === 0 && (
                    <div className="text-center py-10 md:py-20 bg-slate-50 rounded-xl md:rounded-[2rem] border border-dashed border-slate-200">
                       <UserPlus className="w-8 h-8 md:w-12 md:h-12 text-slate-200 mx-auto mb-2 md:mb-4" />
                       <p className="text-xs font-bold text-slate-400">No se encontraron clientes coincidentes</p>
                       <p className="text-[8px] md:text-[10px] text-slate-300 uppercase tracking-widest mt-0.5">Intente con otros términos o cree uno nuevo</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transport Modal */}
      <AnimatePresence>
        {isTransportModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 md:p-8"
            >
              <form onSubmit={handleSaveTransport} className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                    <span className="font-black text-slate-800 text-sm uppercase tracking-wider">Transporte</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setIsTransportModalOpen(false)}
                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Valor del Transporte (CLP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">$</span>
                    <input 
                      type="number"
                      placeholder="Ej: 5000"
                      value={transportValue}
                      onChange={(e) => setTransportValue(e.target.value)}
                      required
                      autoFocus
                      className="w-full pl-7 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-850 outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsTransportModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-150 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 bg-sky-600 text-white rounded-xl font-black text-xs hover:bg-sky-700 shadow-md shadow-sky-600/10 transition-all cursor-pointer uppercase tracking-wider"
                  >
                    Agregar
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Alert Modal */}
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
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 text-center p-8"
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {quotationToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden text-center p-8"
            >
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full mx-auto mb-6 flex items-center justify-center">
                <Trash2 className="w-10 h-10" />
              </div>
              
              <h3 className="text-xl font-black text-slate-900 mb-2">¿Eliminar Cotización?</h3>
              <p className="text-sm text-slate-500 mb-8 px-2">
                Esta acción es permanente y no se puede deshacer. Los registros asociados podrían verse afectados.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setQuotationToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteQuotation}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? 'Borrando...' : 'Sí, Borrar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Actions Modal */}
      <AnimatePresence>
        {mobileActionQuotation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMobileActionQuotation(null)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.5 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden p-6 text-left border-t border-slate-100 sm:border-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar for bottom drawer effect on mobile */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                    Opciones de Cotización
                  </span>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-1.5 mt-0.5">
                    Cotización N° {mobileActionQuotation.correlative}
                  </h3>
                </div>
                <button
                  onClick={() => setMobileActionQuotation(null)}
                  className="p-1 px-2.5 py-1 text-slate-400 hover:text-slate-600 rounded-lg bg-slate-50 transition-all font-bold text-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Info */}
              <div className="bg-slate-50 p-4 rounded-2xl mb-5 space-y-2 border border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Cliente:</span>
                  <span className="text-xs font-bold text-slate-900 truncate max-w-[220px]">
                    {(() => {
                      const customer = customers.find(c => c.id === mobileActionQuotation.q.customer_id);
                      const { mainLabel } = getCustomerLabels(customer, mobileActionQuotation.q.customer_name);
                      return mainLabel;
                    })()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">RUT / Adicional:</span>
                  <span className="text-xs font-semibold text-slate-600 truncate max-w-[220px]">
                    {(() => {
                      const customer = customers.find(c => c.id === mobileActionQuotation.q.customer_id);
                      const { subLabel } = getCustomerLabels(customer, mobileActionQuotation.q.customer_name);
                      return subLabel || 'Sin Registro';
                    })()}
                  </span>
                </div>
                <div className="flex justify-between items-center font-mono text-xs">
                  <span className="text-xs text-slate-500 font-sans font-medium">Fecha:</span>
                  <span className="text-slate-700 font-semibold">
                    {new Date(mobileActionQuotation.q.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Total:</span>
                  <span className="text-sm font-black text-slate-900">
                    {formatCurrency(mobileActionQuotation.q.total)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-100/80">
                  <span className="text-xs text-slate-500 font-medium">Estado actual:</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                    mobileActionQuotation.q.status === 'accepted' ? "bg-emerald-100 text-emerald-700" :
                    mobileActionQuotation.q.status === 'rejected' ? "bg-red-100 text-red-700" :
                    "bg-sky-100 text-sky-700"
                  )}>
                    {mobileActionQuotation.q.status}
                  </span>
                </div>
              </div>

              {/* Action Buttons list */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    generatePDF(mobileActionQuotation.q, mobileActionQuotation.correlative);
                    setMobileActionQuotation(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-sky-50 text-sky-700 rounded-2xl font-bold text-xs hover:bg-sky-100 active:scale-98 transition-all"
                >
                  <Printer className="w-5 h-5 text-sky-600" />
                  <span>Imprimir / Descargar PDF</span>
                </button>

                <button
                  onClick={() => {
                    sendWhatsApp(mobileActionQuotation.q);
                    setMobileActionQuotation(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-emerald-50 text-emerald-700 rounded-2xl font-bold text-xs hover:bg-emerald-100 active:scale-98 transition-all"
                >
                  <Send className="w-5 h-5 text-emerald-600" />
                  <span>Enviar por WhatsApp</span>
                </button>

                {mobileActionQuotation.q.status !== 'accepted' && (
                  <>
                    <button
                      onClick={() => {
                        handleAcceptQuote(mobileActionQuotation.q);
                        setMobileActionQuotation(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 bg-blue-50 text-blue-700 rounded-2xl font-bold text-xs hover:bg-blue-100 active:scale-98 transition-all"
                    >
                      <ShoppingCart className="w-5 h-5 text-blue-600" />
                      <span>Confirmar Venta / Cierre</span>
                    </button>

                    <button
                      onClick={() => {
                        handleEditQuotation(mobileActionQuotation.q);
                        setMobileActionQuotation(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-50 text-slate-700 rounded-2xl font-bold text-xs hover:bg-slate-100 active:scale-98 transition-all border border-slate-100"
                    >
                      <Edit2 className="w-5 h-5 text-slate-500" />
                      <span>Editar Cotización</span>
                    </button>
                  </>
                )}

                {mobileActionQuotation.q.status === 'accepted' && (
                  <button
                    onClick={() => {
                      handleResetStatus(mobileActionQuotation.q);
                      setMobileActionQuotation(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 bg-amber-50 text-amber-700 rounded-2xl font-bold text-xs hover:bg-amber-100 active:scale-98 transition-all"
                  >
                    <X className="w-5 h-5 text-amber-600" />
                    <span>Forzar Reinicio a Enviada</span>
                  </button>
                )}

                <div className="pt-2">
                  <button
                    onClick={() => {
                      const qId = mobileActionQuotation.q.id;
                      setMobileActionQuotation(null);
                      setQuotationToDelete(qId);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-2xl font-bold text-xs active:scale-98 transition-all"
                  >
                    <Trash2 className="w-5 h-5 text-rose-600" />
                    <span>Eliminar Cotización permanentemente</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  );
}
