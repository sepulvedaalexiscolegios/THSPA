import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { 
  Package, 
  Users, 
  FileText, 
  TrendingUp, 
  LogOut, 
  LogIn,
  AlertTriangle,
  Menu,
  X,
  Search,
  Settings2,
  Tag,
  Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Components
import { InventoryView } from './components/InventoryView';
import { CustomerView } from './components/CustomerView';
import { QuotationView } from './components/QuotationView';
import { SalesView } from './components/SalesView';
import { ParametersView } from './components/ParametersView';
import { ConditionsView } from './components/ConditionsView';
import { TransportsView } from './components/TransportsView';

type View = 'inventory' | 'customers' | 'quotations' | 'sales' | 'parameters' | 'conditions' | 'transports';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('quotations'); // Default to quotations or something else
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ parameters: true });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setAuthError(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      alert('Registro exitoso. Revise su correo para confirmar (si está habilitado en Supabase) o intente iniciar sesión.');
      setIsSigningUp(false);
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleLogout = () => supabase.auth.signOut();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-gray-100"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-sky-100 overflow-hidden border border-slate-100">
              <img src="/Logo.png" className="w-16 h-16 object-contain" alt="" onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<div class="text-slate-900 font-black text-2xl">TH</div>';
              }} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">TH Comercial</h1>
            <p className="text-gray-500">Sistema de Gestión de Inventario y Ventas</p>
          </div>

          <form onSubmit={isSigningUp ? handleEmailSignUp : handleEmailLogin} className="space-y-4 mb-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Correo Electrónico</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Contraseña</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
              />
            </div>
            
            {authError && (
              <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-red-600 uppercase leading-tight tracking-tight">{authError}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg shadow-slate-900/10 active:scale-95 transition-all"
            >
              {isSigningUp ? 'Registrarse' : 'Entrar'}
            </button>
          </form>

          <button 
            onClick={() => setIsSigningUp(!isSigningUp)}
            className="w-full text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-800 transition-colors"
          >
            {isSigningUp ? '¿Ya tiene cuenta? Inicie sesión' : '¿No tiene cuenta? Regístrese'}
          </button>
          
          <p className="mt-8 text-[10px] text-slate-400 uppercase tracking-widest font-bold text-center">Powered by Supabase</p>
        </motion.div>
      </div>
    );
  }

  const mainMenuItems = [
    { id: 'quotations', label: 'Cotizaciones', icon: FileText },
    { id: 'sales', label: 'Ventas y Reportes', icon: TrendingUp },
  ];

  const parameterItems = [
    { id: 'inventory', label: 'Maestro de Productos', icon: Package },
    { id: 'customers', label: 'Maestro de Clientes', icon: Users },
    { id: 'parameters', label: 'Cat. y Subcategorías', icon: Tag },
    { id: 'conditions', label: 'Condiciones Grales', icon: FileText },
    { id: 'transports', label: 'Transportes', icon: Truck },
  ];

  const displayName = user.user_metadata?.full_name || user.email || 'Usuario';
  const avatarUrl = user.user_metadata?.avatar_url || '';

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#F8FAFC] font-sans overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 w-full shrink-0">
        <div className="flex items-center gap-2">
          <img src="/Logo.png" className="w-8 h-8 object-contain" alt="Logo" />
          <span className="font-bold text-slate-900">TH Comercial</span>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:sticky top-0 inset-y-0 left-0 bg-[#1E293B] w-64 z-50 transform md:transform-none transition-transform duration-300 ease-in-out border-r border-slate-200 flex flex-col",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-6 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-3">
             <img src="/Logo.png" className="w-10 h-10 object-contain invert brightness-0" alt="" onError={(e) => e.currentTarget.style.display = 'none'} />
             <h1 className="text-xl font-bold text-white tracking-tight leading-none">TH Comercial</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-4">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-2">Operaciones</div>
            <div className="space-y-1">
              {mainMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id as View);
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    currentView === item.id 
                      ? "bg-sky-500 text-white shadow-lg shadow-sky-900/20" 
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <button 
              onClick={() => setExpandedSections(prev => ({ ...prev, parameters: !prev.parameters }))}
              className="w-full flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-2 hover:text-slate-300 transition-colors"
            >
              Parámetros
              <Settings2 className={cn("w-3 h-3 transition-transform", expandedSections.parameters ? "rotate-180" : "")} />
            </button>
            <AnimatePresence initial={false}>
              {expandedSections.parameters && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-1"
                >
                  {parameterItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentView(item.id as View);
                        setIsSidebarOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors pl-4",
                        currentView === item.id 
                          ? "text-white bg-slate-700/50" 
                          : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-3 bg-[#0F172A]">
          <div className="bg-slate-800/50 border border-slate-700 flex items-center gap-3 p-3 rounded-lg">
            {avatarUrl && <img src={avatarUrl} className="w-8 h-8 rounded-full border border-slate-600" alt="" />}
            {!avatarUrl && <div className="w-8 h-8 rounded-full border border-slate-600 bg-slate-700 flex items-center justify-center text-xs font-bold text-white">{displayName.charAt(0)}</div>}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-400 transition-all text-xs font-bold uppercase tracking-wider py-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-auto bg-white border-b border-slate-200 flex flex-col md:flex-row items-center justify-between px-4 sm:px-6 md:px-8 py-3 md:h-16 md:py-0 shadow-sm shrink-0 gap-3 md:gap-0">
          <div className="flex items-center gap-4 w-full md:w-1/2">
             <img src="/Logo.png" className="hidden md:block w-8 h-8 object-contain" alt="Logo" />
             <div className="relative w-full">
               <Search className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 w-5 h-5 top-1/2 -translate-y-1/2" />
               <input 
                type="text" 
                placeholder="Buscar por cliente o N°..." 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-1.5 border border-slate-300 rounded-md leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-xs" 
               />
             </div>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Supabase Sync Active</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F8FAFC] custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="max-w-[1400px] mx-auto"
            >
              {currentView === 'inventory' && <InventoryView />}
              {currentView === 'customers' && <CustomerView />}
              {currentView === 'quotations' && <QuotationView globalSearch={globalSearch} />}
              {currentView === 'sales' && <SalesView />}
              {currentView === 'parameters' && <ParametersView />}
              {currentView === 'conditions' && <ConditionsView />}
              {currentView === 'transports' && <TransportsView />}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="bg-slate-50 border-t border-slate-200 px-4 md:px-6 flex flex-col md:flex-row items-center justify-between shrink-0 py-3 md:py-3 gap-2 md:gap-0 w-full overflow-hidden">
          <div className="text-[10px] text-slate-400 font-medium whitespace-nowrap text-center">
            &copy; {new Date().getFullYear()} TH Comercial S.A. | Cloud Distribution
          </div>
          <div className="flex gap-4 items-center">
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 uppercase tracking-tight">
              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
              Terminal Online
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">v2.9.0-SUPABASE</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
