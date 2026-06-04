import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Transport } from '../types';
import { Plus, Trash2, Edit2, Truck, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function TransportsView() {
  const [transports, setTransports] = useState<Transport[]>([]);
  const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);
  const [editingTransport, setEditingTransport] = useState<Transport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const { data, error } = await supabase.from('transports').select('*').order('name');
      if (error) throw error;
      setTransports(data || []);
    } catch (err: any) {
      console.error('Error fetching:', err);
      setErrorMsg(err.message || 'Error al conectar con la base de datos');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeDefaults = async () => {
    const defaults = ['Bluexpress', 'Starken', 'Correos de Chile', 'Th SpA'];
    try {
      setLoading(true);
      const { error } = await supabase.from('transports').insert(defaults.map(name => ({ name })));
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      alert('Error inicializando: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTransport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;

    try {
      setErrorMsg(null);
      if (editingTransport) {
        const { error } = await supabase.from('transports').update({ name }).eq('id', editingTransport.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('transports').insert([{ name }]);
        if (error) throw error;
      }
      setIsTransportModalOpen(false);
      setEditingTransport(null);
      fetchData();
    } catch (err: any) {
      setErrorMsg('Error al guardar: ' + err.message);
    }
  };

  const handleDeleteTransport = async (id: string) => {
    try {
      setErrorMsg(null);
      const { error } = await supabase.from('transports').delete().eq('id', id);
      
      if (error) throw error;

      setTransports(prev => prev.filter(t => t.id !== id));
      setDeleteId(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      setErrorMsg('No se pudo eliminar: ' + err.message);
      setDeleteId(null);
      fetchData();
    }
  };

  if (loading && transports.length === 0) {
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
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Gestión de Transportes</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Configuración de medios de envío para etiquetas</p>
        </div>
        <button 
          onClick={fetchData}
          className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          title="Refrescar datos"
        >
          <Truck className="w-5 h-5" />
        </button>
      </div>

      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-2xl text-xs font-bold flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
             {errorMsg}
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-red-100 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Transportes Activos</h3>
          </div>
          <button 
            onClick={() => {
              setEditingTransport(null);
              setIsTransportModalOpen(true);
            }}
            className="p-1 px-3 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Agregar Transporte
          </button>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {transports.map((trans) => (
              <div key={trans.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-sky-200 hover:bg-white transition-all shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <Truck className="w-4 h-4 text-sky-500" />
                  </div>
                  <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{trans.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      setEditingTransport(trans);
                      setIsTransportModalOpen(true);
                    }}
                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setDeleteId(trans.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {transports.length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center gap-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No hay transportes configurados</p>
                <button 
                  onClick={handleInitializeDefaults}
                  className="px-6 py-3 bg-sky-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-600 transition-all shadow-lg shadow-sky-900/10 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Cargar Transportes por Defecto
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deletion Confirmation Modal */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setDeleteId(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 border border-slate-200 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">¿Eliminar transporte?</h3>
              <p className="text-sm font-medium text-slate-500 mb-8">
                Esta acción no se puede deshacer. Los bultos ya impresos mantendrán su nombre, pero este transporte ya no aparecerá en ventas futuras.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleDeleteTransport(deleteId)}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-900/10 active:scale-95"
                >
                  Sí, Eliminar
                </button>
                <button 
                  onClick={() => setDeleteId(null)}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transport Modal */}
      <AnimatePresence>
        {isTransportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTransportModalOpen(false)}
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
                    {editingTransport ? 'Editar Transporte' : 'Nuevo Transporte'}
                  </h3>
                  <button onClick={() => setIsTransportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleSaveTransport}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Nombre del Transporte</label>
                      <input 
                        name="name" 
                        defaultValue={editingTransport?.name}
                        required 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-1 focus:ring-sky-500 outline-none" 
                        placeholder="Ej: Starken, Bluexpress..."
                        autoFocus
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-bold shadow-lg shadow-slate-900/10 mt-6 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Guardar Transporte
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
