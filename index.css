import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, MapPin, Phone, Mail, Edit2, Trash2, X, Users, Upload, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Customer } from '../types';
import { formatCLPRUT, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import React from 'react';
import * as XLSX from 'xlsx';

export function CustomerView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const txtInputRef = useRef<HTMLInputElement>(null);

  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(100);
  const [nextCorrelativeCode, setNextCorrelativeCode] = useState('2368');
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const isImportingRef = useRef(false);
  const searchTermRef = useRef('');

  // Sorting state
  const [sortField, setSortField] = useState<'name' | 'rut' | 'phone' | 'email' | 'address'>('name');
  const [sortAscending, setSortAscending] = useState<boolean>(true);

  const sortFieldRef = useRef(sortField);
  const sortAscendingRef = useRef(sortAscending);

  useEffect(() => {
    sortFieldRef.current = sortField;
  }, [sortField]);

  useEffect(() => {
    sortAscendingRef.current = sortAscending;
  }, [sortAscending]);

  useEffect(() => {
    isImportingRef.current = isImporting;
  }, [isImporting]);

  useEffect(() => {
    searchTermRef.current = searchTerm;
  }, [searchTerm]);

  const loadNextCorrelative = async () => {
    try {
      const rutsSet = new Set<string>();

      // 1. Get exact total count of customers in the database
      const { count, error: countError } = await supabase
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

  const fetchCustomers = async (
    search: string = '', 
    currentLimit: number = 100,
    sortBy: 'name' | 'rut' | 'phone' | 'email' | 'address' = 'name',
    isAsc: boolean = true
  ) => {
    try {
      let query = supabase.from('customers').select('*', { count: 'exact' });
      
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        // Build term search
        const term = `%${trimmedSearch}%`;
        query = query.or(`name.ilike.${term},rut.ilike.${term},address.ilike.${term}`);
      }
      
      const { data, error, count } = await query
        .order(sortBy, { ascending: isAsc })
        .range(0, currentLimit - 1);

      if (error) throw error;
      if (data) {
        setCustomers(data);
        if (count !== null) setTotalCount(count);
      }
    } catch (err: any) {
      console.error('Error fetching customers:', err);
    }
  };

  useEffect(() => {
    loadNextCorrelative();
    
    // Initial fetch
    fetchCustomers('', 100, sortField, sortAscending);

    const channel = supabase.channel('customers_all').on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
      if (!isImportingRef.current) {
        fetchCustomers(searchTermRef.current, limit, sortFieldRef.current, sortAscendingRef.current);
        loadNextCorrelative();
      }
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Debouncing search term input
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setLimit(100);
      fetchCustomers(searchTerm, 100, sortField, sortAscending);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Effect to handle changes in sorting options
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchCustomers(searchTerm, limit, sortField, sortAscending);
  }, [sortField, sortAscending]);

  const handleSort = (field: 'name' | 'rut' | 'phone' | 'email' | 'address') => {
    if (sortField === field) {
      setSortAscending(!sortAscending);
    } else {
      setSortField(field);
      setSortAscending(true);
    }
  };

  const getNextCorrelativeCode = () => {
    return nextCorrelativeCode;
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
        
        console.log('TXT Lines:', lines.length);

        if (lines.length === 0) {
          alert('El archivo está vacío.');
          setIsImporting(false);
          return;
        }

        const CHUNK_SIZE = 100;
        let importedCount = 0;
        
        // Deduplicate all lines first to avoid "ON CONFLICT" errors with duplicates in same batch
        const uniqueCustomers = new Map();
        lines.forEach(line => {
          const separator = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
          const parts = line.split(separator).map(p => p.trim());
          const rut = parts[1] || `TEMP-${Math.random().toString(36).substr(2, 9)}`;
          
          // Swapped mapping per user request: [Nombre, RUT, Direccion, Telefono, Email]
          let address = parts[2] || '';
          let phone = parts[3] || '';
          let email = parts[4] || '';

          // Heuristic: If we find an '@' in any column, that's definitely the email
          const findEmailIndex = parts.findIndex(p => p.includes('@'));
          if (findEmailIndex !== -1) {
            const foundEmail = parts[findEmailIndex];
            // If the @ was in the column we assigned as address (index 2), we swap them
            if (findEmailIndex === 2) {
              address = email; // take what was in parts[4]
              email = foundEmail;
            } else {
              email = foundEmail;
            }
          }

          uniqueCustomers.set(rut.toLowerCase(), {
            name: parts[0] || 'Sin Nombre',
            rut: rut,
            email: email,
            phone: phone,
            address: address,
            coordinates: null
          });
        });

        const customerList = Array.from(uniqueCustomers.values());

        for (let i = 0; i < customerList.length; i += CHUNK_SIZE) {
          const toUpsert = customerList.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from('customers').upsert(toUpsert, { onConflict: 'rut' });
          if (error) throw error;

          importedCount += toUpsert.length;
          setImportProgress(Math.round((importedCount / customerList.length) * 100));
        }

        alert(`${importedCount} clientes únicos importados/actualizados con éxito.`);
        if (txtInputRef.current) txtInputRef.current.value = '';
        fetchCustomers(searchTerm, limit, sortField, sortAscending);
      } catch (err: any) {
        alert('Error al importar TXT: ' + err.message);
      } finally {
        setIsImporting(false);
        setImportProgress(0);
      }
    };
    reader.readAsText(file);
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
      coordinates: editingCustomer?.coordinates || null,
    };

    try {
      if (editingCustomer) {
        const { error } = await supabase.from('customers').update(data).eq('id', editingCustomer.id);
        if (error) throw error;
      } else {
        let success = false;
        let attempt = 0;
        let currentRut = data.rut;
        let errToThrow = null;

        while (!success && attempt < 5) {
          const { error } = await supabase.from('customers').insert([{ ...data, rut: currentRut }]);
          if (!error) {
            success = true;
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
      }
      setIsModalOpen(false);
      setEditingCustomer(null);
      fetchCustomers(searchTerm, limit, sortField, sortAscending);
      loadNextCorrelative();
    } catch (err: any) {
      alert('Error saving customer: ' + err.message);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      fetchCustomers(searchTerm, limit, sortField, sortAscending);
    } catch (err: any) {
      alert('Error al eliminar cliente: ' + err.message);
    }
  };

  const handleClearCustomers = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar TODO el maestro de clientes? Esta acción no se puede deshacer.')) return;
    
    try {
      const { error } = await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      alert('Maestro de clientes vaciado con éxito.');
      fetchCustomers(searchTerm, limit, sortField, sortAscending);
    } catch (err: any) {
      alert('Error clearing customers: ' + err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo es demasiado grande (máx 10MB).');
      return;
    }

    console.log('Iniciando lectura de archivo:', file.name);
    setIsImporting(true);
    setImportProgress(0);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result;
        if (!arrayBuffer) throw new Error("No se pudo leer el archivo");

        console.log('Archivo leído, procesando con XLSX...');
        const data = new Uint8Array(arrayBuffer as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

        console.log('Datos extraídos:', jsonData.length, 'filas');

        if (jsonData.length === 0) {
          alert('El archivo está vacío o no tiene el formato correcto.');
          setIsImporting(false);
          return;
        }

        if (jsonData.length > 2000) {
          if (!window.confirm(`Está intentando importar ${jsonData.length} clientes. ¿Desea continuar?`)) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            setIsImporting(false);
            return;
          }
        }

        setImportProgress(10);

        const CHUNK_SIZE = 50;
        let importedCount = 0;

        // Deduplicate global list by RUT to prevent "ON CONFLICT" errors
        const uniqueEntries = new Map();
        jsonData.forEach((row) => {
          const getValue = (keys: string[], fallback: any = '') => {
            const key = keys.find(k => row[k] !== undefined && row[k] !== null);
            return key !== undefined ? row[key] : fallback;
          };

          const rut = String(getValue(['RUT', 'rut', 'Rut', 'Identificacion', 'id', 'ID', 'Codigo', 'codigo', 'DNI'], `TEMP-${Math.random().toString(36).substr(2, 9)}`));
          
          uniqueEntries.set(rut.toLowerCase().trim(), {
            name: String(getValue(['Nombre', 'nombre', 'Name', 'name', 'Cliente', 'cliente', 'Customer', 'customer', 'FullName', 'RAZON SOCIAL'], 'Sin Nombre')),
            rut: rut,
            email: String(getValue(['Email', 'email', 'Correo', 'correo', 'E-mail', 'MAIL', 'Mail'], '')),
            phone: String(getValue(['Telefono', 'telefono', 'Phone', 'phone', 'Celular', 'celular', 'TEL', 'Tel'], '')),
            address: String(getValue(['Direccion', 'direccion', 'Address', 'address', 'Ubicacion', 'home', 'DESPACHO', 'CIUDAD', 'DIRECCION DE DESPACHO', 'Dirección Despacho'], '')),
            coordinates: null,
          });
        });

        const dedupedData = Array.from(uniqueEntries.values());

        for (let i = 0; i < dedupedData.length; i += CHUNK_SIZE) {
          const toUpsert = dedupedData.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from('customers').upsert(toUpsert, { onConflict: 'rut' });
          if (error) {
            console.error('Batch error:', error);
            throw error;
          }
          importedCount += toUpsert.length;
          setImportProgress(Math.round((importedCount / dedupedData.length) * 100));
        }

        alert(`${importedCount} clientes únicos importados/actualizados con éxito.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchCustomers(searchTerm, limit, sortField, sortAscending);
      } catch (err: any) {
        console.error('Import error:', err);
        alert('Error al importar clientes: ' + (err.message || 'Error desconocido'));
      } finally {
        setIsImporting(false);
        setImportProgress(0);
      }
    };
    reader.onerror = () => alert('Error al leer el archivo');
    reader.readAsArrayBuffer(file);
  };

  const displayedCustomers = customers;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight uppercase">Maestro Clientes</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 px-1">Gestión de cartera y datos de despacho</p>
        </div>
        <div className="flex justify-center sm:justify-end">
          <button 
            onClick={() => {
              setEditingCustomer(null);
              loadNextCorrelative();
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-sky-600 text-white px-4 py-2.5 rounded-xl sm:rounded-lg text-xs font-bold shadow-lg shadow-sky-900/10 hover:bg-sky-700 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input 
          type="text" 
          placeholder="Buscar por RUT, Nombre o Dirección..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-3 sm:py-2 bg-white border border-slate-200 rounded-lg sm:rounded-md text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl md:rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100/80">
                <th 
                  onClick={() => handleSort('rut')}
                  className="px-4 py-3 text-[10px] uppercase font-black tracking-widest text-slate-400 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group"
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>RUT / Código</span>
                    <span className="inline-flex">
                      {sortField === 'rut' ? (
                        sortAscending ? <ChevronUp className="w-3.5 h-3.5 text-sky-600" /> : <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 text-[10px] uppercase font-black tracking-widest text-slate-400 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group"
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Nombre Cliente</span>
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
                  onClick={() => handleSort('phone')}
                  className="px-4 py-3 text-[10px] uppercase font-black tracking-widest text-slate-400 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group"
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Teléfono</span>
                    <span className="inline-flex">
                      {sortField === 'phone' ? (
                        sortAscending ? <ChevronUp className="w-3.5 h-3.5 text-sky-600" /> : <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('email')}
                  className="px-4 py-3 text-[10px] uppercase font-black tracking-widest text-slate-400 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group"
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Email</span>
                    <span className="inline-flex">
                      {sortField === 'email' ? (
                        sortAscending ? <ChevronUp className="w-3.5 h-3.5 text-sky-600" /> : <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('address')}
                  className="px-4 py-3 text-[10px] uppercase font-black tracking-widest text-slate-400 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group"
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Dirección de Despacho</span>
                    <span className="inline-flex">
                      {sortField === 'address' ? (
                        sortAscending ? <ChevronUp className="w-3.5 h-3.5 text-sky-600" /> : <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 text-[10px] uppercase font-black tracking-widest text-slate-400 text-center w-28 select-none">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors text-xs">
                  <td className="px-4 py-3.5 font-mono font-bold text-slate-500 whitespace-nowrap uppercase">
                    {c.rut ? c.rut.toUpperCase() : ''}
                  </td>
                  <td className="px-4 py-3.5 font-black text-slate-900 truncate max-w-[180px]">
                    {c.name}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 font-medium whitespace-nowrap">
                    {c.phone || <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 font-medium truncate max-w-[160px]">
                    {c.email || <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 font-medium leading-relaxed truncate max-w-[220px]">
                    {c.address || <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        onClick={() => { setEditingCustomer(c); setIsModalOpen(true); }}
                        className="p-1 px-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-all font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button 
                        onClick={() => setCustomerToDelete(c)}
                        className="p-1 px-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {displayedCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-bold uppercase tracking-wider text-xs">
                    No se encontraron clientes registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalCount > limit && (
        <div className="flex justify-center items-center gap-3 pt-6 flex-wrap">
          <button 
            type="button"
            onClick={() => {
              const newLimit = limit + 100;
              setLimit(newLimit);
              fetchCustomers(searchTerm, newLimit, sortField, sortAscending);
            }}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-750 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            Cargar más clientes ({totalCount - limit} restantes)
          </button>
          
          <button 
            type="button"
            onClick={() => {
              setLimit(totalCount);
              fetchCustomers(searchTerm, totalCount, sortField, sortAscending);
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
              className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6 px-1">
                  <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">
                      {editingCustomer ? 'Editar' : 'Nuevo'} Cliente
                    </h2>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-0.5">Cartera de Clientes v4.2</p>
                  </div>
                  <button onClick={() => { setIsModalOpen(false); setEditingCustomer(null); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-all">
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
                      onClick={() => { setIsModalOpen(false); setEditingCustomer(null); }}
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

      <AnimatePresence>
        {customerToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden border border-slate-200 p-6 text-center"
            >
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600 animate-pulse" />
              </div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-wide mb-2">¿Eliminar Cliente?</h3>
              <p className="text-xs text-slate-500 font-bold mb-6">
                ¿Está seguro de que desea eliminar a <span className="text-slate-800 font-extrabold">{customerToDelete.name}</span>? esta acción no se puede deshacer.
              </p>
              
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setCustomerToDelete(null)}
                  className="flex-1 py-2.5 text-slate-500 hover:text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    const id = customerToDelete.id;
                    setCustomerToDelete(null);
                    await handleDeleteCustomer(id);
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
