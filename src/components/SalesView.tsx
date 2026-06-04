import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Printer, Package, ChevronRight, Filter, Download, Trash2 } from 'lucide-react';
import { Sale, Customer, Transport, Product } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, X, Save, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import React from 'react';

export function SalesView() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transports, setTransports] = useState<Transport[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedSaleForLabel, setSelectedSaleForLabel] = useState<Sale | null>(null);

  useEffect(() => {
    fetchData();
    const sChannel = supabase.channel('sales_all').on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => fetchData()).subscribe();
    const cChannel = supabase.channel('customers_all').on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchData()).subscribe();
    const tChannel = supabase.channel('transports_all').on('postgres_changes', { event: '*', schema: 'public', table: 'transports' }, () => fetchData()).subscribe();
    return () => {
      supabase.removeChannel(sChannel);
      supabase.removeChannel(cChannel);
      supabase.removeChannel(tChannel);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Need both sales and quotations to find correlatives
      const [sRes, qRes, cRes, tRes] = await Promise.all([
        supabase.from('sales').select('*').order('date', { ascending: false }),
        supabase.from('quotations').select('*').order('date', { ascending: false }),
        supabase.from('customers').select('*').order('name'),
        supabase.from('transports').select('*').order('name')
      ]);
      
      if (sRes.data) setSales(sRes.data);
      if (qRes.data) {
        // We'll use this to find the quotation number
      }
      if (cRes.data) setCustomers(cRes.data);
      if (tRes.data) setTransports(tRes.data);
    } catch (error) {
      console.warn('Error fetching data in SalesView:', error);
    }
  };

  // Helper to get numeric correlatives like in QuotationView
  const getQuoteNumber = (quoteId: string) => {
    // We need to fetch all quotations to know the position
    // Since we just did it in fetchData (but didn't store it yet)
    // Let's store it or just fetch it here if needed.
    // For now, let's assume we store them in a state.
  };

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  const monthlySales = sales.filter(s => {
    const saleDate = new Date(s.date);
    return isWithinInterval(saleDate, { start: monthStart, end: monthEnd });
  });

  const totalRevenue = monthlySales.reduce((acc, s) => acc + s.total, 0);

  const handlePrintLabel = async (sale: Sale, transportName?: string) => {
    if (!transportName) {
      setSelectedSaleForLabel(sale);
      setIsTransportModalOpen(true);
      return;
    }

    // Get all quotations to find numeric correlative
    const { data: allQuotes } = await supabase.from('quotations').select('id').order('date', { ascending: false });
    const quoteIndex = allQuotes?.findIndex(q => q.id === sale.quotation_id) ?? -1;
    const quoteCorrelative = quoteIndex !== -1 ? 20100 + (allQuotes!.length - quoteIndex) : 'S/N';

    // Get all sales to find numeric correlative
    const { data: allSales } = await supabase.from('sales').select('id').order('date', { ascending: false });
    const saleIndex = allSales?.findIndex(s => s.id === sale.id) ?? -1;
    const saleCorrelative = saleIndex !== -1 ? 5000 + (allSales!.length - saleIndex) : 'S/N';

    const saleCustomer = customers.find(c => c.id === sale.customer_id);
    
    // Robust Chilean RUT detection: Numeric, points, hyphens, and can end in 'K'
    const looksLikeRut = (str: string) => {
      const clean = (str || '').replace(/[.-]/g, '');
      return /^[0-9]+[0-9kK]?$/.test(clean) && clean.length >= 7 && clean.length <= 10;
    };

    let displayCustomerName = saleCustomer?.name || 'Cliente';
    let displayCustomerRut = saleCustomer?.rut || 'N/A';

    // If they are swapped in database, swap them back for display
    if (looksLikeRut(displayCustomerName) && !looksLikeRut(displayCustomerRut)) {
      const temp = displayCustomerName;
      displayCustomerName = displayCustomerRut;
      displayCustomerRut = temp;
    }

    // Company Details
    const company = {
      name: "TH SpA",
      rut: "77.042.984-6",
      address: "DE LAS ALONDRAS 11259, LA FLORIDA, SANTIAGO",
      phone: "+569 717 44 262",
      email: "contacto@thspa.cl"
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html lang="es">
        <head>
          <title>Etiqueta de Envío</title>
          <style>
            @page { size: letter; margin: 0; }
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0;
              padding: 0.5cm;
              width: 16.2cm; /* 3/4 width of letter page */
              height: 9.3cm; /* Roughly 1/3 of the page height */
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              border-bottom: 2px dashed #ccc;
            }
            .label-content {
              border: 3px solid black;
              padding: 0.4cm;
              flex: 1;
              display: flex;
              gap: 0.4cm;
              overflow: hidden;
            }
            .left-col { flex: 1.2; min-width: 0; display: flex; flex-direction: column; }
            .packing-col { width: 5.5cm; border-left: 1px dashed #ccc; padding-left: 0.3cm; overflow: hidden; display: flex; flex-direction: column; }
            
            h1 { margin: 0; font-size: 14pt; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            h2 { margin: 6pt 0 2pt 0; font-size: 9pt; font-weight: 900; background: #eee; padding: 1pt 4pt; }
            p { 
              margin: 1pt 0; 
              font-size: 8.5pt; 
              line-height: 1.1; 
              text-transform: uppercase; 
              overflow-wrap: break-word;
              hyphens: auto;
              -webkit-hyphens: auto;
            }
            .transport-badge { 
              display: inline-block; 
              background: black; 
              color: white; 
              padding: 3pt 6pt; 
              font-size: 9pt; 
              font-weight: 900; 
              margin-top: 4pt;
              margin-bottom: 4pt;
              width: 100%;
              box-sizing: border-box;
              text-align: center;
            }
            .meta-section {
              margin-top: auto;
              border-top: 2px solid black;
              padding-top: 4pt;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .packing-item {
              display: flex;
              justify-content: space-between;
              gap: 4pt;
              border-bottom: 1px solid #f0f0f0;
              padding: 2pt 0;
            }
            .packing-item span {
              font-size: 7pt;
              font-weight: 700;
              text-transform: uppercase;
            }
            .packing-header {
              font-size: 8pt;
              font-weight: 900;
              margin-bottom: 4pt;
              text-align: center;
              border-bottom: 1px solid black;
              padding-bottom: 2pt;
            }
          </style>
        </head>
        <body>
          <div class="label-content">
            <div class="left-col">
              <h1>${company.name}</h1>
              
              <div style="display: flex; gap: 0.5cm;">
                <div style="flex: 1;">
                  <h2>REMITENTE</h2>
                  <p>RUT: ${company.rut}</p>
                  <p>DIR: ${company.address.slice(0, 40)}...</p>
                  <p>TEL: ${company.phone}</p>
                </div>
                <div style="width: 4cm; text-align: center;">
                   <div class="transport-badge">${transportName}</div>
                   <p style="font-weight: 900; font-size: 7pt;">OV: #${saleCorrelative}</p>
                   <p style="font-size: 7pt;">COT: #${quoteCorrelative}</p>
                </div>
              </div>
              
              <div style="margin: 0.2cm 0;"></div>

              <h2>DESTINATARIO</h2>
              <p style="font-size: 11pt; font-weight: 900;">${displayCustomerName}</p>
              <p>RUT: ${displayCustomerRut}</p>
              <p style="font-weight: 700;">DIRECCIÓN: ${saleCustomer?.address || 'N/A'}</p>
              <p>TELÉFONO: ${saleCustomer?.phone || 'N/A'}</p>
              
              <div class="meta-section">
                <div>
                  <p style="font-size: 7pt; color: #666;">FECHA: ${format(new Date(sale.date), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <div style="text-align: right;">
                   <p style="font-weight: 900; font-size: 8pt;">Bulto 1 de 1</p>
                </div>
              </div>
            </div>
            
            <div class="packing-col">
              <div class="packing-header">PACKING LIST</div>
              <div style="flex: 1; overflow: hidden;">
                ${sale.items.map(item => `
                  <div class="packing-item">
                    <span style="flex: 1;">${item.name}</span>
                    <span style="white-space: nowrap;">x${item.qty}</span>
                  </div>
                `).join('')}
              </div>
              <div style="font-size: 7pt; font-weight: 900; border-top: 1px solid black; padding-top: 2pt; text-align: right;">
                TOTAL ITEMS: ${sale.items.reduce((acc, i) => acc + i.qty, 0)}
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    setIsTransportModalOpen(false);
    printWindow.print();
  };

  const handleDeleteSale = async () => {
    if (!saleToDelete) return;

    setIsDeleting(true);
    try {
      // 1. If it has a quotation_id, reactivate the quotation
      if (saleToDelete.quotation_id) {
        console.log('Reverting quotation status:', saleToDelete.quotation_id);
        const { error: quoteError } = await supabase
          .from('quotations')
          .update({ status: 'sent' })
          .eq('id', saleToDelete.quotation_id);
        
        if (quoteError) {
          console.error('Error reverting quotation status:', quoteError);
          // We might want to warn the user but continue or stop?
          // For now, let's stop and inform if it's a critical error
          throw new Error('No se pudo reactivar la cotización: ' + quoteError.message);
        }
      }

      // 2. Restore Inventory Stock
      console.log('Restoring stock for items:', saleToDelete.items.length);
      for (const item of saleToDelete.items) {
        if (item.sku) {
          const { data: productData, error: fetchError } = await supabase
            .from('products')
            .select('stock')
            .eq('sku', item.sku)
            .single();

          if (productData && !fetchError) {
            const { error: updateError } = await supabase
              .from('products')
              .update({ stock: (productData.stock || 0) + item.qty })
              .eq('sku', item.sku);
            
            if (updateError) console.warn('Error updating stock for row:', item.sku, updateError);
          }
        }
      }

      // 3. Delete the Sale
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleToDelete.id);

      if (deleteError) throw deleteError;

      setIsDeleteModalOpen(false);
      setSaleToDelete(null);
      await fetchData();
    } catch (err: any) {
      console.error('Final error in handleDeleteSale:', err);
      alert('Error en la operación: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Ventas y Reportes</h1>
          <p className="text-xs text-slate-500">Análisis trimestral y operaciones de envío</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="month" 
            value={format(selectedMonth, 'yyyy-MM')}
            onChange={(e) => setSelectedMonth(new Date(e.target.value + '-01'))}
            className="px-3 py-2 bg-white border border-slate-200 rounded-md text-xs font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button className="bg-slate-800 text-white p-2 rounded-md hover:bg-slate-900 transition-all">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Performance Card */}
        <div className="bg-[#1E293B] text-white rounded-xl p-6 relative overflow-hidden shadow-lg border border-slate-700">
           <TrendingUp className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
           <div className="relative z-10 flex flex-col h-full justify-between">
             <div>
               <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-2">Ventas {format(selectedMonth, 'MMMM yyyy', { locale: es })}</p>
               <h2 className="text-3xl font-black mb-6">{formatCurrency(totalRevenue)}</h2>
             </div>
             
             <div className="grid grid-cols-2 gap-3 mt-auto">
               <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                 <p className="text-[10px] text-slate-400 mb-1 font-bold">OPERACIONES</p>
                 <p className="text-lg font-black">{monthlySales.length}</p>
               </div>
               <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                 <p className="text-[10px] text-slate-400 mb-1 font-bold">TICKET AVG</p>
                 <p className="text-lg font-black">
                   {monthlySales.length > 0 ? formatCurrency(totalRevenue / monthlySales.length) : '$0'}
                 </p>
               </div>
             </div>
           </div>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
           <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
             <Filter className="w-4 h-4" /> Logística de Despachos
           </h3>
           <div className="space-y-4">
              {[
                { label: 'Pendientes', count: monthlySales.filter(s => s.status === 'paid').length, color: 'bg-sky-500' },
                { label: 'En Tránsito', count: monthlySales.filter(s => s.status === 'shipping').length, color: 'bg-amber-500' },
                { label: 'Entregados', count: monthlySales.filter(s => s.status === 'delivered').length, color: 'bg-emerald-500' },
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600">{item.label}</span>
                    <span className="text-[11px] font-black">{item.count}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-500", item.color)} 
                      style={{ width: `${monthlySales.length > 0 ? (item.count / monthlySales.length) * 100 : 0}%` }} 
                    />
                  </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Historial Operativo</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                <th className="px-4 py-3">ID / Fecha</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Monto Total</th>
                <th className="px-4 py-3">Carga</th>
                <th className="px-4 py-3 text-right">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {monthlySales.map((s) => {
                const customer = customers.find(c => c.id === s.customer_id);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-[11px] font-black text-slate-800">{format(new Date(s.date), 'dd MMM, HH:mm', { locale: es })}</div>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const looksLikeRut = (str: string) => {
                          const clean = (str || '').replace(/[.-]/g, '');
                          return /^[0-9]+[0-9kK]?$/.test(clean) && clean.length >= 7 && clean.length <= 10;
                        };

                        let name = customer?.name || 'Inexistente';
                        let rut = customer?.rut || '';

                        if (looksLikeRut(name) && !looksLikeRut(rut)) {
                          const temp = name;
                          name = rut;
                          rut = temp;
                        }

                        return (
                          <>
                            <p className="text-xs font-bold text-slate-700">{name}</p>
                            <p className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">{rut}</p>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{formatCurrency(s.total)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded font-bold text-slate-500 uppercase tracking-wider">
                        {s.items.length} SKUS
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button 
                        onClick={() => handlePrintLabel(s)}
                        className="bg-white border border-slate-200 text-slate-600 p-1.5 rounded hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                        title="Imprimir Etiqueta"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => {
                          setSaleToDelete(s);
                          setIsDeleteModalOpen(true);
                        }}
                        className="bg-white border border-slate-200 text-red-500 p-1.5 rounded hover:bg-red-500 hover:text-white transition-all shadow-sm"
                        title="Eliminar Venta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {monthlySales.length === 0 && (
            <div className="p-16 text-center text-slate-400 text-[11px] italic">
              No se registran operaciones en el periodo seleccionado.
            </div>
          )}
        </div>
      </div>
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
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Seleccionar Transporte</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">¿Por qué medio se despachará este bulto?</p>
                  </div>
                  <button onClick={() => setIsTransportModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {transports.map((transport) => (
                    <button
                      key={transport.id}
                      onClick={() => selectedSaleForLabel && handlePrintLabel(selectedSaleForLabel, transport.name)}
                      className="group p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl hover:border-sky-500 hover:bg-sky-50 transition-all text-center flex flex-col items-center gap-3 active:scale-95"
                    >
                      <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center group-hover:border-sky-200 shadow-sm transition-all">
                        <Truck className="w-6 h-6 text-sky-600" />
                      </div>
                      <span className="text-sm font-black text-slate-700 uppercase tracking-tight group-hover:text-sky-700 transition-all">{transport.name}</span>
                    </button>
                  ))}
                  
                  {transports.length === 0 && (
                    <div className="col-span-2 py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">No hay transportes creados en Parámetros.</p>
                       <p className="text-[10px] text-slate-300 mt-2">Vaya a Parámetros &gt; Transportes para configurarlos.</p>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={() => setIsTransportModalOpen(false)}
                    className="px-6 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">¿Eliminar esta Venta?</h3>
              <p className="text-sm font-medium text-slate-500 mb-8">
                Esta acción revertirá el stock de los productos e invalidará la venta actual. La cotización original quedará disponible nuevamente para ser procesada.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleDeleteSale}
                  disabled={isDeleting}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/10 active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? 'Eliminando...' : 'Sí, Eliminar Venta'}
                </button>
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                >
                  No, Mantener Venta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
