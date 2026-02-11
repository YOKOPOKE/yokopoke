import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface OrderHistoryItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

export interface OrderHistory {
    id?: string;
    phone: string;
    customer_name?: string;
    order_date?: string;
    items: OrderHistoryItem[];
    total: number;
    delivery_method?: string;
    location?: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    full_address?: string;
    address_references?: string;
}

/**
 * Save completed order to history for personalized recommendations
 */
export async function saveOrderToHistory(order: OrderHistory): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('order_history')
            .insert({
                phone: order.phone,
                customer_name: order.customer_name,
                items: order.items,
                total: order.total,
                delivery_method: order.delivery_method,
                location: order.location,
                full_address: order.full_address,
                address_references: order.address_references
            });

        if (error) {
            console.error('Error saving order to history:', error);
            return false;
        }

        console.log(`✅ Order saved to history for ${order.phone}`);
        return true;
    } catch (e) {
        console.error('saveOrderToHistory error:', e);
        return false;
    }
}

/**
 * Get order history for a customer (last 5 orders)
 */
export async function getOrderHistory(phone: string, limit: number = 5): Promise<OrderHistory[]> {
    try {
        const { data, error } = await supabase
            .from('order_history')
            .select('*')
            .eq('phone', phone)
            .order('order_date', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching order history:', error);
            return [];
        }

        return data || [];
    } catch (e) {
        console.error('getOrderHistory error:', e);
        return [];
    }
}

/**
 * Get customer's favorite items (most ordered)
 */
export async function getFavoriteItems(phone: string): Promise<string[]> {
    try {
        const history = await getOrderHistory(phone, 10);

        if (history.length === 0) return [];

        // Count item occurrences
        const itemCount: { [key: string]: number } = {};

        history.forEach(order => {
            order.items.forEach(item => {
                itemCount[item.name] = (itemCount[item.name] || 0) + item.quantity;
            });
        });

        // Sort by count and return top 3
        return Object.entries(itemCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name]) => name);

    } catch (e) {
        console.error('getFavoriteItems error:', e);
        return [];
    }
}
