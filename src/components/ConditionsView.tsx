import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, FileText } from 'lucide-react';
import { motion } from 'motion/react';

export function ConditionsView() {
  const [generalConditions, setGeneralConditions] = useState('');
  const [isSavingConditions, setIsSavingConditions] = useState(false);

  useEffect(() => {
    const savedConditions = localStorage.getItem('general_conditions') || localStorage.getItem('commercial_conditions');
    if (savedConditions) setGeneralConditions(savedConditions);
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('settings').select('*').eq('key', 'general_conditions').single();
      if (data) {
        setGeneralConditions(data.value);
        localStorage.setItem('general_conditions', data.value);
      }
    } catch (e) {
      console.log('Settings table not found or accessible, using localStorage');
    }
  };

  const handleSaveConditions = async () => {
    setIsSavingConditions(true);
    localStorage.setItem('general_conditions', generalConditions);
    try {
      const { error } = await supabase.from('settings').upsert({ key: 'general_conditions', value: generalConditions }, { onConflict: 'key' });
      if (error) throw error;
      alert('Condiciones guardadas correctamente en la nube.');
    } catch (e) {
      alert('Guardado localmente (Tabla "settings" no disponible en Supabase).');
    } finally {
      setIsSavingConditions(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Condiciones Generales</h2>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Configuración de mensajes para cotizaciones PDF</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-8 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100 rounded-xl">
              <FileText className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Editor de Condiciones</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Personalice el pie de página de sus documentos</p>
            </div>
          </div>
          <button 
            onClick={handleSaveConditions}
            disabled={isSavingConditions}
            className="px-6 py-2 bg-sky-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-600 transition-all shadow-lg shadow-sky-900/10 flex items-center gap-2 disabled:opacity-50 active:scale-95"
          >
            <Save className="w-4 h-4" /> {isSavingConditions ? 'Guardando...' : 'Guardar Condiciones'}
          </button>
        </div>
        <div className="p-8">
          <textarea 
            value={generalConditions}
            onChange={(e) => setGeneralConditions(e.target.value)}
            placeholder="Ej: - Los precios incluyen IVA. - Validez de oferta: 5 días. - Tiempo de entrega: 24-48 horas hábiles."
            className="w-full h-64 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-sky-500 outline-none resize-none transition-all shadow-inner"
          />
          <div className="flex items-center gap-2 mt-4 px-2">
            <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse" />
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
              Este texto aparecerá al pie de página en todas las cotizaciones PDF con fuente reducida.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
