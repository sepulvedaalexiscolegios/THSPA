import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, MapPin, Phone, Mail, Edit2, Trash2, X, Users, Upload } from 'lucide-react';
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

  useEffect(() => {
    fetchCustomers();
    const channel = supabase.channel('customers_all').on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchCustomers()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase.from('customers').select('*').order('name');
      if (error) throw error;
      if (data) setCustomers(data);
    } catch (err: any) {
      console.error('Error fetching customers:', err);
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
        fetchCustomers();
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
    const data = {
      name: formData.get('name') as string,
      rut: formData.get('rut') as string,
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
        const { error } = await supabase.from('customers').insert([data]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      setEditingCustomer(null);
      fetchCustomers();
    } catch (err: any) {
      alert('Error saving customer: ' + err.message);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm('¿Eliminar este cliente?')) return;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      fetchCustomers();
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
      fetchCustomers();
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
        fetchCustomers();
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

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.rut.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Maestro Clientes</h1>
          <p className="text-xs text-slate-500">Gestión de cartera y datos de despacho</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          <input 
            type="file" 
            ref={txtInputRef} 
            onChange={handleImportTXT} 
            accept=".txt" 
            className="hidden" 
          />
          <button 
            onClick={() => txtInputRef.current?.click()}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Importar TXT</span>
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all active:scale-95"
          >
            <Upload className="w-4 h-4 text-slate-400" />
            <span>Excel/CSV</span>
          </button>
          <button 
            onClick={handleClearCustomers}
            className="flex items-center gap-2 bg-slate-50 text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-50 border border-slate-200 transition-all active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>Vaciar</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-sky-900/10 hover:bg-sky-700 transition-all active:scale-95"
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
          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((c) => (
          <motion.div 
            layout
            key={c.id} 
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="w-8 h-8 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
                <Users className="w-4 h-4" />
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => { setEditingCustomer(c); setIsModalOpen(true); }}
                  className="p-1 px-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-all"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => handleDeleteCustomer(c.id)}
                  className="p-1 px-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            
            <h3 className="text-sm font-black text-slate-800 truncate mb-0.5">{c.name}</h3>
            <p className="text-[10px] font-mono text-slate-400 mb-3 tracking-tighter uppercase">{formatCLPRUT(c.rut)}</p>
            
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                <Phone className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="truncate">{c.phone || "N/A"}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                <Mail className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="truncate">{c.email || "N/A"}</span>
              </div>
              <div className="flex items-start gap-2 text-[11px] text-slate-600 font-medium">
                <MapPin className="w-3 h-3 text-slate-300 shrink-0 mt-0.5" />
                <span className="line-clamp-2 leading-tight">{c.address || "N/A"}</span>
              </div>
            </div>
            
            {c.address && (
              <div className="mt-3 pt-2 border-t border-slate-50 flex justify-between items-center">
                <span className="text-[9px] uppercase tracking-widest font-bold text-slate-300">
                  Data Registrada
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

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
                
                <form id="customerForm" onSubmit={handleSaveCustomer} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Nombre Completo</label>
                        <input name="name" defaultValue={editingCustomer?.name} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-sky-500 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">RUT Chileno o Código</label>
                        <input name="rut" defaultValue={editingCustomer?.rut} required placeholder="12.345.678-9" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-sky-500 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Teléfono Móvil</label>
                        <input name="phone" type="tel" defaultValue={editingCustomer?.phone} placeholder="+56 9 1234 5678" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-sky-500 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Email</label>
                        <input name="email" type="email" defaultValue={editingCustomer?.email} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-sky-500 outline-none transition-all" />
                      </div>
                    </div>
                    
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Dirección de Despacho</label>
                        <input 
                          name="address" 
                          defaultValue={editingCustomer?.address} 
                          placeholder="Calle, Número, Departamento, Comuna"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-sky-500 outline-none transition-all" 
                        />
                      </div>
                    </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button" 
                      onClick={() => { setIsModalOpen(false); setEditingCustomer(null); }}
                      className="flex-1 px-4 py-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:text-slate-700 transition-all border border-transparent"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="flex-3 bg-slate-900 text-white py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-slate-900/10 active:scale-95 transition-all"
                    >
                      {editingCustomer ? 'Actualizar Ficha' : 'Registrar Cliente'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
