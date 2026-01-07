"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Plus, Search, Filter, Edit2, Archive, CheckCircle, XCircle, Box, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { toast } from '@/components/ui/Toast';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

// Types
type MenuItem = {
    id: number;
    name: string;
    description?: string;
    price: number;
    category: string;
    image_url?: string;
    is_available: boolean;
    stock?: number;
    type?: 'menu';
};

type Ingredient = {
    id: number;
    name: string;
    type: string; // category
    premium_price: number;
    price?: number; // mapped alias
    is_available: boolean;
    stock?: number;
    icon?: string;
    image_url?: string;
    type_discriminator?: 'ingred';
};

export default function AdminMenuPage() {
    const supabase = createClient();
    const [selectedTab, setSelectedTab] = useState<'menu' | 'ingredients'>('menu');
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [ingredientItems, setIngredientItems] = useState<Ingredient[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<MenuItem | Ingredient> | null>(null);

    // Form States
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        category: 'bowls',
        type: 'protein', // default for ingredient
        imageUrl: ''
    });

    useEffect(() => {
        if (editingItem) {
            let price = '0';
            if ('price' in editingItem && editingItem.price != null) {
                price = editingItem.price.toString();
            } else if ('premium_price' in editingItem && editingItem.premium_price != null) {
                // @ts-ignore
                price = editingItem.premium_price.toString();
            }

            setFormData({
                name: editingItem.name || '',
                description: 'description' in editingItem ? editingItem.description || '' : '',
                price,
                category: 'category' in editingItem ? editingItem.category || 'bowls' : 'bowls',
                type: 'type' in editingItem ? editingItem.type || 'protein' : 'protein',
                imageUrl: 'image_url' in editingItem ? editingItem.image_url || '' : ''
            });
        } else {
            setFormData({ name: '', description: '', price: '0', category: 'bowls', type: 'protein', imageUrl: '' });
        }
    }, [editingItem, isModalOpen]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const table = selectedTab === 'menu' ? 'menu_items' : 'ingredients';
        const payload: any = {
            name: formData.name,
            is_available: true
        };

        if (selectedTab === 'menu') {
            payload.description = formData.description;
            payload.price = parseFloat(formData.price) || 0;
            payload.category = formData.category;
            payload.image_url = formData.imageUrl;
        } else {
            payload.premium_price = parseFloat(formData.price) || 0;
            payload.type = formData.type;
            payload.image_url = formData.imageUrl;
        }

        console.log('Saving...', { editingItem, formData, payload });

        let error;
        if (editingItem && editingItem.id) {
            // Update
            const { data, error: updateError } = await supabase
                .from(table)
                .update(payload)
                .eq('id', editingItem.id)
                .select();

            if (!updateError && (!data || data.length === 0)) {
                error = { message: 'No se pudo guardar. Verifica permisos RLS o conexión.' };
            } else {
                error = updateError;
            }
        } else {
            // Insert
            const { data, error: insertError } = await supabase
                .from(table)
                .insert(payload)
                .select();

            if (!insertError && (!data || data.length === 0)) {
                error = { message: 'No se pudo crear. Verifica permisos RLS.' };
            } else {
                error = insertError;
            }
        }

        if (!error) {
            setIsModalOpen(false);
            fetchData();
            toast.success(editingItem ? 'Producto actualizado correctamente' : 'Producto creado correctamente');
        } else {
            console.error('Save Error:', error);
            // Show more detailed error
            toast.error(error.message || 'Error desconocido al guardar');
        }
    };

    const handleDelete = async () => {
        if (!editingItem || !confirm('¿Estás seguro de eliminar este ítem? Esta acción no se puede deshacer.')) return;

        const table = selectedTab === 'menu' ? 'menu_items' : 'ingredients';
        // @ts-ignore
        const { error } = await supabase.from(table).delete().eq('id', editingItem.id);

        if (!error) {
            setIsModalOpen(false);
            fetchData();
            toast.success('Producto eliminado correctamente');
        } else {
            toast.error('Error al eliminar: ' + error.message);
        }
    };

    // Fetch Data - Optimized for Speed
    const fetchData = async () => {
        // Only show full page spinner on initial load, not subsequent refreshes
        if (menuItems.length === 0) setLoading(true);

        const [menuRes, ingRes] = await Promise.all([
            supabase.from('menu_items').select('*').order('name'),
            supabase.from('ingredients').select('*').order('name')
        ]);

        if (menuRes.data) setMenuItems(menuRes.data.map(d => ({ ...d, type: 'menu' } as MenuItem)));
        if (ingRes.data) setIngredientItems(ingRes.data.map(d => ({ ...d, type_discriminator: 'ingred', price: d.premium_price } as Ingredient)));

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []); // Only active on mount

    // Actions
    const toggleAvailability = async (id: number, current: boolean, table: string) => {
        // Optimistic Update
        if (table === 'menu_items') {
            setMenuItems(prev => prev.map(i => i.id === id ? { ...i, is_available: !current } : i));
        } else {
            setIngredientItems(prev => prev.map(i => i.id === id ? { ...i, is_available: !current } : i));
        }

        const { error } = await supabase.from(table).update({ is_available: !current }).eq('id', id);
        if (error) {
            // Revert on error
            alert('Error updating status');
            fetchData();
        }
    };

    const activeList = selectedTab === 'menu' ? menuItems : ingredientItems;
    const filteredItems = activeList.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-yoko-dark">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestión de Menú</h1>
                    <p className="text-gray-500 text-sm">Administra productos, precios y disponibilidad.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingItem(null); // New item
                        setIsModalOpen(true);
                    }}
                    className="bg-yoko-dark text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg hover:shadow-xl transform active:scale-95"
                >
                    <Plus size={20} /> Nuevo {selectedTab === 'menu' ? 'Producto' : 'Ingrediente'}
                </button>
            </div>

            {/* Tabs & Filters */}
            <div className="bg-white p-2 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-center border border-gray-100 shadow-sm">
                <div className="flex bg-gray-50 p-1 rounded-xl w-full md:w-fit">
                    <button
                        onClick={() => setSelectedTab('menu')}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex-1 md:flex-none ${selectedTab === 'menu' ? 'bg-white text-yoko-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Bowls & Burgers
                    </button>
                    <button
                        onClick={() => setSelectedTab('ingredients')}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex-1 md:flex-none ${selectedTab === 'ingredients' ? 'bg-white text-yoko-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Ingredientes
                    </button>
                </div>

                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-yoko-primary outline-none text-sm w-full md:w-64 text-yoko-dark placeholder-gray-400 transition-all focus:bg-white"
                    />
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="p-20 text-center text-gray-500 animate-pulse">Cargando datos...</div>
            ) : (
                <div className="space-y-8">
                    {(selectedTab === 'menu' ? [
                        { id: 'bowls', label: 'Signature Bowls' },
                        { id: 'burgers', label: 'Sushi Burgers' },
                        { id: 'sides', label: 'Share & Smile' },
                        { id: 'drinks', label: 'Drinks' },
                        { id: 'desserts', label: 'Postres' },
                        // Fallback for misc
                        { id: 'other', label: 'Otros' }
                    ] : [
                        { id: 'base', label: 'Bases' },
                        { id: 'protein', label: 'Proteínas' },
                        { id: 'mixins', label: 'Mixins (Vegetales)' },
                        { id: 'toppings', label: 'Toppings (Secos)' },
                        { id: 'sauces', label: 'Salsas' },
                        { id: 'extras', label: 'Extras' }
                    ]).map(group => {
                        const groupItems = filteredItems.filter(item => {
                            const cat = 'type' in item ? (item.type || '') : (item.category || '');
                            if (group.id === 'other') return !['bowls', 'burgers', 'sides', 'drinks', 'desserts'].includes(cat);
                            return cat === group.id;
                        });

                        if (groupItems.length === 0) return null;

                        return (
                            <motion.div
                                key={group.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
                            >
                                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-yoko-primary rounded-full"></div>
                                        <h3 className="font-bold text-lg text-yoko-dark tracking-wide">{group.label}</h3>
                                        <span className="bg-white px-2 py-0.5 rounded text-xs text-gray-400 font-bold border border-gray-100 shadow-sm">
                                            {groupItems.length}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setEditingItem(null);
                                            setFormData(prev => ({
                                                ...prev,
                                                category: selectedTab === 'menu' ? group.id : 'bowls',
                                                type: selectedTab === 'ingredients' ? group.id : 'protein'
                                            }));
                                            setIsModalOpen(true);
                                        }}
                                        className="p-2 bg-white rounded-full text-yoko-primary hover:bg-yoko-primary hover:text-white transition-all transform hover:scale-110 active:scale-95 shadow-sm border border-gray-100"
                                        title="Agregar aquí"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                                <table className="w-full">
                                    <thead className="bg-gray-50 text-left border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Precio</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Estatus</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <motion.tbody
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="show"
                                        className="divide-y divide-gray-50"
                                    >
                                        <AnimatePresence mode='popLayout'>
                                            {groupItems.map((item) => (
                                                <motion.tr
                                                    key={item.id}
                                                    layout
                                                    variants={itemVariants}
                                                    initial="hidden"
                                                    animate="show"
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    className="hover:bg-gray-50 transition-colors cursor-default group"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="relative w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200 group-hover:border-yoko-primary/30 transition-colors shadow-inner">
                                                                {'image_url' in item && item.image_url ? (
                                                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-2xl opacity-50">{'icon' in item ? item.icon : '🥣'}</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-yoko-dark group-hover:text-black transition-colors">{item.name}</p>
                                                                {'description' in item && (
                                                                    <p className="text-xs text-gray-400 truncate max-w-[200px]">{item.description}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-yoko-primary font-bold">
                                                        ${item.price}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button
                                                            onClick={() => toggleAvailability(item.id, item.is_available, selectedTab === 'menu' ? 'menu_items' : 'ingredients')}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none border-2 ${item.is_available ? 'bg-yoko-primary border-yoko-primary' : 'bg-gray-100 border-gray-200'}`}
                                                        >
                                                            <span
                                                                className={`inline-block h-3 w-3 transform rounded-full bg-current transition-transform ${item.is_available ? 'translate-x-6 text-white' : 'translate-x-1 text-gray-400'}`}
                                                            />
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => {
                                                                setEditingItem(item);
                                                                setIsModalOpen(true);
                                                            }}
                                                            className="text-gray-400 hover:text-yoko-dark p-2 hover:bg-gray-100 rounded-lg transition-all"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    </motion.tbody>
                                </table>
                            </motion.div>
                        );
                    })}
                </div>
            )}
            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                    >
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-serif font-bold text-xl text-yoko-dark">
                                {editingItem ? 'Editar' : 'Nuevo'} {selectedTab === 'menu' ? 'Producto' : 'Ingrediente'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="bg-white p-1 rounded-full text-gray-400 hover:text-red-500 transition shadow-sm">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                                <input
                                    required
                                    className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-yoko-primary"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej. Pokewon"
                                />
                            </div>

                            {selectedTab === 'menu' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descripción</label>
                                    <textarea
                                        className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-yoko-primary h-20 resize-none"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Ingredientes deliciosos..."
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Precio {selectedTab === 'ingredients' && '(Extra)'}</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        required
                                        className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-yoko-primary"
                                        value={formData.price}
                                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoría</label>
                                    <select
                                        className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-yoko-primary bg-white"
                                        value={selectedTab === 'menu' ? formData.category : formData.type}
                                        onChange={e => setFormData({ ...formData, [selectedTab === 'menu' ? 'category' : 'type']: e.target.value })}
                                    >
                                        {selectedTab === 'menu' ? (
                                            <>
                                                <option value="bowls">Bowls (Pokes de la Casa)</option>
                                                <option value="burgers">Sushi Burgers</option>
                                                <option value="sides">Share & Smile (Entradas)</option>
                                                <option value="drinks">Drinks (Bebidas)</option>
                                                <option value="desserts">Postres</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="protein">Proteína</option>
                                                <option value="base">Base</option>
                                                <option value="mixins">Mixin (Vegetales)</option>
                                                <option value="toppings">Topping (Secos)</option>
                                                <option value="sauces">Salsa</option>
                                                <option value="extras">Extra</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Imagen (Subir o URL)</label>
                                <div className="flex flex-col gap-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;

                                            // Show loading state/toast here if possible, but for now simple
                                            const fileExt = file.name.split('.').pop();
                                            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`; // Better unique name
                                            const filePath = `${fileName}`;

                                            const { error: uploadError } = await supabase.storage
                                                .from('menu-images')
                                                .upload(filePath, file);

                                            if (uploadError) {
                                                alert('Error subiendo imagen: ' + uploadError.message);
                                            } else {
                                                const { data: { publicUrl } } = supabase.storage
                                                    .from('menu-images')
                                                    .getPublicUrl(filePath);

                                                // Use functional update to avoid stale closures
                                                console.log('Upload success, setting URL:', publicUrl);
                                                setFormData(prev => ({ ...prev, imageUrl: publicUrl }));
                                                toast.success('Imagen subida correctamente');
                                            }
                                        }}
                                        className="w-full text-sm text-gray-500
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-full file:border-0
                                                file:text-sm file:font-bold
                                                file:bg-yoko-primary file:text-white
                                                hover:file:bg-yoko-secondary
                                            "
                                    />
                                    <div className="text-center text-xs text-gray-400 font-bold">- O -</div>
                                    <input
                                        className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-yoko-primary text-sm font-mono text-gray-600"
                                        value={formData.imageUrl}
                                        onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                        placeholder="https://... (URL externa)"
                                    />
                                </div>
                                {formData.imageUrl && (
                                    <div className="mt-2 h-20 w-full bg-gray-100 rounded-lg overflow-hidden relative">
                                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-4 pt-2">
                                {editingItem && (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="bg-red-50 text-red-500 font-bold p-4 rounded-xl hover:bg-red-100 transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                <button type="submit" className="flex-1 bg-yoko-dark text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all">
                                    {editingItem ? 'Actualizar' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </motion.div >
                </div >
            )
            }
        </div >
    );
}

